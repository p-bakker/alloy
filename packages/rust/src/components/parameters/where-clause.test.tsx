import { describe, expect, it } from "vitest";
import { findFile, TestCrate } from "../../../test/utils.js";
import { render } from "@alloy-js/core";
import { WhereClause } from "./where-clause.js";
import { FunctionDeclaration } from "../function/function.js";

function renderInCrate(children: any): string {
  const res = render(<TestCrate>{children}</TestCrate>);
  return findFile(res, "test.rs").contents.trim();
}

describe("WhereClause", () => {
  it("renders a simple single-bound where clause", () => {
    const result = renderInCrate(
      <WhereClause constraints={[{ type: "T", bounds: "Display" }]} />,
    );
    expect(result).toBe("where\n  T: Display,");
  });

  it("renders multiple bounds on the same type", () => {
    const result = renderInCrate(
      <WhereClause
        constraints={[{ type: "T", bounds: "Display + Debug" }]}
      />,
    );
    expect(result).toBe("where\n  T: Display + Debug,");
  });

  it("renders multiple types with bounds", () => {
    const result = renderInCrate(
      <WhereClause
        constraints={[
          { type: "T", bounds: "Display + Debug" },
          { type: "U", bounds: "Clone" },
        ]}
      />,
    );
    expect(result).toBe("where\n  T: Display + Debug,\n  U: Clone,");
  });

  it("returns null for empty constraints", () => {
    const result = renderInCrate(<WhereClause constraints={[]} />);
    expect(result).toBe("");
  });

  it("renders a where clause used with a function declaration", () => {
    const result = renderInCrate(
      <FunctionDeclaration
        name="print_item"
        typeParameters={[{ name: "T" }]}
        parameters={[{ name: "item", type: "T" }]}
      >
        <WhereClause
          constraints={[{ type: "T", bounds: "Display" }]}
        />
        {"println!(\"{}\", item);"}
      </FunctionDeclaration>,
    );
    expect(result).toContain("fn print_item<T>(item: T)");
    expect(result).toContain("where");
    expect(result).toContain("T: Display,");
  });
});
