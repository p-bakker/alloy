import "@alloy-js/core/testing";
import { expect } from "vitest";

import { rustfmt } from "./rustfmt.js";

expect.extend({
  /**
   * Custom matcher: asserts that a Rust source string is unchanged by rustfmt.
   *
   * Usage:
   *   expect(sourceCode).toBeRustfmtIdempotent()
   */
  toBeRustfmtIdempotent(received: string) {
    let formatted: string;
    try {
      // rustfmt always adds a trailing newline; normalize both sides
      formatted = rustfmt(received + "\n").trimEnd();
    } catch (e: any) {
      return {
        pass: false,
        message: () =>
          `rustfmt failed on input:\n${received}\n\nError: ${e.message}`,
      };
    }

    const normalized = received.trimEnd();
    const pass = formatted === normalized;
    return {
      pass,
      message: () => {
        if (pass) {
          return "Expected source to NOT be rustfmt-idempotent, but it was";
        }
        return (
          "Source is not rustfmt-conformant.\n\n" +
          "Expected (rustfmt output):\n" +
          formatted +
          "\n\nReceived (emitter output):\n" +
          received
        );
      },
      expected: formatted,
      actual: normalized,
    };
  },
});

// Augment vitest's type system
declare module "vitest" {
  interface Assertion {
    toBeRustfmtIdempotent(): void;
  }
  interface AsymmetricMatchersContaining {
    toBeRustfmtIdempotent(): void;
  }
}
