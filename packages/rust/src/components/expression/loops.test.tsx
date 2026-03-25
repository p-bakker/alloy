import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { ForLoop, WhileLoop, WhileLetLoop, Loop } from "./loops.js";

describe("ForLoop", () => {
  it("renders a for loop", () => {
    expect(
      <TestCrate>
        <ForLoop pattern="item" iter="items.iter()">
          println!("{"{"}{"}"}", item)
        </ForLoop>
      </TestCrate>,
    ).toRenderTo(`
      for item in items.iter() {
          println!("{}", item)
      }
    `);
  });

  it("renders a for loop with tuple destructuring", () => {
    expect(
      <TestCrate>
        <ForLoop pattern="(key, value)" iter="map.iter()">
          println!("{"{"}{"}"}: {"{"}{"}"}", key, value)
        </ForLoop>
      </TestCrate>,
    ).toRenderTo(`
      for (key, value) in map.iter() {
          println!("{}: {}", key, value)
      }
    `);
  });
});

describe("WhileLoop", () => {
  it("renders a while loop", () => {
    expect(
      <TestCrate>
        <WhileLoop condition="count > 0">
          count -= 1
        </WhileLoop>
      </TestCrate>,
    ).toRenderTo(`
      while count > 0 {
          count -= 1
      }
    `);
  });
});

describe("WhileLetLoop", () => {
  it("renders a while let loop", () => {
    expect(
      <TestCrate>
        <WhileLetLoop pattern="Some(val)" expr="stack.pop()">
          println!("{"{"}{"}"}", val)
        </WhileLetLoop>
      </TestCrate>,
    ).toRenderTo(`
      while let Some(val) = stack.pop() {
          println!("{}", val)
      }
    `);
  });
});

describe("Loop", () => {
  it("renders an infinite loop", () => {
    expect(
      <TestCrate>
        <Loop>
          break
        </Loop>
      </TestCrate>,
    ).toRenderTo(`
      loop {
          break
      }
    `);
  });

  it("renders a labeled loop", () => {
    expect(
      <TestCrate>
        <Loop label="outer">
          break 'outer
        </Loop>
      </TestCrate>,
    ).toRenderTo(`
      'outer: loop {
          break 'outer
      }
    `);
  });
});
