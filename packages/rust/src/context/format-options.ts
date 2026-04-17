import {
  CommonFormatOptions,
  createFormatOptionsContextFor,
} from "@alloy-js/core";

export interface RustFormatOptions extends CommonFormatOptions {}

export const {
  Provider: RustFormatOptions,
  useFormatOptions: useRustFormatOptions,
} = createFormatOptionsContextFor<RustFormatOptions>("rust", {
  tabWidth: 4,
  printWidth: 100,
});
