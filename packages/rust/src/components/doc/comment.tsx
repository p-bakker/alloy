import { List, childrenArray, type Children } from "@alloy-js/core";

export interface DocCommentProps {
  children: Children;
}

/**
 * A Rust doc comment (///). The children are rendered as doc comment lines.
 */
export function DocComment(props: DocCommentProps) {
  return (
    <>
      /// <align string="/// ">{props.children}</align>
    </>
  );
}

export interface LineCommentProps {
  children: Children;
}

/**
 * A Rust line comment (//).
 */
export function LineComment(props: LineCommentProps) {
  return (
    <>
      // <align string="// ">{props.children}</align>
    </>
  );
}

export interface BlockCommentProps {
  children: Children;
}

/**
 * A Rust block comment.
 */
export function BlockComment(props: BlockCommentProps) {
  return (
    <>
      /*
      <hbr />
      <List doubleHardline>{childrenArray(() => props.children)}</List>
      <hbr />
      */
    </>
  );
}

export interface InnerDocCommentProps {
  children: Children;
}

/**
 * A Rust inner doc comment (//!).
 */
export function InnerDocComment(props: InnerDocCommentProps) {
  return (
    <>
      //! <align string="//! ">{props.children}</align>
    </>
  );
}
