import {
  Scope,
  SourceDirectory,
  createScope,
  getSymbolCreator,
  isComponentCreator,
  useBinder,
  type Children,
} from "@alloy-js/core";
import { alloc } from "../builtins/alloc/index.js";
import { core } from "../builtins/core/index.js";
import { std } from "../builtins/std/index.js";
import { CrateContext, CrateContextValue } from "../context/crate-context.js";
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
  sourcePath?: string;
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
  const sourcePath = props.sourcePath ?? "src";
  const context: CrateContextValue = {
    scope,
    name: props.name,
    version: props.version,
    edition: props.edition ?? "2021",
    crateType: props.crateType ?? "lib",
    sourcePath,
  };

  const { rootChildren, sourceChildren } = partitionChildren(props.children);

  return (
    <SourceDirectory path=".">
      <Scope value={scope}>
        <CrateContext.Provider value={context}>
          {props.includeCargoToml ?
            <CargoTomlFile
              name={props.name}
              version={props.version}
              edition={props.edition}
              dependencies={props.dependencies}
            />
          : null}
          {rootChildren}
          <SourceDirectory path={sourcePath}>
            {sourceChildren}
          </SourceDirectory>
        </CrateContext.Provider>
      </Scope>
    </SourceDirectory>
  );
}

function partitionChildren(children: Children | undefined): {
  rootChildren: Children[];
  sourceChildren: Children[];
} {
  const rootChildren: Children[] = [];
  const sourceChildren: Children[] = [];

  if (children === undefined || children === null) {
    return { rootChildren, sourceChildren };
  }

  const items = Array.isArray(children) ? children : [children];
  for (const child of items) {
    if (isComponentCreator(child, CargoTomlFile)) {
      rootChildren.push(child);
    } else {
      sourceChildren.push(child);
    }
  }

  return { rootChildren, sourceChildren };
}
