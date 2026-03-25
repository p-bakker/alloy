import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { MemberExpression } from "./member-expression.js";
import { ClosureExpression } from "./closure.js";

describe("MemberExpression", () => {
  it("renders simple member access", () => {
    expect(
      <TestCrate>
        <MemberExpression>
          <MemberExpression.Property id="self" />
          <MemberExpression.Property id="name" />
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
          <MemberExpression.Property id="self" />
          <MemberExpression.Property id="name" />
          <MemberExpression.Method id="chars" args />
          <MemberExpression.Method id="collect" args />
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
          <MemberExpression.Property id="input" />
          <MemberExpression.Method id="parse" args turbofish="i32" />
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
          <MemberExpression.Property id="self" />
          <MemberExpression.Property id="client" />
          <MemberExpression.Method id="post" args={["&url"]} />
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
          <MemberExpression.Property id="client" />
          <MemberExpression.Method id="fetch" args await />
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
          <MemberExpression.Property id="input" />
          <MemberExpression.Method id="parse" args turbofish="i32" try />
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
          <MemberExpression.Property id="client" />
          <MemberExpression.Method id="fetch" args await try />
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
          <MemberExpression.Property id="self" />
          <MemberExpression.Property id="client" />
          <MemberExpression.Method id="get" args={[<>&url</>]} />
          <MemberExpression.Method id="send" args await try />
          <MemberExpression.Method id="error_for_status" args try />
          <MemberExpression.Method id="json" args await try />
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
          <MemberExpression.Property id="people" />
          <MemberExpression.Method id="iter" args />
          <MemberExpression.Method id="map" args={[
            <ClosureExpression params={[{ name: "s" }]}>
              s.to_uppercase()
            </ClosureExpression>
          ]} />
          <MemberExpression.Method id="collect" args />
        </MemberExpression>
      </TestCrate>,
    ).toRenderTo(`
      people.iter().map(|s| s.to_uppercase()).collect()
    `);
  });
});
