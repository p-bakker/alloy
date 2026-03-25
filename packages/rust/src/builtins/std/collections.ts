import { createModule, StrictDescriptor } from "../../create-module.js";

export const collections = createModule(
  "std/collections",
  {
    kind: "crate",
    members: {
      HashMap: { kind: "struct", members: {} },
      BTreeMap: { kind: "struct", members: {} },
      HashSet: { kind: "struct", members: {} },
      BTreeSet: { kind: "struct", members: {} },
      VecDeque: { kind: "struct", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
