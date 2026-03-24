import {
  Binder,
  createSymbol,
  LibrarySymbolReference,
  namekey,
  refkey,
  REFKEYABLE,
  TO_SYMBOL,
  useBinder,
} from "@alloy-js/core";
import { basename } from "pathe";
import { FunctionSymbol, RustSymbol, CrateSymbol } from "./index.js";
import { NamedTypeSymbol } from "./symbols/named-type.js";

export interface MemberDescriptor {
  kind: string;
  type?: LibrarySymbolReference | (() => LibrarySymbolReference);
}

export interface FieldDescriptor extends MemberDescriptor {
  kind: "field";
}

export interface FunctionDescriptor extends MemberDescriptor {
  kind: "function";
}

export interface MethodDescriptor extends MemberDescriptor {
  kind: "method";
}

export interface VariableDescriptor extends MemberDescriptor {
  kind: "var";
}

export interface NamedTypeDescriptor<M extends Record<string, Descriptor>> {
  kind: string;
  members: M;
}

export interface TypeDescriptor<M extends Record<string, Descriptor>>
  extends NamedTypeDescriptor<M> {
  kind: "type";
}

export interface CrateDescriptor<M extends Record<string, Descriptor>>
  extends NamedTypeDescriptor<M> {
  kind: "crate";
  path?: string;
  name?: string;
  members: M;
}

export interface StructDescriptor<M extends Record<string, Descriptor>>
  extends NamedTypeDescriptor<M> {
  kind: "struct";
}

export interface EnumDescriptor<M extends Record<string, Descriptor>>
  extends NamedTypeDescriptor<M> {
  kind: "enum";
}

export interface TraitDescriptor<M extends Record<string, Descriptor>>
  extends NamedTypeDescriptor<M> {
  kind: "trait";
}

export type Descriptor =
  | CrateDescriptor<any>
  | FieldDescriptor
  | FunctionDescriptor
  | MethodDescriptor
  | VariableDescriptor
  | StructDescriptor<any>
  | EnumDescriptor<any>
  | TraitDescriptor<any>
  | TypeDescriptor<any>;

export type StrictDescriptor =
  | CrateDescriptor<Record<string, StrictDescriptor>>
  | FieldDescriptor
  | FunctionDescriptor
  | MethodDescriptor
  | VariableDescriptor
  | StructDescriptor<Record<string, StrictDescriptor>>
  | EnumDescriptor<Record<string, StrictDescriptor>>
  | TraitDescriptor<Record<string, StrictDescriptor>>
  | TypeDescriptor<Record<string, StrictDescriptor>>;

export type ResolveDescriptor<D> =
  D extends NamedTypeDescriptor<infer M> ?
    LibrarySymbolReference & { [K in keyof M]: ResolveDescriptor<M[K]> }
  : LibrarySymbolReference;

export type LibraryFrom<T> = ResolveDescriptor<T> & LibrarySymbolReference;

interface InternalContext {
  ownerSymbol(binder: Binder | undefined): RustSymbol | null;
  builtin: boolean;
}

export function createModule<T extends CrateDescriptor<any>>(
  name: string,
  props: T,
  builtin: boolean = false,
): LibraryFrom<T> {
  return createSymbolEntry(name, props, {
    ownerSymbol(_binder: Binder | undefined) {
      return null;
    },
    builtin,
  }) as LibraryFrom<T>;
}

function createSymbolEntry(
  name: string,
  descriptor: Descriptor,
  context: InternalContext,
): LibrarySymbolReference {
  const symbols = new WeakMap<Binder, RustSymbol>();

  function getSymbol(binder: Binder | undefined) {
    return mapGet(symbols, binder, () =>
      createSymbolFromDescriptor(
        name,
        binder,
        descriptor,
        context,
        initializeMembers,
      ),
    );
  }

  const newContext: InternalContext = {
    ownerSymbol(binder) {
      return getSymbol(binder) as NamedTypeSymbol;
    },
    builtin: context.builtin,
  };

  function initializeMembers() {
    for (const key of Object.keys(obj)) {
      if (typeof key === "symbol") continue;
      (obj as any)[key][TO_SYMBOL]();
    }
  }

  const obj: LibrarySymbolReference & Record<string, unknown> = {
    [REFKEYABLE]() {
      return getSymbol(useBinder()).refkeys[0];
    },
    [TO_SYMBOL]() {
      return getSymbol(useBinder());
    },
  };

  switch (descriptor.kind) {
    case "crate":
    case "struct":
    case "enum":
    case "trait":
      for (const [memberName, memberDesc] of Object.entries(
        descriptor.members,
      ) as any) {
        obj[memberName] = createSymbolEntry(memberName, memberDesc, newContext);
      }
      break;
  }

  return obj;
}

function createSymbolFromDescriptor(
  name: string,
  binder: Binder | undefined,
  descriptor: Descriptor,
  context: InternalContext,
  lazyMemberInitializer: () => void,
): RustSymbol {
  const ownerSymbol = context.ownerSymbol(binder) as RustSymbol;

  if (ownerSymbol === null && descriptor.kind !== "crate") {
    throw new Error(
      `Cannot create a non-crate symbol (${name}) without an owner symbol.`,
    );
  }

  switch (descriptor.kind) {
    case "crate":
      if (ownerSymbol === null) {
        const dname = basename(name);
        const crateName = (descriptor as CrateDescriptor<any>).name ?? dname;
        return createSymbol(CrateSymbol, crateName, undefined, {
          binder,
          refkeys: refkey(),
          lazyMemberInitializer,
          path: (descriptor as CrateDescriptor<any>).path,
          builtin: context.builtin,
        });
      }
      if (!(ownerSymbol instanceof CrateSymbol)) {
        throw new Error(
          `Cannot create a crate symbol (${name}) with a non-crate owner symbol (${ownerSymbol.name}).`,
        );
      }
      if (ownerSymbol.members.symbolNames.has(name)) {
        return ownerSymbol.members.symbolNames.get(name)! as CrateSymbol;
      }
      return createSymbol(CrateSymbol, name, ownerSymbol as CrateSymbol, {
        binder,
        refkeys: refkey(),
        lazyMemberInitializer,
        path: (descriptor as CrateDescriptor<any>).path,
        builtin: context.builtin,
      });
    case "struct":
    case "enum":
    case "trait":
    case "type":
      if (!(ownerSymbol instanceof CrateSymbol)) {
        throw new Error(
          `Cannot create a named type symbol (${name}) with a non-crate owner symbol (${ownerSymbol.name}).`,
        );
      }
      return createSymbol(
        NamedTypeSymbol,
        namekey(name),
        ownerSymbol.members,
        descriptor.kind,
        {
          binder,
          refkeys: refkey(),
          lazyMemberInitializer,
        },
      );
    case "function":
      if (!(ownerSymbol instanceof CrateSymbol)) {
        throw new Error(
          `Cannot create a function symbol (${name}) with a non-crate owner symbol (${ownerSymbol.name}).`,
        );
      }
      return createSymbol(FunctionSymbol, namekey(name), ownerSymbol.members, {
        binder,
        refkeys: refkey(),
      });
    case "field":
      if (!(ownerSymbol instanceof NamedTypeSymbol)) {
        throw new Error(
          `Cannot create a field symbol (${name}) with a non-named-type owner symbol (${ownerSymbol.name}).`,
        );
      }
      return createSymbol(
        NamedTypeSymbol,
        namekey(name),
        ownerSymbol.members,
        "struct-field",
        {
          binder,
          refkeys: refkey(),
          type:
            descriptor.type === undefined ? undefined
            : typeof descriptor.type === "function" ?
              descriptor.type()[TO_SYMBOL]()
            : descriptor.type[TO_SYMBOL](),
          lazyMemberInitializer,
        },
      );
    case "var":
      if (!(ownerSymbol instanceof CrateSymbol)) {
        throw new Error(
          `Cannot create a variable symbol (${name}) with a non-crate owner symbol (${ownerSymbol.name}).`,
        );
      }
      return createSymbol(RustSymbol, namekey(name), ownerSymbol.members, {
        binder,
        refkeys: refkey(),
        type:
          descriptor.type === undefined ? undefined
          : typeof descriptor.type === "function" ?
            descriptor.type()[TO_SYMBOL]()
          : descriptor.type[TO_SYMBOL](),
      });
    default:
      throw "Unsupported";
  }
}

const defaultsPerMap = new WeakMap<object, unknown>();

function mapGet<T extends WeakKey, V>(
  map: WeakMap<T, V>,
  key: T | undefined,
): V | undefined;
function mapGet<T extends WeakKey, V>(
  map: WeakMap<T, V>,
  key: T | undefined,
  init: () => V,
): V;
function mapGet<T extends WeakKey, V>(
  map: WeakMap<T, V>,
  key: T | undefined,
  init?: () => V,
): V | undefined {
  if (key === undefined) {
    let value = defaultsPerMap.get(map as unknown as object) as V | undefined;
    if (value === undefined && init) {
      value = init();
      defaultsPerMap.set(map as unknown as object, value);
    }
    return value;
  }

  let value = map.get(key);
  if (value === undefined && init) {
    value = init();
    map.set(key, value);
  }
  return value;
}
