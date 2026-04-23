import type { Refkey, RefkeyableObject } from "@alloy-js/core";

import type { VariantComponent } from "../components/variant.js";
import { std } from "./std/index.js";

type PreludeRef = Refkey | RefkeyableObject | VariantComponent;

/**
 * Refkeys / variant components for every item in Rust's standard prelude
 * (union of v1, rust_2021, and rust_2024 editions).
 *
 * Maps each prelude item to its `std.*` refkey. Rendering is automatic:
 * under a later edition where the item is in the prelude, references
 * emit bare (no `use`); under an earlier edition, the reference system
 * emits a `use` statement. Under `#![no_std]`, the emitted path swaps
 * to the symbol's canonical crate (`alloc` / `core`) — see
 * `canonicalCrate` metadata on the generated std descriptors.
 *
 * Items not in Rust's actual prelude (e.g. Debug, Display, HashMap)
 * are NOT included here — reach for them via `std.fmt.Debug`,
 * `std.collections.HashMap`, etc.
 *
 * Macros in the prelude (assert!, println!, etc.) are not exposed
 * here; use them via `std.*` / `core.*` directly.
 */
export const prelude = {
  // Marker traits
  Copy: std.marker.Copy,
  Send: std.marker.Send,
  Sized: std.marker.Sized,
  Sync: std.marker.Sync,
  Unpin: std.marker.Unpin,

  // Ops traits
  Drop: std.ops.Drop,
  Fn: std.ops.Fn,
  FnMut: std.ops.FnMut,
  FnOnce: std.ops.FnOnce,
  AsyncFn: std.ops.AsyncFn,
  AsyncFnMut: std.ops.AsyncFnMut,
  AsyncFnOnce: std.ops.AsyncFnOnce,

  // mem functions
  drop: std.mem.drop,
  align_of: std.mem.align_of,
  align_of_val: std.mem.align_of_val,
  size_of: std.mem.size_of,
  size_of_val: std.mem.size_of_val,

  // Comparison traits
  PartialEq: std.cmp.PartialEq,
  Eq: std.cmp.Eq,
  PartialOrd: std.cmp.PartialOrd,
  Ord: std.cmp.Ord,

  // Conversion (TryFrom/TryInto added in 2021 prelude)
  AsMut: std.convert.AsMut,
  AsRef: std.convert.AsRef,
  From: std.convert.From,
  Into: std.convert.Into,
  TryFrom: std.convert.TryFrom,
  TryInto: std.convert.TryInto,

  // Iteration (FromIterator added in 2021 prelude)
  DoubleEndedIterator: std.iter.DoubleEndedIterator,
  ExactSizeIterator: std.iter.ExactSizeIterator,
  Extend: std.iter.Extend,
  IntoIterator: std.iter.IntoIterator,
  Iterator: std.iter.Iterator,
  FromIterator: std.iter.FromIterator,

  // Future (added in 2024 prelude)
  Future: std.future.Future,
  IntoFuture: std.future.IntoFuture,

  // Clone / Default
  Clone: std.clone.Clone,
  Default: std.default.Default,

  // Option + variants
  Option: std.option.Option,
  Some: std.option.Option.Some,
  None: std.option.Option.None,

  // Result + variants
  Result: std.result.Result,
  Ok: std.result.Result.Ok,
  Err: std.result.Result.Err,

  // alloc-origin items
  ToOwned: std.borrow.ToOwned,
  Box: std.boxed.Box,
  String: std.string.String,
  ToString: std.string.ToString,
  Vec: std.vec.Vec,
} as const satisfies Record<string, PreludeRef>;
