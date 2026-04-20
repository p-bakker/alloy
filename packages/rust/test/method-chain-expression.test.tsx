import { Children, Output, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";
import {
  ClosureExpression,
  CrateDirectory,
  MethodChainExpression,
  SourceFile,
} from "../src/components/index.js";
import { RustFormatOptions } from "../src/context/format-options.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile, toSourceText } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

describe("MethodChainExpression", () => {
  it("renders a basic method call chain", () => {
    expect(
      inFile(
        <MethodChainExpression receiver="items">
          <MethodChainExpression.Call name="iter" />
          <MethodChainExpression.Call name="filter" args={["is_valid"]} />
          <MethodChainExpression.Call name="collect" />
        </MethodChainExpression>,
      ),
    ).toRenderTo(d`items.iter().filter(is_valid).collect()`);
  });

  it("renders turbofish on individual calls", () => {
    expect(
      inFile(
        <MethodChainExpression receiver="items">
          <MethodChainExpression.Call name="iter" />
          <MethodChainExpression.Call name="collect" typeArgs={["Vec<_>"]} />
        </MethodChainExpression>,
      ),
    ).toRenderTo(d`items.iter().collect::<Vec<_>>()`);
  });

  it("renders await and try per chain step", () => {
    expect(
      inFile(
        <MethodChainExpression receiver="client">
          <MethodChainExpression.Call name="send" await try />
          <MethodChainExpression.Call name="json" typeArgs={["Response"]} try />
        </MethodChainExpression>,
      ),
    ).toRenderTo(d`client.send().await?.json::<Response>()?`);
  });

  it("breaks a long chain with each segment on its own indented line", () => {
    expect(
      inFile(
        <MethodChainExpression receiver="items">
          <MethodChainExpression.Call name="iter" />
          <MethodChainExpression.Call name="filter" args={["predicate"]} />
          <MethodChainExpression.Call name="map" args={["mapper"]} />
          <MethodChainExpression.Call name="collect" typeArgs={["Vec<_>"]} />
        </MethodChainExpression>,
      ),
    ).toRenderTo(
      d`
        items
            .iter()
            .filter(predicate)
            .map(mapper)
            .collect::<Vec<_>>()
      `,
      { printWidth: 30 },
    );
  });

  describe("rustfmt-conformant", () => {
    it("short chain stays on a single line", () => {
      const expression = toSourceText(
        <MethodChainExpression receiver="value">
          <MethodChainExpression.Call name="trim" />
          <MethodChainExpression.Call name="to_string" />
        </MethodChainExpression>,
        { printWidth: 100 },
      );
      expect(expression).toBe("value.trim().to_string()");
      checkRustfmtAllEditions(`fn f() -> String {\n    ${expression}\n}\n`);
    });

    it("breaks when the flat chain fits max_width but exceeds chain_width", () => {
      const expression = toSourceText(
        <MethodChainExpression receiver="self.data">
          <MethodChainExpression.Call name="remove" args={["key"]} />
          <MethodChainExpression.Call
            name="map"
            args={[
              <ClosureExpression parameters={[{ name: "entry" }]}>
                entry.value
              </ClosureExpression>,
            ]}
          />
          <MethodChainExpression.Call
            name="ok_or"
            args={["StoreError::NotFound"]}
          />
        </MethodChainExpression>,
      );
      const flat = "self.data.remove(key).map(|entry| entry.value).ok_or(StoreError::NotFound)";
      expect(flat.length).toBeLessThanOrEqual(100);
      expect(flat.length).toBeGreaterThan(60);
      expect(expression).toBe(
        [
          "self.data",
          "    .remove(key)",
          "    .map(|entry| entry.value)",
          "    .ok_or(StoreError::NotFound)",
        ].join("\n"),
      );
      const indented = expression
        .split("\n")
        .map((l) => `        ${l}`)
        .join("\n");
      checkRustfmtAllEditions(
        `fn f() -> Result<(), ()> {\n    {\n${indented}\n    }\n}\n`,
      );
    });

    it("keeps the flat chain when chain_width is widened past the flat length", () => {
      const res = render(
        <RustFormatOptions value={{ chainWidth: 100 }}>
          <Output>
            <CrateDirectory name="test_crate">
              <SourceFile path="test.rs">
                <MethodChainExpression receiver="self.data">
                  <MethodChainExpression.Call name="remove" args={["key"]} />
                  <MethodChainExpression.Call
                    name="map"
                    args={[
                      <ClosureExpression parameters={[{ name: "entry" }]}>
                        entry.value
                      </ClosureExpression>,
                    ]}
                  />
                  <MethodChainExpression.Call
                    name="ok_or"
                    args={["StoreError::NotFound"]}
                  />
                </MethodChainExpression>
              </SourceFile>
            </CrateDirectory>
          </Output>
        </RustFormatOptions>,
        { insertFinalNewLine: false },
      );
      const expression = findFile(res, "src/test.rs").contents;
      expect(expression).toBe(
        "self.data.remove(key).map(|entry| entry.value).ok_or(StoreError::NotFound)",
      );
    });

    it("long chain breaks with the dot leading each segment", () => {
      const expression = toSourceText(
        <MethodChainExpression receiver="self.data">
          <MethodChainExpression.Call name="remove" args={["key"]} />
          <MethodChainExpression.Call
            name="map"
            args={[
              <ClosureExpression parameters={[{ name: "entry" }]}>
                entry.value
              </ClosureExpression>,
            ]}
          />
          <MethodChainExpression.Call
            name="ok_or"
            args={["StoreError::NotFound"]}
          />
        </MethodChainExpression>,
        { printWidth: 40 },
      );
      expect(expression).toBe(
        [
          "self.data",
          "    .remove(key)",
          "    .map(|entry| entry.value)",
          "    .ok_or(StoreError::NotFound)",
        ].join("\n"),
      );
      const indented = expression
        .split("\n")
        .map((l) => `        ${l}`)
        .join("\n");
      checkRustfmtAllEditions(
        `fn f() -> Result<(), ()> {\n    {\n${indented}\n    }\n}\n`,
      );
    });
  });
});
