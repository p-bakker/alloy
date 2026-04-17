import { Output, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";
import { CargoTomlFile } from "../src/components/cargo-toml-file.js";
import { CrateDirectory } from "../src/components/crate-directory.js";
import { SourceFile } from "../src/components/source-file.js";
import { createCrate } from "../src/create-crate.js";
import { findFile } from "./utils.js";

describe("CargoTomlFile", () => {
  it("renders package metadata and explicit dependencies with defaults", () => {
    expect(
      <Output>
        <CargoTomlFile
          name="my_crate"
          dependencies={{
            tokio: { version: "1.0", features: ["full"] },
            serde: "1.0",
          }}
        />
      </Output>,
    ).toRenderTo(d`
      [package]
      name = "my_crate"
      version = "0.1.0"
      edition = "2021"

      [dependencies]
      serde = "1.0"
      tokio = { version = "1.0", features = ["full"] }
    `);
  });

  it("merges auto-tracked and explicit dependencies with explicit precedence", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
      },
    });

    const output = render(
      <Output externals={[serde]}>
        <CrateDirectory
          name="consumer"
          includeCargoToml
          dependencies={{
            tokio: "1.42.0",
            serde: { version: "1.0.200", features: ["derive"] },
          }}
        >
          <SourceFile path="lib.rs">type Alias = {serde.Serialize};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "Cargo.toml").contents.trim()).toBe(
      d`
      [package]
      name = "consumer"
      version = "0.1.0"
      edition = "2021"

      [dependencies]
      serde = { version = "1.0.200", features = ["derive"] }
      tokio = "1.42.0"
    `.trim(),
    );
  });

  it("renders deterministic dependency output for tracked crate dependencies", () => {
    const serde = createCrate({
      name: "serde",
      version: "1.0.219",
      items: {
        Serialize: { kind: "trait" },
      },
    });

    const output = render(
      <Output externals={[serde]}>
        <CrateDirectory
          name="consumer"
          version="2.0.0"
          edition="2024"
          includeCargoToml
        >
          <SourceFile path="lib.rs">type Alias = {serde.Serialize};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const cargoToml = findFile(output, "Cargo.toml").contents.trim();
    expect(cargoToml).toBe(
      d`
      [package]
      name = "consumer"
      version = "2.0.0"
      edition = "2024"

      [dependencies]
      serde = "1.0.219"
    `.trim(),
    );

    const secondOutput = render(
      <Output externals={[serde]}>
        <CrateDirectory
          name="consumer"
          version="2.0.0"
          edition="2024"
          includeCargoToml
        >
          <SourceFile path="lib.rs">type Alias = {serde.Serialize};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(secondOutput, "Cargo.toml").contents.trim()).toBe(
      cargoToml,
    );
  });

  it("omits bin section when main.rs is at Cargo default location", () => {
    const output = render(
      <Output>
        <CrateDirectory name="consumer_bin" crateType="bin" includeCargoToml>
          <SourceFile path="main.rs">fn main() {}</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "Cargo.toml").contents.trim()).toBe(
      d`
      [package]
      name = "consumer_bin"
      version = "0.1.0"
      edition = "2021"
    `.trim(),
    );
  });

  it("renders [lib] section for lib crate with non-default sourcePath", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate" sourcePath="." includeCargoToml>
          <SourceFile path="utils.rs">pub fn run() {}</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const cargoToml = findFile(output, "Cargo.toml").contents.trim();
    expect(cargoToml).toContain(["[lib]", 'path = "lib.rs"'].join("\n"));
    expect(cargoToml).not.toContain("[[bin]]");
  });

  it("renders [[bin]] section for bin crate with non-default sourcePath", () => {
    const output = render(
      <Output>
        <CrateDirectory
          name="my_crate"
          crateType="bin"
          sourcePath="."
          includeCargoToml
        >
          <SourceFile path="app.rs">fn main() {}</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const cargoToml = findFile(output, "Cargo.toml").contents.trim();
    expect(cargoToml).toContain(
      ['[[bin]]', 'name = "my_crate"', 'path = "main.rs"'].join("\n"),
    );
    expect(cargoToml).not.toContain("[lib]");
  });

  it("omits dependencies section when no dependencies are present", () => {
    expect(
      <Output>
        <CargoTomlFile name="empty_dependencies" />
      </Output>,
    ).toRenderTo(d`
      [package]
      name = "empty_dependencies"
      version = "0.1.0"
      edition = "2021"
    `);
  });

  it("omits dependencies section when dependencies is an empty object", () => {
    expect(
      <Output>
        <CargoTomlFile name="empty_map" dependencies={{}} />
      </Output>,
    ).toRenderTo(d`
      [package]
      name = "empty_map"
      version = "0.1.0"
      edition = "2021"
    `);
  });

  it("renders dependencies after package section", () => {
    const output = render(
      <Output>
        <CargoTomlFile name="ordering" dependencies={{ serde: "1.0" }} />
      </Output>,
    );

    const cargoToml = findFile(output, "Cargo.toml").contents;
    expect(cargoToml.indexOf("[dependencies]")).toBeGreaterThan(
      cargoToml.indexOf(`edition = "2021"`),
    );
  });
});
