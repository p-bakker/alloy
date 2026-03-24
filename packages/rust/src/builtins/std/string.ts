import { createModule, StrictDescriptor } from "../../create-module.js";

export const string = createModule(
  "std/string",
  {
    kind: "crate",
    members: {
      String: { kind: "struct", members: {} },
      ToString: {
        kind: "trait",
        members: {
          to_string: { kind: "field" },
        },
      },
    },
  } satisfies StrictDescriptor,
  true,
);
