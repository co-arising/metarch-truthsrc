# classic @4：仓库两族实施收口

## 当前检查点

本包 JS 生成器实施及真实公开CLI观察已完成；独立源码复核 `PASS_SCOPED_STATIC_REVIEW`、执行材料静态复核 `PASS_SCOPED_STATIC_MECHANICS`、独立证据审计 `PASS_SCOPED_EVIDENCE` 均闭合，没有当前阻断项。最终结论 **`PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE`**：仅两份完整既有input的十九件raw源码及本包有界public接口，不认证类型闭包／编译／用户target或业务runtime。

最终机器记录：

```text
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-20261117-01/final-completion.json
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-20261117-01/audit/independent-evidence.json
```

独立证据报告115976bytes，SHA256 `35a2684e8fc6d079e64dbe119078c9ff55fb9a8c04de606e50a5cb8decb97fa6`，newRuntimeExecutions=0。原 `postexecution-observations.json` 的WAIT状态是写成时点，保持原件，不改为新执行或重复审计。

- 子仓：`/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc`
- HEAD：`2a06dd319690dcb6c8907821ea2bdaa942e293f1`（@3已提交；本@4仍未提交）
- 分支：`fix/classic-cqrs-f1-byte-parity`
- 不push、merge、tag、release或修改其它仓库；没有新JVM/build/tests/typecheck/金融/银行runtime。

## 已交付代码与独立资产

新增六个不可变Model/Builder/Template模块、精确 `classic-architecture@4` public producer/target、薄core replay及范围/反馈文档。修改八个既有源码接缝与主导航；原 @1/@2/@3 意义及独立金样不变。

Port／Impl分别由application.repositories／infrastructure.repositories原声明调度，窄query／two-layer pair准入fail closed；不切换银行local cache、不替换正式Play-service或family2。模型完整结构字段、raw命名、import差异、aggregate来源、固定实现RHS、LF均保留。

独立 `test/reference/classic-cqrs-v4/`：38完整Scala86073bytes，baseline每19件43037、timestamp-int每19件43036。原十九个selected payload在四套传统CodegenMain实产中独立认证，新增Port1425／Impl1243bytes直接binarycopy；没有JS造expected。Portable43rows＋manifestself44；local audit不要求新clone携带。源保管41payload／35 docs-pairs是有界selected-route库存，不是全构建依赖认证；原其它89payload／套未读／未认证。

## 真实公开观察

| 类别 | 实际结果 | 限制 |
|---|---|---|
| baseline A/B | 各19/19完整原bytes一致 | 非类型／金融正确性 |
| timestamp-int A/B | 各19/19完整原bytes一致 | 新Port/Impl未随该扰动改变 |
| 两组sources-only A/B | 各19/19 | 原Buffer捕获，无normalization |
| negative7 | 全部真实exit1 | only isolated copy mutation |
| invalidplan17 | 全部真实exit2、specific gate | 不apply；rawpassed=false保留 |
| legalplan4 | 全部exit0/applied=false，未创建out | 不是独立changed-outputScala parity |
| @1/@2/@3保护 | 两input各4/4、15/15、17/17 | 本候选共享源码回归，非旧包全重跑 |

50正式LIVE calls＝10generate＋19compare＋21plan，exit0/1/2＝26/7/17；core10＋supp40，carry0、重试0、formal failure0、remaining0。实施前公开missing2 gap另1条，全51publicCLI不是51族。四套@4共76Scala172146bytes。

535core／806supplement pins当前无漂移；所有正式direct children closed/reaped/groupempty。原总wall2520000ms（42分钟）不延，core720000/supp1800000 phase约束与20秒reserve；timeout总2400000ms，process elapsed总101567ms（11434＋90133），不能用elapsed当新的wall额度。

核心原回执：

```text
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-replay-20261117-01/completion.json
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-20261117-01/remaining/run-01/completion.json
```

## 反馈与历史证据保留

原@3对新十九件expected实际 `17equal＋missing2`，exit1；新两件首次真实@4生成即与原expected一致，不虚构有过byte错修复。

初始source review跨过主集成补`_` keyword拒绝的两个状态，因此BLOCKED；保留原report，新冻结diff/19code pins独立review02通过。执行材料review在正式run前发现protected旧资产read、exclusive root、deadline sealing、spawn accounting四项漏洞，局部修复、新静态review02通过。

原成功gap的脚本有未触发post-spawn throw时artifact pin遗漏（F5）：原实际helper正常返回、三artifact pins完整、direct child reaped；保留脚本/receipt，不retrofix或重跑。F5是历史未演练路径限制，不称已修好、不复用那条脚本。以上static finding与formal50失败分账。

## 实际生成代码（可复制绝对路径）

Port，默认方法第24行、显式query第27行：

```text
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-replay-20261117-01/actual/baseline-a/app/net/imadz/banking/application/aggregates/repository/CreditBalanceRepository.scala
```

Impl，默认方法第21行、显式query第24行：

```text
/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/.rounds/classic-cqrs-v4-replay-20261117-01/actual/baseline-a/app/net/imadz/banking/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala
```

## 必须保留的非通过结论

十九件 **non-runnable／not type-closed**：Port坏 `CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily` 与Impl缺 `CreditBalanceProtocol.CreditBalanceCommandFamily` 原字节保留；实际Protocol声明CreditBalanceCommand。没有alias／新Protocol修补。Port的 @ImplementedBy 应用→infra依赖亦不是用户目标分层签收。

PlainFP、ScalaCheck、CC、ScalaCompilation、BusinessRuntime、FinancialOracle、RuntimeAbiEffects、BankConsumerMigration均NOT_RUN。其余传统族/conditions/B/F2/四classicTrigger、changed-output新Port/Impl独立expected、用户target、字段回锚仍OPEN。???仅未来手写隔离归属候选，不立即迁移或实现金融规则。

没有自动push/commit/发布/newworktree/stash/reset/clean/sharedapp/journal写或恢复旧银行38/relay/R2任务。旧成功/失败/precommit验收、敏感baseline排除与冻结制品全部保持。
