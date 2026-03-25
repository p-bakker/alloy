import { createCrate, type StrictDescriptor, type LibraryFrom } from "@alloy-js/rust";

const serdeDescriptor = {
  kind: "crate",
  members: {
    Serialize: { kind: "trait", members: {} },
    Deserialize: { kind: "trait", members: {} },
  },
} satisfies StrictDescriptor;

export const serde: LibraryFrom<typeof serdeDescriptor> = createCrate({
  name: "serde",
  version: "1.0",
  features: ["derive"],
  descriptor: serdeDescriptor,
});

const reqwestDescriptor = {
  kind: "crate",
  members: {
    Client: { kind: "struct", members: {} },
    Error: { kind: "struct", members: {} },
  },
} satisfies StrictDescriptor;

export const reqwest: LibraryFrom<typeof reqwestDescriptor> = createCrate({
  name: "reqwest",
  version: "0.12",
  defaultFeatures: false,
  features: ["json", "rustls-tls"],
  descriptor: reqwestDescriptor,
});

const tokioDescriptor = {
  kind: "crate",
  members: {},
} satisfies StrictDescriptor;

export const tokio: LibraryFrom<typeof tokioDescriptor> = createCrate({
  name: "tokio",
  version: "1",
  features: ["rt-multi-thread", "macros"],
  descriptor: tokioDescriptor,
});
