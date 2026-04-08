import { ensureLabelTick } from "./label.js";

export interface ContinueExpressionProps {
  label?: string;
}

export function ContinueExpression(props: ContinueExpressionProps) {
  return (
    <>
      {"continue"}
      {props.label ?
        <> {ensureLabelTick(props.label)}</>
      : null}
    </>
  );
}
