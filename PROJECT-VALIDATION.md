# Project entry — first batch validation (2026-11-04)

## Goal and scope

Continuation §5: one local authoring entry for tree + explicit technical choices,
through existing semantic compilation, registered source production, core apply,
and actual-file anchors. This is not the subsequent continuous synchronization or
full bank tutorial batch. Retry remains OPEN. The user additionally requested a
small BC/JS style comparison and recording only; see [PROJECT-OPEN-ITEMS.md](PROJECT-OPEN-ITEMS.md).

## Inputs and workspace state

- Tool repo: branch `execution-compiler-v1`, starting/final HEAD
  `114a327fd451fadf6a4dbe2ddc8d623837aff20a`, plus this uncommitted implementation.
- Node: `v22.23.4`; package and CI baseline now Node >=22.5 / Node 22.
- Bank starting HEAD: `1ee497018d4578dfc33e1a09f830e4fec22e0a08`.
  During work its HEAD independently advanced to
  `0b42e6edbb3f1849d56191a6b08777c5b2a6cce6`; README also became modified.
  This session made no bank edits or commits and did not clean that worktree.
  Each adaptation capture validates and hashes current tree/binding bytes and
  checks them again before apply; HEAD alone is not the source-byte proof.
- Read-only comparison target `ingested-app` HEAD:
  `875e4534a1d02a4dbc078dfac8d064fbda24ac87`; status was clean at final check.
- Tool `.gitignore` acquired `/.rounds` during work outside this batch's owned
  edits. It was preserved and is not claimed as this implementation. Bank's
  dist/target status also changed independently; no cleanup was performed here.
- No remote access, download, service/container launch, shared-app write, runtime
  modification/publication, git commit, merge, tag or push by this session.

## Files changed by this batch

New:

- `PROJECT.md`, `PROJECT-OPEN-ITEMS.md`, `PROJECT-VALIDATION.md`.
- `lib/project/cli.mjs`, `derive.mjs`, `init.mjs`.
- `scaffold/local-project/truthsrc.project.json` and its three-atom Counter tree
  (`workshop.yaml`, Counter aggregate, SetCount slice).
- `test/project-init.test.mjs`, `project-cli.test.mjs`,
  `project-bank-adaptation.test.mjs` (bank test requires explicit opt-in).

Modified:

- `bin/truthsrc.js`: fixed protected project init, compile-project/generate-project.
- `lib/products/generate-cli.mjs`: extracted shared fixed-producer selection and
  captured-request plan admission; legacy formal CLI still uses the same path.
- `lib/value-products/exact-types.mjs`: permits an empty exact family only when
  no decimal declaration exists (including decimals nested in containers).
- `lib/domain-products/{dependencies,external-events}.mjs`: omitted empty optional
  host/external families become empty, while explicit malformed values refuse.
  Missing event production still fails full product compilation.
- `package.json`, `.github/workflows/ci.yml`, `README.md`: Node baseline and local
  executable entry documentation. No generator rendering/style changes.

## Actual commands and results

Commands below run from `metarch-truthsrc` unless an absolute path is shown.
No global Node discovery or paused bank domain-runner was invoked.

### Local entry / existing regressions

```bash
node --test --test-reporter=dot \
  test/project-init.test.mjs test/project-cli.test.mjs \
  test/semantic-product-files.test.mjs test/product-generation-cli.test.mjs \
  test/anchor-query.test.mjs test/generate-anchors.test.mjs \
  test/exact-value-products.test.mjs test/domain-source-derivation.test.mjs \
  test/external-source-derivation.test.mjs \
  test/nominal-text-product-generation-v2.test.mjs \
  test/product-contracts.test.mjs test/product-plan.test.mjs
node bin/truthsrc.js validate --tree scaffold/local-project/tree
node bin/truthsrc.js roundtrip --tree scaffold/local-project/tree
git diff --check
```

Selected regression invocation: exit 0, 168 checks passed. Counter validate:
0 hard / 0 notice; roundtrip: 3 atoms, exit 0. Diff whitespace check: exit 0.
The final combined rerun repeats these selected tests before the bank test.

What this demonstrates, not merely a count:

- `init` refuses existing files/directories/dangling links, handles a fresh owned
  path, and produces a tree that validates/roundtrips without rewriting inputs.
- Public compile/plan/apply consume this same project; plan leaves target absent.
- Actual core apply writes source and four derived evidence files, ledger, and
  anchors whose fingerprints match the actual source bytes. Identical repeat has
  zero source/evidence writes and byte-identical outputs.
- Source defaults and package options change products/plan. Changed unmarked
  existing output is refused before modification, preserving the existing policy.
- Unknown config/flags/versions/technical roles, missing input, symlinks, root and
  case aliases, invalid optional families and missing external production fail.
- Business records named context/kind/owner/id are not mistaken for references;
  actual declaration context conflicts and missing required aggregate context fail.
- Existing strict JSON/product replay/producer/merge/anchor regressions remain green.

### Current bank adaptation

```bash
node bin/truthsrc.js validate --tree ../bank-wealth-demo/v1/tree
node bin/truthsrc.js roundtrip --tree ../bank-wealth-demo/v1/tree
TRUTHSRC_BANK_ROOT=/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo \
  node --test test/project-bank-adaptation.test.mjs
```

Tree validation: exit 0, 0 hard / 34 notices; roundtrip: exit 0, 287 atoms.
Notices remain visible: typed host/value semantics defer to the formal compiler;
Saga surface validity is not execution certification.

First adaptation execution: exit 0; 14 complete products, 157 domain-source plan
entries plus 4 project-evidence entries. It consumes current `v1/tree` and eight
explicit technical bindings under payment/refund/SIP/TA authoring locations;
no historical complete `request.json`, numbered scratch or warm cache is an input.
Exact precision/scale/units/codec identities are explicit bank choices in the test
configuration, not hidden rules in the public implementation. Artifact@3,
saga-host@2 and effect-host@2 match current authored service-bearing contracts.

The test plans without creating the target, applies to a new owned temporary
output, repeats with zero writes, and checks source bytes unchanged. It generates
the domain face for all three aggregates while compiling all 14 products. It does
not generate or build the full bank application/service in this batch.

Final fixed-source combined rerun: **exit 0**. The 168 selected regressions passed,
then bank adaptation passed with 14 products, 157 source files, 297 captured source
records and `runtimeVerified:false`, `historicalCompleteRequest:false`.
Tool byte-set SHA-256 (lib/src/generators/schema/scaffold/bin/package):
`5367e84f0b87fc5b688ce9c49016f2051f5aa3da1e6f52797c536a2d60ebc26c`.
The bank test completed in approximately 222 seconds. Full combined output is in
`/private/tmp/claude-501/-Users-zhongdj-Workspaces-mad-polaris/a405fd8a-ed4d-4529-93f0-7f20b1be1f1e/tasks/b9rnnzlmf.output`
(session-local evidence, not a distributable artifact).

### Failures encountered and disposition

- First test command ran from workspace root and could not find relative test
  paths (exit 1); rerun with tool-repo paths succeeded.
- Initial Counter seven-product test exposed `EXACT_EMPTY` and omitted optional
  family incompatibilities. Fixed narrowly with negative tests retained; no
  invented business facts or patched canonical artifact.
- A later case-alias test initially received the core writer's refusal instead
  of a project-boundary refusal. Project path checks now reject the alias in plan
  as well; final selected regression passes.
- One bank rerun exited 1 with `tool changed before apply` after this session
  edited the plan-envelope schema during the run. No success was claimed for it;
  the source-change guard correctly refused. Fixed-source verification was then
  restarted after tool edits stopped.
- An optional review agent was stopped after it expanded its internal review and
  hit upstream rate limits. This is not a completed independent audit. Concrete
  literal/context/path issues were addressed with focused regression tests.

## Remaining boundary / next entry

Use `PROJECT.md` as the stable first-batch CLI/config contract and the open-items
file for debts. Subsequent work is unified bidirectional queries, freshness and
incremental regeneration before the full bank guide is handed off. Existing
MANUAL/KEEP behavior, exclusive output ownership and non-transactional apply are
unchanged. No symbol/span promise, server ID allocator or automatic retry claim is
added. BC/JS style and inline annotations are recorded only, as requested.
