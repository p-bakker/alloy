import { createModule, StrictDescriptor } from "../../create-module.js";

export const default_ = createModule(
  "std/default",
  {
    kind: "crate",
    members: {
      Default: {
        kind: "trait",
        members: {
          default: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
