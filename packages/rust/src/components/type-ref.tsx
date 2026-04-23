import {
  REFKEYABLE,
  refkey,
  type Children,
  type Refkey,
  type RefkeyableObject,
} from "@alloy-js/core";

import { Reference } from "./reference.js";
import {
  createVariantComponent,
  type VariantComponent,
  type VariantShape,
} from "./variant.js";

export interface TypeRefProps {
  typeRefkey: Refkey;
  children?: Children;
}

/**
 * Renders a reference to a named type with optional generic type arguments:
 * `<TypeRef refkey={X} />` → `X`, `<TypeRef refkey={X}>T, U</TypeRef>` → `X<T, U>`.
 */
export function TypeRef(props: TypeRefProps) {
  const ref = <Reference refkey={props.typeRefkey} />;
  if (props.children === undefined) {
    return ref;
  }
  return (
    <>
      {ref}
      {"<"}
      {props.children}
      {">"}
    </>
  );
}

export type TypeComponent = (props: { children?: Children }) => Children;

export function createTypeComponent(typeRefkey: Refkey): TypeComponent {
  return (props) => (
    <TypeRef typeRefkey={typeRefkey} children={props.children} />
  );
}

/**
 * A callable variant accessible as a member on a user-declared enum type
 * ref. Used either as a `refkey` prop on `<EnumVariant>` or as a JSX
 * component (`<MyEnum.Foo>x</MyEnum.Foo>`).
 */
export type UserVariantRef = VariantComponent & RefkeyableObject;

/**
 * A callable ref for a user-declared named type. Used as a JSX component
 * (`<MyType>T</MyType>` → `MyType<T>`) or as a bare refkey (`{MyType}` or
 * `refkey={MyType}` on a declaration). Equivalent to the callable refs
 * produced by `createCrate` for builtins.
 *
 * The optional `V` type parameter names the enum's variants so that
 * `MyEnum.Foo` / `MyEnum.Bar` are accessible on the ref.
 */
export type UserTypeRef<V extends Record<string, VariantShape> = {}> =
  TypeComponent & RefkeyableObject & { [K in keyof V]: UserVariantRef };

export interface CreateTypeRefOptions<V extends Record<string, VariantShape>> {
  /**
   * For enum types: a map of variant name → shape. Each variant is
   * exposed as a callable member on the returned ref, carrying its own
   * refkey. Pass `MyEnum.VariantName` to the corresponding
   * `<EnumVariant refkey=…>` at declaration time.
   */
  variants?: V;
}

/**
 * Create a callable type ref for a user-declared named type (struct / enum
 * / trait / type-alias). The returned value can be:
 *
 *   1. Passed as the `refkey` prop of a `<StructDeclaration>` /
 *      `<EnumDeclaration>` / `<TraitDeclaration>` / `<TypeAlias>`.
 *   2. Used as a JSX component: `<MyType>T, U</MyType>` renders `MyType<T, U>`.
 *   3. Interpolated bare: `{MyType}` renders just `MyType`.
 *
 * ```ts
 * const Entry = createTypeRef();
 * <StructDeclaration name="Entry" refkey={Entry} …>…</StructDeclaration>
 * // later
 * <Field type={<Entry>V</Entry>} />
 * ```
 *
 * For enum types, pass a `variants` map to expose each variant as a
 * callable member:
 *
 * ```ts
 * const StoreError = createTypeRef({
 *   variants: { NotFound: "unit", LockError: "tuple" },
 * });
 * <EnumDeclaration name="StoreError" refkey={StoreError}>
 *   <EnumVariant name="NotFound" refkey={StoreError.NotFound} />
 *   <EnumVariant name="LockError" refkey={StoreError.LockError} kind="tuple"
 *                fields={["String"]} />
 * </EnumDeclaration>
 * // later
 * <ReturnExpression><Err><StoreError.NotFound /></Err></ReturnExpression>
 * ```
 *
 * The Proxy lets the callable expose `REFKEYABLE` (so `{MyType}` works)
 * without the reserved-name collisions that direct property assignment
 * on a function hits in strict mode.
 */
export function createTypeRef<
  const V extends Record<string, VariantShape> = {},
>(options?: CreateTypeRefOptions<V>): UserTypeRef<V> {
  const typeRefkey = refkey();
  const base = createTypeComponent(typeRefkey);
  const variantMembers: Record<string, UserVariantRef> = {};
  if (options?.variants) {
    for (const [variantName, shape] of Object.entries(options.variants)) {
      variantMembers[variantName] = makeVariantRef(variantName, shape);
    }
  }
  return new Proxy(base, {
    get(fn, key) {
      if (key === REFKEYABLE) return () => typeRefkey;
      if (typeof key === "string" && key in variantMembers) {
        return variantMembers[key];
      }
      return Reflect.get(fn, key);
    },
    has(fn, key) {
      if (key === REFKEYABLE) return true;
      if (typeof key === "string" && key in variantMembers) return true;
      return Reflect.has(fn, key);
    },
    getOwnPropertyDescriptor(fn, key) {
      if (key === REFKEYABLE) {
        return {
          value: () => typeRefkey,
          writable: false,
          enumerable: false,
          configurable: true,
        };
      }
      if (typeof key === "string" && key in variantMembers) {
        return {
          value: variantMembers[key],
          writable: false,
          enumerable: true,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(fn, key);
    },
    ownKeys(fn) {
      return [
        ...Reflect.ownKeys(fn),
        ...Object.keys(variantMembers),
        REFKEYABLE,
      ];
    },
  }) as UserTypeRef<V>;
}

function makeVariantRef(
  variantName: string,
  shape: VariantShape,
): UserVariantRef {
  const variantRefkey = refkey();
  const base = createVariantComponent(variantRefkey, shape);
  return new Proxy(base, {
    get(fn, key) {
      if (key === REFKEYABLE) return () => variantRefkey;
      return Reflect.get(fn, key);
    },
    has(fn, key) {
      if (key === REFKEYABLE) return true;
      return Reflect.has(fn, key);
    },
    getOwnPropertyDescriptor(fn, key) {
      if (key === REFKEYABLE) {
        return {
          value: () => variantRefkey,
          writable: false,
          enumerable: false,
          configurable: true,
        };
      }
      return Reflect.getOwnPropertyDescriptor(fn, key);
    },
    ownKeys(fn) {
      return [...Reflect.ownKeys(fn), REFKEYABLE];
    },
  }) as UserVariantRef;
}
