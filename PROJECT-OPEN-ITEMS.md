# Project-entry open items

Updated 2026-11-04. These are recorded debts, not authorization to expand the
current implementation batch. User requested comparison and recording only for
code style and inline anchors. Do not close them on the strength of project-entry
or file-anchor tests.

## OPEN — JS / BC generated-code style and structure gap

User observation: JS (`metarch-truthsrc`) output still differs substantially from
BC (`backkend-codegen`). User identified `ingested-app` as the useful BC-generated
comparison target. This batch performed only a four-file Scala sample against
four JS entry/render files. No shared application or BC source was modified.

Concrete sample (workspace-relative paths; line numbers at inspection):

| Face | BC-chain sample under `ingested-app/` | JS source template | Observed difference |
|---|---|---|---|
| Protocol | `app/net/imadz/metarch/application/aggregates/ProjectProtocol.scala:24–49,66–79` | `generators/scala-cqrs-domain/render-domain.mjs:28–34` | BC application protocol carries `ActorRef[Reply]`, replies and handler aliases; JS domain protocol groups Command/Event and declared fields. |
| Command handling | `app/net/imadz/metarch/application/aggregates/behaviors/ProjectBehaviors.scala:17–25,39–43` | same render `:36–46,66–70` | BC sample uses `runReplyingPolicy`, `withPost`, `replyWith`; JS domain face separates computation/event helpers and `Either[String, Vector[Event]]` rules. |
| Event handling | `app/net/imadz/metarch/domain/entities/behaviors/ProjectEventHandler.scala:23–26,38–41,57` | same render `:73–91` | BC sample has annotated direct copies and a default unchanged-state case; JS emits typed `nextN` assignments then copy, without that default in this template. |
| State | `app/net/imadz/metarch/domain/entities/ProjectEntity.scala:9–34,96` | same render `:15–21` | BC groups state/empty/event family/handler alias in Entity; JS has a separate State case class and companion. |

These are organization/interface/rendering differences, not merely whitespace.
They are not yet a judgment of which shape is correct. The JS v2 producer also
registers `renderActors` (`generators/scala-cqrs-domain/produce-v2.mjs:1–13`), so
comparing this domain template to BC's application protocol cannot prove that JS
has no actor/reply layer. BC samples also contain long single-line declarations;
“JS single-line versus BC multi-line” is not an accurate overall conclusion.

Source headers on Protocol/Entity identify `CodegenMain:225ed28b` and
`@knowledge-release 1.0.0`; the two handlers identify
`rules_domain_gen:2026-08-23`. This supports BC-chain provenance for these samples,
not a verified claim about all files or their current fingerprint integrity.

Follow-up inspection confirmed `semantic-products*` as separate profile/fixture
golden outputs, not a replacement golden for all of `ingested-app`. Their presence
does not establish the historical cause of style divergence. The unification work
preserves that distinction and does not change templates to resemble BC output.

## OPEN — inline knowledge anchors / source identity continuity

BC samples contain entity/field/parameter/command/event `@knowledge UUID@hash`
annotations and descriptive comments. The inspected JS renderer does not emit
these annotations in source bodies.

The JS v2 entry (`generators/scala-cqrs-domain-v2/generate.mjs:1–6`) uses the shared
producer registry and rendering helpers. `generators/scala-cqrs-domain/naming.mjs:24–27`
constructs `source:<document>#<pointer>` identifiers and returns them in
`knowledgeIds`; source `content` receives only the generated header. This is a
concrete separation between plan metadata and inline source annotations. The v2
path also reuses a body header marked `scala-cqrs-domain:1`; do not infer the actual
selected producer version from that header alone.

Current project-entry tests verify that the core applies those source identities
to root `anchors.json` entries backed by actual file SHA-256 bytes. That does not
supply BC-style in-source anchors or prove UUID/hash identity continuity, symbol
mapping, or semantic correctness.

“Missing server-side ID allocation caused the missing inline anchors” is **not
established**. The local chain already has source coordinates and does not need a
server merely to refer to a source document/pointer. Whether stable identity should
be authored, locally allocated, migrated from existing note IDs, or mapped across
the two systems remains an explicit design/compatibility question. No new IDs were
invented and no server requirement was introduced in this batch.

## OPEN — retry/backoff/deadline execution debt (unchanged)

The authoritative existing debt remains
`../bank-wealth-demo/docs/TRUTHSRC-CONTINUATION.md` §3. Truth-declared attempts,
backoff and deadlines are not fully connected to the strict execution path.
It is not an accepted finite-profile exemption. No runtime repair, rebuild,
publication, journal modification or re-certification was performed. P23 artifacts
and the bank's 1134 bounded release evidence remain frozen.

## Delivered by the authorized unification implementation

The first-batch deferral is superseded by [PROJECT.md](PROJECT.md): recommended
system/context authoring, compatibility import, snapshot source indexing,
`query-project`, `status-project` and opt-in baseline-checked `--update` are now
implemented. Default overwrite refusal remains; update is not a force bypass.
The bank root entry and teaching coverage are described in its `TRUTH.md`; actual
verification is recorded in [PROJECT-UNIFICATION-ACCEPTANCE.md](PROJECT-UNIFICATION-ACCEPTANCE.md).

Still outside the delivered capability: arbitrary multi-context generation,
automatic identity continuity for name-only renames, symbol/span mapping, BC full
generator parity and coordinated BC active-source cutover. Actual BC migration
now reports seven historical origin/payload stage conflicts; see [COMPATIBILITY.md](COMPATIBILITY.md).
They require an author-meaning decision, not automatic normalization. No server ID allocator
is required for existing qualified declarations. Retry and output-style debts
above remain independent OPEN items.
