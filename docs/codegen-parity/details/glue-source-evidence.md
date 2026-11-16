# Classic Scala 39+3 胶水源码证据

**状态：content-evidence；不是 runtime PASS、parity PASS 或已发布 ABI 兼容证明。**

本件是 `glue-dependencies.md` 集成者的源码证据输入，不替代该主文档。范围为传统 `CodegenMain.runCommon` 的 39 个 Template 族，以及三个条件扩展 `strict-saga-module`、`strict-fixture-host`、`composition-invocation-host`。39 是模板族数，不是文件数；`bootstrap` 内含四个变体。

配套 [glue-source-evidence.json](glue-source-evidence.json) 保存以下机器可读账目。

- `contracts.G01–G13`：完整 owner/符号、实参顺序、currying、返回型、成功/失败/副作用语义、raw/manual 差别和逐项行号。
- `snapshotSources`：69 个引用的固定文件，保留 `baseline/index.json` 的原仓路径、snapshot、repo HEAD、bytes、SHA-256；本次只核对源码文件字节。
- `extraSources`：70 条额外只读来源，包含指导文件和 **hash-only scaffold census**。每条都有绝对路径、SHA、读取范围；hash-only 不冒称完整代码审阅。
- `artifactGlueCoverage`：42 个族到合同的映射，仅说明内容研究覆盖，不说明实现或行为通过。

没有运行生成、编译、测试、typecheck、import-and-call、服务、下载、发布或 Git 命令；没有读依赖缓存、jar、进程参数、环境变量或运行秘密。旧 runtime receipts **未重验**。文中第三方 Akka/Play/JDBC API 是精确的消费/override 形状，不冒充本次从所消费 jar 中提取的 ABI。

## 1. 固定来源与最重要的发现

固定索引 [baseline/index.json](../baseline/index.json) 捕获时间为 `2026-11-15T09:14:23.674268+00:00`，其 SHA-256 为

```text
d60175f98077ef302df3765a08591ded41ad2b07c8bd62e6ce95e18569fed0fc
```

索引记录的 HEAD：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`，common-core `2829932df674221c679a774367f11320c7b51d36`，JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。HEAD 不代表冻结时所有工作副本均干净；具体内容以索引逐文件 SHA 为准。

### 1.1 不能把三份同 FQN helper 拼成一个库接口

共同 FQN 是 `net.imadz.common.application.CommandHandlerReplyingBehavior`。

| 来源 | `RunnablePolicyWithHelper` 构造参数 | `replyWith` | `replyWithAndPublish` | `withPost` |
|---|---|---|---|---|
| [固定 common](../baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | `rule, helper, state, command` | 有 | 有 | 无 |
| [固定 curated](../baseline/curated-scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | `rule, helper, state, command` | 有 | 无 | 无 |
| [额外原仓 scaffold](../../../..//backkend-codegen/scaffold/app/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | `policy, helper, state, command, post = ... => None` | 有 | 无 | 有 |

第三行是可变源；准确绝对地址为 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/scaffold/app/net/imadz/common/application/CommandHandlerReplyingBehavior.scala`，不是新的 baseline。

对应 SHA-256：

```text
common-helper   2af0b26def49ccf43a23413642fa92bae2233a605b9bb84690ce68e16b0f8852
curated-helper  92ac1e9005ddf70d8665edea2211b1c06cf48374e51b0c765cabd2831a90eee4
scaffold-helper d2499de5832333c39ef644da3094ef5b5cc023c69d4b43643e83de94c2973350
```

这是**源码层明确差异**，不是对 Maven `common-core:0.2` 内容的判断。构造 arity、`copy`/extractor/defaults、named argument `rule`/`policy` 和扩展方法均不同。

### 1.2 原始消费路线不是单纯“生成代码 → 五个 jar”

[CodegenMain.scala:199–228](../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala) 明确先 `FileSystem.copyDirectory(scaffoldSource, outputDir)`。额外只读核对发现 scaffold 内确有 common、auth、classic Saga 的同 FQN 源码，同时 [冻结 build.sbt:127–167](../baseline/bc/scaffold/build.sbt) 又声明相应库依赖。

- 单项目复制到目标 `app/net/imadz/...`；模板在同一生成工程内引用这些 FQN。
- multiProject 再搬移 13 个 common 文件到 `modules/kernel`/`modules/glue`，部分 auth 文件仍在 Play 根；不是“所有运行代码都自动来自发布库”。
- 源文件存在也不证明最后编译/打包用了哪一份。必须把 **source-local owner、声明坐标、实际 resolved artifact** 分开。
- 固定模板的常规调用只使用三份 helper 的共同 positional 子集 `runReplyingPolicy(rule, helper)(state, cmd).replyWith(cmd.replyTo)`。不能因此认定其余方法兼容。

该复制逻辑的固定 SHA 为 `c2edd09c65acdb63eb4412698a05f903da5604011725d6c7472355a5c9b7fd0e`。没有执行该逻辑。

## 2. 声明坐标与版本，不等于实际字节

以 [冻结 scaffold/build.sbt](../baseline/bc/scaffold/build.sbt) 为消费声明源，SHA `106b0c8339374c459a0389dd202e2b99f0d64a7b70d78ca8da34f94606c6bfd2`。

| 面 | 精确声明/版本 | 证据边界 |
|---|---|---|
| Scala/编译目标 | `scalaVersion := "2.13.14"`，`-target:11` | 未启动编译器 |
| 公共库 | `net.imadz:{common-core,monarch-core,monarch-persistence,saga-core,auth-core}_2.13:0.2` | 是 `0.2`，不是机械改写的 `0.2.0`；所消费 jar ABI 全部 unverified |
| Akka | actor/typed、cluster/sharding、persistence/query、stream、remote、Jackson 等统一 `2.6.20` overrides | 模块全集在 build:14–39；未解析 Play 传递版本 |
| Akka management/discovery | `com.lightbend.akka.management` 三个 management 模块及 `akka-discovery-kubernetes-api` 为 `1.1.4` | 依赖声明不证明 bootstrap 被调用 |
| Projection | `com.lightbend.akka:akka-projection-eventsourced_2.13:1.2.5`、`akka-projection-jdbc_2.13:1.2.5` | ExactlyOnce 类型不是全业务链路承诺 |
| JDBC | `org.scalikejdbc:{scalikejdbc,scalikejdbc-config}_2.13:3.5.0`、initializer `2.8.0-scalikejdbc-3.5`、`mysql:mysql-connector-java:8.0.33` | HikariCP `3.4.5` 来自额外 common-core build 的声明，非已验发布 POM |
| Mongo | `com.github.scullxbones:akka-persistence-mongo-rxmongo_2.13:3.0.8`；ReactiveMongo `1.1.0-noshaded-RC11`；Mongo Scala driver 声明 `4.11.0`、override `4.3.4` | 注释要求避免 scala/rxmongo 双 plugin；额外 common-core build 仍声明 `akka-persistence-mongo-scala_2.13:3.0.8`，只登记潜在来源冲突，未证明实际冲突 |
| Wire | `com.google.protobuf:protobuf-java:3.15.6`；`scalapb-runtime` 使用 `scalapb.compiler.Version.scalapbVersion`，`protobuf` configuration | 额外 scaffold `project/plugins.sbt` 声明 ScalaPB compilerplugin `0.11.14` 和 sbt-protoc `1.0.6`；没有解析 artifact |
| Play/Auth | scaffold plugin `com.typesafe.play:sbt-plugin:2.8.18`；play-json override `2.9.3`；jwt-play `9.1.2`；Caffeine `3.1.8` | 额外 auth-core build 又声明 `play_2.13:2.8.20`、Guice `5.1.0`、javax.inject `1`；eviction 未核 |
| sbt | 额外 scaffold `project/build.properties` 为 `1.4.9` | 不求值 dynver；runtime 自身当前发布版本不由源码目录名推断 |

`AkkaPersistenceJdbcVersion=5.1.0`、`SlickVersion=3.3.3` 虽有 val，相应 `libraryDependencies` 行被注释，不能列作已启用 provider。

候选切换（build:138–167）也只是声明：

- `codegen.candidate.sagaCore` 存在时过滤 `saga-core` 并加入 `Compile / unmanagedJars`；该分支本身没有 Monarch 分支的绝对路径/现存文件检查。
- `codegen.candidate.monarchCore` 与 `codegen.candidate.monarchPersistence` 必须同时提供，过滤两个 `0.2`，检查 jar 为绝对路径且存在。unmanaged jar 不供应 POM 传递依赖。
- 冻结 InvocationHost 注释写 `0.2.1`，**不是 dependency selection**。额外当前 monarch-persistence build 的 `monarch.core.version` 默认 `0.3.0` 也不改写冻结 scaffold。
- 本次没有读这些属性的实际值、查候选文件、读 jar 或重验旧 receipts。

## 3. G01–G03：纯规则、错误、Helper 与实现槽

[CommonTypes.scala:7–28](../baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala) 的完整运行合同是

```scala
// owner: net.imadz.common.CommonTypes
type Id = java.util.UUID
final case class iMadzError(code: String, message: String)
    extends Throwable with CborSerializable
trait InvariantRule[Event, State, Param] {
  def apply(state: State, param: Param): Either[iMadzError, List[Event]]
}
trait ReadModel
trait DomainService
trait ApplicationService

// owner: net.imadz.common.Id
def of(value: String): Id // UUID.fromString；非法输入抛异常
def gen: Id               // randomUUID；不是纯确定性业务算法
```

`CborSerializable` 本身是空 marker，不提供持久化或发布。`iMadzError` 的 `code/message` 和 HTTP `ApiError.status/errorCode/message/payload` 是不同合同。

### Helper 的不可丢失细节

精确 owner 为 `net.imadz.common.application.CommandHandlerReplyingBehavior`。固定 common 源码:16–86 定义

```scala
trait CommandHelper[Command, State, Param, Reply] {
  def toParam(state: State, command: Command): Param
  def createFailureReply(param: Param)(error: iMadzError): Reply
  def createSuccessReply(param: Param)(state: State): Reply
}

def runReplyingPolicy[Event, State, Param, Reply, Command](
    rule: InvariantRule[Event, State, Param],
    helper: CommandHelper[Command, State, Param, Reply]
)(state: State, command: Command)
  : RunnablePolicyWithHelper[Event, State, Param, Reply, Command]

def replyWith(replyTo: ActorRef[Reply]): Effect[Event, State]
def replyWithAndPublish(replyTo: ActorRef[Reply])(
    implicit context: akka.actor.typed.scaladsl.ActorContext[_]
): Effect[Event, State]
```

| 分支 | 严格顺序与 owner |
|---|---|
| Left | `helper.toParam(oldState,cmd)` → `rule(oldState,param)` → `Effect.reply(replyTo)(helper.createFailureReply(param)(error))`；**不 persist、不 publish** |
| Right | `Effect.persist(events)` → 宿主 ESB 应用 event handler → `thenReply(replyTo)(helper.createSuccessReply(param))`；success factory 接收到**新 State** |
| publish 变体 | persist/apply 后 `thenRun` 按事件列表顺序发送 `context.system.eventStream ! EventStream.Publish(e)`，再 `thenReply`；不是 durable outbox |
| source-local post 变体 | policy Right 后运行 `post(events)`；`Some(error)` 失败 reply，`None` 才 persist；`withPost(f)` 只是 `copy(post=f)`，该源没有 publish 方法 |

旧 overload 也必须保留其两层 currying：

```scala
def runReplyingPolicy[Event, State, Param, ReplyMessage](
    rule: InvariantRule[Event, State, Param]
)(state: State, param: Param)
  : AwaitingReplyToRunnablePolicy[Event, State, Param, ReplyMessage]

// AwaitingReplyToRunnablePolicy 的方法
def replyWith(replyTo: ActorRef[ReplyMessage])(
    leftConfirmationFactory: Param => iMadzError => ReplyMessage,
    rightConfirmationFactory: Param => State => ReplyMessage
): Effect[Event, State]
```

这些 API 不捕获 `toParam`、rule 或 reply factory 自身抛出的异常。`Right(Nil)` 是成功空事件，不能改作拒绝。持久化失败不是业务 `Left`。

### Raw 默认与人工代码分开

- [CommandHelpersBuilder:38–139](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/CommandHelpersBuilder.scala) 排除只读命令。普通参数默认单字段、tuple 或 Unit；formal 使用 `<Cmd>Params`。普通回复默认 `Reply(param/param._1, None/Some(error))`，formal 单 error 槽为 `Reply(None/Some(error))`，Unit 回复为 `()`。这些是机械默认，不是任意业务确认算法。
- [CommandHelpersTemplate:45–62](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/CommandHelpersTemplate.scala) 把三个方法体全部放在 MANUAL 中。不能依据 builder 旧注释误称默认表达式在 MANUAL 外。
- [AggregateBehaviorTemplate:77–160](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateBehaviorTemplate.scala) 默认调用 `.replyWith`，不发布；只读 `Get*StateReply(state)` 直接 reply。默认 `orElse` 链在 MANUAL；空行为是 `???`。
- [InvariantRuleTemplate:28–74](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/InvariantRuleTemplate.scala) 的条件逻辑被注释，事件结果为 `???`。另一个 [AggregateRulesTemplate:41–74](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/AggregateRulesTemplate.scala) 才按 formal guards 顺序产出 reject/成功空事件/emission。两条路线不能静默合并。

### 指定名称中仍未定位的部分

这是限定源码搜索结论，不是对所有仓库或已发布 jar 作“不存在”断言。

| 请求名称 | 已定位事实 / 未决 |
|---|---|
| `InvariantValidation` | 在已检索的 fixed common/BC、fixed JS lib/generators 及原 BC src/scaffold 中未定位此精确标识；不能编造 FQN/签名。已确认规则 SPI 是 `CommonTypes.InvariantRule` |
| `Policy` | helper 注释虽叫 Policy，参数实型是 `InvariantRule`。另有 [reactive PolicyTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/PolicyTemplate.scala)，`createPolicy(system,sharding,index):Unit` 与 `Handler.process(envelope:Any):Unit` 都是 `???`；清单将它排除在传统39族之外。没有确认共享 `Policy` trait |
| `EntityState` | [DomainEntityTemplate:44–95](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/domain/DomainEntityTemplate.scala) 输出每聚合自己的 State case class 和 `(State,Event)=>State` alias，不是共享 EntityState ABI；metadata 的 EntityStateRef 不是同一类对象 |
| metadata error | [FrameworkTypes:264–276](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala) 明确映射 `iMadzError` 到 `net.imadz.common.CommonTypes`；若请求独立 metadata 包错误，仍需提供目标 FQN |

## 4. G04–G05：Akka 持久化、寻址、wire

### 谁 persist，谁仅寻址

[BootstrapTemplate:72–114](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/BootstrapTemplate.scala) 才构造 Aggregate ESB：

```scala
def init<Aggregate>(sharding: ClusterSharding): Unit
private def apply(entityId: String, tag: String): Behavior[<Command>]

sharding.init(Entity(<Aggregate>.entityTypeKey)(behaviorFactory))
EventSourcedBehavior(
  persistenceId = PersistenceId(<Aggregate>.entityTypeKey.name, entityId),
  emptyState = <Entity>.empty(...),
  commandHandler = <Behaviors>.apply,
  eventHandler = <EventHandler>.apply
).withTagger(_ => Set(tag))
 .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
 .onPersistFailure(SupervisorStrategy
   .restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
 .eventAdapter(new <EventAdapter>)
 .snapshotAdapter(new <SnapshotAdapter>)
```

尖括号是模板类型变量，不是可直接运行的 Scala 例子。

`AggregateRoot` 普通分支提供 key、tags、handler 接线；repository impl 只有 `sharding.entityRefFor(key,param.toString)`。**EntityRef 不是已经读取的 state，也不是业务初始化已成功。** Factory 的初始化方法返回 `Future[Either[iMadzError,EntityRef[Command]]]`，先 typed ask，再把 `confirmation.error` 映射为 Left 或 Right(ref)，timeout 默认10秒。ask 的失败 Future 不自动变成业务 Left。[Factory builder:170–255](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/AggregateFactoryBuilder.scala)

### Converter 的参数方向、异常与默认

[PrimitiveConverter:7–61](../baseline/common/src/main/scala/net/imadz/common/serialization/PrimitiveConverter.scala) 中嵌套 `ProtoConverter[S,P]` 提供 `toProto/fromProto`、Option 和 Seq/List 映射。特别注意 map 两方向的型参：

```scala
def toProtoMap[K1, V1, K2, V2](
    domain: Map[K1, V1],
    keyConv: ProtoConverter[K1, K2],
    valConv: ProtoConverter[V1, V2]
): Map[K2, V2]

def fromProtoMap[K1, V1, K2, V2](
    proto: Map[K1, V1],
    keyConv: ProtoConverter[K2, K1],
    valConv: ProtoConverter[V2, V1]
): Map[K2, V2]
```

Id 与 Currency 解析非法值会抛异常；StringConv 为 identity。没有泛用的 `BooleanConv`/`LongConv` 可凭名称假定存在。

[AggregateConverterTemplate:52–199](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/AggregateConverterTemplate.scala) 的 raw 特性包括：

- trait 加 self-companion，为静态 `<Converters>.<Event>Conv.fromProto` 提供 term；VO→event→state 的输出顺序明确。
- `ListConv.toProto[D,P](domain:List[D])(implicit c:ProtoConverter[D,P]):Seq[P]`，反向 `fromProto(proto:Seq[P])(...):List[D]`。
- `InstantConv.toProto(domain:Instant):Long` 把 null 写成0；反向得到 epoch，不还原 null。
- BigDecimal→Double 是既有有损路径；Option[List] 的 None→空 repeated，回读恒 Some；复杂必填 message 缺失显式抛错。这些不是无条件安全的等价优化。

[EventAdapter](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/EventAdapterTemplate.scala) 的方法顺序为 `manifest(event):String`、`toJournal(e):ProtoUnion`、`fromJournal(p,manifest):EventSeq[Event]`。manifest 返回 event class name，但 fromJournal 未用 manifest 作版本分派；具体 union arm→single，Empty→empty。[SnapshotAdapter](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/persistence/SnapshotAdapterTemplate.scala) 是 `toJournal(state):Any`、`fromJournal(from:Any):State`，后者先 cast，可能类型失败。

额外 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen/scaffold/conf/serialization.conf` 明确含 `scalapb.GeneratedMessage = proto` 的宽绑定。**这是 raw 事实，不是推荐目标或正确性证明。** 不能借新增/扩大这种绑定绕过逐族 serializer 登记。ObjectIdOffsetSerializer 的 `identifier=20160728`、`includeManifest=true`；`toBinary(AnyRef):Array[Byte]` 仅接受 ObjectIdOffset，反向 `fromBinary(bytes,Option[Class[_]]):AnyRef` 由 BigInteger hex 重建 BSON ID 及时间；没有本次往返字节测试。

## 5. G06–G07：Classic Saga 的协议不是 strict

固定 [Saga DSL](../baseline/curated-scala/net/imadz/infra/saga/dsl/SagaDefinition.scala) 来自 curated Scala；原 scaffold 的相关源码 hash 与这些固定文件相同。但这仍不证明 `saga-core_2.13:0.2` 中的 API。

关键完整类型/调用顺序：

```scala
// net.imadz.infra.saga.dsl
SagaStep[E, R, C](stepId, participant, resilience = ResiliencePolicy.defaults, stepGroup = 1)
SagaDefinition[E, C, A](name, version, argsCodec, steps,
  preCheck, errorText, onResult, defaultResilience)

def expand(args: A): Try[List[SagaTransactionStep[E, Any, C]]]
ArgsCodec.playJson[A](implicit fmt: play.api.libs.json.Format[A]): ArgsCodec[A]
SagaRegistry.register[E, C, A](definition: SagaDefinition[E, C, A]): Unit
SagaRegistry.resolve(name: String, version: Int): Try[SagaDefinition[_, _, _]]

PhaseAsk.ask[Cmd, Reply, E, R, C](
  ref: C => akka.actor.typed.RecipientRef[Cmd],
  command: (String, ActorRef[Reply]) => Cmd,
  mapReply: Reply => Either[E, SagaResult[R]]
): PhaseAsk[E, R, C]

def send(transactionId: String, ctx: C, traceId: String)(
  implicit ec: ExecutionContext, s: Scheduler, timeout: Timeout
): Future[Either[E, SagaResult[R]]]
```

`ArgsCodec` 使用 `Array[Byte]`，不是 strict 的 protobuf `ByteString`。`SagaResult[T]` 字段顺序为 **message、metadata、data**；单参 `SagaResult(data)` 是 companion overload。`ParticipantEffect[E,R] = Future[Either[E,SagaResult[R]]]`。

`AskParticipant[E,R,C](rules, askTimeout)(implicit ec,scheduler)` 的 prepare/commit/compensate 都是 `(transactionId,context,traceId)(implicit ec)`。它拥有 typed business/thrown 分类，不持久化：None binding→成功 empty；Some→send→分类。`PhaseAwareParticipant` 在 definition.expand 中用于裁剪 phase，**但该冻结 AskParticipant 没有混入它**，不能把 None 自动解释成“该 phase 从计划删除”。

`ErrorRules` 的三种 apply overload、classify 方法完整保存于 JSON G07；未匹配 business→NonRetryable，Timeout/Connect/SQLTransient→Retryable，显式 thrown 规则覆盖默认。`ResiliencePolicy(maxRetries=3,timeoutPerAttempt=5.seconds,recovery=FailIfOngoing,circuitBreaker=None)` 与 `.defaults` 相等时表示继承 definition 默认。

### 谁记录、回复、发布、恢复

- [SagaRunner:73–182](../baseline/curated-scala/net/imadz/infra/saga/dsl/SagaRunner.scala) 构造顺序是 `definition,coordinatorRef,system,startAckTimeout=15.seconds,completionBackstop=5.minutes`；`run(transactionId,args,traceId="",singleStep=false):Future[TransactionResult]`。Started 只代表开始，等待节点内 completion bridge；AlreadyRunning 返回合成 unsuccessful 结果，不可当成持久业务失败；rejection/ask/backstop 则失败 Future。`statusOf` 另行查询，admin 多 waiter 也是内存 registry。
- [Coordinator:229–260](../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala) 的 `apply(persistenceId,stepExecutorBehavior,globalTimeout=5.minutes)(implicit ec,timeout)` 创建 ESB。StartSaga 的参数顺序和两类 replyTo 完整列于 JSON G07；不是传 participant bytes 入 journal。
- Coordinator:462–550 拒绝 unknown definition/坏 args/precheck 失败而不持久化；`preCheck Right` 的返回值被忽略，展开的是原 args。开始先 persist `TransactionStarted`，然后 start ack、SagaProgressEvent、执行 phase。
- Coordinator:705–742 终态先 persist PhaseSucceeded+TransactionCompleted/Failed，再发布 **SagaProgressEvent**、回复 `TransactionResult`，最后 stop。没有在已搜索固定 classic runtime 中找到 `.onResult(...)` 调用；definition 储存 callback 不证明业务事件自动发布。
- [StepExecutor:149–179](../baseline/curated-scala/net/imadz/infra/saga/StepExecutor.scala) 自身拥有 ESB、CircuitBreaker 与 timers；RecoveryCompleted 不自动运行，等待 Attach。Coordinator 对未暂停的进行中交易则会恢复驱动。该差别不可抹平。

[Raw SagaDefinitionTemplate:68–93](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaDefinitionTemplate.scala) 默认 `preCheck=args=>Right(args)`、`onResult=(_,_)=>Nil`。这些是默认业务槽，不是银行策略。participant 模板还固定首构造字段用于 `find<Base>ByUserId`，不支持凭想象替换成任意资源定位。

[SagaTriggerBehaviors:65–108](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/SagaTriggerBehaviorsTemplate.scala) 是另一个业务意图 ESB：persist Initiated→ask coordinator→persist Completed/Failed→thenReply。raw ask 失败会构造 `TransactionResult(false,null,"start failed")`；这不证明远端没执行，也不形成可靠 outbox。

## 6. G08–G10：Strict、fixture 与 Monarch 的边界

### Strict 的真正接口

额外只读源 `/Users/zhongdj/Workspaces/mad-polaris/saga-core/src/main/scala/net/imadz/infra/saga/strict/StrictSagaDefinition.scala` 的 SHA 为 `ae73217f373a1bb14a8eea422df7282bfe9e22400b1f4003a0a6d631e097da6a`。完整方法签名见 JSON G08，核心为

```scala
trait PayloadCodec[A] {
  def pin: CodecPin
  def encode(value: A): com.google.protobuf.ByteString
  def decode(bytes: com.google.protobuf.ByteString): Try[A]
}
trait PhasePort[A, R] {
  def receiptCodec: PayloadCodec[R]
  def querySafety: QuerySafety
  def execute(request: OperationRequest[A]): Future[PhaseOutcome[R]]
  def query(request: OperationRequest[A]): Future[PhaseOutcome[R]]
}
trait ReconcileAuthorizer {
  def authorize(identity: TransactionIdentity, token: String): Either[String, String]
}

StrictSagaDefinition[A](name, version, definitionDigest, argsCodec, participants)
StrictSagaCoordinator.apply[A](
  persistenceId: PersistenceId,
  definition: StrictSagaDefinition[A],
  authorizer: ReconcileAuthorizer,
  settings: Settings = Settings()
): Behavior[StrictSagaCoordinator.Command]
```

这里 `TransactionIdentity` 的字段序为 transactionId、definitionName、definitionVersion、argsDigest、definitionDigest、argsCodec、planDigest；`OperationIdentity` 为 transaction、participantId、resource、stepId、phase。不能拿 attempt 或源码名替代稳定身份。

- `ConfirmedReceipt` 必须反映真实持久 operation；`NotExecuted(identity,evidence,safeToRetry)` 的安全重试要求旧调用不会后来生效；timeout、Rejected 都不是 authoritative absence。
- 当前 source `materialize` 验证 canonical codec、非空参与者、唯一 stepId、三个 TCC phases 与 pins。它检验声明/字节，不认证任意数据库实现的只读性或幂等性。
- Coordinator:85–187 先持久 intent 再 I/O，持久 commit decision 后才 commit；unknown→RecoveryRequired。恢复 halt；已存在交易的 Start/Attach/GetStatus 不自动 re-drive。Reconcile 必须同步授权、满足 interaction budget。
- [StrictSagaModuleTemplate:81–115,240–274](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala) 的每 phase HostBinding 接 `execute(identity,input)`、`query(identity,input)`，adapter 再映射 OperationRequest。`Host.requireImplemented(requirements,types,argsCodec)` 正常返回只代表 host 声明，不能替代行为验证。completion 方法仅映射事件值，发布归宿主。

### Fixture entry 与资源 owner

[FixtureHostTemplate:555–746](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/FixtureHostTemplate.scala) 的精确 entry signatures 见 JSON G09。其 `installEventSource(system,sharding,coordinator)(implicit ec):UniqueKillSwitch` 订阅 `ScalaDslMongoReadJournal.allEvents()`：持久 trigger→Start；coordinator PID 的终态 marker→GetStatus→`publishCompletion(sharding,host,state)(implicit timeout,scheduler,ec)`→发起聚合的生产命令。

真正持久 result 与幂等 guard 属于 aggregate；不是 completion mapper 自己写库。该 stream 的 kill switch 被返回，但 [ApplicationBootstrapTemplate:52–71](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/ApplicationBootstrapTemplate.scala) 没有保存它。异步发布失败仅输出错误；没有由这些调用证明耐久重试或自动恢复。固定注释中的 shared journal 不能升级成已验证 offset/replay 合同。

### Monarch 不负责 TCC

额外 `/Users/zhongdj/Workspaces/mad-polaris/monarch-persistence/src/main/scala/net/imadz/monarch/persistence/PersistentMonarch.scala` 的 SHA 为 `f5a82408eeec0a76ede993c0b9223447818ff7dd81a3f514afc01ce830653506`。当前 source 的消费接口是

```scala
def behavior[Stage, S](
  persistenceId: PersistenceId,
  stages: Seq[Stage],
  interpreter: (Stage, S) => Future[S],
  stateCodec: StateCodec[S],
  stageName: Stage => String = (s: Stage) => String.valueOf(s),
  failurePolicy: Option[(String, StageError, S) => Future[S]] = None,
  observer: RunObserver[S] = RunObserver.nop[S]
)(implicit ec: ExecutionContext): Behavior[PersistentMonarch.Command[S]]

StartRun[S](runId: String, initialState: S, replyTo: ActorRef[RunReply])
StateCodec.apply[S](enc: S => Array[Byte], dec: Array[Byte] => S): StateCodec[S]
```

- `net.imadz.monarch.StageInterpreter.run(stage,state)(implicit ec):Future[State]` 执行单 stage。核心只管 Future 队列/游标；不持久化、回复、TCC commit/compensate。
- 当前 Monarch source 每次运行捕获计划；`injectHead/appendTail` 影响后续调用，不修改正在执行的队列。`resume` 跳过连续前缀。generation guard 只在 JVM 内阻止后续接受，不撤回已发 I/O。
- 持久宿主 owns RunStarted/StageDone/StageResolved/RunCompleted/RunFailedEvt。StartRun Accepted 在开始记录持久化后发出，不是终态。当前 checkpoint ack 在 commit 后；`RunObserver.onStageComplete(cursor,metadata,snapshot)` 却在 persist 前，只有 DurableRunObserver 的 committed 方法表示提交后通知。
- RecoveryCompleted 从已提交 snapshot/prefix 恢复，未提交阶段可能重跑。宿主负责 idempotent interpreter 与稳定 codec；PreRestart/PostStop 会 closeOwner。
- [InvocationHostTemplate:402–513,544–599](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/InvocationHostTemplate.scala) 用 `behavior(pid,chain,interpreter,codec,stageName,None,RunObserver.nop)` 调 child，并观察 child journal 作权威终态；StartRun timeout 是 unknown。parent PostStop 取消 scheduled polls、shutdown childWatch。fixture stage 无设备 I/O，不是银行执行政策。

这些是“当前额外源”和“冻结消费模板”的对照，**不是旧 `0.2`/候选 `0.2.1` 制品再验收**。

## 7. G11：Projection JDBC 不能靠返回类型证明事务一致

[ScalikeJdbcSession](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSession.scala) 的全部公开合同：

```scala
def withSession[R](f: ScalikeJdbcSession => R): R
// final class ScalikeJdbcSession extends akka.projection.jdbc.JdbcSession
val db: scalikejdbc.DB
def withConnection[Result](func: akka.japi.function.Function[java.sql.Connection, Result]): Result
def commit(): Unit
def rollback(): Unit
def close(): Unit
```

构造 `DB.connect()`，`autoClose(false)`；withConnection 先 `db.begin()` 再 `withinTxWithConnection`。commit/rollback/close 原样委托。**withSession 仅 finally close，不自动提交或回滚**。

[ScalikeJdbcSetup:17–75](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSetup.scala) 的 `init(system:ActorSystem[_]):Unit` 建 HikariDataSource→default ConnectionPool，并在 `system.whenTerminated` 关闭全部池。没有读取实际连接参数；这里只研究配置属性与 owner。

[ProjectionTemplate:70–193](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionTemplate.scala) 固定消费形状：

```scala
def sourceProvider(tag: String)(implicit system: ActorSystem[_])
  : SourceProvider[Offset, EventEnvelope[<ProtoEvent>]]

def createProjection(system: ActorSystem[_], sharding: ClusterSharding,
                     index: Int, repository: <Repo>)
  : ExactlyOnceProjection[Offset, EventEnvelope[<ProtoEvent>]]

JdbcProjection.exactlyOnce(
  projectionId = ProjectionId(name, tag),
  sourceProvider = sourceProvider(tag),
  handler = () => new <Handler>(repository),
  sessionFactory = () => new ScalikeJdbcSession()
)
```

注意这里是 `akka.projection.eventsourced.EventEnvelope`，不是 fixture persistence-query 的同名 envelope。Bootstrap 通过 `ShardedDaemonProcess`/`ProjectionBehavior` 管每个 tag 实例；多聚合时每源独立 provider、tag、offset。

最重要的非等价点：

1. [repository builder:533–583](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/repository/ProjectionRepositoryImplBuilder.scala) 的 upsert 开独立 `DB.localTx`，query 开 `Future { DB readOnly {...} }`。没有传入 handler 收到的 `ScalikeJdbcSession`。不能证明 view write 与 offset 同事务，更不能扩展到 Mongo/graph/vector 外部 sink。
2. [handler:171–185](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionHandlerTemplate.scala) 单项目关注事件 arm 是 MANUAL `???`，未知事件直接 `()`。生成出 handler 不等于投影算法已实现。
3. multi 非 graph 的 `ViewMachine.run/updateOnly` 消费顺序为 envelope、decode、identity、read、applyEvent、write。**没有定位该 ViewMachine 的定义与真实 ABI**，不从调用方猜出全部签名/事务行为。
4. [ApplyEventTemplate:59–150](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionApplyEventTemplate.scala) 会有 `Instant.now()` fallback、空 row 默认和降级槽；不能把所有生成函数都宣称为纯确定性 fold。

既有 [projection.json](projection.json) 的 D-P04、D-P10、D-P12 等未决项保留；此次内容研究没有将它们清零。

## 8. G12：API/Auth 是另一种错误与资源边界

精确 provider 是 `net.imadz.common.auth`，额外 source 位于 `/Users/zhongdj/Workspaces/mad-polaris/auth-core/src/main/scala/net/imadz/common/auth/`；Endpoint/ApiError/RoleResolver/RoleGate/AuthAction/TokenService 与对应 scaffold 源字节相同。不是将 curated 的 `net.imadz.infrastructure.auth` 包静默改名成发布 ABI。

关键调用有严格的两层参数：

```scala
api.global.write[Req](roles: _*)
  .apply[Reply] { (ctx: GlobalCtx, req: Req) => Future[Either[ApiError, Reply]] }
api.tenant.read(roles: _*)
  .apply[Reply] { (ctx: TenantCtx) => Future[Either[ApiError, Reply]] }

// write[R](roles: String*)(implicit reads: Reads[R])
// apply[T](handler: (Ctx, R) => Future[Either[ApiError,T]])(implicit w: OWrites[T])
// read.apply[T](handler: Ctx => Future[Either[ApiError,T]])(implicit w: OWrites[T])
```

这是调用形状示意；实际返回值是 `Action[AnyContent]`。完整各 root/reader/writer owner 与签名见 JSON G12。

- `ApiError(status,errorCode,message,payload=None)` 的 `toResult[T](Either)(implicit OWrites[T])` 将 Right→200，Left→自身 status。payload 与基础 error JSON 在顶层合并。`conflict[P](code,msg,payload)(implicit OWrites[P])` 才是409扩展载荷，不是 `iMadzError`。
- Endpoint 构造器顺序为 **defaultAction、anyParser、tokens、config、resolver:NotFoundRoleResolver**，然后 implicit EC。注入的是 concrete 默认 resolver，不是可自动切换的 RoleResolver trait。
- RoleResolver 的三方法都是 `(scopeId,userId,expectedTenantId):Future[Option[String]]`；NotFound 实现全部 None→子域403。存在 CachedRoleResolver 装饰器不证明真实名册已接入。
- RoleGate.fromConfig 不认识的值回 Migration；globalRole 默认 User；tenant owner 放行细角色；缺 mrole 的 migration 分支可放行。不能替银行编造角色政策或默认称 fail-closed。
- TokenService `verifyAccess(token):Option[VerifiedToken]` 做本地 JWT 解码/必要 claims 提取；tokenVersion 被提取不等于已做撤销查询。未读取实际 token/config 值。
- Endpoint.finishImpl 只 recover 已返回 Future 的失败；调用 handler 时先发生的同步异常不由这个 recover 自动捕获。

[ControllerTemplate:537–556](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/ControllerTemplate.scala) 的命令出口是 typed `.ask`，`reply.error.fold` 成 `Right(OkReceipt(id,JsNull))` 或 `ApiError.badRequest(code,message)`。IdGuard 外、InstantGuard 内。`OkReceipt` writes 的 events 是空数组、occurredAt 是当前时间；不是事件明细或读侧一致性证据。[CommandDslTemplate:26–62](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala)

其他 raw 边界：legacy stub 返回200/Not implemented yet；GetState 经 global.read 直接 ask actor，不查 projection；anonymous 用例委托手写 Flow。`CommandRoleMap`/`ViewKeys` 是模块桩，不属于 auth-core。VO raw 带 Play JSON codecs 与用户期望的 domain 纯净度存在张力，不能隐瞒。

## 9. G13：启动与手写资源槽

[ApplicationBootstrapBuilder:31–132](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/bootstrap/ApplicationBootstrapBuilder.scala) 明确顺序：

1. 全部 classic saga definition 注册。
2. 用首 saga 的首 participant repository 构造一个 context，初始化共享 Saga engine。
3. 聚合 sharding。
4. projections。
5. 模板再追加 strict singleton 与 event source。

第二步不是任意异构 contexts 的通用保证。raw Builder/Template 没有 `ScalikeJdbcSetup.init` 调用；pool 初始化、`ConfigurationLike` 的 Guice binding、Play eager module 激活都须有部署 owner。**`@Singleton` 不是 `asEagerSingleton`；有 Bootstrap.scala 不证明它被实例化。**

[ApplicationService](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ApplicationServiceTemplate.scala) 方法体是 MANUAL `???`；[QueryService](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/QueryServiceTemplate.scala)/DomainService 也留算法槽。不能用空成功或事件名字符串替代它们。

[ConnectorImplBuilder:18–47](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/connector/ConnectorImplBuilder.scala) 只取接口首方法，impl 参数默认 Nil，默认首 helper 的 `run(script)`/`run()`，无 helper 则 `???`。Node subprocess/HTTP/client 资源的实际创建、退出、取消归手写 helper；未定位的 runner 不以接口存在推定 ABI。MANUAL 只保护实现体，不自动供给算法。

## 10. 交接时不能省略的未决项

1. **先裁定 source owner**：三种同 FQN helper、source-copy 与 jar 并存，选哪一种 API/发布方案；不能合成虚构超集。
2. **实际 artifact ABI 仍 unverified**：固定声明、候选开关、source hash、历史 PASS 互不替代。下一阶段验证须另获运行授权。
3. **Serializer/依赖装配**：Play/Mongo 传递声明差异、广泛 GeneratedMessage binding、strict/Monarch 注册完整性都未验。
4. **事务与发布**：projection 独立 localTx；classic onResult consumer 未定位；strict event-source 缺 retained lifecycle handle/耐久重试证明。
5. **启动与权限**：eager activation、pool init、ConfigurationLike binding、concrete NotFoundRoleResolver/Migration 默认要明确 owner。
6. **未定位名字**：InvariantValidation、共享 Policy/EntityState、独立 metadata error 若确有预期 API，须给 FQN/来源，不据名称补实现。
7. **Raw/manual 的诚实分层**：ordinary invariant/service/query/projection 槽、HTTP 200 stub、fixture 无设备 I/O 都不能变成业务 PASS。

以上仅内容证据。没有修改生产代码、作者树、生成数据、catalog、baseline、任务、Git 或他人的文档；只有本文件及其 JSON 伴随件是本次写集合。
