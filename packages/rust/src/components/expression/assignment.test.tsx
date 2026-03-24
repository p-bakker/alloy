import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { AssignmentStatement } from "./assignment.js";

describe("AssignmentStatement", () => {
  it("renders a simple assignment", () => {
    expect(
      <TestCrate>
        <AssignmentStatement target="x">42</AssignmentStatement>
      </TestCrate>,
    ).toRenderTo(`
      x = 42;
    `);
  });

  it("renders a compound assignment", () => {
    expect(
      <TestCrate>
        <AssignmentStatement target="count" op="+=">1</AssignmentStatement>
      </TestCrate>,
    ).toRenderTo(`
      count += 1;
    `);
  });

  it("renders subtract-assign", () => {
    expect(
      <TestCrate>
        <AssignmentStatement target="total" op="-=">amount</AssignmentStatement>
      </TestCrate>,
    ).toRenderTo(`
      total -= amount;
    `);
  });
});
