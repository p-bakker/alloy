import {
  getDoc,
  getEncode,
  getFormat,
  getMaxItems,
  getMaxLength,
  getMaxValue,
  getMaxValueExclusive,
  getMinItems,
  getMinLength,
  getMinValue,
  getMinValueExclusive,
  getPattern,
  isKey,
  type Enum,
  type Model,
  type ModelProperty,
  type Namespace,
  type Program,
  type Scalar,
  type Type,
  type Union,
} from "@typespec/compiler";

// ── Intermediate model types ─────────────────────────────────────────────────

export interface TspModel {
  name: string;
  doc?: string;
  properties: TspProperty[];
}

export interface TspProperty {
  name: string;
  doc?: string;
  type: TspType;
  optional: boolean;
  constraints: TspConstraints;
}

export interface TspConstraints {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  minValueExclusive?: number;
  maxValueExclusive?: number;
  minItems?: number;
  maxItems?: number;
  format?: string;
  pattern?: string;
}

export type TspType =
  | { kind: "scalar"; rustType: string }
  | { kind: "array"; elementType: TspType }
  | { kind: "ref"; name: string }
  | { kind: "newtype-ref"; newtypeName: string };

export interface TspNewtype {
  name: string;
  innerType: string;
  doc?: string;
  sourceModel: string;
  sourceProperty: string;
}

export interface TspEnum {
  name: string;
  doc?: string;
  members: TspEnumMember[];
}

export interface TspEnumMember {
  name: string;
  doc?: string;
  value?: string | number;
}

export interface TspUnion {
  name: string;
  doc?: string;
  variants: TspUnionVariant[];
}

export interface TspUnionVariant {
  name: string;
  doc?: string;
  value?: string;
}

export interface TspProgram {
  models: TspModel[];
  enums: TspEnum[];
  unions: TspUnion[];
  newtypes: TspNewtype[];
  requiredCrates: Set<string>;
}

// ── Rich type defaults ──────────────────────────────────────────────────────

const RICH_TYPE_DEFAULTS: Record<string, string> = {
  plainDate: "chrono::NaiveDate",
  plainTime: "chrono::NaiveTime",
  utcDateTime: "chrono::DateTime<chrono::Utc>",
  offsetDateTime: "chrono::DateTime<chrono::FixedOffset>",
  duration: "chrono::Duration",
  url: "url::Url",
  decimal: "rust_decimal::Decimal",
  decimal128: "rust_decimal::Decimal",
};

const SIMPLE_TYPE_DEFAULTS: Record<string, string> = {
  plainDate: "String",
  plainTime: "String",
  utcDateTime: "String",
  offsetDateTime: "String",
  duration: "String",
  url: "String",
  decimal: "String",
  decimal128: "String",
};

export type RichTypesOption = boolean | Record<string, string>;

function buildTypeOverrides(richTypes: RichTypesOption): Record<string, string> {
  if (richTypes === false) {
    return SIMPLE_TYPE_DEFAULTS;
  }
  if (richTypes === true || richTypes === undefined) {
    return RICH_TYPE_DEFAULTS;
  }
  // User-provided map: use their overrides, fall back to simple strings
  return { ...SIMPLE_TYPE_DEFAULTS, ...richTypes };
}

// Derive which external crates are needed from the resolved type strings
function collectCratesFromType(rustType: string, crates: Set<string>) {
  if (rustType.startsWith("chrono::")) crates.add("chrono");
  if (rustType.startsWith("url::")) crates.add("url");
  if (rustType.startsWith("rust_decimal::")) crates.add("rust_decimal");
}

// ── TypeSpec scalar → Rust type mapping ──────────────────────────────────────

function scalarToRust(
  program: Program,
  scalar: Scalar,
  overrides: Record<string, string>,
  crates: Set<string>,
): string {
  // Check @encode first — e.g. unixTimestamp32 has @encode("unixTimestamp", int32)
  const encode = getEncode(program, scalar);
  if (encode) {
    const encodedType = scalarToRust(program, encode.type, overrides, crates);
    return encodedType;
  }

  const name = scalar.name;

  // Check overrides for types that have rich/simple variants
  if (name in overrides) {
    const mapped = overrides[name];
    collectCratesFromType(mapped, crates);
    return mapped;
  }

  switch (name) {
    case "string":
      return "String";
    case "boolean":
      return "bool";
    case "int8":
      return "i8";
    case "int16":
      return "i16";
    case "int32":
      return "i32";
    case "int64":
      return "i64";
    case "uint8":
      return "u8";
    case "uint16":
      return "u16";
    case "uint32":
      return "u32";
    case "uint64":
      return "u64";
    case "safeint":
      return "i64";
    case "float32":
      return "f32";
    case "float64":
      return "f64";
    case "numeric":
    case "float":
      return "f64";
    case "integer":
      return "i64";
    case "bytes":
      return "Vec<u8>";
    default:
      // Walk up the base scalar chain
      if (scalar.baseScalar) {
        return scalarToRust(program, scalar.baseScalar, overrides, crates);
      }
      return "String";
  }
}

// ── Newtype helper ───────────────────────────────────────────────────────────

function newtypeNameFor(modelName: string): string {
  return `${modelName}Id`;
}

function registerNewtype(
  program: Program,
  prop: ModelProperty,
  newtypes: Map<string, TspNewtype>,
  overrides: Record<string, string>,
  crates: Set<string>,
): string {
  const modelName = prop.model!.name;
  const ntName = newtypeNameFor(modelName);

  if (!newtypes.has(ntName)) {
    const innerType = scalarToRust(program, prop.type as Scalar, overrides, crates);
    newtypes.set(ntName, {
      name: ntName,
      innerType,
      doc: `Unique identifier for ${modelName}`,
      sourceModel: modelName,
      sourceProperty: prop.name,
    });
  }

  return ntName;
}

// ── Type resolution ──────────────────────────────────────────────────────────

function resolveType(
  program: Program,
  type: Type,
  overrides: Record<string, string>,
  crates: Set<string>,
  newtypes: Map<string, TspNewtype>,
): TspType {
  switch (type.kind) {
    case "Scalar":
      return {
        kind: "scalar",
        rustType: scalarToRust(program, type, overrides, crates),
      };

    case "Enum":
      return { kind: "ref", name: type.name };

    case "Union":
      if (type.name) {
        return { kind: "ref", name: type.name };
      }
      return { kind: "scalar", rustType: "String" };

    case "Model": {
      if (type.indexer && type.name === "Array") {
        const elementType = resolveType(
          program,
          type.indexer.value,
          overrides,
          crates,
          newtypes,
        );
        return { kind: "array", elementType };
      }
      if (type.name) {
        return { kind: "ref", name: type.name };
      }
      return { kind: "scalar", rustType: "String" };
    }

    case "String":
      return { kind: "scalar", rustType: "String" };

    case "Number":
      return { kind: "scalar", rustType: "f64" };

    case "Boolean":
      return { kind: "scalar", rustType: "bool" };

    case "ModelProperty": {
      // Member access like Store.id — register a newtype and reference it
      const ntName = registerNewtype(program, type, newtypes, overrides, crates);
      return { kind: "newtype-ref", newtypeName: ntName };
    }

    default:
      return { kind: "scalar", rustType: "String" };
  }
}

// ── Constraint extraction ────────────────────────────────────────────────────

function extractConstraints(
  program: Program,
  prop: ModelProperty,
): TspConstraints {
  const constraints: TspConstraints = {};

  const minLen = getMinLength(program, prop);
  if (minLen !== undefined) constraints.minLength = minLen;

  const maxLen = getMaxLength(program, prop);
  if (maxLen !== undefined) constraints.maxLength = maxLen;

  const minVal = getMinValue(program, prop);
  if (minVal !== undefined) constraints.minValue = minVal;

  const maxVal = getMaxValue(program, prop);
  if (maxVal !== undefined) constraints.maxValue = maxVal;

  const minValEx = getMinValueExclusive(program, prop);
  if (minValEx !== undefined) constraints.minValueExclusive = minValEx;

  const maxValEx = getMaxValueExclusive(program, prop);
  if (maxValEx !== undefined) constraints.maxValueExclusive = maxValEx;

  const minIt = getMinItems(program, prop);
  if (minIt !== undefined) constraints.minItems = minIt;

  const maxIt = getMaxItems(program, prop);
  if (maxIt !== undefined) constraints.maxItems = maxIt;

  const fmt = getFormat(program, prop);
  if (fmt !== undefined) constraints.format = fmt;

  const pat = getPattern(program, prop);
  if (pat !== undefined) constraints.pattern = pat;

  return constraints;
}

// ── Model / enum / union extraction ──────────────────────────────────────────

function extractModel(
  program: Program,
  model: Model,
  overrides: Record<string, string>,
  crates: Set<string>,
  newtypes: Map<string, TspNewtype>,
): TspModel {
  const properties: TspProperty[] = [];

  for (const [, prop] of model.properties) {
    // Property-level @encode overrides the scalar's own type mapping
    const propEncode = getEncode(program, prop);
    let type: TspType;

    if (propEncode) {
      type = {
        kind: "scalar" as const,
        rustType: scalarToRust(program, propEncode.type, overrides, crates),
      };
    } else if (isKey(program, prop) && prop.type.kind === "Scalar") {
      // @key property — register a newtype and use it here too
      const ntName = registerNewtype(program, prop, newtypes, overrides, crates);
      type = { kind: "newtype-ref", newtypeName: ntName };
    } else {
      type = resolveType(program, prop.type, overrides, crates, newtypes);
    }

    properties.push({
      name: prop.name,
      doc: getDoc(program, prop),
      type,
      optional: prop.optional,
      constraints: extractConstraints(program, prop),
    });
  }

  return {
    name: model.name,
    doc: getDoc(program, model),
    properties,
  };
}

function extractEnum(program: Program, en: Enum): TspEnum {
  const members: TspEnumMember[] = [];
  for (const [, member] of en.members) {
    members.push({
      name: member.name,
      doc: getDoc(program, member),
      value: member.value,
    });
  }
  return {
    name: en.name,
    doc: getDoc(program, en),
    members,
  };
}

function extractUnion(program: Program, union: Union): TspUnion {
  const variants: TspUnionVariant[] = [];
  for (const [, variant] of union.variants) {
    const name = typeof variant.name === "string" ? variant.name : "Unknown";
    let value: string | undefined;
    if (variant.type.kind === "String") {
      value = variant.type.value;
    }
    variants.push({
      name,
      doc: getDoc(program, variant),
      value,
    });
  }
  return {
    name: union.name ?? "AnonymousUnion",
    doc: getDoc(program, union),
    variants,
  };
}

// ── Namespace filtering ──────────────────────────────────────────────────────

const BUILTIN_NAMESPACES = new Set([
  "TypeSpec",
  "TypeSpec.Http",
  "TypeSpec.Rest",
  "TypeSpec.OpenAPI",
  "TypeSpec.Protobuf",
  "TypeSpec.JsonSchema",
  "TypeSpec.Xml",
  "TypeSpec.Events",
  "TypeSpec.SSE",
  "TypeSpec.Streams",
]);

function isUserNamespace(ns: Namespace): boolean {
  const fqn = getNamespaceFqn(ns);
  if (BUILTIN_NAMESPACES.has(fqn)) return false;
  for (const builtin of BUILTIN_NAMESPACES) {
    if (fqn.startsWith(builtin + ".")) return false;
  }
  return true;
}

function getNamespaceFqn(ns: Namespace): string {
  const parts: string[] = [];
  let current: Namespace | undefined = ns;
  while (current && current.name !== "") {
    parts.unshift(current.name);
    current = current.namespace;
  }
  return parts.join(".");
}

// ── Walk namespace tree ──────────────────────────────────────────────────────

function collectFromNamespace(
  program: Program,
  ns: Namespace,
  result: TspProgram,
  overrides: Record<string, string>,
  newtypes: Map<string, TspNewtype>,
) {
  for (const [, model] of ns.models) {
    if (model.templateMapper || !model.name) continue;
    result.models.push(
      extractModel(program, model, overrides, result.requiredCrates, newtypes),
    );
  }
  for (const [, en] of ns.enums) {
    result.enums.push(extractEnum(program, en));
  }
  for (const [, union] of ns.unions) {
    result.unions.push(extractUnion(program, union));
  }
  for (const [, child] of ns.namespaces) {
    if (isUserNamespace(child)) {
      collectFromNamespace(program, child, result, overrides, newtypes);
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function extractProgram(
  program: Program,
  richTypes: RichTypesOption = true,
): TspProgram {
  const overrides = buildTypeOverrides(richTypes);
  const newtypes = new Map<string, TspNewtype>();
  const result: TspProgram = {
    models: [],
    enums: [],
    unions: [],
    newtypes: [],
    requiredCrates: new Set(),
  };
  const globalNs = program.getGlobalNamespaceType();

  for (const [, ns] of globalNs.namespaces) {
    if (isUserNamespace(ns)) {
      collectFromNamespace(program, ns, result, overrides, newtypes);
    }
  }

  result.newtypes = [...newtypes.values()];

  // Post-process: update source model properties to use their newtypes.
  // e.g., if StoreId was created from Store.id, then Store.id should also be StoreId.
  for (const nt of result.newtypes) {
    const sourceModel = result.models.find((m) => m.name === nt.sourceModel);
    if (sourceModel) {
      const sourceProp = sourceModel.properties.find(
        (p) => p.name === nt.sourceProperty,
      );
      if (sourceProp && sourceProp.type.kind !== "newtype-ref") {
        sourceProp.type = { kind: "newtype-ref", newtypeName: nt.name };
      }
    }
  }

  return result;
}
