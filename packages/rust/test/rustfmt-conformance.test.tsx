import { describe, it } from "vitest";
import {
  toSourceText,
  hasRustfmt,
  assertRustfmtIdempotent,
} from "./utils.js";
import * as rust from "../src/index.js";
import { MatchExpression, MatchArm } from "../src/components/expression/match-expression.js";
import { IfExpression, IfLetExpression } from "../src/components/expression/if-expression.js";
import { ClosureExpression } from "../src/components/expression/closure.js";
import { ForLoop, WhileLoop, Loop } from "../src/components/expression/loops.js";

const describeRustfmt = hasRustfmt ? describe : describe.skip;

describeRustfmt("rustfmt conformance", () => {
  it("complete source file with structs, enums, impl blocks, traits, functions", async () => {
    const source = toSourceText(
      <>
        <rust.StructDeclaration name="Point">
          <rust.StructField name="x" type="f64" />
          <hbr />
          <rust.StructField name="y" type="f64" />
        </rust.StructDeclaration>
        <rust.EnumDeclaration name="Color">
          <rust.EnumVariant name="Red" />
          <rust.EnumVariant name="Green" />
          <rust.EnumVariant name="Blue" />
        </rust.EnumDeclaration>
        <rust.ImplBlock type="Point">
          <rust.FunctionDeclaration
            name="new"
            parameters={[
              { name: "x", type: "f64" },
              { name: "y", type: "f64" },
            ]}
            returns="Self"
          >
            {"Self { x, y }"}
          </rust.FunctionDeclaration>
          <rust.FunctionDeclaration
            name="distance"
            selfParam="&self"
            parameters={[{ name: "other", type: "&Point" }]}
            returns="f64"
          >
            ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
          </rust.FunctionDeclaration>
        </rust.ImplBlock>
        <rust.TraitDeclaration name="Describable">
          <rust.FunctionDeclaration name="describe" selfParam="&self" returns="String" />
        </rust.TraitDeclaration>
        <rust.FunctionDeclaration
          name="add"
          parameters={[
            { name: "a", type: "i32" },
            { name: "b", type: "i32" },
          ]}
          returns="i32"
        >
          a + b
        </rust.FunctionDeclaration>
      </>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("empty struct", async () => {
    const source = toSourceText(
      <rust.StructDeclaration name="Empty" />,
    );

    await assertRustfmtIdempotent(source);
  });

  it("generic function with where clause", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration
        name="print_all"
        typeParameters={[{ name: "T" }]}
        parameters={[{ name: "items", type: "&[T]" }]}
      >
        <rust.WhereClause
          constraints={[
            { type: "T", bounds: "std::fmt::Display + std::fmt::Debug" },
          ]}
        />
        <ForLoop pattern="item" iter="items">
          println!("{"{"}:{"}"}",{" "}item);
        </ForLoop>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("nested modules", async () => {
    const source = toSourceText(
      <rust.ModBlock name="outer">
        <rust.ModBlock name="inner">
          <rust.FunctionDeclaration name="helper" returns="i32">
            42
          </rust.FunctionDeclaration>
        </rust.ModBlock>
      </rust.ModBlock>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("match expressions", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration
        name="describe_number"
        parameters={[{ name: "x", type: "i32" }]}
        returns="&'static str"
      >
        <MatchExpression expr="x">
          <MatchArm pattern="0">
            {"\"zero\""}
          </MatchArm>
          <MatchArm pattern="1">
            {"\"one\""}
          </MatchArm>
          <MatchArm pattern="n" guard="n > 0">
            {"\"positive\""}
          </MatchArm>
          <MatchArm pattern="_">
            {"\"negative\""}
          </MatchArm>
        </MatchExpression>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("if/else expressions", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration
        name="check"
        parameters={[{ name: "x", type: "i32" }]}
        returns="&'static str"
      >
        <IfExpression condition="x > 0" else={"\"non-positive\""}>
          {"\"positive\""}
        </IfExpression>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("if let expression", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration
        name="unwrap_or_default"
        parameters={[{ name: "opt", type: "Option<i32>" }]}
        returns="i32"
      >
        <IfLetExpression pattern="Some(val)" expr="opt" else={"0"}>
          val
        </IfLetExpression>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("closures", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration name="use_closures">
        <rust.LetDeclaration name="add" mutable={false}>
          <ClosureExpression
            params={[{ name: "a", type: "i32" }, { name: "b", type: "i32" }]}
            returns="i32"
          >
            a + b
          </ClosureExpression>
        </rust.LetDeclaration>
        <rust.LetDeclaration name="simple" mutable={false}>
          <ClosureExpression params={[{ name: "x" }]}>
            x + 1
          </ClosureExpression>
        </rust.LetDeclaration>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("loop constructs", async () => {
    const source = toSourceText(
      <rust.FunctionDeclaration name="loop_examples">
        <ForLoop pattern="i" iter="0..10">
          {"println!(\"{}\", i);"}
        </ForLoop>
        <WhileLoop condition="true">
          break;
        </WhileLoop>
        <Loop>
          break;
        </Loop>
      </rust.FunctionDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("pub struct with doc comments and derive", async () => {
    const source = toSourceText(
      <>
        <rust.StructDeclaration name="Config" visibility="pub" doc="Application configuration.">
          <rust.StructField name="name" type="String" visibility="pub" />
          <hbr />
          <rust.StructField name="port" type="u16" visibility="pub" />
          <hbr />
          <rust.StructField name="debug" type="bool" visibility="pub" />
        </rust.StructDeclaration>
      </>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("enum with tuple and struct variants", async () => {
    const source = toSourceText(
      <rust.EnumDeclaration name="Shape">
        <rust.TupleVariant name="Circle" types={["f64"]} />
        <rust.TupleVariant name="Rectangle" types={["f64", "f64"]} />
        <rust.EnumVariant name="Unknown" />
      </rust.EnumDeclaration>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("const and static declarations", async () => {
    const source = toSourceText(
      <>
        <rust.ConstDeclaration name="MAX_SIZE" type="usize">
          1024
        </rust.ConstDeclaration>
        <rust.FunctionDeclaration name="use_const" returns="usize">
          MAX_SIZE
        </rust.FunctionDeclaration>
      </>,
    );

    await assertRustfmtIdempotent(source);
  });

  it("impl block with trait", async () => {
    const source = toSourceText(
      <>
        <rust.StructDeclaration name="MyStruct" />
        <rust.ImplBlock type="MyStruct" trait="std::fmt::Display">
          <rust.FunctionDeclaration
            name="fmt"
            selfParam="&self"
            parameters={[{ name: "f", type: "&mut std::fmt::Formatter<'_>" }]}
            returns="std::fmt::Result"
          >
            write!(f, "MyStruct")
          </rust.FunctionDeclaration>
        </rust.ImplBlock>
      </>,
    );

    await assertRustfmtIdempotent(source);
  });
});
