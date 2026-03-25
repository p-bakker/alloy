import { Children, Scope, SourceDirectory } from "@alloy-js/core";
import { createRustModuleScope } from "../scopes/module.js";
import {
  CrateEditionContext,
  CrateIdentityContext,
  DEFAULT_EDITION,
  type RustEdition,
} from "../scopes/contexts.js";

export interface CrateDirectoryProps {
  children?: Children;
  name: string;
  path?: string;
  edition?: RustEdition;
}

export function CrateDirectory(props: CrateDirectoryProps) {
  const moduleScope = createRustModuleScope(props.name);
  const edition = props.edition ?? DEFAULT_EDITION;

  return (
    <SourceDirectory path={props.path ?? "."}>
      <CrateIdentityContext.Provider value={{ name: props.name, edition }}>
        <CrateEditionContext.Provider value={edition}>
          <Scope value={moduleScope}>{props.children}</Scope>
        </CrateEditionContext.Provider>
      </CrateIdentityContext.Provider>
    </SourceDirectory>
  );
}
