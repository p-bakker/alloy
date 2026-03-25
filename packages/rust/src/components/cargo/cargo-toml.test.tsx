import { Output, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CargoToml } from "./cargo-toml.js";
import { CrateDirectory } from "../CrateDirectory.js";

function renderCargoToml(props: Parameters<typeof CargoToml>[0]): string {
  const res = render(
    <Output>
      <CargoToml {...props} />
    </Output>,
  );
  return findFile(res, "Cargo.toml").contents;
}

describe("CargoToml", () => {
  it("renders a basic package with name, version, and edition", () => {
    const contents = renderCargoToml({ name: "my-crate" });
    expect(contents).toBe(
      `[package]\nname = "my-crate"\nversion = "0.1.0"\nedition = "2024"\n`,
    );
  });

  it("renders a package with custom version and edition", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      version: "1.0.0",
      edition: "2024",
    });
    expect(contents).toBe(
      `[package]\nname = "my-crate"\nversion = "1.0.0"\nedition = "2024"\n`,
    );
  });

  it("renders a package with authors, description, and license", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      authors: ["Alice <alice@example.com>", "Bob <bob@example.com>"],
      description: "A useful crate",
      license: "MIT",
    });
    expect(contents).toContain(
      `authors = ["Alice <alice@example.com>", "Bob <bob@example.com>"]`,
    );
    expect(contents).toContain(`description = "A useful crate"`);
    expect(contents).toContain(`license = "MIT"`);
  });

  it("renders dependencies with string versions", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        serde: "1.0",
        tokio: "1.28",
      },
    });
    expect(contents).toContain("[dependencies]");
    expect(contents).toContain(`serde = "1.0"`);
    expect(contents).toContain(`tokio = "1.28"`);
  });

  it("renders dependencies with object specs and features", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        serde: { version: "1.0", features: ["derive"] },
        tokio: { version: "1.28", features: ["full"], optional: true },
      },
    });
    expect(contents).toContain("[dependencies]");
    expect(contents).toContain(
      `serde = { version = "1.0", features = ["derive"] }`,
    );
    expect(contents).toContain(
      `tokio = { version = "1.28", features = ["full"], optional = true }`,
    );
  });

  it("renders dev-dependencies", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      devDependencies: {
        "pretty_assertions": "1.3",
      },
    });
    expect(contents).toContain("[dev-dependencies]");
    expect(contents).toContain(`pretty_assertions = "1.3"`);
  });

  it("renders features", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      features: {
        default: ["std"],
        std: [],
        alloc: ["dep:alloc-shim"],
      },
    });
    expect(contents).toContain("[features]");
    expect(contents).toContain(`default = ["std"]`);
    expect(contents).toContain(`std = []`);
    expect(contents).toContain(`alloc = ["dep:alloc-shim"]`);
  });

  it("renders bin targets", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      bin: [
        { name: "my-app", path: "src/main.rs" },
        { name: "my-tool", path: "src/bin/tool.rs" },
      ],
    });
    expect(contents).toContain("[[bin]]");
    expect(contents).toContain(`name = "my-app"`);
    expect(contents).toContain(`path = "src/main.rs"`);
    expect(contents).toContain(`name = "my-tool"`);
    expect(contents).toContain(`path = "src/bin/tool.rs"`);
  });

  it("renders lib target", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      lib: {
        name: "mylib",
        path: "src/lib.rs",
        crateType: ["cdylib", "rlib"],
      },
    });
    expect(contents).toContain("[lib]");
    expect(contents).toContain(`name = "mylib"`);
    expect(contents).toContain(`path = "src/lib.rs"`);
    expect(contents).toContain(`crate-type = ["cdylib", "rlib"]`);
  });

  it("separates sections with blank lines", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: { serde: "1.0" },
      features: { default: ["serde"] },
    });
    // Sections should be separated by double newlines
    expect(contents).toContain("[package]\n");
    expect(contents).toContain("\n\n[dependencies]\n");
    expect(contents).toContain("\n\n[features]\n");
  });

  it("renders a workspace dependency", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        serde: { workspace: true },
      },
    });
    expect(contents).toContain(`serde = { workspace = true }`);
  });

  it("renders a workspace dependency with features", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        serde: { workspace: true, features: ["derive"] },
      },
    });
    expect(contents).toContain(
      `serde = { workspace = true, features = ["derive"] }`,
    );
  });

  it("renders a path dependency", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        "my-lib": { path: "../my-lib" },
      },
    });
    expect(contents).toContain(`my-lib = { path = "../my-lib" }`);
  });

  it("renders a dependency with version and path", () => {
    const contents = renderCargoToml({
      name: "my-crate",
      dependencies: {
        "my-lib": { version: "0.1.0", path: "../my-lib" },
      },
    });
    expect(contents).toContain(
      `my-lib = { version = "0.1.0", path = "../my-lib" }`,
    );
  });

  // --- CrateIdentityContext integration ---

  it("reads name and edition from CrateDirectory context", () => {
    const res = render(
      <Output>
        <CrateDirectory name="ctx-crate" edition="2024">
          <CargoToml version="1.0.0" />
        </CrateDirectory>
      </Output>,
    );
    const contents = findFile(res, "Cargo.toml").contents;
    expect(contents).toContain('name = "ctx-crate"');
    expect(contents).toContain('edition = "2024"');
    expect(contents).toContain('version = "1.0.0"');
  });

  it("allows matching name/edition on both CrateDirectory and CargoToml", () => {
    const res = render(
      <Output>
        <CrateDirectory name="my-crate" edition="2024">
          <CargoToml name="my-crate" edition="2024" />
        </CrateDirectory>
      </Output>,
    );
    const contents = findFile(res, "Cargo.toml").contents;
    expect(contents).toContain('name = "my-crate"');
    expect(contents).toContain('edition = "2024"');
  });

  it("throws on conflicting name between CrateDirectory and CargoToml", () => {
    expect(() =>
      render(
        <Output>
          <CrateDirectory name="crate-a">
            <CargoToml name="crate-b" />
          </CrateDirectory>
        </Output>,
      ),
    ).toThrow(/conflicts with CrateDirectory/);
  });

  it("throws on conflicting edition between CrateDirectory and CargoToml", () => {
    expect(() =>
      render(
        <Output>
          <CrateDirectory name="my-crate" edition="2024">
            <CargoToml edition="2018" />
          </CrateDirectory>
        </Output>,
      ),
    ).toThrow(/conflicts with CrateDirectory/);
  });

  it("throws when no name is available from props or context", () => {
    expect(() =>
      render(
        <Output>
          <CargoToml version="1.0.0" />
        </Output>,
      ),
    ).toThrow(/requires a name/);
  });
});
