import { createModule, StrictDescriptor } from "../../create-module.js";

export const iter = createModule(
  "std/iter",
  {
    kind: "crate",
    members: {
      Iterator: {
        kind: "trait",
        members: {
          next: { kind: "field" },
        },
      },
      IntoIterator: {
        kind: "trait",
        members: {
          into_iter: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
