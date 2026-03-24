import { Children, Scope, SourceDirectory } from "@alloy-js/core";
import { createRustModuleScope } from "../scopes/module.js";
import { CrateEditionContext, RustEdition } from "../scopes/contexts.js";

export interface CrateDirectoryProps {
  children?: Children;
  name: string;
  path?: string;
  edition?: RustEdition;
}

export function CrateDirectory(props: CrateDirectoryProps) {
  const moduleScope = createRustModuleScope(props.name);

  return (
    <SourceDirectory path={props.path ?? "."}>
      <CrateEditionContext.Provider value={props.edition ?? "2021"}>
        <Scope value={moduleScope}>{props.children}</Scope>
      </CrateEditionContext.Provider>
    </SourceDirectory>
  );
}
