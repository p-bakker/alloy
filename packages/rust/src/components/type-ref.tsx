import {
  REFKEYABLE,
  refkey,
  type Children,
  type Refkey,
  type RefkeyableObject,
} from "@alloy-js/core";

import { Reference } from "./reference.js";

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
 * A callable ref for a user-declared named type. Used as a JSX component
 * (`<MyType>T</MyType>` → `MyType<T>`) or as a bare refkey (`{MyType}` or
 * `refkey={MyType}` on a declaration). Equivalent to the callable refs
 * produced by `createCrate` for builtins.
 */
export type UserTypeRef = TypeComponent & RefkeyableObject;

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
 * The Proxy lets the callable expose `REFKEYABLE` (so `{MyType}` works)
 * without the reserved-name collisions that direct property assignment
 * on a function hits in strict mode.
 */
export function createTypeRef(): UserTypeRef {
  const typeRefkey = refkey();
  const base = createTypeComponent(typeRefkey);
  return new Proxy(base, {
    get(fn, key) {
      if (key === REFKEYABLE) return () => typeRefkey;
      return Reflect.get(fn, key);
    },
    has(fn, key) {
      if (key === REFKEYABLE) return true;
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
      return Reflect.getOwnPropertyDescriptor(fn, key);
    },
    ownKeys(fn) {
      return [...Reflect.ownKeys(fn), REFKEYABLE];
    },
  }) as UserTypeRef;
}
