import { createModule, StrictDescriptor } from "../../create-module.js";

export const error = createModule(
  "std/error",
  {
    kind: "crate",
    members: {
      Error: {
        kind: "trait",
        members: {
          source: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
