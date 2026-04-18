import {
  SourceFile as CoreSourceFile,
  createScope,
  Scope,
  Show,
  useScope,
  type Children,
} from "@alloy-js/core";
import {
  useRustFormatOptions,
  type RustFormatOptions,
} from "../context/format-options.js";
import { RustCrateScope } from "../scopes/rust-crate-scope.js";
import { RustModuleScope } from "../scopes/rust-module-scope.js";
import { InnerDocComment } from "./doc-comment.js";
import { ModDeclarations } from "./mod-declarations.js";
import { Reference } from "./reference.js";
import { UseStatements } from "./use-statement.js";
import { type RustVisibilityProps } from "./visibility.js";

export interface SourceFileProps
  extends RustVisibilityProps,
    RustFormatOptions {
  path: string;
  attributes?: Children[];
  children?: Children;
  /** Attributes/directives placed above `use` imports (e.g. `#![allow(...)]`). */
  header?: Children;
  /**
   * A module-level comment. Plain strings are wrapped in `InnerDocComment`
   * (`//!`) automatically since that's the Rust convention. Pass one of the
   * explicit doc/comment components (e.g. `BlockComment`) for other styles.
   */
  headerComment?: Children;
}

function isModuleRootPath(path: string): boolean {
  const fileName = path.split("/").pop() ?? path;
  return (
    fileName === "lib.rs" || fileName === "main.rs" || fileName === "mod.rs"
  );
}

function getDeclarationScope(
  path: string,
  parent: RustCrateScope | RustModuleScope | undefined,
  scope: RustModuleScope,
) {
  if (!isModuleRootPath(path)) {
    return undefined;
  }

  if (path.endsWith("mod.rs") && parent instanceof RustModuleScope) {
    return parent;
  }

  if (
    (path.endsWith("lib.rs") || path.endsWith("main.rs")) &&
    parent instanceof RustCrateScope
  ) {
    return parent;
  }

  return scope;
}

function getStandaloneModuleName(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  const fileName = segments[segments.length - 1] ?? path;
  return fileName.endsWith(".rs") ? fileName.slice(0, -".rs".length) : fileName;
}

function isStandaloneModulePath(path: string): boolean {
  return path.endsWith(".rs") && !isModuleRootPath(path);
}

export function SourceFile(props: SourceFileProps) {
  const parentScope = useScope();
  const scopeParent =
    (
      parentScope instanceof RustCrateScope ||
      parentScope instanceof RustModuleScope
    ) ?
      parentScope
    : undefined;
  if (scopeParent && isStandaloneModulePath(props.path)) {
    scopeParent.addChildModule({
      name: getStandaloneModuleName(props.path),
      pub: props.pub,
      attributes: props.attributes,
    });
  }
  const scope = createScope(RustModuleScope, props.path, scopeParent, {
    binder: scopeParent?.binder,
  });
  const declarationScope = getDeclarationScope(props.path, scopeParent, scope);

  const opts = useRustFormatOptions({
    printWidth: props.printWidth,
    tabWidth: props.tabWidth,
    useTabs: props.useTabs,
  });

  // Plain-string headerComment is the common "module-level docs" case, so
  // wrap it in InnerDocComment automatically. For other shapes (attributes,
  // block comments, etc.), pass a JSX element and it'll be used as-is.
  const headerComment =
    typeof props.headerComment === "string" ?
      <InnerDocComment>{props.headerComment}</InnerDocComment>
    : props.headerComment;

  const header =
    headerComment !== undefined || props.header !== undefined ?
      <>
        {headerComment}
        {props.header}
      </>
    : undefined;

  return (
    <CoreSourceFile
      path={props.path}
      filetype="rust"
      reference={Reference}
      {...opts}
      header={header}
    >
      <Scope value={scope}>
        {declarationScope ?
          <ModDeclarations scope={declarationScope} />
        : null}
        {(
          declarationScope &&
          declarationScope.childModules.size > 0 &&
          (scope.imports.size > 0 || props.children !== undefined)
        ) ?
          <hbr />
        : null}
        <UseStatements />
        <Show when={scope.imports.size > 0}>
          <hbr />
        </Show>
        {props.children}
      </Scope>
    </CoreSourceFile>
  );
}
