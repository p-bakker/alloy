import { Output, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CrateDirectory } from "../CrateDirectory.js";
import { SourceDirectory } from "../SourceDirectory.js";
import { SourceFile } from "../SourceFile.js";
import { Cfg, CfgAttr } from "./cfg.js";

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

describe("Cfg", () => {
  it("renders a feature cfg", () => {
    const contents = toSourceText(
      <>
        <Cfg feature="serde" />
        fn serializable() {"{}"}
      </>,
    );
    expect(contents).toContain(`#[cfg(feature = "serde")]`);
  });

  it("renders a test cfg", () => {
    const contents = toSourceText(
      <>
        <Cfg test />
        mod tests {"{}"}
      </>,
    );
    expect(contents).toContain("#[cfg(test)]");
  });

  it("renders a target_os cfg", () => {
    const contents = toSourceText(
      <>
        <Cfg targetOs="linux" />
        fn linux_only() {"{}"}
      </>,
    );
    expect(contents).toContain(`#[cfg(target_os = "linux")]`);
  });

  it("renders a not cfg", () => {
    const contents = toSourceText(
      <Cfg not={`feature = "std"`} />,
    );
    expect(contents).toContain(`#[cfg(not(feature = "std"))]`);
  });

  it("renders an any cfg", () => {
    const contents = toSourceText(
      <Cfg any={[`target_os = "linux"`, `target_os = "macos"`]} />,
    );
    expect(contents).toContain(
      `#[cfg(any(target_os = "linux", target_os = "macos"))]`,
    );
  });

  it("renders an all cfg", () => {
    const contents = toSourceText(
      <Cfg all={[`feature = "serde"`, `feature = "json"`]} />,
    );
    expect(contents).toContain(
      `#[cfg(all(feature = "serde", feature = "json"))]`,
    );
  });

  it("renders raw children expression", () => {
    const contents = toSourceText(
      <Cfg>any(unix, target_os = "wasi")</Cfg>,
    );
    expect(contents).toContain(`#[cfg(any(unix, target_os = "wasi"))]`);
  });
});

describe("CfgAttr", () => {
  it("renders a cfg_attr", () => {
    const contents = toSourceText(
      <CfgAttr condition={`feature = "serde"`} attribute="derive(Serialize, Deserialize)" />,
    );
    expect(contents).toContain(
      `#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]`,
    );
  });
});
