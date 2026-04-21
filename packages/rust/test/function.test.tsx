import { Output, refkey, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  Attribute,
  CrateDirectory,
  FunctionDeclaration,
  ImplBlock,
  SourceFile,
  StructDeclaration,
  TraitDeclaration,
} from "../src/components/index.js";
import { RustFormatOptions } from "../src/context/format-options.js";
import {
  RustFunctionScope,
  useRustModuleScope,
  useRustScope,
} from "../src/scopes/index.js";
import { FunctionSymbol } from "../src/symbols/function-symbol.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile, toSourceText } from "./utils.js";

function FunctionFlagsProbe(props: { name: string }) {
  const scope = useRustModuleScope();

  for (const symbol of scope.values) {
    if (symbol instanceof FunctionSymbol && symbol.name === props.name) {
      return `${symbol.visibility ?? "none"}|${symbol.isAsync}|${symbol.isUnsafe}|${symbol.isConst}`;
    }
  }

  return "missing";
}

function ParameterNamesProbe() {
  const scope = useRustScope();
  if (!(scope instanceof RustFunctionScope)) {
    return "not-function-scope";
  }

  return [...scope.parameters].map((symbol) => symbol.name).join(",");
}

describe("FunctionDeclaration", () => {
  it("renders basic function with empty body", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration name="foo" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`fn foo() {}`);
  });

  it("keeps an empty function body on one line", () => {
    const source = toSourceText(<FunctionDeclaration name="f" />);

    expect(source).toEqual(d`fn f() {}`);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders qualifiers in rust order", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="work"
              pub="crate"
              async={true}
              unsafe={true}
              const={true}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`pub(crate) const async unsafe fn work() {}`);
  });

  it("renders pub(super) visibility with qualifiers in rust order", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="work"
              pub="super"
              async={true}
              unsafe={true}
              const={true}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`pub(super) const async unsafe fn work() {}`);
  });

  it("renders parameters from descriptors", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="process"
              parameters={[
                {
                  name: "input-value",
                  type: "String",
                  mutable: true,
                  refType: "&mut",
                },
                { name: "count", type: "usize" },
              ]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`fn process(mut input-value: &mut String, count: usize) {}`);
  });

  it("keeps a short parameter list on a single line", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="add"
        parameters={[
          { name: "x", type: "i32" },
          { name: "y", type: "i32" },
        ]}
        returnType="i32"
      >
        {"x + y"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn add(x: i32, y: i32) -> i32 {
          x + y
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a long parameter list vertically with a trailing comma", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="long_signature"
        parameters={[
          { name: "first_parameter", type: "SomeLongTypeName" },
          { name: "second_parameter", type: "AnotherLongTypeName" },
          { name: "third_parameter", type: "YetAnotherLongTypeName" },
          { name: "fourth_parameter", type: "AndOneMoreLongTypeName" },
        ]}
        returnType="ResultType"
      >
        {"todo!()"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn long_signature(
          first_parameter: SomeLongTypeName,
          second_parameter: AnotherLongTypeName,
          third_parameter: YetAnotherLongTypeName,
          fourth_parameter: AndOneMoreLongTypeName,
      ) -> ResultType {
          todo!()
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a method receiver plus params flat when they fit", () => {
    const itemRef = refkey("item");
    const source = toSourceText(
      <>
        <StructDeclaration name="Item" refkey={itemRef} />
        <hbr />
        <ImplBlock type={itemRef}>
          <FunctionDeclaration
            name="foo"
            parameters={[{ name: "bar", type: "T" }]}
          />
        </ImplBlock>
      </>,
    );

    expect(source).toEqual(d`
      struct Item;
      impl Item {
          fn foo(&self, bar: T) {}
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a method signature vertically when receiver plus params overflow", () => {
    const itemRef = refkey("item");
    const source = toSourceText(
      <>
        <StructDeclaration name="Item" refkey={itemRef} />
        <hbr />
        <ImplBlock type={itemRef}>
          <FunctionDeclaration
            name="configure_item_with_many_options"
            parameters={[
              { name: "first_option", type: "FirstOptionType" },
              { name: "second_option", type: "SecondOptionType" },
              { name: "third_option", type: "ThirdOptionType" },
            ]}
          >
            {"todo!()"}
          </FunctionDeclaration>
        </ImplBlock>
      </>,
    );

    expect(source).toEqual(d`
      struct Item;
      impl Item {
          fn configure_item_with_many_options(
              &self,
              first_option: FirstOptionType,
              second_option: SecondOptionType,
              third_option: ThirdOptionType,
          ) {
              todo!()
          }
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders return type, type parameters, and where clause", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="map"
              parameters={[{ name: "item", type: "T" }]}
              returnType="U"
              typeParameters={[
                { name: "T" },
                { name: "U", constraints: "Display" },
              ]}
              whereClause="U: Clone"
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      fn map<T, U: Display>(item: T) -> U
      where
          U: Clone,
      {
      }
    `);
  });

  it("moves body opening brace to its own line when where clause is present", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="map"
        parameters={[{ name: "item", type: "T" }]}
        returnType="U"
        typeParameters={[{ name: "T" }, { name: "U", constraint: "Display" }]}
        whereClause="U: Clone"
      >
        {"item"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn map<T, U: Display>(item: T) -> U
      where
          U: Clone,
      {
          item
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps body opening brace glued when no where clause is present", () => {
    const source = toSourceText(
      <FunctionDeclaration name="run">{"let x = 1;"}</FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn run() {
          let x = 1;
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("treats an empty whereClause array as no where clause", () => {
    const source = toSourceText(
      <FunctionDeclaration name="run" whereClause={[]}>
        {"let x = 1;"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn run() {
          let x = 1;
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a trait method where-clause across lines with no trailing comma", () => {
    const source = toSourceText(
      <TraitDeclaration name="Serializable">
        <FunctionDeclaration
          name="from_bytes"
          receiver="none"
          parameters={[{ name: "bytes", type: "&[u8]" }]}
          returnType="Self"
          whereClause="Self: Sized"
        />
      </TraitDeclaration>,
    );

    expect(source).toEqual(d`
      trait Serializable {
          fn from_bytes(bytes: &[u8]) -> Self
          where
              Self: Sized;
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a trait method where-clause with multiple bounds", () => {
    const source = toSourceText(
      <TraitDeclaration name="Convert">
        <FunctionDeclaration
          name="convert"
          receiver="none"
          typeParameters={[{ name: "T" }]}
          returnType="T"
          whereClause={["T: Clone", "T: core::fmt::Debug"]}
        />
      </TraitDeclaration>,
    );

    expect(source).toEqual(d`
      trait Convert {
          fn convert<T>() -> T
          where
              T: Clone,
              T: core::fmt::Debug;
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders multiline doc comments and indented body", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration name="run" doc={"Line one.\nLine two."}>
              {"let value = 1;"}
              <hbr />
              {"value"}
            </FunctionDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      /// Line one.
      /// Line two.
      fn run() {
          let value = 1;
          value
      }
    `);
  });

  it("creates function and parameter symbols in function scope", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="run-work"
              pub="crate"
              async={true}
              unsafe={true}
              const={true}
              parameters={[{ name: "input-value", type: "i32" }]}
            >
              <ParameterNamesProbe />
            </FunctionDeclaration>
            <hbr />
            <FunctionFlagsProbe name="run-work" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      pub(crate) const async unsafe fn run-work(input-value: i32) {
          input-value
      }
      pub(crate)|true|true|true
    `);
  });

  it("applies pub visibility on function symbols", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration name="run-work" pub={true} />
            <hbr />
            <FunctionFlagsProbe name="run-work" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      pub fn run-work() {}
      pub|false|false|false
    `);
  });

  it("defaults to &self receiver for methods in impl blocks", () => {
    const itemRef = refkey("item");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration name="Item" refkey={itemRef} />
            <hbr />
            <ImplBlock type={itemRef}>
              <FunctionDeclaration name="run" />
            </ImplBlock>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      struct Item;
      impl Item {
          fn run(&self) {}
      }
    `);
  });

  it("supports explicit &mut self receiver in methods", () => {
    const itemRef = refkey("item");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration name="Item" refkey={itemRef} />
            <hbr />
            <ImplBlock type={itemRef}>
              <FunctionDeclaration name="run" receiver="&mut self" />
            </ImplBlock>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      struct Item;
      impl Item {
          fn run(&mut self) {}
      }
    `);
  });

  it("supports explicit self receiver by value in methods", () => {
    const itemRef = refkey("item");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration name="Item" refkey={itemRef} />
            <hbr />
            <ImplBlock type={itemRef}>
              <FunctionDeclaration name="consume" receiver="self" />
            </ImplBlock>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      struct Item;
      impl Item {
          fn consume(self) {}
      }
    `);
  });

  it("supports associated functions with receiver none in methods", () => {
    const itemRef = refkey("item");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration name="Item" refkey={itemRef} />
            <hbr />
            <ImplBlock type={itemRef}>
              <FunctionDeclaration name="new" receiver="none" />
            </ImplBlock>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      struct Item;
      impl Item {
          fn new() {}
      }
    `);
  });

  it("renders receiver before additional parameters", () => {
    const itemRef = refkey("item");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration name="Item" refkey={itemRef} />
            <hbr />
            <ImplBlock type={itemRef}>
              <FunctionDeclaration
                name="set"
                parameters={[
                  { name: "x", type: "i32" },
                  { name: "y", type: "i32" },
                ]}
              />
            </ImplBlock>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      struct Item;
      impl Item {
          fn set(&self, x: i32, y: i32) {}
      }
    `);
  });

  it("defaults to &self receiver for methods in traits", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Runner">
              <FunctionDeclaration name="run" />
            </TraitDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Runner {
          fn run(&self);
      }
    `);
  });

  it("renders default implementations for trait methods with bodies", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Runner">
              <FunctionDeclaration name="run">
                {'println!("default");'}
              </FunctionDeclaration>
            </TraitDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Runner {
          fn run(&self) {
              println!("default");
          }
      }
    `);
  });

  it("ignores receiver prop outside impl and trait scopes", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration name="utility" receiver="self" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`fn utility() {}`);
  });

  it("renders attributes before function declaration", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="test_it"
              receiver="none"
              attributes={[<Attribute name="test" />]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      #[test]
      fn test_it() {}
    `);
  });

  it("renders attributes with doc comment", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="run"
              doc="Runs the process."
              attributes={[<Attribute name="inline" />]}
            >
              {"todo!()"}
            </FunctionDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      /// Runs the process.
      #[inline]
      fn run() {
          todo!()
      }
    `);
  });

  it("renders multiple attributes", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <FunctionDeclaration
              name="handler"
              pub
              async
              attributes={[
                <Attribute name="cfg" args={'feature = "server"'} />,
                <Attribute name="allow" args="unused_variables" />,
              ]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      #[cfg(feature = "server")]
      #[allow(unused_variables)]
      pub async fn handler() {}
    `);
  });

  describe("fnParamsLayout", () => {
    it("keeps a short signature flat under the default 'Tall' layout", () => {
      const source = toSourceText(
        <FunctionDeclaration
          name="demo"
          parameters={[
            { name: "a", type: "i32" },
            { name: "b", type: "i32" },
            { name: "c", type: "i32" },
          ]}
          returnType="i32"
        >
          {"a + b + c"}
        </FunctionDeclaration>,
      );

      expect(source).toEqual(d`
        fn demo(a: i32, b: i32, c: i32) -> i32 {
            a + b + c
        }
      `);
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("breaks a short signature vertically when fnParamsLayout is 'Vertical'", () => {
      const res = render(
        <RustFormatOptions value={{ fnParamsLayout: "Vertical" }}>
          <Output>
            <CrateDirectory name="test_crate">
              <SourceFile path="test.rs">
                <FunctionDeclaration
                  name="demo"
                  parameters={[
                    { name: "a", type: "i32" },
                    { name: "b", type: "i32" },
                    { name: "c", type: "i32" },
                  ]}
                  returnType="i32"
                >
                  {"a + b + c"}
                </FunctionDeclaration>
              </SourceFile>
            </CrateDirectory>
          </Output>
        </RustFormatOptions>,
        { insertFinalNewLine: false },
      );
      const source = findFile(res, "src/test.rs").contents;

      expect(source).toEqual(d`
        fn demo(
            a: i32,
            b: i32,
            c: i32,
        ) -> i32 {
            a + b + c
        }
      `);
      expect(() =>
        checkRustfmtAllEditions(source, {
          config: { fn_params_layout: "Vertical" },
        }),
      ).not.toThrow();
    });

    it("composes with a where clause under 'Vertical'", () => {
      const res = render(
        <RustFormatOptions value={{ fnParamsLayout: "Vertical" }}>
          <Output>
            <CrateDirectory name="test_crate">
              <SourceFile path="test.rs">
                <FunctionDeclaration
                  name="demo"
                  typeParameters={[{ name: "T" }]}
                  parameters={[
                    { name: "a", type: "i32" },
                    { name: "b", type: "i32" },
                  ]}
                  returnType="i32"
                  whereClause="T: Display"
                >
                  {"42"}
                </FunctionDeclaration>
              </SourceFile>
            </CrateDirectory>
          </Output>
        </RustFormatOptions>,
        { insertFinalNewLine: false },
      );
      const source = findFile(res, "src/test.rs").contents;

      expect(source).toEqual(d`
        fn demo<T>(
            a: i32,
            b: i32,
        ) -> i32
        where
            T: Display,
        {
            42
        }
      `);
      expect(() =>
        checkRustfmtAllEditions(source, {
          config: { fn_params_layout: "Vertical" },
        }),
      ).not.toThrow();
    });

    it("forces the break on a single-parameter signature under 'Vertical'", () => {
      const res = render(
        <RustFormatOptions value={{ fnParamsLayout: "Vertical" }}>
          <Output>
            <CrateDirectory name="test_crate">
              <SourceFile path="test.rs">
                <FunctionDeclaration
                  name="demo"
                  parameters={[{ name: "x", type: "i32" }]}
                  returnType="i32"
                >
                  {"x"}
                </FunctionDeclaration>
              </SourceFile>
            </CrateDirectory>
          </Output>
        </RustFormatOptions>,
        { insertFinalNewLine: false },
      );
      const source = findFile(res, "src/test.rs").contents;

      expect(source).toEqual(d`
        fn demo(
            x: i32,
        ) -> i32 {
            x
        }
      `);
    });
  });
});
