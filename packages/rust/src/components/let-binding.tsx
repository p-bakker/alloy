import type { Children } from "@alloy-js/core";

export interface LetBindingProps {
  name: string;
  mutable?: boolean;
  type?: Children;
  children?: Children;
}

export function LetBinding(props: LetBindingProps) {
  const mut = props.mutable ? "mut " : "";
  const typed =
    props.type !== undefined ? (
      <>
        {": "}
        {props.type}
      </>
    ) : null;

  if (props.children === undefined) {
    return (
      <>
        {"let "}
        {mut}
        {props.name}
        {typed}
        {";"}
      </>
    );
  }

  const gid = Symbol("let-assignment");

  return (
    <group>
      {"let "}
      {mut}
      {props.name}
      {typed}
      {" ="}
      <group id={gid}>
        <indent>
          <line />
        </indent>
      </group>
      <lineSuffixBoundary />
      <indentIfBreak groupId={gid}>{props.children}</indentIfBreak>
      {";"}
    </group>
  );
}
