import { createModule, StrictDescriptor } from "../../create-module.js";

export const ops = createModule(
  "std/ops",
  {
    kind: "crate",
    members: {
      Add: {
        kind: "trait",
        members: {
          add: { kind: "field" },
        },
      },
      Sub: {
        kind: "trait",
        members: {
          sub: { kind: "field" },
        },
      },
      Mul: {
        kind: "trait",
        members: {
          mul: { kind: "field" },
        },
      },
      Div: {
        kind: "trait",
        members: {
          div: { kind: "field" },
        },
      },
      Deref: {
        kind: "trait",
        members: {
          deref: { kind: "field" },
        },
      },
      DerefMut: {
        kind: "trait",
        members: {
          deref_mut: { kind: "field" },
        },
      },
      Index: {
        kind: "trait",
        members: {
          index: { kind: "field" },
        },
      },
      IndexMut: {
        kind: "trait",
        members: {
          index_mut: { kind: "field" },
        },
      },
      Fn: {
        kind: "trait",
        members: {},
      },
      FnMut: {
        kind: "trait",
        members: {},
      },
      FnOnce: {
        kind: "trait",
        members: {
          call_once: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
