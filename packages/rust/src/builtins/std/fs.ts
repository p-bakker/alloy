import { createModule, StrictDescriptor } from "../../create-module.js";

export const fs = createModule(
  "std/fs",
  {
    kind: "crate",
    members: {
      File: { kind: "struct", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
