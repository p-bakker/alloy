import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { StructExpression, StructFieldExpression } from "./struct-expression.js";
import { List } from "@alloy-js/core";

describe("StructExpression", () => {
  it("renders a struct expression with shorthand fields", () => {
    expect(
      <TestCrate>
        <StructExpression type="Person">
          <List>
            <StructFieldExpression name="name" />
            <StructFieldExpression name="age" />
          </List>
        </StructExpression>
      </TestCrate>,
    ).toRenderTo(`
      Person {
          name,
          age,
      }
    `);
  });

  it("renders a struct expression with explicit value fields", () => {
    expect(
      <TestCrate>
        <StructExpression type="Person">
          <List>
            <StructFieldExpression name="name">name.to_string()</StructFieldExpression>
            <StructFieldExpression name="age">42</StructFieldExpression>
          </List>
        </StructExpression>
      </TestCrate>,
    ).toRenderTo(`
      Person {
          name: name.to_string(),
          age: 42,
      }
    `);
  });

  it("renders a struct expression with mixed shorthand and explicit fields", () => {
    expect(
      <TestCrate>
        <StructExpression type="Config">
          <List>
            <StructFieldExpression name="host" />
            <StructFieldExpression name="port">8080</StructFieldExpression>
          </List>
        </StructExpression>
      </TestCrate>,
    ).toRenderTo(`
      Config {
          host,
          port: 8080,
      }
    `);
  });

  it("renders an empty struct expression", () => {
    expect(
      <TestCrate>
        <StructExpression type="Unit">
        </StructExpression>
      </TestCrate>,
    ).toRenderTo(`
      Unit {}
    `);
  });
});
