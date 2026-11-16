# classic @3 — 反馈与修复记录

本包为普通聚合 Root／Factory 传统源码扩展。原字节范围见 [CLASSIC-V3-SCOPE](CLASSIC-V3-SCOPE.md)，限定结论及导航见 [实施收口](CLASSIC-V3-IMPLEMENTATION-CLOSEOUT.md)。独立源码审阅和实际来源／bytes／37回执核对已完成；本页保留反馈与历史失败来源，不把静态审阅或调用包装的成功替代完整验收。

## 1. 原始发射缺口

独立保管方先固定 17 件 Scala expected，再用公开 `tools/codegen-parity.mjs` 对原已验 `@2` 实际 baseline 输出比较：原 15 件全部相同，缺 Root 和 Factory 两件，实际退出 1。原 Scala 来源是已有四次成功公开 CodegenMain 实产，没有重新启动 JVM。

初始 gap 捕获的前三次 sandbox policy 漏读 comparator 的递归模块依赖，Node 在比较器执行前失败：依次为 `immutable-data.mjs`、`strict-json.mjs`、`products/request.mjs`。它们不能算已观察发射缺口。原失败日志保留；新 gap-04 补完明确只读库依赖后真实触达比较器。前三次实际耗时合计 571ms 从原 30 秒 allowance 扣除，gap-04 timeout 为 29429ms，没有重新获得 30 秒额度。

记录：`.rounds/classic-cqrs-v3-20261116-01/gap-04/completion.json`；原 gap、gap-02、gap-03 不改。

## 2. 独立原字节资产的可移植性修正

最初资产 manifest 把忽略目录内的 `assets/asset-preflight.json` 纳入必需 files。新 clone 无该报告，重放会被不相关的本机材料阻断。

独立 metadata owner 将该报告保留为 `availability: local-audit`、`requiredForReplay: false` 的来源指针；portable files 只列 39 份 shipped 资产（34 Scala、2 request、README、scope、provenance），manifest 自身不递归计 hash。34 份金样、两 request、scope、provenance 原字节未改。原保管报告仍为修正前历史证据，新 `assets/portable-metadata-check.json` 另存补正观察。

这项只修新资产元数据，不是调整 expected 来消除字节差异。

## 3. 静态审阅发现的真实接缝问题

独立 reviewer 构造：聚合的首个带参写命令声明另一聚合的 Reply。原 Scala Factory 将该回复类型只写在 `bodyLogic` 的 `ask[Reply]`，其 import dependencies 只收本聚合 reply family。新 JS 源码计划据 Model 依赖登记时可能漏对方 Protocol owner。

修法：

- `artifact()` 增加默认空的结构化 `references`。
- @3 producer 将实际初始化命令的 reply TypeRef 交给 Factory artifact。
- assembly 按既有物理 owner 路由计算 source-plan deps。
- renderer 仍只收原 Model；不补 raw imports，不修改 Scala金样，不改变 @1/@2 默认 references、footprint 或源码内容。

独立定点复核确认这条静态修复；实际 `cross-owner-reply` 公开 plan 已观察到 `ask[ReceiptAck]` 和 `ReceiptProtocol.scala` 依赖。新对照增添一个 aggregate，完整计划为22 entries，不拿这个多聚合 plan 冒称已有双端 Scala expected。

## 4. 正向核心的真实结果

`tools/codegen-parity/replay-classic-v3.mjs` 已实际运行：4 次公开 generate-products＋6 次公开 compare，10 条均退出0。

- baseline A/B、timestamp-int A/B 各与独立 expected **17/17 完整原字节相同**。
- 同输入 A/B sources-only 对照各17/17相同，零内容转换。
- direct expected inventory17／actual19；actual 的 ledger/anchors 不计 Scala。
- 两套 ledger 原 bytes 独立相同；anchors 只 inventory，不清洗输出根后比较。
- 519 个来源／资产／工具 pins 前后一致。

新 Root／Factory 第一次 JS 实际发射就匹配金样；未发生 byte-diff 修复，不能编造两次字节红→绿叙事。实际代码在 `.rounds/classic-cqrs-v3-replay-20261116-01/actual/`。

## 5. 补充执行包装的机械问题

1. 首 supplemental 运行在 `missing-factory` 停止：比较副本删除了 Factory，但保留空 factories 目录；policy 只从文件祖先收目录，没有给该空目录 `scandir` 只读权限。Comparator 真实退出2（EPERM），不是 byte门缺件检测失败。原失败保留，remaining-02 仅补空目录读权限，missing-factory 随后真实退出1。原失败910ms从该项30秒 allowance扣除，使用29090ms补跑。
2. 复制／修改 target 的调用在公开注册处正确拒绝，实际输出 `[FAIL] generator must be a shipped registered source producer`、退出2。Caller误要求输出中必须含 `PRODUCT_PRODUCER`，因 CLI 只打印消息而误判。新 post-execution reconciliation 按原实际消息和完整收尾回执核对；原调用不重跑、源码不改，remaining-03 承接其真实拒绝证据。

所有成功／失败原回执不覆盖。承接成功条目明确 carry，不能说每轮全部重新执行。原固定32分钟 wall deadline 保持，后续每命令另受剩余 wall／cleanup reserve限制。合法 plans和旧版本回归已经全部实际闭合；37有效接口观察之外，1次正式policy失败与4次初始gap process分开记账。最终独立 evidence audit 已核37逐id原回执、34金样、68actual源文件、原四套selected源和13相关冻结Scala源；结论PASS_SCOPED_EVIDENCE，newExecution=0、blocking issues=0。

最终源码 reviewer 的说明将未修改的 `lib/products/compile.mjs` 列入“8个tracked源码”标签，同时 `generators/scala-cqrs-classic-v2/produce.mjs` 已实际阅读但未列入该标签。主集成只读核 `git diff --name-only` 后确认8个真正修改源均在 reviewer 的完整 reviewedFiles 中；新增 `audit/source-scope-reconciliation.json` 补正文档标签，原source-review报告不改。不把错误标签当漏读代码，也不谎称原报告做了Git hunk比对。

## 6. 不迁签的边界

- 两个现有输入对 Root／Factory 没有 changed-output 扰动；合法额外 plan 只证明公开准入和被观察的发射路径，不是新增双端原字节验收。
- 九族、17件源码、37项接口观察是不同维度；不是42族全覆盖或业务用例数。
- raw同名 overload、重复 Future import、可选参数 default遗漏、RuleRule、错误 reply、MANUAL、`???` 均保留。`???` 只记作未来手写隔离归属候选。
- Plain FP、ScalaCheck、生成 Scala编译、金融规则、部署、发布/持久化/回复效果、运行库ABI及业务runtime本包均 NOT_RUN。
- 没有提交／推送、银行或shared app写入、新JVM／服务／下载。旧敏感来源排除与所有失败证据保留。
