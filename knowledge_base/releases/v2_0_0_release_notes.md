# co-arising 2.0 (`@madpolaris/truthsrc` v2.0.0) Release Notes

> **Release Target**: `v2.0.0 GA`  
> **Runtime Requirements**: Node.js `>= 22.13.0` (zero runtime npm dependencies), Z3 (`z3` on `PATH`), and optionally Scala 2.12/2.13 (`scalac`/`scala` + ScalaTest) for JVM targets.

---

## Highlights

### 1. Orthogonal Bounded-Context Truth & EARS-Native Compiler (`compile-v2`)
- **Orthogonal layout**: `structures/*.yaml` (static nouns, zero `@guard` allowed) · `behaviors/domain/*.ears` (aggregate slices) · `behaviors/application/*.{story,integration}.ears` (user stories & external integration policies) · `bindings/*-effects.yaml` (solution-space S1 protocols & forbidden imports).
- **Static & Formal Gates**: 4 computable domain-boundary gates (closed `enum`/`units`, `externContracts` anti-escape & arity, closed-world story bindings, static type checks), Path-to-Layer enforcement (`V2_PATH_LAYER_MISMATCH`, `V2_LAYER_ACTION_VIOLATION`), `.zh.ears` bilingual drift gate (`V2_BILINGUAL_DRIFT`), Z3 conflict/gap/invariant/dead-rule/BMC checks with A/B Clarification Cards, and DMN First-Hit shadowing & exact boundary witness synthesis.
- **Expressiveness & Projections**: `WHEN event <Aggregate>.<Event>`, application `k`-step pin/replay BMC, `forall`/`exists`, `sum`/`count`/`len`, `is some`/`is none`, `within <dur> [of <ref>]`, hardened multiline YAML parser (`|`/`>`/multiline flow), `file:line:col` caret snippets, and read-only Style E AC + Style B DMN decision table projections.

### 2. Dual-Stack TypeScript + Scala Parity & Anti-Cheat Triple Gate
- **Codegen (`generate-v2`) & Locked Oracles (`emit-tests-v2`)**: Full parity across both `domain` (Channel 4A zero-token L1 + Channel 4B L2 `@cloze`) and `application` (`*Port` + `@cloze` + executable locked BDD oracles) for TypeScript (`node:test`) and Scala (`scalac` + ScalaTest).
- **Cross-Platform Anti-Silent-Skip (`verify-v2 --strict`)**: Probes macOS/Linux/Windows Coursier, Maven, and Ivy2 caches plus `--scala-classpath` / `COARISING_SCALA_CP`; fails loudly in `--strict` / CI mode when required toolchains are missing.
- **First-Class Anti-Cheat Hooks (`guard-write`, `init-hooks`)**: Physically blocks writes to `generated-tests/`, `generated-scaffold/`, `projections/`, and lines outside `@cloze:start..@cloze:end`.

### 3. 100% Full-Coverage Governance & Multi-Protocol S1 Chaos TCK
- **`audit-coverage-v2`**: Enforces zero gray-zone classification (`D1/D2 → E1`, `S1 → E2`, `S2 → E3`, `S3 → E4`), forbidden cross-layer imports, inline shadow markers, and SHA-256-bound E4 human signoff freshness.
- **`run-tck-v2`**: Four built-in S1 fault-injection TCK suites (`three-phase-reconcile`, `transactional-outbox`, `saga-compensation`, `idempotent-consumer`) with both Node ESM and Scala/JVM NDJSON runners.

### 4. Onboarding DX, Derived Task Queue, MCP v2, Skills, Workflow & Editor Support
- **`init-v2` & `check-v2 --strict`**: One-command bounded-context scaffolding and aggregated compile + verify + coverage gate.
- **`tasks-v2`**: Derives `PENDING | STALE | UNVERIFIED | GREEN_NEEDS_REVIEW | VERIFIED` task states directly from `knowledge.sqlite` with automatic dirty invalidation on upstream `.ears` changes and blind-review recording (`--record-review`).
- **Agent & IDE Integration**: 5 v2 tools added to `truthsrc mcp` (`v2_compile`, `v2_query_graph`, `v2_tasks`, `v2_context_pack`, `v2_verify`), cross-platform AGY/Claude Code Skills (`skills/coarising_distill`, `skills/coarising_cloze_worker`), AGY parallel workflow template (`workflows/coarising_cloze_pipeline.py`), VS Code `.ears` TextMate grammar (`editor/ears-vscode/`), and zero-dependency stdio LSP (`truthsrc lsp-ears`).

---

## Explicit Scope Boundaries (Honest Disclosure)

1. **Interaction / UI Layer Spec**: Intentionally deferred from EARS grammar in v2.0.0; presentation/UI code is governed via `S3/E4` (automated E2E + SHA-256-bound human signoff) while inbound HTTP/API contracts remain OpenAPI/IDL.
2. **Legacy v1 Compatibility**: Frozen v1 `bank-wealth-demo` truth (`160` atoms roundtrip, `0` hard issues) and v1 CLI/MCP verbs remain intact; pre-existing v1 `docs/artifacts` catalog drift on `main` is tracked separately from v2.
3. **CI Matrix Validation**: Local verification completed on macOS (Node 22.23.4, Z3, Scala 2.12.20); push/PR triggers Linux (`ubuntu-latest`) + macOS (`macos-latest`) matrix verification via `.github/workflows/co_arising_v2_ci.yml` and `bank-wealth-demo/.github/workflows/v2_pilot_ci.yml` before tagging `v2.0.0`.
