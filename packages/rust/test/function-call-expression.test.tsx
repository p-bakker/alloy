import { code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";
import { FunctionCallExpression } from "../src/components/function-call-expression.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

describe("FunctionCallExpression", () => {
  it("renders no-arg calls", () => {
    expect(<FunctionCallExpression target="self.data.len" />).toRenderTo(
      d`self.data.len()`,
    );
  });

  it("renders calls with arguments", () => {
    expect(
      <FunctionCallExpression
        target="self.data.insert"
        args={["key", "entry"]}
      />,
    ).toRenderTo(d`self.data.insert(key, entry)`);
  });

  it("renders turbofish type arguments without call arguments", () => {
    expect(
      <FunctionCallExpression target="collect" typeArgs={["Vec<_>"]} />,
    ).toRenderTo(d`collect::<Vec<_>>()`);
  });

  it("renders turbofish type arguments with call arguments", () => {
    expect(
      <FunctionCallExpression
        target="f"
        typeArgs={["String", "u32"]}
        args={["raw", "10"]}
      />,
    ).toRenderTo(d`f::<String, u32>(raw, 10)`);
  });

  it("wraps multiple arguments across lines", () => {
    expect(
      <FunctionCallExpression
        target="self.data.insert"
        args={[
          "key",
          "entry",
          "Context::new(session_id, metadata, now, source, trace_id, actor)",
        ]}
      />,
    ).toRenderTo(d`
      self.data.insert(
        key,
        entry,
        Context::new(session_id, metadata, now, source, trace_id, actor),
      )
    `);
  });

  describe("rustfmt conformance", () => {
    it("emits a zero-arg call identically to rustfmt", () => {
      const source = toSourceText(
        code`
          fn demo() {
              ${(<FunctionCallExpression target="noop" />)};
          }
        `,
      );

      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("emits a single-arg call that fits on one line", () => {
      const source = toSourceText(
        code`
          fn demo() {
              ${(
                <FunctionCallExpression
                  target="log_event"
                  args={["event"]}
                />
              )};
          }
        `,
      );

      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("emits a single-arg call that wraps when it overflows max_width", () => {
      const source = toSourceText(
        code`
          fn demo() {
              ${(
                <FunctionCallExpression
                  target="some_very_long_function_name_that_pushes_things_wide"
                  args={[
                    "an_argument_with_a_name_long_enough_to_push_the_call_past_one_hundred_cols",
                  ]}
                />
              )};
          }
        `,
      );

      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("emits a multi-arg call that fits on one line", () => {
      const source = toSourceText(
        code`
          fn demo() {
              ${(
                <FunctionCallExpression
                  target="add"
                  args={["first", "second", "third"]}
                />
              )};
          }
        `,
      );

      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("emits a multi-arg call that wraps at max_width with a trailing comma", () => {
      const source = toSourceText(
        code`
          fn demo() {
              ${(
                <FunctionCallExpression
                  target="very_long_function_name"
                  args={[
                    "first_argument_value",
                    "second_argument_value",
                    "third_argument_with_extra_padding_to_push_over_the_limit",
                  ]}
                />
              )};
          }
        `,
      );

      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });
  });
});
