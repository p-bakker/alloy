import { describe, expect, it } from "vitest";
import { findFile, TestCrate } from "../../../test/utils.js";
import { render, Output } from "@alloy-js/core";
import { Attribute, InnerAttribute } from "./attribute.js";

function renderInCrate(children: any): string {
  const res = render(<TestCrate>{children}</TestCrate>);
  return findFile(res, "test.rs").contents.trim();
}

describe("Attribute", () => {
  it("renders a simple attribute", () => {
    const result = renderInCrate(<Attribute>allow(dead_code)</Attribute>);
    expect(result).toBe("#[allow(dead_code)]");
  });

  it("renders a derive attribute", () => {
    const result = renderInCrate(
      <Attribute>derive(Debug, Clone)</Attribute>,
    );
    expect(result).toBe("#[derive(Debug, Clone)]");
  });

  /**
   * Proc macro attributes are applied using the standard `#[...]` syntax.
   */
  it("renders a proc macro attribute (e.g., serde)", () => {
    const result = renderInCrate(
      <Attribute>serde(rename_all = "camelCase")</Attribute>,
    );
    expect(result).toBe('#[serde(rename_all = "camelCase")]');
  });

  it("renders a proc macro attribute (e.g., tokio::main)", () => {
    const result = renderInCrate(<Attribute>tokio::main</Attribute>);
    expect(result).toBe("#[tokio::main]");
  });

  it("renders a route attribute", () => {
    const result = renderInCrate(
      <Attribute>get("/api/users")</Attribute>,
    );
    expect(result).toBe('#[get("/api/users")]');
  });
});

describe("InnerAttribute", () => {
  it("renders an inner attribute", () => {
    const result = renderInCrate(
      <InnerAttribute>allow(unused)</InnerAttribute>,
    );
    expect(result).toBe("#![allow(unused)]");
  });
});
