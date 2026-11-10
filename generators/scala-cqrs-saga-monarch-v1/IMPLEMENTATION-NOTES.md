# Implementation handoff — MODELS

Status: production generator/model/template code and pure tests are written. **Not executed, not Scala-compiled, not qualified.** No Bash, process, test runner, network, Agent or Skill was used. No generated application output was written. B remains partial; the previously reported single restart is not final qualification.

## Entry points and outputs

- `generate.mjs`: `generate({compilation,manifest,options},{implementations,outDir})`. Invokes `planProductSet` once; its normal deterministic double-produce checks remain intact. Compilation is replayed by that gate before rendering. Live capability validation uses shared `implementationBuildInputs`; context getters/prototypes/proxies are rejected without evaluation.
- `build-models.mjs`: `buildModels({products,options})` accepts exactly the eight product payload keys and options `packages/names/sourceRoots`; returns only structural data. It does not fabricate domain-decision/fold/dependency products.
- `resolveSagaMonarchTarget` / `resolveTarget`: pure pre-capture selector accepting `{products,options}` or `{compilation,options}`, returning `{sourceRoots,handwritten}`. This is **not** proof of compilation replay. The same object appears at `buildModels(...).lowered`.
- `render.mjs`: pure `render(model,capturedBuildRoots)` using shared `renderJobs` and `sagaMonarchSourceEntry`. Six Scala artifacts plus build.sbt, project/build.properties and runtime reference.conf. Ext files are never emitted or copied. Source mappings include canonical fields, Saga phase pointers, workflow areas and deployment bindings.

## Implemented finite translation

Nominal request/result types and bounded positive Int quantity; complete typed kernel ports; ten framed binary codecs; full lowered semantic DefinitionDigest and Strict plan framing; typed prepare/commit/compensate bridges with persisted receipt reads; five-result classification and original identity checks; durable association-before-Start; result deliver/query validation; explicit bounded authorized reconciliation; versioned pure and managed-single Run factories/facades; R2 per-area invoke/query/publish/managed-run connectors, original-item conservation, authored batch/resources/timers/budgets/dispositions, query-only verification and whole-group Carry certificate format; typed external-construction root and ActorSystem ownership.

The fixed R2 ABI uses CountOrWait for both normal and compatibility-key batching: the coordinator always groups by original compatibility key; hard minimum is represented by explicit minItems and allowPartialOnClose=false. No invented ByCompatibilityKey runtime constructor is emitted. Carry uses explicit suffix bindings and per-original-owner certificates because an incoming occupancy release is addressed to its original owner, not the downstream operation.

## Integration blockers — MAIN action required

Exact proposals are in `interface-notes.md`. The current public compiler files read in this session do not yet supply `workflow.technical` or a whole-request completion source. Generation **intentionally rejects** those missing shapes; no successful compiler-to-generator plan is claimed.

1. Attach explicit `workflow.technical` with execute/batch-codec-1, connectorPrefix/version, ledgerEpoch, proofFormat. Carry additionally requires explicit reservation/owner suffixes. A technical host-binding row may supply this; workflow author policies stay unchanged.
2. Compile a whole original request completion source as `{kind:"request"}` (or coordinate one explicit renamed shape with this owner). All five result completions map exactly the nominal transaction ID and nominal original request.
3. Supply nominal String aliases for requestId/resource/subject/transactionId, and nominal integer Quantity with positive Int bounds. Quantity is **not** silently rendered as generic Long.
4. This frozen receipt bridge admits one primitive-String reservation-handle output per phase and the complete reference A/B receipt dataflow. Other/nominal receipt shapes fail admission. Managed standalone runs currently admit the frozen `managedSingle` ABI only; mixed/multiple managed stages fail rather than dropping stages. Pure standalone runs retain all ordered steps. These bounds need compiler/scaffold agreement, not a qualification claim.
5. Public workflow compiler currently allows maxActiveItems up to 1000; fixed R2 BatchCodec schema-1 admits only 100. The model rejects >100. MAIN should align the public compiler diagnostic.
6. The uniform terminal disposition cannot represent C/SUBSET-RETRY. The proposed `terminal:{kind:"by-result",cases:[...]}` union is implemented in the local model/template (three exact terminal result cases, unknown held, mixed Carry destinations rejected), but still needs MAIN's author schema/compiler admission. See interface-notes item 7.
7. Public schema/capability/CLI registration, scaffold fixtures, canonical source files, installed checks, oracle identity derivation and behavioral qualification remain with MAIN/REFERENCE owners.

## Exact Scala ABI needed by scaffold implementations

Default names (nominal value names come from actual type refs and may be explicitly overridden):

- `kernel`: CodecIdentity, SagaIdentity, ReservationPhase, PhaseIdentity, ItemIdentity, Association, SagaResult, PrepareReceipt, CommitReceipt, CompensateReceipt, PrepareCommand, CommitCommand, CompensateCommand, ParticipantObservation, ResultEnvelope, ResultReceipt, ItemResult, ManifestResult, ResultObservation, ApplicationPorts, ReservationFacade, BinaryCodec, BinaryCodecs.
- Port trait names come directly from the six canonical port refs. Methods and ApplicationPorts ordering match the frozen reference ABI. Request fields come from the exact host.slots values, not universal warehouse/requestId strings. Result fields come from the canonical nominal result record.
- `glue`: ApplicationSettings, SystemOwnership, RunFactories, CheckedRunFacade. Saga/workflow/root names derive from host/workflow/root identities unless options explicitly bind roles `saga`, `workflow`, `root` on the existing Saga ref. Pipeline ref role `run` names each Run-definition object. Type ref role `value`, port ref role `port`, and Saga-ref protocol support roles are exposed in `model.selectors`.
- Every external constructor is explicit: parameter lists in declared order, optional implicit group included, with input enums directory/resourceA/resourceB/recoveryAuthorization/executionContext. The generated companion `fromExternal` constructs these with root Path/nominal resources/authorization/EC. Each selected provider exposes `.ports: ApplicationPorts`. Root picks role bindings from those providers; no zero-arg or universal callback fallback.
- Run-action workflows add an explicit `Map[String, ExternalOperationPort]`, keyed by exact area IDs, to workflow/root constructors. The map is required only when such areas exist; the two-argument workflow/five-argument root ABI remains for the reference case.
- Settings preserve compiled interaction/recovery policy; caller capacity settings may narrow but not exceed compiled bounds. External name changes require corresponding handwritten implementation updates and fresh capture, never source rewriting by the generator.

## Pending execution by authorized owner

`node --test test/saga-monarch-models.test.mjs` contains ten pure model/template/boundary tests. They use an explicitly uncompiled minimal structural fixture because no Saga/Monarch compilation fixture was available at the known fixture path. They do not treat its rendered text as public-generator, Scala or runtime acceptance. Add/use MAIN's real compilation+capture fixture for successful generate tests and run the independent fixed-supply direct Scala compiler/oracle separately; do not substitute sbt/downloads or golden refresh.

Build declares the fixed three runtime coordinates and records supplied hashes. Resolver configuration is the documented JVM property `truthsrc.repositories` (comma-separated URLs). Actual byte qualification and runtime supply admission remain external. Build absolute source paths come solely from captured build roots; no /Users path is embedded in production templates.
