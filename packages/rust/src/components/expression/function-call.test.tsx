import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { FunctionCall } from "./function-call.js";
import { TryExpression } from "./try-expression.js";

describe("FunctionCall", () => {
  it("renders a simple function call with no args", () => {
    expect(
      <TestCrate>
        <FunctionCall name="do_something" />
      </TestCrate>,
    ).toRenderTo(`
      do_something()
    `);
  });

  it("renders a function call with args", () => {
    expect(
      <TestCrate>
        <FunctionCall name="add" args={["1", "2"]} />
      </TestCrate>,
    ).toRenderTo(`
      add(1, 2)
    `);
  });

  it("renders a method call with receiver", () => {
    expect(
      <TestCrate>
        <FunctionCall name="push" receiver="vec" args={['"hello"']} />
      </TestCrate>,
    ).toRenderTo(`
      vec.push("hello")
    `);
  });

  it("renders a function call with turbofish", () => {
    expect(
      <TestCrate>
        <FunctionCall name="parse" turbofish="i32" receiver="input" />
      </TestCrate>,
    ).toRenderTo(`
      input.parse::<i32>()
    `);
  });

  it("renders a function call with .await", () => {
    expect(
      <TestCrate>
        <FunctionCall name="fetch" receiver="client" args={["url"]} await />
      </TestCrate>,
    ).toRenderTo(`
      client.fetch(url).await
    `);
  });

  it("renders a function call with try operator", () => {
    expect(
      <TestCrate>
        <FunctionCall name="read_to_string" receiver="file" try />
      </TestCrate>,
    ).toRenderTo(`
      file.read_to_string()?
    `);
  });

  it("renders a function call with .await?", () => {
    expect(
      <TestCrate>
        <FunctionCall name="send" receiver="client" args={[]} await try />
      </TestCrate>,
    ).toRenderTo(`
      client.send().await?
    `);
  });
});

describe("TryExpression", () => {
  it("renders the ? operator on a function call", () => {
    expect(
      <TestCrate>
        <TryExpression>
          <FunctionCall name="read_to_string" receiver="file" />
        </TryExpression>
      </TestCrate>,
    ).toRenderTo(`
      file.read_to_string()?
    `);
  });

  it("renders the ? operator on a simple expression", () => {
    expect(
      <TestCrate>
        <TryExpression>
          <FunctionCall name="parse" receiver="input" turbofish="i32" />
        </TryExpression>
      </TestCrate>,
    ).toRenderTo(`
      input.parse::<i32>()?
    `);
  });
});
