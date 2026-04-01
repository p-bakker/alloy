import { render, writeOutput, type OutputDirectory } from "@alloy-js/core";
import { d } from "@alloy-js/core/testing";
import { compile, NodeHost } from "@typespec/compiler";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { $onEmit } from "../src/emitter.js";

let tmpCounter = 0;

/**
 * Run the full emitter on a TypeSpec string and return the generated file contents.
 */
async function emitRust(
  tspSource: string,
  options: Record<string, unknown> = {},
): Promise<Record<string, string>> {
  const dir = join(tmpdir(), `rust-tsp-emit-test-${Date.now()}-${tmpCounter++}`);
  mkdirSync(dir, { recursive: true });

  const mainFile = join(dir, "main.tsp");
  writeFileSync(mainFile, tspSource);

  const outputDir = join(dir, "output");
  mkdirSync(outputDir, { recursive: true });

  try {
    const program = await compile(NodeHost, mainFile, { noEmit: true });

    const errors = program.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      throw new Error(
        `TypeSpec compilation failed:\n${errors.map((d) => d.message).join("\n")}`,
      );
    }

    await $onEmit({
      program,
      emitterOutputDir: outputDir,
      options: {
        "crate-name": "test-crate",
        edition: "2024",
        ...options,
      } as any,
    });

    // Read all generated files
    const files: Record<string, string> = {};
    function readDir(base: string, prefix: string) {
      const { readdirSync, statSync } = require("node:fs");
      for (const entry of readdirSync(base)) {
        const full = join(base, entry);
        const rel = prefix ? `${prefix}/${entry}` : entry;
        if (statSync(full).isDirectory()) {
          readDir(full, rel);
        } else {
          files[rel] = readFileSync(full, "utf-8");
        }
      }
    }
    readDir(outputDir, "");

    return files;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("emitter", () => {
  describe("struct generation", () => {
    it("generates a basic struct with scalar fields", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          id: uint64;
          name: string;
          active: boolean;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub struct Foo");
      expect(models).toContain("pub id: u64");
      expect(models).toContain("pub name: String");
      expect(models).toContain("pub active: bool");
    });

    it("generates Optional fields for optional properties", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          required: string;
          optional?: int32;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub required: String");
      expect(models).toContain("pub optional: Option<i32>");
    });

    it("generates doc comments from TypeSpec docs", async () => {
      const files = await emitRust(`
        namespace Test;
        /** A foo thing */
        model Foo {
          /** The name */
          name: string;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("/// A foo thing");
      expect(models).toContain("/// The name");
    });

    it("generates Vec for array properties", async () => {
      const files = await emitRust(`
        namespace Test;
        model Item { name: string; }
        model Container { items: Item[]; }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub items: Vec<Item>");
    });

    it("generates serde rename for camelCase fields", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo { firstName: string; }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain('#[serde(rename = "firstName")]');
      expect(models).toContain("pub first_name: String");
    });
  });

  describe("newtype generation", () => {
    it("generates a newtype tuple struct for Model.property references", async () => {
      const files = await emitRust(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub struct StoreId(pub i32)");
      expect(models).toContain("pub store_id: StoreId");
    });

    it("uses newtype on the source model property too", async () => {
      const files = await emitRust(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      const models = files["src/models.rs"];
      // Store.id should also be StoreId, not i32
      expect(models).toMatch(/pub struct Store \{[^}]*pub id: StoreId/s);
    });

    it("generates newtype from @key property", async () => {
      const files = await emitRust(`
        namespace Test;
        model Customer {
          @key id: uint64;
          name: string;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub struct CustomerId(pub u64)");
      expect(models).toMatch(/pub struct Customer \{[^}]*pub id: CustomerId/s);
    });

    it("gives newtypes correct derives", async () => {
      const files = await emitRust(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain(
        "#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]",
      );
    });
  });

  describe("enum generation", () => {
    it("generates a Rust enum from TypeSpec enum", async () => {
      const files = await emitRust(`
        namespace Test;
        enum Color { Red, Green, Blue }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub enum Color");
      expect(models).toContain("Red,");
      expect(models).toContain("Green,");
      expect(models).toContain("Blue,");
      expect(models).toContain("#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]");
    });
  });

  describe("union generation", () => {
    it("generates a Rust enum from TypeSpec string union", async () => {
      const files = await emitRust(`
        namespace Test;
        union Status {
          active: "active",
          pending: "pending",
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub enum Status");
      expect(models).toContain('#[serde(rename_all = "lowercase")]');
    });
  });

  describe("validation attributes", () => {
    it("generates #[validate] for @minLength/@maxLength", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @minLength(1) @maxLength(100)
          name: string;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("#[validate(length(min = 1, max = 100))]");
      expect(models).toContain("#[derive(Debug, Clone, Serialize, Deserialize, Validate)]");
    });

    it("generates #[validate] for @minValue/@maxValue", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @minValue(0) @maxValue(150)
          age: int32;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("#[validate(range(min = 0, max = 150))]");
    });

    it("generates #[validate(email)] for @format email", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @format("email")
          email: string;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("#[validate(email)]");
    });

    it("generates #[validate(regex)] for @pattern", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @pattern("^[a-z]+$")
          slug: string;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("#[validate(regex");
      expect(models).toContain("^[a-z]+$");
    });

    it("does not add Validate derive when no constraints", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo { name: string; }
      `);

      const models = files["src/models.rs"];
      expect(models).not.toContain("Validate");
      expect(models).not.toContain("use validator");
    });
  });

  describe("runtime validation", () => {
    it("generates validate() impl for constrained models", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @minLength(1)
          name: string;
          @minValue(0)
          age?: int32;
        }
      `);

      const validation = files["src/validation.rs"];
      expect(validation).toContain("impl Foo");
      expect(validation).toContain("pub fn validate(&self)");
      expect(validation).toContain("self.name.len() < 1");
      expect(validation).toContain("if let Some(val) = self.age");
      expect(validation).toContain("val < 0");
    });

    it("generates exclusive bound checks with <= / >=", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @minValueExclusive(0)
          @maxValueExclusive(100)
          weight: float64;
        }
      `);

      const validation = files["src/validation.rs"];
      expect(validation).toContain("self.weight <= 0");
      expect(validation).toContain("self.weight >= 100");
    });

    it("generates regex validation for @pattern", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @pattern("^[a-z]+$")
          slug: string;
        }
      `);

      const validation = files["src/validation.rs"];
      expect(validation).toContain("regex::Regex::new");
      expect(validation).toContain("^[a-z]+$");
    });

    it("does not generate validation.rs content for unconstrained models", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo { name: string; }
      `);

      const validation = files["src/validation.rs"];
      expect(validation.trim()).toBe("");
    });
  });

  describe("Cargo.toml generation", () => {
    it("generates Cargo.toml with base dependencies", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo { name: string; }
      `);

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain('name = "test-crate"');
      expect(cargo).toContain('edition = "2024"');
      expect(cargo).toContain("serde =");
      expect(cargo).toContain("serde_json =");
      expect(cargo).toContain("validator =");
      expect(cargo).not.toContain("chrono");
      expect(cargo).not.toContain("regex");
    });

    it("includes chrono when date/time types are used", async () => {
      const files = await emitRust(`
        namespace Test;
        model Event { created: utcDateTime; }
      `);

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain("chrono =");
    });

    it("includes url crate when url type is used", async () => {
      const files = await emitRust(`
        namespace Test;
        model Link { href: url; }
      `);

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain("url =");
    });

    it("includes regex when @pattern is used", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo {
          @pattern("^[a-z]+$")
          slug: string;
        }
      `);

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain("regex =");
    });

    it("does not include rich-type crates when rich-types is false", async () => {
      const files = await emitRust(
        `
        namespace Test;
        model Event { created: utcDateTime; link: url; }
      `,
        { "rich-types": false },
      );

      const cargo = files["Cargo.toml"];
      expect(cargo).not.toContain("chrono");
      expect(cargo).not.toContain("url =");
    });

    it("respects user dependency overrides", async () => {
      const files = await emitRust(
        `
        namespace Test;
        model Foo { name: string; }
      `,
        {
          dependencies: {
            serde: { version: "1.0.219", features: ["derive", "rc"] },
          },
        },
      );

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain("1.0.219");
      expect(cargo).toContain('"rc"');
    });
  });

  describe("@encode handling", () => {
    it("maps unixTimestamp32 to i32 in generated code", async () => {
      const files = await emitRust(`
        namespace Test;
        model Event { ts: unixTimestamp32; }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub ts: i32");
    });

    it("maps property-level @encode to target type", async () => {
      const files = await emitRust(`
        namespace Test;
        model Event {
          @encode("seconds", float64)
          timeout: duration;
        }
      `);

      const models = files["src/models.rs"];
      expect(models).toContain("pub timeout: f64");
    });
  });

  describe("emitter options", () => {
    it("uses crate-name option in Cargo.toml", async () => {
      const files = await emitRust(
        `namespace Test; model Foo { x: string; }`,
        { "crate-name": "my-awesome-crate" },
      );

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain('name = "my-awesome-crate"');
    });

    it("uses edition option in Cargo.toml", async () => {
      const files = await emitRust(
        `namespace Test; model Foo { x: string; }`,
        { edition: "2021" },
      );

      const cargo = files["Cargo.toml"];
      expect(cargo).toContain('edition = "2021"');
    });
  });

  describe("lib.rs generation", () => {
    it("generates lib.rs with module declarations and re-export", async () => {
      const files = await emitRust(`
        namespace Test;
        model Foo { name: string; }
      `);

      const lib = files["src/lib.rs"];
      expect(lib).toContain("pub mod models");
      expect(lib).toContain("pub mod validation");
      expect(lib).toContain("pub use crate::models::*");
    });
  });
});
