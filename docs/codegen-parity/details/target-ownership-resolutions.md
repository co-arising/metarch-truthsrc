# Target ownership resolutions

Documentation correction only: three resolutions, eight existing logical rows, no new row. The companion [machine corrections](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/details/target-ownership-resolutions.json) contain the proposed replacements; neither partition fragments nor the central document have been changed.

Each patch identifies a row by `id`: `targetPaths` corresponds to `target.paths`, `currentConstructs` clarifies `current.constructs`, and `constructDisposition` replaces the ambiguous member allocation. Reconcile the affected `openDecisions` using `openDecision`. TOR-01 and TOR-03 select **retain**, not the former overall `split` disposition. Logical classifications, catalog identities and assembly owners remain unchanged. Paths beginning `app/` below are exact artifact-path templates relative to an unspecified generated application root; no application destination was created.

Line references are to the frozen emitters listed at the end, not live generators or the whole catalog. These are ownership proposals, not evidence of an executable split, parity or runtime acceptance.

## TOR-01 — one projection resource owner

Affected rows:

- `formal-service/journal-projection/source-runtime`
- `formal-service/journal-handler/ingestion`

**Both rows retain one physical target**:

`app/<basePath>/infrastructure/projection/<Store>Projection.scala`

Do not allocate `<Store>ProjectionLifecycle.scala`, an application-layer Projection replacement, or `<Store>Handler.scala` in this correction. The current class directly owns infrastructure dependencies; retaining its location avoids both a new API and an application-to-infrastructure dependency introduced merely for layout.

### Complete field and method allocation

Every target in this table is inside that one file. “Source” and “handler” identify distinct existing logical rows, not additional resource-owning instances.

| Frozen source | Construct | Sole declaration/body owner |
|---|---|---|
| J:11–24,26,41,43–51,210 | Package, Scala imports, companion/class shells, owner documentation, constructor and non-null check | Source row; `Projection` file/class shell |
| J:47–48 | Borrowed `journal`, `bindings`, `dataSource`; implicit `system`, `ec` | Source row; `Projection` constructor |
| J:30–35 | `Journal.namespace`, `persistenceIds`, `currentEvents`, `events` | Source row; `Projection.Journal` |
| J:52–57 | `namespace` (52), `repository` (53), `materializer` (54), `serialization` (55), `stop` shared kill switch (56), `allowedKinds` (57) | Source row; private fields of `Projection` |
| J:58–66 | `watches` (58), `catchUps` (59), `discovery` (60), `poll` (61), `closed` (62), `initialized` (63), `pendingWork` (64), `drained` (65), `shutdownResult` (66) | Source row; private fields of `Projection` |
| J:68–81 | `tracked` | Source row; `Projection.tracked` |
| J:96–103 | `initialize` | Source row; `Projection.initialize` |
| J:125–156 | `catchUp` | Source row; `Projection.catchUp` |
| J:157 | `invalidate` | Source row; `Projection.invalidate` |
| J:158–168 | `watch` | Source row; `Projection.watch` |
| J:169–176 | `discover` | Source row; `Projection.discover` |
| J:177–192 | `start`, including local `Runnable.run` at 182–188 | Source row; `Projection.start` and its nested body |
| J:193–208 | `shutdown` | Source row; `Projection.shutdown` |
| J:209 | `close` | Source row; `Projection.close` |
| J:27–29 | `Envelope(pid, sequenceNr, event)` and validation | Handler row; `Projection.Envelope` |
| J:36–40 | `Bindings.identity`, `fold`, `indexes` | Handler row; `Projection.Bindings` |
| J:82–88 | `identity` | Handler row; private `Projection.identity` |
| J:89–95 | `payload` | Handler row; private `Projection.payload` |
| J:104–121 | `project`, including the write-session callback | Handler row; `Projection.project` |
| J:122–124 | `read`, including the read-session callback | Handler row; `Projection.read` |

### Handler dependency boundary

There is **no new cross-class interface**. Logical handler methods remain methods of the same resource owner:

- `identity` reads the same `bindings` and `allowedKinds`; `project` validates identity before initialization or SQL.
- `payload` uses the one private `serialization` instance and preserves the GeneratedMessage/Akka bytes and manifest branches.
- `project` calls that owner's `tracked` and `initialize`, then opens **one** `repository.write` callback. `ensureRow`, event lookup, append and `bindings.indexes` use its session; payload conversion and fold remain within the callback. Duplicate events retain byte-equality checks and do not rewrite indexes; contiguous sequence validation remains `Math.addExact`-based.
- `read` uses the same repository/tracking owner but opens its **own read session**, not project's write session. It does not gain an `initialize` call.
- Keep nested tracking, same-PID catch-up reservation and parasitic completions as emitted. Shutdown reuses a cached result or marks closed, cancels polling and shuts down the kill switch, waits for tracked drain, follows the existing initialized Future, and only then invalidates all rows. Keep the configured bounded `close` wait and the existing failure behavior. Do not close the borrowed journal, DataSource or ActorSystem.

**Remaining decision boundary:** only a later explicitly approved API/placement change may extract Handler or lifecycle. It must preserve the serialization owner, initialized Future, transaction session and full tracked lifetime; this correction neither exposes private resources nor designs a generic lifecycle engine.

## TOR-02 — Play declarations are not their references

Affected rows:

- `formal-service/service-composition/factory-contract`
- `formal-service/page-contract/renderer`
- `formal-service/http-controller/actions`
- `formal-service/page-delivery/http-presentation`

### Exact target allocation

| Target | Sole declarations/bodies, with frozen ranges |
|---|---|
| `app/<basePath>/infrastructure/bootstrap/<Service>Composition.scala` | `Composition` and `authority`/`bindings`/`ready` at S:79–83; **`Composition.pages = None` only at S:83**; `Factory.implementation/version/create` at S:84–88; **complete `requireInstalled`** at S:89–92, including `installedPages` and its renderer pin check emitted by P:15–16 |
| `app/<basePath>/infrastructure/connectors/http/<Service>PageRenderer.scala` | Only `PageRenderer` and its `implementation`, `version`, `shell`, `script`, `render(endpointId,status,value)` interface at P:3–9; its `JsValue` type dependency follows the interface |
| `app/controllers/<Service>Controller.scala` | No-pages `invoke`/`action` at S:120–128,132–156; pages-mode **`Response` declaration at P:53**, `failure` at P:59, `invoke` at P:75–83; **complete `action` at P:91–121, including parser P:92–97 and error conversion P:95** |
| `app/controllers/<Service>Pages.scala` | `staticHeaders` at P:56, `htmlHeaders` at P:57, `unavailableHtml` at P:58; `response` at P:60–65; `staticPage` at P:66–74. Preserve embedded CSP/unavailable HTML values originating at P:28–29 |

The `pageRendererRequirement` JavaScript helper is not a separate emitted Scala method. Its statements remain inside the one Composition-owned `requireInstalled`; **no delegated renderer-validation API is selected**.

At P:95, Controller's parser callback constructs the one Controller-owned `Response` from the parser result's status and `invalid-request`, then **calls** Pages-owned `response`. P:119 is another caller of that same rendering body. Pages does not own the parser construction, `left.map` callback, `Response` declaration or `failure` method. Controller does not own the `response` rendering body.

`Composition.pages` references the PageRenderer type, rather than migrating into the PageRenderer file. The existing Components renderer initializer at P:49–52 remains the loader/lifecycle row's responsibility; Pages receives that renderer dependency and does not initialize another one. Route/table/router constructs at P:54–55,84–90,122–130 remain owned by the existing routes row, not redeclared by these corrections.

**Remaining decision boundary:** declaration/body destinations above are settled in this proposal; final Scala nesting, visibility and wiring of currently private `Response`, `Route`, `response`, `staticPage` and the supplied renderer require a later coordinated content change. Do not silently make them public, duplicate them, redesign routes or claim these proposed files already compile. Preserve conditional pages/no-pages behavior, parser limits, status/error conversion, MIME types and security headers.

## TOR-03 — retain the context-authoritative converter

Affected rows:

- `formal-domain/domain-pb-converters/shared` — A ownership
- `formal-domain/exact-wire-po-codecs/shared` — B ownership

**Selected targets are the existing owner and its existing conditional Parts**:

- `app/{basePath}/infrastructure/serialization/DomainConverters.scala`
- `app/{basePath}/infrastructure/serialization/DomainConvertersPart{n}.scala`

This selects the allowed existing-owner option, not a new shared API under `persistence/converters`. Per-aggregate facades/placement, package migration and the proposed `ExactValueCodecs.scala` extraction are deferred.

### Shared nodes and exact member allocation

M:32–45 constructs each nominal/exact node once per context using `byNominal(key(ref))`, before M:46–56 traverses aggregates. Optional, sequence, map and map-entry carriers are nodes in that same graph (M:11–30). R:25–28 groups the output by the existing package mapping. Thus no aggregate gets to redeclare a shared type's converter.

| Construct | Unique declaration location/rule |
|---|---|
| A: all nominal/exact/container/state/event `encode<NodeName>` and `decode<NodeName>` pairs, R:29–32,41–49,56–76 | If the frozen complete text has `string.length <= 60000`, declare each pair once in `DomainConverters.scala` |
| A: those same pairs when text exceeds 60000 | Declare each pair once in `DomainConvertersPart{n}.scala`, where `n` is determined by the unchanged R:84–89 whole-node grouping rule below; the facade inherits them rather than redeclaring them |
| A: package/object/facade/trait/self-type and dependency assembly, R:33,78–94 | Existing `DomainConverters` assembly owns the shells and coordinates the existing file group; renderer currently emits no Scala imports |
| B: private `fixed`/`readExact`, R:34–39 | Retain their declarations in `DomainConverters.scala`, including the facade header in the partitioned branch |
| B: each Part's private helper copies, R:93–94 | Retain each copy in its existing `DomainConvertersPart{n}` lexical scope, even if that Part has no exact node; do not deduplicate or widen access |
| B: `<Type>ToWire`, `FromWire`, `ToPO`, `FromPO`, R:50–55 | Retain each function in the **same file/node group as its exact PB encode/decode pair**: singleton in the small branch, uniquely assigned Part in the large branch |

**Exact Part rule:** use the existing local-node order and whole method groups. Start part 0; start another part when adding the next complete group's content would exceed 48000 characters. A group's existing wire/PO methods count in that group. Never split or duplicate a group. An oversized individual group is not repaired by this correction. The thresholds are JavaScript `string.length`, not UTF-8 byte limits or compilation guarantees.

Cross-Part encode/decode references retain the existing `self: DomainConverters.type` and inherited singleton methods. No per-aggregate converter, shared-type duplicate or new algorithm is introduced. A owns exact **PB** encode/decode; B owns strict text helpers and public **wire/PO** methods, despite their deliberate physical co-location.

**Remaining decision boundary:** FD-ABI, FD-PARTS and FD-CODEC remain explicit. Any future extraction must preserve public FQNs/signatures, protected bytes/regions, nominal identities, PB fields/presence, strict exact text/negative-zero/scale rules, required-field rejection, deterministic map-byte ordering and duplicate-key rejection. Carrier relocation and helper visibility are not decided here. Extend the existing serialization-graph fixture with two aggregates sharing nominal/exact types and carriers, including a cross-Part reference, only in a later authorized implementation; no fixture or execution was added now.

## Frozen evidence and scope

Only the specified workflow findings and relevant partition rows were used, plus these frozen emitter sources:

- **J** — [render-journal-readside.mjs](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs), `renderProjection`, 9–212.
- **S** — [render-service.mjs](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/baseline/js/generators/scala-cqrs-play-service/render-service.mjs), `renderService`, relevant ranges 23,79–92,101–163.
- **P** — [render-service-pages.mjs](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/baseline/js/generators/scala-cqrs-play-service/render-service-pages.mjs), `pageRendererContract`, `pageRendererRequirement`, `renderPageLoader`, 2–18,28–29,30–131.
- **M** — [serialization.mjs](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/baseline/js/generators/scala-cqrs-domain/serialization.mjs), `serializationModel`, 8–61.
- **R** — [render-serialization.mjs](/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/baseline/js/generators/scala-cqrs-domain/render-serialization.mjs), `converterPath` and `renderConverters`, 6,23–96.

Exact workflow JSON pointers and partition row pointers are recorded in the machine file. Both output paths were absent before creation. No fragments, central document, code or other files were modified; no worktree, nested agent/task, tests, typecheck, compilation, generation, runtime or Git operation was used.
