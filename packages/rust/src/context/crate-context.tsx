import type { ComponentContext } from "@alloy-js/core";
import { createContext, useContext } from "@alloy-js/core";

import type { RustCrateScope } from "../scopes/rust-crate-scope.js";

export interface CrateContextValue {
  scope: RustCrateScope;
  name: string;
  version?: string;
  edition: string;
  crateType: "lib" | "bin";
}

export const CrateContext: ComponentContext<CrateContextValue> =
  createContext();

export function useCrateContext() {
  return useContext(CrateContext);
}
