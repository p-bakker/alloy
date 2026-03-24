import { describe, expect, it } from "vitest";
import {
  Block,
  For,
  List,
  namekey,
  Output,
  render,
} from "@alloy-js/core";
import * as rust from "@alloy-js/rust";

import {
  api,
  RestApiModel,
  RestApiModelProperty,
  RestApiModelReference,
  RestApiOperation,
} from "../src/schema.js";

function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function mapPropertyType(
  type: RestApiModelProperty["type"],
): string {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "String";
      case "integer":
        return "i32";
      case "float":
        return "f64";
      case "boolean":
        return "bool";
      default:
        return "String";
    }
  }
  if ("ref" in type) {
    const ref = type as RestApiModelReference;
    if (ref.array) {
      return `Vec<${ref.ref}>`;
    }
    return ref.ref;
  }
  return "String";
}

function mapPrimitiveType(type: string): string {
  switch (type) {
    case "string":
      return "String";
    case "integer":
      return "i32";
    case "float":
      return "f64";
    case "boolean":
      return "bool";
    default:
      return "String";
  }
}

function mapResponseType(ref: RestApiModelReference): string {
  if (ref.array) {
    return `Vec<${ref.ref}>`;
  }
  return ref.ref;
}

function renderOutput() {
  const modelKeys = new Map<string, ReturnType<typeof namekey>>();
  for (const model of api.models) {
    modelKeys.set(model.name, namekey(model.name));
  }

  const clientKey = namekey("PetstoreClient");
  const baseUrlFieldKey = namekey("base_url");
  const clientFieldKey = namekey("client");

  const result = render(
    <Output namePolicy={rust.createRustNamePolicy()}>
      <rust.CrateDirectory name="petstore-client" edition="2024">
        <rust.CargoToml
          name="petstore-client"
          version="0.1.0"
          edition="2024"
          dependencies={{
            serde: { version: "1.0", features: ["derive"] },
            reqwest: { version: "0.12", defaultFeatures: false, features: ["json", "rustls-tls"] },
            tokio: { version: "1", features: ["rt-multi-thread", "macros"] },
          }}
        />

        <rust.SourceDirectory path="src">
          <rust.SourceFile path="models.rs">
            <For each={api.models} doubleHardline>
              {(model: RestApiModel) => (
                <>
                  <rust.Derive traits={["Debug", "Clone", "Serialize", "Deserialize"]} />
                  <rust.StructDeclaration name={modelKeys.get(model.name)!} visibility="pub">
                    <List>
                      <For each={model.properties}>
                        {(prop: RestApiModelProperty) => {
                          const rustName = toSnakeCase(prop.name);
                          const needsRename = rustName !== prop.name;
                          return (
                            <rust.StructField
                              name={namekey(prop.name)}
                              type={mapPropertyType(prop.type)}
                              visibility="pub"
                              attributes={needsRename ? `serde(rename = "${prop.name}")` : undefined}
                            />
                          );
                        }}
                      </For>
                    </List>
                  </rust.StructDeclaration>
                </>
              )}
            </For>
          </rust.SourceFile>

          <rust.SourceFile path="client.rs">
            {/* Custom error type */}
            <>
              <rust.Derive traits={["Debug"]} />
              <rust.EnumDeclaration name={namekey("PetstoreError")} visibility="pub">
                <List>
                  <rust.TupleVariant name={namekey("Http")} types={["reqwest::Error"]} />
                  <rust.StructVariant name={namekey("Api")}>
                    <List>
                      <rust.StructField name={namekey("status")} type="u16" />
                      <rust.StructField name={namekey("message")} type="String" />
                    </List>
                  </rust.StructVariant>
                </List>
              </rust.EnumDeclaration>
            </>

            <rust.ImplBlock type="PetstoreError" trait="std::fmt::Display">
              <rust.FunctionDeclaration
                name={namekey("fmt")}
                selfParam="&self"
                parameters={[{ name: namekey("f"), type: "&mut std::fmt::Formatter<'_>" }]}
                returns="std::fmt::Result"
              >
                <rust.MatchExpression expr="self">
                  <rust.MatchArm pattern="PetstoreError::Http(e)">
                    <rust.MacroCall name="write">{"f, \"HTTP error: {}\", e"}</rust.MacroCall>
                  </rust.MatchArm>
                  <rust.MatchArm pattern="PetstoreError::Api { status, message }">
                    <rust.MacroCall name="write">{"f, \"API error ({}): {}\", status, message"}</rust.MacroCall>
                  </rust.MatchArm>
                </rust.MatchExpression>
              </rust.FunctionDeclaration>
            </rust.ImplBlock>

            <rust.ImplBlock type="PetstoreError" trait="std::error::Error">
              <rust.FunctionDeclaration
                name={namekey("source")}
                selfParam="&self"
                returns={"Option<&(dyn std::error::Error + 'static)>"}
              >
                <rust.MatchExpression expr="self">
                  <rust.MatchArm pattern="PetstoreError::Http(e)">Some(e)</rust.MatchArm>
                  <rust.MatchArm pattern="_">None</rust.MatchArm>
                </rust.MatchExpression>
              </rust.FunctionDeclaration>
            </rust.ImplBlock>

            <rust.ImplBlock type="PetstoreError" trait={"From<reqwest::Error>"}>
              <rust.FunctionDeclaration
                name={namekey("from")}
                parameters={[{ name: namekey("err"), type: "reqwest::Error" }]}
                returns="Self"
              >
                PetstoreError::Http(err)
              </rust.FunctionDeclaration>
            </rust.ImplBlock>

            <>
              <rust.Derive traits={["Debug", "Clone"]} />
              <rust.StructDeclaration name={clientKey} visibility="pub">
                <List>
                  <rust.StructField name={baseUrlFieldKey} type="String" />
                  <rust.StructField name={clientFieldKey} type="reqwest::Client" />
                </List>
              </rust.StructDeclaration>
            </>

            <rust.ImplBlock type={clientKey}>
              <rust.FunctionDeclaration
                name={namekey("new")}
                visibility="pub"
                parameters={[
                  { name: baseUrlFieldKey, type: "&str" },
                ]}
                returns={<rust.Result ok={clientKey} err="reqwest::Error" />}
              >
                Ok(<rust.StructExpression type={clientKey}>
                  <List>
                    <rust.StructFieldExpression name={baseUrlFieldKey}>
                      <rust.MemberExpression>
                        <rust.MemberExpression.Part id={baseUrlFieldKey} />
                        <rust.MemberExpression.Part id="trim_end_matches" args={[<>'/'</>]} />
                        <rust.MemberExpression.Part id="to_string" args={[]} />
                      </rust.MemberExpression>
                    </rust.StructFieldExpression>
                    <rust.StructFieldExpression name="client">
                      <rust.MemberExpression>
                        <rust.MemberExpression.Part>reqwest::Client::builder()</rust.MemberExpression.Part>
                        <rust.MemberExpression.Part id="timeout" args={[<>std::time::Duration::from_secs(30)</>]} />
                        <rust.MemberExpression.Part id="build" args={[]} try />
                      </rust.MemberExpression>
                    </rust.StructFieldExpression>
                  </List>
                </rust.StructExpression>)
              </rust.FunctionDeclaration>

              <For each={api.operations} doubleHardline>
                {(op: RestApiOperation) => {
                  const params: { name: ReturnType<typeof namekey>; type: string }[] = [];

                  if (op.requestBody) {
                    params.push({
                      name: namekey("body"),
                      type: `&${op.requestBody.ref}`,
                    });
                  }

                  const pathParams = op.endpoint.match(/:(\w+)/g);
                  if (pathParams) {
                    for (const p of pathParams) {
                      const paramName = p.slice(1);
                      const paramSchemaType = op.pathParams?.[paramName] ?? "string";
                      const rustType = paramSchemaType === "string" ? "&str" : mapPrimitiveType(paramSchemaType);
                      params.push({
                        name: namekey(paramName),
                        type: rustType,
                      });
                    }
                  }

                  const returnType = op.responseBody
                    ? mapResponseType(op.responseBody)
                    : "()";

                  // Build the format! args for URL
                  let formatStr: string;
                  if (pathParams) {
                    const rustPath = op.endpoint.replace(/:(\w+)/g, "{}");
                    const formatArgs = pathParams
                      .map((p) => p.slice(1))
                      .join(", ");
                    formatStr = `"{}${rustPath}", self.base_url, ${formatArgs}`;
                  } else {
                    formatStr = `"{}${op.endpoint}", self.base_url`;
                  }

                  // Build the HTTP request chain
                  const httpRequest = (
                    <rust.MemberExpression>
                      <rust.MemberExpression.Part id="self" />
                      <rust.MemberExpression.Part id="client" />
                      {op.verb === "post"
                        ? <><rust.MemberExpression.Part id="post" args={[<>&url</>]} /><rust.MemberExpression.Part id="json" args={[<>body</>]} /></>
                        : <rust.MemberExpression.Part id="get" args={[<>&url</>]} />
                      }
                      <rust.MemberExpression.Part id="send" args={[]} await try />
                    </rust.MemberExpression>
                  );

                  return (
                    <rust.FunctionDeclaration
                      name={namekey(op.name)}
                      visibility="pub"
                      async
                      selfParam="&self"
                      parameters={params}
                      returns={`Result<${returnType}, PetstoreError>`}
                    >
                      <rust.LetDeclaration name={namekey("url")}>
                        <rust.MacroCall name="format">{formatStr}</rust.MacroCall>
                      </rust.LetDeclaration>
                      <hbr />
                      <rust.LetDeclaration name={namekey("response")}>
                        {httpRequest}
                      </rust.LetDeclaration>
                      <hbr />
                      {`if !response.status().is_success() `}
                      <Block>
                        {`let status = response.status().as_u16();\nlet message = response.text().await.unwrap_or_default();\nreturn Err(PetstoreError::Api { status, message });`}
                      </Block>
                      <hbr />
                      Ok(<rust.MemberExpression>
                        <rust.MemberExpression.Part id="response" />
                        <rust.MemberExpression.Part id="json" args={[]} await try />
                      </rust.MemberExpression>)
                    </rust.FunctionDeclaration>
                  );
                }}
              </For>
            </rust.ImplBlock>

            {/* Static assertions: PetstoreClient is Send + Sync */}
            <rust.ConstDeclaration>
              <Block>
                <List doubleHardline>
                  <rust.FunctionDeclaration
                    name={namekey("assert_send")}
                    typeParameters={[{ name: "T", constraint: "Send" }]}
                  />
                  <rust.FunctionDeclaration
                    name={namekey("assert_sync")}
                    typeParameters={[{ name: "T", constraint: "Sync" }]}
                  />
                  <rust.FunctionDeclaration name={namekey("assert_all")}>
                    <rust.FunctionCall name="assert_send" turbofish="PetstoreClient" args={[]} />;
                    <hbr />
                    <rust.FunctionCall name="assert_sync" turbofish="PetstoreClient" args={[]} />;
                  </rust.FunctionDeclaration>
                </List>
              </Block>
            </rust.ConstDeclaration>
          </rust.SourceFile>

          <rust.SourceFile path="lib.rs">
            <rust.ModDeclaration name="models" visibility="pub" />
            <rust.ModDeclaration name="client" visibility="pub" />

            <rust.PubUse path="crate::models" items={api.models.map((m) => m.name)} />
            <rust.PubUse path="crate::client" items={["PetstoreClient", "PetstoreError"]} />
          </rust.SourceFile>

          <rust.SourceFile path="main.rs">
            <rust.FunctionDeclaration
              name={namekey("main")}
              async
              attributes="tokio::main"
              returns="Result<(), petstore_client::PetstoreError>"
            >
              <rust.LetDeclaration name={namekey("client")}>
                petstore_client::PetstoreClient::new("http://localhost:8080")?
              </rust.LetDeclaration>
              <hbr />
              <rust.LetDeclaration name={namekey("pets")}>
                <rust.MemberExpression>
                  <rust.MemberExpression.Part id="client" />
                  <rust.MemberExpression.Part id="list_pets" args={[]} await try />
                </rust.MemberExpression>
              </rust.LetDeclaration>
              <hbr />
              <rust.MacroCall name="println">{'"Found {} pets", pets.len()'}</rust.MacroCall>;
              <hbr />
              Ok(())
            </rust.FunctionDeclaration>
          </rust.SourceFile>
        </rust.SourceDirectory>
      </rust.CrateDirectory>
    </Output>,
    { tabWidth: 4 },
  );

  return result;
}

function getFileContents(
  dir: ReturnType<typeof render>,
  filePath: string,
): string {
  function search(contents: typeof dir.contents): string | undefined {
    for (const entry of contents) {
      if (entry.kind === "file" && entry.path.endsWith(filePath) && "contents" in entry) {
        return entry.contents;
      }
      if (entry.kind === "directory") {
        const found = search(entry.contents);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }
  const result = search(dir.contents);
  if (result === undefined) {
    throw new Error(`File ${filePath} not found in output`);
  }
  return result;
}

describe("rust-client-emitter", () => {
  const result = renderOutput();

  it("generates Cargo.toml with correct content", () => {
    const cargo = getFileContents(result, "Cargo.toml");
    expect(cargo).toContain('[package]');
    expect(cargo).toContain('name = "petstore-client"');
    expect(cargo).toContain('edition = "2024"');
    expect(cargo).toContain('[dependencies]');
    expect(cargo).toContain('serde');
    expect(cargo).toContain('reqwest');
    expect(cargo).toContain('tokio');
    expect(cargo).not.toContain('serde_json');
  });

  it("generates models.rs with Pet and Toy structs", () => {
    const models = getFileContents(result, "models.rs");
    expect(models).toContain("#[derive(Debug, Clone, Serialize, Deserialize)]");
    expect(models).toContain("pub struct Pet");
    expect(models).toContain("pub name: String");
    expect(models).toContain("pub age: i32");
    expect(models).toContain('#[serde(rename = "favoriteToy")]');
    expect(models).toContain("pub favorite_toy: Toy");
    expect(models).toContain("pub struct Toy");
  });

  it("generates client.rs with PetstoreError enum", () => {
    const client = getFileContents(result, "client.rs");
    expect(client).toContain("pub enum PetstoreError");
    expect(client).toContain("Http(reqwest::Error)");
    expect(client).toContain("Api {");
    expect(client).toContain("impl std::fmt::Display for PetstoreError");
    expect(client).toContain("impl std::error::Error for PetstoreError");
    expect(client).toContain("impl From<reqwest::Error> for PetstoreError");
  });

  it("generates client.rs with PetstoreClient struct and methods", () => {
    const client = getFileContents(result, "client.rs");
    expect(client).toContain("#[derive(Debug, Clone)]");
    expect(client).toContain("pub struct PetstoreClient");
    expect(client).not.toContain("pub base_url:");
    expect(client).toContain("base_url: String");
    expect(client).toContain("client: reqwest::Client");
    expect(client).not.toContain("pub client: reqwest::Client");
    expect(client).toContain("pub fn new(");
    expect(client).toContain("trim_end_matches");
    expect(client).toContain("timeout");
    expect(client).toContain("pub async fn create_pet(");
    expect(client).toContain("pub async fn list_pets(");
    expect(client).toContain("pub async fn get_pet(");
    expect(client).toContain("id: i32");
    expect(client).not.toContain("error_for_status()");
    expect(client).toContain("response.status().is_success()");
    expect(client).toContain("PetstoreError::Api { status, message }");
    expect(client).toContain("PetstoreError");
    // Send + Sync assertions
    expect(client).toContain("assert_send::<PetstoreClient>()");
    expect(client).toContain("assert_sync::<PetstoreClient>()");
  });

  it("generates lib.rs with module declarations and re-exports", () => {
    const lib = getFileContents(result, "lib.rs");
    expect(lib).toContain("pub mod models;");
    expect(lib).toContain("pub mod client;");
    expect(lib).toContain("pub use crate::models::");
    expect(lib).toContain("pub use crate::client::{PetstoreClient, PetstoreError}");
  });

  it("generates main.rs with tokio::main and sample usage", () => {
    const main = getFileContents(result, "main.rs");
    expect(main).toContain("#[tokio::main]");
    expect(main).toContain("async fn main()");
    expect(main).toContain("PetstoreClient::new");
    expect(main).toContain("list_pets");
  });
});
