import {
  createOutputBinder,
  getSymbolCreator,
  isRefkey,
  isRefkeyable,
  Output,
  render,
  type Children,
} from "@alloy-js/core";
import { describe, expect, it } from "vitest";

import { CrateDirectory } from "../src/components/crate-directory.js";
import { SourceFile } from "../src/components/source-file.js";
import { useCrateContext } from "../src/context/crate-context.js";
import {
  createCrate,
  getCrateInfo,
  getCrateScope,
} from "../src/create-crate.js";
import { useRustModuleScope } from "../src/scopes/contexts.js";
import type { RustCrateScope } from "../src/scopes/index.js";
import { RustModuleScope } from "../src/scopes/index.js";
import { findFile } from "./utils.js";

interface ScopeCaptureProps {
  onCapture: (moduleScope: RustModuleScope, crateScope: RustCrateScope) => void;
  children?: Children;
}

function ScopeCapture(props: ScopeCaptureProps) {
  const moduleScope = useRustModuleScope();
  const crateScope = useCrateContext()!.scope;
  props.onCapture(moduleScope, crateScope);
  return <>{props.children}</>;
}

function findChildModule(
  scope: RustCrateScope | RustModuleScope,
  name: string,
): RustModuleScope | undefined {
  for (const child of scope.children) {
    if (child instanceof RustModuleScope && child.name === name) {
      return child;
    }
  }
  return undefined;
}

describe("createCrate", () => {
  it("returns root and module-path refkeys and exposes crate info", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
        Deserialize: { kind: "trait" },
        json: {
          to_string: { kind: "function" },
        },
      },
    });

    expect(isRefkey(serde.Serialize)).toBe(true);
    expect(isRefkey(serde.Deserialize)).toBe(true);
    expect(isRefkey(serde.json.to_string)).toBe(true);
    expect(getCrateInfo(serde)).toEqual({ name: "serde", version: "1.0.219" });
  });

  it("creates crate symbols once per binder and maps module hierarchy", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
        json: {
          to_string: { kind: "function" },
        },
      },
    });

    const binder = createOutputBinder();
    getSymbolCreator(serde)(binder);

    const crateScope = getCrateScope(serde, binder)!;
    expect(crateScope).toBeDefined();
    expect(findChildModule(crateScope, "json")).toBeDefined();

    const rootResolution = binder.resolveDeclarationByKey(
      undefined,
      serde.Serialize,
    ).value;
    expect(rootResolution?.symbol.name).toBe("Serialize");

    const jsonResolution = binder.resolveDeclarationByKey(
      undefined,
      serde.json.to_string,
    ).value;
    expect(jsonResolution?.symbol.name).toBe("to_string");
    expect(jsonResolution?.pathDown.map((scope) => scope.name)).toEqual([
      "serde",
      "json",
    ]);

    const jsonModule = findChildModule(crateScope, "json")!;
    expect(jsonModule.values.symbolNames.has("to_string")).toBe(true);

    getSymbolCreator(serde)(binder);
    expect(jsonModule.values.symbolNames.size).toBe(1);
  });

  it("maps root and nested module paths for external references and tracks dependency version", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
        de: {
          Deserializer: { kind: "trait" },
        },
      },
    });

    let consumerModuleScope: RustModuleScope | undefined;
    let consumerCrateScope: RustCrateScope | undefined;

    const output = render(
      <Output externals={[serde]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(capturedModuleScope, capturedCrateScope) => {
                consumerModuleScope = capturedModuleScope;
                consumerCrateScope = capturedCrateScope;
              }}
            >
              type RootAlias = {serde.Serialize};
              <hbr />
              type NestedAlias = {serde.de.Deserializer};
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      [
        "use serde::Serialize;",
        "use serde::de::Deserializer;",
        "type RootAlias = Serialize;",
        "type NestedAlias = Deserializer;",
      ].join("\n"),
    );

    expect(consumerModuleScope).toBeDefined();
    expect(consumerCrateScope).toBeDefined();
    expect(consumerModuleScope!.imports.get("serde")?.size).toBe(1);
    expect(consumerModuleScope!.imports.get("serde::de")?.size).toBe(1);
    expect(consumerCrateScope!.dependencies.get("serde")).toBe("1.0.219");
  });

  it("references builtin crate symbols without tracking Cargo.toml dependencies", () => {
    const std = createCrate({
      name: "std",
      builtin: true,
      items: {
        collections: {
          HashMap: { kind: "struct" },
        },
      },
    });

    let consumerCrateScope: RustCrateScope | undefined;

    const output = render(
      <Output externals={[std]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(_, capturedCrateScope) => {
                consumerCrateScope = capturedCrateScope;
              }}
            >
              type DataMap = {std.collections.HashMap};
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::collections::HashMap;", "type DataMap = HashMap;"].join("\n"),
    );
    expect(consumerCrateScope).toBeDefined();
    expect(consumerCrateScope!.dependencies.has("std")).toBe(false);
  });

  it("creates member symbols and exposes member refkeys on types with members", () => {
    const std = createCrate({
      name: "std",
      builtin: true,
      items: {
        collections: {
          HashMap: {
            kind: "struct",
            members: {
              new: { kind: "function", associated: true },
              insert: { kind: "function" },
              get: { kind: "function" },
              len: { kind: "function" },
            },
          },
        },
      },
    });

    // The type itself is refkeyable (can be passed to <Reference>)
    expect(isRefkeyable(std.collections.HashMap)).toBe(true);
    // Member refkeys are proper refkeys
    expect(isRefkey(std.collections.HashMap.new)).toBe(true);
    expect(isRefkey(std.collections.HashMap.insert)).toBe(true);
    expect(isRefkey(std.collections.HashMap.get)).toBe(true);
    expect(isRefkey(std.collections.HashMap.len)).toBe(true);

    // The type refkey itself should still work for references
    const output = render(
      <Output externals={[std]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type Map = {std.collections.HashMap};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::collections::HashMap;", "type Map = HashMap;"].join("\n"),
    );
  });

  it("skips use-statement for instance-member refkey references", () => {
    const reqwest = createCrate({
      name: "reqwest",
      version: "0.12.0",
      items: {
        RequestBuilder: {
          kind: "struct",
          members: {
            json: { kind: "function" },
          },
        },
      },
    });

    const output = render(
      <Output externals={[reqwest]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">{reqwest.RequestBuilder.json}</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const contents = findFile(output, "src/lib").contents;
    // Parent type isn't imported — it never appears literally at the call site
    expect(contents).not.toContain("use reqwest::RequestBuilder");
  });

  it("collects features from referenced symbols into crate dependencies", () => {
    const tokio = createCrate({
      name: "tokio",
      version: "1.42.0",
      items: {
        runtime: {
          Runtime: { kind: "struct", features: ["rt"] },
        },
        net: {
          TcpStream: { kind: "struct", features: ["net"] },
        },
      },
    });

    let consumerCrateScope: RustCrateScope | undefined;

    render(
      <Output externals={[tokio]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(_, capturedCrateScope) => {
                consumerCrateScope = capturedCrateScope;
              }}
            >
              type A = {tokio.runtime.Runtime}; type B = {tokio.net.TcpStream};
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(consumerCrateScope).toBeDefined();
    const dep = consumerCrateScope!.dependencies.get("tokio");
    expect(dep).toBeDefined();
    expect(typeof dep).toBe("object");
    expect((dep as any).version).toBe("1.42.0");
    expect((dep as any).features).toEqual(
      expect.arrayContaining(["rt", "net"]),
    );
    expect((dep as any).features).toHaveLength(2);
  });

  it("omits features from crate dependency when referenced symbols have none", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
      },
    });

    let consumerCrateScope: RustCrateScope | undefined;

    render(
      <Output externals={[serde]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(_, capturedCrateScope) => {
                consumerCrateScope = capturedCrateScope;
              }}
            >
              type A = {serde.Serialize};
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(consumerCrateScope).toBeDefined();
    const dep = consumerCrateScope!.dependencies.get("serde");
    expect(dep).toBeDefined();
    if (typeof dep === "object") {
      expect(dep).not.toHaveProperty("features");
    }
  });

  it("collects features from instance-member refkeys", () => {
    const reqwest = createCrate({
      name: "reqwest",
      version: "0.12.0",
      items: {
        RequestBuilder: {
          kind: "struct",
          members: {
            json: { kind: "function", features: ["json"] },
          },
        },
      },
    });

    let consumerCrateScope: RustCrateScope | undefined;

    render(
      <Output externals={[reqwest]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(_, capturedCrateScope) => {
                consumerCrateScope = capturedCrateScope;
              }}
            >
              {reqwest.RequestBuilder.json}
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(consumerCrateScope).toBeDefined();
    const dep = consumerCrateScope!.dependencies.get("reqwest");
    expect(dep).toBeDefined();
    expect((dep as any).features).toEqual(["json"]);
  });
});
