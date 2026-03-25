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

export { convert } from "./convert.js";
export { iter } from "./iter.js";
export { ops } from "./ops.js";
export { sync } from "./sync.js";
export { fs } from "./fs.js";
export { path } from "./path.js";
export { string } from "./string.js";
export { marker } from "./marker.js";
export { default_ } from "./default.js";
export { hash } from "./hash.js";
export { cmp } from "./cmp.js";
export { error } from "./error.js";
