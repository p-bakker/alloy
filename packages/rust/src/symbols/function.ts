import {
  Namekey,
  OutputSpace,
  track,
  TrackOpTypes,
  trigger,
  TriggerOpTypes,
} from "@alloy-js/core";
import { RustSymbol, RustSymbolOptions } from "./rust.js";
import { NamedTypeSymbol } from "./named-type.js";

/**
 * A symbol for a function in Rust.
 */
export class FunctionSymbol extends RustSymbol {
  public readonly symbolKind = "function";

  constructor(
    name: string | Namekey,
    spaces: OutputSpace | undefined,
    options: RustSymbolOptions = {},
  ) {
    super(name, spaces, options);
  }

  #implSymbol?: NamedTypeSymbol = undefined;

  get implSymbol(): NamedTypeSymbol | undefined {
    track(this, TrackOpTypes.GET, "implSymbol");
    return this.#implSymbol;
  }

  set implSymbol(value: NamedTypeSymbol | undefined) {
    if (this.#implSymbol === value) {
      return;
    }
    trigger(
      this,
      TriggerOpTypes.SET,
      "implSymbol",
      value,
      this.#implSymbol,
    );
    this.#implSymbol = value;
  }
}
