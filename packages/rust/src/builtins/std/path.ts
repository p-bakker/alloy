import { createModule, StrictDescriptor } from "../../create-module.js";

export const path = createModule(
  "std/path",
  {
    kind: "crate",
    members: {
      Path: { kind: "struct", members: {} },
      PathBuf: { kind: "struct", members: {} },
    },
  } satisfies StrictDescriptor,
  true,
);
