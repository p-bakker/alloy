import {
  SourceFile as CoreSourceFile,
  SourceDirectory as CoreSourceDirectory,
  type Children,
} from "@alloy-js/core";
import { CargoTomlDependencySpec } from "./cargo-toml.js";

export type CargoDep = string | CargoTomlDependencySpec;

export interface CargoWorkspaceProps {
  name?: string;
  resolver?: "1" | "2";
  members?: string[];
  sharedDependencies?: Record<string, CargoDep>;
  children?: Children;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function tomlArray(values: string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

function renderWorkspaceDependencyValue(spec: CargoDep): string {
  if (typeof spec === "string") {
    return `{ version = ${tomlString(spec)} }`;
  }
  const parts: string[] = [];
  if (spec.version) {
    parts.push(`version = ${tomlString(spec.version)}`);
  }
  if (spec.path) {
    parts.push(`path = ${tomlString(spec.path)}`);
  }
  if (spec.features && spec.features.length > 0) {
    parts.push(`features = [${spec.features.map(tomlString).join(", ")}]`);
  }
  if (spec.optional) {
    parts.push(`optional = true`);
  }
  return `{ ${parts.join(", ")} }`;
}

function serializeWorkspaceToml(props: CargoWorkspaceProps): string {
  const sections: string[] = [];

  // [workspace] section
  const workspaceLines: string[] = [];
  workspaceLines.push("[workspace]");
  workspaceLines.push(`resolver = ${tomlString(props.resolver ?? "2")}`);

  if (props.members && props.members.length > 0) {
    workspaceLines.push(`members = ${tomlArray(props.members)}`);
  }

  sections.push(workspaceLines.join("\n"));

  // [workspace.dependencies] section
  if (props.sharedDependencies && Object.keys(props.sharedDependencies).length > 0) {
    const depLines: string[] = [];
    depLines.push("[workspace.dependencies]");
    for (const [name, spec] of Object.entries(props.sharedDependencies)) {
      depLines.push(`${name} = ${renderWorkspaceDependencyValue(spec)}`);
    }
    sections.push(depLines.join("\n"));
  }

  return sections.join("\n\n");
}

/**
 * A Cargo workspace root that generates a Cargo.toml with [workspace] configuration.
 */
export function CargoWorkspace(props: CargoWorkspaceProps) {
  const tomlContent = serializeWorkspaceToml(props);

  return (
    <CoreSourceDirectory path={props.name ?? "."}>
      <CoreSourceFile path="Cargo.toml" filetype="toml">
        {tomlContent}
      </CoreSourceFile>
      {props.children}
    </CoreSourceDirectory>
  );
}
