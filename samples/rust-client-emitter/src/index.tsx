import {
  Children,
  For,
  List,
  namekey,
  Output,
  render,
  writeOutput,
} from "@alloy-js/core";
import * as rust from "@alloy-js/rust";

import {
  api,
  RestApiModel,
  RestApiModelProperty,
  RestApiModelReference,
  RestApiOperation,
} from "./schema.js";
import { reqwest } from "./crates.js";

// ── Refkeys for model structs ─────────────────────────────────────────────

const modelKeys = new Map<string, ReturnType<typeof namekey>>();
for (const model of api.models) {
  modelKeys.set(model.name, namekey(model.name));
}

const clientKey = namekey("PetstoreClient");
const baseUrlFieldKey = namekey("base_url");
const clientFieldKey = namekey("client");

// ── Helpers ──────────────────────────────────────────────────────────────

function toSnakeCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// ── Helpers to map schema types to Rust types (returning Children) ───────

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

function mapPropertyType(
  type: RestApiModelProperty["type"],
): Children {
  if (typeof type === "string") {
    return mapPrimitiveType(type);
  }
  if ("ref" in type) {
    const ref = type as RestApiModelReference;
    const refKey = modelKeys.get(ref.ref);
    if (!refKey) {
      return ref.ref; // fallback to string if no refkey found
    }
    if (ref.array) {
      return <rust.Vec>{refKey}</rust.Vec>;
    }
    return refKey;
  }
  return "String";
}

function mapResponseType(ref: RestApiModelReference): Children {
  const refKey = modelKeys.get(ref.ref);
  if (!refKey) {
    return ref.ref;
  }
  if (ref.array) {
    return <rust.Vec>{refKey}</rust.Vec>;
  }
  return refKey;
}

function mapRequestBodyType(ref: RestApiModelReference): Children {
  const refKey = modelKeys.get(ref.ref);
  if (!refKey) {
    return `&${ref.ref}`;
  }
  return <rust.Ref>{refKey}</rust.Ref>;
}

// ── Render ────────────────────────────────────────────────────────────────

const output = render(
  <Output namePolicy={rust.createRustNamePolicy()}>
    <rust.CrateDirectory name="petstore-client" edition="2024">
      <rust.CargoToml
        version="0.1.0"
        dependencies={{
          tokio: { version: "1", features: ["rt-multi-thread", "macros"] },
        }}
      />

      <rust.SourceDirectory path="src">
        {/* ── models.rs ─────────────────────────────────────────── */}
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

        {/* ── client.rs ─────────────────────────────────────────── */}
        <rust.SourceFile path="client.rs">
          {/* Custom error type */}
          <>
            <rust.Derive traits={["Debug"]} />
            <rust.EnumDeclaration name={namekey("PetstoreError")} visibility="pub">
              <List>
                <rust.TupleVariant name={namekey("Http")} types={[reqwest.Error]} />
                <rust.StructVariant name={namekey("Api")}>
                  <List>
                    <rust.StructField name={namekey("status")} type="u16" />
                    <rust.StructField name={namekey("message")} type="String" />
                  </List>
                </rust.StructVariant>
              </List>
            </rust.EnumDeclaration>
          </>

          <rust.ImplBlock type="PetstoreError" trait={rust.std.fmt.Display}>
            <rust.FunctionDeclaration
              name={namekey("fmt")}
              selfParam="&self"
              parameters={[{ name: namekey("f"), type: <>{rust.std.fmt.Formatter}{"<'_>"}</>, borrow: true, mut: true }]}
              returns={rust.std.fmt.Result}
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

          <rust.ImplBlock type="PetstoreError" trait={rust.std.error.Error}>
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

          <rust.ImplBlock type="PetstoreError" trait={<rust.From>{reqwest.Error}</rust.From>}>
            <rust.FunctionDeclaration
              name={namekey("from")}
              parameters={[{ name: namekey("err"), type: reqwest.Error }]}
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
                <rust.StructField name={clientFieldKey} type={reqwest.Client} />
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
              returns={<rust.Result ok={clientKey} err={reqwest.Error} />}
            >
              Ok(<rust.StructExpression type={clientKey}>
                <List>
                  <rust.StructFieldExpression name={baseUrlFieldKey}>
                    <rust.MemberExpression>
                      <rust.MemberExpression.Property id={baseUrlFieldKey} />
                      <rust.MemberExpression.Method id="trim_end_matches" args={[<>'/'</>]} />
                      <rust.MemberExpression.Method id="to_string" args />
                    </rust.MemberExpression>
                  </rust.StructFieldExpression>
                  <rust.StructFieldExpression name="client">
                    <rust.MemberExpression>
                      <rust.MemberExpression.Property>{reqwest.Client}::builder()</rust.MemberExpression.Property>
                      <rust.MemberExpression.Method id="timeout" args={[<>std::time::Duration::from_secs(30)</>]} />
                      <rust.MemberExpression.Method id="build" args try />
                    </rust.MemberExpression>
                  </rust.StructFieldExpression>
                </List>
              </rust.StructExpression>)
            </rust.FunctionDeclaration>

            <For each={api.operations} doubleHardline>
              {(op: RestApiOperation) => {
                const params: { name: ReturnType<typeof namekey>; type: Children }[] = [];

                if (op.requestBody) {
                  params.push({
                    name: namekey("body"),
                    type: mapRequestBodyType(op.requestBody),
                  });
                }

                // Extract path parameters like :id
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
                    <rust.MemberExpression.Property id="self" />
                    <rust.MemberExpression.Property id="client" />
                    {op.verb === "post"
                      ? <><rust.MemberExpression.Method id="post" args={[<>&url</>]} /><rust.MemberExpression.Method id="json" args={[<>body</>]} /></>
                      : <rust.MemberExpression.Method id="get" args={[<>&url</>]} />
                    }
                    <rust.MemberExpression.Method id="send" args await try />
                  </rust.MemberExpression>
                );

                return (
                  <rust.FunctionDeclaration
                    name={namekey(op.name)}
                    visibility="pub"
                    async
                    selfParam="&self"
                    parameters={params}
                    returns={<rust.Result ok={returnType} err="PetstoreError" />}
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
                    <rust.Block>
                      {`let status = response.status().as_u16();\nlet message = response.text().await.unwrap_or_default();\nreturn Err(PetstoreError::Api { status, message });`}
                    </rust.Block>
                    <hbr />
                    Ok(<rust.MemberExpression>
                      <rust.MemberExpression.Property id="response" />
                      <rust.MemberExpression.Method id="json" args await try />
                    </rust.MemberExpression>)
                  </rust.FunctionDeclaration>
                );
              }}
            </For>
          </rust.ImplBlock>

          {/* Static assertions: PetstoreClient is Send + Sync */}
          <rust.ConstDeclaration attributes="allow(dead_code)">
            <rust.Block>
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
            </rust.Block>
          </rust.ConstDeclaration>
        </rust.SourceFile>

        {/* ── lib.rs ────────────────────────────────────────────── */}
        <rust.SourceFile path="lib.rs">
          <rust.ModDeclaration name="models" visibility="pub" />
          <rust.ModDeclaration name="client" visibility="pub" />

          <rust.PubUse path="crate::models" items={api.models.map((m) => m.name)} />
          <rust.PubUse path="crate::client" items={["PetstoreClient", "PetstoreError"]} />
        </rust.SourceFile>

        {/* ── main.rs ───────────────────────────────────────────── */}
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
                <rust.MemberExpression.Property id="client" />
                <rust.MemberExpression.Method id="list_pets" args await try />
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

writeOutput(output, "./alloy-output");
