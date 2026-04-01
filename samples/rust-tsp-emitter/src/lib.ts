import { createTypeSpecLibrary, type JSONSchemaType } from "@typespec/compiler";

export interface RustEmitterOptions {
  "crate-name"?: string;
  edition?: "2021" | "2024";
  "rich-types"?: boolean | Record<string, string>;
  dependencies?: Record<string, { version: string; features?: string[] }>;
}

const EmitterOptionsSchema: JSONSchemaType<RustEmitterOptions> = {
  type: "object",
  additionalProperties: false,
  properties: {
    "crate-name": {
      type: "string",
      nullable: true,
      default: "generated-models",
    },
    edition: {
      type: "string",
      enum: ["2021", "2024"],
      nullable: true,
      default: "2024",
    },
    "rich-types": {
      type: "boolean",
      nullable: true,
      default: true,
    } as any,
    dependencies: {
      type: "object",
      nullable: true,
      additionalProperties: {
        type: "object",
        properties: {
          version: { type: "string" },
          features: {
            type: "array",
            items: { type: "string" },
            nullable: true,
          },
        },
        required: ["version"],
        additionalProperties: false,
      },
      required: [],
    } as any,
  },
  required: [],
};

export const $lib = createTypeSpecLibrary({
  name: "rust-tsp-emitter",
  diagnostics: {},
  emitter: {
    options: EmitterOptionsSchema,
  },
});
