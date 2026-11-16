# 实施分工与并发合同

最后更新：2026-11-16。状态：**未来实施的所有权与协调计划；不批准任何生产代码变更。** 机器表：[assignment-map.json](assignment-map.json)。

## 1. 范围

覆盖39+3 Scala制品的拟实施写集合、290个独立写路径与308个B逻辑出现位置。42份diff均已保存；`application-service`已补齐，并由`details/assemble-assignments.py`重新纳入分工。文档已保存不等于内容已审定或实施已获批准。重装前的277路径版本保留在[历史分工表](details/assignment-map.pre-application-service.json)，不删除旧记录。

## 2. 所有权规则

| 路径类别 | Owner | 说明 |
|---|---|---|
| 既有源文件、公共入口（lib/、src/core/、generator.json） | main-integrator | 132个路径；先做无行为变化的切分，再转交 |
| 跨组热点 | main-integrator | 例如render-domain.mjs被domain/event-handler/invariant/command-helper四组引用 |
| 组内新MBT文件 | 该组owner | 接口批准后可并发；组内串行 |

每个artifact保留：declaredWritePaths、declaredSharedPaths、interfacePrerequisites（非制品依赖如explicit-reply-contract、selected-runtime-abi）、consumerCoordination（互引是接口协同，不是循环blockedBy）、openDecisions与必读集（diff＋六份中央标准文档）。

## 3. 执行顺序与禁止

阶段：interface-contracts → shared-hotspot-split → independent-new-mbt-files → registry-and-caller-integration → scoped-cli-and-runtime-observation。

禁止：worktree、stash/reset/clean、共享应用写入、手改generated/current、运行时发布、commit/push/release、自动workshop37/38。每个工作包在diff/fixture/供给/接口审定并获实施授权后才开始。

## 4. 当前阻断（诚实清单）

1. application-service diff缺失及本轮复核的6项文档问题已解除；剩余D01–D09是具体目标/接口/实现槽准入，不因文档齐套自动ready。独立Function并非该调用链必需，D10已移出阻断。
2. 同FQN `CommandHandlerReplyingBehavior` 多源不一致——**用户此前给定：`common-core/` 对应已发布 `net.imadz:common-core_2.13:0.2` 源码**，固定0.2 API为 `(rule, helper, state, command)` + `replyWith`/`replyWithAndPublish`（含旧柯里化 overload），不含scaffold的 `withPost`/`policy`。**最新进展尚未完成**：`common-core-post-validation` 正考虑下一版post-validation/withPost，保留rule与publish、不照搬第五公开字段；见[逐项建议与消费交接](COMMON-CORE-CONSUMPTION-HANDOFF.md)。0.2限制不等永久禁止；新版本坐标、字节和最终API未到，不提前改目标。实施前须锁实际制品/classpath，并消除同FQN source-copy与jar双供给；业务postconditions、MoneyOps、auth各自分账，本线不调查或发布运行库。
3. 回复合同、Params映射、布局、runtime ABI、ViewMachine定义等在各自diff中列明的openDecisions。
4. 3个退休入口任意外部源码槽（见[js-partition.md](js-partition.md)）。
5. CC度量工具未选定，所有复杂度为目标值非测量值。

## 5. 验收边界

本文件与assignment-map只完成文档分工；最终每项需要同输入完整文件对账、真实接口观察、独立oracle与稳定回锚，按各diff的验收节执行。银行作者树/绑定/oracle不动；业务设计建议（SYNTHESIS.md）尚未改入作者输入。
