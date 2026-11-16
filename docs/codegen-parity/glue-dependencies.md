# 生成制品胶水依赖与副作用合同

最后更新：2026-11-16。状态：**源码合同已整理；实际消费JAR/完整classpath未核，未做生成或运行验收。** 用户最新通报：`common-core-post-validation` 的下一版post-validation／withPost建议**尚未完成**，详见[逐项建议与消费交接](COMMON-CORE-CONSUMPTION-HANDOFF.md)；以下“不含withPost”仅描述已知0.2，不是未来版本永久禁止。新版本号/字节/最终API未提供，本线不提前依赖、不接管其实现或发布。

**用户裁定（2026-11-16，两段）**：common package 不一致以已发布最新 common-core 为主；**工作区 `common-core/` 目录即已发布 `net.imadz:common-core_2.13:0.2` 的对应源码**。据此：

- 已发布0.2的API形状 = [common固定源码](baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala)：`(rule, helper, state, command)` 构造、`replyWith`、`replyWithAndPublish`、旧两层柯里化 overload。
- **`withPost`/`post` 参数与 `policy` 命名只存在于 BC scaffold 副本，不在已发布制品中**——目标生成代码不得依赖它们。
- curated 副本（无 publish）是历史参考，非发布API。
- BC `CodegenMain` 的 scaffold source-copy 会把与发布0.2**同FQN但不同签名**的 helper 源复制进目标工程：这是一条具体的遮蔽/冲突风险，不再是"三候选待选"；实施时必须裁定 source-copy 与 jar 依赖二选一，不能让两者并存。
- 我未实际读取发布JAR字节；来源身份由用户裁定给定，制品级字节/坐标核对可在实施锁定时一并完成。

完整逐符号签名、方法体语义、出处及42族映射见[胶水证据JSON](details/glue-source-evidence.json)与[人读证据](details/glue-source-evidence.md)。本文件作实施者的统一入口。证据分四种：固定传统源码、固定人工参考、补充当前源码、实际制品；本轮只取得前三种，不能把它们拼成一个虚构的已发布API。

## 1. 首要阻断：相同FQN有不同源码合同

`net.imadz.common.application.CommandHandlerReplyingBehavior`至少有三份本次可见源码：

| 来源 | 准确身份 | `RunnablePolicyWithHelper` | 附加能力 |
|---|---|---|---|
| [common固定源码](baseline/common/src/main/scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | SHA `2af0b26def49ccf43a23413642fa92bae2233a605b9bb84690ce68e16b0f8852` | `(rule, helper, state, command)` | replyWith、replyWithAndPublish；无withPost |
| [人工参考源码](baseline/curated-scala/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | SHA `92ac1e9005ddf70d8665edea2211b1c06cf48374e51b0c765cabd2831a90eee4` | `(rule, helper, state, command)` | replyWith；无publish/withPost |
| [BC scaffold补充副本](supplemental/glue/backkend-codegen/scaffold/app/net/imadz/common/application/CommandHandlerReplyingBehavior.scala) | SHA `d2499de5832333c39ef644da3094ef5b5cc023c69d4b43643e83de94c2973350` | `(policy, helper, state, command, post = _ => None)` | replyWith、withPost；无publish |

三者共有的positional调用子集可以描述，不能据此批准case-class构造arity、named arguments、copy/extractor或扩展方法兼容。按用户裁定：**0.2制品API即上表第一行（common固定源码）**；scaffold副本的`withPost`/`policy`不是发布能力，目标生成不得引用；scaffold复制与jar依赖并存的具体遮蔽风险须在实施前裁定。

更重要的是，传统[CodegenMain L199–228](baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L199)实际复制scaffold（multi再搬13份common源），而[scaffold/build.sbt](baseline/bc/scaffold/build.sbt)又声明common/Saga等依赖。因此实施前必须决定**source-local owner vs artifact owner**，核实际编译/打包取哪份，不能默认“import net.imadz就是common-core jar”。本轮不发布、不重编运行库、不用复制一份helper来绕过该问题。

## 2. 已声明的依赖，不冒充已解析制品

| 消费面 | 固定传统声明/引用 | 正式JS银行路线差异/未核事项 |
|---|---|---|
| Scala/JDK | Scala2.13.14、target11 | 编译器/实际classpath未启动核验 |
| common/Monarch/Saga/auth | `net.imadz:{common-core,monarch-core,monarch-persistence,saga-core,auth-core}_2.13:0.2` | `0.2`不是`0.2.0`；正式JS应用选择冻结0.3.0 Saga/Monarch，不能互换版本证据 |
| Akka |2.6.20，typed actor/sharding/persistence/query/stream等 | module集合与eviction需按目标profile核，不能只有actor一个jar |
| Akka Projection | eventsourced/jdbc1.2.5 | 银行现是自管per-PID读库，不等传统eventsByTag组合 |
| JDBC | ScalikeJDBC3.5.0；MySQL8.0.33 | JDBC session/offset事务归属需实证；family H2与银行MySQL不混签 |
| Mongo plugin | rxmongo3.0.8 | 一些当前库build仍声明scala plugin；这里只记录声明差异，不说实际classpath冲突已复现 |
| Protobuf/ScalaPB | protobuf-java3.15.6；scalapb compilerplugin0.11.14、sbt-protoc1.0.6 | 具体PB message/oneof ABI未生成核验；schema值和接受域受保护 |
| Play/Auth | Play插件2.8.18、play-json override2.9.3、jwt-play9.1.2 | 当前auth-core源码build的Play2.8.20不是冻结app已消费2.8.20的证据 |
| sbt | scaffold1.4.9 | 与生成器开发repo sbt版本区别；不执行默认target生成 |

版本精确声明、candidate属性分支与完整坐标见证据`dependencyDeclarations`。补充来源逐字节保存在[supplemental/glue-index.json](supplemental/glue-index.json)：25文件/147353字节，**不是依赖jar供应包**。仅hash核查的重复scaffold源有原证据映射，未多次拷贝；不能将hash-only视为内容审阅。

## 3. 纯规则、身份、状态与领域服务

[CommonTypes](baseline/common/src/main/scala/net/imadz/common/CommonTypes.scala)定义：

```scala
// net.imadz.common.CommonTypes
// 类型参数顺序不可互换
type Id = java.util.UUID
final case class iMadzError(code: String, message: String)
    extends Throwable with CborSerializable
trait InvariantRule[Event, State, Param] {
  def apply(state: State, param: Param): Either[iMadzError, List[Event]]
}
trait ReadModel
trait DomainService
trait ApplicationService
```

`net.imadz.common.Id.of(String)`委托UUID解析；`Id.gen`有随机性。它们不是银行`AccountId/TxId/OperationId`等独立名义文本类型的同义替换。

- `CborSerializable`是marker，自己不persist、不publish，不代表binding已经注册。
- State与EventHandler是每实体具体类型及`(State,Event)=>State`别名，不假定有统一`EntityState`库接口。
- 现已定位SPI是`InvariantRule`。在本次检索范围未定位精确`InvariantValidation`或共享`Policy`trait；不能因为名字合理就编造API。
- 普通Invariant/DomainService/Query/ApplicationService raw模板有实现槽；formal规则是另一种明确分支。`???`/注释逻辑不替换为`Right(empty)`或空DTO。
- `MoneyOps.shift(String,String,Int):String`在scaffold有源码，不证明目标common jar包含它；也不能替代银行精确Money合同。

## 4. CommandHelper：三个方法与真实Effect顺序

owner为`net.imadz.common.application.CommandHandlerReplyingBehavior`：

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
```

签名来自固定common版本；scaffold首参名为policy，不能混用named argument。标准接线：

```scala
val param = helper.toParam(state, command)
rule(state, param).fold(
  error => Effect.reply(replyTo)(helper.createFailureReply(param)(error)),
  events => Effect.persist(events)
    .thenReply(replyTo)(helper.createSuccessReply(param))
)
```

| 路径 | 合同 |
|---|---|
| 业务Left | 失败回复；不持久化，不发布 |
| Right(events) | 持久化并由ESB调用event handler；`thenReply`把**更新后的State**交成功回复工厂 |
| Right(Nil) | 明确成功空事件，不擅自改成失败；是否为合法幂等结果由业务规则确定 |
| `toParam/rule/replyFactory`抛异常 | 该胶水未自动捕获；不是业务Left，不保证有失败回复 |
| persistence失败 | 由宿主持久化失败策略处理，不伪装成可安全重试的业务拒绝 |
| common的`replyWithAndPublish` | persist后thenRun按事件序发布EventStream，再thenReply；不是耐久outbox |
| scaffold的`withPost(f)` | rule Right后、persist前校验events；Some(error)失败reply且不persist；与publish完全不同 |

原legacy overload另有`runReplyingPolicy(rule)(state,param).replyWith(replyTo)(leftFactory,rightFactory)`，两个factory都是柯里化函数；不能替换为当前三方法Helper的任意删参版本。

生产位置：Helper在`application.aggregates.behaviors`，Actor命令在`application.aggregates`，pure Param/Event不含ActorRef。只读query有回复但不用写命令Helper。Raw Builder的机械成功回复不保证等于用户Deposit样例，银行逐命令回复字段必须显式补齐；不能把人工余额算法复制给所有aggregate。

## 5. 聚合、工厂、仓储与Bootstrap谁负责什么

| 制品 | 真实合同/动作 | 不能推断 |
|---|---|---|
| aggregate-root | commandHandler、EntityTypeKey、tags的接线定义 | 不在root凭空创建第二个ESB/Actor缓存 |
| repository port/impl | typed访问；实现`sharding.entityRefFor(key, identity)` | 返回EntityRef不等已经创建业务状态/资金已变更 |
| aggregate-factory | typed ask初始化，`Future[Either[iMadzError,EntityRef[Command]]]` | ask失败Future不自动变业务Left；不等纯`Aggregate(...)`转发 |
| bootstrap aggregate | `sharding.init(Entity(key)(...))`；PID/initial/command+event handlers、tagger、retention、persist-failure、adapters | 不能将本地ofUniqueId和分片PID互换称格式变化 |

Raw bootstrap组合：`PersistenceId(key.name,entityId)`、`EventSourcedBehavior(...)`、snapshotEvery100/keep3、restartWithBackoff200ms/5s/0.1和stash100。它们是传统源码中的值，**不是已批准要覆盖银行当前运行配置**。

当前银行Repository片段的mutable Map/close清理不证明Actor stop/drain/watch；改ClusterSharding需要单独运行语义/调用方迁移。优先选择对应库/框架职责，不再为每个业务生成一个同名缓存当工业级仓储。

## 6. Serializer、converter、EventAdapter、SnapshotAdapter分账

[PrimitiveConverter](baseline/common/src/main/scala/net/imadz/common/serialization/PrimitiveConverter.scala)的内嵌SPI：

```scala
trait ProtoConverter[S, P] {
  def toProto(domain: S): P
  def fromProto(proto: P): S
  def toProtoOption(domain: Option[S]): Option[P]
  def fromProtoOption(proto: Option[P]): Option[S]
  def toProtoList(domain: Seq[S]): Seq[P]
  def fromProtoList(proto: Seq[P]): List[S]
}

def toProtoMap[K1,V1,K2,V2](
  domain: Map[K1,V1],
  keyConv: ProtoConverter[K1,K2], valConv: ProtoConverter[V1,V2]
): Map[K2,V2]

def fromProtoMap[K1,V1,K2,V2](
  proto: Map[K1,V1],
  keyConv: ProtoConverter[K2,K1], valConv: ProtoConverter[V2,V1]
): Map[K2,V2]
```

注意反向converter型参方向。默认Map helper不实现银行现有PB-entry排序或重复解码key拒绝，不能无条件复用代替。

- EventAdapter做domain event↔journal对象，`manifest/toJournal/fromJournal`；raw返回inner oneof，银行返回具体PB message，manifest策略也不同。
- SnapshotAdapter只有`toJournal(State):Any`与`fromJournal(Any):State`；没有manifest/identifier/byte方法。框架边界Any不等允许业务内部Any分发表。
- `SerializerWithStringManifest`把journal对象↔bytes，identifier+manifest和EventAdapter.manifest是不同身份层。
- 银行具体PB类白名单、message/字段号/codec、serializer ID/PID必须保持，不能用`GeneratedMessage`大类绑定洗掉缺项。
- raw BigDecimal→Double、Option[List]的None折叠、null Instant→epoch、不支持容器的conv命名是实际基准问题，不是银行approved-target。
- 类/object拆分和移包必须同步构造者、配置、历史解码与回锚，不靠删除旧journal/改PID验收。

## 7. Classic Saga、Strict Saga、Monarch不共用一张“流程”合同

### Classic

固定[人工DSL源码](baseline/curated-scala/net/imadz/infra/saga/dsl/SagaDefinition.scala)及相关AskParticipant/Runner是传统模板的参考接口，不证明当前saga-core:0.2制品含同样ABI：

```scala
PhaseAsk.ask[Cmd, Reply, E, R, C](
  ref: C => RecipientRef[Cmd],
  command: (String, ActorRef[Reply]) => Cmd,
  mapReply: Reply => Either[E, SagaResult[R]]
): PhaseAsk[E, R, C]

// ArgsCodec以Array[Byte]为载体
SagaRegistry.register[E,C,A](definition: SagaDefinition[E,C,A]): Unit
```

完整构造/overload见证据G06/G07。AskParticipant没有持久化，负责三相位ask与错误分类；None binding的空成功与“阶段被计划裁掉”不是一回事。Coordinator与StepExecutor分别持久化自己的状态，恢复驱动语义不同。

`SagaDefinition.onResult`被存进定义不等于实际被运行库调用。本次固定classic源码未定位消费该callback的位置；不能承诺自动发布业务结果。raw trigger ask失败合成`TransactionResult(false,null,"start failed")`也不能证明远端未执行。

### Strict

完整固定补充接口见[StrictSagaDefinition](supplemental/glue/saga-core/src/main/scala/net/imadz/infra/saga/strict/StrictSagaDefinition.scala)与[Coordinator](supplemental/glue/saga-core/src/main/scala/net/imadz/infra/saga/strict/StrictSagaCoordinator.scala)：

```scala
trait PayloadCodec[A] {
  def pin: CodecPin
  def encode(value: A): ByteString
  def decode(bytes: ByteString): Try[A]
}
trait PhasePort[A,R] {
  def receiptCodec: PayloadCodec[R]
  def querySafety: QuerySafety
  def execute(request: OperationRequest[A]): Future[PhaseOutcome[R]]
  def query(request: OperationRequest[A]): Future[PhaseOutcome[R]]
}
```

TransactionIdentity/OperationIdentity、confirmed/absent/unknown证据、授权reconcile及预算不能被经典UUID/Boolean结果抹平。持久intent后才I/O，持久commit决定后只向前恢复；恢复halt不等自动重驱所有phase。当前源码与冻结artifact的兼容仍未验证。

### Monarch

[PersistentMonarch补充源码](supplemental/glue/monarch-persistence/src/main/scala/net/imadz/monarch/persistence/PersistentMonarch.scala)当前接口：

```scala
behavior[Stage,S](
  persistenceId: PersistenceId,
  stages: Seq[Stage],
  interpreter: (Stage,S) => Future[S],
  stateCodec: StateCodec[S],
  stageName: Stage => String = ...,
  failurePolicy: Option[(String,StageError,S) => Future[S]] = None,
  observer: RunObserver[S] = RunObserver.nop[S]
)(implicit ec: ExecutionContext): Behavior[Command[S]]
```

这里省略号只指已在源中固定的默认函数，不是完整可编译示例。核心Monarch管理队列/游标，持久宿主记录checkpoint；不是TCC协调器。未提交stage可能重跑，业务宿主负责幂等。普通observer回调可能在persist前，durable committed回调才代表提交后证据。JVM generation guard不撤回已经发出的I/O。

Fixture/composition host的event source、poll、child watch各有owner；返回kill switch不等顶层已保存并关闭它。原bootstrap丢弃handle或异步失败仅打印的情况进入对应diff，不由“有API”自证完成。

## 8. Projection/JDBC事务边界

固定[ScalikeJdbcSession](baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSession.scala)提供`withConnection/commit/rollback/close`，其`withSession(f)`仅finally close，不自动提交或回滚。ScalikeJdbcSetup拥有pool初始化和ActorSystem结束后的关闭。

传统消费为：

```scala
JdbcProjection.exactlyOnce(
  projectionId = ProjectionId(name, tag),
  sourceProvider = sourceProvider(tag),
  handler = () => new Handler(repository),
  sessionFactory = () => new ScalikeJdbcSession()
)
```

repository的upsert若独立`DB.localTx`、不接handler传入的session，不能证明view+offset处于同一事务。Mongo/graph/vector外部副作用更不自动exactly-once。`ViewMachine.run/updateOnly`调用点存在，但其真实定义/ABI尚未定位，不能由调用形状反向发明库。

银行per-PID journal projection有重复payload校验、水位、watch/drain语义，不能替换成传统tag provider后丢掉这些职责。哪个owner提供start/readiness/shutdown和新鲜度，须在projection/Bootstrap闭包中明确。

## 9. HTTP/Auth与应用启动

补充[Endpoint](supplemental/glue/auth-core/src/main/scala/net/imadz/common/auth/Endpoint.scala)与[ApiError](supplemental/glue/auth-core/src/main/scala/net/imadz/common/auth/ApiError.scala)声明的调用：

```scala
api.global.write[Req](roles: _*)
  .apply[Reply] { (ctx: GlobalCtx, req: Req) => Future[Either[ApiError,Reply]] }
api.tenant.read(roles: _*)
  .apply[Reply] { (ctx: TenantCtx) => Future[Either[ApiError,Reply]] }
```

write要求Reads[Req]，apply要求OWrites[Reply]，产物是Action[AnyContent]。ApiError与iMadzError不同，不能丢HTTP状态/错误载荷。Endpoint源码默认具体NotFoundRoleResolver与Migration模式、tokenVersion仅提取等事实不能等同真实生产授权/撤销检查已实现；银行权限政策另有明确合同。

传统ApplicationBootstrap顺序是classic definitions注册→Saga engine/context→aggregate sharding→projection→strict entries。`@Singleton`不保证eager激活；pool init、ConfigurationLike binding、Play生命周期与外部connector资源需要具体owner。ConnectorImpl只选首方法/默认helper的raw行为不能当完整外部对接实现。

## 10. 实施准入，不增加无价值验收循环

每个需要胶水的工作包必须提供以下最小事实，一次集中核受影响闭包，不为每个模板重跑银行：

1. 准确FQN、源码或artifact唯一owner，完整方法签名/泛型/柯里化及期望体。
2. 实际选中坐标/版本/字节与classpath来源；同FQN不同源不能合并API列表。
3. 拒绝、不持久化、应用事件后回复、publish/post、未知结果/重试、资源退出的逐项合同。
4. 对应真实公开CLI生成产物与最小应用接口观察；tests/typecheck/内部import调用不替代运行证据。
5. 只核本次影响的profile/文件/依赖，集中一次编译与必要实际接口验证；旧37 PASS不迁签到新候选，不自动运行38。

当前阻断：source-local vs jar选择；实际helper/strict/Monarch/Play API未核；ViewMachine未定位；部分raw实现槽/身份迁移未裁定。**文档研究可以完成，代码实施的这些前置不能假绿。**
