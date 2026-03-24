import { createModule, StrictDescriptor } from "../../create-module.js";

export const convert = createModule(
  "std/convert",
  {
    kind: "crate",
    members: {
      From: {
        kind: "trait",
        members: {
          from: { kind: "field" },
        },
      },
      Into: {
        kind: "trait",
        members: {
          into: { kind: "field" },
        },
      },
      TryFrom: {
        kind: "trait",
        members: {
          try_from: { kind: "field" },
        },
      },
      TryInto: {
        kind: "trait",
        members: {
          try_into: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
