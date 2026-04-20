import { Children, Output, code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";
import {
  CrateDirectory,
  FunctionDeclaration,
  IfExpression,
  ReturnExpression,
  SourceFile,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

describe("ReturnExpression", () => {
  it("renders bare return", () => {
    expect(inFile(<ReturnExpression />)).toRenderTo(d`return;`);
  });

  it("renders return with value", () => {
    expect(
      inFile(<ReturnExpression>Err(StoreError::NotFound)</ReturnExpression>),
    ).toRenderTo(d`return Err(StoreError::NotFound);`);
  });

  it("stc wrapper renders correctly", () => {
    expect(inFile(Stc.ReturnExpression({}).children(["Ok(())"]))).toRenderTo(
      d`return Ok(());`,
    );
  });

  it("composes as a single statement inside an if-block", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="guard"
        parameters={[{ name: "done", type: "bool" }]}
        returnType="i32"
      >
        <IfExpression condition="done">
          <ReturnExpression>0</ReturnExpression>
        </IfExpression>
        <hbr />
        {code`1`}
      </FunctionDeclaration>,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
