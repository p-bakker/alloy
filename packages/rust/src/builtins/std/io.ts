import { createModule, StrictDescriptor } from "../../create-module.js";

export const io = createModule(
  "std/io",
  {
    kind: "crate",
    members: {
      Read: {
        kind: "trait",
        members: {
          read: { kind: "field" },
        },
      },
      Write: {
        kind: "trait",
        members: {
          write: { kind: "field" },
          flush: { kind: "field" },
        },
      },
      Result: { kind: "type", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
