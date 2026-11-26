# co-arising 2.0 Quickstart Guide

> **Prerequisites**: Node.js `>= 22.13`, Z3 SMT solver (`z3` on `PATH`), and optionally Scala 2.12/2.13 (`scalac`/`scala` + ScalaTest jars) for dual-stack JVM verification.

---

## 1. Install Prerequisites

- **macOS**:
  ```bash
  brew install z3
  # Optional for Scala target:
  brew install scala@2.12 coursier/formulas/coursier
  export COARISING_SCALA_CP="$(cs fetch -p org.scalatest:scalatest-funsuite_2.12:3.2.19)"
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt-get update && sudo apt-get install -y z3
  # Optional for Scala target:
  sudo apt-get install -y scala
  ```
- **Windows**:
  ```powershell
  winget install Microsoft.Z3
  ```

---

## 2. Scaffold a Bounded Context in One Command

```bash
truthsrc init-v2 my-service --system my-svc --context quota --target typescript,scala --package example.quota
```

This creates the orthogonal co-arising 2.0 layout:

```text
my-service/
├── truthsrc.v2.json
├── truth/quota/
│   ├── structures/quota.yaml                 # Static nouns: exactTypes, valueObjects, aggregates, ports, stories, externContracts
│   ├── behaviors/
│   │   ├── domain/quota-bucket-reserve.ears  # Pure domain aggregate behavior (Channel 4A L1 zero-token or Channel 4B L2)
│   │   └── application/
│   │       └── quota-intake.story.ears       # Application user story (*.story.ears) or external policy (*.integration.ears)
│   └── bindings/quota-effects.yaml           # Solution-space S1 effect protocols & forbidden cross-layer import rules
├── governance/coverage-manifest.json         # 100% file classification (D1/D2 -> E1, S1 -> E2, S2 -> E3, S3 -> E4)
├── generated-scaffold/                       # Compiler-owned (read-only)
├── generated-tests/                          # SHA-256 locked executable BDD oracles (read-only)
├── handwritten/                              # Bounded @cloze:start(<id>)..@cloze:end(<id>) isolation zones
└── .claude/settings.json                     # PreToolUse (guard-write) & Stop (verify-v2 --strict) anti-cheat hooks
```

---

## 3. Run the Single-Command Verification Gate

```bash
truthsrc check-v2 --root my-service --strict --format human
```

`check-v2` executes three stages in order and exits `2` on any failure:
1. **`compile-v2`**: Parses structures + `.ears`, runs 4 strict domain-boundary gates, Path-to-Layer gate, bilingual `.zh.ears` drift check, Z3 conflict/gap/invariant/dead-rule/BMC checks, and First-Hit witness synthesis.
2. **`verify-v2 --strict`**: Verifies SHA-256 manifest integrity on `generated-tests/`, executes live TS (`node --test`) and Scala (`scalac` + ScalaTest) locked BDD oracles without silent skips, and reconciles `@ProvenanceId` / `@CoArisingSpec` / `@cloze` anchors into SQLite.
3. **`audit-coverage-v2`**: Verifies 100% file coverage across `governedRoots`, forbidden cross-layer imports, inline shadow markers, and E4 human-signoff SHA-256 freshness.

---

## 4. Iterative Authoring Workflow

1. **Edit truth** in `structures/*.yaml` or `behaviors/{domain,application}/*.ears`.
2. **Sync scaffolds & locked tests** (non-destructive on existing `@cloze` files):
   ```bash
   truthsrc check-v2 --root my-service --sync --strict --format human
   ```
3. **Generate PM / Business Projections** (read-only Style E AC & Style B DMN tables):
   ```bash
   truthsrc compile-v2 --structures my-service/truth/quota/structures --behaviors my-service/truth/quota/behaviors --out-ac my-service/projections/ac --out-tables my-service/projections/tables --lang zh
   ```
4. **Export a Sandwich Context Pack** for an AI agent filling a Channel 4B `@cloze` slot:
   ```bash
   truthsrc context-pack-v2 --in my-service/.truthsrc/canonical-v2.json --db my-service/.truthsrc/knowledge.sqlite --slot quota-intake --workspace my-service --out-md my-service/.truthsrc/context-pack.md
   ```
5. **Run S1 Fault-Injection TCK** against external effect adapters:
   ```bash
   truthsrc run-tck-v2 --protocol three-phase-reconcile --adapter ./handwritten/my-effect-adapter.ts
   # Supported protocols: three-phase-reconcile | transactional-outbox | saga-compensation | idempotent-consumer
   # JVM/Scala runner:
   truthsrc run-tck-v2 --protocol idempotent-consumer --scala-src ./handwritten/scala --jvm-class example.MyAdapterTckMain
   ```
6. **Install Anti-Cheat Hooks** into an existing repo:
   ```bash
   truthsrc init-hooks --root . --target typescript,scala
   ```
