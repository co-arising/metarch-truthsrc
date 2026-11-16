# F1：真实Scala基准、公共JS四件与严格字节门

日期：2026-11-16。**本批已进入实际实现并完成F1限定验收，不再是docs-only。** 用户已批准本批实施与并行分工；common 0.2.1已发布并完成本线字节/公开签名核对。没有提交、推送或发布。

## 结论与范围

**F1 classic CreditBalance的四件完整文件，基准与JS公开CLI生成结果逐字节一致；baseline重复生成及timestamp Int变体均通过。** 不是108文件全项目、42族全量、银行完整业务或Plain FP最终验收。

| 完整文件 | baseline bytes | baseline SHA-256 |
|---|---:|---|
| `app/net/imadz/banking/application/aggregates/CreditBalanceProtocol.scala` | 3675 | `a87d6eb810e696d0fd0ed6a021038eb953ccf30ae1db0aee9c437f4b53504a50` |
| `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala` | 10155 | `d31fc1c7b1236320786ad29023710fe10c079294473e146bdf810a5439405d0e` |
| `app/net/imadz/banking/application/aggregates/behaviors/CreditBalanceBehaviors.scala` | 4989 | `be1747471aaa7e313e6d4e7995d980294035d73933dece0bdb67cc996f2564bf` |
| `app/net/imadz/banking/domain/entities/CreditBalanceEntity.scala` | 1375 | `a7a4e3e2566e40d93b54cab3c760ce0cf5787d917d19fe8bbcb9739f825d64a0` |

路径、package、imports及顺序、注释、空白、完整方法体和生成头都参加比较。没有trim、换行归一化、去头或差异白名单。原raw查询`???`和回复构造错位保留，因此**该scaffold明确不可作为可运行应用验收**。

## 实际实现

- 通用`classic-architecture@1`产品保留完整原始`SystemMetadata`，严格校验四族及会影响类型扫描的retained结构。原TypeRef、泛型、默认表达式、顺序、reply family和行为组不会先压缩为旧domain-decision表示。
- 公共`generators/scala-cqrs-classic`通过已有`generate-products → compileProductSet → planProductSet → applyEntries`执行；没有F1私有writer，没有从expected读取整个文件的模板。
- Protocol／Helpers／Entity／Behavior有独立Model、Builder、Template。共享类型/命名/context从固定Scala规则移植，原始模板文本与writer stamp分离。
- 仅可信classic scaffold目标＋producer＋产品组合可保留占位；现役完整profile限制不变，不允许JSON开关豁免。
- source依赖独立于import过滤，包含Behavior→Helpers及同包引用；文件级来源和完整product footprint走已有writer。未宣称全字段回锚闭环已验。
- 新`tools/codegen-parity.mjs`严格检查完整目录清单和所选完整文件Buffer字节；附属文件只列清单，不当parity计数。

## 真正执行过的反馈

| 环节 | 观察 |
|---|---|
| 传统源身份 | `cc335eb1e0d0fae17bf092fd61b126040196ea70`独占普通副本；706源与283基线记录核对，无生产树修改 |
| 构建 | 固定JDK11/Scala2.13.16/sbt1.11.7；build-05在原480秒窗口内成功（52.770秒）；前失败均保留 |
| 独立输入 | 同一固定源`Examples.bankingSystem`经独立Exporter输出159364 bytes，重复相同；不调用Builder或读取输出 |
| 传统真实生成 | 原公开`CodegenMain`两次各108文件，所有路径/字节重复一致 |
| 旧JS入口 | 对该输入真实exit2：不支持的document schema。是准入红灯，不是字节FAIL |
| 新JS入口 | 首次产物就4/4相同；初验A/B及最终候选A/B均通过。没有伪造先字节失败再修绿 |
| 合法输入变体 | 仅输入`BalanceChanged.timestamp: LongType→IntType`；重新编译输入类并走原CodegenMain。metadata只有1处变动，raw两次各108文件一致；JS变体4/4相同，仅四件中的Entity变为1374 bytes |
| 实际文件负对照 | 改空格、生成头、末尾换行、缺件、多件、把查询`???`修成实现，六组均exit1 |
| 准入反例 | unknown字段、缺字段、unknown MetaType、StructRef命令冒充结构、错误retained槽、allowPlaceholders均明确拒绝 |
| 合法准入观察 | system name含空格、精确tagged Double、inline VO、空命令、readonly-only均可plan；不冒称这些额外输入已做双端parity |
| 现役完整profile | 原domain fixture可plan21 entries；literal含`???`仍PRODUCT_ENTRY拒绝；allowPlaceholders仍未知字段拒绝。保持旧全文检查，不声称这是词法分析 |
| 比较器自身 | 66次合成CLI观察覆盖8MiB边、EPIPE/EFBIG、总报告预算、写后漂移和失败保留；与生成parity分账 |
| 独立复核 | 另agent直接读完整bytes/真实receipts核对，四件及来源结论成立；唯一探针预期误码已用新续接回执闭合 |

比较范围在运行前登记：108个Scala文件中4件参加parity，104件其它生成文件仅inventory；JS恰4件源码＋2件ledger/anchors。没有临时把差异文件塞入附属分区。

## 失败与修正未被抹除

- build-01：peer单JVM位未归还，未启动Java；显式归还后才执行。
- build-02：执行代理误用shell Node18，lease API失败；改用原固定Node22.23.4。
- build-03/04：sbt boot socket机械问题；修runner输入，不改生成器基准、不重置480秒预算。
- variant初次工作目录读取被sandbox拒绝；补本轮只读许可后成功，无网络/写权限扩张。
- final执行器误将合法`CLASSIC_REFERENCE`诊断期待为`CLASSIC_TYPE`，原`FAIL_STOPPED`保留。续接对齐真实诊断，补七项，不重新伪造产物或覆盖原失败。
- 只读审查识别retained错槽污染owner、StructRef种类未核、依赖只用imports等新增问题，已修且真实准入反例覆盖。原Scala业务/类型缺陷不借审查自动修成另一个基准。

## 可打开的证据

本机实施窗口：`../../.rounds/f1-byte-parity-20261116/`。

1. [最终闭合回执](../../.rounds/f1-byte-parity-20261116/final-execution/continuation-01/results-02/completion.json)：链接原失败，七项补跑结果及1092 pins无漂移。
2. [最终主批回执](../../.rounds/f1-byte-parity-20261116/final-execution/completion.json)：A/B/变体/六文件负对照以及保留的执行器误码。
3. [四件完整字节观察](../../.rounds/f1-byte-parity-20261116/final-execution/compare-a.observation.json)、[变体字节观察](../../.rounds/f1-byte-parity-20261116/final-execution/compare-variant.observation.json)。
4. [原Scala基准](../../.rounds/f1-byte-parity-20261116/reference/status-02.json)、[变体来源和真实运行](../../.rounds/f1-byte-parity-20261116/variant/result.json)。
5. [比较器自验](../../.rounds/f1-byte-parity-20261116/comparator-evidence/session-02/completion.json)、[现役profile限制观察](../../.rounds/f1-byte-parity-20261116/existing-profile-probes/completion.json)。
6. [源码写集合](../../.rounds/f1-byte-parity-20261116/change-inventory.json)、[审查裁定](../../.rounds/f1-byte-parity-20261116/REVIEW-RESOLUTIONS.md)。
7. [common 0.2.1实际供给](COMMON-CORE-021-CONSUMPTION.md)。

绝对本机日志是本轮审计证据，不是可移址依赖来源。复用fixture/expected资产独立存于`test/fixtures/classic-cqrs-f1/`与`test/reference/classic-cqrs-f1/`，来自原Scala真实输出，不从JS生成结果更新金样。

## 尚未完成

- 其余38族及所有条件变体／B输出并未因本批通过而完成；F2 Warehouse无损输入与expected也未完成。
- 原curated/用户目标四件仍另立合同，旧target manifest的`expectedSha=null`不是本轮raw expected缺失，二者不要混签。
- 三层/命名/Deposit等用户目标与Plain FP／ScalaCheck性质、复杂度实测、完整应用运行／回锚及银行消费仍在后续阶段。
- 当前公开classic入口是新增有限生成目标；现役银行service默认链没有切流。不是把另一个入口的PASS迁签给银行。
- 未提交推送、未发布runtime、未运行银行workshop/38、未改shared apps/作者树/既有ledger/journal。所有本轮JVM已wait/reap、组空，lease/协调位归还；失败资料和数据保留。
