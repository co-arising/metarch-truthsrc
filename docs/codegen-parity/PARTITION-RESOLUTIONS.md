# A/B 分区的跨组裁定与中央合并规则

最后更新：2026-11-16。状态：**文档分类裁定，非源码/运行语义变更批准。** 各分区保留独立作者原稿；中央`js-partition.json`合并时应用下列明确裁定并保留原逻辑ID映射，不能简单拼接出自相矛盾的A/B。

## 1. 共同原则

分类、实现完整度、包位置、业务/ABI兼容、当前消费五个维度分开。

- A按实际内容与传统制品职责对应，即使缺父接口/方法体/正确接线也仍是差距工作包。
- B不表示免检，亦不表示只要搬包就合理。
- 同一renderer相同construct在不同profile里必须有一致分类；有真实条件差异才分变体。
- 不因纯Command名为Command就算Actor协议；不因技术类型字段相似就合并名义身份。
- 重分类不等于迁移代码，也不授权改PB/PID/serializer/幂等摘要/运行方式。

## 2. R01：Computations是DomainService的部分内容对应

相关原行：
- `formal-domain/domain-computations/shared`：A/domain-service。
- `formal-service/computation-port/pure`：原稿B。

**裁定：两者统一A/domain-service，完整度为“仅计算能力声明；算法未生成”。**

证据：
- [DomainServiceModel L6–18](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/domain/DomainServiceModel.scala#L6)分别记录superInterface、方法签名和logicCode。
- [DomainServiceBuilder L24–38](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/domain/DomainServiceBuilder.scala#L24)提供父类型和逻辑文本。
- [DomainServiceTemplate L29–44](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainServiceTemplate.scala#L29)实际把logicCode放注释，body仍`???`；不能因JS接口没算法而归B、同时把raw未实现算法当完整A。
- [render-domain L31–36](baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L31)为Computations trait/逐host抽象方法/companion/空host时none；L37–42的emit是另一规则职责，不纳入计算接口。

最强反对意见成立于**结构差距**：注入trait不是raw singleton object，没继承DomainService，方法参数映射不同。这些写入domain-service diff，不靠B绕过。

中央合并处理：原ID不必改名；将service行classification改A、scalaArtifact=domain-service，加`coverage=declaration-only`。目标仍按明确纯端口与实施所有权设计，不虚构业务算法或把none空对象叫服务完成。此规则不推广到所有名为port的接口。

## 3. R02：声明式MoneyWire/MoneyPO仍归值声明A，codec另归B

相关原行：
- `formal-domain/exact-representation-carriers/shared`：原稿B，条件从ordinary-values排除codec refs。
- `formal-service/value-object/record`：已包含同样声明A。

**裁定：这些不可变名义record声明与其他已声明值一致归A/value-object；wire/PO转换和精确文本处理仍是独立B。**

证据：
- [render-values L4–8、28–36](baseline/js/generators/scala-cqrs-domain/render-values.mjs#L4)统一遍历声明type，非exact-domain的record按成员生成final case class；没有codec-ref改变声明职责的分支。
- [ValueObjectTemplate](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/ValueObjectTemplate.scala)允许无派生业务方法的字段化值定义；不要求每个值都有金额算术。
- [银行配置](baseline/bank/truthsrc.project.json#L124)明确wire/PO角色，[MoneyWire](baseline/actual-js/app/example/bankwealth/domain/values/MoneyWire.scala)与[MoneyPO](baseline/actual-js/app/example/bankwealth/domain/values/MoneyPO.scala)仍是两个独立名义record。
- [render-serialization L33–55](baseline/js/generators/scala-cqrs-domain/render-serialization.mjs#L33)承担真正转换/解析职责，不与声明重复计。

最强反对意见：技术DTO不是领域金额。该意见影响**目标放置和边界**，不能把相同字段声明在两个入口分成相反A/B。也不意味着所有状态协议/数据库row都自动变VO。

中央处理：合并carrier声明到`formal-domain/ordinary-values/shared`，删除其人为排除codec refs的条件；旧carrier ID作为溯源alias，不再单列B或重复文件owner。撤销原稿无条件移入infrastructure的目标：当前位置如实保留，最终DTO归属需value/codec/调用方闭包裁定。保持两个名义类型与全部字段/codec，不自动合并或移动。

## 4. R03：Standalone ESB装配归Bootstrap，不归Root

相关原行：`formal-domain/actor-root/standalone`原稿把PID、initial、EventSourcedBehavior和adapters保留在application Aggregate目标。

**裁定：重命名为`formal-domain/aggregate-bootstrap/standalone`，A/bootstrap；ordinary root在这个profile仍缺handler/key/tags的独立声明。**

证据：
- [AggregateRootTemplate普通分支](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRootTemplate.scala#L110)提供commandHandler/key/tags。
- [BootstrapTemplate L89–112](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/BootstrapTemplate.scala#L89)才提供PID/initial/ESB/handlers/adapters和恢复配置。
- [standalone render-actor L17–27](baseline/js/generators/scala-cqrs-domain/render-actor.mjs#L17)是该装配职责；[service bootstrap L18–30](baseline/js/generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs#L18)同职责已归bootstrap。

按Akka习惯把Behavior放Aggregate.apply未必错误，但本次明确按传统Scala逻辑族对齐。物理object名不能推翻已存在的bootstrap职责边界。

中央处理：
- bootstrap拥有L17–19签名/guard/ESB构造，以及L25–27事件handler/adapter装配；L20–24命令body继续归aggregate-behavior。
- 目标为`app/{basePath}/infrastructure/bootstrap/{Aggregate}Bootstrap.scala`，协议/factory各归其owner；原复合文件header/import/闭括号统一由runtime assembly owner协调拆分。
- 原root行ID保留溯源映射，重写catalogCoverage、dependsOn和容器引用；不凭新目标创造“当前已实现root”的覆盖。
- service root的handler-wiring仍为部分A/root；standalone缺key/tags与sharding支持是明确缺口。
- 保留ofUniqueId、显式initial和执行顺序；不因此引入sharding/retention/backoff。

## 5. R04（交叉复核后修订）：纯Command按参数记录与分发骨架拆分

早期裁定把纯Command整个归B，理由是它不是raw独立CmdParams；交叉复核发现这仍漏掉真实职责：flat规则的`p`就是该具体Command record，layered/family的RuleParams也显式引用该record。不能把“不是Actor协议”推成“没有规则参数对应”。**本节新结论替代先前整项B处理，保留审阅分歧于原结果文件。**

统一规则：
- 具体command-specific case class的记录名、构造器字段、类型/顺序为部分A/aggregate-rules-formal（parameter-record-declaration）。
- `sealed trait Command`及`extends Command`的sum/dispatch成员关系为B；仍不含ActorRef，不冒充应用协议。
- 文件header/package/import/object边界和case class两种贡献由一个assembler组装，不能同一字段重复算A和B。
- rule admission、名字/Params所有权、只声明还是已被规则消费单列；分类不表示参数接口或算法已对齐。

证据：[JS render-domain:20–30、69–88](baseline/js/generators/scala-cqrs-domain/render-domain.mjs#L69)直接以具体Command为p，layered以input.command取p；[raw Builder:81–89](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateRulesBuilder.scala#L81)正是排replyTo后保留所有声明payload字段，并非只取guard引用的最小字段。family1 [build-models:258–283、305–309](baseline/js/generators/scala-cqrs-domain-kernel-v1/build-models.mjs#L258)输出record及显式wrapper但不实现规则；family2另加rules读取params.command。

应用于六个原pure-command行：formal-domain、formal-service、formal-application、legacy-domain的product、family-domain-aggregate、family-readside-play；原ID保存为B分发骨架，新增唯一A字段记录行并共同指向原文件容器。

真正的额外wrapper参数仍归A：`formal-service/rules/parameters`、`family-domain-aggregate/formal-rules/parameters`、`family-readside-play/formal-rule-params`；它们只拥有自身state/command/hosts字段，不再次拥有被引用record的字段。`legacy-domain/rule-parameters/legacy`是独立legacy实现，不是product wrapper。缺body/准入差异保留，不据此自动改名、删wrapper或移包。

## 6. R01/R02/R03在后续片段中的同源应用

| 原ID | 中央处理 |
|---|---|
| `family-domain-aggregate/computations/port` | B→A/domain-service；declaration-only，方法体缺口保留 |
| `legacy-domain/computation-port/product` | 同上 |
| `legacy-application/service/computation-port` | 同上；run-all:1781–1792实际以domainServices供给该接口 |
| `legacy-application/service/port-bridge` | 保持B：独立目标委托，不是生成计算算法；同文件owner不变 |
| `family-domain-aggregate/representation/wire`与`representation/po` | 合并声明覆盖到A `value-object/domain`，原ID作为alias；移除目标行codec-ref排除条件；两名义类型不合并 |
| `formal-application/aggregate-root/shared` | 改A/bootstrap，中央ID=`formal-application/aggregate-bootstrap/shared` |
| `legacy-domain/actor-root/product` | 改A/bootstrap，中央ID=`legacy-domain/aggregate-bootstrap/product` |

family纯计算签名的证据为[params.mjs:3–13](baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#L3)，名义表示声明为[values.mjs:17–36](baseline/js/generators/scala-cqrs-domain-kernel-v1/templates/values.mjs#L17)；codecs只是引用独立value定义，不改变声明职责。legacy的bridge [emit.mjs:255–268](baseline/js/generators/service-dsl/emit.mjs#L255)只是调用另一个owner的方法，仍是B。

所有ESB重分类沿R03：L20–24命令body留behavior，L28顶层factory留factory；bootstrap只接装配，不凭目标补出当前不存在的root/key/tags。

## 7. R05：Strict fixture对照按具体codec/entry/completion部分拆分

不能把整个direct host等同fixture，也不能因为只有部分对应就把真实对应职责藏到B。以下是实际strict API和模板构造的对应，不代表wire或恢复语义兼容：

| 内容 | 分类与精确对照 |
|---|---|
| 具体Args/Receipt PayloadCodec | 部分A/strict-fixture-host：JS [render-host:25,40–42](baseline/js/generators/scala-cqrs-application/render-host.mjs#L25)与raw [FixtureHostTemplate:221–244,496–505](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala#L221)均实现codec pin/encode/decode；PB与length-prefixed wire差异明确保留 |
| direct入口→Args/start及status→completion分类 | 部分A/strict-fixture-host：JS [render-invocation-host:19,27–29,32,39](baseline/js/generators/scala-cqrs-application/render-invocation-host.mjs#L19)与raw trigger/start/completion；不包括association hash、validStatus、nextResult或intent/ack状态机 |
| completion物化/交付接缝 | 部分A/strict-fixture-host：JS [HostIO:35–39,50–52](baseline/js/generators/scala-cqrs-application/render-host-io.mjs#L35)与raw completion映射/producing-command发布。JS外部authority/callback不同于raw事件构造＋ask，不据此证明耐久发布 |

中央处理：
- `formal-application/strict-payload-codecs/shared`保持部分A；`direct-entry-mapping/shared`缩窄至上述对应，association/lifecycle移交现有B `direct-association-host/shared`；completion-delivery保持部分A。
- `formal-service/strict-definition/module-and-phases`拆出具体codec A/strict-fixture-host，余下模块/phase仍A/strict-saga-module。
- `formal-service/invocation-host/direct`拆出上述entry/classification A，其余association/lifecycle仍B。
- `formal-service/host-io/admission-delivery`拆出deliver的部分A，admit/admitOccurrence仍B。
- pipeline host保持部分A/composition-invocation-host；wire/PO codec、host serializer、checkpoint codec不得混同此处strict PayloadCodec。
- `wireHostIO:12–14`会替换初始direct-host delivery body；最终emit只算替换后的调用，不能把被替掉的body和HostIO再计两份当前实现。

## 8. R06：多模块接缝的声明接口沿相同职责口径分类

后到的`family-seams-saga/seams-port/computation`同样只生成具名纯计算方法声明；根据R01归部分A/domain-service，不能因为采用capture外置实现而一律归B。`seams-port/flow`给出报价用例的Future型应用方法合同，归部分A/application-service；[raw ApplicationServiceModel](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ApplicationServiceModel.scala)有methods及body槽，而[Template:58–87](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ApplicationServiceTemplate.scala#L58)同样留MANUAL `???`。trait与注入class、依赖与调用命令缺口照常进入diff，不称算法已生成。

依据为[seams模板:19–34、53–57](baseline/js/generators/scala-cqrs-module-seams-v1/templates/scala.mjs#L19)。bridge仍是独立纯实现委托B，root只做显式构造与返回flow亦保留B，不凭“Root”名字当完整CQRS ApplicationBootstrap。此裁定只针对已定义角色的计算/应用流接口，不把所有technical ports都归服务A。

## 9. R07：退休port与policy执行职责校正

- `retired-seven/ports/domain-contract`改部分A/domain-service（声明）；同文件`domain-service-bridge`改B（委托独立算法），沿R01，原ID及同一assembler保留。
- `legacy-orchestration/policy/sharding-mechanics`改部分A/application-service，与退休command-dispatch相同职责：具名Params→Future[Either[error,Unit]]，寻址typed ask并翻译回复。两个emitter不是同一源码，不合并实现；DI/class形状及业务范围差异保留。
- `retired-seven/policy-exec/envelope-handler`改B，与legacy delivery-handler一致；它组合decode/decide/execute/dispose/bury投递命令，并不负责raw ProjectionHandler的read/apply/write读模型事务。不能只因继承Akka Handler就归projection-handler。
- 退休三个无界输入槽（support-controller任意path/content、projection manualBlocks、implOverrides）只能对固定已读样本分类。中央保持全部641导航键可追溯，但完整内容分区仍受这三处阻断，不发明“638已完整”数字。

源证据：退休rules generate:128–152、退休policy-exec generate:119–177、legacy policyexec:176–265，以及raw ApplicationService/ProjectionHandler模板；对应完整固定副本在baseline索引。

## 10. 中央合并仍须检查

本页裁定已发现的实际冲突。后续新fragment同renderer/construct出现矛盾时按同样规则核源码，不按多数票或目录名覆盖。中央文件需保留`classificationCorrections`、旧逻辑ID映射与review来源，最终计数按纠正后逻辑项计算，不照抄各组自报总数。

以上裁定经独立反证阅读后由主集成者采用；它们是本次清单分类，不是用户批准新的业务政策、目标ABI或生产修改。
