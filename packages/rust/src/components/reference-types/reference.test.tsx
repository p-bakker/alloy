import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import {
  Ref,
  Box,
  Option,
  Vec,
  Result,
  Arc,
  Rc,
  Pin,
  Mutex,
  RwLock,
  HashSet,
  PhantomData,
  HashMap,
  Cow,
  Future,
} from "./reference.js";

describe("Reference types", () => {
  // Existing types

  it("renders Ref", () => {
    expect(<TestCrate><Ref>str</Ref></TestCrate>).toRenderTo(`&str`);
  });

  it("renders Ref with lifetime", () => {
    expect(<TestCrate><Ref lifetime="a">str</Ref></TestCrate>).toRenderTo(`&'a str`);
  });

  it("renders mutable Ref", () => {
    expect(<TestCrate><Ref mutable>String</Ref></TestCrate>).toRenderTo(`&mut String`);
  });

  it("renders Box", () => {
    expect(<TestCrate><Box>dyn Error</Box></TestCrate>).toRenderTo(`Box<dyn Error>`);
  });

  it("renders Option", () => {
    expect(<TestCrate><Option>String</Option></TestCrate>).toRenderTo(`Option<String>`);
  });

  it("renders Vec", () => {
    expect(<TestCrate><Vec>u8</Vec></TestCrate>).toRenderTo(`Vec<u8>`);
  });

  it("renders Result", () => {
    expect(<TestCrate><Result ok="String" err="Error" /></TestCrate>).toRenderTo(`Result<String, Error>`);
  });

  // New types

  it("renders Arc", () => {
    expect(<TestCrate><Arc>Mutex&lt;String&gt;</Arc></TestCrate>).toRenderTo(`Arc<Mutex<String>>`);
  });

  it("renders Rc", () => {
    expect(<TestCrate><Rc>RefCell&lt;Vec&lt;u8&gt;&gt;</Rc></TestCrate>).toRenderTo(`Rc<RefCell<Vec<u8>>>`);
  });

  it("renders Pin", () => {
    expect(<TestCrate><Pin><Box>dyn Future&lt;Output = ()&gt;</Box></Pin></TestCrate>).toRenderTo(`Pin<Box<dyn Future<Output = ()>>>`);
  });

  it("renders Mutex", () => {
    expect(<TestCrate><Mutex>String</Mutex></TestCrate>).toRenderTo(`Mutex<String>`);
  });

  it("renders RwLock", () => {
    expect(<TestCrate><RwLock>Vec&lt;u8&gt;</RwLock></TestCrate>).toRenderTo(`RwLock<Vec<u8>>`);
  });

  it("renders HashSet", () => {
    expect(<TestCrate><HashSet>String</HashSet></TestCrate>).toRenderTo(`HashSet<String>`);
  });

  it("renders PhantomData", () => {
    expect(<TestCrate><PhantomData>T</PhantomData></TestCrate>).toRenderTo(`PhantomData<T>`);
  });

  it("renders HashMap", () => {
    expect(<TestCrate><HashMap key="String" value="i32" /></TestCrate>).toRenderTo(`HashMap<String, i32>`);
  });

  it("renders Cow without lifetime", () => {
    expect(<TestCrate><Cow>str</Cow></TestCrate>).toRenderTo(`Cow<str>`);
  });

  it("renders Cow with lifetime", () => {
    expect(<TestCrate><Cow lifetime="a">str</Cow></TestCrate>).toRenderTo(`Cow<'a, str>`);
  });

  it("renders Future with impl (default)", () => {
    expect(<TestCrate><Future>String</Future></TestCrate>).toRenderTo(`impl Future<Output = String>`);
  });

  it("renders Future with dyn", () => {
    expect(<TestCrate><Future style="dyn">String</Future></TestCrate>).toRenderTo(`dyn Future<Output = String>`);
  });

  // Composition

  it("composes nested types", () => {
    expect(
      <TestCrate>
        <Arc><Mutex><Vec>String</Vec></Mutex></Arc>
      </TestCrate>,
    ).toRenderTo(`Arc<Mutex<Vec<String>>>`);
  });
});
