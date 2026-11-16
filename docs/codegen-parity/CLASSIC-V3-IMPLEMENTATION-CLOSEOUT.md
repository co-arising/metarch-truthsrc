# classic @3 实施收口

## 当前状态

**PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE：两既有输入各17件完整Scala原字节、重复稳定性、负对照／准入／旧版本回归及独立源码／证据复核均已闭合。** 最终验收入口：[final-completion.json](../../.rounds/classic-cqrs-v3-20261116-01/final-completion.json)。该结论限于non-runnable scaffold，不签PlainFP／ScalaCheck／编译或业务runtime。

工作子仓 `metarch-truthsrc`，分支 `fix/classic-cqrs-f1-byte-parity`，基线 HEAD `19ac810163df57c9e5cf84b2c0baf7eec3c313c6`。本包修改尚未提交／推送；工作树不再是提交后窗口记录的 clean 状态。旧提交、窗口、金样与成功／失败证据均保留。

## 实施交付

- 新 `classic-architecture@3`／payload `/v3`／capability `classic-source-scaffold@3`／`scala-cqrs-classic-scaffold@3`，输入仍为完整classic schema `/v1`。
- 两个普通传统族：AggregateRoot＋AggregateFactory，各有独立 Model／Builder／Template。
- 复用 @2 原15件未 stamp 模型发射；@3独立完整 footprint 和 exact manifest/readiness/trusted Symbol；没有 caller JSON 占位开关。
- 主集成复用现有 TypeRef、naming、knowledge注释、complete-file assembly、公开 writer，记录跨聚合初始化reply的结构化owner依赖；不改 raw Factory import 和方法体。
- 独立保管34份完整Scala expected，来源为原成功公开Scala CodegenMain实产，不由 JSrenderer构造；41初始本机资产创建中，Git侧可移植集合为40件（34Scala＋2requests＋README/scope/provenance/manifest），ignored owner报告可选。
- 可复用 `tools/codegen-parity/replay-classic-v3.mjs`：4公开generate＋6公开compare，freshroot、120/30秒、固定wall和完整pins；不调用内部renderer作为验收。

## 实际接口观察

| 项目 | 已观察结果 | 不可迁签 |
|---|---|---|
| @3 baseline A/B | 各17/17完整文件原字节一致 | 不是业务用例数 |
| @3 timestamp-int A/B | 各17/17完整文件原字节一致 | 新Root/Factory本身无类型扰动 |
| 同输入源码确定性 | 两次publiccompare各17/17；sources-only原bytes | 没有归一化anchors中的输出根 |
| old @1 回归 | 两输入各4/4 | 不重开原完成账 |
| old @2 回归 | 两输入各15/15 | manifest及四／七族意义未扩大 |
| 文件负对照 | 7项各真实exit1 | 原nonzero supervisor.passed=false保持 |
| 非法准入 | 5项各真实exit2 | 复制target拒绝是注册门，不是内部Symbol注入实测 |
| 合法额外plans | 7项exit0；跨owner回复plan22entries依赖对方Protocol | 非独立Scala变体parity |

有效观察 **37**：8次generate、17次compare、12次plan；exit0/1/2 = **25/7/5**。final supplement承接12条已核原回执，再实际执行15条；核心10条为另外的真实调用，不说所有项重新执行。

完整正向源码每套：baseline40369 bytes／timestamp-int40368 bytes。两套独立expected34份共80737bytes；四套JSactual各17件。direct expected inventory17／actual19；ledger/anchors独立计账。核心519pins、最后supplement768pins前后无漂移。子进程已reaped、记录中group空；原32分钟wall不延长。

首supplement缺件policy失败额外1条，不计有效37；复制target的真实拒绝被caller误oracle停下，补正不新增该项调用。初始gap阶段另外4个公开process尝试（3个Node模块准入失败＋1个真实缺两件比较），与正式37项区分。实际公开子进程合计 **42=37有效＋1正式policy失败＋4初始gap**，不能称42族验收。37项成功/期望非零回执的timeout合计1829090ms，原caps1830000ms减去失败消耗910ms；含失败正式process elapsed合计43892ms，实际wall（含用户暂停／准备）另按原deadline核，不能用elapsed合计刷新预算。技术性失败不是生成器字节红灯。详情见 [反馈记录](CLASSIC-V3-FEEDBACK.md)。

## 哪里看实际生成代码

修后的公开CLI实际输出：

`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v3-replay-20261116-01/actual/baseline-a/app/net/imadz/banking/`

新增两文件：

- [CreditBalanceAggregate.scala](../../.rounds/classic-cqrs-v3-replay-20261116-01/actual/baseline-a/app/net/imadz/banking/application/aggregates/CreditBalanceAggregate.scala)
- [CreditBalanceAggregateFactory.scala](../../.rounds/classic-cqrs-v3-replay-20261116-01/actual/baseline-a/app/net/imadz/banking/application/aggregates/factories/CreditBalanceAggregateFactory.scala)

同批重复在 `actual/baseline-b/`，类型变体在 `actual/timestamp-int-{a,b}/`。本机actual不是sharedapp，也不属于Git金样。

仓内可移植的独立Scala参考（**本包尚未提交**）：[`test/reference/classic-cqrs-v3/README.md`](../../test/reference/classic-cqrs-v3/README.md)及其两个variant目录。源码相同但来源不同，不能将金样叫作JS实际生成目录；当前新clone尚不包含本包未提交资产。

公开重放（物理子仓根、Node>=22.13、Darwin、freshcanonicalroot）：

```sh
node tools/codegen-parity/replay-classic-v3.mjs \
  --out "$PWD/.rounds/my-classic-v3-replay"
```

禁止输出到金样、sharedapp或旧运行树；不存在的outputroot仅可放物理 `.rounds/` 或系统temporary目录的directchild。

## 仍未完成

本包仍 **non-runnable scaffold**，不是银行可运行版本。保留raw RuleRule、同名Factory overload、重复Future import、optional模型default未印到方法签名、错误reply、MANUAL和`???`。占位只记作未来手写隔离归属候选，未实施迁移／接线。

其余传统族／条件／B、F2无损输入与expected、四classicTrigger、curated用户target、Plain FP／ScalaCheck／复杂度、完整字段回锚、真实应用／银行consumer、common0.2.1唯一供给及ABI/effects均分账待验；不以17/17或37接口数字签收。

本包无新Scala/JVM/build/test/typecheck/services/downloads/runtime publication；不修改作者树、sharedapps、既有generated/.truthsrc/ledger/anchors/journal，不commit/push/merge/worktree/stash/reset/clean。两个敏感历史snapshot仍排除，其他91原payload/套未读。
