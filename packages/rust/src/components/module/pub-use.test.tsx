import { Output, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CrateDirectory } from "../CrateDirectory.js";
import { SourceDirectory } from "../SourceDirectory.js";
import { SourceFile } from "../SourceFile.js";
import { PubUse } from "./pub-use.js";

function toSourceText(children: any): string {
  const res = render(
    <Output>
      <CrateDirectory name="test-crate">
        <SourceDirectory path=".">
          <SourceFile path="test.rs">{children}</SourceFile>
        </SourceDirectory>
      </CrateDirectory>
    </Output>,
  );
  return findFile(res, "test.rs").contents;
}

describe("PubUse", () => {
  it("renders a simple pub use with path only", () => {
    const contents = toSourceText(<PubUse path="crate::models::Person" />);
    expect(contents.trim()).toBe("pub use crate::models::Person;");
  });

  it("renders a pub use with glob import", () => {
    const contents = toSourceText(
      <PubUse path="crate::models" items={["*"]} />,
    );
    expect(contents.trim()).toBe("pub use crate::models::*;");
  });

  it("renders a pub use with a single item", () => {
    const contents = toSourceText(
      <PubUse path="crate::models" items={["Person"]} />,
    );
    expect(contents.trim()).toBe("pub use crate::models::Person;");
  });

  it("renders a pub use with multiple items", () => {
    const contents = toSourceText(
      <PubUse path="crate::models" items={["Person", "Address"]} />,
    );
    expect(contents.trim()).toBe("pub use crate::models::{Person, Address};");
  });

  it("renders with pub(crate) visibility", () => {
    const contents = toSourceText(
      <PubUse path="crate::internal" items={["Helper"]} visibility="pub(crate)" />,
    );
    expect(contents.trim()).toBe("pub(crate) use crate::internal::Helper;");
  });

  it("renders with private visibility", () => {
    const contents = toSourceText(
      <PubUse path="crate::internal" items={["Helper"]} visibility="private" />,
    );
    expect(contents.trim()).toBe("use crate::internal::Helper;");
  });
});
