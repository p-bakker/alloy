import { type OutputSpace } from "@alloy-js/core";
import { RustScope } from "./rust.js";

export class RustLexicalScope extends RustScope {
  public static readonly declarationSpaces = ["values", "types"];

  get values(): OutputSpace {
    return this.spaceFor("values")!;
  }

  get types(): OutputSpace {
    return this.spaceFor("types")!;
  }
}
