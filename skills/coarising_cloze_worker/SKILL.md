---
name: coarising-cloze-worker
description: >-
  Implement or blind-review co-arising 2.0 Channel 4B @cloze isolation-zone tasks
  derived from knowledge.sqlite (truthsrc tasks-v2 / v2_tasks), strictly inside
  @cloze:start..@cloze:end boundaries, verified by locked BDD oracles (verify-v2 --strict).
---

# co-arising 2.0 Isolation-Zone Cloze Worker & Blind Review Skill

Use this skill once `compile-v2` has passed and Channel 4B `@cloze` slots need implementation or independent blind review. Compatible with both **Antigravity (AGY)** and **Claude Code**.

## Hard Boundaries (Anti-Cheat Contract)

1. **NEVER modify locked territories**: `generated-tests/`, `generated-scaffold/`, and `projections/` are compiler-owned read-only artifacts (enforced by `truthsrc guard-write` and SHA-256 manifest checks).
2. **Edit ONLY inside `@cloze:start(<slot-id>)..@cloze:end(<slot-id>)`**: Never touch imports, function signatures, or `@cloze` marker comments outside the active slot.
3. **Never hardcode witness values**: Every rule is protected by primary, secondary anti-hardcoding, and boundary-equality Z3 witnesses; implement the exact domain/application contract faithfully.
4. **Use Sandwich Context Packs instead of repo-wide grep**: Call `v2_context_pack` / `truthsrc context-pack-v2 --slot <slot-id>` to get the exact closed-over types, rules, `@cloze` line bounds, and locked `@CoArisingSpec` oracles.

---

## Mode A — Implement a `@cloze` Slot (Worker)

1. **Claim next actionable task** (via MCP `v2_tasks` or CLI):
   ```bash
   truthsrc tasks-v2 --root . --next --format human
   ```
   (Or inspect all parallelizable slots with `truthsrc tasks-v2 --root . --format json`.)
2. **Read ONLY the Sandwich Context Pack** returned for `<slot-id>` and open the target handwritten file (`handwritten/<slot-id>.cloze.ts` and/or `handwritten/scala/.../<Slot>Cloze.scala`).
3. **Set active slot guard** (when invoking hooks): `COARISING_ACTIVE_CLOZE=<slot-id>`.
4. **Implement inside `@cloze:start(<slot-id>)..@cloze:end(<slot-id>)`**:
   - Use exact fixed-point helpers (`dec`, `decAdd`, `decSub`, `decMul`, `decCmp` in TS; `BigDecimal` in Scala) — never IEEE-754 floating-point math.
   - Honor DMN First-Hit rule ordering, every `SHALL NOT dispatch` prohibition, and every `ALWAYS ... SHALL NOT supply` untrusted-input sanitization axiom.
5. **Run the Stop Hook verification gate**:
   ```bash
   truthsrc verify-v2 --root . --strict --target typescript,scala \
     --canonical .truthsrc/canonical-v2.json \
     --db .truthsrc/knowledge.sqlite
   ```
   Do not stop until `passed: true` and zero failed spec IDs remain.

---

## Mode B — Independent Blind Review (Clean-Context Reviewer)

Run Mode B in a **fresh subagent / conversation** that has NEVER seen the worker's implementation reasoning:

1. Read ONLY:
   - The authoritative `.ears` file for `<slot-id>`
   - The handwritten `@cloze` file(s)
   - The locked `generated-tests/` spec file(s) for `<slot-id>`
2. Audit against 5 red lines:
   - Any witness hardcoding or shortcutting of rule conditions?
   - Any floating-point drift (`Number` / `Double`) instead of exact fixed-point decimal?
   - Any off-by-one boundary error (`<` vs `<=`, `>` vs `>=`)?
   - Any `SHALL NOT dispatch` or untrusted input (`SHALL NOT supply`) leakage?
   - Any edits outside `@cloze:start..@cloze:end`?
3. Record the verdict directly into `knowledge.sqlite`:
   ```bash
   truthsrc tasks-v2 --root . --record-review \
     --slot <slot-id> --verdict PASS --reviewer blind-reviewer \
     --notes "Verified First-Hit order, exact decimal math, and SHALL NOT invariants."
   ```
   If `FAIL`, record `--verdict FAIL` with concrete defect notes and return the slot to a Worker.

---

## Final Gate & Live Run

Once `truthsrc tasks-v2 --root . --format json` shows `pending=0, stale=0, unverified=0, greenNeedsReview=0`, run the full `domain / application / interfaces` + Onion DIP + coverage gate, export the offline workbench, and boot the runnable HTTP service:
```bash
truthsrc check-v2 --root . --strict --format human
truthsrc view-v2 --root . --out workshop.html
node handwritten/server.ts   # GET /health + /api/v1/<context>/...
```
