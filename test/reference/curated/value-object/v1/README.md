# value-object — curated golden v1 (family #1)

**Provenance: `handwritten-golden`** (ruling 2026-11-23,
`docs/emitter-unification-host-family-rulings.md` §4/§10, Q1 手写 curated).

The golden tree is the style specification for the unified emitter's
value-object family: eight representative profiles hand-authored in the
curated style, covering the whole bank-wealth variant matrix
(118 production files reduce to these shape rules).

## Curated style (the delta against classic production)

Exactly two deviations, everything else byte-shaped as the classic renderer:

1. **No generated header line** (face-family house style, ruling L1).
2. **Nominal references use same-package short names** (ruling N1):
   `FundOrderId`, not `example.bankwealth.domain.values.FundOrderId`. Every
   nominal reference inside `domain/values` targets the same package, so no
   import management is needed; cross-context references would render as the
   full `<package>.domain.values.<Name>` path (rule kept for generality, not
   exercised by bank).

Names, field order, field types, the primitive wrapper's `value` field name
(N2), the one-line case-class layout (L2), and the exact-value semantics —
constructor check line, unit-set require, `isPositive` /
`compareSameUnit` / `plus` / `minus`, `checkedAmount` with
`setScale(scale, UNNECESSARY)` plus the precision ceiling (T2) — are all
architecture or contract data, preserved unchanged.

## Representative set

| Golden file | Matrix shape covered |
|---|---|
| `AccountId.scala` | primitive string wrapper |
| `AmountDecimal.scala` | exact decimal without a unit member (`value` fallback) |
| `Money.scala` | exact unit-decimal (CNY unit set, amount+unit members) |
| `BankAccountKey.scala` | single-member record, primitive member |
| `BankPaymentResult.scala` | single-member record, nominal member |
| `BankAccountResponse.scala` | small record with `Option[nominal]` |
| `BankPendingResponse.scala` | `Vector[nominal]` member + `Option[Long]` |
| `BankOrderView.scala` | widest record (15 fields, nominal/Option dense) |

The `Map[k, v]` member form and cross-package FQN rendering are contract-
supported but not exercised by bank-wealth; the family's embedded negatives
battery and derivation tests cover them.

## Contract

`technical-input.json` (`truthsrc.value-object-input/v1`) is the derived
form of the same knowledge the classic `renderValues` interpreted (layout
type declarations + member declarations + exact-value-type descriptors +
package bindings). Every name, field, unit set, scale and precision in the
golden bytes is contract data; the emitter module embeds zero business
bytes. There are no `codeMappings` in this family — the classic renderer
never produced any, so the ledger's own entries are the provenance.
