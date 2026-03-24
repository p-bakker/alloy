import { describe, expect, it } from "vitest";
import { createRustNamePolicy, RustElements } from "./name-policy.js";

describe("Rust name policy", () => {
  const policy = createRustNamePolicy();

  function transform(name: string, element: RustElements): string {
    const namer = policy.for(element);
    return namer(name);
  }

  it("transforms types to PascalCase", () => {
    expect(transform("my_type", "type")).toBe("MyType");
    expect(transform("some_struct", "type")).toBe("SomeStruct");
  });

  it("transforms traits to PascalCase", () => {
    expect(transform("my_trait", "trait")).toBe("MyTrait");
  });

  it("transforms enum variants to PascalCase", () => {
    expect(transform("some_variant", "enum-variant")).toBe("SomeVariant");
  });

  it("transforms functions to snake_case", () => {
    expect(transform("myFunction", "function")).toBe("my_function");
    expect(transform("DoSomething", "function")).toBe("do_something");
  });

  it("transforms variables to snake_case", () => {
    expect(transform("myVar", "variable")).toBe("my_var");
  });

  it("transforms parameters to snake_case", () => {
    expect(transform("paramName", "parameter")).toBe("param_name");
  });

  it("transforms struct fields to snake_case", () => {
    expect(transform("fieldName", "struct-field")).toBe("field_name");
  });

  it("transforms constants to CONSTANT_CASE", () => {
    expect(transform("maxSize", "constant")).toBe("MAX_SIZE");
    expect(transform("pi_value", "constant")).toBe("PI_VALUE");
  });

  it("transforms statics to CONSTANT_CASE", () => {
    expect(transform("appName", "static")).toBe("APP_NAME");
  });

  it("transforms modules to snake_case", () => {
    expect(transform("myModule", "module")).toBe("my_module");
  });

  it("transforms type parameters to PascalCase", () => {
    expect(transform("t", "type-parameter")).toBe("T");
  });

  it("escapes reserved words", () => {
    expect(transform("type", "variable")).toBe("type_");
    expect(transform("fn", "variable")).toBe("fn_");
    expect(transform("struct", "variable")).toBe("struct_");
  });
});
