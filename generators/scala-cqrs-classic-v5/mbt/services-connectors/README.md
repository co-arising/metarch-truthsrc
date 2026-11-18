# Classic v5 service MBT interface

This owner module implements only `application-service` and `query-service`.
It ports the frozen Scala ApplicationService/QueryService model, builder and
whole-file template contracts. It contains no I/O, CLI, registry mutation,
expected-file lookup, fixture-name selection or complete expected-payload slot.
Main must import the group; this directory does not wire itself into a producer.

## Exports

`index.mjs` exports:

- `buildArtifacts(product, ctx)` — immutable unstamped descriptors, services
  first and queries second, preserving the original metadata array order.
- `buildClassicApplicationService(meta, ctx)` and
  `buildClassicQueryService(meta, ctx)` — detached, deeply frozen models.
- `renderClassicApplicationService(model)` and
  `renderClassicQueryService(model)` — complete source bodies, including original
  comments, placeholders, blank lines and trailing LF bytes, without a stamp.
- `renderClassicQueryStruct(model)` — the original companion DTO renderer.
- `ApplicationServiceModel`, `ApplicationServiceMethodModel`,
  `QueryServiceModel`, `QueryServiceMethodModel` — immutable data constructors.

Separate modules are `models.mjs`, `build-application-service.mjs`,
`build-query-service.mjs`, `application-service-template.mjs`,
`query-service-template.mjs`, and the private pure `scala-set.mjs` collection
compatibility support. Builders reuse the existing FieldDef and ValueObject
builder and the central TypeRef, dependency, import and naming helpers.

## Context contract

These original Scala symbols are consumed through their existing central JS API;
no replacement type resolver or shared patch is supplied:

| Original symbol | Existing JS API | Meaning |
| --- | --- | --- |
| `ctx.layout.application.services.root` | same | Current service package |
| `ctx.layout.application.queries.root` | same | Current query package |
| `TypeResolverDSL.applicationService(String): TypeRef` | `ctx.typeResolver.applicationService(name)` | Original naming and service package |
| `TypeResolverDSL.queryService(String): TypeRef` | `ctx.typeResolver.queryService(name)` | Original naming and query package |
| `TypeResolverDSL.resolve(MetaType/MetaRef): TypeRef` | `ctx.typeResolver.resolve(ref)` | Central typed reference dispatch |
| `TypeResolverDSL.parameterType(MetaType): TypeRef` | `ctx.typeResolver.parameterType(ref)` | Original parameter resolution, without optional wrapping |
| `GeneratorContext.knownFrameworkTypes(String): TypeRef` | `ctx.knownFrameworkTypes[name]` | Inject, Singleton, Timeout, ExecutionContext, Future, ReadModel |

The reused `buildValueObject` also requires the existing
`ctx.typeResolver.valueObject(name)`, `ctx.typeResolver.entityState(name)` and
`ctx.conventions`, including `firstUpper`. Artifact paths use only the central
`classicArtifact(model, render, kind, source, ctx, references)` helper and its
existing `ctx.multiProject` contract. No additional ctx API is required for the
admitted collection domain below.

Descriptors have kinds `application-service` / `query-service` and source
`{ document: product.source.document, pointer: product.source.pointer +
'/application/services/' + i }` or `'/application/queries/' + i`. Their references
also retain method return/parameter/invocation types and query struct field types
that the original builder might filter out of imports. Query structs are not
returned as standalone value-object artifacts.

## Preserved original behavior

- Application methods keep BusinessLogic and invoked commands as model facts,
  but render MANUAL-marked `???`, not the reference-code RHS.
- Query reference code is used only in the AI prompt. Only the original LF
  replacement and Java-style trim occur there; the RHS remains `???`.
- Original descriptions, BusinessLogic invariants and parameter metadata remain
  detached data. Application FieldDefs carry parameter anchors/descriptions;
  query FieldDefs deliberately drop them. Optional/optionalWhen are not applied.
  Neither original service template emits knowledge comments, so this module
  does not add them.
- Query structs reuse the ValueObject builder, but the companion template omits
  defaults, JSON formats, knowledge docs and derived methods. `ReadModel` is
  extended only when that struct's own dependencies contain it.
- Query build removes every dependency named Timeout; its template still imports
  `akka.util.Timeout`. The original direct-model timeout branch remains present.
- Application ActorSystem injection uses `classicSystem: akka.actor.ActorSystem`
  and `classicSystem.toTyped`, with the typed adapter wildcard import retained.
- Structural TypeRef equality is not FQN equality. Imports follow the original
  template-level distinct/filter sequence, then DSL sorting, without a new
  global deduplication pass.
- Scala Set1–Set4 versus HashSet factory transitions, hash-trie payload/child
  iteration, filter compaction and the separate Set[String] maps for constructor
  declarations and prompt dependency names are retained. Injection order is not
  alphabetized or replaced with metadata encounter order.

## Limits and hold boundaries

Type/name admission remains the central classic context's responsibility.
Collection compatibility is limited to ordinary immutable Sets of TypeRefs and
strings without unequal elements sharing a complete improved 32-bit hash. Such a
collision fails closed, rather than guessing the original collision-vector
order. For widening that domain, the exact missing original semantics are
`BitmapIndexedSetNode.concat(that: SetNode[A], shift: Int)` and
`HashCollisionSetNode.concat(that: SetNode[A], shift: Int)`, together with their
collision-node update/iteration behavior; this module does not patch a central
API or claim those cases are supported.

`external-connector-port` and `connector-implementation` remain held as
`ORACLE_NOT_READY`. There are no connector builders/templates or empty-output
acceptance substitutes here.

The independently sealed full F1 baseline and timestamp-int expected files are
read-only inputs for Main's public feedback pipeline, not runtime dependencies
of this module. No generator CLI, tests, typecheck, import-and-call, public byte
comparison or runtime verification is performed by this owner. No verification
PASS, universal parity, runnable code or connector acceptance is claimed.
