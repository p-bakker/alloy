import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import {
  EnumDeclaration,
  EnumVariant,
  TupleVariant,
  StructVariant,
} from "./declaration.js";

describe("EnumDeclaration", () => {
  it("declares an enum with simple variants", () => {
    expect(
      <TestCrate>
        <EnumDeclaration name="Color">
          <EnumVariant name="Red" />
          <hbr />
          <EnumVariant name="Green" />
          <hbr />
          <EnumVariant name="Blue" />
        </EnumDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      enum Color {
        Red,
        Green,
        Blue,
      }
    `);
  });

  it("declares an enum with tuple variants", () => {
    expect(
      <TestCrate>
        <EnumDeclaration name="IpAddr">
          <TupleVariant name="V4" types={["u8", "u8", "u8", "u8"]} />
          <hbr />
          <TupleVariant name="V6" types={["String"]} />
        </EnumDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      enum IpAddr {
        V4(u8, u8, u8, u8),
        V6(String),
      }
    `);
  });

  it("declares an enum with struct variants", () => {
    expect(
      <TestCrate>
        <EnumDeclaration name="Message">
          <StructVariant name="Move">
            {"x: i32,"}
            <hbr />
            {"y: i32,"}
          </StructVariant>
        </EnumDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      enum Message {
        Move {
          x: i32,
          y: i32,
        },
      }
    `);
  });

  it("declares an enum with mixed variants", () => {
    expect(
      <TestCrate>
        <EnumDeclaration name="Message">
          <EnumVariant name="Quit" />
          <hbr />
          <TupleVariant name="Echo" types={["String"]} />
          <hbr />
          <StructVariant name="Move">
            {"x: i32,"}
            <hbr />
            {"y: i32,"}
          </StructVariant>
        </EnumDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      enum Message {
        Quit,
        Echo(String),
        Move {
          x: i32,
          y: i32,
        },
      }
    `);
  });
});
