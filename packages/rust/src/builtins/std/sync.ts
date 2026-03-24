import { createModule, StrictDescriptor } from "../../create-module.js";

export const sync = createModule(
  "std/sync",
  {
    kind: "crate",
    members: {
      Arc: { kind: "struct", members: {} },
      Mutex: { kind: "struct", members: {} },
      RwLock: { kind: "struct", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
