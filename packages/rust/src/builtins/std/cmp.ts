import { createModule, StrictDescriptor } from "../../create-module.js";

export const cmp = createModule(
  "std/cmp",
  {
    kind: "crate",
    members: {
      PartialEq: {
        kind: "trait",
        members: {
          eq: { kind: "field" },
        },
      },
      Eq: {
        kind: "trait",
        members: {},
      },
      PartialOrd: {
        kind: "trait",
        members: {
          partial_cmp: { kind: "field" },
        },
      },
      Ord: {
        kind: "trait",
        members: {
          cmp: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
