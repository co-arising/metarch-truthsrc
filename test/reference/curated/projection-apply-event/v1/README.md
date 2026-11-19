# projection-apply-event v1 — StockLedger 投影纯函数族金样候选

> 传统清单第 26 族（条件子产物）：multi 项目下每投影 0/1 个
> `<View>ApplyEvent.scala` kernel 纯函数族文件；单项目基数 0。本样用两个视图
> 把四形函数、四个条件 helper、两种 emptyRow 变体一次性钉死。
>
> 修订史：首版候选（`599c385`）讲解中被提出三处修正——(1) raw 单行实参表带进
> 目标形，超业界行宽惯例；(2) 名义事件供给丢了真源 sealed 事件家族惯例；
> (3) 判定点到代码对照缺失、D-P09 None-patch 裁定无代码演示。本版修订：100 列
> 版式纪律＋sealed ReservationEvent 供给家族（CreditBalanceEntity 判例；发射
> 仍不属本族）＋settledAt 列与 LedgerSettled/LedgerReopened 事件（None patch
> ＝清列可执行判例）＋逐裁定代码对照（见讲解）。

## 本族制品解决什么问题

读族按事件流把行维护成视图。本族制品是**视图行的纯函数翻译层**：把已判定的
域事件翻译成 `Option[View]×E→View` / `(String,String)` 键元组，kernel 侧零机制——
PO 解包、Await、repo IO 全部留在 glue 壳 ViewMachine，壳按函数 presence/form/signature
路由。它钉住五件事：

1. **四形发射合同**：create（`existing.getOrElse(emptyRow).copy`）／updateOnly
   （`row.copy`，空 body 渲染 `row`）／delete（两 judged 键对，位置 0/1）／
   persistenceIdCreate（`emptyRow(entityId, …)` 参数化基座）——函数序＝判定序。
2. **helper 触发与定序**：emptyRow → ts → strOr → upsertBy 按需发射、顺序固定；
   未触发的 helper 诚实缺席（快照族无 strOr/upsertBy，结构性质钉住）。
3. **两种 emptyRow**：普通族全列字面默认（Id 列＝零 UUID）；persistenceId 族
   identity 列全取 `Id.of(entityId)`、tenantId 列取参数（Park 判例）——
   directed negative 钉住「persistenceId 身份永不落回零 UUID」。
4. **fail-closed 输入合同**（D-P08 候选裁定）：raw degraded（空/`???`/未知方言）
   事件不进目标文件；delete 恰两键对；persistenceId 视图禁 create 形事件
   （raw 混排会生成引用不存在的 `existing` 的坏函数）；裸 Instant 列拒绝而非
   raw 的静默降级。kernel 文件零 `???`、零 MANUAL 区、零 metarch 硬编码 import。
5. **版式纪律**（D-LAYOUT-100）：100 列上限（import 豁免），emptyRow/copy 实参
   每行一个命名实参——性质 `structure: kernel and supply sources hold the
   100-column layout discipline` 钉住。
6. **时钟单点**：ts 的 epoch0/null→now 是本族唯一许可的时钟读取（本阶段不改成
   时间常量），结构性质把 `Instant.now` 钉在 ts 一处；identity 解析零随机。

## 范围（19 payload）

- 生产 6 文件：**本族制品** 2 件（`StockLedgerApplyEvent`：create+updateOnly×4
  +delete，含 keyword 列 `` `type` `` 反引号判例与 `settledAt = None` 清列判例；
  `StockLedgerSnapshotApplyEvent`：persistenceIdCreate+updateOnly）＋供给 4 件
  （ReservationEntity sealed 事件家族＝域名义供给、两个 Table 视图＋列账＝壳
  repository 契约、net.imadz.common.Id 裁剪公共供给＝别名＋确定性 of，随机面排除）。
- 测试 4 文件：独立 oracle（期望行以数据直陈）＋事件/行生成器＋16 条行为性质
  ＋24 条结构/引擎元性质（合计 40，7 负对照）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点（候选裁定，待讲解批准）

| 项 | 本样例的显式选择 |
|---|---|
| D-P08-FAIL-CLOSED | judged 输入只收可执行事件（四形）；degraded 拒收；delete 恰两键对；重复事件名拒收；persistenceId 视图禁 create 形；裸 Instant/不可推导列拒收——raw 的 `existing.getOrElse(???)` 降级与空对象文件永不出现 |
| D-P09-ORACLE | None patch＝清列（raw 注释的「不改列」是错的，已修正；可执行判例＝LedgerReopened 的 `settledAt = None`）；epoch0/null→now 保留（唯一许可时钟点）；默认值＝八型表；persistenceId 全 Id 列取 entityId。全部有业务 oracle 性质钉住 |
| D-P10-KERNEL-GLUE | 首 import 用配置业务 base（raw 硬编码 metarch 前缀显式修正）；kernel 零机制结构钉住；壳 ViewMachine 合同归 projection-handler 族，本样不伪造；viewColumns 按判定原签名发射 |
| E1-ENGINE-DELTA | 引擎从 connector 族字节（f5c66788 核心）派生本族字节，边界层增量两处且全被元性质钉住：Instant/UUID 项名准入（声明的时间/身份面；Random/Clock/LocalDateTime/Date/Await 仍禁）；命名实参准入（scalameta 把命名实参解析为 Term.Assign——Defn.Var 两层仍禁，边界层无赋值目标，活下来的 Term.Assign 只能是 emptyRow/copy 习语）。upsert 键从 raw `A => Any` 显式修正为 `A => String`（Any 两层禁入） |
| SCOPE-SUPPLY | 纯 case class 文件零 scope 会挂门：Table 对象带列账 val（viewColumns 概念的家）、事件构造带 require（curated 域纪律）；common 供给按 boundary 分类 |
| D-LAYOUT-100 | 目标发射版式＝100 列纪律：emptyRow/copy 实参每行一个命名实参、超宽 def 参数表逐参换行、import 豁免——取代 raw 的单行实参发射（首版候选被否的点） |
| D-SUPPLY-SEALED | 事件供给按真源惯例（CreditBalanceEntity 判例）组织为 sealed ReservationEvent 家族；事件类型**发射**仍不属本族——本族只按 eventFqn import 消费，发射归实体侧族 |

## 行为合同（ScalaCheck 实测，全走公开函数面）

from-None create 全列投影 oracle 相等／over-existing 保留未投影列（totalAmount/tags）／
existing 实参永不变异（负对照）／updateOnly 投影＋盖时间戳／settle-reopen 双 patch
oracle 相等／None patch 清列且余列原样（负对照，D-P09 判例）／upsert 命中原位替换、
未命中保序追加／delete 键＝字面量＋Id 字符串（小写 uuid）／ts normal 直译、
epoch0/null 永不产出 epoch0（负对照）／strOr null→空／persistenceIdCreate 把
entityId 织入身份列、tenant 参数到位（负对照：身份永不落零 UUID）／快照 amend
保身份与计数／重复调用确定性。

## 质量状态

- discovery 轮（`.rounds/projection-apply-event-quality-20261119-07`）：两段编译
  exit 0，度量门 14 文件 373 scope 0 violation 0 excess，40 性质三 seed
  740001-740003 全过（随机性质各 ≥1000 次，合计 51069）。
- final-bytes 轮在本候选提交字节上执行；prepared pin 与 discovery 轮相等即证零漂移。
  本目录只是候选；认可以 bundle sha＋讲解裁定为准。
