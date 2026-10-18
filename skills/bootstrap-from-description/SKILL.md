---
name: bootstrap-from-description
description: Bootstrap a truthsrc v0.5 truth tree for a domain the agent knows well (scenario B). Drafts all 13 workshop products in problem-space language using the problem → solution → process naming frame. Emits inbox/ drafts only — never writes the tree directly. Use when starting from a one-line domain description with no codebase.
---

# bootstrap-from-description — tree from a domain you know

You are the **drafter**, never the author. You know this domain from training —
that familiarity is your biggest fabrication risk, not your license. Every
draft is a candidate until the human steward confirms it.

## 0. Input

- One-line domain description from the human, e.g.
  "工程面：从代码提交到生产部署的交付流水线".
- Target schema: truthsrc v0.5. Read `SCHEMA.md` first: the 10 atom kinds,
  the 22-relation registry (with carriers), the 13-product inbox layout,
  the problem-space vocabulary requirement.

## 1. Problem list first — problem-space language only

Before writing any note, list the problems this domain exists to solve, in the
words the business itself uses. No framework words, no tool names.

- ❌ "Jenkins pipeline as code 编排"
- ✅ "提交代码之后，要等很久才知道这次改动能不能上线"

If you cannot state the problem without the tool's name, you do not
understand it well enough to draft — mark it and move on.

## 2. The naming frame: problem over solution over process

Every element you draft gets three slots, in this order:

1. **解决了什么问题** (problem) — the problem-space anchor. **This is what
   the NAME must express.** Format: `解决了《什么问题》`.
2. **用什么解决方案** (solution) — the mechanism. Recorded in the
   description's solution slot, **never in the name**.
3. **做了某个流程** (process) — which business process and phase this belongs
   to (the `timeline` value, e.g. 评审放行 / 交付消费).

Naming format: **「解决了什么问题」 over 「用什么方案做了什么流程」**

Worked examples:

**Policy**
- ❌ name: "Jenkins 强制评审门配置" (solution-space: tool + mechanism)
- ✅ name: "发布前未经评审的代码不得上线"
  - 解决了什么问题：坏代码未经第二双眼睛就上线，出事才被发现
  - 用什么解决方案：合并前必须经他人评审通过（评审门机制）
  - 做了什么流程：发布流程 · 评审放行阶段

**Event**
- ❌ name: "DeploymentWebhookFired" (solution-space: mechanism)
- ✅ name: "版本已部署到生产"
  - 解决了什么问题：没人知道线上跑的是哪个版本，出问题无法对应
  - 用什么解决方案：部署完成时向相关方广播一次状态变更
  - 做了什么流程：发布流程 · 交付消费阶段

**Read model**
- ❌ name: "jenkins_builds 表" (solution-space: storage)
- ✅ name: "构建历史一览"
  - 解决了什么问题：想查某次提交的构建结果，要翻很久的日志
  - 用什么解决方案：把每次构建的结果记下来，按提交查
  - 做了什么流程：发布流程 · 运营与治理阶段

## 3. Draft all 13 products — in workshop order, with honesty labels

The 13 products follow the classic EventStorming arc (Brandolini): diverge
(events on a timeline) → enrich (commands, actors, policies, read models) →
converge (aggregates, bounded contexts). Our 13 extend the classic flow with
lineage, stories, use-cases and first-class read models. Walk them in order;
for each element, label its basis:

| # | Product | Classic phase | Honesty |
|---|---|---|---|
| 01 | event-flow | chaotic exploration + timeline | ✅ 可独立起草 |
| 02 | commands | commands + actors | ✅ 可独立起草 |
| 03 | aggregates | aggregates (clustering) | ✅ 可独立起草 |
| 04 | subdomains | bounded contexts, first cut | ❌ 只列提纲 |
| 05 | context-map | context mapping | ⚠️ 起草+必审 |
| 06 | aggregate-detail | aggregates, refined | ✅ 可独立起草 |
| 07 | aggregate-relations | aggregates, refined | ⚠️ 起草+必审 |
| 08 | message-detail | events/commands, refined | ✅ 可独立起草 |
| 09 | lineage | — (our extension) | ⚠️ 起草+必审 |
| 10 | policies | policies (lilac stickies) | ⚠️ 起草+必审 |
| 11 | stories | — (our extension) | ❌ 只列提纲 |
| 12 | use-cases | — (our extension) | ⚠️ 起草+必审 |
| 13 | read-models | read models (green stickies) | ✅ 可独立起草 |

- ✅ **可独立起草**: draft from domain knowledge, `confidence: high`, but
  every field still needs the steward's eye.
- ⚠️ **起草+必审**: draft the structure, leave intent blank,
  `confidence: low`. Business meaning, cardinalities, policy intent — the
  human fills these.
- ❌ **只列提纲不填内容**: write the slot with `confidence: low` and a
  `[NEEDS CALL]` note. Subdomain boundaries and user stories are human
  judgments; your draft is a seating chart, not a decision.

## 4. Language gate — the problem-space check

Every name and description must pass one test: **could a domain expert who
has never written code understand it?** Banned from names and descriptions:
`journal`, `cursor`, `shard`, `snapshot`, `entity`, `webhook`, `topic`,
`partition`, `pipeline-as-code`, and any tool or framework name. If the only
words you have are mechanical, write the draft with `confidence: low` and let
the steward rename — a bad name flagged is better than a mechanical name
asserted.

## 5. Note shape

Standard note shape (`kind: note`, banner comment per SCHEMA.md), with:

- `origin.board: bootstrapped` (not a workshop board — provenance of method)
- `origin.stage`: the v0.3 stage code of the product dir (`es`, `cs`, `rf`,
  `sm`, … — see the 13-product table in SCHEMA.md)
- `payload.info.provenance`: `domain knowledge (training)` — never cite code
- `payload.info.confidence`: `high` | `low`
- The three slots from §2 as `payload.info.problem` /
  `payload.info.solution` / `payload.info.process`

Filename convention: `<type>-<stage>-<slug>-<seq>.yaml`, seq dense per
`(stage, board)`.

## 6. Validation gate

`truthsrc validate --tree <dir>` must be **0 hard**. Notices are fine
(report-only). If a hard fires, your draft is wrong or overreaching — fix the
draft, never weaken the rule. `truthsrc compile` must succeed.

## 7. REVIEW.md — the honesty ledger

Every draft's provenance is `domain knowledge (training)`. List in
`inbox/REVIEW.md`: each ⚠️/❌ item, the exact question a domain expert must
answer to confirm it, and what you deliberately left blank. Your job ends at
the review list.

## 8. Hand to the steward

```
one-line description → inbox/ drafts (you) → human stewardship
  (rename / reposition / delete fabrications / fill fields)
  → aggregates/… (human) → truthsrc validate (0 hard) → compile
```

A draft that skips the steward is a fabrication with a file extension —
even when the domain is one you know well. Especially then.
