# F1 CreditBalance 输入映射合同（惰性设计资产）

状态：`content-specification`；`lossless=false`；真正双端同输入 fixture **blocked**。本文及 [mapping.json](mapping.json) 不是作者树、request、公共 DSL、目标 expected，也不构成生成器实施批准。`generationExecuted=false`；生成、validate、roundtrip、编译、测试、typecheck、服务、下载、发布均未执行，**CC 全部未测**。

这两份映射文档来自主agent原分工（非用户逐字原话）；本轮用户允许docs-only纠正，主集成者已移交指定四份F1既存稿编辑权。修改前Read并核指定SHA，冲突立即停止，不覆盖peer。仅静态来源/JSON/链接/指纹检查，不称运行验收。common-core 演进归另一会话；沿用主agent转述的坐标 `net.imadz:common-core_2.13:0.2`（非用户逐字引文或制品字节证据），优先发布制品，字节/API 实施前另锁；`withPost` / `policy` 不是发布 API，本轮未调查或修改 glue。没有外部源码补拷。

## 1. 固定来源身份与引用规则

以下 source key 一律定位固定 baseline 文件或本次所读文档版本；完整 SHA-256 是来源字节指纹，**不是 targetExpectedSha**。`key:行` 只是节省表格宽度；每条链接与 JSON sourcePins 都含确切文件。真实用户要求与主agent分工/转述分列；内部提示不升格为用户授权，也不伪造文件/行号。raw 推导均为对 non-formal 分支的静态阅读，不是调用 Builder/Template 得到的实际输出。

| key | 来源身份 | 固定文件 / 引用行 | SHA-256 |
|---|---|---|---|
| R | fixed-baseline / raw hand-authored Scala SystemMetadata; not generated output | [baseline/bc/src/main/scala/net/imadz/meta/Examples.scala](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala)；6–9, 6–28, 20–31, 22, 24–29, 25, 26, 27, 28, 33–71, 35, 36, 37, 38, 39, 40, 41, 43, 43–57, 45, 47, 47–55, 48, 49, 50, 51, 52, 53, 54, 55, 60, 60–68, 60–96, 61, 62, 63, 64, 65, 66, 68, 70, 83, 83–162, 84, 85, 86, 88, 89, 90, 92, 93, 94, 96, 119–130, 121, 122, 123, 125, 126, 134–145, 137, 137–161, 364–365 | `aaa4fbe90fa903e4e133014276506c2d18781c599a27385e8948ada9e8ebdeb3` |
| M | fixed-baseline / raw metadata declaration | [baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala)；136–140, 136–178, 167–178, 209–230, 209–237, 352–356, 352–382, 379–382, 423–433 | `1e776b3aa379257fc939931aedfa95cfe7f4215ce6f14311ed90b80caf11b06f` |
| PB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala)；18–20, 25–35, 25–77, 43–69, 88–106 | `fef186e632228c930f3c9c5db177653e4609f4b8baf50f8aacae09736640596d` |
| PT | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala)；25–62, 42–62, 58–62, 89–108 | `25fd60e6c669ef03b4d0b3165f34c8629c758276cb70328831407a37835d313a` |
| HB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala)；22–41, 28–35, 28–41, 41, 73–129, 79–119, 110–119 | `6a46c0d8420639ec87352e1c26f20f2ac5bea541d8fc7b1e15af5e9218db44fb` |
| HT | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala)；27–66, 45–62 | `999303df54f728e2096789493a7d07b3f8d41ed1b5d3f25b99b0589d02536d1c` |
| BB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala)；23–78, 38–47, 270–310 | `18fbec829c7443ae61c17cc11e13d2ef394832d6066a515c3711a71b0937f341` |
| BT | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala)；38–40, 39–40, 77–88, 80–88, 129–145 | `8e01fd549619334ed21a5eb78f5bbd2aa9889f93d8af94d18ea5233d3456410e` |
| EB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala)；156–193, 174–193, 185–209, 197–209, 214–267 | `29f7d954afc5244ee33bbc5d64a4d4bd4915e5677b6902d6265ffb2490284563` |
| ET | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala)；33–95, 44–63, 48–63, 66–95 | `b5d64f4d21e71e6eee41af8a2c7e9b1f1652de13b53ed324c335b782fb9a314d` |
| FB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala)；138–164, 262–266, 262–311, 270–311 | `1f38a82acbfe56ccab91d18741f20eb911d6851153134264f9a55548d35e4a87` |
| FT | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala)；31–50, 31–82, 52–76, 62–76, 80–82 | `59725ae168286fa5a2d13bc7d2fc5f3078e68c875342b8a1b76aca4056093a51` |
| IB | fixed-baseline / raw builder | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/InvariantRuleBuilder.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/InvariantRuleBuilder.scala)；22–43, 35–43 | `6d0f5e29e33fba5b6d8669c0c74577728b50095c7b9a7142b4b5123a97ece0d7` |
| IT | fixed-baseline / raw template | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala)；27–68, 34–68, 58–67 | `de5285cf72e959e415420ff0063d7f307b15f99fc06043e729e178314eaefd23` |
| N | fixed-baseline / raw naming support | [baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala)；125, 187–224 | `d9b8cb3533ebd93866d86523086b4790f2de247cd6751c67d8ad644c31c80166` |
| T | fixed-baseline / raw type resolver support; only invariantRule excerpt inspected | [baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala)；371–379 | `1f17bf4ac92b11f3c29dbeacc3378cee54abb3d1f5cb82947edf183ace8b13ba` |
| CP | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala)；1–8, 1–39, 15, 15–36, 16, 17, 18, 20, 21, 22, 24, 25, 26, 29, 29–36, 30, 31, 32, 33, 34, 35, 38–39 | `9f860bbafefdc4200d2f211c5c68524130892e022c5417535722afa33c767a54` |
| CH | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala)；13–94, 17–24, 17–42, 17–94, 26–33, 35–42, 46–52, 46–94, 54–60, 62–68, 72–78, 80–86, 88–94 | `ec0c4f05e9398b8fd8aa1a93d6aafbe10a845e687bdffc27d3510e51a177d531` |
| CB | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala)；9–55, 12, 12–30, 12–54, 20–21, 20–54, 23–24, 26–27, 29–30, 35–36, 38–39, 41–42, 47–48, 50–51, 53–54 | `ee01261c6fbe640134dbcbc3c764882e8d5c2fd91897191a1048ad22e81d3d96` |
| CE | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala)；1–27, 11–13, 11–23, 13, 16, 16–23, 17, 18, 19, 20, 21, 22, 23 | `c2e41213ec31561448256c2cec955ce589e7e0a39b721a11828c37ec6b3bd555` |
| CF | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala)；10–57, 11–44, 12–13, 15–19, 20–23, 24–28, 30–33, 34–38, 34–48, 39–42, 46–49, 46–57, 51–53, 55–57 | `6af6ca27ed6b4c49559f35a5cd86850a2f24624044321c83d853c33c2e422534` |
| CM | fixed-baseline / independent curated reference; not raw output or frozen expected | [baseline/curated-scala/net/imadz/domain/values/Money.scala](../../baseline/curated-scala/net/imadz/domain/values/Money.scala)；6–20, 12–15 | `c5cf36d17384ac2927f58a3336774d11015cb83dbcf44d8463bc6ff0cd3cc429` |
| CONTRACT | document snapshot / specification or decision; not implementation evidence | [FIXTURE-AND-EXPECTED-CONTRACT.md](../../FIXTURE-AND-EXPECTED-CONTRACT.md)；3, 7–14, 18–50, 28–36, 33–38, 34, 36, 40–50, 111–115, 113–115 | `cced314341408c7834bfdd8723aa55ac9ae39ea85c50e74a651b2052a7df2222` |
| AUTHORING | document snapshot / specification or decision; not implementation evidence | [AUTHORING-CONTRACT.md](../../AUTHORING-CONTRACT.md)；3, 25–39, 34–39, 38, 45–48 | `9c827000f1e864b6a86a04a855df4853a4457b854bd5b2f0bfff14b1ce9514a9` |
| EVIDENCE-MD | document snapshot / secondary F1 source evidence | [details/fixture-source-evidence.md](../../details/fixture-source-evidence.md)；23–76, 55–59, 73–76, 75–76 | `2e8298e923144376ff26f7a5551f762379b85fbd119bebfc41b5e4704f2a7ae9` |
| EVIDENCE-JSON | document snapshot / secondary F1 source evidence | [details/fixture-source-evidence.json](../../details/fixture-source-evidence.json)；62–353, 339–352 | `0e7c861823141b2d603a341c475ae5913ff6b70090814aab66445cf2829bf0e4` |
| DP | document snapshot / specification or decision; not implementation evidence | [diffs/application-protocol.diff.md](../../diffs/application-protocol.diff.md)；92–104, 520–531 | `8c7e77f7d7ed38b5be82146341c0cfd980aac8688036c5aafa916d88feb97b2a` |
| DH | document snapshot / specification or decision; not implementation evidence | [diffs/command-helper.diff.md](../../diffs/command-helper.diff.md)；132–166, 138 | `c4ca1efdf46fa64dd4594a4f6f5a7e83bc6445222272a7c3a30829b5dd73987f` |
| DB | document snapshot / specification or decision; not implementation evidence | [diffs/aggregate-behavior.diff.md](../../diffs/aggregate-behavior.diff.md)；83–108 | `a88fb0d7b440240f317aa99ec126de710b9c7dfe144cb63def6260c4ba0929d4` |
| DE | document snapshot / specification or decision; not implementation evidence | [diffs/domain-entity.diff.md](../../diffs/domain-entity.diff.md)；26–51, 49–51 | `eda7e9067e5f784315365746d1bdd4763d62641e347b886bf27fbfd8da65cc45` |
| DF | document snapshot / specification or decision; not implementation evidence | [diffs/event-handler.diff.md](../../diffs/event-handler.diff.md)；645–652, 647–652 | `5db0fbe67fafbbd4677838b6b920fe28c45c5a090ff1dcc3c49b76b2f9a9ba5d` |
| DI | document snapshot / specification or decision; not implementation evidence | [diffs/invariant-rule.diff.md](../../diffs/invariant-rule.diff.md)；593–629 | `feef4a0c20c23fb71b8ffaecd988ae04edc8ea6b7385d41425f7f34d8f4a6548` |
| RETIRE | document snapshot / specification or decision; not implementation evidence | [PARTITION-RESOLUTIONS.md](../../PARTITION-RESOLUTIONS.md)；127–134, 132 | `9c51246256a11490162991a87bb6839fe85d20b4d77f887973734eeacff73997` |
| C-AddInitialOnlyOnceRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/AddInitialOnlyOnceRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/AddInitialOnlyOnceRule.scala)；1–15 | `f6087ec6ef6bad8f745b75ffc9ff88d00b5481a523da67936135621231683f6c` |
| C-DepositRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/DepositRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/DepositRule.scala)；1–13 | `bf8380933a957c9840269934cdc1a191775dc327ef0ad7614253390239604a8f` |
| C-WithdrawRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala)；1–19, 11–17 | `534804b492c23f80c91c77dba09246a739cd5412c18e9e5f4500043bbaf8da7a` |
| C-ReserveFundsRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala)；1–26, 9–24 | `215b4955a4ddddf31d5bc32229f9393ab0827768aaf121d9f59920e25b5bb335` |
| C-DeductFundsRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/DeductFundsRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/DeductFundsRule.scala)；1–15 | `2f99e5ed961688c11caa0976b96367475dab1a8e4e299c98365e34ea3574a015` |
| C-ReleaseReservedFundsRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/ReleaseReservedFundsRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/ReleaseReservedFundsRule.scala)；1–15 | `204051bfa90df2eff7a898198f5284bdf5fd7f90da383eb5ed1e17884109a80e` |
| C-RecordIncomingCreditsRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/RecordIncomingCreditsRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/RecordIncomingCreditsRule.scala)；1–15 | `66cac8e8033087cd7ee8a9fe4c41723f1e6fe4901f77cd5cb32377e52d7e550b` |
| C-CommitIncomingCreditsRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/CommitIncomingCreditsRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/CommitIncomingCreditsRule.scala)；1–13 | `c27003e7efb89c1edd9d22e11e8ef23bc456237040e6e7b7663a05ebeab47d3d` |
| C-CancelIncomingCreditRule | fixed-baseline / curated financial algorithm; preservation is not approval | [baseline/curated-scala/net/imadz/domain/invariants/CancelIncomingCreditRule.scala](../../baseline/curated-scala/net/imadz/domain/invariants/CancelIncomingCreditRule.scala)；1–13 | `4a4602af3d92965275cfd3ea45b3c9861b136e1f763a79d0d59c887e92334e41` |

入口为 `Examples.bankingSystem`：`BankingSystem` / context `banking` / `CreditBalanceAggregate`，不是同名银行实例。范围只取 aggregate 纵切及所需闭包；整系统其它服务、查询、投影、Saga、API不自动纳入。[R:134–162](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L134-L162)、[R:364–365](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L364-L365)、[CONTRACT:18–24](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L18-L24)

## 2. 十条命令：原字段顺序、纯参数、两臂与调用

实物计数 **10 条 = 9 写 + GetBalance 1 只读**；raw Protocol 与 curated Protocol 命令顺序相同。业务参数均 `optional=false`、`optionalWhen=""`、无 noteId；`replyTo` 不是原业务参数；仅rawBuilderTemplate分支由PB根据 `replyToType` 在末尾合成。curated字段的origin逐项指向CP独立声明，raw对应槽另记correspondsToRaw，不声称curated由PB生成；replyTo不能进入纯参数、state或event。`Id` 保留 `net.imadz.common.CommonTypes.Id`；`Money` 原定义字段是 `(amount: BigDecimal, currency: java.util.Currency)`，不替换成 minorUnits/String。[R:6–23](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L6-L23)、[R:83–96](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L83-L96)、[M:167–178](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L167-L178)、[PB:43–69](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L43-L69)、[CP:15–26](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L15-L26)

| raw序 / 命令 | 完整Actor字段（按序，含末尾replyTo） | 纯param / toParam | 读写；rule metadata | raw / curated证据 |
|---|---|---|---|---|
| 1 / AddInitial | `initial: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | `Money` / `command.initial` | write；`AddInitialOnlyOnceRule` | [R:83](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L83)、[CP:15](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L15) |
| 2 / Deposit | `change: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | `Money` / `command.change` | write；`DepositRule` | [R:84](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L84)、[CP:16](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L16) |
| 3 / Withdraw | `change: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | `Money` / `command.change` | write；`WithdrawRule` | [R:85](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L85)、[CP:17](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L17) |
| 4 / GetBalance | `replyTo: ActorRef[CreditBalanceConfirmation]` | 不适用；无Helper/无CommandHandlingFlow | read-only；`无` | [R:86](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L86)、[CP:18](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L18) |
| 5 / ReserveFunds | `transferId: Id, amount: Money, replyTo: ActorRef[FundsReservationConfirmation]` | `(Id, Money)` / `(command.transferId, command.amount)` | write；`ReserveFundsRule` | [R:88](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L88)、[CP:20](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L20) |
| 6 / DeductFunds | `transferId: Id, replyTo: ActorRef[FundsDeductionConfirmation]` | `Id` / `command.transferId` | write；`DeductFundsRule` | [R:89](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L89)、[CP:21](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L21) |
| 7 / ReleaseReservedFunds | `transferId: Id, replyTo: ActorRef[FundsReleaseConfirmation]` | `Id` / `command.transferId` | write；`ReleaseReservedFundsRule` | [R:90](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L90)、[CP:22](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L22) |
| 8 / RecordIncomingCredits | `transferId: Id, amount: Money, replyTo: ActorRef[RecordIncomingCreditsConfirmation]` | `(Id, Money)` / `(command.transferId, command.amount)` | write；`RecordIncomingCreditsRule` | [R:92](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L92)、[CP:24](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L24) |
| 9 / CommitIncomingCredits | `transferId: Id, replyTo: ActorRef[CommitIncomingCreditsConfirmation]` | `Id` / `command.transferId` | write；`CommitIncomingCreditsRule` | [R:93](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L93)、[CP:25](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L25) |
| 10 / CancelIncomingCredit | `transferId: Id, replyTo: ActorRef[CancelIncomingCreditConfirmation]` | `Id` / `command.transferId` | write；`CancelIncomingCreditRule` | [R:94](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L94)、[CP:26](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L26) |

### 2.1 回复字段不是机械构造器的位置猜测

raw `CreditBalanceReply` 元数据共7项；PB/PT把每项直接发为 `extends CborSerializable`，并不发同名统一回复 trait。curated 也是直接 parent，但多了第8项 `TransferConfirmation(transferId: Id, error: Option[iMadzError])`。此额外项不得静默加入 raw 或删出 curated，`B-reply-extra` 未决。[R:60–68](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60-L68)、[PB:25–35](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L25-L35)、[PT:58–62](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L58-L62)、[CP:29–36](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L29-L36)

| 序 | 具体Reply | 字段顺序 | 来源 |
|---|---|---|---|
| 1 | CreditBalanceConfirmation | `error: Option[iMadzError], balances: List[Money]` | [R:60](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60)、[CP:29](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L29) |
| 2 | FundsReservationConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:61](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L61)、[CP:30](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L30) |
| 3 | FundsDeductionConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:62](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L62)、[CP:31](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L31) |
| 4 | FundsReleaseConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:63](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L63)、[CP:32](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L32) |
| 5 | RecordIncomingCreditsConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:64](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L64)、[CP:33](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L33) |
| 6 | CommitIncomingCreditsConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:65](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L65)、[CP:34](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L34) |
| 7 | CancelIncomingCreditConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:66](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L66)、[CP:35](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L35) |

`ReplyMappingConfig(successReplyRef, failureReplyRef)` 仅存类型引用；HB28–35只读取 success，HB79–94按参数数量取标量/tuple，HB110–119按位置拼回复。HT45–62把三方法body放在各自MANUAL内；源码注释“MANUAL外/可编译”不能推翻模板实物。[M:379–382](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L379-L382)、[HB:28–35](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L28-L35)、[HB:79–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L79-L119)、[HT:45–62](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L45-L62)

| 命令 | raw success / failure（静态推导，非实跑） | curated success / failure（原形参state） | 用户覆盖 / 待裁候选 → 仍缺语义 |
|---|---|---|---|
| AddInitial | `CreditBalanceConfirmation(param, None)`<br>`CreditBalanceConfirmation(param, Some(error))` | `CreditBalanceConfirmation(None, state.accountBalance.values.toList)`<br>`CreditBalanceConfirmation(Some(error), Nil)`<br>[CB:20–21](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L20-L21)、[CH:17–24](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L24) | U-protocol / U-effects → P-balance-replies（curated候选 / proposed-default，decision-required）；同形两臂不构成授权，raw字段级绑定与算法仍blocked；`lossless=false` |
| Deposit | `CreditBalanceConfirmation(param, None)`<br>`CreditBalanceConfirmation(param, Some(error))` | `CreditBalanceConfirmation(None, state.accountBalance.values.toList)`<br>`CreditBalanceConfirmation(Some(error), Nil)`<br>[CB:26–27](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L26-L27)、[CH:35–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42) | U-protocol / U-effects / U-balance-replies → 仅Deposit点名三方法示例属user-required；raw仍缺字段级绑定，规则算法另blocked；`lossless=false` |
| Withdraw | `CreditBalanceConfirmation(param, None)`<br>`CreditBalanceConfirmation(param, Some(error))` | `CreditBalanceConfirmation(None, state.accountBalance.values.toList)`<br>`CreditBalanceConfirmation(Some(error), Nil)`<br>[CB:23–24](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L23-L24)、[CH:26–33](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L26-L33) | U-protocol / U-effects → P-balance-replies（curated候选 / proposed-default，decision-required）；同形两臂不构成授权，raw字段级绑定与算法仍blocked；`lossless=false` |
| GetBalance | 无Helper；`Effect.reply(cmd.replyTo)(???)` | `Effect.reply(replyTo)(CreditBalanceConfirmation(None, state.accountBalance.values.toList))`<br>failure不适用，无失败臂<br>[CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30) | U-protocol → P-get-balance，投影/顺序尚须显式输入；`lossless=false` |
| ReserveFunds | `FundsReservationConfirmation(param._1, None)`<br>`FundsReservationConfirmation(param._1, Some(error))` | `FundsReservationConfirmation(param._1, None)`<br>`FundsReservationConfirmation(param._1, Some(error))`<br>[CB:35–36](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L35-L36)、[CH:46–52](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L46-L52) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |
| DeductFunds | `FundsDeductionConfirmation(param, None)`<br>`FundsDeductionConfirmation(param, Some(error))` | `FundsDeductionConfirmation(param, None)`<br>`FundsDeductionConfirmation(param, Some(error))`<br>[CB:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L38-L39)、[CH:54–60](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L54-L60) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |
| ReleaseReservedFunds | `FundsReleaseConfirmation(param, None)`<br>`FundsReleaseConfirmation(param, Some(error))` | `FundsReleaseConfirmation(param, None)`<br>`FundsReleaseConfirmation(param, Some(error))`<br>[CB:41–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L41-L42)、[CH:62–68](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L62-L68) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |
| RecordIncomingCredits | `RecordIncomingCreditsConfirmation(param._1, None)`<br>`RecordIncomingCreditsConfirmation(param._1, Some(error))` | `RecordIncomingCreditsConfirmation(param._1, None)`<br>`RecordIncomingCreditsConfirmation(param._1, Some(error))`<br>[CB:47–48](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L47-L48)、[CH:72–78](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L72-L78) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |
| CommitIncomingCredits | `CommitIncomingCreditsConfirmation(param, None)`<br>`CommitIncomingCreditsConfirmation(param, Some(error))` | `CommitIncomingCreditsConfirmation(param, None)`<br>`CommitIncomingCreditsConfirmation(param, Some(error))`<br>[CB:50–51](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L50-L51)、[CH:80–86](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L80-L86) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |
| CancelIncomingCredit | `CancelIncomingCreditConfirmation(param, None)`<br>`CancelIncomingCreditConfirmation(param, Some(error))` | `CancelIncomingCreditConfirmation(param, None)`<br>`CancelIncomingCreditConfirmation(param, Some(error))`<br>[CB:53–54](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L53-L54)、[CH:88–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L88-L94) | U-protocol / U-effects → P-six-replies；位置表达式相同不是显式输入语义；`lossless=false` |

前三条raw `CreditBalanceConfirmation(param, None)` / `(param, Some(error))` 与实际 `(error, balances)` 类型/位置不符；不能称可编译raw金样。目标success中的 `newState` 是合同语义名，curated原参数名为 `state`；不得伪造curated源码或用旧state余额回复。其余六条只是短名RHS文本相同，FQN、输入来源、制品和业务语义仍未闭合。[CONTRACT:33–38](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L33-L38)、[CH:17–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L94)、[HB:110–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L110-L119)

### 2.2 Behavior具体符号、顺序和副作用边界

| 命令 | raw模板接线（含静态命名结果） | curated接线 |
|---|---|---|
| AddInitial | `runReplyingPolicy(AddInitialOnlyOnceRuleRule, AddInitialHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(AddInitialOnlyOnceRule, AddInitialHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:20–21](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L20-L21) |
| Deposit | `runReplyingPolicy(DepositRuleRule, DepositHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(DepositRule, DepositHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:26–27](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L26-L27) |
| Withdraw | `runReplyingPolicy(WithdrawRuleRule, WithdrawHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(WithdrawRule, WithdrawHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:23–24](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L23-L24) |
| GetBalance | `Effect.reply(cmd.replyTo)(???)` | `Effect.reply(replyTo)(CreditBalanceConfirmation(None, state.accountBalance.values.toList))`；[CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30) |
| ReserveFunds | `runReplyingPolicy(ReserveFundsRuleRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(ReserveFundsRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:35–36](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L35-L36) |
| DeductFunds | `runReplyingPolicy(DeductFundsRuleRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(DeductFundsRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L38-L39) |
| ReleaseReservedFunds | `runReplyingPolicy(ReleaseReservedFundsRuleRule, ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(ReleaseReservedFundsRule, ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:41–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L41-L42) |
| RecordIncomingCredits | `runReplyingPolicy(RecordIncomingCreditsRuleRule, RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(RecordIncomingCreditsRule, RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:47–48](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L47-L48) |
| CommitIncomingCredits | `runReplyingPolicy(CommitIncomingCreditsRuleRule, CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(CommitIncomingCreditsRule, CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:50–51](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L50-L51) |
| CancelIncomingCredit | `runReplyingPolicy(CancelIncomingCreditRuleRule, CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)` | `runReplyingPolicy(CancelIncomingCreditRule, CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)`；[CB:53–54](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L53-L54) |

这里的 `AddInitialOnlyOnceRuleRule`、`DepositRuleRule`、`WithdrawRuleRule`、`ReserveFundsRuleRule`、`DeductFundsRuleRule`、`ReleaseReservedFundsRuleRule`、`RecordIncomingCreditsRuleRule`、`CommitIncomingCreditsRuleRule`、`CancelIncomingCreditRuleRule` 是 T371–379 调 N.getBaseName 后再 N125 加 `Rule` 的静态组合：suffix列表没有 `Rule`。未运行resolver，不把上述推导伪装为已产文件。curated各单后缀名不能悄悄反写raw输入。[BB:270–286](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L270-L286)、[BT:77–88](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L77-L88)、[T:371–379](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L379)、[N:125](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L125)、[N:187–224](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224)

raw组顺序为 `DirectBehaviors(AddInitial,Deposit,Withdraw)` → `ReserveBehaviors` → `IncomingCreditBehaviors` → 追加 `QueryBehaviors(GetBalance)`；raw Helper同command顺序且排除GetBalance。curated Helper/direct顺序是 `AddInitial,Withdraw,Deposit`，GetBalance在direct末尾，apply只串三个组。raw局部alias为 `CreditBalanceAggregateCommandHandler`，Protocol及curated用 `CreditBalanceCommandHandler`。这些都是需要单列的内容差异，不是已批准同输入字节等价。[R:119–130](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L119-L130)、[HB:41](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L41)、[BB:38–47](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L38-L47)、[BT:39–40](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L39-L40)、[BT:129–145](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L129-L145)、[CP:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L38-L39)、[CB:12–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L12-L30)、[CH:17–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L42)

`U-effects`只要求typed rule/helper接线、失败不persist、成功后状态回复及不意外publish；本轮仅引用固定F1说明和curated调用点，不重新调查common-core。九个rule事件算法不因 `replyWith` 接上线就获批。[EVIDENCE-MD:55–59](../../details/fixture-source-evidence.md#L55-L59)、[CB:20–54](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L20-L54)

## 3. 四个State字段与empty：同一短RHS不等于同输入

| 原序 / 字段 | raw输入 | raw Builder/Template | curated | 已批准覆盖 → 缺口 |
|---|---|---|---|---|
| 1 / `userId: Id` | optional=false，defaultValue=None；[R:25](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L25)、[M:136–140](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L136-L140) | 构造器无默认表达式（`FieldDef.defaultValue=None`；JSON `null`），不是Scala `= None`；`empty(userId)`另按实参传入`userId`；[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[ET:44–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L63) | 构造器无default；empty实参=`userId`；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13) | U-fold-layout → 显式绑定userId: Id为聚合identifier；不得合成id/accountId/AccountId或任意Id；`lossless=false` |
| 2 / `accountBalance: Map[String, Money]` | optional=true，defaultValue=None；[R:26](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L26)、[M:136–140](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L136-L140) | 构造器default=`Map.empty`；empty实参=`Map.empty`；[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[ET:44–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L63) | 构造器无default；empty实参=`Map.empty`；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13) | U-fold-layout → 裁定optional=true与非Option发射的冲突；分别记录构造器默认与empty初始化，不默认为原始业务规则；`lossless=false` |
| 3 / `reservedAmount: Map[Id, Money]` | optional=true，defaultValue=None；[R:27](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L27)、[M:136–140](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L136-L140) | 构造器default=`Map.empty`；empty实参=`Map.empty`；[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[ET:44–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L63) | 构造器无default；empty实参=`Map.empty`；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13) | U-fold-layout → 裁定optional=true与非Option发射的冲突；分别记录构造器默认与empty初始化，不默认为原始业务规则；`lossless=false` |
| 4 / `incomingCredits: Map[Id, Money]` | optional=true，defaultValue=None；[R:28](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L28)、[M:136–140](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L136-L140) | 构造器default=`Map.empty`；empty实参=`Map.empty`；[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[ET:44–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L63) | 构造器无default；empty实参=`Map.empty`；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13) | U-fold-layout → 裁定optional=true与非Option发射的冲突；分别记录构造器默认与empty初始化，不默认为原始业务规则；`lossless=false` |

raw无显式empty算法。EB按Map名字给构造器 `= Map.empty`、忽略metadata的optional/default；ET以首状态字段当ID，另外三项用neutralValueFor。静态发射与curated的empty短名RHS均为 `CreditBalanceState(userId, Map.empty, Map.empty, Map.empty)`，但curated构造器没有三个默认参数。目标named args是排版要求，不是批准丢弃optional或采用任意中性数值/`null`。[R:24–29](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L24-L29)、[EB:174–209](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L209)、[ET:44–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L63)、[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)、[DE:49–51](../../diffs/domain-entity.diff.md#L49-L51)

## 4. 七事件的字段、默认与逐事件fold实际RHS

七事件名字按R70顺序原样保存，尤其 `IncomingCreditsCommited` 只有一个t；不纠拼。raw均requiresProtobuf=true，各字段optional=false/defaultValue=None；raw未声明producedBy/causedBy，用M默认Nil，不从curated规则倒推原始血缘。EB给family强加CborSerializable；curated family无parent。事件case class在ET物理输出中直接归CreditBalanceEntity，不造family companion。[R:35–41](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35-L41)、[R:70](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L70)、[M:209–230](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L209-L230)、[EB:214–267](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L214-L267)、[ET:66–83](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L66-L83)、[CE:16–23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L16-L23)

| 序 / 事件 | 完整字段顺序 / PB号 | raw默认 → curated默认 | 证据 |
|---|---|---|---|
| 1 / BalanceChanged | `update: Money (#1), timestamp: Long (#2)` | `无 → timestamp = System.currentTimeMillis()`；family parent差异，`lossless=false` | [R:35](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35)、[CE:17](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L17) |
| 2 / FundsReserved | `transferId: Id (#1), amount: Money (#2)` | `无 → 无`；family parent差异，`lossless=false` | [R:36](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L36)、[CE:18](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L18) |
| 3 / FundsDeducted | `transferId: Id (#1), amount: Money (#2)` | `无 → 无`；family parent差异，`lossless=false` | [R:37](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L37)、[CE:19](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L19) |
| 4 / ReservationReleased | `transferId: Id (#1), amount: Money (#2)` | `无 → 无`；family parent差异，`lossless=false` | [R:38](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L38)、[CE:20](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L20) |
| 5 / IncomingCreditsRecorded | `transferId: Id (#1), amount: Money (#2)` | `无 → 无`；family parent差异，`lossless=false` | [R:39](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L39)、[CE:21](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L21) |
| 6 / IncomingCreditsCommited | `transferId: Id (#1)` | `无 → 无`；family parent差异，`lossless=false` | [R:40](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L40)、[CE:22](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L22) |
| 7 / IncomingCreditsCanceled | `transferId: Id (#1)` | `无 → 无`；family parent差异，`lossless=false` | [R:41](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L41)、[CE:23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L23) |

下面每项完整列出raw RHS（R45的referenceCode，FB无formal折叠时原样传递，FT以typed event case发射）和curated的实际case/RHS；不是从右边倒推左边。`U-fold-layout`只覆盖直接copy等结构；金融计算、fallback、默认与名义类型仍由相应blocked项控制。[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)

### 4.1 BalanceChanged
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: BalanceChanged =>
  state.copy(accountBalance = updateAccountBalance(state, event.update.currency, event.update))
```
curated独立参考，[CF:12–13](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L12-L13)。
```scala
    case BalanceChanged(updateMoney@Money(_, currency), _) =>
      state.copy(accountBalance = updateAccountBalance(state, currency, updateMoney))
```
已批准覆盖 `U-fold-layout` → 仍缺 updateAccountBalance helper闭包、Money运算、未知事件策略、FQN需明确；只保存参考，不裁定金额规则。 `lossless=false`。

### 4.2 FundsReserved
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: FundsReserved =>
  state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount.copy(amount = -event.amount.amount)), reservedAmount = state.reservedAmount + (event.transferId -> event.amount))
```
curated独立参考，[CF:15–19](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L15-L19)。
```scala
    case FundsReserved(transferId, reserveAmount@Money(_, currency)) =>
      state.copy(
        accountBalance = updateAccountBalance(state, currency, reserveAmount.copy(amount = -reserveAmount.amount)),
        reservedAmount = state.reservedAmount + (transferId -> reserveAmount)
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 updateAccountBalance helper闭包、Money运算、未知事件策略、FQN需明确；只保存参考，不裁定金额规则。 `lossless=false`。

### 4.3 FundsDeducted
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: FundsDeducted =>
  state.copy(reservedAmount = state.reservedAmount - event.transferId)
```
curated独立参考，[CF:20–23](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L20-L23)。
```scala
    case FundsDeducted(transferId: Id, amount: Money) =>
      state.copy(
        reservedAmount = state.reservedAmount - transferId
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 精确保留payload、名义类型及fold；不可因为fold未读取某字段而删除它。 `lossless=false`。
该fold不使用`amount`，但R37/CE19仍定义它、PB号2；adapter不能按使用分析删除payload。

### 4.4 ReservationReleased
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: ReservationReleased =>
  state.copy(accountBalance = updateAccountBalance(state, event.amount.currency, event.amount), reservedAmount = state.reservedAmount - event.transferId)
```
curated独立参考，[CF:24–28](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L24-L28)。
```scala
    case ReservationReleased(transferId, releaseAmount@Money(_, currency)) =>
      state.copy(
        accountBalance = updateAccountBalance(state, currency, releaseAmount),
        reservedAmount = state.reservedAmount - transferId
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 updateAccountBalance helper闭包、Money运算、未知事件策略、FQN需明确；只保存参考，不裁定金额规则。 `lossless=false`。

### 4.5 IncomingCreditsRecorded
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: IncomingCreditsRecorded =>
  state.copy(incomingCredits = state.incomingCredits.updated(event.transferId, event.amount))
```
curated独立参考，[CF:30–33](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L30-L33)。
```scala
    case IncomingCreditsRecorded(transferId, amount) =>
      state.copy(
        incomingCredits = state.incomingCredits + (transferId -> amount)
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 精确保留payload、名义类型及fold；不可因为fold未读取某字段而删除它。 `lossless=false`。
raw用`.updated(event.transferId, event.amount)`，curated用`+ (transferId -> amount)`；保留文本差异，不用等价优化压平完整文件对账。

### 4.6 IncomingCreditsCommited
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: IncomingCreditsCommited =>
  state.copy(accountBalance = updateAccountBalance(state, state.incomingCredits(event.transferId).currency, state.incomingCredits(event.transferId)), incomingCredits = state.incomingCredits - event.transferId)
```
curated独立参考，[CF:34–38](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L34-L38)。
```scala
    case IncomingCreditsCommited(transferId) =>
      state.copy(
        accountBalance= updateAccountBalance(state, state.incomingCredits(transferId).currency, state.incomingCredits(transferId)),
        incomingCredits = state.incomingCredits - transferId
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 updateAccountBalance helper闭包、Money运算、未知事件策略、FQN需明确；只保存参考，不裁定金额规则。 `lossless=false`。
余额读取来自旧state.incomingCredits的两次Map.apply，再在copy中删除；没有缺键兜底。不得臆造currency/currentBalance/time来源。

### 4.7 IncomingCreditsCanceled
raw-input → raw-builder/template（静态推导），[R:45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L45)、[FB:138–164](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L138-L164)、[FB:262–266](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L262-L266)、[FT:31–50](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L31-L50)。
```scala
case event: IncomingCreditsCanceled =>
  state.copy(incomingCredits = state.incomingCredits - event.transferId)
```
curated独立参考，[CF:39–42](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L39-L42)。
```scala
    case IncomingCreditsCanceled(transferId) =>
      state.copy(
        incomingCredits = state.incomingCredits - transferId
      )
```
已批准覆盖 `U-fold-layout` → 仍缺 精确保留payload、名义类型及fold；不可因为fold未读取某字段而删除它。 `lossless=false`。

### 4.8 updateAccountBalance 与未知事件：算法没有自动补完
raw方法参数顺序是 `(state: CreditBalanceState, currency: Currency, updateMoney: Money)`，返回 `Map[String, Money]`。R43 referenceCode如下，`currentBalance`在此体没有绑定。
```scala
state.accountBalance + (currency.getCurrencyCode -> Money(currentBalance.amount + updateMoney.amount, currency))
```
FB把该字符串带到helper模型，但FT只放进AI_PROMPT Description，**实际方法RHS是`???`**；不能仅指出R43缺变量却漏报FT还没有实现。[R:43](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L43)、[FB:270–311](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/EntityBehaviorBuilder.scala#L270-L311)、[FT:62–76](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L62-L76)
curated实际RHS，[CF:46–49](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L46-L49)、[CM:12–15](../../baseline/curated-scala/net/imadz/domain/values/Money.scala#L12-L15)。
```scala
  private def updateAccountBalance(state: CreditBalanceState, currency: Currency, updateMoney: Money): Map[String, Money] = {
    val currentBalance = state.accountBalance.getOrElse(currency.getCurrencyCode, Money(BigDecimal(0), currency))
    state.accountBalance + (currency.getCurrencyCode -> (currentBalance + updateMoney).getOrElse(Money(BigDecimal(0), currency)))
  }
```
curated Money.+ 同币种返回Some(sum)，不同币种None；上述helper再把None变为零Money。`defaultMoney` / `originalMoney` 是curated额外方法，不在raw helperMethods里；来源保留，不自动加入target。[CM:12–15](../../baseline/curated-scala/net/imadz/domain/values/Money.scala#L12-L15)、[CF:51–57](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L51-L57)、[R:43–45](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L43-L45)
raw模板还追加`case _ => state`；curated只写七个case，未写catch-all。`B-financial-bodies` / `B-fold-fallback` / `B-adapter`必须分别解除，不能以默认identity或零余额吞掉缺口。[FT:80–82](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L80-L82)、[CF:11–44](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L11-L44)

## 5. 九规则的金融算法来源：保留，不自动授权

raw只给conditions；IB提取referenceCode到logicDescription，IT把它关在注释中，事件结果RHS全部为`???`。因此下面curated所发事件不是raw已生成的事件，raw `producedBy` 也未建模。JSON逐条保存raw predicate与完整小型curated规则源。[IB:35–43](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/InvariantRuleBuilder.scala#L35-L43)、[IT:34–68](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala#L34-L68)、[M:218](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L218)

| 具体rule | raw条件名 / errCode / referenceCode | curated事件构造来源 | 未决（全部blocked-business） |
|---|---|---|---|
| AddInitialOnlyOnceRule | `InitialConditionNotMeet` / `60000` / `!state.accountBalance.values.exists(_.amount > 0)`；[R:47](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L47) | `有正余额则Left(InitialConditionNotMeet)，否则Right(List(BalanceChanged(initial)))`；[C-AddInitialOnlyOnceRule:1–15](../../baseline/curated-scala/net/imadz/domain/invariants/AddInitialOnlyOnceRule.scala#L1-L15) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| DepositRule | `ChangeShouldBePositive` / `60001` / `change.amount > 0`；[R:48](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L48) | `change.amount <= 0则Left(ChangeShouldBePositive)，否则Right(List(BalanceChanged(change)))`；[C-DepositRule:1–13](../../baseline/curated-scala/net/imadz/domain/invariants/DepositRule.scala#L1-L13) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| WithdrawRule | `NotEnoughBalance` / `60002` / `state.accountBalance.get(change.currency.getCurrencyCode).exists(change <= _)`；[R:49](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L49) | `余额get/flatMap(withdrawAmount <= _)/getOrElse(false)，成功BalanceChanged(withdrawAmount.copy(amount = -withdrawAmount.amount))`；[C-WithdrawRule:1–19](../../baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala#L1-L19) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| ReserveFundsRule | `ReservationCheck` / `600xx` / `transferValidator.validate(change._1, state.reservedAmount, state.accountBalance.get(change._2.currency.getCurrencyCode), change._2).isRight`；[R:50](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L50) | `TransferValidatorDomainService.validate：Right→FundsReserved；Left(err.code=="60008")→Right(Nil)；其余Left原样`；[C-ReserveFundsRule:1–26](../../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala#L1-L26) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| DeductFundsRule | `ReservationFound` / `60006` / `state.reservedAmount.contains(change)`；[R:51](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L51) | `reservedAmount.get存在→FundsDeducted(transferId,reservedAmount)，缺→60006`；[C-DeductFundsRule:1–15](../../baseline/curated-scala/net/imadz/domain/invariants/DeductFundsRule.scala#L1-L15) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| ReleaseReservedFundsRule | `ReservationFound` / `60006` / `state.reservedAmount.contains(change)`；[R:52](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L52) | `reservedAmount.get存在→ReservationReleased(transferId,reservedAmount)，缺→60006`；[C-ReleaseReservedFundsRule:1–15](../../baseline/curated-scala/net/imadz/domain/invariants/ReleaseReservedFundsRule.scala#L1-L15) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| RecordIncomingCreditsRule | `UniqueRecord` / `60007` / `!state.incomingCredits.contains(change._1)`；[R:53](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L53) | `incomingCredits已存在→60007，否则IncomingCreditsRecorded(transferId,amount)`；[C-RecordIncomingCreditsRule:1–15](../../baseline/curated-scala/net/imadz/domain/invariants/RecordIncomingCreditsRule.scala#L1-L15) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| CommitIncomingCreditsRule | `RecordExists` / `60008` / `state.incomingCredits.contains(change)`；[R:54](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L54) | `incomingCredits存在→IncomingCreditsCommited(transferId)，缺→60008`；[C-CommitIncomingCreditsRule:1–13](../../baseline/curated-scala/net/imadz/domain/invariants/CommitIncomingCreditsRule.scala#L1-L13) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |
| CancelIncomingCreditRule | `RecordExists` / `60009` / `state.incomingCredits.contains(change)`；[R:55](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L55) | `incomingCredits存在→IncomingCreditsCanceled(transferId)，缺→60009`；[C-CancelIncomingCreditRule:1–13](../../baseline/curated-scala/net/imadz/domain/invariants/CancelIncomingCreditRule.scala#L1-L13) | 事件/错误/空事件成功/金额比较由独立输入与oracle裁定；不把参考补成raw |

额外边界：R57 `TransferValidator.validate` 的原referenceCode引用 `DuplicateReservationError`、`InvalidTransferAmountError`、`InsufficientBalanceError`，不能据名字猜具体错误码或等同curated ReserveFunds的60008幂等分支。Withdraw原predicate用`.exists(change <= _)`，curated Money.<=返回Option[Boolean]；该原predicate不是已被类型检查过的算法。错误描述写了“为正数”也不等于实际体增加了正数guard。[R:49–57](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L49-L57)、[CM:17–20](../../baseline/curated-scala/net/imadz/domain/values/Money.scala#L17-L20)、[C-WithdrawRule:9–17](../../baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala#L9-L17)、[C-ReserveFundsRule:13–23](../../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala#L13-L23)

## 6. 标识与最小技术闭包

`userId: Id`属于aggregate identifier而非每条command参数。raw持久化固定 `entityTypeKey="CreditBalance"`、`ShardedTags("credit-balance-",5)`；`snapshotInterval=100`、`eventAdapter=true`来自M默认；`credits.proto`依次import `saga_v2.proto` / `saga_participant.proto`，bootstrap是 `AkkaShardingBootstrap("credit-balance-",5)`。[R:137–161](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L137-L161)、[M:423–433](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L423-L433)
F1既有证据报告curated PID是 `PersistenceId(CreditBalanceEntityTypeKey.name,userId.toString)`，这里只引用其固定文档记录，未额外调查bootstrap/serializer/glue。成为可执行fixture前，PID/tag选择/codec/serializer/repo-bootstrap依赖闭包必须有明确技术绑定和制品pin；不能根据CreditBalance名字重新生成。[EVIDENCE-MD:73–76](../../details/fixture-source-evidence.md#L73-L76)、[EVIDENCE-JSON:339–352](../../details/fixture-source-evidence.json#L339-L352)、[CONTRACT:36](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L36)
原context=`banking`与curated无context包，`Money`显式FQN不同；raw/curated事件parent、构造器默认、规则名、handler alias不等。全链`lossless=false`，即使十条字段短名逐项相同也不例外。

## 7. Decision 状态（不是实施许可）

`source-fact`只指所读来源事实；`user-required`是既有明确要求；`proposed-default`仍待采纳；`blocked-business`是具体语义未裁；`blocked-supply`是adapter/制品/expected等未闭合。不能由source-fact或本文完成自动升级为approved implementation。

| id | 状态 | 具体决定 / 缺口 | 依据 |
|---|---|---|---|
| U-scope | source-fact（主agent分工；沿用旧id，不代表用户授权分类） | 原分工为本目录两份映射文档；本轮仅纠正指定F1既存稿，仍是惰性设计记录，不是作者树、request、expected 或实施批准。 | [AUTHORING:3](../../AUTHORING-CONTRACT.md#L3)、[CONTRACT:3](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L3)、[CONTRACT:40–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L40-L50)；main-agent assignment，非用户逐字原话；本轮docs-only纠正范围由当前用户明确 |
| U-protocol | user-required | 逐命令保留业务字段顺序和 typed replyTo（仅应用层）；Commands/Replies 分组；纯 Money/Id/有序 (Id, Money)，GetBalance 不造写 Helper。 | [CONTRACT:28–36](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L28-L36)、[AUTHORING:34–39](../../AUTHORING-CONTRACT.md#L34-L39) |
| U-balance-replies | user-required（仅Deposit） | 仅Deposit点名三方法示例属user-required：toParam=command.change；失败 CreditBalanceConfirmation(Some(error), Nil)；成功 CreditBalanceConfirmation(None, newState.accountBalance.values.toList)。newState指成功fold后状态（curated形参原名state）。不推广为AddInitial/Withdraw回复授权，也不批准规则金融算法；二级CONTRACT的“Deposit等”不能扩大当前用户边界。 | 当前用户明确纠正范围（非文件）；[DH:138](../../diffs/command-helper.diff.md#L138)、[CH:35–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42)仅为二级记录 / curated来源事实 |
| P-balance-replies | proposed-default；采纳decision-required | AddInitial/Withdraw两臂仅为curated候选：失败 CreditBalanceConfirmation(Some(error), Nil)，成功 CreditBalanceConfirmation(None, newState.accountBalance.values.toList)。采纳仍decision-required；同形RHS不等于Deposit授权自动延伸。通用U-effects继续要求失败不persist、成功读取fold后的新state；不批准金融算法。 | [CH:17–33](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L33)；当前用户明确不得扩大Deposit覆盖 |
| U-effects | user-required | 保留 runReplyingPolicy 与 replyWith 的目标接线；失败不 persist，成功 fold 后回复；不得用 replyWithAndPublish 偷增发布副作用。此处仅记录合同，不调查/修改 common-core glue。 | [AUTHORING:34–39](../../AUTHORING-CONTRACT.md#L34-L39)、[EVIDENCE-MD:55–59](../../details/fixture-source-evidence.md#L55-L59)、[CB:20–54](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L20-L54) |
| U-fold-layout | user-required | 简单赋值保留直接 state.copy；State/Events 归 domain Entity，长字段分行、empty named args、正常 imports。布局覆盖不批准时钟、金额或缺记录处理算法。 | [DE:49–51](../../diffs/domain-entity.diff.md#L49-L51)、[DF:647–652](../../diffs/event-handler.diff.md#L647-L652) |
| S-counts | source-fact | raw 命令族与 curated Protocol 都是10命令；9写+1只读；curated 9 Helper；raw reply metadata 7项，curated Protocol 8项（额外 TransferConfirmation）；事件各7项，State各4字段。 | [R:60–96](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60-L96)、[CP:15–36](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L15-L36)、[CH:17–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L94)、[CE:11–23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L23) |
| S-raw-body-debt | source-fact | ReplyMappingConfig 仅两个类型引用；HB只读取 successReplyRef。余额类机械两参错位；GetBalance 原模板 Effect.reply(cmd.replyTo)(???)；updateAccountBalance 的 referenceCode 只进 prompt，实际 raw helper RHS=???；九个 raw InvariantRule.apply 的结果仍为 ???。 | [M:379–382](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L379-L382)、[HB:28–35](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L28-L35)、[HB:110–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L110-L119)、[BT:80–88](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L80-L88)、[FT:62–76](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L62-L76)、[IT:58–67](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala#L58-L67) |
| P-six-replies | proposed-default | 建议把六阶段命令 curated 的 param/param._1 到 transferId、None/Some(error) 到 error 明确载入双方 adapter。表达式与 non-formal raw 机械槽短名文本一致，但 raw 输入未声明字段级回复语义；尚不是已批准公共表示。 | [CH:46–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L46-L94)、[HB:110–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L110-L119)、[CONTRACT:34](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L34) |
| P-get-balance | proposed-default | 建议显式采用 curated GetBalance 当前余额列表投影；没有 failure 臂，不虚构 rule/Helper 或错误回复。raw 模板无该实现；还需决定列表顺序是否保留 values.toList，不擅自排序。 | [CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30)、[BT:80–88](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L80-L88) |
| P-order | proposed-default | 建议 actor command/reply 与参数按 raw 声明序；Helper/Behavior 分组与成员顺序独立记录。raw direct 为 AddInitial,Deposit,Withdraw，curated 为 AddInitial,Withdraw,Deposit；GetBalance raw 在尾部 QueryBehaviors，curated 在 directBehaviors。不能先重排再称字节相同。 | [R:96](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L96)、[R:119–130](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L119-L130)、[CH:17–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L42)、[CB:12–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L12-L30)、[BB:38–47](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L38-L47) |
| B-reply-extra | blocked-business | TransferConfirmation 在 CP36 有定义、R60–68 无此成员；不得补进 raw 或静默从 curated 删除。要裁定 F1 target 是否排除该参考扩展及对应差异。 | [R:60–68](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60-L68)、[CP:29–36](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L29-L36) |
| B-state-defaults | blocked-business | raw 三 Map optional=true/defaultValue=None；EB忽略 optional/defaultValue，自加 case-class Map.empty；curated 三 Map 非 Option、构造器无默认，empty才显式三 Map.empty。选择兼容发射或显式目标语义前不称 lossless。 | [R:24–29](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L24-L29)、[M:136–140](../../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L136-L140)、[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13) |
| B-event-defaults | blocked-business | BalanceChanged.timestamp raw无默认，curated是 System.currentTimeMillis()；raw event family强加 CborSerializable，curated无parent。默认求值时点、序列化边界必须另裁；不把当前时间灌入回放。 | [R:35](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35)、[EB:214–267](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L214-L267)、[CE:16–23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L16-L23) |
| B-identity | blocked-business | raw context banking、listOfMoney显式 net.imadz.banking.domain.values.Money，curated net.imadz.domain.values.Money；raw metadata rule 名已有 Rule，N125/187–224 与 T371–379 静态组合会再添 Rule；curated不双添。类型/包/alias映射须逐符号显式，PB/PID身份不跟随美化改写。 | [R:22](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L22)、[R:47–55](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L47-L55)、[R:364–365](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L364-L365)、[CP:1–8](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L8)、[N:125](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L125)、[N:187–224](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224)、[T:371–379](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L379)、[BT:39–40](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L39-L40)、[CP:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L38-L39) |
| B-financial-bodies | blocked-business | 九个 invariant 的事件生成/错误/幂等与 Money 运算仅保留 raw 和 curated 来源；尚无统一、独立批准的双方输入与 oracle。尤其 ReserveFunds 的60008空事件成功、Withdraw比较、updateAccountBalance币种不一致归零、IncomingCreditsCommited直接Map.apply缺键行为，不由本次文档自动授权。 | [R:43–57](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L43-L57)、[IT:58–67](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala#L58-L67)、[CF:34–48](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L34-L48)、[CM:6–20](../../baseline/curated-scala/net/imadz/domain/values/Money.scala#L6-L20)、[C-ReserveFundsRule:9–24](../../baseline/curated-scala/net/imadz/domain/invariants/ReserveFundsRule.scala#L9-L24)、[C-WithdrawRule:11–17](../../baseline/curated-scala/net/imadz/domain/invariants/WithdrawRule.scala#L11-L17) |
| B-fold-fallback | blocked-business | raw FT82有 case _ => state；curated CF11–44只有七个匹配。未知事件/未覆盖分支的目标策略待裁；不能把 identity fallback 当完成金融算法。 | [FT:80–82](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L80-L82)、[CF:11–44](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L11-L44) |
| B-adapter | blocked-supply | 未建立能消费全部已裁字段/方法语义的双端同输入 adapter；本文件只列义务，不实现 schema/parser/生成入口，不以 curated 算法倒推 raw。 | [CONTRACT:7–14](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L7-L14)、[CONTRACT:113–115](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L113-L115) |
| B-artifact | blocked-supply | 主agent转述的既有 common-core 坐标为 net.imadz:common-core_2.13:0.2；优先发布制品，实施前另锁制品字节/API。withPost/policy 不是发布 API；不据源码存在认定 JAR可用。common-core演进由另一会话负责，本轮不调查glue。 | [AUTHORING:38](../../AUTHORING-CONTRACT.md#L38)；main-agent paraphrase for coordinate, not a verbatim user quote; current user keeps artifact/glue blocked; no artifact-byte pin |
| B-retired-slots | blocked-supply | support-controller 任意 path/content、projection manualBlocks、implOverrides 三退休无界源码槽仍blocked，不用B分区兜底，也不借其引入金融实现。 | [RETIRE:132](../../PARTITION-RESOLUTIONS.md#L132)；current user instruction |
| B-expected | blocked-supply | raw实跑输出、批准目标完整文件、新JS完整输出及两份统一diff尚未冻结；不造 targetExpectedSha。CC全部未测，源码短不等于CC达标。 | [CONTRACT:40–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L40-L50)、[AUTHORING:45–48](../../AUTHORING-CONTRACT.md#L45-L48)；current user instruction |

## 8. 成为真正双端同输入fixture的最小adapter义务

### A1
选定一个获准的真实输入载体和classic non-formal profile；同一输入供双方。保存R原文与单列批准覆盖，不把本mapping.json当作者树/request，不用另一银行实例或curated算法逆向造raw。
**必须拒绝而不能吞字段/填成功的条件**：目标字段/算法只有curated来源却被标成raw；未裁槽被默认填成功。

### A2
逐项携带10条命令的有序业务参数、nominal类型、optional、replyToType、readonly、invariantRef、两臂reply引用；回复7项顺序与额外TransferConfirmation差异另列。replyTo只在Actor命令末尾合成。
**必须拒绝而不能吞字段/填成功的条件**：命令/字段被flatMap吞掉；把Id合成AccountId/TxId；替换为Execute/GetState外壳；reply字段位置重排；GetBalance被造写Helper。

### A3
把9个Helper的toParam和每臂字段绑定作为有来源的显式adapter义务；U-effects通用要求成功state为post-fold、失败不persist。失败balances=Nil仅在Deposit点名示例获准；AddInitial/Withdraw同形两臂仍属P-balance-replies待裁。不得把Money或param塞进error，有序tuple不得调换；只读投影单独绑定。
**必须拒绝而不能吞字段/填成功的条件**：fallback Unit/Any、按名字猜Reply字段、使用旧state、改replyWithAndPublish、伪称withPost/policy为发布API。

### A4
分别携带state字段的optional、作者默认、raw构造器默认、empty参数；事件七项名字/顺序/字段/PB号/default/parent独立保真。处理冲突时记录批准偏差，不删除冲突事实。
**必须拒绝而不能吞字段/填成功的条件**：吞三个optional=true；抹除timestamp默认差异；改IncomingCreditsCommited拼写；因FundsDeducted.fold不读amount而删payload/PB字段2。

### A5
保存七个raw fold RHS；updateAccountBalance的未绑定currentBalance与模板???分开。九规则的predicate/error/event构造/空事件成功由业务方单独裁定并提供独立oracle/实现所有权；不通过退休任意源码槽注入。
**必须拒绝而不能吞字段/填成功的条件**：将raw注释/???当可执行；把curated归零/幂等/时钟算法自动写成raw；缺事件实现回退Right(Nil)或state。

### A6
显式冻结Money包、rule命名、真实类型owner、handler alias、组/声明序与MANUAL或获准外置实现保护；共享resolver无法解析必须报具体槽。
**必须拒绝而不能吞字段/填成功的条件**：删包名、短名合并、无声RuleRule更名、默认Any/String dispatcher、重排后宣称完整文件相同。

### A7
在独立获准窗口锁net.imadz:common-core_2.13:0.2发布制品字节/API与repo/bootstrap/codec闭包、技术身份绑定；只向隔离目标发射。当前只列义务，不调查glue、下载或补拷外部源码。
**必须拒绝而不能吞字段/填成功的条件**：仅凭源码目录存在认定JAR可消费；PID/tag/proto/serializer被命名美化改动。

### A8
裁定完成后另获运行许可，保存原raw实跑文件、curated源、批准目标完整文件、新JS真实输出以及raw→target、JS→target两份完整diff；仅在实际得到字节后填写expected SHA。
**必须拒绝而不能吞字段/填成功的条件**：用本文完成、JSON可解析、源SHA吻合或CC未测代替同输入/运行/实现验收。

以上是未来最小准入义务，均未实施。原始输入、raw实跑结果、curated参考、用户目标和JS真实产物必须保持五种身份分离，实际文件SHA和两份完整diff只能在获准执行后形成；本轮不造expected字节或运行回执。[CONTRACT:40–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L40-L50)、[CONTRACT:113–115](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L113-L115)

## 9. 本轮静态检查与交付边界

已在写入前检查JSON可解析、10/9/1命令与7事件/4状态字段计数、raw七个fold RHS逐字包含于R45、引用文件存在及行区间有效；只对所选来源做SHA-256，和既有F1证据中重合的10个pin逐项匹配。未整读baseline index，未扫描所有diff。这里的计数/链接/指纹不证明编译、运行、同输入或CC达标。
仍blocked：字段级回复和query输入表示，额外TransferConfirmation，state optional/构造默认/empty策略，事件时钟及parent，包/RuleRule/alias/组序，九规则与Money/fold算法/未知事件策略，双端adapter、发布制品和真实expected。三退休无界源码槽依然blocked且不用B兜底。
