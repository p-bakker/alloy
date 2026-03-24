import {
  SourceFile as CoreSourceFile,
  type Children,
} from "@alloy-js/core";

export interface CargoTomlDependencySpec {
  version?: string;
  features?: string[];
  optional?: boolean;
  defaultFeatures?: boolean;
  workspace?: boolean;
  path?: string;
}

export interface CargoTomlBinTarget {
  name: string;
  path: string;
}

export interface CargoTomlLibTarget {
  name?: string;
  path?: string;
  crateType?: string[];
}

export interface CargoTomlProps {
  name: string;
  version?: string;
  edition?: string;
  authors?: string[];
  description?: string;
  license?: string;
  dependencies?: Record<string, string | CargoTomlDependencySpec>;
  devDependencies?: Record<string, string | CargoTomlDependencySpec>;
  buildDependencies?: Record<string, string | CargoTomlDependencySpec>;
  features?: Record<string, string[]>;
  bin?: CargoTomlBinTarget[];
  lib?: CargoTomlLibTarget;
  children?: Children;
}

// --- Simple inline TOML serializer ---

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function tomlArray(values: string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

function tomlValue(value: string | number | boolean | string[]): string {
  if (typeof value === "string") return tomlString(value);
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return tomlArray(value);
  return tomlString(String(value));
}

function renderKeyValue(key: string, value: string | number | boolean | string[]): string {
  return `${key} = ${tomlValue(value)}`;
}

function renderDependencyValue(spec: string | CargoTomlDependencySpec): string {
  if (typeof spec === "string") {
    return tomlString(spec);
  }
  const parts: string[] = [];
  if (spec.version) {
    parts.push(`version = ${tomlString(spec.version)}`);
  }
  if (spec.workspace) {
    parts.push(`workspace = true`);
  }
  if (spec.path) {
    parts.push(`path = ${tomlString(spec.path)}`);
  }
  if (spec.defaultFeatures === false) {
    parts.push(`default-features = false`);
  }
  if (spec.features && spec.features.length > 0) {
    parts.push(`features = ${tomlArray(spec.features)}`);
  }
  if (spec.optional) {
    parts.push(`optional = true`);
  }
  return `{ ${parts.join(", ")} }`;
}

function renderDependenciesSection(
  header: string,
  deps: Record<string, string | CargoTomlDependencySpec>,
): string {
  const lines: string[] = [];
  lines.push(`[${header}]`);
  for (const [name, spec] of Object.entries(deps)) {
    lines.push(`${name} = ${renderDependencyValue(spec)}`);
  }
  return lines.join("\n");
}

function renderFeaturesSection(features: Record<string, string[]>): string {
  const lines: string[] = [];
  lines.push("[features]");
  for (const [name, deps] of Object.entries(features)) {
    lines.push(`${name} = ${tomlArray(deps)}`);
  }
  return lines.join("\n");
}

function renderBinSection(bins: CargoTomlBinTarget[]): string {
  return bins
    .map(
      (bin) =>
        `[[bin]]\n${renderKeyValue("name", bin.name)}\n${renderKeyValue("path", bin.path)}`,
    )
    .join("\n\n");
}

function renderLibSection(lib: CargoTomlLibTarget): string {
  const lines: string[] = [];
  lines.push("[lib]");
  if (lib.name) lines.push(renderKeyValue("name", lib.name));
  if (lib.path) lines.push(renderKeyValue("path", lib.path));
  if (lib.crateType && lib.crateType.length > 0) {
    lines.push(`crate-type = ${tomlArray(lib.crateType)}`);
  }
  return lines.join("\n");
}

function serializeCargoToml(props: CargoTomlProps): string {
  const sections: string[] = [];

  // [package] section
  const packageLines: string[] = [];
  packageLines.push("[package]");
  packageLines.push(renderKeyValue("name", props.name));
  packageLines.push(renderKeyValue("version", props.version ?? "0.1.0"));
  packageLines.push(renderKeyValue("edition", props.edition ?? "2021"));
  if (props.authors && props.authors.length > 0) {
    packageLines.push(`authors = ${tomlArray(props.authors)}`);
  }
  if (props.description) {
    packageLines.push(renderKeyValue("description", props.description));
  }
  if (props.license) {
    packageLines.push(renderKeyValue("license", props.license));
  }
  sections.push(packageLines.join("\n"));

  // [lib]
  if (props.lib) {
    sections.push(renderLibSection(props.lib));
  }

  // [[bin]]
  if (props.bin && props.bin.length > 0) {
    sections.push(renderBinSection(props.bin));
  }

  // [dependencies]
  if (props.dependencies && Object.keys(props.dependencies).length > 0) {
    sections.push(renderDependenciesSection("dependencies", props.dependencies));
  }

  // [dev-dependencies]
  if (props.devDependencies && Object.keys(props.devDependencies).length > 0) {
    sections.push(
      renderDependenciesSection("dev-dependencies", props.devDependencies),
    );
  }

  // [build-dependencies]
  if (props.buildDependencies && Object.keys(props.buildDependencies).length > 0) {
    sections.push(
      renderDependenciesSection("build-dependencies", props.buildDependencies),
    );
  }

  // [features]
  if (props.features && Object.keys(props.features).length > 0) {
    sections.push(renderFeaturesSection(props.features));
  }

  return sections.join("\n\n");
}

export function CargoToml(props: CargoTomlProps) {
  const tomlContent = serializeCargoToml(props);

  return (
    <CoreSourceFile path="Cargo.toml" filetype="toml">
      {tomlContent}
      {props.children}
    </CoreSourceFile>
  );
}
