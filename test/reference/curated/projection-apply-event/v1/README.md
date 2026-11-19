# projection-apply-event v1 — StockLedger 投影纯函数族金样候选（语义面形态）

> 传统清单第 26 族（条件子产物）：multi 项目下每投影 0/1 个
> `<View>ApplyEvent.scala` kernel 纯函数族文件；单项目基数 0。
>
> 形态演进史：首版（`599c385`）被指出 raw 单行版式/sealed 供给缺失/对照缺失；
> 修订一（`4e0209c`）补 100 列版式＋sealed 供给＋None-patch 判例；讲解中用户
> 提出 **业务语义接口＋注入＋隔离区** 方案（A/B 裁决）、指出 inline
> `getOrElse(Instant.now())` 是"未经思考的补丁"、UUID 准入应归属 common 供给、
> `skuId = e.skuId` 命中是我们 AST 检查器的粒度问题（经 scalameta 实探证实）——
> 本版按 **语义面形态＋E2b 上下文规则** 重建。

## 本族制品解决什么问题

读侧按事件流维护视图行。本族制品是**视图行的 kernel 纯函数翻译层**：
`on<Event>(旧行, 事件) → 新行`——**零机制**（PO 解包、Await、repo IO 全在 glue
壳 ViewMachine）。raw 里它只在 multi 项目、`applyEvents` 非空时发射。

本版的关键结构决定（用户 2026-11-20 提案）：**视图的业务默认值不是生成器逻辑**——
白纸行长什么样、"没盖时间戳"是什么意思、缺省文本是什么意思，是这本台账的业务
决定。生成器只发射**语义面**（per-view trait：`emptyRow / stamped / text` 三个
业务问句钩子），实现是**手写隔离区**（`infrastructure.projection`，生成器永不
创建或覆写），装配模块显式绑定——与 toolgate 族"生成面＋手写实现＋装配绑定"
完全同构。这顺手溶解了 raw 的八型默认推导表、可推导性降级、inline ts/strOr
模板习语全部三坨机制。

## 范围（19 payload，19 源文件进门）

- 生产 11 文件＝**生成五件**（两 kernel 类＋两语义面 trait＋装配模块）＋
  **手写隔离区与供给六件**（两语义 impl、sealed ReservationEntity 事件家族、
  两个 Table 视图＋列账、net.imadz.common.Id 裁剪供给）。
- 测试 4 文件：闭式输入形状＋命名桩语义类（kernel 行为完全确定）、独立 oracle
  （期望行数据直陈）、行为 21 条（kernel 桩语义 14＋impl 语义 6＋装配 1）、
  结构/引擎元 30 条（合计 51，8 负对照）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点（裁定状态）

| 项 | 状态 | 一句话 |
|---|---|---|
| A+B 语义面 | ✅ 用户提案采纳（V1 类注入） | 面生成／impl 手写隔离区／模块绑定；八型表溶解 |
| 时间语义 | ✅ | epoch0/null → **命名默认值 `untimestamped`**（现在），impl 内唯一时钟点；kernel 用桩语义全确定 |
| C 版式 | ✅ C2 | 100 列纪律，每实参一行，import 豁免，性质钉住 |
| D None patch | ✅ D1 | `settledAt = None`＝清列（LedgerReopened 可执行判例） |
| E2b 引擎 | ✅ 用户确认 | `Term.Assign` 按**上下文**判（实参位置＝命名实参两层准入／语句位置＝赋值两层违规）——scalameta 4.7.7 实探证据：copy/new 命名实参父节点＝`Term.ArgClause`、语句赋值父节点＝`Term.Block` |
| E 供给面 | ✅ | Instant/UUID 准入只覆盖手写供给文件（两 impl 各一次时钟、common 供给解析 UUID）；生成 kernel 内联为零 |
| D-P08 fail-closed | 方向已认 | degraded/重复/persistenceId 混 create/缺键拒收——拒收动作在生成器负测实现 |
| D-SUPPLY-SEALED | ✅ | sealed ReservationEvent 家族（CreditBalanceEntity 判例）；事件发射不属本族 |

## 行为合同（ScalaCheck 实测）

kernel 14 条全走桩语义（emptyRow＝零 UUID 白纸、stamped＝原样入账、text＝原样）：
from-None create oracle 相等／over-existing 保留未投影列／负：existing 永不变异／
updateOnly 投影＋盖戳／settle-reopen 双 patch／负：None patch 清列且余列原样／
upsert 命中原位替换、未命中保序追加／delete 键对／ts 桩直译／persistenceId 身份
织入＋tenant 参数／负：身份永不落零 UUID／快照 amend／重复调用确定性。
impl 6 条走真实 Injector 解析的手写实现：白纸行十列字面相等／快照白纸参数化／
负：快照身份永不零 UUID／stamped 正常直译／负：epoch0/null 归一非 epoch0／
text null→空。装配 1 条：真实 Guice Injector 双绑定类型验证。

## 质量状态

- discovery 轮（`.rounds/projection-apply-event-quality-20261120-11`）：两段编译
  exit 0，度量门 19 文件 442 scope 0 violation 0 excess，51 性质三 seed
  740001-740003 全过（随机性质各 ≥1000 次，合计 63090）。
- final-bytes 轮在本候选提交字节上执行；prepared pin 与 discovery 轮相等即证零漂移。
  本目录只是候选；认可以 bundle sha＋讲解裁定为准。
