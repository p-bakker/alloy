import { createModule, StrictDescriptor } from "../../create-module.js";

export const hash = createModule(
  "std/hash",
  {
    kind: "crate",
    members: {
      Hash: {
        kind: "trait",
        members: {
          hash: { kind: "field" },
        },
      },
      Hasher: {
        kind: "trait",
        members: {
          finish: { kind: "field" },
          write: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
