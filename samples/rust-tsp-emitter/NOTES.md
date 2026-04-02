TODOs

- support using macro_rules_attributes::derive_alias to keep things DRY wrt all the duplicated derives on all the Structs. See https://www.youtube.com/watch?v=xY7lNq0-UU8
- Add an emitter option for field visibility level. Currently all struct fields are generated as `pub`. Should offer `pub(crate)`, `pub(super)`, or private as alternatives. Private fields would require generating constructor functions or builder patterns since struct literal construction wouldn't work from outside the module (serde derive still works regardless of visibility).

Known limitations

- The `validator` crate's `#[validate(range(min = N, max = N))]` only supports inclusive bounds. TypeSpec has both `@minValue`/`@maxValue` (inclusive) and `@minValueExclusive`/`@maxValueExclusive` (exclusive). Currently the `#[validate(range(...))]` attribute uses the exclusive value as-is (treating it as inclusive — approximate), while the hand-written `validate()` method in `validation.rs` handles exclusive correctly using `<=`/`>=`. If the validator crate adds exclusive bound support in the future, update `validatorAttribute()` in `emitter.tsx`.

## TypeSpec versioning — design notes

Docs: https://typespec.io/docs/libraries/versioning/guide/
Reference: https://typespec.io/docs/libraries/versioning/reference/

The `@typespec/versioning` package (separate from `@typespec/compiler`, not currently installed) lets you annotate a single TypeSpec source with version lifecycle metadata instead of maintaining separate definitions per version.

### How versions are defined

```typespec
import "@typespec/versioning";

@versioned(Versions)
namespace PetStore;

enum Versions {
  v1: "2024-01",
  v2: "2024-06",
  v3: "2025-01",
}
```

### Decorators

| Decorator                                      | Purpose                              | Example               |
| ---------------------------------------------- | ------------------------------------ | --------------------- |
| `@versioned(Versions)`                         | Mark namespace as versioned          | Applied to namespace  |
| `@added(Versions.v2)`                          | Type/property introduced in v2       | New field or model    |
| `@removed(Versions.v3)`                        | Type/property removed in v3          | Deprecated field      |
| `@renamedFrom(Versions.v2, "oldName")`         | Property renamed in v2               | `name` was `fullName` |
| `@madeOptional(Versions.v2)`                   | Property became optional in v2       | Required → optional   |
| `@madeRequired(Versions.v2)`                   | Property became required in v2       | Optional → required   |
| `@typeChangedFrom(Versions.v2, oldType)`       | Property type changed in v2          | `string` → `int32`    |
| `@returnTypeChangedFrom(Versions.v2, oldType)` | Operation return type changed        |                       |
| `@useDependency(...)`                          | Cross-namespace version dependencies |                       |

### Two strategies for emitters

**1. Version projection (N versions → N outputs)**

`buildVersionProjections(program, namespace)` returns a `VersionProjection[]`, one per version. Use `projectProgram(program, projections)` to get a `Program` that reflects the API at that specific version — types not yet added are absent, removed types are gone, renames applied, optionality adjusted. The emitter sees a clean single-version snapshot.

Best when the output format maps naturally to separate artifacts per version. For Rust: separate crates, separate feature-gated modules, or separate branches.

**2. Availability map (N versions → 1 annotated output)**

`getAvailabilityMap(program, type)` returns a `Map<string, Availability>` where each version maps to `"Unavailable"` | `"Added"` | `"Available"` | `"Removed"`. This gives the emitter the full timeline for each type/property.

Best when you want a single output annotated with version metadata. Examples: `#[cfg(feature = "v2")]` gates on struct fields, documentation with "added in v2", OpenAPI specs with extension fields.

### Recommendation for Rust

Version projection is the more natural fit for Rust:

- Rust doesn't have runtime version switching
- Cargo features or separate crate versions map well to projected outputs
- Each projected output is clean, standalone Rust code with no version complexity

A possible approach:

1. Iterate over `buildVersionProjections()`
2. For each version, `projectProgram()` to get a clean snapshot
3. Generate a separate module or feature-gated module per version
4. Alternatively, generate entirely separate crates per version

The availability map approach could work with `#[cfg(feature = "v2")]` but makes the generated code harder to read and reason about.

### Not yet implemented

Our emitter doesn't handle versioning at all. The `@typespec/versioning` package would need to be added as a dependency. This is a significant feature — noted here for future planning.

## Namespaces and multi-file TypeSpec projects

### What already works

- **Multi-file input**: `tsp compile` handles `import` statements and gives us a single unified `Program` with everything resolved. The emitter doesn't need to know about file boundaries.
- **Namespace walking**: `collectFromNamespace` recurses into child namespaces, so `PetStore.Models`, `PetStore.Errors`, etc. are all visited.
- **Cross-file type references**: If `Pet` is defined in one `.tsp` file and referenced from another, the `Program` type graph has it linked up. Our `resolveType` follows these references.

### What's broken

1. **Namespace structure is flattened.** All models/enums/unions from all namespaces get dumped into a single flat `TspProgram.models[]` array. A project with `PetStore.Models` and `PetStore.Errors` namespaces produces one flat `models.rs` — it should produce separate Rust modules (`models/`, `errors/`).

2. **No namespace info on extracted types.** `TspModel`, `TspEnum`, `TspUnion` don't record which namespace they came from. Even if we wanted to generate a module structure, we've already lost that information during extraction.

3. **Name collisions.** Two namespaces defining a type with the same name (e.g., `PetStore.V1.Pet` and `PetStore.V2.Pet`) would collide in the flat list and the `namekey` map.

4. **Cross-namespace references are unqualified.** `TspType.ref` only stores the type `name` (e.g., `"Pet"`), not its namespace. This works today because everything lands in one file. With Rust modules, references would need qualified paths (`crate::models::Pet`) or `use` imports.

### Design direction

Make the intermediate representation namespace-aware:

```typescript
interface TspNamespace {
  name: string; // e.g., "Models", "Errors"
  fqn: string; // e.g., "PetStore.Models"
  models: TspModel[];
  enums: TspEnum[];
  unions: TspUnion[];
  children: TspNamespace[]; // nested namespaces
}

interface TspProgram {
  root: TspNamespace; // tree instead of flat lists
  requiredCrates: Set<string>;
}
```

Then the emitter maps the namespace tree to Rust modules:

- `PetStore` → crate root
- `PetStore.Models` → `src/models.rs` (or `src/models/mod.rs`)
- `PetStore.Errors` → `src/errors.rs`
- Nested namespaces → nested module directories

Type references would need to carry the source namespace so the emitter can generate correct `use` paths or qualified names (e.g., `crate::models::Pet` from within `errors.rs`).

### Not yet implemented

The current emitter only works correctly for single-namespace projects. Multi-namespace support requires reworking both `tsp-reader.ts` (namespace-aware extraction) and `emitter.tsx` (namespace-to-module mapping, qualified references).

## User-provided templates for operation/service code generation

### The problem

Generating structs and enums from TypeSpec models is straightforward — there's really only one right answer. But for operations (HTTP routes, service interfaces), everyone wants something different:

- axum vs actix-web vs warp handler signatures
- Trait-based vs function-based service interfaces
- Sync vs async, tower middleware patterns
- Error handling style (anyhow, thiserror, custom Result types)
- Client generation vs server generation vs both

We can't ship one opinionated approach that works for everyone.

### Approaches considered

**Option A: User-provided Alloy components**

Users write Alloy component files that receive typed operation data and produce Rust code using the full `@alloy-js/rust` component API. The emitter loads and invokes them.

- Most flexible — full power of Alloy's component system
- Natural fit — the emitter itself is built this way
- Users need to learn Alloy's API, but it's the same API we use internally
- Contract is a typed interface (`TspOperation`) between emitter and template

**Option B: String templates (Handlebars/Mustache-style)**

Users provide template files with `{{placeholder}}` syntax.

- Lower barrier to entry
- Limited — no conditional logic, no type-aware composition, no access to Alloy's symbol/reference system
- Would likely hit limitations quickly and we'd end up reinventing a component system

**Option C: Presets with configuration**

Ship built-in presets ("axum", "actix-web", "trait-based") selectable via config.

- Easiest for users — just pick a preset
- We have to build and maintain each preset
- Doesn't cover custom/niche frameworks

### Recommendation: Option A, with presets (C) as a later convenience layer

Option A is the easiest to implement and gives the most flexibility. We're already in the Alloy/TSX world — exposing that to users isn't adding a new abstraction, it's opening up what's already there. Presets can be added later as ready-made templates users can reference or fork.

### How it would work

User's project structure:

```
my-api/
  tspconfig.yaml
  main.tsp
  models/
    pet.tsp
  templates/
    axum-handlers.tsx    ← user-written Alloy component
```

Configuration in `tspconfig.yaml`:

```yaml
options:
  rust-tsp-emitter:
    service-template: "./templates/axum-handlers.tsx"
```

The emitter dynamically imports the template and passes extracted operation data into it.

### Template compilation challenge

User `.tsx` files need Alloy's JSX transform (`@alloy-js/babel-preset-alloy`) before they can be imported. Three options:

**1. Require pre-compilation**

User runs `alloy build` on their templates separately; emitter imports the compiled JS. Adds friction — user needs a build step for templates.

**2. Compile on the fly**

Emitter uses the Alloy babel transform at runtime to compile the `.tsx` before importing. Zero friction for the user, but more runtime complexity and magic.

**3. Use STC (static template constructors) instead of JSX**

The Rust package already exports an STC layer (`@alloy-js/rust/stc`). Users write templates as plain TypeScript — no JSX, no compilation needed:

```typescript
import { FunctionDeclaration, ImplBlock } from "@alloy-js/rust/stc";

export function serviceTemplate(operations) {
  return ImplBlock({ type: "MyService" }, [
    ...operations.map((op) =>
      FunctionDeclaration({ name: op.name, async: true, pub: true }, [
        "todo!()",
      ]),
    ),
  ]);
}
```

No JSX compilation needed — it's plain TypeScript that `tsp compile` can already handle via dynamic `import()`. Less pretty than JSX but removes the build step entirely.

### The operation data contract

Regardless of template mechanism, the most important design decision is the **data contract** — what does `TspOperation` look like? This is the API surface between the emitter and user templates. It needs to include:

- Operation name and documentation
- HTTP method and route path (for HTTP operations)
- Parameters with source location (path, query, header, body)
- Request body type (referencing extracted models)
- Response type(s) including error responses
- Authentication requirements
- Metadata (decorators, tags, deprecation)

This contract should be designed carefully — it's the thing that breaks user templates when we change it. But we don't need to nail it perfectly upfront: start minimal, evolve it. If a user needs something we don't extract yet, we could pass the raw TypeSpec `Program` object alongside the structured data as an escape hatch.

### Not yet implemented

Operations are not extracted at all currently. The intermediate representation (`TspProgram`) only has models, enums, and unions. Adding operation support requires:

1. Extracting operations from TypeSpec interfaces
2. Defining the `TspOperation` data contract
3. Implementing the template loading mechanism
4. Deciding between TSX vs STC for user templates

## Beyond HTTP: message bus / event-driven APIs

### TypeSpec's expanding scope

TypeSpec is moving beyond pure HTTP/REST. Relevant packages and specs:

- **`@typespec/events`** — event/message modeling within TypeSpec (built-in namespace `TypeSpec.Events`)
- **`@typespec/streams`** — streaming data modeling (`TypeSpec.Streams`)
- **`@typespec/sse`** — server-sent events (`TypeSpec.SSE`)
- **AsyncAPI** (https://www.asyncapi.com/) — the event-driven counterpart to OpenAPI (OAS). Defines message brokers, channels, message schemas, bindings for Kafka, AMQP, MQTT, WebSocket, etc. There is ongoing work to generate AsyncAPI specs from TypeSpec, similar to how `@typespec/openapi3` generates OpenAPI specs.

The models and types are transport-agnostic — a `Pet` struct is the same whether it's a REST response body or a Kafka message payload. What differs is the operation/service layer: HTTP routes vs message channels/topics.

### Message bus stubs via templates

This is a primary use case for the user-provided template system. A message bus template would generate Rust handler stubs with cross-cutting concerns:

**Validation** — validate incoming message payload against the TypeSpec constraints before processing. We already generate validation for models; a message handler template would call `payload.validate()?` at the entry point.

**Authentication/Authorization** — extract claims from message metadata (JWT tokens, mTLS identity, custom headers), check permissions, reject unauthorized messages. Pattern varies by broker (Kafka headers vs AMQP properties vs NATS subject tokens).

**Error handling** — dead letter queue routing for failed messages, structured error types, retry policies (exponential backoff, max attempts), poison pill detection.

**Observability** — OpenTelemetry tracing spans per message, metrics (messages processed/failed/latency histograms), structured logging with correlation IDs propagated from message headers.

### Example: what a message bus template might generate

Given a TypeSpec definition like:

```typespec
@events namespace PetStore.Events;

model PetCreated { pet: Pet; createdBy: UserId; }
model PetUpdated { pet: Pet; updatedBy: UserId; }
```

A NATS template could generate:

```rust
pub struct PetCreatedHandler { /* nats client, auth, telemetry */ }

impl PetCreatedHandler {
    pub async fn handle(&self, msg: nats::Message) -> Result<(), HandlerError> {
        let span = tracing::info_span!("pet.created", correlation_id = %extract_correlation_id(&msg));
        let _guard = span.enter();

        let claims = self.auth.verify(&msg)?;
        let payload: PetCreated = serde_json::from_slice(&msg.payload)?;
        payload.pet.validate().map_err(HandlerError::Validation)?;

        // TODO: implement business logic
        todo!()
    }
}
```

### Why templates are essential here

The patterns are highly opinionated per project:

- **Broker**: NATS vs Kafka vs RabbitMQ vs Azure Service Bus vs SQS
- **Observability**: OpenTelemetry vs custom metrics vs Datadog/Honeycomb SDKs
- **Auth**: JWT claims, mTLS, custom tokens, shared secrets
- **Error strategy**: DLQ, retry with backoff, circuit breaker, simply log and drop
- **Serialization**: JSON, Protobuf, Avro, MessagePack

But the _shape_ of what the template receives is the same: "here's a message type `PetCreated` with payload `Pet`, on channel `pets.created`, with these auth requirements." The template decides what Rust code to wrap around it.

### Relation to the operation data contract

The `TspOperation` contract (see previous section) would need to be extended or generalized to cover both HTTP and message operations:

- HTTP: method, route, path/query/header params, request/response body
- Messages: channel/topic, message payload type, message headers/metadata, delivery semantics (at-least-once, exactly-once)

Or there could be separate contracts: `TspHttpOperation` and `TspMessageOperation`, sharing common fields (name, doc, auth, payload types) but diverging on transport-specific details. The template system wouldn't care — it receives whichever contract matches the TypeSpec source.
