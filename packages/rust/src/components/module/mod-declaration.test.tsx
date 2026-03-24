import { Output, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CrateDirectory } from "../CrateDirectory.js";
import { SourceDirectory } from "../SourceDirectory.js";
import { SourceFile } from "../SourceFile.js";
import { ModDeclaration, ModBlock } from "./mod-declaration.js";
import { TestModule } from "./test-module.js";

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

describe("ModDeclaration", () => {
  it("renders a simple mod declaration", () => {
    const contents = toSourceText(<ModDeclaration name="models" />);
    expect(contents.trim()).toBe("mod models;");
  });

  it("renders a pub mod declaration", () => {
    const contents = toSourceText(<ModDeclaration name="models" visibility="pub" />);
    expect(contents.trim()).toBe("pub mod models;");
  });

  it("renders a pub(crate) mod declaration", () => {
    const contents = toSourceText(
      <ModDeclaration name="internal" visibility="pub(crate)" />,
    );
    expect(contents.trim()).toBe("pub(crate) mod internal;");
  });

  it("renders a mod declaration with path attribute", () => {
    const contents = toSourceText(
      <ModDeclaration name="legacy" path="old_module.rs" />,
    );
    expect(contents.trim()).toBe('#[path = "old_module.rs"]\nmod legacy;');
  });

  it("renders a pub mod declaration with path attribute", () => {
    const contents = toSourceText(
      <ModDeclaration name="compat" visibility="pub" path="compat_v1.rs" />,
    );
    expect(contents.trim()).toBe('#[path = "compat_v1.rs"]\npub mod compat;');
  });
});

describe("ModBlock", () => {
  it("renders an empty mod block", () => {
    const contents = toSourceText(<ModBlock name="tests" />);
    expect(contents.trim()).toBe("mod tests {\n}");
  });

  it("renders a pub mod block", () => {
    const contents = toSourceText(<ModBlock name="utils" visibility="pub" />);
    expect(contents.trim()).toBe("pub mod utils {\n}");
  });

  it("renders a mod block with children", () => {
    const contents = toSourceText(
      <ModBlock name="tests">
        fn test_it() {"{}"}
      </ModBlock>,
    );
    expect(contents.trim()).toBe("mod tests {\n  fn test_it() {}\n}");
  });

  it("renders a pub mod block with children", () => {
    const contents = toSourceText(
      <ModBlock name="helpers" visibility="pub">
        fn help() {"{}"}
      </ModBlock>,
    );
    expect(contents.trim()).toBe("pub mod helpers {\n  fn help() {}\n}");
  });
});

describe("TestModule", () => {
  it("renders a test module with children", () => {
    const contents = toSourceText(
      <TestModule>
        fn test_it() {"{}"}
      </TestModule>,
    );
    expect(contents.trim()).toBe(
      "#[cfg(test)]\nmod tests {\n  fn test_it() {}\n}",
    );
  });
});
