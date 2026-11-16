# Scala → JavaScript 生成器内容级对齐

最新实施：classic `@3` 在原十五件基础上增加 **aggregate-root／aggregate-factory**，两输入A/B各17/17完整原字节、两次源码确定性、37项有效接口观察和`@1/@2`两输入回归均完成，**独立源码及证据核对已闭合**。见 [@3实施收口](CLASSIC-V3-IMPLEMENTATION-CLOSEOUT.md)、[@3范围](CLASSIC-V3-SCOPE.md) 和 [@3反馈](CLASSIC-V3-FEEDBACK.md)。结论只指non-runnable scaffold；不修改原raw名字、回复或`???`，不迁银行，未提交／推送。

已完成基线：**classic `@2` 已承接 F1 并扩展 value-object／invariant-rule／event-handler：两份完整同输入各15文件实际逐字节一致，重复生成、六文件负对照及有界准入均已闭合**，见 [@2实施收口](CLASSIC-V2-IMPLEMENTATION-CLOSEOUT.md) 与 [反馈裁定](CLASSIC-V2-FEEDBACK.md)。旧`@1`仍两套4/4回归；新增目标不改变其四族含义。本包独立核对及汇总元数据补正已闭合；原失败和原plan不改，不用运行包装的PASS替代该复核。最终来源见 [限定验收结论](../../.rounds/classic-cqrs-v2-closeout-20261116-01/final-completion.json)。此前 [F1实施收口](F1-IMPLEMENTATION-CLOSEOUT.md) 保留原四件历史证据。[验收与反馈合同](ACCEPTANCE-AND-FEEDBACK-CONTRACT.md)优先于旧“允许差异”口径；[common 0.2.1消费核对](COMMON-CORE-021-CONSUMPTION.md)替代历史等发布状态。

此前文档阶段的收口见[CLOSEOUT.md](CLOSEOUT.md)：42份diff、中央分工、F1/F2映射及13项接口仍保留为来源/目标设计材料。F1 raw真实expected与旧curated target不同；原target的4项expectedSha仍为空。四件byte PASS不等108文件全项目、42族全覆盖、银行默认链已切流或业务可运行。

## 本次目标

1. 以传统 `CodegenMain → CQRSApplicationGenerator` 分层路径中的 39 个不同 Template 族为清点主基准，记录共享 Model、条件变体和严格 Saga 扩展。
2. 对实际 JS 生产者输出按逻辑制品分为 A（Scala 对应项）与 B（其他），物理文件可以同时容纳多个逻辑项。
3. 为每个 A 和 Scala 缺项提供可供实施者使用的 `diffs/<artifact-type>.diff.md`：覆盖 Model/Builder/Template、路径、package/import、声明顺序、构造器、type alias、默认值、完整 RHS/方法体、胶水库及调用方迁移。
4. 所有生成代码遵守 backend-codegen 的分层布局，业务根包下只允许 `domain`、`application`、`infrastructure`；OO + Plain FP、可读命名、低复杂度适用于 A/B。

## 基准不是同一个概念

- **传统 Scala 模板原始输出**：用于记录现实现的精确形状；未实际运行生成的条目会标明。
- **人工打磨参考**：`backkend-codegen/reference_project/app/net/imadz/`；不能冒称所有方法体都由当前模板生成。
- **目标输出**：默认复刻传统基准；用户明确的命名、三层布局、CommandHelper 和回复语义覆盖项逐条列明，其余偏差待裁决。
- **当前 JS 输出**：包括银行当前消费的 `scala-cqrs-play-service` 与其他真实入口；目录存在不等于该入口正在消费。
- Scala 新增的 `template/products/*` 也有扁平 Protocol、`emit*` 和 `nextN`；登记它，但不能用它给相同坏味道自证合格。

## 资料布局

- `scala-artifacts.json` / `scala-artifacts.md`：传统 39 族的完整路径和条件。
- `js-partition.json` / `js-partition.md`：JS 逻辑制品 A/B 和入口状态。
- `diffs/`：各 ArtifactType 的具体差距与实施合同。
- `baseline/`：准确源码、人工参考、JS实例快照与SHA-256索引；不是新业务真源。提交时的安全排除和本机证据边界见[COMMIT-SNAPSHOT-BOUNDARY.md](COMMIT-SNAPSHOT-BOUNDARY.md)，不能假定所有本机快照均随Git交付。
- `layout-and-style.md`：布局、命名、OO/Plain FP、import 和复杂度标准。
- `glue-dependencies.md`：实际胶水接口与副作用、源码与已发布依赖的区别。
- `assignment-map.json` / `ASSIGNMENT-MAP.md`：按真实写集合安排的依赖与并发约束；重装记录见 `details/assignment-reassembly-report.json`。
- [fixtures/COVERAGE-MATRIX.md](fixtures/COVERAGE-MATRIX.md) / [coverage-matrix.json](fixtures/coverage-matrix.json)：42族条件与308条B逻辑项的反向索引；F1/F2仅来源候选，未建立同输入覆盖。
- [F1输入映射](fixtures/f1-credit-balance/INPUT-MAPPING.md)与[四件套目标合同](expected/f1-credit-balance/TARGET-CONTRACT.md)：10命令/9写Helper、回复两臂、State/Events的来源与未决项；target manifest 的4项expectedSha仍为空，不能当已冻结目标。
- [F2输入映射](fixtures/f2-warehouse/INPUT-MAPPING.md)：Warehouse名义类型、receipt/fold与持久化的20项准入槽、14类目标文件角色；没有传统BC无损adapter或实际历史wire bytes。
- [INTERFACE-DECISIONS.md](INTERFACE-DECISIONS.md)：13项公共接口文档裁定，区分现有API、用户边界、集成者建议及实际供给阻断；不是新公开schema或实施批准。
- [COMMON-CORE-CONSUMPTION-HANDOFF.md](COMMON-CORE-CONSUMPTION-HANDOFF.md)：保留用户早期进行中通报；最新发布与本地制品事实见[COMMON-CORE-021-CONSUMPTION.md](COMMON-CORE-021-CONSUMPTION.md)。
- [details/coverage-matrix-check.json](details/coverage-matrix-check.json)：来源指纹、173条结构化变体和308条B的静态指针对账；不替代内容复核、expected冻结或运行证据。

## 不做

不启动银行会话38，不重跑完整workshop，不修改BC默认输入，不改运行库、不发布，不手改 `generated/` / `.truthsrc/` / ledger / anchors。现有成功和失败回执保持不变。

完成状态、已收敛勘误与后续具体决定见[CLOSEOUT.md](CLOSEOUT.md)；详细来源机器表保留，不能据42份文档或候选数量推断JS已经对齐。
