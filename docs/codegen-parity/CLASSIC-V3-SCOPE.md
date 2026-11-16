# Classic @3 原字节范围

本包扩展传统 source scaffold，不是银行业务迁移。`classic-architecture@3` 消费现有完整 `truthsrc.classic-architecture-input/v1`，发射原 @2 七族并增加 `aggregate-root`、`aggregate-factory`。

## 完整文件集合

两份独立 Scala expected 在 `test/reference/classic-cqrs-v3/{baseline,timestamp-int}/`，每套 17 个完整 Scala 文件：已有 15 件加上 `CreditBalanceAggregate.scala`、`CreditBalanceAggregateFactory.scala`。原字节来自既有成功的 Scala 公开 CodegenMain 实产；不是由 JS renderer 构造。

- baseline：40369 bytes。
- timestamp-int：40368 bytes。
- 两套共 34 完整 Scala／80737 bytes。
- `scope.json` 提前固定完整路径集合；`expectedOnly=[]`，`actualOnly=[anchors.json,truthsrc.ledger.json]`。
- expected 根没有 README、来源报告或其它资料。实际根预期 17 源码＋2 控制文件；控制文件只作独立 inventory，不计 Scala parity。
- 比较不 trim、不删头、不改换行、不格式化、不比 AST、不缩成两边交集。

## 版本与行为

`classic-architecture@3`、payload `/v3`、capability `classic-source-scaffold@3`、target `scala-cqrs-classic-scaffold@3` 独立注册。@1/@2 的 manifest、meaning、readiness 和原源码字节不扩大。

Root 从显式 State/Event/Behavior refs、Protocol command family 和 ShardedTags 生成普通 wiring 与 key/tags。Factory 复刻裸引用、原序初始化选择、标识符处理和 typed ask。模型与模板保留各自依赖、literal 源码槽与知识参数注释；最终通过既有公开 writer 组装、stamp 和写入新独占目录。

原两套 Root／Factory 字节相同，timestamp 类型探针只影响 Entity。bare-only、same-ID、optional、noteId、tag 值和工厂名字等新 plan 观察不等于有对应的独立 Scala expected；changed-output 双端 parity 仍 OPEN。Root 历史 Saga/inline/steps/context 模型分支不在普通产品准入范围，选中则明确拒绝，不静默忽略。

## 非本包

- 现役银行 renderer／shared app／作者树／journal 不变。
- Repository、protobuf/converter、adapters、bootstrap 和部署不在 17 件集合。
- 不修改 raw 错误回复、重复 import、名字、MANUAL 或 `???`。占位仅记作未来手写隔离归属候选。
- Plain FP、ScalaCheck、生成 Scala 编译、金融 oracle、运行库 ABI/effects 和业务 runtime 各自待验，不继承原字节结果。
- 不新增 JVM、服务、下载或 runtime 发布；本次不提交／推送。

本页定义范围，不是运行 PASS。真实公开调用与来源核对结果分别记录到本机回执和实施收口，原失败全部保留。
