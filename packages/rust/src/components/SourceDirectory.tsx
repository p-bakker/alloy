import {
  SourceDirectory as CoreSourceDirectory,
  SourceDirectoryProps as CoreSourceDirectoryProps,
  Scope,
  SourceDirectoryContext,
  useContext,
} from "@alloy-js/core";
import { basename, join } from "pathe";
import { useModule } from "../scopes/module.js";
import { createRustCrateScope } from "../scopes/crate.js";
import { createCrateSymbol } from "../symbols/factories.js";
import { useSourceFileScope } from "../scopes/source-file.js";
import { RustVisibility } from "../symbols/rust.js";

export interface SourceDirectoryProps extends CoreSourceDirectoryProps {
  name?: string;
  visibility?: RustVisibility;
}

export function SourceDirectory(props: SourceDirectoryProps) {
  const mod = useModule();
  const directoryContext = useContext(SourceDirectoryContext)!;
  const currentDir = join(directoryContext.path, props.path);
  const dname = basename(currentDir);
  const modName = mod ? basename(mod.name) : "main";
  const crateName = props.name ?? (dname === "." ? modName : dname);
  const crateSymbol = createCrateSymbol(crateName, props.path);
  const crateScope = createRustCrateScope(crateSymbol);

  // Auto-register this directory as a child module in the parent source file.
  const parentSourceFile = useSourceFileScope();
  if (parentSourceFile) {
    parentSourceFile.addModule(crateName, props.visibility);
  }

  return (
    <CoreSourceDirectory path={props.path}>
      <Scope value={crateScope}>{props.children}</Scope>;
    </CoreSourceDirectory>
  );
}
