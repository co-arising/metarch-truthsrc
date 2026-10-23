# AGENTS.md — contract for AI agents editing a truthsrc tree

You are an autonomous client of this repository. This file is your contract.
Everything in it is mechanically enforced; violating it is detectable in one
command, and "it looked fine" is not a defense.

## The one rule

**The tree (`tree/`) is the only edit surface. `canonical.json` is generated.**
If your diff touches `canonical.json` by hand, the change is void.

## Commands (all local, zero deps, ~1s)

```bash
node bin/truthsrc.js validate --tree tree    # structure V* + stage rules ES/CS/AG/RF/SM
node bin/truthsrc.js roundtrip --tree tree   # compile∘decompose∘compile byte identity
node bin/truthsrc.js compile --tree tree --out canonical.json
node bin/truthsrc.js decompose --canonical canonical.json --tree tree
```

Every batch of edits — one note or fifty — ends with **validate AND roundtrip,
both green**, or the batch didn't happen. This is not bureaucracy: the
roundtrip gate is what makes thousands of autonomous agent edits reconcilable.

## File discipline

1. **Filenames are derived, never invented:**
   `type-<stage-code>-<slug(name)>-<seq>.yaml`
   stage codes: `es cs ad sd cm rf sm`. slug is camel-case aware
   (`RequestLoan` → `request-loan`) — use `lib/shared.mjs slug()`, never
   hand-slugify. Aggregate atoms live at `aggregates/<slug>/aggregate.yaml`,
   slices at `aggregates/<slug>/slices/<command-slug>.slice.yaml`, catalog
   atoms at `value-objects|read-models|stories/<slug>.{vo,rm,story}.yaml`,
   policy atoms at `policies/policy-<code>-<slug>-<seq>.policy.yaml`. Saga
   products live at `sagas/<slug(id)>.saga.yaml` (stable scalar header id,
   not display name); do not add an inbox stage to make a Saga appear.
2. **`origin.seq` is frozen board order.** Append new notes with the next seq;
   never renumber existing atoms (downstream tools key on it). Aggregate /
   catalog / Saga `seq` is optional product order — unique per family; never
   invent or densify a Saga seq. Uniform Saga seq orders the products; mixed
   presence uses file order and reports SEQ1.
3. **Payload is verbatim.** Fix capture typos in `payload` only when a human
   asked; never "normalize", re-key, or enrich it on your own initiative.
   Additive keys must pass the three-layer test (SCHEMA.md §The three-layer key test).
4. **No tool artifacts in the tree.** No timestamps of compilation, no hashes,
   no `__seq` stamps — if a key exists only because a tool needed it, it does
   not belong in the tree.
5. **One definition per event.** A full event definition (`payloads`,
   `bindings`, `foldAssignments`) lives in exactly one slice — the first
   command in `order.commands` that produces it; events no command produces go
   to the aggregate's `extraEvents`. Decisions and folds are never stored —
   they are derived (formulas in SCHEMA.md §The slice atom).

## Assertion discipline (for agents doing analysis)

- To claim "the tree has no X": run `compile` and search the canonical output,
  or grep `tree/inbox/<stage>/`. Cite the command and the negative result.
  Absence of a grep hit is a signal to ask, **not** authorization to invent.
- Stage rules are **human-decision surfaces**: ES3 (duplicate names) and ES4
  (solution verbs) are notices — report them, never auto-merge or auto-rename.
- If `roundtrip` goes red after your edit, your edit is wrong. Fix the edit;
  never "fix" the gate.

## Batch-edit recipe (proven at 1,600-atom scale)

```js
// 1. parse atoms with lib/shared.mjs parseDoc (never regex the whole file)
// 2. transform in memory
// 3. emit with emitDoc (never hand-format the payload block)
// 4. run validate + roundtrip
```

## Saga product boundary

- Use `kind: saga` with non-empty scalar header `id`, `name`, and definition
  `version` (non-empty string or positive safe integer), then one JSON-object
  `payload` block. Extra headers are strings/numbers; rich content belongs in
  payload. Headers come first. Use parseDoc/emitDoc, not regex-expanded YAML.
- `canonical.sagas[]` carries the **whole atom minus kind**, not just payload.
  Preserve id/version, header order, optional seq presence and payload; do not
  infer identity from payload or manufacture origins/notes/execution history.
  New designs record their actual provenance, never fictional old stickies.
- `validate` checks only Saga identity, kind/filename, uniqueness, seq and basic
  payload/surface shape (SA1–SA3/V1/V3/V12). SA0 explicitly reports that payload
  and extra headers are **not execution-validated**. Unknown Saga execution
  keys/capabilities need the separate strict semantic/compiler gate; green
  validate/compile/roundtrip is not semantic validity or runnable certification.
- With no Saga products, compile emits no sagas key and decompose creates no
  Saga product directory. Do not add empty or invented products to old trees.

## What agents should NOT do

- Renumber `seq`s, rename atoms without an explicit human instruction, or
  "clean up" ES3/ES4 findings autonomously.
- Introduce a second truth source (JSON side-files, caches, indexes) inside
  `tree/`. Derived data goes through `compile`, not through new files.
- Trust a stale `canonical.json`. It is a build artifact — recompile.
