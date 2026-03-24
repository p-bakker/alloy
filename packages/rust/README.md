# @alloy-js/rust

Rust language support for [Alloy](https://github.com/alloy-framework/alloy) — a JSX/TypeScript code generation framework.

## Overview

This package provides components, symbols, scopes, and a name policy for generating idiomatic Rust source code. It covers structs, enums, traits, impl blocks, functions, modules, Cargo.toml generation, and expression-level constructs.

## Key Components

### Declarations
- `StructDeclaration`, `StructField` — struct definitions with per-field visibility
- `EnumDeclaration`, `EnumVariant`, `TupleVariant`, `StructVariant` — enum definitions with all variant types
- `TraitDeclaration`, `TraitMethod` — trait definitions with async support
- `ImplBlock` — inherent and trait implementations
- `FunctionDeclaration` — functions with parameters, generics, lifetimes, async/unsafe
- `ConstDeclaration`, `StaticDeclaration`, `LetDeclaration` — variable bindings
- `TypeAlias` — type alias definitions
- `MacroRules`, `MacroCall` — macro definitions and invocations

### Expressions
- `MemberExpression` — flat method chain composition (built on core `createAccessExpression`), supports `await` and `try` props for `.await?` chains
- `StructExpression`, `StructFieldExpression` — struct literal instantiation
- `MatchExpression`, `MatchArm` — pattern matching
- `IfExpression`, `IfLetExpression` — conditional expressions
- `BinaryExpression` — binary operators (`a >= b`, `x + y`, `a && b`)
- `AssignmentStatement` — assignments and compound assignments (`x = 1;`, `count += 1;`)
- `ClosureExpression` — closure syntax
- `ForLoop`, `WhileLoop`, `WhileLetLoop`, `Loop` — loop constructs
- `FunctionCall` — function/method calls with turbofish and `try` support
- `MemberAccess` — simple member access
- `TryExpression` — `?` operator
- `TuplePattern`, `StructPattern`, `SlicePattern`, `RefPattern` — destructuring patterns (usable in `LetDeclaration`/`ConstDeclaration` via the `pattern` prop)

### Module System
- `CrateDirectory`, `SourceDirectory`, `SourceFile` — crate structure
- `ModDeclaration`, `ModBlock` — module declarations
- `PubUse` — re-exports
- `CargoToml`, `CargoWorkspace` — build configuration

### Attributes & Types
- `Attribute`, `InnerAttribute`, `Derive` — attributes with auto-import for known derive macros
- `Cfg`, `CfgAttr` — conditional compilation
- `Ref`, `Box`, `Option`, `Vec`, `Result` — core reference type helpers
- `Arc`, `Rc`, `Pin`, `Mutex`, `RwLock` — concurrency type helpers
- `HashMap`, `HashSet` — collection type helpers
- `Cow`, `PhantomData` — utility type helpers
- `Future` — async type helper (`impl Future<Output = T>` or `dyn Future<Output = T>`)
- `TypeParameters`, `WhereClause`, `Lifetime` — generics

## Auto-Import System

The emitter automatically generates `use` statements for:
- **Intra-crate references** — when a refkey references a type in a sibling module (e.g., `use crate::models::Person;`)
- **Derive macro dependencies** — `#[derive(Serialize, Deserialize)]` auto-generates `use serde::{Serialize, Deserialize};`
- **External crate references** — via the symbol-based reference system

## Core Utility Adoption Status

The `@alloy-js/core` framework provides several reusable utilities. This table tracks which ones the Rust package has adopted:

| Utility | Status | Notes |
|---------|--------|-------|
| `createAccessExpression` | Adopted | Powers `MemberExpression` for method chain composition |
| `createSymbolSlot` | Adopted | Used in `FunctionParameter` to link type symbols |
| `memberRefkey` | Verified compatible | Works with the Rust reference resolver for disambiguating field references across structs (e.g., `Person.name` vs `Pet.name`). Tested but not yet used in samples — currently mitigated by `isImportableDeclaration()` filter. |
| `mapJoin` | Not yet adopted | Would simplify `UseStatements` grouping (std/external/local with blank-line separators). Current manual array approach works but is less reactive. |
| `createContentSlot` | Not adopted | Could replace ternary empty-body checks in `TraitDeclaration`/`ImplBlock`. Current pattern is adequate for Rust's simple cases. |
| `splitProps` / `defaultProps` | Not adopted | Prop decomposition utilities. Rust components are simple enough that manual destructuring suffices. |
| `useBinder` | Not adopted | Direct binder access. Rust uses `resolve()` + `ref()` which covers common cases. |
| `createTap` | Not adopted | Context capture from children. No current use case in the Rust emitter. |

## Samples

- `samples/rust-example/` — comprehensive demo of all emitter features
- `samples/rust-client-emitter/` — realistic Petstore API client generation from a schema
