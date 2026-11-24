# domain-entity — curated golden v1 (family #2)

**Provenance: `handwritten-golden`** (ruling 2026-11-23,
`docs/emitter-unification-host-family-rulings.md` §17, Q1 手写 curated).

The golden tree is the style specification for the unified emitter's
domain-entity family: all six bank-wealth domain state and entity files
(three aggregates × two files, 291 lines total) hand-authored in the curated
style, covering the complete bank-wealth variant matrix.

## Curated style (the delta against classic production)

Exactly one deviation, everything else byte-shaped as the classic renderer:

1. **No generated header line** (face-family and value-object house style,
   ruling L1).

Cross-package references (`domain` ↔ `domain.values` ↔ `domain.entities`)
retain their fully qualified paths (strict N1, zero shadowing risk, 100%
ABI-transparent). Names, field order, one-line case-class and `def empty`
layouts (L2, preserving the exact single-line `codeMappings` anchor span on
`Entity.empty`), and `java.lang.Long.parseLong(...)` integer default literals
are preserved unchanged.

## Coverage set (all 6 bank-wealth files)

| Aggregate | Golden files | Matrix shape covered |
|---|---|---|
| `CreditBalance` | `CreditBalanceState.scala`, `entities/CreditBalanceEntity.scala` | 9 fields (`nominal`, `Boolean`, `Map`), 7 events, primitive-wrapper / `false` / `Map()` defaults |
| `FundOrder` | `FundOrderState.scala`, `entities/FundOrderEntity.scala` | 30 fields (`nominal`, `String`, `Map`, `Option`), 32 events, non-empty string / exact `Money` / nested record `FundShare` / `None` defaults |
| `SipPlan` | `SipPlanState.scala`, `entities/SipPlanEntity.scala` | 27 fields (`nominal`, `Boolean`, `Long`, `Map`, `Option`, `Vector`), 18 events, `Long.parseLong` (`0`/`-1`) / `Vector()` / `None` defaults |

## Contract

`technical-input.json` (`truthsrc.domain-entity-input/v1`) is the derived form
of the same knowledge the classic `renderAggregate` interpreted
(`reference-layout` + `domain-folds` + `exact-value-types` + explicit package
bindings). Every aggregate name, field, type tree, typed default literal AST,
event name and provenance source is contract data; the emitter module embeds
zero business bytes. `Entity.scala` retains its exact `codeMappings` anchor on
`def empty: State = State(...)`.
