import {
  Children,
  For,
  List,
  Output,
  SourceDirectory,
  namekey,
  render,
  writeOutput,
} from "@alloy-js/core";
import {
  Attribute,
  CrateDirectory,
  EnumDeclaration,
  EnumVariant,
  Field,
  FunctionDeclaration,
  ImplBlock,
  IfExpression,
  Reference,
  SourceFile,
  StructDeclaration,
  createRustNamePolicy,
} from "@alloy-js/rust";
import { type EmitContext } from "@typespec/compiler";

import {
  DEFAULT_CARGO_DEPS,
  formatCargoDep,
  serdeCrate,
  stdCrate,
  validatorCrate,
  type CargoDep,
} from "./externals.js";
import type { RustEmitterOptions } from "./lib.js";
import {
  extractProgram,
  type TspConstraints,
  type TspEnum,
  type TspModel,
  type TspNewtype,
  type TspProperty,
  type TspType,
  type TspUnion,
} from "./tsp-reader.js";

// ── $onEmit — TypeSpec emitter entry point ───────────────────────────────────

export async function $onEmit(context: EmitContext<RustEmitterOptions>) {
  const { program, emitterOutputDir, options } = context;

  const crateName = options["crate-name"] ?? "generated-models";
  const edition = options.edition ?? "2024";
  const richTypes = options["rich-types"] ?? true;

  // Merge user dependency overrides with defaults
  const deps: Record<string, CargoDep> = { ...DEFAULT_CARGO_DEPS };
  if (options.dependencies) {
    for (const [name, dep] of Object.entries(options.dependencies)) {
      deps[name] = dep;
    }
  }

  const tsp = extractProgram(program, richTypes);

  // ── Namekeys for all types ─────────────────────────────────────────────────

  const typeKeys = new Map<string, ReturnType<typeof namekey>>();
  for (const model of tsp.models) {
    typeKeys.set(model.name, namekey(model.name));
  }
  for (const en of tsp.enums) {
    typeKeys.set(en.name, namekey(en.name));
  }
  for (const union of tsp.unions) {
    typeKeys.set(union.name, namekey(union.name));
  }
  for (const nt of tsp.newtypes) {
    typeKeys.set(nt.name, namekey(nt.name));
  }

  // ── Type mapping ───────────────────────────────────────────────────────────

  function mapType(type: TspType, optional: boolean): Children {
    let inner: Children;

    switch (type.kind) {
      case "scalar":
        inner = type.rustType;
        break;
      case "array": {
        const el = mapType(type.elementType, false);
        inner = <>Vec&lt;{el}&gt;</>;
        break;
      }
      case "ref": {
        const refKey = typeKeys.get(type.name);
        inner = refKey ? <Reference refkey={refKey} /> : type.name;
        break;
      }
      case "newtype-ref": {
        const refKey = typeKeys.get(type.newtypeName);
        inner = refKey ? <Reference refkey={refKey} /> : type.newtypeName;
        break;
      }
    }

    if (optional) {
      return <>Option&lt;{inner}&gt;</>;
    }
    return inner;
  }

  // ── Validation attribute generation ────────────────────────────────────────

  function hasConstraints(constraints: TspConstraints): boolean {
    return (
      constraints.minLength !== undefined ||
      constraints.maxLength !== undefined ||
      constraints.minValue !== undefined ||
      constraints.maxValue !== undefined ||
      constraints.minValueExclusive !== undefined ||
      constraints.maxValueExclusive !== undefined ||
      constraints.format !== undefined ||
      constraints.minItems !== undefined ||
      constraints.maxItems !== undefined ||
      constraints.pattern !== undefined
    );
  }

  function validatorAttribute(constraints: TspConstraints): Children | null {
    const parts: string[] = [];

    if (
      constraints.minLength !== undefined &&
      constraints.maxLength !== undefined
    ) {
      parts.push(
        `length(min = ${constraints.minLength}, max = ${constraints.maxLength})`,
      );
    } else if (constraints.minLength !== undefined) {
      parts.push(`length(min = ${constraints.minLength})`);
    } else if (constraints.maxLength !== undefined) {
      parts.push(`length(max = ${constraints.maxLength})`);
    }

    // Combine inclusive and exclusive bounds into a single range()
    // validator crate doesn't distinguish exclusive — we handle it in runtime checks
    const hasAnyRange =
      constraints.minValue !== undefined ||
      constraints.maxValue !== undefined ||
      constraints.minValueExclusive !== undefined ||
      constraints.maxValueExclusive !== undefined;
    if (hasAnyRange) {
      const rangeParts: string[] = [];
      if (constraints.minValue !== undefined)
        rangeParts.push(`min = ${constraints.minValue}`);
      else if (constraints.minValueExclusive !== undefined)
        rangeParts.push(`min = ${constraints.minValueExclusive}`);
      if (constraints.maxValue !== undefined)
        rangeParts.push(`max = ${constraints.maxValue}`);
      else if (constraints.maxValueExclusive !== undefined)
        rangeParts.push(`max = ${constraints.maxValueExclusive}`);
      parts.push(`range(${rangeParts.join(", ")})`);
    }

    if (constraints.format === "email") {
      parts.push("email");
    } else if (constraints.format === "url" || constraints.format === "uri") {
      parts.push("url");
    }

    if (
      constraints.minItems !== undefined &&
      constraints.maxItems !== undefined
    ) {
      parts.push(
        `length(min = ${constraints.minItems}, max = ${constraints.maxItems})`,
      );
    } else if (constraints.minItems !== undefined) {
      parts.push(`length(min = ${constraints.minItems})`);
    } else if (constraints.maxItems !== undefined) {
      parts.push(`length(max = ${constraints.maxItems})`);
    }

    if (constraints.pattern !== undefined) {
      // Escape backslashes for the Rust string literal inside the attribute
      const escaped = constraints.pattern.replace(/\\/g, "\\\\");
      parts.push(`regex(path = "RE_${escaped}")`)
    }

    if (parts.length === 0) return null;

    return (
      <>
        <Attribute name="validate" args={parts.join(", ")} />
        <hbr />
      </>
    );
  }

  function modelNeedsValidation(model: TspModel): boolean {
    return model.properties.some((p) => hasConstraints(p.constraints));
  }

  // ── Serde rename attribute for snake_case conversion ───────────────────────

  function toSnakeCase(s: string): string {
    return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  }

  // ── Components ─────────────────────────────────────────────────────────────

  function NewtypeStruct(props: { nt: TspNewtype }) {
    const { nt } = props;
    const key = typeKeys.get(nt.name)!;

    return (
      <StructDeclaration
        name={key}
        pub
        tuple
        types={[`pub ${nt.innerType}`]}
        derives={[
          "Debug",
          "Clone",
          "PartialEq",
          "Eq",
          "Hash",
          "Serialize",
          "Deserialize",
        ]}
        doc={nt.doc}
      />
    );
  }

  function ModelStruct(props: { model: TspModel }) {
    const { model } = props;
    const key = typeKeys.get(model.name)!;
    const derives: string[] = ["Debug", "Clone", "Serialize", "Deserialize"];
    if (modelNeedsValidation(model)) {
      derives.push("Validate");
    }

    return (
      <StructDeclaration name={key} pub derives={derives} doc={model.doc}>
        {model.properties.map((prop: TspProperty) => {
          const rustName = toSnakeCase(prop.name);
          const needsRename = rustName !== prop.name;
          const vAttr = validatorAttribute(prop.constraints);

          return (
            <>
              {needsRename && (
                <>
                  <Attribute name="serde" args={`rename = "${prop.name}"`} />
                  <hbr />
                </>
              )}
              {vAttr}
              <Field
                name={prop.name}
                type={mapType(prop.type, prop.optional)}
                pub
                doc={prop.doc}
              />
            </>
          );
        })}
      </StructDeclaration>
    );
  }

  function EnumType(props: { en: TspEnum }) {
    const { en } = props;
    const key = typeKeys.get(en.name)!;

    return (
      <EnumDeclaration
        name={key}
        pub
        derives={["Debug", "Clone", "Serialize", "Deserialize", "PartialEq"]}
        doc={en.doc}
      >
        <For each={en.members}>
          {(member) => <EnumVariant name={member.name} doc={member.doc} />}
        </For>
      </EnumDeclaration>
    );
  }

  function UnionType(props: { union: TspUnion }) {
    const { union } = props;
    const key = typeKeys.get(union.name)!;

    // All-string-literal union → serde rename_all
    const allStringLiterals = union.variants.every(
      (v) => v.value !== undefined,
    );

    return (
      <EnumDeclaration
        name={key}
        pub
        derives={["Debug", "Clone", "Serialize", "Deserialize", "PartialEq"]}
        doc={union.doc}
        attributes={
          allStringLiterals ? (
            <Attribute name="serde" args='rename_all = "lowercase"' />
          ) : undefined
        }
      >
        <For each={union.variants}>
          {(variant) => <EnumVariant name={variant.name} doc={variant.doc} />}
        </For>
      </EnumDeclaration>
    );
  }

  function ValidationImpl(props: { model: TspModel }) {
    const { model } = props;
    const key = typeKeys.get(model.name)!;

    const constrainedProps = model.properties.filter((p) =>
      hasConstraints(p.constraints),
    );
    if (constrainedProps.length === 0) return <></>;

    function emitChecks(prop: TspProperty): Children[] {
      const checks: Children[] = [];
      const field = toSnakeCase(prop.name);
      const c = prop.constraints;

      if (c.minLength !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = &self.${field}`}>
              <IfExpression condition={`val.len() < ${c.minLength}`}>
                {`errors.push(format!("${prop.name} must be at least ${c.minLength} characters"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field}.len() < ${c.minLength}`}>
              {`errors.push(format!("${prop.name} must be at least ${c.minLength} characters"));`}
            </IfExpression>,
          );
        }
      }

      if (c.maxLength !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = &self.${field}`}>
              <IfExpression condition={`val.len() > ${c.maxLength}`}>
                {`errors.push(format!("${prop.name} must be at most ${c.maxLength} characters"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field}.len() > ${c.maxLength}`}>
              {`errors.push(format!("${prop.name} must be at most ${c.maxLength} characters"));`}
            </IfExpression>,
          );
        }
      }

      if (c.minValue !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = self.${field}`}>
              <IfExpression condition={`val < ${c.minValue}`}>
                {`errors.push(format!("${prop.name} must be at least ${c.minValue}"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field} < ${c.minValue}`}>
              {`errors.push(format!("${prop.name} must be at least ${c.minValue}"));`}
            </IfExpression>,
          );
        }
      }

      if (c.maxValue !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = self.${field}`}>
              <IfExpression condition={`val > ${c.maxValue}`}>
                {`errors.push(format!("${prop.name} must be at most ${c.maxValue}"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field} > ${c.maxValue}`}>
              {`errors.push(format!("${prop.name} must be at most ${c.maxValue}"));`}
            </IfExpression>,
          );
        }
      }

      if (c.minItems !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = &self.${field}`}>
              <IfExpression condition={`val.len() < ${c.minItems}`}>
                {`errors.push(format!("${prop.name} must have at least ${c.minItems} items"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field}.len() < ${c.minItems}`}>
              {`errors.push(format!("${prop.name} must have at least ${c.minItems} items"));`}
            </IfExpression>,
          );
        }
      }

      if (c.minValueExclusive !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = self.${field}`}>
              <IfExpression condition={`val <= ${c.minValueExclusive}`}>
                {`errors.push(format!("${prop.name} must be greater than ${c.minValueExclusive}"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field} <= ${c.minValueExclusive}`}>
              {`errors.push(format!("${prop.name} must be greater than ${c.minValueExclusive}"));`}
            </IfExpression>,
          );
        }
      }

      if (c.maxValueExclusive !== undefined) {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = self.${field}`}>
              <IfExpression condition={`val >= ${c.maxValueExclusive}`}>
                {`errors.push(format!("${prop.name} must be less than ${c.maxValueExclusive}"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`self.${field} >= ${c.maxValueExclusive}`}>
              {`errors.push(format!("${prop.name} must be less than ${c.maxValueExclusive}"));`}
            </IfExpression>,
          );
        }
      }

      if (c.format === "email") {
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = &self.${field}`}>
              <IfExpression condition={`!val.contains('@')`}>
                {`errors.push(format!("${prop.name} must be a valid email address"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`!self.${field}.contains('@')`}>
              {`errors.push(format!("${prop.name} must be a valid email address"));`}
            </IfExpression>,
          );
        }
      }

      if (c.pattern !== undefined) {
        const escaped = c.pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        if (prop.optional) {
          checks.push(
            <IfExpression condition={`let Some(val) = &self.${field}`}>
              <IfExpression condition={`!regex::Regex::new("${escaped}").unwrap().is_match(val)`}>
                {`errors.push(format!("${prop.name} must match pattern ${escaped}"));`}
              </IfExpression>
            </IfExpression>,
          );
        } else {
          checks.push(
            <IfExpression condition={`!regex::Regex::new("${escaped}").unwrap().is_match(&self.${field})`}>
              {`errors.push(format!("${prop.name} must match pattern ${escaped}"));`}
            </IfExpression>,
          );
        }
      }

      return checks;
    }

    return (
      <ImplBlock type={key}>
        <FunctionDeclaration
          name="validate"
          pub
          receiver="&self"
          returnType="Result<(), Vec<String>>"
        >
          {`let mut errors: Vec<String> = Vec::new();`}
          <hbr />
          {constrainedProps.map((prop) => {
            const checks = emitChecks(prop);
            if (checks.length === 0) return <></>;
            return (
              <>
                {checks.map((check) => (
                  <>
                    {check}
                    <hbr />
                  </>
                ))}
              </>
            );
          })}
          {`if !errors.is_empty() {
    return Err(errors);
}`}
          <hbr />
          {"Ok(())"}
        </FunctionDeclaration>
      </ImplBlock>
    );
  }

  // Track regex crate if any property uses @pattern
  const needsRegex = tsp.models.some((m) =>
    m.properties.some((p) => p.constraints.pattern !== undefined),
  );
  if (needsRegex) {
    tsp.requiredCrates.add("regex");
  }

  // ── Cargo.toml builder ──────────────────────────────────────────────────────

  function buildCargoToml(
    name: string,
    edition: string,
    allDeps: Record<string, CargoDep>,
    requiredCrates: Set<string>,
  ): string {
    // Always-included crates
    const baseCrates = ["serde", "serde_json", "validator"];
    const depNames = [
      ...baseCrates,
      ...[...requiredCrates].filter((c) => !baseCrates.includes(c)).sort(),
    ];

    const depLines = depNames
      .filter((name) => name in allDeps)
      .map((name) => formatCargoDep(name, allDeps[name]));

    return [
      "[package]",
      `name = "${name}"`,
      `version = "0.1.0"`,
      `edition = "${edition}"`,
      "",
      "[dependencies]",
      ...depLines,
    ].join("\n");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const output = render(
    <Output
      namePolicy={createRustNamePolicy()}
      externals={[stdCrate, serdeCrate, validatorCrate]}
    >
      <CrateDirectory
        name={crateName}
        edition={edition}
        version="0.1.0"
        crateType="lib"
      >
        <SourceFile path="Cargo.toml">
          {buildCargoToml(crateName, edition, deps, tsp.requiredCrates)}
        </SourceFile>

        <SourceDirectory path="src">
          {/* ── models.rs ─────────────────────────────────────────── */}
          <SourceFile path="models.rs" pub>
            {`use serde::{Deserialize, Serialize};`}
            <hbr />
            {tsp.models.some(modelNeedsValidation) && (
              <>
                {`use validator::Validate;`}
                <hbr />
              </>
            )}
            <List doubleHardline>
              {tsp.newtypes.length > 0 && (
                <For each={tsp.newtypes}>
                  {(nt: TspNewtype) => <NewtypeStruct nt={nt} />}
                </For>
              )}

              <For each={tsp.models}>
                {(model: TspModel) => <ModelStruct model={model} />}
              </For>

              <For each={tsp.enums}>
                {(en: TspEnum) => <EnumType en={en} />}
              </For>

              <For each={tsp.unions}>
                {(union: TspUnion) => <UnionType union={union} />}
              </For>
            </List>
          </SourceFile>

          {/* ── validation.rs ─────────────────────────────────────── */}
          <SourceFile path="validation.rs" pub>
            <List doubleHardline>
              <For each={tsp.models.filter(modelNeedsValidation)}>
                {(model: TspModel) => <ValidationImpl model={model} />}
              </For>
            </List>
          </SourceFile>

          {/* ── lib.rs ────────────────────────────────────────────── */}
          <SourceFile path="lib.rs">
            {`pub use crate::models::*;`}
          </SourceFile>
        </SourceDirectory>
      </CrateDirectory>
    </Output>,
    { tabWidth: 4 },
  );

  await writeOutput(output, emitterOutputDir);
}
