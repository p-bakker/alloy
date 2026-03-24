import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { MemberAccess } from "./member-access.js";

describe("MemberAccess", () => {
  it("renders simple member access", () => {
    expect(
      <TestCrate>
        <MemberAccess receiver="foo" member="bar" />
      </TestCrate>,
    ).toRenderTo(`
      foo.bar
    `);
  });

  it("renders chained member access", () => {
    expect(
      <TestCrate>
        <MemberAccess
          receiver={<MemberAccess receiver="foo" member="bar" />}
          member="baz"
        />
      </TestCrate>,
    ).toRenderTo(`
      foo.bar.baz
    `);
  });

  it("renders member access with numeric index", () => {
    expect(
      <TestCrate>
        <MemberAccess receiver="tuple" member="0" />
      </TestCrate>,
    ).toRenderTo(`
      tuple.0
    `);
  });
});
