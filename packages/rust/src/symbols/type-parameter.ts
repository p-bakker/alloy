import { Children, Namekey, OutputSpace } from "@alloy-js/core";
import { RustSymbol, RustSymbolOptions } from "./rust.js";

export interface TypeParameterSymbolOptions extends RustSymbolOptions {
  constraint?: Children;
}

/**
 * A symbol for type parameters in Rust.
 */
export class TypeParameterSymbol extends RustSymbol {
  public readonly symbolKind = "type-parameter";

  constructor(
    name: string | Namekey,
    spaces: OutputSpace | undefined,
    options: TypeParameterSymbolOptions = {},
  ) {
    super(name, spaces, options);
    this.#constraint = options.constraint;
  }

  #constraint: Children | undefined;
  get constraint(): Children | undefined {
    return this.#constraint;
  }
}
