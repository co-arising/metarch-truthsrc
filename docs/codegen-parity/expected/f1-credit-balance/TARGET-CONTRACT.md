# F1 CreditBalance 四件完整文件的目标身份合同

状态：`content-specification / decision-required`。**四件目标的成员/RHS合同可评审，但实际 expected Scala 文件 0 件，冻结 0 件；所有 expectedSha=null。** 本文与 manifest.json 是两份既存设计文档，原创建任务来自主agent分工（非用户逐字原话），不是作者树、request、公共DSL、raw输出、生成应用或实施批准；同输入仍 blocked，lossless=false，CC全部未测。

本轮用户已允许docs-only纠正，主集成者已移交指定四份F1既存稿编辑权；原目标文档对的分派来自主agent，不是用户逐字原话。本轮更窄授权优先于仓库通用validate/roundtrip要求：只修改指定四份F1文档，写前Read并核指定SHA，冲突停止；不执行生成/validate/roundtrip/编译/测试/typecheck/服务/下载/发布；不改作者树、生成器、catalog、生成应用、.truthsrc、ledger、anchors、银行、基线或旧15稿，不创建worktree，不做stash/reset/clean/commit/push，不调用子agent/Workflow/任务工具。未读秘密、旧进程args/env或agent.output全文，无外部源码补拷。common-core演进由另一会话负责；主agent转述的既有坐标为net.imadz:common-core_2.13:0.2（非用户逐字引文或制品字节证据），优先发布制品、字节/API实施前另锁；withPost/policy不是发布API，本轮未调查glue。

本文只提出有限候选，不把“待裁”包装为已经同意。`user-required`是前置明确要求；`candidate`是本轮可选文本/排列；`source-fact`只断言所引固定来源。更宽金融算法不随接口或文件身份合同获批。

## 1. 来源身份、完整字节和计划路径

固定文件以原身份保留；`sourceSha`覆盖整个文件，包括头尾与空白，不是片段SHA。前置输入映射是已pin的二级文档，raw Builder/Template推导是静态阅读，不是实际生成结果。五种身份（raw输入、raw实跑、curated参考、批准目标、JS实跑）不能互换。依据 [CONTRACT:40–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L40-L50)。

| 四件目标 | 现有完整source（全文件） | sourceBytes / sourceSha | 计划logicalOutputPath（未创建） |
|---|---|---|---|

| Protocol | curated / [CP:1–40](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L40) | 2768 / `9f860bbafefdc4200d2f211c5c68524130892e022c5417535722afa33c767a54` | `app/net/imadz/application/aggregates/CreditBalanceProtocol.scala` |

| CommandHelpers | curated / [CH:1–95](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L1-L95) | 5746 / `ec0c4f05e9398b8fd8aa1a93d6aafbe10a845e687bdffc27d3510e51a177d531` | `app/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala` |

| Behaviors | curated / [CB:1–57](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L1-L57) | 2615 / `ee01261c6fbe640134dbcbc3c764882e8d5c2fd91897191a1048ad22e81d3d96` | `app/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala` |

| Entity | curated / [CE:1–29](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L1-L29) | 1259 / `c2e41213ec31561448256c2cec955ce589e7e0a39b721a11828c37ec6b3bd555` | `app/net/imadz/domain/entities/CreditBalanceEntity.scala` |

计划路径均以 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/expected/f1-credit-balance/` 为隔离资产根；manifest逐件列绝对路径。这些路径**不是本轮写集合**，本轮只纠正指定四份F1既存文档，不创建Scala或实际fixture。所有source都只是candidate/reference；本合同有排版、保护块、顺序或成员/默认裁定，故没有一件获准原字节复用。即使后续个别文件获准复用，也须逐件审定，不批准其余规则/金融方法。

| 其它证据key / 身份 | 准确文件与本轮实读范围 | 全文件bytes / SHA-256 |
|---|---|---|

| R / fixed-baseline / raw hand-authored Scala SystemMetadata; not generated output | [R:1–162](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L1-L162) | 41607 / `aaa4fbe90fa903e4e133014276506c2d18781c599a27385e8948ada9e8ebdeb3` |

| PB / fixed-baseline / raw builder | [PB:1–108](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L1-L108) | 4144 / `fef186e632228c930f3c9c5db177653e4609f4b8baf50f8aacae09736640596d` |

| PT / fixed-baseline / raw template | [PT:1–126](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L1-L126) | 4692 / `25fd60e6c669ef03b4d0b3165f34c8629c758276cb70328831407a37835d313a` |

| HB / fixed-baseline / raw builder | [HB:1–143](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L1-L143) | 7685 / `6a46c0d8420639ec87352e1c26f20f2ac5bea541d8fc7b1e15af5e9218db44fb` |

| HT / fixed-baseline / raw template | [HT:1–95](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L1-L95) | 3284 / `999303df54f728e2096789493a7d07b3f8d41ed1b5d3f25b99b0589d02536d1c` |

| BB / fixed-baseline / raw builder | [BB:23–82](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L23-L82)；[BB:270–313](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L270-L313) | 15859 / `18fbec829c7443ae61c17cc11e13d2ef394832d6066a515c3711a71b0937f341` |

| BT / fixed-baseline / raw template | [BT:1–183](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L1-L183) | 8682 / `8e01fd549619334ed21a5eb78f5bbd2aa9889f93d8af94d18ea5233d3456410e` |

| EB / fixed-baseline / raw builder | [EB:156–269](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L156-L269) | 13039 / `29f7d954afc5244ee33bbc5d64a4d4bd4915e5677b6902d6265ffb2490284563` |

| ET / fixed-baseline / raw template | [ET:1–122](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L1-L122) | 5962 / `b5d64f4d21e71e6eee41af8a2c7e9b1f1652de13b53ed324c335b782fb9a314d` |

| FT / fixed-baseline / raw template | [FT:52–81](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L52-L81) | 3711 / `59725ae168286fa5a2d13bc7d2fc5f3078e68c875342b8a1b76aca4056093a51` |

| N / fixed-baseline / raw naming support | [N:122–128](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L122-L128)；[N:187–226](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L226) | 21641 / `d9b8cb3533ebd93866d86523086b4790f2de247cd6751c67d8ad644c31c80166` |

| T / fixed-baseline / raw type resolver support; only invariantRule excerpt inspected | [T:371–381](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L381) | 43480 / `1f17bf4ac92b11f3c29dbeacc3378cee54abb3d1f5cb82947edf183ace8b13ba` |

| CF / fixed-baseline / independent curated reference; not raw output or frozen expected | [CF:1–58](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L1-L58) | 2455 / `6af6ca27ed6b4c49559f35a5cd86850a2f24624044321c83d853c33c2e422534` |

| CONTRACT / document snapshot / specification or decision; not implementation evidence | [CONTRACT:1–115](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L1-L115) | 9684 / `cced314341408c7834bfdd8723aa55ac9ae39ea85c50e74a651b2052a7df2222` |

| AUTHORING / document snapshot / specification or decision; not implementation evidence | [AUTHORING:1–73](../../AUTHORING-CONTRACT.md#L1-L73) | 5941 / `9c827000f1e864b6a86a04a855df4853a4457b854bd5b2f0bfff14b1ce9514a9` |

| EVIDENCE-MD / document snapshot / secondary F1 source evidence | [EVIDENCE-MD:23–77](../../details/fixture-source-evidence.md#L23-L77) | 18352 / `2e8298e923144376ff26f7a5551f762379b85fbd119bebfc41b5e4704f2a7ae9` |

| DH / document snapshot / specification or decision; not implementation evidence | [DH:132–167](../../diffs/command-helper.diff.md#L132-L167) | 85653 / `c4ca1efdf46fa64dd4594a4f6f5a7e83bc6445222272a7c3a30829b5dd73987f` |

| DE / document snapshot / specification or decision; not implementation evidence | [DE:26–52](../../diffs/domain-entity.diff.md#L26-L52) | 15768 / `eda7e9067e5f784315365746d1bdd4763d62641e347b886bf27fbfd8da65cc45` |

| RETIRE / document snapshot / specification or decision; not implementation evidence | [RETIRE:127–135](../../PARTITION-RESOLUTIONS.md#L127-L135) | 15532 / `9c51246256a11490162991a87bb6839fe85d20b4d77f887973734eeacff73997` |

| IM / pinned document snapshot / preceding F1 mapping; secondary evidence, not author input or expected | [IM:1–370](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L1-L370) | 85168 / `b0005cfa7f17288fd659097b3efb91df6db2a16a6b351aef770d4f0819f411c9` |

| MJ / pinned document snapshot / preceding F1 mapping; secondary evidence, not author input or expected | [MJ:2191–4352](../../fixtures/f1-credit-balance/mapping.json#L2191-L4352)；[MJ:4355–4816](../../fixtures/f1-credit-balance/mapping.json#L4355-L4816)；[MJ:4819–5110](../../fixtures/f1-credit-balance/mapping.json#L4819-L5110)；[MJ:5113–6357](../../fixtures/f1-credit-balance/mapping.json#L5113-L6357)；[MJ:6360–6917](../../fixtures/f1-credit-balance/mapping.json#L6360-L6917)；[MJ:6920–7534](../../fixtures/f1-credit-balance/mapping.json#L6920-L7534) | 214124 / `4c5e292944c51f0bcebe3408987a85855a558dfefd4f705b72970a4346c7927d` |

MJ按结构解析与定向摘取，未整屏输出；长源码只实读表中范围，整文件指纹不意味着整文件语义审阅。未整读baseline index，也未读所有diff。引用格式把文件、行和来源key绑定；真实用户要求与主agent分工/转述保持分离；内部提示不是用户授权，不伪造文件/行号。

## 2. 跨四件的硬合同与精确类型owner

typed replyTo只在Actor命令末尾；所有写命令都有三方法Helper并经runReplyingPolicy/replyWith，GetBalance不造写Helper。State/Events只在domain Entity，纯参数Money/Id/(Id, Money)不含ActorRef。Commands/Replies分组、正常imports、简单fold直接copy是用户要求，**不等于字段级输入或金融算法已裁定**。依据 [AUTHORING:25–39](../../AUTHORING-CONTRACT.md#L25-L39)、[IM:310–314](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L310-L314)。

候选根包是curated的`net.imadz`，不是把raw context `banking`抹掉后的所谓同输入。D01待裁：

| 符号范围 | 候选精确owner / 身份 |
|---|---|
| 十命令、七回复、CreditBalanceCommand、CreditBalanceCommandHandler | `net.imadz.application.aggregates.CreditBalanceProtocol` 的直接成员 |
| 九Helper | `net.imadz.application.aggregates.behaviors.CreditBalanceCommandHelpers` 的implicit object成员 |
| apply/三个partial-function组 | `net.imadz.application.aggregates.behaviors.CreditBalanceBehaviors` |
| State、七事件、Event族、EventHandler alias | `net.imadz.domain.entities.CreditBalanceEntity` 的直接成员；不是 `CreditBalanceEvent.<Case>` |
| Money | `net.imadz.domain.values.Money`；不是raw listOfMoney中 `net.imadz.banking.domain.values.Money` 的无声同义化 |
| Id / iMadzError | `net.imadz.common.CommonTypes.Id` / `net.imadz.common.CommonTypes.iMadzError`，不合成AccountId/TxId |
| 九规则 | `net.imadz.domain.invariants.<表中rule>`，单Rule后缀；仅声明消费目标，不批准实现 |
| ActorRef / Effect | `akka.actor.typed.ActorRef` / `akka.persistence.typed.scaladsl.Effect` |
| CommandHelper / runReplyingPolicy | `net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper` / `.runReplyingPolicy`，这里只固定所需import/调用点，不认定发布JAR已满足 |

owner依据 [CP:1–40](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L40)、[CH:1–95](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L1-L95)、[CB:1–57](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L1-L57)、[CE:1–29](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L1-L29)；raw差异 [R:6–23](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L6-L23)、[EB:218–248](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L218-L248)、[T:371–379](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L379)、[N:125](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L125)及[N:187–224](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224)。后两处静态组合会在已有Rule后再加Rule，不把推导冒称已经生成的文件。

### 2.1 imports与全文边界（顺序即候选顺序）

**Protocol**：沿curated [CP:3–8](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L3-L8)，D01/D08/D10待裁。

1. `import akka.actor.typed.ActorRef`

2. `import akka.persistence.typed.scaladsl.Effect`

3. `import net.imadz.common.CborSerializable`

4. `import net.imadz.common.CommonTypes.{Id, iMadzError}`

5. `import net.imadz.domain.entities.CreditBalanceEntity.{CreditBalanceEvent, CreditBalanceState}`

6. `import net.imadz.domain.values.Money`

**CommandHelpers**：沿curated [CH:3–7](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L3-L7)，D01/D08/D10待裁。

1. `import net.imadz.application.aggregates.CreditBalanceProtocol._`

2. `import net.imadz.common.CommonTypes.{Id, iMadzError}`

3. `import net.imadz.common.application.CommandHandlerReplyingBehavior.CommandHelper`

4. `import net.imadz.domain.entities.CreditBalanceEntity._`

5. `import net.imadz.domain.values.Money`

**Behaviors**：沿curated [CB:3–7](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L3-L7)，D01/D08/D10待裁。

1. `import akka.persistence.typed.scaladsl.Effect`

2. `import net.imadz.application.aggregates.CreditBalanceProtocol._`

3. `import net.imadz.common.application.CommandHandlerReplyingBehavior.runReplyingPolicy`

4. `import net.imadz.domain.entities.CreditBalanceEntity._`

5. `import net.imadz.domain.invariants._`

**Entity**：沿curated [CE:3–4](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L3-L4)，D01/D08/D10待裁。

1. `import net.imadz.common.CommonTypes.Id`

2. `import net.imadz.domain.values.Money`

候选仅上述imports；不加入duration/Any/String分发表，不加Serialize/OWrites或Actor依赖到Entity。若D08改用CborSerializable，Entity的import必须作为额外明确差异重新审定。字节规则候选：UTF-8无BOM、LF、末尾一个LF、2空格缩进；State与长构造器逐字段一行；不加final、require、注解、自类型、额外companion/辅助构造器/重载、var/lazy或额外业务方法。四份curated完整成员以§1全文为界；这些限制是目标合同，不是通用Scala能力结论。头部白名单暂为空；未来writer若需指纹头，必须记录准确格式后单独审定，不能比较时删除包名、空白或MANUAL。[AUTHORING:25–39](../../AUTHORING-CONTRACT.md#L25-L39)、[CONTRACT:42–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L42-L50)。

## 3. Protocol：完整构造器与声明序

候选物理顺序：package → §2 imports → `object CreditBalanceProtocol` → `// --- Commands ---` → `sealed trait CreditBalanceCommand extends CborSerializable` → 下表十个case class → `// --- Replies ---` → 七回复 → `// --- Handler Type Definition ---` → alias → 关闭object。命令/回复均无字段默认、无额外方法；所有命令extends CreditBalanceCommand；所有回复直接extends CborSerializable，**不另造CreditBalanceReply父trait**。raw PB的inline state=None，故本F1 Protocol不搬入领域State/Events。[CP:10–40](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L10-L40)、[PB:25–35](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L25-L35)、[PB:97–105](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L97-L105)。

| 序 / 命令 | 完整构造器字段（按序，无默认） | raw / curated / 反查mapping |
|---|---|---|

| 1 / AddInitial | `initial: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | [R:83](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L83)；[CP:15](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L15)；[MJ:2191–2408](../../fixtures/f1-credit-balance/mapping.json#L2191-L2408) `/commands/0` |

| 2 / Deposit | `change: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | [R:84](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L84)；[CP:16](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L16)；[MJ:2409–2627](../../fixtures/f1-credit-balance/mapping.json#L2409-L2627) `/commands/1` |

| 3 / Withdraw | `change: Money, replyTo: ActorRef[CreditBalanceConfirmation]` | [R:85](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L85)；[CP:17](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L17)；[MJ:2628–2845](../../fixtures/f1-credit-balance/mapping.json#L2628-L2845) `/commands/2` |

| 4 / GetBalance | `replyTo: ActorRef[CreditBalanceConfirmation]` | [R:86](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L86)；[CP:18](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L18)；[MJ:2846–3004](../../fixtures/f1-credit-balance/mapping.json#L2846-L3004) `/commands/3` |

| 5 / ReserveFunds | `transferId: Id, amount: Money, replyTo: ActorRef[FundsReservationConfirmation]` | [R:88](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L88)；[CP:20](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L20)；[MJ:3005–3242](../../fixtures/f1-credit-balance/mapping.json#L3005-L3242) `/commands/4` |

| 6 / DeductFunds | `transferId: Id, replyTo: ActorRef[FundsDeductionConfirmation]` | [R:89](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L89)；[CP:21](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L21)；[MJ:3243–3460](../../fixtures/f1-credit-balance/mapping.json#L3243-L3460) `/commands/5` |

| 7 / ReleaseReservedFunds | `transferId: Id, replyTo: ActorRef[FundsReleaseConfirmation]` | [R:90](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L90)；[CP:22](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L22)；[MJ:3461–3678](../../fixtures/f1-credit-balance/mapping.json#L3461-L3678) `/commands/6` |

| 8 / RecordIncomingCredits | `transferId: Id, amount: Money, replyTo: ActorRef[RecordIncomingCreditsConfirmation]` | [R:92](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L92)；[CP:24](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L24)；[MJ:3679–3916](../../fixtures/f1-credit-balance/mapping.json#L3679-L3916) `/commands/7` |

| 9 / CommitIncomingCredits | `transferId: Id, replyTo: ActorRef[CommitIncomingCreditsConfirmation]` | [R:93](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L93)；[CP:25](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L25)；[MJ:3917–4134](../../fixtures/f1-credit-balance/mapping.json#L3917-L4134) `/commands/8` |

| 10 / CancelIncomingCredit | `transferId: Id, replyTo: ActorRef[CancelIncomingCreditConfirmation]` | [R:94](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L94)；[CP:26](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L26)；[MJ:4135–4352](../../fixtures/f1-credit-balance/mapping.json#L4135-L4352) `/commands/9` |

| 序 / Reply | 完整字段顺序 | 来源 / mapping |
|---|---|---|

| 1 / CreditBalanceConfirmation | `error: Option[iMadzError], balances: List[Money]` | [R:60](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60)；[CP:29](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L29)；[MJ:4355–4420](../../fixtures/f1-credit-balance/mapping.json#L4355-L4420) `/replies/0` |

| 2 / FundsReservationConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:61](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L61)；[CP:30](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L30)；[MJ:4421–4486](../../fixtures/f1-credit-balance/mapping.json#L4421-L4486) `/replies/1` |

| 3 / FundsDeductionConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:62](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L62)；[CP:31](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L31)；[MJ:4487–4552](../../fixtures/f1-credit-balance/mapping.json#L4487-L4552) `/replies/2` |

| 4 / FundsReleaseConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:63](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L63)；[CP:32](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L32)；[MJ:4553–4618](../../fixtures/f1-credit-balance/mapping.json#L4553-L4618) `/replies/3` |

| 5 / RecordIncomingCreditsConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:64](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L64)；[CP:33](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L33)；[MJ:4619–4684](../../fixtures/f1-credit-balance/mapping.json#L4619-L4684) `/replies/4` |

| 6 / CommitIncomingCreditsConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:65](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L65)；[CP:34](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L34)；[MJ:4685–4750](../../fixtures/f1-credit-balance/mapping.json#L4685-L4750) `/replies/5` |

| 7 / CancelIncomingCreditConfirmation | `transferId: Id, error: Option[iMadzError]` | [R:66](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L66)；[CP:35](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L35)；[MJ:4751–4816](../../fixtures/f1-credit-balance/mapping.json#L4751-L4816) `/replies/6` |

额外curated成员 `TransferConfirmation(transferId: Id, error: Option[iMadzError]) extends CborSerializable` 位于 [CP:36](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L36)，raw七项 [R:60–68](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60-L68)没有它。D09建议明确排除该参考扩展、F1仍七回复，但目前未裁；若保留，必须成为显式扩展输入，不作为某条新命令的推测回复。不是静默漏成员。

alias精确RHS：`type CreditBalanceCommandHandler = (CreditBalanceState, CreditBalanceCommand) => Effect[CreditBalanceEvent, CreditBalanceState]`，沿 [CP:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L38-L39)。PT静态发射使用Effect的FQN [PT:98–108](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L98-L108)；目标import简名是内容差异，不把原始字节压平。

## 4. CommandHelpers：九对象、27方法、完整两臂RHS

文件顺序：package → §2 imports → 有限职责注释（候选 `/** 将 typed Command 投影为纯参数，并按显式绑定构造失败/成功 Reply。 */`，替代curated“AI填空”措辞）→ `trait CreditBalanceCommandHelpers` → Direct / Reservation / Incoming Credit三组标题 → 各组Helper → 关闭trait。组标题沿 [CH:9–17](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L9-L17)、[CH:44–46](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L44-L46)、[CH:70–72](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L70-L72)。D05候选Helper直接组顺序改为AddInitial,Deposit,Withdraw（raw顺序），不是curated原AddInitial,Withdraw,Deposit。

每行以精确C/P/R展开以下接口；C/P/R仅为本表元变量，不是拟新增类型。manifest逐方法存完整签名与RHS，不组装Scala文件：

- `implicit object <C>Helper extends CommandHelper[<C>, CreditBalanceState, <P>, <R>]`
- 方法1：`override def toParam(state: CreditBalanceState, command: <C>): <P>`
- 方法2：`override def createFailureReply(param: <P>)(error: iMadzError): <R>`
- 方法3：`override def createSuccessReply(param: <P>)(newState: CreditBalanceState): <R>`

D10建议每个body单独保留一对`// ==== BEGIN MANUAL ====` / `// ==== END MANUAL ====`（共27对）；curated无这些marker，不能拿副本当最终全文。`newState`是明确post-fold参数的候选拼写，curated原名是`state`。即便六阶段success不读state，仍保留三方法接口；不得用Any/Unit或统一emit替代。

接口与保护来源 [HT:45–62](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L45-L62)、[CH:17–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L94)、[DH:137–148](../../diffs/command-helper.diff.md#L137-L148)；当前发布制品能力不在本轮调查范围，D13未锁。

| C / P / R（候选顺序） | toParam完整RHS | failure完整RHS | success完整RHS | 来源 / 状态 |
|---|---|---|---|---|

| AddInitial / `Money` / `CreditBalanceConfirmation` | `command.initial` | `CreditBalanceConfirmation(Some(error), Nil)` | `CreditBalanceConfirmation(None, newState.accountBalance.values.toList)` | [CH:17–24](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L24)；两臂仅curated候选 / proposed-default，采纳decision-required（D02 / P-balance-replies）；U-effects通用规则不变 |

| Deposit / `Money` / `CreditBalanceConfirmation` | `command.change` | `CreditBalanceConfirmation(Some(error), Nil)` | `CreditBalanceConfirmation(None, newState.accountBalance.values.toList)` | [CH:35–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L35-L42)；仅Deposit点名三方法示例user-required，输入绑定D02仍未闭合 |

| Withdraw / `Money` / `CreditBalanceConfirmation` | `command.change` | `CreditBalanceConfirmation(Some(error), Nil)` | `CreditBalanceConfirmation(None, newState.accountBalance.values.toList)` | [CH:26–33](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L26-L33)；两臂仅curated候选 / proposed-default，采纳decision-required（D02 / P-balance-replies）；U-effects通用规则不变 |

| ReserveFunds / `(Id, Money)` / `FundsReservationConfirmation` | `(command.transferId, command.amount)` | `FundsReservationConfirmation(param._1, Some(error))` | `FundsReservationConfirmation(param._1, None)` | [CH:46–52](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L46-L52)；curated候选，D03待裁 |

| DeductFunds / `Id` / `FundsDeductionConfirmation` | `command.transferId` | `FundsDeductionConfirmation(param, Some(error))` | `FundsDeductionConfirmation(param, None)` | [CH:54–60](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L54-L60)；curated候选，D03待裁 |

| ReleaseReservedFunds / `Id` / `FundsReleaseConfirmation` | `command.transferId` | `FundsReleaseConfirmation(param, Some(error))` | `FundsReleaseConfirmation(param, None)` | [CH:62–68](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L62-L68)；curated候选，D03待裁 |

| RecordIncomingCredits / `(Id, Money)` / `RecordIncomingCreditsConfirmation` | `(command.transferId, command.amount)` | `RecordIncomingCreditsConfirmation(param._1, Some(error))` | `RecordIncomingCreditsConfirmation(param._1, None)` | [CH:72–78](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L72-L78)；curated候选，D03待裁 |

| CommitIncomingCredits / `Id` / `CommitIncomingCreditsConfirmation` | `command.transferId` | `CommitIncomingCreditsConfirmation(param, Some(error))` | `CommitIncomingCreditsConfirmation(param, None)` | [CH:80–86](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L80-L86)；curated候选，D03待裁 |

| CancelIncomingCredit / `Id` / `CancelIncomingCreditConfirmation` | `command.transferId` | `CancelIncomingCreditConfirmation(param, Some(error))` | `CancelIncomingCreditConfirmation(param, None)` | [CH:88–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L88-L94)；curated候选，D03待裁 |

字段绑定不是根据类名猜测；只有Deposit点名三方法示例是user-required，AddInitial/Withdraw同形两臂仍待D02裁定，不能由等价推成批准：余额臂`error=Some(error)/None`，`balances=Nil/newState.accountBalance.values.toList`；其它六臂`transferId=param._1`仅用于tuple，Id单值用`param`，`error=Some(error)/None`。tuple第二项amount只作纯规则输入，不误塞进reply。完整原字段与命令映射见§3/MJ对应行。raw三余额success为`CreditBalanceConfirmation(param, None)`、failure为`CreditBalanceConfirmation(param, Some(error))`，类型/位置错位；其余六条短RHS相同也不证明字段语义已经进入双方输入。[HB:79–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L79-L119)、[R:60–66](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L60-L66)、[IM:89–104](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L89-L104)。

**新State而非旧State**：合同要求先toParam(oldState,command)→rule(oldState,param)；失败构造failure、不persist；成功持久化rule给出的events、fold后才以newState构造success，并只reply。此语义来自用户要求与前置文档记录 [IM:311–313](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L311-L313)、[EVIDENCE-MD:55–59](../../details/fixture-source-evidence.md#L55-L59)；后者描述curated glue，**不是本轮JAR验证或glue调查**。不用replyWithAndPublish，也不声称withPost/policy是发布API。空事件成功是否允许由各规则独立裁，不因这个顺序自动批准Right(Nil)。

## 5. Behaviors：完整接线、分组、query与副作用

候选：package → §2五imports → `object CreditBalanceBehaviors extends CreditBalanceCommandHelpers` → apply → directBehaviors → reserveBehaviors → incomingCreditBehaviors → 关闭object。组标题沿 [CB:11–19](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L11-L19)、[CB:33–34](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L33-L34)、[CB:45–46](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L45-L46)。不再声明raw的局部CreditBalanceAggregateCommandHandler，使用Protocol alias。

`def apply: CreditBalanceCommandHandler` 的候选完整RHS是 `(state, command) => directBehaviors(state).orElse(reserveBehaviors(state)).orElse(incomingCreditBehaviors(state)).apply(command)`；沿 [CB:12–16](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L12-L16)，但保留raw apply的MANUAL保护义务 [BT:136–145](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L136-L145)。不加catch-all、吞命令或先生成空Effect。每个组签名完整为 `private def <group>(state: CreditBalanceState): PartialFunction[CreditBalanceCommand, Effect[CreditBalanceEvent, CreditBalanceState]]`。以下每个case均只出现一次。

| 组 / case（候选顺序） | 完整RHS | curated原行 / raw输入与mapping反查 |
|---|---|---|

| directBehaviors / `case cmd: AddInitial` | `runReplyingPolicy(AddInitialOnlyOnceRule, AddInitialHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:20–21](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L20-L21)；[R:83](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L83)；[MJ:2191–2408](../../fixtures/f1-credit-balance/mapping.json#L2191-L2408) |

| directBehaviors / `case cmd: Deposit` | `runReplyingPolicy(DepositRule, DepositHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:26–27](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L26-L27)；[R:84](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L84)；[MJ:2409–2627](../../fixtures/f1-credit-balance/mapping.json#L2409-L2627) |

| directBehaviors / `case cmd: Withdraw` | `runReplyingPolicy(WithdrawRule, WithdrawHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:23–24](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L23-L24)；[R:85](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L85)；[MJ:2628–2845](../../fixtures/f1-credit-balance/mapping.json#L2628-L2845) |

| directBehaviors / `case GetBalance(replyTo)` | `Effect.reply(replyTo)(CreditBalanceConfirmation(None, state.accountBalance.values.toList))` | [CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30)；[R:86](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L86)；[MJ:2846–3004](../../fixtures/f1-credit-balance/mapping.json#L2846-L3004) |

| reserveBehaviors / `case cmd: ReserveFunds` | `runReplyingPolicy(ReserveFundsRule, ReserveFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:35–36](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L35-L36)；[R:88](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L88)；[MJ:3005–3242](../../fixtures/f1-credit-balance/mapping.json#L3005-L3242) |

| reserveBehaviors / `case cmd: DeductFunds` | `runReplyingPolicy(DeductFundsRule, DeductFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:38–39](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L38-L39)；[R:89](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L89)；[MJ:3243–3460](../../fixtures/f1-credit-balance/mapping.json#L3243-L3460) |

| reserveBehaviors / `case cmd: ReleaseReservedFunds` | `runReplyingPolicy(ReleaseReservedFundsRule, ReleaseReservedFundsHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:41–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L41-L42)；[R:90](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L90)；[MJ:3461–3678](../../fixtures/f1-credit-balance/mapping.json#L3461-L3678) |

| incomingCreditBehaviors / `case cmd: RecordIncomingCredits` | `runReplyingPolicy(RecordIncomingCreditsRule, RecordIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:47–48](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L47-L48)；[R:92](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L92)；[MJ:3679–3916](../../fixtures/f1-credit-balance/mapping.json#L3679-L3916) |

| incomingCreditBehaviors / `case cmd: CommitIncomingCredits` | `runReplyingPolicy(CommitIncomingCreditsRule, CommitIncomingCreditsHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:50–51](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L50-L51)；[R:93](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L93)；[MJ:3917–4134](../../fixtures/f1-credit-balance/mapping.json#L3917-L4134) |

| incomingCreditBehaviors / `case cmd: CancelIncomingCredit` | `runReplyingPolicy(CancelIncomingCreditRule, CancelIncomingCreditHelper)(state, cmd).replyWith(cmd.replyTo)` | [CB:53–54](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L53-L54)；[R:94](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L94)；[MJ:4135–4352](../../fixtures/f1-credit-balance/mapping.json#L4135-L4352) |

D05具体差异：raw三个写组之后另加QueryBehaviors，curated将GetBalance放direct最后，且Deposit/Withdraw顺序不同；本候选采用raw前三写命令顺序＋curated三组位置。[R:119–130](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L119-L130)、[BB:38–47](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L38-L47)、[BB:290–310](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L290-L310)、[CB:12–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L12-L30)。这是显式候选，不称重排等价。

D04只读候选直接回复**当前**state，没有失败臂/事件/Helper/规则；没有排序`values.toList`，不能保证业务排序。raw不匹配Get*StateReply名称分支，实际模板表达式是`???` [BT:80–88](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L80-L88)；不能用空balances填充缺口。九个写case只指定规则消费点，不在Behavior内重写/认可规则算法。

### 5.1 逐命令到事件的反查，不倒推raw业务血缘

下表事件名来自**前置mapping对curated规则的登记**，不是raw产生事件的证明，也不是本轮规则实施批准；raw定义仍未显式建立producedBy/causedBy [IM:138–150](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L138-L150)。九规则与Money/fold保留blocked，尤其前三个BalanceChanged调用的timestamp选择受D07制约。

| 命令 | 接线rule | curated登记的事件名（不是无条件发事件） | 独立算法来源反查 |
|---|---|---|---|

| AddInitial | AddInitialOnlyOnceRule | BalanceChanged | [IM:285](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L285)；[MJ:6360–6421](../../fixtures/f1-credit-balance/mapping.json#L6360-L6421) `/financialAlgorithmSources/0` |

| Deposit | DepositRule | BalanceChanged | [IM:286](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L286)；[MJ:6422–6483](../../fixtures/f1-credit-balance/mapping.json#L6422-L6483) `/financialAlgorithmSources/1` |

| Withdraw | WithdrawRule | BalanceChanged | [IM:287](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L287)；[MJ:6484–6545](../../fixtures/f1-credit-balance/mapping.json#L6484-L6545) `/financialAlgorithmSources/2` |

| GetBalance | 不适用 | 不产事件；不造失败臂 | [CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30)；[MJ:2846–3004](../../fixtures/f1-credit-balance/mapping.json#L2846-L3004) |

| ReserveFunds | ReserveFundsRule | FundsReserved | [IM:288](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L288)；[MJ:6546–6607](../../fixtures/f1-credit-balance/mapping.json#L6546-L6607) `/financialAlgorithmSources/3` |

| DeductFunds | DeductFundsRule | FundsDeducted | [IM:289](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L289)；[MJ:6608–6669](../../fixtures/f1-credit-balance/mapping.json#L6608-L6669) `/financialAlgorithmSources/4` |

| ReleaseReservedFunds | ReleaseReservedFundsRule | ReservationReleased | [IM:290](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L290)；[MJ:6670–6731](../../fixtures/f1-credit-balance/mapping.json#L6670-L6731) `/financialAlgorithmSources/5` |

| RecordIncomingCredits | RecordIncomingCreditsRule | IncomingCreditsRecorded | [IM:291](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L291)；[MJ:6732–6793](../../fixtures/f1-credit-balance/mapping.json#L6732-L6793) `/financialAlgorithmSources/6` |

| CommitIncomingCredits | CommitIncomingCreditsRule | IncomingCreditsCommited | [IM:292](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L292)；[MJ:6794–6855](../../fixtures/f1-credit-balance/mapping.json#L6794-L6855) `/financialAlgorithmSources/7` |

| CancelIncomingCredit | CancelIncomingCreditRule | IncomingCreditsCanceled | [IM:293](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L293)；[MJ:6856–6917](../../fixtures/f1-credit-balance/mapping.json#L6856-L6917) `/financialAlgorithmSources/8` |

## 6. Entity：四字段、empty、七事件与纯domain边界

候选声明序：package → §2两个imports → `object CreditBalanceEntity` → `// State` → CreditBalanceState → empty → `// Events` → sealed trait CreditBalanceEvent → 七事件按表 → `// Event Handler Extension Point` → alias → 关闭object。移除curated的formatter off/on只是D10排版提案；不改变符号，不把EventHandler实现在这个文件。来源 [CE:7–29](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L7-L29)、[ET:44–101](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L44-L101)。

| 序 / 字段 | 候选类型 | raw optional / raw构造默认 | 候选构造默认 / empty named arg | 反查 |
|---|---|---|---|---|

| 1 / userId | `Id` | false / 无 | 无 / `userId = userId` | [R:25](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L25)；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)；[MJ:4819–4891](../../fixtures/f1-credit-balance/mapping.json#L4819-L4891) |

| 2 / accountBalance | `Map[String, Money]` | true / `Map.empty` | 无 / `accountBalance = Map.empty` | [R:26](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L26)；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)；[MJ:4892–4964](../../fixtures/f1-credit-balance/mapping.json#L4892-L4964) |

| 3 / reservedAmount | `Map[Id, Money]` | true / `Map.empty` | 无 / `reservedAmount = Map.empty` | [R:27](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L27)；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)；[MJ:4965–5037](../../fixtures/f1-credit-balance/mapping.json#L4965-L5037) |

| 4 / incomingCredits | `Map[Id, Money]` | true / `Map.empty` | 无 / `incomingCredits = Map.empty` | [R:28](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L28)；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)；[MJ:5038–5110](../../fixtures/f1-credit-balance/mapping.json#L5038-L5110) |

**避免把元数据None读成Scala默认表达式**：userId的raw `FieldDef.defaultValue=None`表示“不发`= ...`”，不是`userId: Id = None`；MJ `/stateFields/0/rawBuilderTemplate/caseClassDefault`为null。[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)、[ET:33–36](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L33-L36)、[MJ:4819–4891](../../fixtures/f1-credit-balance/mapping.json#L4819-L4891)。前三Map的optional=true是metadata事实，raw Builder未消费optional而自加构造Map.empty；D06只建议curated必传Map＋empty初始化，尚未抹除冲突或宣布lossless。

`def empty(userId: Id): CreditBalanceState` 的候选完整RHS：`CreditBalanceState(userId = userId, accountBalance = Map.empty, reservedAmount = Map.empty, incomingCredits = Map.empty)`。named args为用户排版要求 [DE:49–51](../../diffs/domain-entity.diff.md#L49-L51)；实际三空Map来自 [CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)，不是其它数字/时钟/任意Id的默认授权。候选State四字段每项独占一行，字段序不改。

| 序 / 事件（均extends CreditBalanceEvent） | 全部字段顺序 / 原PB号 | 默认/父类差异 | 原定义 / curated / mapping / fold来源 |
|---|---|---|---|

| 1 / BalanceChanged | `update: Money (#1), timestamp: Long (#2)` | 候选timestamp必传无默认；curated时钟默认待D07 | [R:35](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35)；[CE:17](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L17)；[MJ:5113–5294](../../fixtures/f1-credit-balance/mapping.json#L5113-L5294)；[CF:12–13](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L12-L13) |

| 2 / FundsReserved | `transferId: Id (#1), amount: Money (#2)` | 无字段默认；family父类待D08 | [R:36](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L36)；[CE:18](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L18)；[MJ:5295–5475](../../fixtures/f1-credit-balance/mapping.json#L5295-L5475)；[CF:15–19](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L15-L19) |

| 3 / FundsDeducted | `transferId: Id (#1), amount: Money (#2)` | 无字段默认；family父类待D08 | [R:37](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L37)；[CE:19](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L19)；[MJ:5476–5657](../../fixtures/f1-credit-balance/mapping.json#L5476-L5657)；[CF:20–23](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L20-L23) |

| 4 / ReservationReleased | `transferId: Id (#1), amount: Money (#2)` | 无字段默认；family父类待D08 | [R:38](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L38)；[CE:20](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L20)；[MJ:5658–5838](../../fixtures/f1-credit-balance/mapping.json#L5658-L5838)；[CF:24–28](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L24-L28) |

| 5 / IncomingCreditsRecorded | `transferId: Id (#1), amount: Money (#2)` | 无字段默认；family父类待D08 | [R:39](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L39)；[CE:21](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L21)；[MJ:5839–6019](../../fixtures/f1-credit-balance/mapping.json#L5839-L6019)；[CF:30–33](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L30-L33) |

| 6 / IncomingCreditsCommited | `transferId: Id (#1)` | 无字段默认；family父类待D08 | [R:40](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L40)；[CE:22](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L22)；[MJ:6020–6188](../../fixtures/f1-credit-balance/mapping.json#L6020-L6188)；[CF:34–38](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L34-L38) |

| 7 / IncomingCreditsCanceled | `transferId: Id (#1)` | 无字段默认；family父类待D08 | [R:41](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L41)；[CE:23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L23)；[MJ:6189–6357](../../fixtures/f1-credit-balance/mapping.json#L6189-L6357)；[CF:39–42](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L39-L42) |

D08候选`sealed trait CreditBalanceEvent`无父类，沿curated；raw Builder强加CborSerializable [EB:214–231](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L214-L231)。七事件全在Entity直接owner，不建event-family companion。保留`IncomingCreditsCommited`拼写、FundsDeducted.amount及PB号2，即使fold不读amount也不删字段 [CF:20–23](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L20-L23)。PB号是旁路序列化输入保护，不写成这四文件的新注解。

D07不是“帮忙补时间”：raw timestamp无默认，curated `System.currentTimeMillis()` 是构造时副作用 [R:35](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35)、[CE:17](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L17)。本候选先沿raw要求显式Long，但curated三个余额规则登记为单参数BalanceChanged调用 [IM:285–287](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L285-L287)；取得完整闭包之前必须裁定时间输入/调用点，不能现在合成Scala或以回放时钟兜底。

alias精确RHS：`type CreditBalanceEventHandler = (CreditBalanceState, CreditBalanceEvent) => CreditBalanceState` [CE:26–27](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L26-L27)。它只定义纯fold接口，不把真实EventHandler、Money方法或九规则混入Entity。七fold与helper的算法在本四件之外：raw updateAccountBalance的referenceCode只进提示，实际RHS仍`???` [FT:62–76](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/EntityBehaviorTemplate.scala#L62-L76)；curated helper存在归零fallback与额外defaultMoney/originalMoney [CF:46–57](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L46-L57)，IncomingCreditsCommited直接Map.apply [CF:34–38](../../baseline/curated-scala/net/imadz/domain/entities/behaviors/CreditBalanceEventHandler.scala#L34-L38)。它们不因保留sourceSha或simple-copy样式获批。未知事件策略仍按前置blocked项 [IM:277](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L277)、[IM:325](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L325)。

## 7. raw → target的有限差异账（静态计划，不是实跑unified diff）

| id / 四件范围 | raw/curated实物差异 | 候选目标变化 | 准确来源 / 裁定 |
|---|---|---|---|

| X01 / Protocol, CommandHelpers, Behaviors, Entity | banking context and raw symbol resolution; listOfMoney explicitly net.imadz.banking.domain.values.Money | curated net.imadz packages and actual nested owners; no nominal-type merge | [R:22](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L22)；[IM:322–323](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L322-L323)；[CP:1–8](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L1-L8)；D01 |

| X02 / Protocol | ten commands with synthetic trailing typed replyTo; seven replies; no inline state in PB | same ten field orders, seven replies preferred, imported Effect alias; curated TransferConfirmation explicitly pending exclusion | [PB:43–77](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L43-L77)；[PB:97–105](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateProtocolBuilder.scala#L97-L105)；[PT:89–108](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L89-L108)；[CP:12–39](../../baseline/curated-scala/net/imadz/application/aggregates/CreditBalanceProtocol.scala#L12-L39)；D09,D10 |

| X03 / CommandHelpers | three balance replies mechanically Reply(param,None/Some(error)); six phase RHS text matches curated | Deposit arms user-required; AddInitial/Withdraw error/balances arms remain curated proposals pending D02; six phase arms pending D03; newState spelling proposed, generic post-fold/no-persist-on-failure rule required | [HB:110–119](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L110-L119)；[CH:17–94](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L17-L94)；D02,D03,D10 |

| X04 / CommandHelpers, Behaviors | helper input order; write groups then QueryBehaviors; curated puts Withdraw before Deposit and query in direct | candidate raw direct order AddInitial,Deposit,Withdraw; query at end of direct; three groups, no command loss | [HB:41](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala#L41)；[BB:38–47](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateBehaviorBuilder.scala#L38-L47)；[R:119–130](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L119-L130)；[CH:15–42](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceCommandHelpers.scala#L15-L42)；[CB:12–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L12-L30)；D05 |

| X05 / Behaviors | GetBalance reply is ??? | curated current-state balance projection, no failure arm; proposal only | [BT:80–88](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L80-L88)；[CB:29–30](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L29-L30)；D04 |

| X06 / Behaviors | static RuleRule naming; local CreditBalanceAggregateCommandHandler; additional duration import | single Rule names; use Protocol.CreditBalanceCommandHandler; curated five-import order, no duration import | [N:125](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L125)；[N:187–224](../../baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala#L187-L224)；[T:371–379](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L371-L379)；[BT:31–40](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L31-L40)；[BT:140–145](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L140-L145)；[CB:3–12](../../baseline/curated-scala/net/imadz/application/aggregates/behaviors/CreditBalanceBehaviors.scala#L3-L12)；D01 |

| X07 / CommandHelpers, Behaviors | 27 helper method MANUAL blocks and apply MANUAL protection; curated has none | preserve protected-body obligation; adding protection means curated bytes are not whole-file expected | [HT:45–62](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L45-L62)；[BT:136–145](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L136-L145)；[DH:137–146](../../diffs/command-helper.diff.md#L137-L146)；D10 |

| X08 / Entity | three optional=true metadata maps emitted non-Option with constructor Map.empty; userId has NO emitted default | candidate all four required constructor fields, no defaults; named empty args preserve actual userId and three Map.empty | [R:24–29](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L24-L29)；[EB:174–193](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L174-L193)；[ET:33–63](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L33-L63)；[CE:11–13](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L11-L13)；D06 |

| X09 / Entity | timestamp required with no default; event family has CborSerializable | candidate required timestamp (not curated clock default), family no parent; keep all payloads and spelling | [R:35–41](../../baseline/bc/src/main/scala/net/imadz/meta/Examples.scala#L35-L41)；[EB:214–267](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainEntityBuilder.scala#L214-L267)；[CE:16–23](../../baseline/curated-scala/net/imadz/domain/entities/CreditBalanceEntity.scala#L16-L23)；D07,D08 |

| X10 / Protocol, CommandHelpers, Behaviors, Entity | template comments/layout/MANUAL/FQN emission differ from curated source | complete imports/construct order below; explicit finite formatting policy, no whitespace/package stripping for comparisons | [PT:89–108](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateProtocolTemplate.scala#L89-L108)；[HT:45–89](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala#L45-L89)；[BT:129–170](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala#L129-L170)；[ET:97–116](../../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala#L97-L116)；[AUTHORING:25–39](../../AUTHORING-CONTRACT.md#L25-L39)；D10,D14 |

该账穷尽本候选选择的内容偏差维度，不声称预测了尚未取得的raw全文空白/import细节。实际raw→target和JS→target两份完整diff必须另行取得；任何新增差异需要单独解释，不能用AST比较或“格式规范化”掩盖。[CONTRACT:44–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L44-L50)。

## 8. 评审可逐项决定的最小选择与剩余阻断

| id / 当前状态 | 建议作出的具体选择 | 替代或停止条件 | 前置映射项 |
|---|---|---|---|

| D01 / decision-required | 采用 curated net.imadz 根包、Entity/Protocol 实际嵌套 owner、单 Rule 后缀和 Protocol 的 CreditBalanceCommandHandler。 | 若保留 banking context，四文件及闭包统一改明确FQN；不可删包名作比较，不动PID/proto。 | B-identity |

| D02 / Deposit=user-required-content；AddInitial/Withdraw=decision-required；input-binding-blocked | Deposit点名三方法示例保留；AddInitial/Withdraw两臂仅curated候选 / proposed-default（失败Some(error),Nil；成功None,newState.accountBalance.values.toList），是否采纳分别待裁。 | 不得保留raw参数错位或从同形两臂推成授权；通用成功读新state/失败不persist仍为用户要求，规则事件算法仍blocked。 | U-balance-replies,P-balance-replies,U-effects,B-adapter |

| D03 / decision-required | 逐一采纳六阶段回复的 transferId=param 或 param._1、error=None/Some(error) 显式绑定。 | 如任一不采纳，给该方法精确两臂和来源；不按Reply名猜字段。 | P-six-replies |

| D04 / decision-required | GetBalance采用当前state.accountBalance.values.toList；无失败臂，不排序、不造写Helper。 | 如果顺序必须稳定，另提供业务顺序与输入；raw ??? 不能用成功空列表兜底。 | P-get-balance |

| D05 / decision-required | Protocol按raw十命令/七回复；Helper直接组按AddInitial,Deposit,Withdraw；Behavior同序并把GetBalance放direct末尾，保留三个组。 | 可选curated的AddInitial,Withdraw,Deposit，或raw独立第四QueryBehaviors；必须明确一种，不能排序后声称字节等价。 | P-order |

| D06 / decision-required | State四字段全部必传、无构造默认；empty(userId)按四个named args给真实userId和三Map.empty。 | 保留raw三个Map.empty默认或Option语义必须另标输入策略，不能吞optional=true。 | B-state-defaults |

| D07 / decision-required | BalanceChanged(timestamp: Long)显式必传，候选不带时钟默认（沿raw字段）。 | 若采curated System.currentTimeMillis()，必须裁定构造时钟/回放边界；必传方案也需裁定curated单参数调用点的时间来源，不能现在补时钟。 | B-event-defaults,B-financial-bodies |

| D08 / decision-required | CreditBalanceEvent无父类，七case class仅extends CreditBalanceEvent（curated纯domain形状）。 | 若保留raw CborSerializable，另裁序列化边界与完整imports；不能放宽serializer allowlist。 | B-event-defaults,B-identity |

| D09 / decision-required | F1候选只含七个raw回复，明确排除curated额外TransferConfirmation；逐项列出保留构造与格式。 | 如保留第八项，显式声明curated扩展输入及版本；它不是第11命令，也不能删除原参考。 | B-reply-extra |

| D10 / decision-required | 保留27个Helper方法MANUAL保护和Behavior.apply一处MANUAL；成功形参建议newState；显式格式/头部规则按本文。 | 若改外置实现，需单独所有权与保护合同；不能从curated无marker推断可丢raw保护。 | B-adapter,P-order |

| D11 / blocked-business | 独立裁定九规则事件/错误/幂等、Money及七fold的算法/oracle与实现所有权。 | 不借退休槽，不以零余额、Right(Nil)、case _ => state或curated全副本填空；本轮只保留来源。 | B-financial-bodies,B-fold-fallback |

| D12 / blocked-supply | 落实同一获准输入及两端无损adapter；记录所有裁定偏差与每条命令/事件来源。 | 本manifest/mapping都不是作者树、request或公共DSL，lossless保持false。 | B-adapter |

| D13 / blocked-supply | 按主agent转述的既有坐标为net.imadz:common-core_2.13:0.2（非用户逐字引文或制品字节证据）优先发布制品；实施前另锁字节/API及技术闭包。 | 另一会话负责common-core；本轮不调查glue，不认withPost/policy为发布API，不补拷外部源码。 | B-artifact |

| D14 / blocked-supply | 先裁定全文，再在另获准窗口取得raw实跑/approved-target/JS实跑全文与两份完整diff，最后填expectedSha。 | sourceSha、片段SHA、格式通过或四条manifest记录均不计目标完成；CC全部未测。 | B-expected |

各决定的准确来源与受影响四件在manifest的`decisions[].evidence/affectedTargets`；本表所有`resolved=false`，D02仅Deposit点名三方法示例是user-required；AddInitial/Withdraw两臂仍是proposed-default / decision-required，字段级输入也未建立，不能把本次列出它当新实施批准。D01–D10可逐项讨论；D11必须由业务/oracle独立裁，D12–D14是供应/实施许可/真实字节准入，不以docs完成解除。

三个退休无界源码槽 `support-controller arbitrary path/content`、`projection manualBlocks`、`implOverrides`仍全部blocked，不用B兜底，也不借其承载算法。依据 [RETIRE:132](../../PARTITION-RESOLUTIONS.md#L132)与当前用户指令。

## 9. manifest的完整性与冻结门

- 四条files记录逐件绑定完整curated sourcePath/sourceBytes/sourceSha/sourceRef、计划target绝对路径、构造序、imports、成员覆盖、profile及决定依赖；每条expectedSha/expectedBytes均null，wholeFileFrozen=false，expectedFileCreated=false。
- commands逐项覆盖10条（9写/1只读）、9个Helper的27个签名与两臂、全部Behavior case；replies覆盖7项并另列第8参考扩展；stateFields覆盖4项；events覆盖7项与逐事件fold反查。所有RHS只是有来源/状态的文档字符串，不是已输出Scala文件。
- 未来只能在明确运行许可后保存raw原输入及实跑输出、curated来源、逐决定审定后的目标全文、JS真正产物、两份完整diff；现在executionCommand与输出记录均null。source副本、单Deposit片段或其SHA不能充当四件目标；即便未来恰与source相同，也必须重新审定完整target字节才能给expectedSha。
- 金融算法/名义类型/默认/时钟/发布API/serializer/PID/tag闭包不能从漂亮签名推导。common-core给定坐标不是制品字节锁；不调查glue、不下载、不补拷。
- 本轮只做文档JSON解析、相对链接/行界检查、选定来源全文SHA与前置pin核对、命令/事件/字段静态反查；不称运行验收、同输入通过、已实现或CC达标。CC全部未测。

准入依据 [CONTRACT:40–50](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L40-L50)、[CONTRACT:113–115](../../FIXTURE-AND-EXPECTED-CONTRACT.md#L113-L115)、[IM:331–370](../../fixtures/f1-credit-balance/INPUT-MAPPING.md#L331-L370)。
