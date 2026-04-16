import {
  Scope,
  SourceDirectory,
  createScope,
  getSymbolCreator,
  useBinder,
  type Children,
} from "@alloy-js/core";

import { alloc } from "../builtins/alloc/index.js";
import { core } from "../builtins/core/index.js";
import { std } from "../builtins/std/index.js";
import type { CrateContextValue } from "../context/crate-context.js";
import { CrateContext } from "../context/crate-context.js";
import {
  RustCrateScope,
  type CrateDependency,
} from "../scopes/rust-crate-scope.js";
import { CargoTomlFile } from "./cargo-toml-file.js";

export interface CrateDirectoryProps {
  name: string;
  version?: string;
  edition?: string;
  crateType?: "lib" | "bin";
  noStd?: boolean;
  dependencies?: Record<string, CrateDependency>;
  includeCargoToml?: boolean;
  children?: Children;
}

export function CrateDirectory(props: CrateDirectoryProps) {
  const binder = useBinder()!;
  if (!props.noStd) {
    getSymbolCreator(std)(binder);
  }
  getSymbolCreator(alloc)(binder);
  getSymbolCreator(core)(binder);

  const scope = createScope(RustCrateScope, props.name, props.version);
  const context: CrateContextValue = {
    scope,
    name: props.name,
    version: props.version,
    edition: props.edition ?? "2021",
    crateType: props.crateType ?? "lib",
  };

  return (
    <SourceDirectory path=".">
      <Scope value={scope}>
        <CrateContext.Provider value={context}>
          {props.children}
          {props.includeCargoToml ? (
            <CargoTomlFile
              name={props.name}
              version={props.version}
              edition={props.edition}
              dependencies={props.dependencies}
            />
          ) : null}
        </CrateContext.Provider>
      </Scope>
    </SourceDirectory>
  );
}
