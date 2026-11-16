# formal-application：应用、子计划与 effect 生成分区

状态：**content-specification**。本片是已读源码后的职责分区与目标建议，不是实施、parity-PASS 或 behavior-PASS。机器账见 [formal-application.json](formal-application.json)。

## 1. 范围与计数

| producer | catalog producer-output 条数 | 源码入口及独立 profile |
|---|---:|---|
| `scala-cqrs-application` | 33 | `generate` → `applicationRegistry('1')` |
| `scala-cqrs-application-v2` | 33 | `generate` → `applicationRegistry('2')` |
| `scala-cqrs-child-application` | 37 | `generate` → `createChildRegistry('1')` |
| `scala-cqrs-child-application-v2` | 37 | `generate` → `createChildRegistry('2')` |
| `scala-cqrs-effect-application` | 37 | `generate` → `createEffectRegistry('1')` |
| `scala-cqrs-effect-application-v2` | 37 | `generate` → `createEffectRegistry('2')` |
| 合计 | **214** | **6 个 producer** |

- 214 条逐一进入 `catalogCoverage`，映射到 **73 条逻辑制品：A 27、B 46**；`unresolvedCoverage=[]`。不是 214 个物理文件，也不是 73 个 Scala 模板族。
- 196 条是有条件的源码 construct，18 条是六入口各自列出的 ledger、anchor、project evidence 合同。`implemented` 仅表示已定位到真实 emitter 内容，不表示这次成功生成或覆盖了所有输入。
- A 的范围只取传统 39 族及单列 3 扩展。相同 renderer 被真实继承时共享逻辑行，但每个 `catalogRef` 保留 producer/output/channel；v1/v2 的精确产品版本、child/effect 包装差异不消失。
- catalog 的 `command-helpers` 确实有输出，但内容不是应用 `CommandHelper`。没有因此虚造缺失 Helper 实现，也没有把对应 A 差距移到 B。
- 另登记两项 catalog 本组未列的真实写操作：项目 `knowledge.sqlite` 和 anchor 临时文件。后者是索引提交资源，不另计一个长期逻辑制品。

只写本组 JSON 和本 Markdown。没有修改源码、catalog、基线、作者树、生成应用、ledger 或 anchors；没有创建任务、worktree 或子代理；没有执行应用/CLI、生成、编译、类型检查、测试、运行时、服务、下载或 Git 写操作。

## 2. 来源、注册与银行消费是三个不同结论

### 固定源码与读覆盖

入口及所有相关应用 renderer 已实际读取，包括 `produce.mjs`、`produce-child.mjs`、`produce-effect.mjs`、`render-host*`、`render-invocation*`、`render-execution*`、`render-child*`、`render-effect*`，以及它们调用的 domain/state/actor/serialization/scaffold renderer。不是从 catalog 的分类名反推职责。

JSON 登记 **64 个固定源文件**的完整 bytes/SHA-256，并区分全文阅读与明确区间阅读。原始固定副本和整个基线索引未变；没有声称本片逐行复查全部 852 个文件。Scala 对照以 raw 模板为准，不把 `template/products/*` 或现存银行输出当作金样。

两个额外源码不在原始基线，只读、未另存副本：

| 原仓相对路径 | SHA-256 | 为什么需要 |
|---|---|---|
| `lib/project/graph.mjs` | `d0e1efaaf4c3784094c66f0f77afee59a053a0d5c317c2684e4d56450fb3c47a` | 定位 project graph 路径、snapshot 与 code anchor 发布 |
| `lib/knowledge-sqlite.mjs` | `096767820645e3e05789ba5c9a701dd9f9c6f6f41f6646cdf03083a2a33fee71` | 定位建库、DDL、事务 insert/update 和 close 的实际写边界 |

以上路径是可变工作副本，由 `extraSources` 完整 hash 固定本次阅读身份；不是替换固定 baseline 的授权。

### 实际调用链

[注册入口](../baseline/js/lib/products/generate-cli.mjs) 92–101 行按准确目录选择函数，family 候选也各自独立注册。六入口并非相互自动选择，也不会因 family 注册而让银行消费它们。

[应用 registry](../baseline/js/generators/scala-cqrs-application/produce.mjs) 17–33 行包含八个子 producer。`aggregate-dsl` 调用纯状态 renderer 和 `renderActors(..., true)`，`invariant-dsl` 在这六个 profile 内仍然是 `layered=false`。

[规划器](../baseline/js/src/core/product-plan.mjs) 71–103 行要求完整重新编译等值、精确 manifest/product pins、受限产品访问、两次独立输出相同、输出路径唯一和依赖闭合。这里描述的是源码中的门，没有执行这些门。

`requireApplicationArtifact` 要求冻结的 `net.imadz:saga-core_2.13:0.3.0`、准确 SHA、显式 file repository 和 symbolic target；CLI 还检查实际 JAR 字节，含 pipeline 时检查 Monarch JAR。**声明这些门存在不等于本轮读过/验证过制品或运行 ABI。**

### v1、v2、child、effect

- v1：`domain-dependencies@5`、`domain-folds@5`、`domain-decision@3`。
- v2：上述三个产品分别为 `6 / 6 / 4`，保留 nominal-text 的显式 profile 边界。共同源码不保证两版本输入语义、输出字节或准入面相同。
- [child registry](../baseline/js/generators/scala-cqrs-application/produce-child.mjs) 替换 `finite-execution-dsl`，生成父计划、完整 child 计划、ChildHost；不再调用普通 `GeneratedExecutionSpec` renderer。宿主测试先移除再用 `childProfile=true` 重建；配置追加 child serializer。它不是从 effect registry 继承。
- [effect registry](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 从 application registry 继承，对 proto/execution/host 增加 effect footprint 和配置，另加 `durable-effect-host-dsl`。它不自动包含 child registry。

### 银行明确选择的是 Play service

[银行固定配置](../baseline/bank/truthsrc.project.json) 278、286–298 行选择 `scala-cqrs-play-service`，`verificationCases=[]`。

[Play service 入口](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 16–58 行实际通过 **`createEffectRegistry('2')`** 继承；同时：

1. 覆盖 `aggregate-dsl` 为 `renderAggregateLayers`，所以本片的非 Play `domain/<A>Aggregate.scala` 并非银行实际 actor 输出。
2. 覆盖 invariant 调用为 `layered=true`，另有规则参数/兼容壳路径。
3. 提升 artifact/host/effect 产品 pins，并包装测试、构建和配置；`application.conf` 改为 `conf/serialization.conf`，sbt/Play/test runner 也不同。

因此 `scala-cqrs-application-v2`、`scala-cqrs-effect-application-v2` 只标 **实现级部分 inherited**，不是银行选择这两个 manifest。v1 和 child 两版本均 `not-selected`。库存测试 renderer 存在，更不表示银行有这些业务实例或运行通过。

## 3. 复合文件的完整拆分与唯一组装者

下面只解释核心边界。完整成员、初始化、imports 使用权和条件在 JSON 的 `current.constructs` / `target.constructDisposition` 中逐项登记。

| 当前物理容器 | 真实内容分区 | 唯一 assembly owner |
|---|---|---|
| `<A>Protocol.scala` | A：纯 `Command` 参数归 formal RuleParams；A：`Event` 族归 Entity。这里没有 ActorRef、Reply 或 Handler alias | `domain-semantics-assembly` |
| `<A>CommandHelpers.scala` | A：`Computations` 纯计算能力；A：`emit<Command>` 是规则事件构造，不是应用 Helper | `domain-semantics-assembly` |
| `<A>Aggregate.scala` | A：Request/Reply、Actor 根、内联命令行为、第二个 Factory object；B：外部事件授权能力 | `aggregate-assembly` |
| `DomainConverters.scala` / `PartN` | A：domain/PB 转换；B：wire/PO 文本转换与严格 exact 解析。私有解析器也被 A exact PB 分支依赖，不能在拆分时丢掉 | `converter-assembly` |
| `<A>Adapters.scala` | A：EventAdapter 与 SnapshotAdapter，各自方法/依赖分离，文件头和 imports 统一组装 | `adapters-assembly` |
| `<H>Definition.scala` | A：strict module/phase binding；A：具体 Args/Receipt PayloadCodec 对应 strict-fixture-host 扩展，但 wire 算法不同 | `strict-definition-assembly` |
| `<H>Host.scala` | A：直接入口映射或 pipeline invocation；B：直接 durable association、admission 等额外宿主责任，以及仍残留的 Delivery trait | `invocation-host-assembly` |
| `<H>HostIO.scala` | B：entry/association/policy/occurrence 准入；A：strict completion 映射、授权核验与交付。只通过 callback 发布仍是 A 接线差距 | `host-io-assembly` |
| `<H>TechnicalPorts.scala` | A：外部提交/查询/部署 Connector 能力、strict phase 合同；B：明确枚举的 lifecycle 能力和实际 callback 安装/校验 | `technical-assembly` |
| `<P>Execution.scala` | B：typed plan、运行时 stage 解释/异步桥、版本化 checkpoint codec。child-plan 语境的完整模块另列 A composition 扩展 | `execution-assembly` / 独立 child 文件的 `child-program-assembly` |
| `<P>_<S>ChildHost.scala` | A：child intent/权威终态观察；B：同文件末尾 `SerializerWithStringManifest` 类 | `child-host-assembly` |
| `ChildJournal.scala` | A：权威 prefix/terminal 判定和 Reader 能力；B：`CurrentJournal` 的 Akka 查询、materializer、query 初始化和 I/O | `child-journal-assembly` |
| `<E>EffectHost.scala` | B：typed callback 安装；B：独立 effect 意图、观察证据、query/reconcile 状态机。不能因为它也用 Actor 而算业务 Aggregate | `effect-assembly` |

这些 owner 包含文件头、package、全部 imports、trait/companion、类型别名、方法体、val/var 初始化、私有限定符、局部资源及最终字节顺序；不是多个逻辑行各自写半个文件。相同文件的条件变体独立组装，不能互相覆盖。

`entry()` 的当前公共头是 `// @generated by truthsrc scala-cqrs-domain:1`，即使从应用 v2 路由发出也如此。这是现有来源字符串，不是准确入口版本证明；未来来源元数据和最终字节应由共享 writer owner 统一处理。某些配置/proto support 会显式替换 `content`，不能不看 renderer 就机械加 Scala 文件头。

## 4. A 的关键差距及原始基准例外

### Actor 与纯 payload 不能混用

真正的 Actor 协议来自 [render-actor.mjs](../baseline/js/generators/scala-cqrs-domain/render-actor.mjs) 15–16 行，而不是文件名叫 Protocol 的所有内容。现在的应用写命令是 `Execute(command, replyTo)`；纯 `Command` 不含 ActorRef，领域 `Event` 也不含。

下面是**结构性模板对照，不是同输入生成的字节 diff**。minus 来自该 JS renderer；plus 是 raw [AggregateBehaviorTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala) 的 PolicyBasedLogic 目标形状，保留其模板变量，不假造某个银行命令的回复算法：

```diff
- case Right(events) => Effect.persist(events).thenRun((_: <A>State) => reply ! Accepted(events))
+ case cmd: $cmdName => runReplyingPolicy(${p.name}, ${helper.name})(state, cmd).replyWith(cmd.replyTo)
```

两者不能宣称等价：当前没有生成 `toParam`、`createFailureReply`、`createSuccessReply` 三方法，也没有证明回复使用事件应用后的新状态。`replyWithAndPublish` 还多一个事件发布责任，不能偷换。

### Rules、State 与值类型

- JS 守卫维持声明顺序，`reject` 与 `succeed-empty` 分别保留拒绝和幂等空成功。改 `Either[String, Vector[Event]]` 为目标错误/集合类型需要逐职责接口对照，不能只换名字。
- `nextN`、长 FQN、否定套否定是需要整改的表达问题；不能因此改变基于旧 state 的赋值、host 计算次数或异常顺序。
- `addExact/subtractExact`、Money 的 scale/precision/单位/舍入、不同名义 wrapper 均保留。wire/PO 不得通过 alias 合并掉身份。
- raw [DomainServiceTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainServiceTemplate.scala) 自身保留 `logicCode` 注释和 `???`；raw [CommandHelpersTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala) 有三个 MANUAL 业务槽。不能把原始基准写成已完成业务算法。

### Strict 与 composition 扩展

- `StrictSagaDefinition`、`PhaseBinding`、`StrictParticipant` 是 strict runtime 合同，不把同名职责硬算成经典 Saga participant actor 协议。
- [StrictSagaModuleTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala) 还显式承载 HostRequirements、独立 namespace 和 settings 能力。JS 仅检查 PID 非空和部分技术安装，并固定 budget 32，不等价于完整准入/deadline 实施。
- raw [FixtureHostTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala) 的 `renderArgsCodec`、`renderPort` 的 receipt codec 与 JS 具体 PayloadCodec 有真实职责对应，所以列 A；**职责对应不授权把 PB 改成 raw 自定义 wire**。
- raw fixture 的 `publishCompletion` 通过 producing command 和领域 guard 实现幂等结果发布；JS `HostIO.deliver` 依赖注入 callback。后者确有 completion 责任，列 A 差距，不因缺真实实现而藏到 B。
- raw [InvocationHostTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala) 有字符串 checkpoint、CSV/冒号 child wire、fixture transform 和 `RunObserver.nop` 等明确例外。不能拿这些来覆盖 JS 当前的版本化 PB、名义类型和业务身份派生。

## 5. B 的具体目标，不设“其它代码”桶

目标建议选用单工程 Play 的 `app/`、`test/`、`conf/`；`<basePath>` 来自显式 package binding，`<Host>/<Pipeline>/<Effect>` 是源码名，不改变稳定业务 ID。`.proto` 暂保留 `app/protobuf` 物理根；正式同输入对照前须锁定 BC 的 `protoDir`。多模块根不是同一比较输入。

| B 职责 | 具体目标位置 | 必须保留的 fixture / 规则 |
|---|---|---|
| 外部事件授权能力 | `app/<basePath>/application/aggregates/behaviors/<Aggregate>ExternalAuthority.scala` | 完整身份、授权拒绝不产生事件；无宽松默认 |
| 外部结果值映射 | `app/<basePath>/application/connectors/<Aggregate>ExternalEventMapping.scala` | event slots 与身份键顺序、nominal 解包 |
| exact wire/PO | `app/<basePath>/infrastructure/persistence/converters/ExactValueCodecs.scala` | fixed/minor-units、负零/指数/长度/精度拒绝 |
| PB serializer | `app/<basePath>/infrastructure/persistence/DomainProtoSerializer.scala` 及必要 `Part<index>.scala` | 小/大文件、128-case 界、未知 manifest、逐 PB 白名单 |
| 构建/注册配置 | `build.sbt`、`project/plugins.sbt`、`project/build.properties`、`conf/serialization.conf` | application/child/effect 独立 fixture，不扩大 serializer 绑定 |
| 直接宿主关联与准入 | `app/<basePath>/application/services/transactor/<Host>InvocationHost.scala` | persist intent 先于动作、AdmissionGranted、并发 waiters、丢 ack、旧回调 |
| lifecycle ports 与安装 | `app/<basePath>/application/connectors/<Host>LifecyclePorts.scala`；`infrastructure/bootstrap/<Host>TechnicalBindings.scala`；`infrastructure/connectors/<Host>InstalledTechnicalPorts.scala`（后二者同在 `app/<basePath>/` 下） | 每 role 的 typed input/output、精确 id/version、run/operation/completion、原始关联和 secretRef |
| HostIO 准入 | `app/<basePath>/application/services/transactor/<Host>HostIO.scala` | entry→association→可选policy；occurrence gate→source；同文件 completion 另属 A |
| 有限计划/运行桥 | `app/<basePath>/application/services/transactor/<Pipeline>Execution.scala` | pure/hosted、完整前驱输出、Pending 不变业务失败、停止时 Promise 处理 |
| 执行 checkpoint codec | `app/<basePath>/infrastructure/persistence/converters/<Pipeline>StateCodec.scala`；`app/protobuf/<pipeline_stem>_execution.proto` | exact planversion、完整输入、optional output、nominal/scalar 两支 |
| 宿主/child/effect wire | `app/protobuf/<host_stem>_host.proto`、`<base_underscored>_child_host.proto`、`<effect_host_stem>_effect.proto`；各自 `app/<basePath>/infrastructure/persistence/<...>Serializer.scala` | 独立事件族、固定字段号、manifest、serializer identifier，不把宿主事件并入领域协议 |
| child 日志 I/O | `app/<basePath>/infrastructure/repositories/saga/CurrentChildJournal.scala` | explicit system/plugin、查询失败不伪造终态；全量读取的资源界限另待裁定 |
| effect 安装与状态机 | `app/<basePath>/application/connectors/<Effect>EffectPorts.scala`、`app/<basePath>/infrastructure/bootstrap/<Effect>EffectBindings.scala`、`app/<basePath>/application/services/transactor/<Effect>EffectHost.scala` | 意图先落盘、同 operation/request、unknown/absent 不成功、授权 absent retry、恢复仅 query |
| 所有生成测试 | domain 往返在 `test/<basePath>/infrastructure/persistence/GeneratedDomainRoundtripSpec.scala`；actor 在 `test/<basePath>/application/aggregates/GeneratedActorStateSpec.scala`；宿主/执行测试在 `test/<basePath>/application/services/transactor/Generated{Execution,FiniteHost,HostRecovery,ExtendedPorts,RequiredBindings,EffectHost}Spec.scala` | 移出默认包；每 profile 独立整文件 fixture；库存 oracle 不改成银行成功断言 |
| 派生证据 | `<outDir>/truthsrc.ledger.json`、`<outDir>/anchors.json`、`<outDir>/.truthsrc/{canonical,request,compiled,inputs}.json` | 最终 bytes、MANUAL/KEEP/retained、原子 index 与失败拒绝；不是业务作者面 |
| 项目知识存储 | `<dirname(project)>/.truthsrc/knowledge.sqlite` | snapshot 在 apply 前，成功后回锚；显式事务/close；与 outDir 写入分开协调 |

B 也遵守三层依赖、明确 imports、120 列默认、逐方法复杂度和资源 owner。尤其不能让搬到 infrastructure 的 `Installed` 类型反向成为 application 的强制依赖；这需要先固定 application 能力接口，而非机械移动文件。

## 6. 已识别的缺接线和真实未决项

1. **FA-01 — 应用 Helper 缺职责实现。** 纯 event emission 与 computations 不能替代三方法 Helper。回复合同、业务参数和新状态映射尚需明确。
2. **FA-02 — child-only 父计划未被派发。** [render-execution.mjs](../baseline/js/generators/scala-cqrs-application/render-execution.mjs) 9 行只检查 `invokeSaga` 或 effect host，21 行会拒绝没有普通 port 的 `awaitChildRun`。虽然 hosted renderer 内有 child 分支，也不能称所有 child 组合已接通。
3. **FA-03 — 外部入口聚合 + 显式命令测试向量的参数缺口。** [render-verification.mjs](../baseline/js/generators/scala-cqrs-domain/render-verification.mjs) 43、46 行没传 authority；[scaffold](../baseline/js/generators/scala-cqrs-domain/scaffold.mjs) 的 query-only 分支会传。这里是静态组合缺口，未声称新编译失败或运行复现。
4. **FA-04 — strict 完整宿主要求及 receipt result。** `HostIO` 对 receipt-derived result 仍明确拒绝；完整 deadline/admission/独立 namespace 和真正幂等发布能力不能由 callback 存在推出。
5. **FA-05 — 接口/ABI 与复合文件迁移。** 所有 split/move 都需共用类型/命名/布局/最终 writer owner，迁移引用、private 限定符、配置 FQN 和 imports；业务 ID、PB、PID、codec/serializer、摘要格式、nominal、overflow、独立 oracle 不变。
6. **FA-06 — oracle 与资源边界。** 生成测试大量限定 inventory 或 `allocation-inspection/inspect`；无匹配可能只是空 suite，多个匹配固定文件名可能导致 plan 冲突。`CurrentJournal` 的 `Sink.seq` 全量日志读取也没有被本次材料证明有界。

另需集成者将两个 `uncataloguedOutputs` 与共享写通道分片去重；本片没有扩大读取到全 catalog 来断言全局不存在相同机制。

## 7. 可读业务路径与后续验收要求

按责任阅读源码，而不是按文件后缀跳读：

- **普通聚合命令**：Actor `Execute` → 纯 command payload → 声明序 `Rules` → computations/事件槽构造 → persist → EventHandler → Reply。当前 Reply 与目标 Helper 合同差距在这条路径上可见。
- **直接严格 Saga**：完整原始输入 → durable association → entry/association/resource admission → Start/Attach → strict phase ports → 权威结果 → completion expected record 校验 → delivery callback → durable ack。
- **pipeline Saga**：父 checkpoint → 完整 invocation 输入和稳定 occurrence → invocation intent → Start/Attach → result delivery ack → typed step result → 父 checkpoint。不能提前把外部调用返回当作持久终态。
- **child**：父 intent → 同身份 child StartRun/重新观察 → child 自身 journal 的完整 confirmed prefix/terminal → 父结果。镜像进度不是权威。
- **effect**：persist Intent → execute → 观察不确定则 query → 只有带权威 absent evidence 且授权的人工 reconcile 才能 retry。恢复不会盲目再执行。

后续实施门应分别取得：

1. 精确各 profile 输入下的完整输出文件/construct/RHS/import/顺序对账；保留零实例、分段、大名、多个 host 等条件。
2. actor 协议、Helper、事件应用、PB/serializer 与 frozen JAR 真实接口对账。
3. 独立 fixture 验证拒绝/空成功、身份冲突、intent-before-effect、丢回执、重入、停止/恢复、授权 retry 与 child 权威终态。
4. 每方法可读性/复杂度、三层依赖与手写隔离、稳定生成及回锚演进。

**本阶段以上门均未运行。** JSON 的 fixture 均为 `specified-not-executed`，源码内容分区和机械清单/字节 hash 对账不替代这些验收。
