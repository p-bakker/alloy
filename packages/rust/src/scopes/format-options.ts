import {
  CommonFormatOptions,
  createFormatOptionsContextFor,
} from "@alloy-js/core";

export interface RustFormatOptions extends CommonFormatOptions {}

export const {
  Provider: RustFormatOptionsProvider,
  useFormatOptions: useRustFormatOptions,
} = createFormatOptionsContextFor<RustFormatOptions>("rs", {
  tabWidth: 4,
});
