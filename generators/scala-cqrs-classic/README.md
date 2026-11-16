# Classic CQRS aggregate scaffolding

This is the first implemented slice of the traditional Scala generator port. It emits four complete source families through the public product pipeline:

- application protocol (commands, replies and handler alias);
- command helpers;
- aggregate behaviors;
- domain entity (state and events).

It is **scaffolding, not a runnable application profile**. The fixed Scala generator's placeholders, reply-constructor assumptions, duplicate imports and formatting are deliberately retained for byte parity. In particular, F1's original CreditBalance helper replies are not type-correct and its GetBalance behavior contains `???`. Do not deploy this profile or treat byte equality as business acceptance.

## Public entry

Use Node 22.13 or newer. The generator is shipped and registered; it does not load caller-provided JavaScript.

```sh
node /absolute/truthsrc/bin/truthsrc.js generate-products \
  --request /absolute/classic-request.json \
  --generator /absolute/truthsrc/generators/scala-cqrs-classic \
  --out /absolute/new-owned-output \
  --options-json /absolute/classic-options.json
```

`--plan` uses the same admission and rendering but does not apply entries. An actual run uses the existing writer and creates generated source plus `truthsrc.ledger.json` and `anchors.json`. Use a fresh owned output; this profile does not migrate a shared application.

The file request is the existing `truthsrc.product-input-files/v1` contract. Its single requirement is:

```json
{
  "id": "classic-architecture",
  "version": "1",
  "payloadSchemaVersion": "truthsrc.classic-architecture/v1",
  "capabilities": [{ "id": "classic-aggregate-scaffold", "version": "1" }],
  "inputRoles": { "architecture": "classic-system" },
  "requires": []
}
```

The `classic-system` document has `schemaVersion: "truthsrc.classic-architecture-input/v1"` and a `system` field carrying the original `SystemMetadata`. Constructor records preserve original field names and a `_type` discriminator. Scala `None` is null, `Some(value)` is the value, sequences preserve order, and exact noninteger numbers use the exporter's tagged representation. Explicit default values are not inferred. `tools/codegen-parity/ClassicMetadataExport.scala` is an independent source-capture fixture, not a generator or a renderer input derived from output code.

All options must be explicit:

```json
{
  "rootPackage": "net.imadz",
  "frameworkPackage": "net.imadz",
  "moduleName": "banking",
  "generatorVersion": "parity-f1-cc335eb1",
  "knowledgeRelease": null
}
```

`generatorVersion` and `knowledgeRelease` reproduce the selected Scala writer inputs; they are not a claim about this JavaScript implementation's commit. Actual generator/input identities belong in the run evidence. No byte-comparison normalization removes these lines.

## Structure and boundaries

- `lib/classic-architecture/compile.mjs` validates the emitted slice and retains the entire source system. `retained.mjs` validates constructor slots that can enter metadata/owner scanning; unrelated source families are not emitted or certified.
- `types.mjs`, `naming.mjs` and `context.mjs` implement the fixed Scala type/owner semantics. Unknown references are rejected rather than guessed from prose.
- Four dedicated Model/Builder/Template implementations return structural models and original template text. `produce.mjs` owns file framing and maps modeled references to generated paths independently of import filtering.
- `planProductSet` still checks live recompilation, complete footprints, path aliases, local dependency endpoints and independently repeated production. Only the trusted, exact classic scaffold target can retain raw placeholders. Other source profiles remain strict; there is no JSON `allowPlaceholders` switch.
- Metadata facts are not whole-file source strings. Only original named Scala source slots retain their existing source-text exception.
- Initial source associations are file-level. This slice does not claim complete field-level mapping or original author's knowledge/AST/anchor roundtrip acceptance.
- Formal attachments, state-field exclusions, nonempty element-hash rendering and unhandled classic command flows are not admitted. Whole compilation must contain exactly the one classic architecture product. Broader profile support must be explicit, not inferred from a successful F1 run.

## Acceptance

`tools/codegen-parity.mjs` checks predeclared complete inventories and exact bytes of full files. Its `expectedOnly`/`actualOnly` arrays account for other outputs or receipts; they do not count as matching code. A four-file result does not claim the remaining Scala output is ported.

The repair acceptance contract is `docs/codegen-parity/ACCEPTANCE-AND-FEEDBACK-CONTRACT.md`. First obtain strict raw parity; then separately evolve the approved user target and introduce Plain FP/static/property/runtime gates. Do not automatically regenerate expected files to accommodate implementation changes.
