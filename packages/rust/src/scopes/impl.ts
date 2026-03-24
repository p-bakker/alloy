import type { OutputSpace } from "@alloy-js/core";
import { RustLexicalScope } from "./lexical.js";

export class RustImplScope extends RustLexicalScope {
  public static readonly declarationSpaces = [
    "values",
    "types",
  ];
}
