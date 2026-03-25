import { createModule, type CrateDescriptor, type LibraryFrom } from "./create-module.js";
import type { CrateCargoMetadata } from "./symbols/crate.js";

export interface CreateCrateProps<T extends CrateDescriptor<any>> {
  /** Crate name as it appears in Cargo.toml (e.g., "serde", "tokio") */
  name: string;
  /** Version specifier (e.g., "1.0", "0.12") */
  version: string;
  /** Cargo features to enable (e.g., ["derive"]) */
  features?: string[];
  /** Set to false to disable default features */
  defaultFeatures?: boolean;
  /** Whether this is an optional dependency */
  optional?: boolean;
  /** Exported symbols descriptor */
  descriptor: T;
}

// Global registry mapping crate names to their cargo metadata.
// Populated by createCrate, read by CargoToml during rendering.
const crateMetadataRegistry = new Map<string, CrateCargoMetadata>();

export function getCrateMetadata(crateName: string): CrateCargoMetadata | undefined {
  return crateMetadataRegistry.get(crateName);
}

export function getAllCrateMetadata(): ReadonlyMap<string, CrateCargoMetadata> {
  return crateMetadataRegistry;
}

export function createCrate<T extends CrateDescriptor<any>>(
  props: CreateCrateProps<T>,
): LibraryFrom<T> {
  const metadata: CrateCargoMetadata = {
    version: props.version,
    features: props.features,
    defaultFeatures: props.defaultFeatures,
    optional: props.optional,
  };

  // Register cargo metadata globally so CargoToml can find it
  crateMetadataRegistry.set(props.name, metadata);

  // Delegate to createModule for symbol creation
  return createModule(props.name, props.descriptor, false);
}
