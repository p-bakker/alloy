import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { MemberExpression } from "./member-expression.js";
import { ClosureExpression } from "./closure.js";

describe("MemberExpression", () => {
  it("renders simple member access", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="self" />
          <MemberExpression.Part id="name" />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      self.name
    `);
  });

  it("renders method call chain", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="self" />
          <MemberExpression.Part id="name" />
          <MemberExpression.Part id="chars" args={[]} />
          <MemberExpression.Part id="collect" args={[]} />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      self.name.chars().collect()
    `);
  });

  it("renders turbofish", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="input" />
          <MemberExpression.Part id="parse" args={[]} turbofish="i32" />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      input.parse::<i32>()
    `);
  });

  it("renders method call with arguments", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="self" />
          <MemberExpression.Part id="client" />
          <MemberExpression.Part id="post" args={["&url"]} />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      self.client.post(&url)
    `);
  });

  it("renders .await suffix", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="client" />
          <MemberExpression.Part id="fetch" args={[]} await />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      client.fetch().await
    `);
  });

  it("renders try operator suffix", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="input" />
          <MemberExpression.Part id="parse" args={[]} turbofish="i32" try />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      input.parse::<i32>()?
    `);
  });

  it("renders .await? suffix", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="client" />
          <MemberExpression.Part id="fetch" args={[]} await try />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      client.fetch().await?
    `);
  });

  it("renders chain with interleaved try operators", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="self" />
          <MemberExpression.Part id="client" />
          <MemberExpression.Part id="get" args={[<>&url</>]} />
          <MemberExpression.Part id="send" args={[]} await try />
          <MemberExpression.Part id="error_for_status" args={[]} try />
          <MemberExpression.Part id="json" args={[]} await try />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      self.client.get(&url).send().await?.error_for_status()?.json().await?
    `);
  });

  it("renders complex chain with closure arg", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Part id="people" />
          <MemberExpression.Part id="iter" args={[]} />
          <MemberExpression.Part id="map" args={[
            <ClosureExpression params={[{ name: "s" }]}>
              s.to_uppercase()
            </ClosureExpression>
          ]} />
          <MemberExpression.Part id="collect" args={[]} />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      people.iter().map(|s| s.to_uppercase()).collect()
    `);
  });
});
