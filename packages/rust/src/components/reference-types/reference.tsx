import { Children } from "@alloy-js/core";

export interface RefProps {
  mutable?: boolean;
  lifetime?: string;
  children: Children;
}

/**
 * A Rust reference type (&T or &mut T).
 */
export function Ref(props: RefProps) {
  const lifetime = props.lifetime ? `'${props.lifetime} ` : "";
  const mut = props.mutable ? "mut " : "";
  return <>&amp;{lifetime}{mut}{props.children}</>;
}

export interface BoxProps {
  children: Children;
}

/**
 * A Rust Box<T> type.
 */
export function Box(props: BoxProps) {
  return <>Box&lt;{props.children}&gt;</>;
}

export interface OptionProps {
  children: Children;
}

/**
 * A Rust Option<T> type.
 */
export function Option(props: OptionProps) {
  return <>Option&lt;{props.children}&gt;</>;
}

export interface VecProps {
  children: Children;
}

/**
 * A Rust Vec<T> type.
 */
export function Vec(props: VecProps) {
  return <>Vec&lt;{props.children}&gt;</>;
}

export interface ResultProps {
  ok: Children;
  err: Children;
}

/**
 * A Rust Result type.
 */
export function Result(props: ResultProps) {
  return <>Result&lt;{props.ok}, {props.err}&gt;</>;
}

export interface ArcProps {
  children: Children;
}

/**
 * A Rust Arc<T> type (atomically reference counted).
 */
export function Arc(props: ArcProps) {
  return <>Arc&lt;{props.children}&gt;</>;
}

export interface RcProps {
  children: Children;
}

/**
 * A Rust Rc<T> type (reference counted).
 */
export function Rc(props: RcProps) {
  return <>Rc&lt;{props.children}&gt;</>;
}

export interface PinProps {
  children: Children;
}

/**
 * A Rust Pin<T> type.
 */
export function Pin(props: PinProps) {
  return <>Pin&lt;{props.children}&gt;</>;
}

export interface MutexProps {
  children: Children;
}

/**
 * A Rust Mutex<T> type.
 */
export function Mutex(props: MutexProps) {
  return <>Mutex&lt;{props.children}&gt;</>;
}

export interface RwLockProps {
  children: Children;
}

/**
 * A Rust RwLock<T> type.
 */
export function RwLock(props: RwLockProps) {
  return <>RwLock&lt;{props.children}&gt;</>;
}

export interface HashSetProps {
  children: Children;
}

/**
 * A Rust HashSet<T> type.
 */
export function HashSet(props: HashSetProps) {
  return <>HashSet&lt;{props.children}&gt;</>;
}

export interface PhantomDataProps {
  children: Children;
}

/**
 * A Rust PhantomData<T> type.
 */
export function PhantomData(props: PhantomDataProps) {
  return <>PhantomData&lt;{props.children}&gt;</>;
}

export interface HashMapProps {
  key: Children;
  value: Children;
}

/**
 * A Rust HashMap\<K, V\> type.
 */
export function HashMap(props: HashMapProps) {
  return <>HashMap&lt;{props.key}, {props.value}&gt;</>;
}

export interface CowProps {
  lifetime?: string;
  children: Children;
}

/**
 * A Rust Cow\<'a, T\> type (clone-on-write).
 */
export function Cow(props: CowProps) {
  const lt = props.lifetime ? `'${props.lifetime}, ` : "";
  return <>Cow&lt;{lt}{props.children}&gt;</>;
}

export interface FutureProps {
  /** Use `dyn` or `impl` trait syntax. Defaults to `impl`. */
  style?: "dyn" | "impl";
  children: Children;
}

/**
 * A Rust Future\<Output = T\> type.
 */
export function Future(props: FutureProps) {
  const style = props.style ?? "impl";
  return <>{style} Future&lt;Output = {props.children}&gt;</>;
}
