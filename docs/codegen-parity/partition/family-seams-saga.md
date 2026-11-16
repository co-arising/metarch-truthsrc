# family-seams-saga 逻辑制品分区

状态：`content-specification`。本分片只描述两个独立候选生产器，**未执行应用、CLI、生成、测试、typecheck、编译或运行时**，也不构成银行消费或 parity/behavior PASS。

## 覆盖与入口

- `scala-cqrs-module-seams-v1`：11条producer-output合同。
- `scala-cqrs-saga-monarch-v1`：9条producer-output合同。
- 共20条均已映射；JSON为完整construct/路径/fixture/规则账。逻辑行数见下方统计，不能换算成物理文件或覆盖的Scala族数。
- 公共入口是 `lib/project/cli.mjs` 的capture与projectPlan，经 `lib/products/generate-cli.mjs` 独立注册后到各family的generate/render，再由公共 `applyEntries` 写出。raw `generate-products` 连`--plan`也拒绝这两个要求live capture的family。文件存在、受条件源码可达、真正调用及真实执行通过是四件事。
- 银行固定配置 [truthsrc.project.json](../baseline/bank/truthsrc.project.json) 第278行选择 `scala-cqrs-play-service`，其 [入口](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 第16行继承 `createEffectRegistry('2')`，再覆写aggregate/invariant及Play配置；没有调用这两个family。本组两producer都记为 `not-selected`，不代表退役。

## 多模块接缝：从签名到一次明确构造

可读业务路径是 **报价入口 QuoteFlow → RouteRepository读路由 → 纯计算端口 → 名义结果**。生成器提供值与签名、必要的纯委托桥、依赖构造根和形状检查；真正的计算、读存储与流算法仍在被捕获的外置源码中，不是生成的业务实现。

1. **A：名义值record与sum。** `valuesTemplate`真实生成case class、sealed trait/companion与case object/有载荷变体。与传统VO的值建模职责对应，但raw Scala还有JSON companion、defaults和logicMethods，当前候选没有这些能力。sum也是不同表示变体，不是假称传统模板已有sum分支。不能把它们改为String/type alias凑对齐。
2. **A：只读repository接口。** `portTemplate`的路由查询属于读侧repository合同，目标在 `modules/kernel/src/main/scala/<base>/application/projection/repository/<Repository>.scala`。共享Route值与raw companion DTO之间仍有A差距；既不补造event projection，也不把它当Actor EntityRef仓储。
3. **B：计算/流端口及桥。** 端口只有def签名，没有DomainService对象实现或ApplicationService注入方法体。目标分别在 `domain/services/<Port>.scala`、`application/services/<FlowPort>.scala`；桥在 `domain/services/<Bridge>.scala`，只对显式非端口pure implementation发出。class delegate在root构造后注入，object delegate直接调用；不能复制外置算法。
4. **B：构造根。** 当前`<base>.composition`违反三层目标，移至 `src/main/scala/<base>/infrastructure/bootstrap/<Root>.scala`。object/factory、curried/implicit参数组、拓扑顺序val、class/object构造差异及最后返回端口都完整保留。它没有CQRS注册、Actor初始化或event-source，不能凭“root”名称算ApplicationBootstrap。
5. **B：build与shape tests。** `build.sbt`、`project/build.properties`有明确归属；两个spec分别移到测试根下的 `domain/values` 与 `infrastructure/bootstrap` 包。value spec只查Product/getter/继承，root spec只编译factory调用并断言root非空，均不调用真实业务流，更不是独立oracle。

所有Scala import必须由类型依赖模型给出。目前seams广用`_root_`完整类型，桥和factory调用也有位置参数；整改需保留外置ABI与求值顺序，不能仅regex删除FQN。

## Saga/Monarch：六个生产容器必须按成员拆分

可读路径是 **原始item/request → durable association → A.prepare → B.prepare → A.commit → B.commit → 已证实终态 → delivery ack → 原项守恒的批次完成/资源释放**。补偿依协调器保存的prepare回执，未知不等于安全缺席。声明typed Run时还可走 **原始Input → fixed-step纯叶子或单managed外部操作 → 确认写前缀 → typed Output/Stopped**；不能将所有纯`Command`改成含ActorRef的Actor协议。

| 当前物理容器 | A职责 | B职责与明确目标 | 唯一当前装配owner |
|---|---|---|---|
| `modules/kernel/.../kernel/<Protocol>.scala` | 名义值；Strict模块阶段输入/回执/参与者合同 | association、delivery、证据授权、ApplicationPorts/Facade、Run Protocol分别落到kernel的application层；BinaryCodec接口留应用边界 | `saga-protocol-assembly` |
| `modules/kernel/.../kernel/<Codecs>.scala` | 无传统ScalaPB转换对应 | 十个基础codec、Out/In/规范frame移glue的`infrastructure/persistence/converters/<Codecs>.scala`；条件Run codecs共享唯一frame实现 | `binary-codecs-assembly` |
| `modules/glue/.../glue/<Saga>.scala` | StrictSagaModule的codec/pins/PhasePort/definition；Strict fixture宿主的激活/状态/交付职责 | 不丢任何A缺口；区别见下文 | `saga-assembly` |
| `modules/glue/.../glue/<Runtime>.scala` | 无classic aggregate或split/await/merge宿主对应 | settings/ownership到bootstrap；raw Run工厂到persistence strategies；typed Run到application/services/transactor；managed Adapter到infrastructure/connectors；Host到persistence strategies | `runtime-assembly` |
| `modules/glue/.../glue/<Workflow>.scala` | 无；不是retired Scala Policy | 有限R2 WorkflowProgram，目标`application/services/transactor/<Workflow>.scala`；包含policy、原项/证据/Carry/Retry/连接/恢复全部方法 | `workflow-assembly` |
| `src/main/.../root/<Root>.scala` | ApplicationBootstrap组件构造与fromExternal装配 | recovery用例到`application/services/transactor/<Host>Recovery.scala`；关闭/所有权到`infrastructure/bootstrap/<Host>Lifecycle.scala` | `root-assembly` |

上述包模式的物理根完整定义在JSON中。`kernel/glue/ext/root`只是构建模块，不能再作为业务根下的平行架构层。各当前共享容器的generated头、import块、trait/companion、val初始化、末尾括号和局部资源都有唯一归属；拆文件后由各目标文件按实际依赖重建imports，不复制两套身份或frame算法。

### 必须保留的条件分支

- **no-Run不是空实现。** 基础`RunFactories`与`CheckedRunFacade`始终生成，但它们只接ByteString/调用方函数，不能证明author typed Run生成。`m.runs`非空才加Run Protocol/Codecs/解释器/Host；versioned是pure fixed-step，managed严格只有一个external步骤。
- **规范frame。** 基础codec版本是Int；Run版本是String，额外绑定semanticDigest和role。代码拒绝坏UTF-8、错误长度/尾字节、非canonical bytes；phase handle校验按生产者范围，不因同pin抹平范围。
- **身份。** 原始item摘要、`strict-saga-plan-v2`与`truthsrc-run-identity-v1`帧不同；原namespace/PID、transaction/result prefix、connector/epoch/codec pins必须不动。
- **批次策略。** single/CountOrWait/compatibility、按三终态分派、Release/whole Carry、digest-proof/owner-certificates各自保留。Retry只对显式managed Run的rejected-before-effects发出，受执行/转换预算约束，耗尽按明确fail/hold处理。
- **恢复。** `recoverRuns`与`resumeRuns`分开：先核durable association与授权，再看原job/batch/item和资源Grant；未终态不能当已恢复完成。RunHost未知query不冷激活，独立RunHost.reconcile本身没有token，不能把外层授权承诺自动推广到所有调用方。
- **生命周期。** root先构造reservations、Run Hosts、program，再按lazy访问构造WorkflowHost；`CallerOwned`不终止ActorSystem，`ApplicationOwned`等待终止。移动成员不能提前启动或改变关闭顺序。

## A基准例外与缺接线

仅使用传统39族及单列3扩展的身份表，不把`template/products/*`当金样。这里的Strict调用真实使用`StrictSagaDefinition`、`StrictParticipant`、`PhasePort`，故有A对应；但raw StrictSagaModule的逐phase技术合同、Host能力/namespace门，与本候选有限双资源ABI不同。raw FixtureHost/Entry还接聚合sharding命令、durable journal事件源、ClusterSingleton及生成safety suite，本候选没有同形接线，不能因外置provider存在就算齐全。

raw ValueObjectTemplate含Play JSON且有字符串logic槽；raw DomainService有注释logicCode加`???`，ApplicationService有MANUAL `???`。这些不是完美纯函数基准，文档不把它们改成fake success。当前A坏布局、缺companion/DTO/技术合同仍记A差距；单独额外的签名接口/运行宿主则按实际职责列B。原始`$base.modules`装配也不服从用户三层规则，目标bootstrap位置是明确覆盖，不修改原始基准。

## 写集合与源证据

本次仅写同目录这两个分片文件。完整固定源码字节SHA与bytes来自`baseline/index.json`，引用的源已逐个机械核对；JSON列出已读范围，FixtureHostTemplate仅对照298–748行，不冒称读完该巨大模板。

三份补充源不在原852文件中，本次只读并登记hash，没有任何快照写入：

- `lib/products/module-seams-target.mjs`：真实目标路径/发射集合与外置FQN冻结。
- `lib/products/module-seams-composition.mjs`：构造ABI、bridge条件、全方法覆盖和拓扑顺序。
- `lib/products/module-seams-contract.mjs`：record/sum与端口实际签名准入。

未发现这两family renderer在自身输出账外另发文件。项目流程还追加四份`.truthsrc/*.json`证据，公共writer另写ledger与anchors，JSON的`writerBoundary`明确交给公共owner，不把它们重复计成本组新制品。外置实现只作为构建输入，不生成或拷贝。条件Run增加的是已有容器成员，不虚构新的物理文件。

## 具体未决项与后续验收前提

1. **布局与跨模块依赖迁移**：codec移glue、kernel留接口；当前external FQN被准入锁定，名称/包变化需要独立获批的binding及引用迁移，不动稳定业务身份。
2. **值JSON与读仓DTO**：无Play kernel与raw companion格式如何分层；不能新增名义副本或偷合alias。
3. **Strict ABI/宿主接线差距**：逐phase技术合同、cluster/event-source和聚合适配是否作为独立变体实现，不能凭源码存在宣布银行采用。
4. **授权/关闭/单writer**：独立RunHost的调用暴露、recover与recoverRuns的不同原batch校验、外置provider关闭协议、缓存满及跨JVM排他边界需明确。
5. **命名与复杂度**：`beforeN/applyN/leafN/implementationN`等位置性名、FQN密度和大Program待按具体方法整改；目前CC、嵌套和行宽均未度量。不能用无类型dispatcher降低指标。

共享fixture包括Parcel record/sum/三端口/直接与bridge、双资源TCC十codec、无Run/pure/managed、R2 whole Carry/Retry耗尽/证据错配和授权两阶段恢复。全部只是`specified-not-executed`；后续需另获运行授权后做完整同输入产物、construct/RHS、真实库ABI/恢复、可读性及最终字节回锚对账。本轮没有新鲜验证结果。

## 本分片统计

33个逻辑条目（A 8、B 25），覆盖20/20条producer-output；未解决覆盖项0，family-local未登记写出0。A行数不是Scala族数，也不是runtime通过数。
