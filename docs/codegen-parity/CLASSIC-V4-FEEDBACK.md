# classic @4：反馈环与原字节边界

本文只追加本包反馈记录，不改旧 @3 或原 Scala 成功／失败证据。真实public观察及独立证据审计已闭合，最终 `PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE` 仍只限raw源码＋有界接口；下面的原字节、来源与支持域观察不冒称应用行为验收。

独立证据报告：`.rounds/classic-cqrs-v4-20261117-01/audit/independent-evidence.json`，115976bytes，SHA256 `35a2684e8fc6d079e64dbe119078c9ff55fb9a8c04de606e50a5cb8decb97fa6`；issues=[]、auditor新runtime0。原static reports和WAIT观察不改时态。

## 1. 已观察的真实缺口

实施前使用公开 `tools/codegen-parity.mjs`，独立新十九件expected对比来源已核的旧@3实际baseline：

```text
status: different
exit: 1
compared paths: 19
expected inventory: 19
actual inventory: 19（17Scala＋2control）
equal files: 17
different files: 0
unavailable files: 2
missing: CreditBalanceRepository.scala / CreditBalanceRepositoryImpl.scala
```

来源与原bytes、scope、tool pins、真实raw receipt/stdout/stderr、children reaped均保存到本机新独占 `.rounds/classic-cqrs-v4-20261117-01/gap/run-01/`。没有重跑Scala，也没有新增JS generate来构造这份观察。这里证明的是“旧@3未发射两件”，不是这两件先前已经存在且byte错；不能虚构byte红→绿故事。

## 2. 同输入与独立 oracle

保管owner在实现前锁十九个完整路径，expected来自四套原公开CodegenMain成功实产及已验v3binarycopy，不由JS模板、actual或curated反推。两新增payload四套实际bytes/SHA一致；整个38Scala86073bytes有独立来源。Portable manifest要求44shipped assets（包含自身），local owner report是optional，不要求新clone有忽略目录文件。

原41个selected-route源码payload及35 docs/frozen-source pairs另认证来源：新六Repository MBT、复用Root/Factory和必要registry/type/naming/layout/knowledge/writer支持。不是“41整个generator依赖已编译”；没有读取/认证其他89原payload／套，没有JVM/编译/下载。

## 3. 不用“更正确”偷换原bytes

独立原源码指出三个不同事实：

- Port以原`CreditBalanceAggregate` metadata名合成 `CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily`，没有这个Protocol object。
- Impl剥解析Aggregate后缀，合成 `CreditBalanceProtocol.CreditBalanceCommandFamily`，该member未声明。
- 输入query返回实际的 `CreditBalanceProtocol.CreditBalanceCommand`，这是现有Protocol declaration。

所以不能把三者统一为一个“已解析命令族”再宣称rawbyte PASS。原Port/Impl各自的重复imports／distinct规则、不同LF、unused entityTypeKey、固定sharding RHS均照实保留。`@ImplementedBy`造成应用端口引用infra实现，亦不是用户目标依赖方向认证。

本包source path owner关联只能证明某引用联系哪个已生成文件，不保证成员存在、不提供alias、不创建另一个Protocol来凑编译。十九件仍non-runnable／not type-closed。

## 4. 反馈进入正确owner，而不改金样

- 缺件 → 新Port/Impl两个MBT组＋独立@4producer/target接线。
- 输入多参、generic参数、optional、错误返回等raw会丢参/错render → @4公开窄准入明确拒绝，不把限制当通用语义支持。
- 同名entityRef → 保留先解析后过滤的顺序，拒绝零参同名声明，不在filter前“方便跳过”。
- opposite-layer缺pair／unequal pair／resolved source alias → 编译/组装入口拒绝；不让全局registry first-match或ownerMap覆盖伪造唯一性。
- Port参数/返回TypeRefs、Impl首参数/返回TypeRefs → shared完整source reference收集；不能借去重删掉不同泛型的真实imports。
- 原关键词表遗漏`forSome`以及`_`特殊名 → @4限定域单列拒绝，不改旧@1–@3原naming行为。

模型依赖、原型/冻结边界由source review判断；公开CLI真实receipt、negative与重复/旧版本对账由运行观察判断；资产保管独立于实施。任何后续caller/policy机械失败要保留原件和时间消耗，不能改expected迎合错误oracle。

## 5. 公共接口而非单元自证

正式公开观察已实际完成50条：10generate＋19compare＋21plan，exit0/1/2＝26/7/17；核心10＋supplement40全部LIVE，carry0、自动重试0、正式机械失败0。四套@4各19/19完整raw bytes，两组sources-only确定性成立；535core／806supplement pins前后无漂移，直接children均closed/reaped、groupempty。预先独立缺件观察另1条，不加入这50正式条数。全51条publicCLI调用不是51族覆盖率。

7字节／membership negative真实exit1；17invalid plans真实exit2并核specific diagnostic；4legal plans真实exit0但applied=false、输出根未创建；旧@1/@2/@3两输入各4/4、15/15、17/17。不能把invalid的rawpassed=false改写为运行成功，也不能把plan当成独立Scala expected。

核心调用timeout合计660000ms，supplement1740000ms，正式合计2400000ms；实际process elapsed合计101567ms（core11434＋supp90133）。这不是wall预算：新正式总wall2520000ms，原deadline保持，收尾/phase约束另核。静态审阅发现的source drift、执行材料F1–F4及已成功gap未触发的F5失败路径保留记录，不把它们混为正式50条失败。

公开核心只编排 `generate-products` 与完整字节比较，禁止内部generator import-and-call、tests/typecheck代替。全scope十九件、exact19/21inventory、sources-only19/19、原Buffer、rawledger、anchorsinventory、完整membership与真实exit同时核对。负对照只修改隔离比较副本，不修改实际交付和expected。

额外legal/invalid plans执行真实public `--plan`，但不apply、不证明独立changed-outputScala parity。新增两件在两个既有input中相同；changed-output双端原expected仍OPEN。共享源码变更后的旧版本保护是新候选回归，不是把旧包37条全重跑。

## 6. 后续质量与业务义务不借本包消失

PlainFP、ScalaCheck、CC、ScalaCompilation、金融oracle、应用/银行runtime、common0.2.1消费者唯一供给与ABI/effects、字段级回锚均另验。原???只未来手写隔离归属候选，未经接口/owner/BDD合同不实施迁移。本包不恢复银行38、relay、R2、F2或三退休任意源码槽，不自动commit/push/release。
