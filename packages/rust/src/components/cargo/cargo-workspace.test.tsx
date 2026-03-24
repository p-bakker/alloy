import { Output, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile } from "../../../test/utils.js";
import { CargoWorkspace } from "./cargo-workspace.js";

function renderWorkspaceToml(
  props: Parameters<typeof CargoWorkspace>[0],
): string {
  const res = render(
    <Output>
      <CargoWorkspace {...props} />
    </Output>,
  );
  return findFile(res, "Cargo.toml").contents;
}

describe("CargoWorkspace", () => {
  it("renders a basic workspace with resolver", () => {
    const contents = renderWorkspaceToml({});
    expect(contents).toBe(
      `[workspace]\nresolver = "2"\n`,
    );
  });

  it("renders a workspace with members", () => {
    const contents = renderWorkspaceToml({
      members: ["crates/core", "crates/cli"],
    });
    expect(contents).toContain("[workspace]");
    expect(contents).toContain(`resolver = "2"`);
    expect(contents).toContain(`members = ["crates/core", "crates/cli"]`);
  });

  it("renders a workspace with resolver 1", () => {
    const contents = renderWorkspaceToml({ resolver: "1" });
    expect(contents).toContain(`resolver = "1"`);
  });

  it("renders workspace with shared dependencies", () => {
    const contents = renderWorkspaceToml({
      members: ["crates/core"],
      sharedDependencies: {
        serde: "1.0",
        tokio: { version: "1.28", features: ["full"] },
      },
    });
    expect(contents).toContain("[workspace.dependencies]");
    expect(contents).toContain(`serde = { version = "1.0" }`);
    expect(contents).toContain(
      `tokio = { version = "1.28", features = ["full"] }`,
    );
  });

  it("renders workspace with path dependency", () => {
    const contents = renderWorkspaceToml({
      sharedDependencies: {
        "my-lib": { path: "../my-lib" },
      },
    });
    expect(contents).toContain(
      `my-lib = { path = "../my-lib" }`,
    );
  });
});
