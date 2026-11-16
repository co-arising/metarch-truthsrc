package net.imadz.meta

// ==========================================
// 1. 基础核心 (Core)
// ==========================================
sealed trait MetaType

case class FullQualifiedName(dottedPath: String) {
  override def toString: String = dottedPath
}

sealed trait DataType extends MetaType {
  def fullQualifiedName: FullQualifiedName

  def typeReferences: List[FullQualifiedName] = List(fullQualifiedName)
}

sealed trait MetaRef extends DataType {
  def targetName: String

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"Ref($targetName)"
  )
}

// 具体引用类型
case class InvariantRuleRef(targetName: String) extends MetaRef

case class EntityRef(targetName: String) extends MetaRef

case class EventFamilyRef(targetName: String) extends MetaRef

case class EntityBehaviorRef(targetName: String) extends MetaRef

case class EventRef(targetName: String) extends MetaRef

case class EntityStateRef(targetName: String) extends MetaRef

case class CommandRef(targetName: String) extends MetaRef

case class CommandFamilyRef(targetName: String) extends MetaRef

case class CommandReplyRef(targetName: String) extends MetaRef

case class AggregateRef(targetName: String) extends MetaRef

case class AggregateRepositoryRef(targetName: String) extends MetaRef

case class ProjectionRepositoryRef(targetName: String) extends MetaRef

case class ApplicationServiceRef(targetName: String) extends MetaRef
case class QueryServiceRef(targetName: String) extends MetaRef
case class StructRef(targetName: String) extends MetaRef
case class SagaContextRef(targetName: String) extends MetaRef
case class DomainServiceRef(targetName: String) extends MetaRef
case class ValueObjectRef(targetName: String) extends MetaRef
case class ControllerRef(targetName: String) extends MetaRef

case class UserRoleRef(targetName: String) extends MetaRef

case class ProjectionRef(targetName: String) extends MetaRef

case class BusinessLogic(
    intent: String,
    invariants: Seq[String] = Nil,
    referenceCode: Option[String] = None
) extends MetaType

sealed trait DomainDrivenMetadata extends MetaType {
  def name: String

  def metaCategory: String

  /** 2026-09-20 EP_Note_Tense_Knowledge_Id：便签时态稳定知识 ID。
    * 边界判据：本 trait ＝「领域概念」（有 name + metaCategory），正是「有知识身份」的集合；
    * MetaType 根含 DataType/RetryStrategy 等技术类型（无便签来源），故**不**放那一层（不假接）。
    * 缺省 None＝非便签来源；承载方（字段/命令/事件…）按需 override。 */
  def noteId: Option[String] = None

  /** S7 #2（#22·2026-09-23）：概念级知识号**多号视点**——缺省由 `noteId` 派生（单号）；
    * 多号容器（VO 携带者并集）override 本槽并把 `noteId` 定义为首号（兼容既有单号消费者）。 */
  def noteIds: Seq[String] = noteId.toSeq

  def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"$metaCategory.$name"
  )
}

// --- 基础类型 ---
case object StringType extends DataType {
  override def fullQualifiedName = FullQualifiedName("java.lang.String")
}

case object IntType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.Int")
}

case object LongType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.Long")
}

case object DoubleType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.Double")
}

case object BooleanType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.Boolean")
}

case object BigDecimalType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.math.BigDecimal")
}

case object UnitType extends DataType {
  override def fullQualifiedName = FullQualifiedName("scala.Unit")
}

case class CustomType(
    typeName: String,
    packagePath: String,
    typeParameters: Seq[MetaType] = Seq.empty
) extends DataType {
  override def fullQualifiedName: FullQualifiedName = {
    if (typeParameters.isEmpty) FullQualifiedName(s"$packagePath.$typeName")
    else
      FullQualifiedName(s"$packagePath.$typeName[${typeParameters
          .map {
            case d: DataType => d.fullQualifiedName.dottedPath
            case r: MetaRef  => r.targetName
          }
          .mkString(", ")}]")

  }
}

case class FieldMetadata(
    name: String,
    fieldType: MetaType,
    optional: Boolean = false,
    defaultValue: Option[String] = None,
    /** 2026-09-10 S2-82-B2：字段级版本标记（④层 introducedIn 真源透传）——proto 尾注释发射 */
    introducedIn: String = "",
    /** 2026-09-18 EP_Field_Nature_And_Concern_Anchors：字段**性质**＝问题空间标记
      * （答「这是什么」，非「落在哪 / 走不走事件」——后者是解决方案空间）。
      * 与既有两轴正交：role＝是哪种字段（State/Payload/Parameter/VO.Member）· origin＝值怎么来的。
      * 首批词表：credential。VO 成员（FieldStateSpec 等）与聚合字段共用本结构。 */
    nature: String = "",
    /** 2026-09-20 EP_Note_Tense_Knowledge_Id：字段稳定知识 ID（作用域＝容器·见技术规范）。
      * 由 AssemblyEngine 从 ②层 fieldModel 带进来，经 builder 透传到 FieldDef 发射。
      * None＝合成/注入字段（triggeredBy/timestamp 等·生成器注入），本就无知识来源。 */
    noteId: Option[String] = None,
    /** 2026-09-20 注释发射：字段描述（②层 template 的 businessDef 透传）——Javadoc @param 的内容。 */
    description: String = "",
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S3：**该字段的值由哪些事件载荷路径写**——
      * 真源 `FieldSpec.writtenBy` 的镜像（②层状态字段 475 条引用·5 种语法形态）。
      *
      * 此前**从未离开 `FieldModel`**（只随草稿 JSON 往返），故生成期无法发射该派生关系：
      * 「状态字段 ← 事件载荷」这条知识在图上有（`KN_DERIVES_FROM` 398 条）但**代码侧无锚**。
      *
      * 存**原文**（不在此处解析）：路径语法的唯一实现在 Node 侧 `tools/writtenby_lib.mjs`
      * （带语法校验与 fail-closed resolve）。判据来自本仓既有判例——同一份真源被两处 `split('.')`
      * 各解一次时，12% 从「悬空」变「可解」；解析器只有一个，故 Scala 侧只搬运不解释。
      */
    writtenBy: Seq[String] = Nil
) extends MetaType

case class ParameterMetadata(
    name: String,
    parameterType: MetaType,
    // 2026-08-22 应用服务编排（P1/P3）：可选参数（tenantName?/workgroupName?/workshopName?）
    optional: Boolean = false,
    optionalWhen: String = "",
    /** 2026-09-20 EP_Note_Tense_Knowledge_Id：参数稳定知识 ID（作用域＝命令·见技术规范）。
      * 与 FieldMetadata 同口径：字段各有身份，键＝(face, host, name)。 */
    noteId: Option[String] = None,
    /** 2026-09-20 注释发射：参数描述（②层 template 的 businessDef 透传）——Javadoc @param 的内容。 */
    description: String = ""
) extends MetaType

// ==========================================
// 2. 领域层 (Domain Layer)
// ==========================================

case class ValueObjectMetadata(
    name: String,
    fields: Seq[FieldMetadata],
    description: String = "",
    logic: Option[BusinessLogic] = None,
    /** S7 #2（#22·2026-09-23）：VO 概念号**全量**——②层 template 铸的单号（自有·7 个建模 VO）
      * 或元建模族装配派生 VO 的「携带者并集」（事件∪命令·`MergeEngine.derivedValueObjectIds`）。
      * 落台账 `artifacts[]` 行（多值槽）；注解面取首号（`voNoteIds.headOption`）。 */
    override val noteIds: Seq[String] = Nil,
    /** VO **自有**知识号（②层 template `valueObjects[].noteId` 铸·单号）——与 `noteIds` 的区别：
      * 自有号＝「VO 自己有一条便签」（图 `KnValueObject.noteId`/`codeFqn` 通道·voConcept 行）；
      * 携带者号＝「VO 出自哪些元素」（台账通道·无自有号的 VO 在图面如实不写·不拿携带者号冒充）。 */
    ownNoteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.values"
  /** 单号视点＝**自有号**（`FieldKnowledgeAnchors` 的 voConcept 行按此走图面；多号请用 `noteIds`）。 */
  override def noteId: Option[String] = ownNoteId
}

sealed trait DomainEventMetadata extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.events"

  def fields: Seq[FieldMetadata]
}

case class SubordinateDomainEventMetadata(
    name: String,
    fields: Seq[FieldMetadata],
    requiresProtobuf: Boolean = true,
    description: String = "",
    protoFieldMapping: Map[String, Int] = Map.empty,
    causedBy: Seq[EventCausalRef] = Nil,
    /** 2026-09-10 S2-81 批C：生产血缘（事件 ← 产生它的命令）。缺省 Nil——工作坊侧由 AssemblyEngine
      * 从 ②层事件便签 command 链接 ∪ 命令便签 event 链接接线；手工系统不建模（S106 以「血缘未建模」豁免写回段）。 */
    producedBy: Seq[CommandRef] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `event` 便签 358/358 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainEventMetadata

case class EventFamilyMetadata(
    name: String,
    description: String = "",
    events: Seq[SubordinateDomainEventMetadata],
    fields: Seq[FieldMetadata] = Nil,
    requiresProtobuf: Boolean = true
) extends DomainEventMetadata

case class EntityBehaviorMetadata(
    name: String,
    eventFamilyRef: EventFamilyRef,
    handlers: Seq[EventStateMutation],
    helperMethods: Seq[MethodMetadata] = Nil
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.entities.behaviors"
}

case class DomainEntityMetadata(
    name: String,
    state: ValueObjectMetadata,
    eventFamily: EventFamilyMetadata,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S7（用户裁定）：**类级容器必须有知识身份**。
      *
      * 「`<X>Entity` 就是 State」——实体对象与它的 state 是同一聚合的两半（元数据上
      * `AggregateRootMetadata.entityRef` ↔ `stateRef` 成对，`NamingConventions.getEntityNameFromStateName`
      * 是这对名字的既有换算），故**继承所属聚合的 id**（不新铸号：聚合便签 68/68 已有号）。
      *
      * 判据（实测 S3 收尾）：state 类在代码侧**没有任何落点**——`FQN 恰为某个 *State / *Entity object 的
      * KnCodePoint 各 0 个`；根因不是模板不发，而是**本类型从未有号的槽位被填**
      * （`DomainDrivenMetadata` 根上的 `noteId` 槽继承下来了，但没人往里放）。
      * 于是 `status`/`tenantId` 这类「折叠/随命令而来」的状态字段派生边**无处可挂**（64 条）。
      *
      * 发射：`DomainEntityTemplate` 在 `object <X>Entity` 前发裸行 `@knowledge <id>`（形态② 概念锚）
      * ⇒ 容器在代码侧有了落点，容器级派生边即可挂上（「容器代表其下所有字段」）。
      */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.entities"

  def events: Seq[DomainEventMetadata] = eventFamily.events ++ Seq(eventFamily)
}

case class EventStateMutation(eventRef: EventRef, logic: BusinessLogic)
    extends MetaType

case class InvariantRuleMetadata(
    name: String,
    description: String,
    subject: EntityStateRef,
    trigger: DataType,
    output: EventFamilyRef,
    conditions: Seq[InvariantCondition]
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.invariant"
}

case class InvariantCondition(name: String, errorCode: String, logic: BusinessLogic)
    extends MetaType

case class PolicyMetadata(
    name: String,
    description: String = "",
    sourceAggregate: String,
    triggerEvent: EventRef,
    targetAggregate: String,
    command: CommandRef,
    argumentMappings: Map[String, String] = Map.empty,
    entityIdField: String,
    idempotencyKey: String,
    resilience: ResiliencePolicy,
    logic: BusinessLogic = BusinessLogic(""),
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `policy` 便签 12/12 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.policies"
}

case class DomainServiceMetadata(
    name: String,
    description: String,
    methods: Seq[MethodMetadata]
) extends DomainDrivenMetadata {
  override val metaCategory: String = "domain.services"
}

case class MethodMetadata(
    name: String,
    parameters: Seq[ParameterMetadata],
    returnType: DataType,
    logic: Either[String, BusinessLogic],
    description: String = "",
    isPrivate: Boolean = false
) extends DomainDrivenMetadata {
  override val metaCategory: String = "methods"

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"$name(...)"
  )
}

// ==========================================
// 3. 应用层 (Application Layer)
// ==========================================

// [RESTORE] 恢复纯粹的逻辑分类
sealed trait CommandReplyMetadata extends DomainDrivenMetadata {
  override val metaCategory: String = "application.commands.reply"
}

case class SubordinateCommandReplyMetadata(
    name: String,
    parameters: Seq[ParameterMetadata]
) extends CommandReplyMetadata

case class CommandReplyFamilyMetadata(
    name: String,
    replies: Seq[SubordinateCommandReplyMetadata]
) extends CommandReplyMetadata

sealed trait CommandMetadata extends DomainDrivenMetadata {
  override val metaCategory: String = "application.commands"

  def parameters: Seq[ParameterMetadata] = Seq.empty
}

case class SubordinateCommandMetadata(
    name: String,
    override val parameters: Seq[ParameterMetadata],
    replyToType: Option[CommandReplyRef],
    isReadOnly: Boolean = false,
    description: String = "",
    /** 2026-09-08 E203 豁免裁决：②层命令便签 info.systemCommand（系统/工作台流命令——入口非用户故事，
      * 真仓 handler+路由在跑）。孤儿检查（E203）跳过此类命令；与 SM10 systemCommandExemption 词表同族裁决。 */
    isSystemCommand: Boolean = false,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `command` 便签 308/308 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends CommandMetadata

case class CommandFamilyMetadata(
    name: String,
    description: String = "",
    commands: Seq[SubordinateCommandMetadata]
) extends CommandMetadata

case class CommandHandlingFlow(
    commandRef: CommandRef,
    invariantRef: InvariantRuleRef,
    replyMapping: ReplyMappingConfig
) extends MetaType

case class ReplyMappingConfig(
    successReplyRef: CommandReplyRef,
    failureReplyRef: CommandReplyRef
) extends MetaType

case class AggregateCommandHandlersMetadata(
    name: String,
    flows: Seq[CommandHandlingFlow]
) extends DomainDrivenMetadata {
  override val metaCategory = "application.aggregates.behaviors"
}

case class AggregateBehaviorMetadata(
    name: String,
    behaviors: Seq[AggregateCommandHandlersMetadata]
) extends DomainDrivenMetadata {
  override val metaCategory = "application.aggregates.behaviors"
}

case class AggregateBehaviorRef(targetName: String) extends MetaRef

case class AggregateRootMetadata(
    name: String,
    identifier: FieldMetadata,
    entityRef: EntityRef,
    stateRef: EntityStateRef,
    eventFamilyRef: EventFamilyRef,
    commandFamily: CommandFamilyMetadata,
    replyFamily: CommandReplyFamilyMetadata,
    behaviorRef: AggregateBehaviorRef,
    persistenceConfig: PersistenceConfig,
    // [NEW] 增加 Repository 引用
    repository: Option[AggregateRepositoryRef] = None,
    description: String = "",
    implConfig: ImplementationConfig = ImplementationConfig(),
    factoryMethods: Seq[MethodMetadata] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `aggregate` 便签 68/68 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.aggregates"
}

case class PersistenceConfig(
    entityTypeKey: String,
    tagging: TaggingStrategy,
    snapshotInterval: Int = 100,
    eventAdapter: Boolean = true
) extends MetaType

sealed trait TaggingStrategy extends MetaType

case class ShardedTags(baseName: String, numberOfShards: Int)
    extends TaggingStrategy

case class ApplicationServiceMetadata(
    name: String,
    description: String,
    dependencies: Seq[DataType],
    methods: Seq[ServiceMethod]
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.services"
}

case class QueryServiceMetadata(
    name: String,
    description: String,
    repositories: Seq[MetaRef],
    structs: Seq[ValueObjectMetadata],
    methods: Seq[ServiceMethod]
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.queries"
}

case class ServiceMethod(
    name: String,
    parameters: Seq[ParameterMetadata],
    returnType: DataType,
    logic: BusinessLogic,
    invokes: Seq[CommandRef] = Nil
) extends DomainDrivenMetadata {
  override val metaCategory: String = "service.methods"

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"AppService.$name"
  )
}

case class SagaContextMetadata(
    name: String,
    fields: Seq[FieldMetadata],
    description: String = "",
    logic: Option[BusinessLogic] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.services.transactor.context"
}

/** Declarative saga arguments (saga_v3): a pure-data case class encoded via ArgsCodec.
  * Fields must be JSON-friendly primitives so the generated play-json Format needs no custom codecs. */
case class SagaArgsMetadata(
    name: String,
    fields: Seq[FieldMetadata],
    description: String = ""
) extends MetaType

case class SagaTransactorMetadata(
    name: String,
    commandFamily: CommandFamilyMetadata,
    triggerCommandName: String,
    participants: Seq[SagaParticipantMetadata],
    steps: Seq[SagaStepMetadata],
    replyMetadata: Option[CommandReplyMetadata] = None,
    /** saga_v3: definition version — part of the (name, version) registry key. */
    version: Int = 1,
    /** saga_v3: the Args case class consumed by SagaDefinition.steps. */
    args: Option[SagaArgsMetadata] = None,
    /** saga_v3: Context type resolved by participants' PhaseAsk bindings. */
    context: Option[SagaContextMetadata] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.services.transactor"
}

case class SagaParticipantMetadata(
    name: String,
    interactsWith: AggregateRef,
    fields: List[FieldMetadata] = Nil,
    /** saga_v3: participant constructor field -> args field symbol (validated by H001). */
    argMappings: Map[String, String] = Map.empty
) extends DomainDrivenMetadata {
  override val metaCategory: String =
    "application.services.transactor.participant"
}

case class SagaStepMetadata(
    stepId: String,
    participantName: String,
    phaseLogic: SagaPhaseLogic,
    resilience: ResiliencePolicy,
    /** saga_v3: parallel expansion group within one phase. */
    stepGroup: Int = 1
) extends MetaType

case class CommandBinding(
    commandRef: CommandRef,
    mappings: Map[String, String] = Map.empty
) extends MetaType

case class SagaPhaseLogic(
    prepareCommand: Option[CommandBinding],
    commitCommand: Option[CommandBinding],
    compensateCommand: Option[CommandBinding]
) extends MetaType

case class ResiliencePolicy(
    timeoutPerAttempt: String,
    retryStrategy: RetryStrategy,
    circuitBreaker: Option[CircuitBreakerConfig],
    recoveryBehavior: RecoveryBehavior,
    errorRules: Seq[ErrorRule]
) extends MetaType

sealed trait RetryStrategy extends MetaType

case class ExponentialBackoff(
    initialDelay: String,
    factor: Double,
    maxRetries: Int
) extends RetryStrategy

case class CircuitBreakerConfig(
    maxFailures: Int,
    callTimeout: String,
    resetTimeout: String
) extends MetaType

sealed trait RecoveryBehavior extends MetaType

case object RetryIfOngoing extends RecoveryBehavior

case object FailIfOngoing extends RecoveryBehavior

case class ErrorRule(
    errorType: String,
    codePattern: String,
    action: ErrorAction
) extends MetaType

sealed trait ErrorAction extends MetaType

case object MarkAsRetryable extends ErrorAction

case object MarkAsNonRetryable extends ErrorAction

// ==========================================
// 4. 基础设施与 CQRS
// ==========================================

// [NEW] 读模型字段级推导（血缘原料）：read model field ← event payload field
sealed trait FieldDerivation extends MetaType

case class DirectField(
    eventName: String,
    sourceField: String
) extends FieldDerivation

case class ComputedField(
    expression: String,
    dependsOn: Seq[FieldDerivation]
) extends FieldDerivation

case class ConstantField(
    value: String
) extends FieldDerivation

// 聚合身份（entity key）作为来源：如 CreditBalanceEntityKey 即 userId，不来自事件 payload
case object AggregateIdentity extends FieldDerivation

// 待推导字段（2026-08-23 投影 VO 语义落地）：S1-5 拍板的视图字段里，无血缘可推导的
// DERIVED / SYSTEM_INJECTED / STATE_TRANSITION / SYSTEM_QUERIED / SYSTEM_GENERATED / BUSINESS_INPUT 字段
// ——评估侧显式跳过（已知缺口非断裂），生成侧按 dataType 出字段 + 注释标注 origin（DTO 忠实拍板语义）。
case class UnresolvedField(
    origin: String
) extends FieldDerivation

case class ReadModelField(
    name: String,
    dataType: DataType,
    derivation: FieldDerivation,
    isKey: Boolean = false,
    /** EP_Functional_Terminal_Form_Template_Batch S2（P5·批④判定法）：可空标记——真源
      * readModelField 便签 `info.nullable`。None＝无标记（走 builder 缺省规则：Instant 列
      * SQL 天然可空，批④ longOpt 证据 104/104 全中 ⇒ 缺省 Option 化）；Some(false)＝显式
      * 非空（DDL NOT NULL 语义），builder 不包 Option。 */
    nullable: Option[Boolean] = None,
    /** EP_GenerationTime_Code_Anchors P1（用户 2026-09-23 拍板·决策 1「A 本体口径」）：
      * 视图字段的**稳定知识 id**——来自 storyMapping 的 `readModelField` 便签（真源 562/562 全带 id）。
      * 语义：视图字段自己也是知识元素（与同名事件载荷字段是**不同**便签、不同 id）。
      * 有它 + 模板发射 `@param … @knowledge` ⇒ rm 面在图上才有 codeFqn（此前恒 0）。
      * None＝老元数据／便签未铸 id——此时不发射（不编造）。 */
    noteId: Option[String] = None,
    /** 注释发射：字段描述（便签 `description` 透传）——`@param` 正文。 */
    description: String = ""
) extends MetaType

case class ReadModelSchema(
    fields: Seq[ReadModelField],
    identityKeys: Seq[String]
) extends MetaType

case class ProjectionMetadata(
    name: String,
    sourceAggregate: String,
    repositoryRef: Option[MetaRef], // 指向 ProjectionRepository
    handlers: Seq[ProjectionEventHandlerMetadata],
    readModelSchema: Option[ReadModelSchema] = None, // [NEW] 字段级推导 schema；None = 老元数据兼容路径
    // P4 决策支撑：读模型存在的意义 = 帮助角色做决策、下命令（Stage 07 SM10）
    decisionSupport: Seq[CommandRef] = Nil,
    // S1-5 投影收口（2026-08-23）：跨聚合共享视图的完整聚合集（H015/S103 豁免用）。
    // 空 = 单聚合（[sourceAggregate]）兼容老元数据。
    sourceAggregates: Seq[String] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `readModel` 便签 42/42 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None,
    /** Phase 2 债①（2026-10-04）：updateOnly 投影事件集——readModel 便签 `info.updateOnlyEvents`。
      * 语义＝「宁可空跳不可错写」保守修补族：查无行静默跳过（壳发 ViewMachine.updateOnly），
      * kernel 出行签名 (V,E)=>V。空＝全 create 形（getOrElse emptyRow）。 */
    updateOnlyEvents: Seq[String] = Nil,
    /** Phase 2 债①：identity 方案——readModel 便签 `info.identityScheme`。
      * None（缺省）＝事件载荷 identityKeys（schema.isKey 推导）；Some("persistenceId")＝
      * envelope.persistenceId 尾段寻址（entityId 不在事件载荷·Park 族），壳闭包传参、
      * kernel 出 (E, String)=>V 签名＋emptyRow(entityId, tenantId) 参数化空行。 */
    identityScheme: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.projection"

  /** 视图有效聚合集：sourceAggregates 非空用它，否则回退单聚合 */
  def effectiveAggregates: Seq[String] =
    if (sourceAggregates.nonEmpty) sourceAggregates else Seq(sourceAggregate)
}

case class ProjectionEventHandlerMetadata(
    name: String,
    eventName: String,
    logic: BusinessLogic
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.projection.handlers"

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"$metaCategory.$name"
  )
}

sealed trait StorageConfigMetadata extends MetaType

case class TableMetadata(
    tableName: String,
    columns: Seq[ColumnMetadata],
    description: String = ""
) extends StorageConfigMetadata

case class ColumnMetadata(
    name: String,
    dataType: String,
    isPrimaryKey: Boolean = false
) extends MetaType

// [NEW] 异构读模型 sink 变体：ES 索引 / Redis key（TableMetadata 原封不动）
case class EsIndexMetadata(
    indexName: String,
    numberOfShards: Int = 1,
    numberOfReplicas: Int = 0,
    description: String = ""
) extends StorageConfigMetadata

case class RedisKeyMetadata(
    keyPattern: String,
    ttlSeconds: Option[Int] = None,
    description: String = ""
) extends StorageConfigMetadata

// [NEW M3 向量读模型] 嵌入服务声明：投影内同步嵌入（体验批拍板 2026-09-07）
case class EmbeddingConfigMetadata(
    model: String,           // 如 "bge-m3"（中英双语·1024 维）
    endpoint: String,        // 如 "http://localhost:11434/api/embed"
    timeoutMs: Int = 10000
) extends MetaType

// [NEW M3 向量读模型] pgvector 存储模型定义（真源 stage 9 便签 info.storage.kind=vector 装配而来）：
// 列含 embedding 向量列（dims 维·HNSW 索引·cosine 距离），嵌入文本列（embedText）为审计可复现列。
case class PgVectorTableMetadata(
    tableName: String,
    columns: Seq[ColumnMetadata],
    embeddingColumn: String,
    dims: Int,
    indexType: String = "hnsw",       // hnsw | ivfflat
    distance: String = "cosine",      // cosine | l2 | inner_product
    embedding: EmbeddingConfigMetadata,
    description: String = ""
) extends StorageConfigMetadata

// [NEW M3 定义先行→S2-65 转正] Neo4j 图存储模型定义（真源 stage 9 便签 info.storage.kind=graph 装配而来）：
// 每节点 label 一张图 readModel 卡（对齐手写件 GraphEventProjector 的 8 流结构）；keySpace＝键空间前缀
// kn(知识资产)|ws(工作坊过程·Note/Question)，生成 Impl 内 s"$keySpace:${key}" 拼接（FqnBuilder 同语义）。
// 节点/边映射结构对齐手写件 DomainEventGraphMappings 语义（迁移后该件退役）。
case class Neo4jGraphMetadata(
    nodeLabel: String,
    nodeKey: String,
    keySpace: String = "kn",          // kn | ws
    nodeProps: Seq[String] = Nil,
    edgeMappings: Seq[GraphEdgeMappingMetadata] = Nil,
    description: String = ""
) extends StorageConfigMetadata

// [视图存储重设计 2026-10-08] Mongo 文档读模型（knowledgePatch 试点）：storage.kind=mongo 声明装配而来。
// 场景裁决：文档形整取视图（TEXT 列 JSON blob 同病族）切 Mongo——schema 演进免疫（guards 型事故）·
// 与 journal 同库·offset 仍留 MySQL（JdbcProjection 语义不动）。
// [Phase 3·6合1 2026-10-09] kindValue 非空＝同 collection 多视图共存的 kind 判别式启用：
//   写侧文档注 kind 字段·键判等换 _id 复合（"kindValue:自然键"）·读路径 kind 过滤。缺省 ""＝legacy 单视图形逐字节不变。
case class MongoDocumentMetadata(
    collection: String,
    keyField: String,               // 自然键（如 patchId）——replaceOne(upsert) 判等
    kindValue: String = "",         // kind 判别值（显式声明才启用——推导会翻已切族行为）
    description: String = ""
) extends StorageConfigMetadata

// toKeyId/toKeySpace 缺省空＝继承对端卡的 nodeKey/keySpace（批B 装配侧解析）；显式声明用于
// LINKS 类端点键偏离对端卡形状的场景（Note 卡：from 端点键＝externalId·to 端点键＝name）。
case class GraphEdgeMappingMetadata(
    edgeType: String,
    fromLabel: String,
    toLabel: String,
    relationKey: String,
    toKeyId: String = "",
    toKeySpace: String = "",
    description: String = ""
) extends MetaType

sealed trait RepositoryMetadata extends DomainDrivenMetadata {
  def storage: Option[StorageConfigMetadata]

  def methods: Seq[RepositoryMethod]
}

// [UPDATED] aggregateRoot 改为 aggregate (Ref)
case class AggregateRepositoryMetadata(
    name: String,
    aggregate: AggregateRef, // [CHANGED] 使用引用，而非嵌套对象
    methods: Seq[RepositoryMethod],
    storage: Option[StorageConfigMetadata] = None
) extends RepositoryMetadata {
  override val metaCategory: String = "application.aggregates.repository"
}

case class ProjectionRepositoryMetadata(
    name: String,
    storageConfig: StorageConfigMetadata,
    methods: Seq[RepositoryMethod]
) extends RepositoryMetadata {
  override val metaCategory: String = "application.projection.repository"

  override def storage: Option[StorageConfigMetadata] = Some(storageConfig)
}

sealed trait RepositoryMethod extends DomainDrivenMetadata {
  def parameters: Seq[ParameterMetadata]

  def logic: BusinessLogic
}

case class UpsertMethod(
    name: String,
    parameters: Seq[ParameterMetadata],
    logic: BusinessLogic
) extends RepositoryMethod {
  override val metaCategory: String = "Repo.Upsert"

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"$metaCategory.$name"
  )
}

case class QueryMethod(
    name: String,
    parameters: Seq[ParameterMetadata],
    returnType: DataType,
    logic: BusinessLogic
) extends RepositoryMethod {
  override val metaCategory: String = "Repo.Query"

  override def fullQualifiedName: FullQualifiedName = FullQualifiedName(
    s"$metaCategory.$name"
  )
}

// ==========================================
// 5. 接口层
// ==========================================

case class ControllerMetadata(
    name: String,
    basePath: String,
    description: String,
    dependencies: Seq[DataType],
    endpoints: Seq[EndpointMetadata]
) extends DomainDrivenMetadata {
  override val metaCategory: String = "controllers"
}

case class EndpointMetadata(
    method: String,
    path: String,
    actionName: String,
    parameters: Seq[ParameterMetadata],
    requestBody: Option[DataType],
    responseType: DataType,
    logic: BusinessLogic,
    gate: Option[GateRef] = None,              // 门引用——R5 发射分派轴（api.<gate>.write/read）
    serves: Option[EndpointTarget] = None,     // 端点服务目标（命令直发 vs Flow 委托）
    errorPayloads: Seq[ErrorPayloadSpec] = Nil // 409 类附加载荷声明（R5 conflict 工厂发射源）
) extends MetaType

// ==========================================
// 6. Lifecycle (Stateful & Biological Metadata)
// ==========================================

// 强类型的生命阶段引用
case class LifecycleStateRef(targetName: String) extends MetaRef
case class LifecycleRef(targetName: String) extends MetaRef

case class FiniteDurationMetadata(length: Long, unit: String) extends MetaType

// 外部副作用（对外部世界的影响，重要语义被保留且更加精简）
case class SideEffect(
    name: String,
    description: String,
    invokes: Seq[MetaRef] = Nil,
    logic: BusinessLogic
) extends MetaType

// 代数数据类型 (ADT)：强类型且语义清晰的流转意图
sealed trait TransitionTo extends MetaType
case class Goto(targetState: LifecycleStateRef) extends TransitionTo
case object Stay extends TransitionTo  // 保持当前阶段，继续蛰伏
case object Stop extends TransitionTo  // 生命周期终结 (原 targetState = None)

// 行为：一次完整的“刺激 -> 反应”信息流
case class Behavior(
    trigger: DataType,                   // 1. 刺激 (外界输入的 Command 或 超时机制)
    logic: BusinessLogic,                // 2. 思考 (处理意图、内化断言 Invariants、内部步骤)
    yields: Seq[EventRef] = Nil,         // 3. 记忆 (产生并落盘的领域事件)
    sideEffects: Seq[SideEffect] = Nil,  // 4. 动作 (对外部世界产生的副作用，不可或缺)
    transitionsTo: TransitionTo,         // 5. 变迁 (最终流向的下一个生命形态)
    repliesWith: Option[DataType] = None // 6. 答复 (可选的同步响应)
) extends MetaType

// 生命周期阶段：将状态枚举与该状态下的行为深度内聚
case class LifecycleState(
    name: String,
    description: String = "",
    when: Seq[Behavior] = Nil,                  // 处于该阶段时的所有反应动作
    onEnter: Option[SideEffect] = None,         // 进入该阶段时的本能副作用
    timeout: Option[FiniteDurationMetadata] = None,
    onTimeout: Option[Behavior] = None          // 超时作为一种特殊的刺激反应
) extends MetaType {
    def stateRef: LifecycleStateRef = LifecycleStateRef(name)
}

// 完整的生命周期元数据 (取代 PersistentFSMMetadata)
case class LifecycleMetadata(
    name: String,
    stateDataType: ValueObjectRef,        // 内部状态的数据载体 (DNA/细胞记忆)
    initialStage: LifecycleStateRef,      // 诞生的初始阶段 (强类型引用)
    initialDataLogic: BusinessLogic,      // 诞生时的初始化组装逻辑
    stages: Seq[LifecycleState],          // 所有的生命周期阶段 (内聚了状态与行为)
    commandFamily: CommandFamilyRef,
    eventFamily: EventFamilyRef,
    persistenceIdPattern: String,
    description: String = ""
) extends DomainDrivenMetadata {
    override val metaCategory: String = "application.lifecycle"
}

// ==========================================
// 7. 系统注册表
// ==========================================
case class SystemMetadata(
    name: String,
    contextName: Option[String] = None,
    domain: DomainLayer,
    application: ApplicationLayer,
    infrastructure: InfrastructureLayer,
    interfaces: InterfaceLayer,
    storyboard: StoryboardMetadata = StoryboardMetadata(),
    externalSystems: Seq[ExternalSystemMetadata] = Nil,
    timers: Seq[TimerMetadata] = Nil
) extends MetaType

case class DomainLayer(
    valueObjects: Seq[ValueObjectMetadata] = Nil,
    behaviors: Seq[EntityBehaviorMetadata],
    entities: Seq[DomainEntityMetadata],
    services: Seq[DomainServiceMetadata],
    invariants: Seq[InvariantRuleMetadata],
    policies: Seq[PolicyMetadata] = Nil
) extends MetaType

case class ApplicationLayer(
    valueObjects: Seq[ValueObjectMetadata] = Nil,
    behaviors: Seq[AggregateBehaviorMetadata],
    aggregates: Seq[AggregateRootMetadata],
    services: Seq[ApplicationServiceMetadata],
    queries: Seq[QueryServiceMetadata],
    sagas: Seq[SagaTransactorMetadata],
    repositories: Seq[RepositoryMetadata],
    lifecycles: Seq[LifecycleMetadata] = Nil,
    useCases: Seq[UseCaseMetadata] = Nil,   // S2-21 v2：用例一等实体——缺省空，老系统零改动
    gates: Seq[GateDefinition] = Nil,       // v2.1：门词表声明——应用自定义（D6：名字即域根名）
    viewKeys: Seq[ViewKeyDefinition] = Nil, // S2-40 R6：读侧视图注册表——ServesView 引用合法性＝已注册（H052 查表·平行 gates 先例）
    connectors: Seq[ConnectorMetadata] = Nil // 2026-09-20 EP_Improvement_Engine：调外部工具的 Connector 能力面
) extends MetaType

case class InfrastructureLayer(
    valueObjects: Seq[ValueObjectMetadata] = Nil,
    repositories: Seq[RepositoryMetadata],
    projections: Seq[ProjectionMetadata],
    connectors: Seq[ConnectorImplMetadata] = Nil,      // Connector 生成 impl（注入手写基建）
    handwritten: Seq[HandwrittenInfraMetadata] = Nil    // 手写基建类登记（只作依赖目标·不写盘）
) extends MetaType

case class InterfaceLayer(
    valueObjects: Seq[ValueObjectMetadata] = Nil,
    controllers: Seq[ControllerMetadata]
) extends MetaType

// ==========================================
// 8. 故事板（workshop 层：user story / user role —— 工作坊全周期线 P2）
// 不归属任何运行时层：它们是计划性元素，描述「谁、为了什么、经由哪些元素」的切片。
// ==========================================
case class StoryboardMetadata(
    roles: Seq[UserRoleMetadata] = Nil,
    stories: Seq[UserStoryMetadata] = Nil
) extends MetaType

case class UserRoleMetadata(
    name: String,
    description: String = "",
    triggers: Seq[CommandRef] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `role` 便签 35/35 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "userRole"
}

/** 故事切片：本故事经由的元素引用（command / event / readModel 三类） */
case class UserStorySliceMetadata(
    commands: Seq[CommandRef] = Nil,
    events: Seq[EventRef] = Nil,
    readModels: Seq[ProjectionRef] = Nil
) extends MetaType

case class UserStoryMetadata(
    name: String,
    role: UserRoleRef,
    goal: String,
    soThat: String = "",
    acceptanceCriteria: Seq[String] = Nil,
    slices: UserStorySliceMetadata = UserStorySliceMetadata(),
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `story` 便签 115/115 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "userStory"
}

// ==========================================
// 9. 工作坊因果链元素（workshop 层：一致性 / externalSystem / timer —— 工作坊全周期线 P4）
// 命令风暴阶段的「谁触发了这个事件」一等触发源（Stage 02 词汇落点）。
// ==========================================

/** 因果链一致性：strong = 同事务（实线）；eventual = 异步/最终一致（虚线） */
sealed trait Consistency

case object Strong extends Consistency

case object Eventual extends Consistency

/** event→event 因果触发（Stage 02 规则：必须显式标注一致性） */
case class EventCausalRef(event: EventRef, consistency: Consistency)

/** externalSystem→event 触发（缺省 eventual；同步触发可标 Strong） */
case class ExternalTriggerRef(event: EventRef, consistency: Consistency = Eventual)

/** 外部系统 contract（Stage 06 RF7：每个 externalSystem ≥1 contract；报告级清单的数据来源） */
case class ExternalContractMetadata(name: String, protocol: String, sync: Boolean)

case class ExternalSystemMetadata(
    name: String,
    description: String = "",
    contracts: Seq[ExternalContractMetadata] = Nil,
    triggers: Seq[ExternalTriggerRef] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `externalSystem` 便签 5/5 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "externalSystem"
}

/** Connector 方法（应用能力面）——一个 Connector 通常一个方法（对应一个 Function）。
  * 类型用**字符串名**承载（returnTypeName/paramName），由 Builder 经 TypeResolverDSL 解析成 TypeRef——
  * 与 Repository 的 method 模型同律（模型层不做类型解析）。 */
case class ConnectorMethodMetadata(
    name: String,
    returnTypeName: String,              // 手写 case class 名（如 GateRunResult）
    intent: String = "",
    script: Option[String] = None,       // 机制真源给的默认脚本（生成物缺省实参）
    scriptParam: Option[String] = None,  // 有＝该方法收一个 String 脚本参数
    anchoredTo: Option[String] = None    // 真源自然键（aggregate:GateKbLint）——注释用
)

/** Connector（应用层）：调外部工具的**能力声明**。与 Repository 同构——
  * trait 在 application 层（@ImplementedBy），子进程机械在 infrastructure impl 里（注入手写 runner）。
  * 2026-09-20 EP_Improvement_Engine：Scala 服务调 Node 工具链（Option A）。 */
case class ConnectorMetadata(
    name: String,
    description: String = "",
    kind: String = "read",               // read（连接器只读纪律）
    methods: Seq[ConnectorMethodMetadata] = Nil,
    entryTemplate: Option[String] = None,
    timeoutMs: Option[Int] = None,
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "application.connectors"
}

/** Connector 实现（基础设施层）：生成类，注入手写基建（如 NodeSubprocessRunner）。 */
case class ConnectorImplMetadata(
    name: String,
    connectorName: String,
    helperNames: Seq[String] = Nil,      // 手写基建类名（Builder 经 TypeResolver 解析成 TypeRef）
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "infrastructure.connectors"
}

/** 手写基建类提升为可引用类型（不产生写盘的生成物——只作依赖目标）。 */
case class HandwrittenInfraMetadata(
    name: String,
    description: String = "",
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "infrastructure.handwritten"
}

/** 定时器触发源（schedule/排程细节不在本 EP——只建模触发边） */
case class TimerMetadata(
    name: String,
    description: String = "",    triggers: Seq[EventRef] = Nil,
    /** 2026-09-23 EP_GenerationTime_Code_Anchors S0（裁决 4）：容器级知识 id。
      * 真源 `timer` 便签 4/4 全带 id；此前未 override ⇒ 该 id 到不了 IR/台账。
      * 透传后生成期可直接给出**关系端点**（态射分类的另一头）——见 MorphismEndpoint。 */
    override val noteId: Option[String] = None
) extends DomainDrivenMetadata {
  override val metaCategory: String = "timer"
}

case class ImplementationConfig(
    protoConfig: Option[ProtoConfig] = None,
    bootstrapStrategy: Option[BootstrapStrategy] = None,
    diStrategy: Option[DIStrategy] = None
) extends MetaType

case class ProtoConfig(
    fileName: String,
    javaPackage: Option[String] = None,
    javaOuterClass: Option[String] = None,
    imports: Seq[String] = Nil
) extends MetaType

sealed trait BootstrapStrategy extends MetaType

case object NoBootstrap extends BootstrapStrategy

case class AkkaShardingBootstrap(shardingTagName: String, shards: Int = 5)
    extends BootstrapStrategy

sealed trait DIStrategy extends MetaType

case object GuiceModule extends DIStrategy

case class TestSuiteMetadata(
    name: String,
    target: DataType,
    description: String = "",
    cases: Seq[TestCaseMetadata]
) extends MetaType

sealed trait TestCaseMetadata extends DomainDrivenMetadata {
  def description: String

  override val metaCategory: String = "test.case"
}

case class UnitTestCase(
    name: String,
    description: String,
    inputs: Map[String, String],
    assertions: Seq[Assertion]
) extends TestCaseMetadata

sealed trait MockInteraction extends MetaType

case class MockReply(whenReceived: String, replyWith: String)
    extends MockInteraction

case class BehaviorTestCase(
    name: String,
    description: String,
    initialState: Option[String],
    initialStateModifications: Map[String, String] = Map.empty,
    input: String,
    mockBehaviors: Seq[MockInteraction] = Nil,
    expectedEvents: Seq[String] = Nil,
    expectedState: Option[String] = None,
    expectedError: Option[String] = None
) extends TestCaseMetadata

sealed trait Assertion extends MetaType

case class ReturnEquals(expectedCode: String) extends Assertion

case class ReturnSome(innerValueCheck: String) extends Assertion

case object ReturnNone extends Assertion

case class ReturnLeft(errorCode: String) extends Assertion

case class ReturnRight(contentCheck: Option[String] = None) extends Assertion

// ==========================================
// 11. 用例层（S2-21 表达方案 v2——故事/用例双轨制；设计真源 knowledge_base/design_docs/usecase_metadata_design.md）
// ==========================================

/** 门定义——应用在元数据里声明自己的门词表（每应用不同；引擎严格的是两个语义维度布尔）。
 *  v2.1 裁定：tier 名降为应用声明数据（用户「每个应用可能不同」关切），密封轴上移到语义维度；
 *  生成器分派按门表注册数据驱动（H053：引用未注册门／推导不可判即红）。D6 约定：名字即域根名（api.<name> 零映射直发）。 */
case class GateDefinition(
    name: String,                 // 应用自定义，如 metarch 的 anonymous/global/tenant
    requiresIdentity: Boolean,    // 是否承诺已登录身份
    requiresTenant: Boolean,      // 是否承诺租户上下文
    description: String = ""
) extends DomainDrivenMetadata {
  require(name.nonEmpty, "gate name required")
  require(!(!requiresIdentity && requiresTenant), s"gate [$name]: 无身份却有租户承诺——语义自相矛盾")
  override val metaCategory: String = "application.gates"
}

/** 门引用——合法性＝已在本应用门表注册（ApplicationLayer.gates，H053 校验） */
final case class GateRef(value: String) extends MetaType {
  require(value.nonEmpty, "gate ref required")
}

/** 视图键定义——应用在元数据里声明自己的读侧视图注册表（S2-40 R6；node ViewKeys/ViewModel 的元数据化，
  * 平行 gates 先例）。字段＝node 侧实际消费属性：key（CommandRoleMap.of(vk) 索引＋ViewKeys 常量派生源）、
  * repoParam/viewName（查询注入源与行类型——Scala 侧收敛为投影仓库 ref，行类型＝投影 DTO Table 嵌套位）、
  * singleKey（item 端点形态）；node 的 hasTenant/isGlobal 语义由端点 gate 承载（R4/R5 门轴分派·api.<gate>.read，
  * 声明驱动升级同 tierOf 先例），list/item 形态由端点签名承载（(page,pageSize)＝分页列表／(entityId)＝单行——
  * node 一视图两端点映射保持）。H052：ServesView 引用未注册 viewKey → ERROR。 */
case class ViewKeyDefinition(
    name: String,                         // viewKey 语义串（如 "monthly-income-expense-summaries"）——ServesView 引用/H052 查表/CommandRoleMap.of(vk) 索引
    repository: ProjectionRepositoryRef,  // 查询注入源（投影仓库——node XxxDecisionViewRepository 同位·findAll/findByIdentity 契约）
    singleKey: Boolean = true,            // 单键视图（item by entityId；false＝复合键——item 端点 400 PARAM_INVALID 刻意契约·node singleKey）
    description: String = ""
) extends DomainDrivenMetadata {
  require(name.nonEmpty, "view key required")
  override val metaCategory: String = "application.viewKeys"
}

/** 端点服务目标：命令（DSL 直发）或用例实例（Flow 委托）。密封轴——serves 是生成器第二分派轴。 */
sealed trait EndpointTarget extends MetaType
object EndpointTarget {
  case class ServesCommand(command: String) extends EndpointTarget
  case class ServesUseCase(useCase: String) extends EndpointTarget
  // S2-40 R6：读侧——端点服务读视图（ViewApiController 单行端点族的声明源；viewKey 合法性＝ApplicationLayer.viewKeys 注册）
  case class ServesView(viewKey: String) extends EndpointTarget
}

/** 409 类附加载荷声明（载荷字段名, 来源路径）；查重条件由既有 invariant 体系承载（errorCode 关联），此处只声明形状。 */
case class ErrorPayloadSpec(errorCode: String, payloadFields: Seq[(String, String)]) extends MetaType

/** 寻址来源（S2-21 词表）。密封轴——寻址分派决定 entityRef 表达式形状（Lane A N1/N2 判定表的 IR 落位）。 */
sealed trait IdSource extends MetaType
object IdSource {
  case object Generated extends IdSource // 服务端发号（工厂型）
  case object FromEntry extends IdSource // 入口携带（路径段/body 契约）
  case object Context extends IdSource   // 上下文提供（宿主对象键）
}

/** 失败语义三值（S2-21 soft 布尔升级）。密封轴——Flow 生成按此分派步间控制流。 */
sealed trait OnFailure extends MetaType
object OnFailure {
  case object Abort extends OnFailure  // 终止且状态不推进
  case object Soft extends OnFailure   // 失败不阻断继续
  case object Resume extends OnFailure // 幂等续跑：复用已存在产物继续
}

/** 写入种类——生成器分派轴：聚合命令走 ask，副作用直调（如身份库双写）。 */
sealed trait WriteKind extends MetaType
object WriteKind {
  case object AggregateCommand extends WriteKind
  case object SideEffect       extends WriteKind
}

/** 组合写步骤内的单命令。targetAggregate/idSource 必需（信息量完整性——缺失即建模漏洞，投影时由真源 links/fieldOrigin 推导填充）；
 *  副作用步的 targetAggregate＝副作用宿主名（如 IdentityStore）。 */
case class CommandStep(
    command: String,
    targetAggregate: String,
    idSource: IdSource,
    kind: WriteKind = WriteKind.AggregateCommand,
    onFailure: OnFailure = OnFailure.Abort
) extends MetaType {
  require(command.nonEmpty, "command reference required")
  require(targetAggregate.nonEmpty, s"command [$command] requires write target")
}

/** 用例主流程步骤：kind 三分＝技术无关关键——交互步归前端领地、组合写步归后端领地。密封轴。 */
sealed trait FlowStep extends MetaType {
  def step: Int
  def text: String
}
object FlowStep {
  case class Interaction(step: Int, text: String) extends FlowStep
  case class Validation(step: Int, text: String, rules: Seq[String] = Nil) extends FlowStep
  case class ComposedWrite(
      step: Int,
      text: String,
      commands: Seq[CommandStep],
      idempotency: Option[String] = None,
      publishes: Seq[String] = Nil
  ) extends FlowStep
}

/** 扩展流：错误码/分支的规格来源（文档级，不驱动生成器分派——故字段用 Option 而非密封）。 */
case class FlowExtension(
    atStep: Int,
    condition: String,
    response: String,
    stateEffect: Option[String] = None,
    gotoPoint: Option[String] = None,
    onFailure: Option[OnFailure] = None
) extends MetaType

/** 用例＝行为规格（完整对话协议）。稀有实体：仅「步骤序本身承载语义」的完整组合流配用例。
 *  realizes 兑现语义（机器可对账）：所引故事的每条验收标准至少被一条基本流/扩展流覆盖。 */
case class UseCaseMetadata(
    name: String,
    mainFlow: Seq[FlowStep],
    actors: Seq[String] = Nil,
    trigger: String = "",
    preconditions: Seq[String] = Nil,
    postconditions: Seq[String] = Nil,
    realizes: Seq[String] = Nil,
    extensions: Seq[FlowExtension] = Nil,
    generatedIds: Seq[String] = Nil,      // 推导摘要——H 校验与 ComposedWrite commands idSource=Generated 一致
    optionalInputs: Seq[String] = Nil,
    flowRef: Option[String] = None,       // 实现对账锚点＝代码侧字段（真源永不表达）
    // S2-32 R5c（P5·形态 3 深化——node register 硬编码四件的元数据化承接，R4 同款纪律：默认值零存量改动）：
    // Flow 委托服务方法名（None＝D3 约定默认 "register"）＋方法消费的 body 字段有序清单（空＝整体 body 递交）。
    flowMethod: Option[String] = None,
    flowArgs: Seq[String] = Nil
) extends DomainDrivenMetadata {
  require(name.nonEmpty, "use case name required")
  require(mainFlow.nonEmpty, s"use case [$name] main flow required")
  private val nos = mainFlow.map(_.step)
  require(nos.distinct.size == nos.size && nos == nos.sorted,
    s"use case [$name] steps must be uniquely numbered and ordered")
  override val metaCategory: String = "application.useCases"
}
