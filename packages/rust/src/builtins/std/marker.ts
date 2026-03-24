import { createModule, StrictDescriptor } from "../../create-module.js";

export const marker = createModule(
  "std/marker",
  {
    kind: "crate",
    members: {
      Send: { kind: "trait", members: {} },
      Sync: { kind: "trait", members: {} },
      Copy: { kind: "trait", members: {} },
      Clone: { kind: "trait", members: {} },
      Sized: { kind: "trait", members: {} },
      Unpin: { kind: "trait", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
