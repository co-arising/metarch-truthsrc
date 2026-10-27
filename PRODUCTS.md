# Versioned product admission — canonical and static Saga contracts

This opt-in public contract admits explicit data before a future producer call.
It does **not** enable versioned products in `truthsrc generate`: the legacy
`plan()`/`apply()` path rejects every opted-in manifest with
`PRODUCT_PLAN_UNSUPPORTED`, before loading canonical or importing a generator.
Existing producers retain their `products: {}` context.

## Supported identities

| Layer | Exact identity |
|---|---|
| Declaration schema | `truthsrc.product-requirements/v1` |
| Supplied envelope schema | `truthsrc.product-envelope/v1` |
| Opt-in manifest inputSchema | `truthsrc/v1.0` |
| Canonical product | `canonical`, version string `"1"`, payload `truthsrc/v1` |
| Static Saga product | `saga-contract`, version string `"1"`, payload `truthsrc.saga-ir/v1` |
| Static Saga capability | `{id: "saga-static-contract", version: "1"}` |
| Saga binding input | Exactly one complete `truthsrc.saga-binding/v1` document |

Context map keys are `canonical@1` and `saga-contract@1`. These versions are
independent. Plugin `manifest.version` must be an explicit nonempty string; it
identifies the plugin, not a certified release. Authored Saga definition versions,
codec versions and engine artifact/API pins never substitute for product or
capability versions. No ranges, automatic upgrade or inferred compatibility.

Canonical capabilities remain exactly `[]`. Saga requirements and envelopes must
both carry exactly the singleton static capability above. Unknown, missing,
repeated or wrong-version capabilities fail closed. An engine's `required`
capabilities inside a binding are **host obligations**, not verified runtime
capabilities, and cannot be copied into the product capability list.

The old manifest `products: string[]` vocabulary remains
`template`, `readmodels`, `stories`, `useCases`. It has no implicit mapping to the
new product identities.

## Explicit API

```js
import {
  admitProducts, validateDeclaredProducts,
} from './src/core/products.mjs';
import { compileSagas } from './lib/saga/compile.mjs';

// canonical and sagaBinding are explicit parsed documents supplied by the caller.
// For multiple input files, the caller must explicitly provide a complete binding
// document; admission neither finds files nor merges or filters binding families.
const requirement = {
  id: 'saga-contract', version: '1', payloadSchemaVersion: 'truthsrc.saga-ir/v1',
  capabilities: [{ id: 'saga-static-contract', version: '1' }],
};
const manifest = {
  name: 'my-producer', version: '1.0.0', inputSchema: 'truthsrc/v1.0',
  products: ['template'], artifactKinds: ['summary'], output: {},
  declaredProducts: {
    schemaVersion: 'truthsrc.product-requirements/v1', products: [requirement],
  },
};
const compiled = compileSagas(canonical, sagaBinding);
if (compiled.diagnostics.length) {
  // Report the existing static compiler diagnostics; do not invent an IR.
} else {
  const result = admitProducts({
    manifest, canonical, bindings: [sagaBinding], options: {},
    products: [{
      schemaVersion: 'truthsrc.product-envelope/v1', ...requirement,
      source: { document: 'canonical', pointer: '' }, payload: compiled.ir,
    }],
  });
  // Admission independently recomputes the live complete IR. The candidate's
  // digest, readiness and capabilities are not accepted as authority.
  if (!result.diagnostics.length) {
    const admitted = result.context.products['saga-contract@1'];
  }
}
```

The initialized APIs are synchronous. `validateDeclaredProducts(manifest)` returns
frozen `{requirements, diagnostics}`. No own `declaredProducts` means null
requirements and no new diagnostics; a present null/malformed declaration is not
legacy fallback. It checks supported requirements, **not achieved capabilities**
or the whole legacy manifest. `loadManifest()` retains its existing validation.

`admitProducts(request)` requires exactly five explicit fields: `manifest`,
`canonical`, `bindings`, `products`, `options`. No default bindings, schema,
validator, registry, files, cache, plugin or target lookup is accepted. Options
remain opaque plain-JSON transport, not plugin-option semantic validation.

On success, the recursively frozen `{context, diagnostics: []}` contains detached
manifest/canonical/bindings/options and a null-prototype product map. The map has
only declared, validated products, deterministically ordered by ID. Envelopes are
reconstructed from checked identities and live results. Any failure returns
`{context: null, diagnostics}`; there is no partially admitted prefix.

### Canonical-only compatibility

A canonical declaration uses `id: 'canonical'`, `version: '1'`,
`payloadSchemaVersion: 'truthsrc/v1'`, `capabilities: []`, and an envelope payload
identical to the explicit canonical. With no Saga product declared, bindings must
remain an explicit empty array and nested Saga business payloads stay opaque.
Merely carrying canonical Sagas does not opt into static Saga validation.

The new API requires full canonical transport: `schemaVersion: 'truthsrc/v1'`,
workshop string, and explicit sessions/aggregates/valueObjects/readModels/stories/
domainServices arrays. Known optional collections must have the expected
containers. Unknown authored extras are not stripped, normalized or re-keyed.
The legacy canonical loader still accepts its existing sparse fixtures.

### Static Saga semantics

A valid Saga declaration requires exactly one whole binding document. Zero or
multiple documents fail; the API neither invents an empty binding nor cherry-picks
one Saga. An explicitly empty binding document may close an absent/empty canonical
Saga family, producing the original compiler's empty IR without inventing a Saga.
A binding row without a definition is an orphan; every definition needs a binding.

The product uses the **same complete checker** as `compileSagas`, not a weaker
schema-only test. This includes exact definition versions, aggregate-owned
references, nominal types and bounded type graphs, resource addressing, TCC phase
coverage and availability, confirmation fields, triggers and all result mappings.
A bad member rejects the complete family.

The candidate must equal the entire ordered JSON serialization of the live
`truthsrc.saga-ir/v1`: every field, array order, key order, digest and sourceMap
participates. Reusing an old digest, deleting fields, adding certificates or
changing source hints cannot authorize a stale candidate. The admitted payload
is the detached, recursively frozen **live compiler output**.

`readiness: 'contract-only'` is preserved. Named codecs, implementation modules,
ports, receipts and engine capabilities are declarations, not checked execution
artifacts. Money type admission does not prove decimal conversion, conservation
or funds behavior. Integer quantity admission checks type/bound declarations,
not actual stock sufficiency or arithmetic. Guards, folds, permissions, runtime
fencing and recovery are not certified.

## Source linkage

Both envelopes retain the closed source value
`{document: 'canonical', pointer: ''}`. For `saga-contract@1`, the fixed additional
input linkage is the whole `context.bindings[0]` document. The complete IR keeps its
native `canonical` / singular `binding` source identities:

- IR `binding:/sagas/2/version` resolves to context `bindings:/0/sagas/2/version`.
- IR sourceMap keys, original source ordinals, digest and schema remain unchanged.
- File/atom/path/location values are supplied hints, not authenticated provenance.
  An ancestor's location is its supplied anchor, never an invented child line.

This is explicit document linkage, not a physical-file certificate or complete
semantic dependency graph. Snapshot `/atoms/<i>/doc` pointers remain capture
locations; no `sourceVerified` or generated-code anchors are manufactured.

## Safety and diagnostics

The whole raw request is copied by descriptors before any destructuring. Getters
and Proxy traps are not executed. Only detached data is frozen; caller objects
stay unchanged. Key order and null prototypes are retained. Cycles, accessors,
functions, undefined, nonfinite numbers, sparse arrays, symbols, hidden properties,
nonplain containers and nesting beyond the immutable helper's 128-container bound
are refused. Frozen Map/Set is not immutable JSON transport. The same bounded
copy protects trusted schema constants and the complete output IR/sourceMap.

Diagnostics contain `{code, message, source: {document, pointer}}`. Public document
names are request/manifest/canonical/products/bindings, with RFC 6901 pointers.
Compiler `SAGA_*` diagnostics additionally retain file/atom/path/location hints
and related locations. Only their `binding` document and pointer are translated
to `bindings` and `/0...`; hint paths and the payload's sourceMap are not rewritten.
Results sort deterministically by document, pointer, then code. Unsafe transport
returns one first-error diagnostic; contract checks may report multiple errors.

| Codes | Refusal |
|---|---|
| `PRODUCT_DATA` | Unsafe/non-JSON descriptor, cycle or nesting |
| `PRODUCT_SHAPE`, `PRODUCT_FIELD_REQUIRED`, `PRODUCT_FIELD_UNKNOWN` | Closed contract or explicit fields |
| `PRODUCT_MANIFEST_SHAPE`, `PRODUCT_MANIFEST_ID`, `PRODUCT_MANIFEST_VERSION`, `PRODUCT_INPUT_SCHEMA`, `PRODUCT_DECLARATION_REQUIRED` | Missing/invalid opt-in identity |
| `PRODUCT_REQUIREMENTS_VERSION`, `PRODUCT_REQUIREMENTS_SHAPE` | Requirements schema or array |
| `PRODUCT_UNKNOWN`, `PRODUCT_VERSION`, `PRODUCT_PAYLOAD_SCHEMA`, `PRODUCT_ENVELOPE_VERSION` | Product/schema identity or exact version |
| `PRODUCT_DUPLICATE`, `PRODUCT_MISSING`, `PRODUCT_UNDECLARED`, `PRODUCT_REQUIREMENT_MISMATCH`, `PRODUCT_SUPPLY_SHAPE` | Declaration/supply mismatch |
| `PRODUCT_CANONICAL_VERSION`, `PRODUCT_CANONICAL_SHAPE`, `PRODUCT_PAYLOAD_MISMATCH`, `PRODUCT_SOURCE_MISMATCH` | Canonical transport or complete candidate linkage |
| `PRODUCT_CAPABILITY_SHAPE`, `PRODUCT_CAPABILITY_DUPLICATE`, `PRODUCT_CAPABILITY_UNSUPPORTED`, `PRODUCT_CAPABILITY_MISSING`, `PRODUCT_CAPABILITY_VERSION` | Capability shape, support, presence or exact version |
| `PRODUCT_BINDINGS_SHAPE`, `PRODUCT_BINDINGS_UNSUPPORTED`, `PRODUCT_BINDINGS_COUNT`, `PRODUCT_OPTIONS_SHAPE` | Binding permission/count or transport |
| `SAGA_*` | Existing complete compiler diagnostic; binding pointer mapped to `/0...` |
| `PRODUCT_PLAN_UNSUPPORTED` | Legacy generation cannot deliver new declared products |

Execution/runtime binding schemas, missing fields and unknown binding keys are
refused by the Saga compiler (for example `SAGA_SCHEMA` at
`bindings:/0/schemaVersion`); no automatic conversion is attempted. Internal
schema audit/programming defects are not disguised as successful admission.

## Purity and compatibility boundary

`lib/saga/compile-pure.mjs` holds the original schema-bound checker;
`lib/saga/compile.mjs` preserves the old schema-loading facade and synchronous
`compileSagas` behavior. Its omitted-binding default and detached mutable result
contract remain unchanged. No second checker or schema mirror is maintained.

`lib/saga/product.mjs` loads the sole fixed package JSON schema as a module
 dependency, using dynamic import options for both assertions and attributes.
Module dependency initialization may await; initialized admission calls do not.
`src/core/product-declarations.mjs` is lightweight so manifest/legacy CLI loading
does not initialize the Saga product dependency.

Source and JSON module loading are loader I/O, not request-time filesystem access.
Worker initialization and calls contain no explicit fs, process/argv, clock,
random, subprocess, network, target, cache or plugin access. Tests preload the
complete source graph **and JSON bytes** as data URLs before denying effects and
initializing the worker. Deterministic SHA-256 computation is permitted. Node
loader warnings must not be suppressed or confused with worker logging.

This boundary is not a sandbox against malicious same-process module-cache or
builtin tampering, a multi-file capture transaction or an inter-process lock.

## Remaining work

Execution/runtime products, complete semantic dependency maps, guard/fold/value/
authority admission, plugin mutation/undeclared-access controls, X01-B pure
producers, X01-C admitted dispatch and X01-D integration remain open. Complete
X01-A and bank application/runtime qualification are **not** implied.

P20 returned its earlier shared consumption window; this contract no longer
assumes that old pause is active. New edits still require their own approved scope
and fresh test receipts. Historical green receipts certify their original bytes,
not later changes. Central CODEGEN integration is not part of this slice.
