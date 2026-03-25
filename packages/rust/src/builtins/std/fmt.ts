import { createModule, StrictDescriptor } from "../../create-module.js";

export const fmt = createModule(
  "std/fmt",
  {
    kind: "crate",
    members: {
      Display: {
        kind: "trait",
        members: {
          fmt: { kind: "field" },
        },
      },
      Debug: {
        kind: "trait",
        members: {
          fmt: { kind: "field" },
        },
      },
      Formatter: {
        kind: "struct",
        members: {},
      },
      Result: {
        kind: "type",
        members: {},
      },
    },
  } satisfies StrictDescriptor,
  true,
);
