import { describe, expect, it } from "vitest";
import { compileTsp } from "./utils.js";

describe("tsp-reader", () => {
  describe("model extraction", () => {
    it("extracts a simple model with scalar properties", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          id: uint64;
          name: string;
          active: boolean;
        }
      `);

      expect(tsp.models).toHaveLength(1);
      const foo = tsp.models[0];
      expect(foo.name).toBe("Foo");
      expect(foo.properties).toHaveLength(3);
      expect(foo.properties[0]).toMatchObject({
        name: "id",
        optional: false,
        type: { kind: "scalar", rustType: "u64" },
      });
      expect(foo.properties[1]).toMatchObject({
        name: "name",
        type: { kind: "scalar", rustType: "String" },
      });
      expect(foo.properties[2]).toMatchObject({
        name: "active",
        type: { kind: "scalar", rustType: "bool" },
      });
    });

    it("extracts optional properties", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          required: string;
          optional?: int32;
        }
      `);

      expect(tsp.models[0].properties[0].optional).toBe(false);
      expect(tsp.models[0].properties[1].optional).toBe(true);
    });

    it("extracts doc comments", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        /** The Foo model */
        model Foo {
          /** The name field */
          name: string;
        }
      `);

      expect(tsp.models[0].doc).toBe("The Foo model");
      expect(tsp.models[0].properties[0].doc).toBe("The name field");
    });

    it("extracts array properties", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          tags: string[];
        }
      `);

      expect(tsp.models[0].properties[0].type).toMatchObject({
        kind: "array",
        elementType: { kind: "scalar", rustType: "String" },
      });
    });

    it("extracts model references", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Bar { x: int32; }
        model Foo { bar: Bar; }
      `);

      expect(tsp.models).toHaveLength(2);
      const foo = tsp.models.find((m) => m.name === "Foo")!;
      expect(foo.properties[0].type).toMatchObject({
        kind: "ref",
        name: "Bar",
      });
    });

    it("resolves Model.property member access as a newtype reference", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      const order = tsp.models.find((m) => m.name === "Order")!;
      expect(order.properties[0]).toMatchObject({
        name: "storeId",
        type: { kind: "newtype-ref", newtypeName: "StoreId" },
      });
    });

    it("extracts array of model references", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Item { name: string; }
        model Container { items: Item[]; }
      `);

      const container = tsp.models.find((m) => m.name === "Container")!;
      expect(container.properties[0].type).toMatchObject({
        kind: "array",
        elementType: { kind: "ref", name: "Item" },
      });
    });
  });

  describe("scalar type mapping", () => {
    it("maps all integer types", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Nums {
          a: int8; b: int16; c: int32; d: int64;
          e: uint8; f: uint16; g: uint32; h: uint64;
          i: safeint;
        }
      `);

      const props = tsp.models[0].properties;
      expect(props[0].type).toMatchObject({ rustType: "i8" });
      expect(props[1].type).toMatchObject({ rustType: "i16" });
      expect(props[2].type).toMatchObject({ rustType: "i32" });
      expect(props[3].type).toMatchObject({ rustType: "i64" });
      expect(props[4].type).toMatchObject({ rustType: "u8" });
      expect(props[5].type).toMatchObject({ rustType: "u16" });
      expect(props[6].type).toMatchObject({ rustType: "u32" });
      expect(props[7].type).toMatchObject({ rustType: "u64" });
      expect(props[8].type).toMatchObject({ rustType: "i64" });
    });

    it("maps float types", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Floats {
          a: float32;
          b: float64;
        }
      `);

      const props = tsp.models[0].properties;
      expect(props[0].type).toMatchObject({ rustType: "f32" });
      expect(props[1].type).toMatchObject({ rustType: "f64" });
    });

    it("maps abstract numeric bases", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Abstract {
          a: numeric;
          b: integer;
          c: float;
        }
      `);

      const props = tsp.models[0].properties;
      expect(props[0].type).toMatchObject({ rustType: "f64" });
      expect(props[1].type).toMatchObject({ rustType: "i64" });
      expect(props[2].type).toMatchObject({ rustType: "f64" });
    });

    it("maps bytes to Vec<u8>", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Bin { data: bytes; }
      `);

      expect(tsp.models[0].properties[0].type).toMatchObject({
        rustType: "Vec<u8>",
      });
    });

    it("maps decimal types to String with rich-types false", async () => {
      const tsp = await compileTsp(
        `
        namespace Test;
        model Money { amount: decimal; precise: decimal128; }
      `,
        false,
      );

      const props = tsp.models[0].properties;
      expect(props[0].type).toMatchObject({ rustType: "String" });
      expect(props[1].type).toMatchObject({ rustType: "String" });
    });

    it("maps decimal types to rust_decimal with rich-types true", async () => {
      const tsp = await compileTsp(
        `
        namespace Test;
        model Money { amount: decimal; precise: decimal128; }
      `,
        true,
      );

      const props = tsp.models[0].properties;
      expect(props[0].type).toMatchObject({ rustType: "rust_decimal::Decimal" });
      expect(props[1].type).toMatchObject({ rustType: "rust_decimal::Decimal" });
      expect(tsp.requiredCrates.has("rust_decimal")).toBe(true);
    });
  });

  describe("rich-types option", () => {
    const TSP_WITH_DATES = `
      namespace Test;
      model Event {
        created: utcDateTime;
        scheduled: offsetDateTime;
        date: plainDate;
        time: plainTime;
        length: duration;
        link: url;
      }
    `;

    it("maps to crate types when rich-types is true", async () => {
      const tsp = await compileTsp(TSP_WITH_DATES, true);
      const props = tsp.models[0].properties;

      expect(props[0].type).toMatchObject({ rustType: "chrono::DateTime<chrono::Utc>" });
      expect(props[1].type).toMatchObject({ rustType: "chrono::DateTime<chrono::FixedOffset>" });
      expect(props[2].type).toMatchObject({ rustType: "chrono::NaiveDate" });
      expect(props[3].type).toMatchObject({ rustType: "chrono::NaiveTime" });
      expect(props[4].type).toMatchObject({ rustType: "chrono::Duration" });
      expect(props[5].type).toMatchObject({ rustType: "url::Url" });
      expect(tsp.requiredCrates.has("chrono")).toBe(true);
      expect(tsp.requiredCrates.has("url")).toBe(true);
    });

    it("maps to String when rich-types is false", async () => {
      const tsp = await compileTsp(TSP_WITH_DATES, false);
      const props = tsp.models[0].properties;

      for (const prop of props) {
        expect(prop.type).toMatchObject({ rustType: "String" });
      }
      expect(tsp.requiredCrates.size).toBe(0);
    });

    it("supports custom overrides via Record", async () => {
      const tsp = await compileTsp(TSP_WITH_DATES, {
        utcDateTime: "time::OffsetDateTime",
      });
      const props = tsp.models[0].properties;

      expect(props[0].type).toMatchObject({ rustType: "time::OffsetDateTime" });
      // Non-overridden types fall back to String
      expect(props[2].type).toMatchObject({ rustType: "String" });
    });
  });

  describe("@encode handling", () => {
    it("resolves unixTimestamp32 to i32 via @encode on scalar", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Event {
          ts: unixTimestamp32;
        }
      `);

      expect(tsp.models[0].properties[0].type).toMatchObject({
        rustType: "i32",
      });
    });

    it("resolves property-level @encode", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Event {
          @encode("unixTimestamp", int64)
          created: utcDateTime;
        }
      `);

      expect(tsp.models[0].properties[0].type).toMatchObject({
        rustType: "i64",
      });
    });

    it("@encode on property takes precedence over rich-types", async () => {
      const tsp = await compileTsp(
        `
        namespace Test;
        model Event {
          @encode("seconds", float64)
          timeout: duration;
        }
      `,
        true,
      );

      // Should be f64 from @encode, not chrono::Duration from rich-types
      expect(tsp.models[0].properties[0].type).toMatchObject({
        rustType: "f64",
      });
    });
  });

  describe("constraint extraction", () => {
    it("extracts @minLength and @maxLength", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @minLength(1) @maxLength(100)
          name: string;
        }
      `);

      const c = tsp.models[0].properties[0].constraints;
      expect(c.minLength).toBe(1);
      expect(c.maxLength).toBe(100);
    });

    it("extracts @minValue and @maxValue", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @minValue(0) @maxValue(150)
          age: int32;
        }
      `);

      const c = tsp.models[0].properties[0].constraints;
      expect(c.minValue).toBe(0);
      expect(c.maxValue).toBe(150);
    });

    it("extracts @minValueExclusive and @maxValueExclusive", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @minValueExclusive(0) @maxValueExclusive(100)
          weight: float64;
        }
      `);

      const c = tsp.models[0].properties[0].constraints;
      expect(c.minValueExclusive).toBe(0);
      expect(c.maxValueExclusive).toBe(100);
    });

    it("extracts @minItems and @maxItems", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @minItems(1) @maxItems(10)
          tags: string[];
        }
      `);

      const c = tsp.models[0].properties[0].constraints;
      expect(c.minItems).toBe(1);
      expect(c.maxItems).toBe(10);
    });

    it("extracts @format", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @format("email")
          email: string;
        }
      `);

      expect(tsp.models[0].properties[0].constraints.format).toBe("email");
    });

    it("extracts @pattern", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo {
          @pattern("^[a-z]+$")
          slug: string;
        }
      `);

      expect(tsp.models[0].properties[0].constraints.pattern).toBe(
        "^[a-z]+$",
      );
    });

    it("returns empty constraints when none are present", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Foo { name: string; }
      `);

      const c = tsp.models[0].properties[0].constraints;
      expect(c).toEqual({});
    });
  });

  describe("enum extraction", () => {
    it("extracts a simple enum", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        /** Color options */
        enum Color { Red, Green, Blue }
      `);

      expect(tsp.enums).toHaveLength(1);
      const color = tsp.enums[0];
      expect(color.name).toBe("Color");
      expect(color.doc).toBe("Color options");
      expect(color.members).toHaveLength(3);
      expect(color.members.map((m) => m.name)).toEqual([
        "Red",
        "Green",
        "Blue",
      ]);
    });

    it("extracts enum with string values", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        enum Status { Active: "active", Inactive: "inactive" }
      `);

      expect(tsp.enums[0].members[0].value).toBe("active");
      expect(tsp.enums[0].members[1].value).toBe("inactive");
    });
  });

  describe("union extraction", () => {
    it("extracts a named string union", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        /** Status options */
        union Status {
          active: "active",
          inactive: "inactive",
        }
      `);

      expect(tsp.unions).toHaveLength(1);
      const status = tsp.unions[0];
      expect(status.name).toBe("Status");
      expect(status.doc).toBe("Status options");
      expect(status.variants).toHaveLength(2);
      expect(status.variants[0]).toMatchObject({
        name: "active",
        value: "active",
      });
    });
  });

  describe("newtype generation", () => {
    it("generates a newtype from Model.property reference", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      expect(tsp.newtypes).toHaveLength(1);
      expect(tsp.newtypes[0]).toMatchObject({
        name: "StoreId",
        innerType: "i32",
        sourceModel: "Store",
        sourceProperty: "id",
      });
    });

    it("updates source model property to use the newtype", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
      `);

      const store = tsp.models.find((m) => m.name === "Store")!;
      expect(store.properties[0].type).toMatchObject({
        kind: "newtype-ref",
        newtypeName: "StoreId",
      });
    });

    it("generates newtype from @key property", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Customer {
          @key id: uint64;
          name: string;
        }
      `);

      expect(tsp.newtypes).toHaveLength(1);
      expect(tsp.newtypes[0]).toMatchObject({
        name: "CustomerId",
        innerType: "u64",
        sourceModel: "Customer",
        sourceProperty: "id",
      });

      const customer = tsp.models[0];
      expect(customer.properties[0].type).toMatchObject({
        kind: "newtype-ref",
        newtypeName: "CustomerId",
      });
    });

    it("deduplicates newtypes when referenced multiple times", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Store { id: int32; }
        model Order { storeId: Store.id; }
        model Invoice { storeId: Store.id; }
      `);

      expect(tsp.newtypes).toHaveLength(1);
    });

    it("does not generate newtypes for plain model references", async () => {
      const tsp = await compileTsp(`
        namespace Test;
        model Store { id: int32; name: string; }
        model Order { store: Store; }
      `);

      expect(tsp.newtypes).toHaveLength(0);
    });
  });

  describe("namespace filtering", () => {
    it("excludes TypeSpec built-in types", async () => {
      // TypeSpec.Reflection namespace contains built-in model types
      // like Model, Enum, etc. — they should be filtered out
      const tsp = await compileTsp(`
        namespace Test;
        model Foo { name: string; }
      `);

      // Should only have our model, not any TypeSpec built-in models
      expect(tsp.models).toHaveLength(1);
      expect(tsp.models[0].name).toBe("Foo");
    });

    it("collects from nested user namespaces", async () => {
      const tsp = await compileTsp(`
        namespace MyApp {
          model Root { id: string; }
          namespace Sub {
            model Nested { id: string; }
          }
        }
      `);

      expect(tsp.models).toHaveLength(2);
      const names = tsp.models.map((m) => m.name).sort();
      expect(names).toEqual(["Nested", "Root"]);
    });
  });
});
