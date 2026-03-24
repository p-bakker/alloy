import {
  createSymbol,
  Namekey,
  OutputSpace,
  track,
  TrackOpTypes,
  trigger,
  TriggerOpTypes,
} from "@alloy-js/core";
import { RustSymbol, RustSymbolOptions } from "./rust.js";

export type NamedTypeTypeKind =
  | "struct"
  | "enum"
  | "trait"
  | "type"
  | "struct-field"
  | "enum-variant"
  | "crate"
  | "module";

export type NamedTypeSymbolKind = "named-type" | "crate";

export interface NamedTypeSymbolOptions extends RustSymbolOptions {
  typeParameters?: RustSymbol[];
}

/**
 * A symbol for a named type in Rust such as a struct, enum, trait, and so forth.
 */
export class NamedTypeSymbol extends RustSymbol {
  public readonly symbolKind: NamedTypeSymbolKind = "named-type";
  public static readonly memberSpaces = ["members", "typeParameters"];

  constructor(
    name: string | Namekey,
    spaces: OutputSpace[] | OutputSpace | undefined,
    kind: NamedTypeTypeKind,
    options?: NamedTypeSymbolOptions,
  ) {
    super(name, spaces, options);
    this.#typeKind = kind;
  }

  #typeKind: NamedTypeTypeKind;
  get typeKind() {
    track(this, TrackOpTypes.GET, "typeKind");
    return this.#typeKind;
  }
  set typeKind(value: NamedTypeTypeKind) {
    const old = this.#typeKind;
    if (old === value) {
      return;
    }
    this.#typeKind = value;
    trigger(this, TriggerOpTypes.SET, "typeKind", value, old);
  }

  get typeParameters() {
    return this.memberSpaceFor("typeParameters")!;
  }

  copy() {
    const options = this.getRustCopyOptions();
    const copy = createSymbol(
      NamedTypeSymbol,
      this.name,
      undefined,
      this.#typeKind,
      options,
    );
    this.initializeRustCopy(copy);
    return copy;
  }

  get members() {
    return this.memberSpaceFor("members")!;
  }
}
