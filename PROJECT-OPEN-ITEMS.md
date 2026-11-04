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

Unverified lead: the user noticed `backkend-codegen/reference_project/app/semantic-products*`
and suggested these may be golden samples associated with divergence. Their test
role, origin, and relation to this output were not inspected in this batch. Do not
turn that hypothesis into a historical cause without reading the owning tests and
relevant generation history in a separately authorized scope.

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

## Deferred by the agreed first-batch boundary

- Unified bidirectional query commands, stale-input/code detection and incremental
  regeneration contract are subsequent work, not implemented by project entry.
- Existing apply refuses changed unmarked files. This batch preserves that policy;
  use a fresh owned target for changed-source generation, not an overwrite bypass.
- A full bank application/service walkthrough and two-author manual-area workflow
  are not covered by the domain-generation adaptation test.
- Current project layout is single-context and explicit-profile only; it does not
  infer multi-context identity or external implementations from prose.
