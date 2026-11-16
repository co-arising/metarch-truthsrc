# bootstrap：四变体内容级差异规格

## 1. 范围、证据状态与输出集合

- artifact id / group：`bootstrap`，清单 ordinal `38`。状态：**decision-required**。其中 classic Saga coordinator / transactor 的已检查 JS 路由没有对应 renderer，子状态为 **missing-counterpart**；不以别的 Saga host 冒充。
- 基准：BC `cc335eb1e0d0fae17bf092fd61b126040196ea70`；JS `bf104e16ab82ef39d7fa416d0997907d18a815ad`。实际内容身份以 [baseline/index.json](../baseline/index.json) 的完整副本、bytes、SHA-256 为准，不以 HEAD 替代工作树字节。
- 本文是源码内容检视和第二阶段实施输入，不是生成、编译、运行或恢复验证。**没有新鲜同输入 raw-scala / actual-js 产物对**；下文所有跨链比较均是结构性对照，不能读成字节 parity、behavior PASS 或已可执行。
- 首次检查和写前检查两个分配文件均不存在。本次仅创建本文与 `details/bootstrap.json`；不动先前 diff、baseline、生产源码、银行生成物、catalog、ledger、anchors。没有真源批次变更，因此不运行 validate / roundtrip。
- `ApplicationBootstrapTemplate` 是独立 artifact `application-bootstrap`，本项只登记其调用依赖，不接管其文件、DI module、Play loader 或全局装配。

### 1.1 四种证据不得混签

|视图|可取得的完整源|本文用途和限制|
|---|---|---|
|raw-scala|[Model 全文][M]、[Builder 全文][B]、[Template 全文][T]；下文逐字段、逐分支、逐 construct / RHS 账|真正传统 MBT。不是新执行结果。`bootstsrap` 是源码真实目录拼写。|
|approved-target|[布局标准](../layout-and-style.md#2-唯一布局规则)叠加 raw 的已批准命名、imports、三层布局与协议要求|这里只固定可确定内容；PID / 工厂 / classic Saga JAR 等 D1–D8 未裁定时，不制造完整银行目标文件。|
|actual-js|[CreditBalance 完整文件][AC]、[FundOrder 完整文件][AF]、[SipPlan 完整文件][AS]，以及完整 [formal 模板][JT]|银行已存在输出，非本次生成。文件头写 `scala-cqrs-domain:1` 不足以定位 producer，须按真实调用链。|
|curated reference|[CreditBalance][CC]、[coordinator][CS]、[transactor][CT]、[projection][CP]|人工完成参考，不是本次模板执行；其特殊成员名、Id 转换时点、imports 不能偷偷当作 raw。|

核心固定文件指纹（其余引用的完整 bytes / SHA 在 index 对应行）如下。本次对这些 MBT / bootstrap 输出副本做了只读 SHA 和长度对账；它仅证明内容身份。

|固定文件|bytes|SHA-256|
|---|---:|---|
|`bc/.../model/infrastructure/bootstrap/BootstrapModel.scala`|3031|`cc00cdae4801c8d27113c104783982c96aa4d8fe30edd2279f0f3c056bb987a9`|
|`bc/.../builder/infrastructure/bootstrap/BootstrapBuilder.scala`|9064|`b5dbe31a3da1810e19d2110adc64174bed012da69bce86ad5822424f5df3dd63`|
|`bc/.../template/infrastructure/bootstsrap/BootstrapTemplate.scala`|8930|`951a9cfd7813b6b543af515d575fa0d7b954daa9ed3b422d4f78c45f07818b5d`|
|`js/.../scala-cqrs-play-service/templates/aggregate-bootstrap.mjs`|1700|`7c3b647b303d490bde72df7075b8b2395baa5565a8dda23fc30d81e7f6fa1d8b`|
|`js/.../scala-cqrs-aggregate-core-v1/templates/bootstrap.mjs`|1949|`5e1203a55e5805219d90e8afb487fdb44c91f70ac02996ffd3bc0d1407c96a07`|
|`actual-js/.../CreditBalanceBootstrap.scala`|1452|`0a9dc87cc320e752c2470a19b195996b515334f92f89339e744c8287731b8d87`|
|`actual-js/.../FundOrderBootstrap.scala`|1448|`7e9c460edb64883eda74c3fc007a3eb34ec8b3015203ddb1820449aa3ac41d32`|
|`actual-js/.../SipPlanBootstrap.scala`|1362|`f754a09416c1978e25d074dcfebf031a4777920c0a676fff77e3986d7b531b97`|

### 1.2 真实调度、基数和物理路径

[CodegenMain.run:175–242][MAIN] 先准备输入、复制 scaffold，然后进入 `CQRSApplicationGenerator.generate`；[runCommon:203–220][DISPATCH] 在 domain / application / infrastructure / interfaces 之后调用 `generateBootstraps`。本项的准确循环在 [1134–1186][CALL]，不是 `generateProducts` 支路。

令 `A = system.application.aggregates.size`、`S = system.application.sagas.size`、`P = system.infrastructure.projections.size`。在输入有效且写入未失败的前提下，**尝试生成数**为 `A + (S > 0 ? 1 : 0) + S + P`；不含 global ApplicationBootstrap。名字碰撞、`.get` 失败或写盘门不能被忽略为“必有此文件”。

|variant|调度 / enabled / suppressed|raw 类型名与完整输出路径模式|本次观测|
|---|---|---|---|
|aggregate|每个 aggregate 一次；A=0 时无文件|`app/<base-path>/infrastructure/bootstrap/<getAggregateBaseName(meta.name)>Bootstrap.scala`|actual-js 固定三文件为 `app/example/bankwealth/infrastructure/bootstrap/{CreditBalance,FundOrder,SipPlan}Bootstrap.scala`，但内容是 local factory object，不是 BC sharding trait。|
|saga-coordinator|仅 `S > 0`，全系统一次，不是每个 saga 一次|`app/<base-path>/infrastructure/bootstrap/SagaTransactionCoordinatorBootstrap.scala`|raw / curated 有源码；此 baseline 中没有银行 classic 同款输出。missing-counterpart，不推断银行应启用 classic。|
|saga-transactor|每个 classic saga 一次；S=0 抑制|`app/<base-path>/infrastructure/bootstrap/<meta.name>Bootstrap.scala`|raw / curated 有；formal / family 的已检查 aggregate bootstrap 不生成此变体。|
|projection|每个 projection 一次；P=0 抑制。内部还有 single 与 filtered-multi 两分支|`app/<base-path>/infrastructure/bootstrap/<removeSuffix(meta.name,"Projection")>Bootstrap.scala`|legacy 有近似 renderer；formal readside 是另一生命周期协议，不能拿它当已接通。|

多模块对应路径是 `modules/glue/src/main/scala/<base-path>/infrastructure/bootstrap/<上述文件名>.scala`。[targetModuleOf / writeArtifact:331–396][WRITER] 对 `kind="bootstrap"` 路由 glue；single 模式的 writer `outputRoot` 已是 `<target>/app`，不能再加一次 app。main 的 `genRoot` 选择见 [232–241][MAIN]。

批准目标仍在 `infrastructure.bootstrap`。业务根只能有 `domain/application/infrastructure`；这里不产生第四层。Factory 依赖应迁至 `application.aggregates.factories`、CommandHelper 至 `application.aggregates.behaviors`、adapter 至 `infrastructure.persistence`。这些是跨 artifact 接口依赖，不授权本项写别人的文件。

## 2. Scala Model：19 个字段、默认值及支撑

[BootstrapModel:1–54][M] 的结构声明如下，保留原字段顺序和全部默认值；省略的只有原注释/排版，完整原字节见固定全文。它没有额外业务方法或嵌套 case class。

```scala
sealed trait BootstrapType
case object AggregateBootstrapType extends BootstrapType
case object SagaCoordinatorBootstrapType extends BootstrapType
case object ProjectionBootstrapType extends BootstrapType
case object SagaTransactorBootstrapType extends BootstrapType

case class BootstrapModel(
  override val selfType: TypeRef,
  bootstrapType: BootstrapType,
  targetName: String,
  commandName: String,
  entityName: Option[String],
  eventHandlerType: Option[TypeRef],
  entityTypeKey: Option[String],
  tags: Option[Seq[String]],
  sagaRepositories: Seq[TypeRef],
  transactorRepo: Option[TypeRef],
  transactorContext: Option[TypeRef],
  transactorContextInit: Option[String],
  projectionRepo: Option[TypeRef],
  sourceAggregateType: Option[TypeRef],
  projectionAggregateTags: Seq[TypeRef] = Nil,
  shards: Int,
  override val dependencies: Set[TypeRef],
  override val noteIds: Seq[String] = Nil,
  emptyStateArg: Option[String] = None
) extends ArtifactModel
```

`Option` 不意味着有构造器默认值：只有上面明确写 `= Nil / None` 的三个字段可省。以下 A/C/S/P 依次指 aggregate / coordinator / transactor / projection。

|序号 / 字段|Builder 赋值和 Template 使用|JS 对应 / 迁移要求|
|---|---|---|
|1 `selfType: TypeRef`|A 用 `aggregateBootstrap(meta)`；C 固定 coordinator resolver；S/P 用 bootstrap(name,pkg)。输出 package 和 trait 名均取这里。|formal 只有 `names.package/bootstrap`；family artifact 有 `package/name/identifier/fqn/path`，可适配成结构，不能让 Template 再猜包。|
|2 `bootstrapType`|四 case object；Template 穷尽 match 分派四 renderer。|formal role 只有 bootstrap 且固定 aggregate；不得用字符串 `Any` 运行时 dispatcher 代替生成时有界变体。|
|3 `targetName`|A 用 `aggregateRootName(getBaseName(meta.name))`；C `SagaTransactionCoordinator`；S/P `meta.name`。C renderer 实际不用此字段。|formal `names.name` 尚不能表达 projection / Saga 目标。|
|4 `commandName`|A=`meta.commandFamily.name`，C=`Command`，S/P=`""`。只有 A 插值 `Protocol.<commandName>`。|formal 固定 application alias `Command`；回复族不是这里补造。|
|5 `entityName`|A=`Some(meta.entityRef.targetName)`；其余 None。Template None 回退 aggName，直接作 `.empty` owner。|formal `initial: State` 由 caller 给，不等于 `Entity.empty`。|
|6 `eventHandlerType`|A 解析 entityEventHandler；其余 None。A `.map(_.name)`，None 回退 `s"$entityName.eventHandler"`，最后仍追加 `.apply`。|formal 有固定 `${name}EventHandler.apply`；目标从类型引用取名。|
|7 `entityTypeKey`|A `Some("entityTypeKey")`，其余 None；A `.get`，拼 `aggName.key`。|formal 无 sharding key；不可把 source rename 反推 persistence ID。|
|8 `tags`|A `Some((0 until shards).map(i => s"$baseName$i"))`；其余 None。**Template 不读此字段**，读 aggregate object 的 `.tags`。|不能仅写该字段就宣称 tag 接通；aggregate-root 必须提供同值 tags。|
|9 `sagaRepositories`|四 Builder 都 Nil；本 Template 不读。|是保留字段，不复活旧 per-repository 注入。|
|10 `transactorRepo`|全部 None；不读。|不凭字段名发 repository。|
|11 `transactorContext`|全部 None；不读。C 的 `context: C` 是模板固定泛型参数，不由此字段填。|不得把此字段误接 C 泛型。|
|12 `transactorContextInit`|全部 None；不读。类型是可选**源码字符串槽**，不是结构化 AST。|保留明确废置槽记录，不合成初始化算法。|
|13 `projectionRepo`|仅 P Some(repoType)；P `.get.name` 用作 `repository` 参数。|formal / family aggregate bootstrap 无此字段。|
|14 `sourceAggregateType`|仅 P Some(sourceAggType)；P `.get.name`，single 分支取其 tags.size。|multi 仍在 branch 之前 `.get`；不能声称 multi 不需要它。|
|15 `projectionAggregateTags = Nil`|P 仅 `sourceAggregates.size > 1` 时计算过滤后的类型序列；其余默认 Nil。决定 multi 与 prefix sums。|legacy 有 `activeGroups/forSources`，但输入规则须对齐。|
|16 `shards: Int`|A 从 ShardedTags 或 fallback 5；C/S/P 固定 5。Template 不读。|不是所有变体都实际生成五实例。|
|17 `dependencies: Set[TypeRef]`|每个 Builder 过滤 `shouldImport(pkg)`；P 再并 aggregateTagDeps。用于 imports 和 writer 的依赖记账。|formal `artifact.dependencies` 是输出路径，不是类型 import 模型；两种依赖应分别保留。|
|18 `noteIds = Nil`|四 Builder 均未赋值，调用处也未 `.copy(noteIds=...)`；由默认保持 Nil。|当前 formal `sources=[aggregate.source]` 不等于 noteIds；统一 provenance owner 决定映射。|
|19 `emptyStateArg = None`|A StringType→`Some("entityId")`，其它→`Some("Id.of(entityId)")`；Template None 也回退后者。其它变体默认 None。|明确 RHS 代码槽；不得由 Identifier 的展示名推断 String / Id。|

支撑合同：

- [ArtifactModel:5–47][AM]：`fqn = selfType.packageName + "." + selfType.name`；`registerTo(registry) = registry.register(this)`；默认 `morphisms = Nil`、`noteIds = Nil`。本子型未覆写 register/morphisms，不存在额外 anchor 成员。
- [TypeRef:4–52][TYPE]：`name/packageName/typeParams=Nil`；FQN 在空包时只返 name；signature 对 TupleN 及泛型递归；`collectAllDependencies` 递归收集自身及 typeParams；`shouldImport` 排除空包、当前包、`scala`、`java.lang`。**BootstrapBuilder 只过滤其显式 Set，未调用 recursive collectAllDependencies**，不能声称该族已有完善递归收集。
- [TypeResolver:19–93][RESOLVE]：CustomType 优先 knownFrameworkTypes（包括递归实参），然后才包名 fallback；`Id` 因此通常是 `frameworkPackage.common.CommonTypes.Id`，不是调用代码写的 `net.imadz.common.Id`。模板还独立加后者（伴生构造对象）。未识别 MetaType 回退 Any；`resolveMetaRef = ???` 是已有未完成槽，不能把解析成功写成既成事实。
- [TypeResolverDSL:318–329,1005–1049][DSL] 固定 bootstrap / projection glue 类型。`stepExecutor` 用 `ctx.rootPackage.infra.saga`，coordinator 的 knownFrameworkTypes 用固定 `net.imadz.infra.saga`；非默认 root 的一致性是 D4。
- [bootstrapNoteIdPatches:1102–1131][PATCHES] 是外侧 Node 回填所需的声明，不是本 Model 已有号。它按 registry 任一同名实例带 noteId 门控，payload 是名字不是号；按路径排序。projection patch 拼 `${meta.name}Bootstrap`，而 Builder 去掉结尾 Projection；这个路径差异必须记录为 D7，不能悄悄照搬或改现有账。

## 3. Builder：完整规则、分支和依赖账

完整原文件 [BootstrapBuilder.scala:1–238][B] 已逐段实读。方法顺序是 `buildAggregate` → `buildSagaCoordinator` → `buildSagaTransactor` → `buildProjection`；不排序输入集合，不进行 I/O，也没有在这四方法中 catch / fallback 成空模型。

### B-A：buildAggregate，15–92

1. 以 resolver 取 selfType。`meta.persistenceConfig.tagging match`：`ShardedTags(b,s)` 使用 `(b,s)`；任何其它 tagging 用 `("tag",5)`。生成 `0 until shards`，每个 tag 是直接拼接 `baseName + i`，不重新编号或补零。
2. 取 aggType；entityName 是 `meta.entityRef.targetName`，然后解析 entityType、eventHandlerType；分别 resolve `behaviorRef` / `stateRef`；解析 event / snapshot adapter；resolve `CustomType("Id","net.imadz.common")`。
3. deps **逐项**为 aggType、aggregateProtocol(meta)、behaviorType、stateType、eventAdapter、snapshotAdapter、entityType、eventHandlerType、idType，以及 known framework 的 `ClusterSharding`、`Entity`、`EntityTypeKey`、`Behaviors`、`PersistenceId`、`LogOptions`、`SupervisorStrategy`、`RetentionCriteria`、`LoggerFactory`、`Level`。按 selfType.packageName 过滤；其它 Template extras 不进入这个 Set。
4. 按 §2 赋全部必填字段，`projectionAggregateTags/noteIds` 默认；targetName 标准化聚合后缀，**不**把 meta.name 当完整 Aggregate 类型名。emptyStateArg 唯一显式分支是 `StringType`，其它名义 Id / 自定义类型都走 `Id.of(entityId)`。
5. 没有 shards 正数或 tags 非空门，模板 `% tags.size` 因此依赖上游保证。没有校验 targetName replace 派生的行为/adapter 名是否等于 resolver 依赖名。`meta.behaviorRef/stateRef` 可影响 imports，却未直接决定模板 commandHandler RHS。上述均作为 raw 限制保留，不能称已纠正。

### B-C：buildSagaCoordinator，94–138

- `sagas: Seq[SagaTransactorMetadata]` 参数在体内未使用；是否生成由外层 `sagas.nonEmpty` 决定，不能在 Builder 内按 saga 数复制 engine。
- `pkg=ctx.layout.infrastructure.bootstrap`；self 固定 coordinatorBootstrap；target / command 固定；全部非适用 Option=None，Seq=Nil，shards=5。
- deps：`net.imadz.infra.saga.SagaTransactionCoordinator`、resolver `stepExecutor`、known `ClusterSharding/Entity/Behavior/PersistenceId/Timeout/ActorSystem`、resolver `extendedActorSystem`、`TypeRef("FiniteDuration","scala.concurrent.duration")`、`TypeRef("ExecutionContext","scala.concurrent")`、`TypeRef("EntityRef","akka.cluster.sharding.typed.scaladsl")`。按 pkg 过滤。
- 不收集 sagaRepositories，不构建每个 saga 的 executor sharding，也不产生 context 默认实例。

### B-S：buildSagaTransactor，140–177

- pkg 直接 `${ctx.basePackage}.infrastructure.bootstrap`；self 用 `bootstrap(s"${meta.name}Bootstrap",pkg)`。
- `baseName = meta.name.replace("SagaTransactor", "")` 是全字符串 replace，而非只移尾缀。definitionType=`<baseName>SagaDefinition`，包 `ctx.layout.application.services.transactor.root`。
- deps 只有 definitionType、`akka.actor.typed.Scheduler`、`scala.concurrent.ExecutionContext`，过滤 pkg。targetName=meta.name，commandName 空串，其余按 §2，shards=5。
- 无 tx repository/context 注入；动作是注册 definition，不创建一次交易，也不回成功业务结果。

### B-P：buildProjection，179–237

1. pkg `${base}.infrastructure.bootstrap`；name 由 `getBootstrapNameFromProjectionName` 去结尾 Projection 再加 Bootstrap；`projObjType=projection(meta.name,application.projection.root)`；`aggPkg` 局部变量声明但未使用。
2. `sourceAggType=aggregateRoot(meta.sourceAggregate)`；`repoType=meta.repositoryRef.map(resolve).get`。None 直接抛出，不是可空依赖。
3. 基本 deps：projObjType、repoType、sourceAggType、`akka.actor.typed.ActorSystem`、ClusterSharding、ShardedDaemonProcess、ShardedDaemonProcessSettings、ProjectionBehavior；过滤 pkg。
4. 仅当 `meta.sourceAggregates.size > 1`：保持原 sourceAggregates 顺序；对每个 aggName，须存在 handler，且 `resolve(EventRef(h.eventName)).fqn.contains(s".${aggName}Entity.")` 才保留；保留者 map aggregateRoot。其它情况 Nil。这是字符串 FQN 归属判据，不是另一次模型身份验证。
5. aggregateTagDeps 由该序列 `.toSet.filter(shouldImport)`；dependencies 为基本 deps 并其结果。sourceAggregateType 仍指 primary source（即使其流已过滤）。Model 设置 repository / sourceAggregate / aggregateTags，shards=5。
6. 两源输入过滤剩一源时仍 nonEmpty→multi（仅一个 For 分支）；过滤全部空时 Nil→**single fallback**，仍引用 primary `.createProjection`。不能据注释“空流退场”宣称 bootstrap 文件也被抑制。D3 必须与 projection artifact 联审，无权这里偷改为 no-op。

## 4. Template：全部输出 construct 和完整 RHS

完整原 Template 见 [1–220][T]。下面以**原模板插值变量**展示完整输出槽，不冒充某个新 fixture 已经生成；`$aggName/$cmdType/...` 是生成器里的真实插值变量，不是待实现的业务函数。头部到结尾、四种 body 与 multi 循环均逐项展开说明。

### T-0：通用 envelope 和 import 顺序，9–70

1. `packageDecl(selfType.packageName).code` 输出 `package <pkg>`。
2. `dependencies.toList.sortBy(_.fqn).map(_.fqn).toSeq.distinct` 形成 baseImports。
3. projection extras 空；transactor extras 顺序为 `akka.actor.typed.Scheduler`、`scala.concurrent.ExecutionContext`；aggregate / coordinator extras 为：
   - `akka.cluster.sharding.typed.scaladsl.EntityContext`
   - `akka.actor.typed.Behavior`
   - `akka.persistence.typed.PersistenceId`
   - `akka.persistence.typed.scaladsl.EventSourcedBehavior`
   - `akka.cluster.sharding.typed.scaladsl.Entity`
   - `scala.concurrent.duration.DurationInt`
   - `net.imadz.common.Id`
4. `imports(baseImports ++ extraImports)` 经 [ImportDeclaration:20–22][IMPORT] **再次全局字符串排序，不去重**。因此 A 的 Entity / PersistenceId、C 的 Behavior / Entity / PersistenceId、S 的 Scheduler / ExecutionContext 会有重复（在默认不同包条件下）；unused Id / EventSourcedBehavior 等也会出现。raw 必须如实展示。approved-target 去重、冲突解析与简名来自 shared import model；不能声称原模板已做。
5. 空行、Javadoc、无父型的 trait、空行、body、空行、闭括号和末尾换行依下列 envelope。四个 raw 输出均无 annotation、self-type、class 主辅构造器、companion、type alias、trait 型参、字段型 val/var/lazy、抽象方法或 overload。C 的泛型/implicit val 在方法内另列。

```scala
${pkgDecl.code}

${finalImports.code}

/**
 * $traitName: ${model.bootstrapType} 引导组件
 */
trait $traitName {

$body

}
```

### 4.1 aggregate 子 diff

#### T-A：完整原 body，72–115

派生局部项严格为：`aggName=model.targetName`；`entityName=model.entityName.getOrElse(aggName)`；eventHandlerName 依 §2；typeKey=`aggName + "." + entityTypeKey.get`；behaviorCall=`aggName.replace("Aggregate","Behaviors") + ".apply"`；eventAdapter=`"new " + aggName.replace("Aggregate","") + "EventAdapter"`；snapshotAdapter 同理；protocolName=`aggName.replace("Aggregate","Protocol")`；cmdType=`protocolName + "." + commandName`。这些 replace 不是类型解析器，必须列在 raw 债中。

```scala
  def init${aggName}(sharding: ClusterSharding): Unit = {
    val behaviorFactory: EntityContext[$cmdType] => Behavior[$cmdType] = { context =>
      val i = math.abs(context.entityId.hashCode % $aggName.tags.size)
      val selectedTag = $aggName.tags(i)
      apply(context.entityId, selectedTag)
    }

    sharding.init(Entity($typeKey)(behaviorFactory))
  }

  private def apply(entityId: String, tag: String): Behavior[$cmdType] =
    Behaviors.logMessages(LogOptions().withLogger(LoggerFactory.getLogger("iMadz")).withLevel(Level.INFO),
      Behaviors.setup { actorContext =>
        EventSourcedBehavior(
          persistenceId = PersistenceId($typeKey.name, entityId),
          emptyState = $entityName.empty(${model.emptyStateArg.getOrElse("Id.of(entityId)")}),
          commandHandler = $behaviorCall,
          // [FIX] 使用 EventHandler.apply
          eventHandler = $eventHandlerName.apply
        ).withTagger(_ => Set(tag))
          .withRetention(RetentionCriteria.snapshotEvery(numberOfEvents = 100, keepNSnapshots = 3))
          .onPersistFailure(SupervisorStrategy.restartWithBackoff(200.millis, 5.seconds, 0.1).withStashCapacity(100))
          .eventAdapter($eventAdapter)
          .snapshotAdapter($snapshotAdapter)
      })
```

|construct id / 原位置|RHS、求值和副作用顺序|目标 / JS 差距|
|---|---|---|
|A01 / T89–97 `init<Aggregate>`|先定义 factory 函数（未在此直接执行），再 `sharding.init(Entity(typeKey)(behaviorFactory))`；结果丢弃成 Unit。|formal 是 object factory，不执行 ClusterSharding.init。不可等称。|
|A02 / T90–94 factory locals|按实体 ID hash `% tags.size` 后 abs；取 selectedTag；再调用私有 apply。`i` 是索引，不是随意编号的 state 临时值。|恢复此算法须 tag 集合及实体归属合同；禁止变 tag 顺序或 PID。|
|A03 / T99–113 private apply|两 String 参数，返回 Behavior[应用 command family]；无 implicit 参数。logMessages INFO / logger iMadz 包 setup；actorContext 未用。|不是 domain 方法；日志、重试、快照策略不能以“美化”删掉。|
|A04 / T102–108 EventSourcedBehavior|named args 固定顺序 PID → emptyState → commandHandler → eventHandler；Id/String RHS 分支见 Model。|formal 是 ofUniqueId + caller initial + aggregate.commandHandler(hosts[,authority])。D1 / D2。|
|A05 / T108–112 链|tagger → snapshotEvery(100,3) → restartWithBackoff(200.millis,5.seconds,0.1).withStashCapacity(100) → new eventAdapter → new snapshotAdapter。|formal 仅 object adapters；新增策略涉及 runtime，不是空白调整。|

#### actual-js：完整代表文件和另外两个实际变体

[CreditBalance 固定文件:1–28][AC] 全文如下。

```scala
// @generated by truthsrc scala-cqrs-domain:1
package example.bankwealth.infrastructure.bootstrap

import akka.actor.typed.Behavior
import akka.persistence.typed.PersistenceId
import akka.persistence.typed.scaladsl.EventSourcedBehavior
import example.bankwealth.application.aggregates.{CreditBalanceAggregate, CreditBalanceAggregateFactory}
import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
import example.bankwealth.domain.CreditBalanceComputations
import example.bankwealth.domain.entities.CreditBalanceEntity.{Event, State}
import example.bankwealth.domain.entities.behaviors.CreditBalanceEventHandler
import example.bankwealth.infrastructure.serialization.{CreditBalanceEventAdapter, CreditBalanceSnapshotAdapter}

object CreditBalanceBootstrap extends CreditBalanceAggregateFactory {

  override def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command] = {
    require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")

    EventSourcedBehavior[Command, Event, State](
      persistenceId = PersistenceId.ofUniqueId(persistenceId),
      emptyState = initial,
      commandHandler = CreditBalanceAggregate.commandHandler(hosts),
      eventHandler = CreditBalanceEventHandler.apply
    )
      .eventAdapter(CreditBalanceEventAdapter)
      .snapshotAdapter(CreditBalanceSnapshotAdapter)
  }
}
```

[FundOrder:1–28][AF] 与 [SipPlan:1–28][AS] 保留完整固定文件；逐 construct 的**全部变化规则**为：类型 / 文件 owner 分别换 FundOrder / SipPlan；两者 package/header/三项 Akka imports/Entity 的 Event,State/import EventHandler/adapter 调用顺序与代表文件相同。SipPlan protocol 导入 `.Command`，签名和 require 也是三参数形式。FundOrder protocol 导入 `._`，create 第四参数为 `authority: ExternalAuthority`，require 最后追加 `&& authority != null`，commandHandler 改为 `FundOrderAggregate.commandHandler(hosts, authority)`。二者仍是 object extends 各自 Factory、无 class 构造器、无 tags/retention/backoff。完整 raw JS 模板 [1–35][JT] 正好解释这两条 authority 分支，不能漏掉外部事件授权依赖。

#### actual-js → approved-target：真实 minus/plus，有限已裁定范围

**结构性对照，非同输入字节比较；这是公共布局和排版子 patch，不是最终 bootstrap 的完整可应用实现。** minus 是上面的真实银行文件；plus 只用已批准的 Factory / adapter 包布局及长参数排版。保留当前 PID、hosts、emptyState 和 handler 行作为上下文，直到 D1/D2 联审，绝不借这个 diff 默改 journaling identity。相关类型定义和调用方须同批迁移，单应用此片段不能宣称可编译。

```diff
--- actual-js/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala
+++ approved-target/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala
@@
 import akka.persistence.typed.scaladsl.EventSourcedBehavior
-import example.bankwealth.application.aggregates.{CreditBalanceAggregate, CreditBalanceAggregateFactory}
+import example.bankwealth.application.aggregates.CreditBalanceAggregate
+import example.bankwealth.application.aggregates.factories.CreditBalanceAggregateFactory
 import example.bankwealth.application.aggregates.CreditBalanceProtocol.Command
@@
-import example.bankwealth.infrastructure.serialization.{CreditBalanceEventAdapter, CreditBalanceSnapshotAdapter}
+import example.bankwealth.infrastructure.persistence.{CreditBalanceEventAdapter, CreditBalanceSnapshotAdapter}
 
 object CreditBalanceBootstrap extends CreditBalanceAggregateFactory {
 
-  override def create(persistenceId: String, initial: State, hosts: CreditBalanceComputations): Behavior[Command] = {
+  override def create(
+      persistenceId: String,
+      initial: State,
+      hosts: CreditBalanceComputations
+  ): Behavior[Command] = {
     require(persistenceId != null && persistenceId.nonEmpty && hosts != null, "explicit persistence identity and implementations required")
 
     EventSourcedBehavior[Command, Event, State](
       persistenceId = PersistenceId.ofUniqueId(persistenceId),
       emptyState = initial,
```

更深差距并未被以上有限 patch 隐去：最终 A sharding trait 的完整 RHS 在 T-A；formal object 的 create 职责可能须搬至 infrastructure 的具名 factory implementation，而不能与同名 trait 重复发射。**D1 未裁定前不得把 T-A 的 `PersistenceId(typeKey.name,entityId)` 套给现有 bank `ofUniqueId(persistenceId)`；这两种身份不等价。** D2 未裁定前不得删除 hosts / authority 或以虚假 success 填充新命令 helper。

#### curated reference 单独对照

[CreditBalance curated:22–49][CC] 仍是 sharding trait，但 public family 是 `CreditBalanceProtocol.CreditBalanceCommand`；key 是 `CreditBalanceAggregate.CreditBalanceEntityTypeKey`。factory 内先 `Id.of(context.entityId)`，private apply 接 `(userId: Id, tag: String)`，PID 第二实参 `userId.toString`，emptyState 接 userId。raw 则 private apply 接 entityId:String，Id 转换在 emptyState RHS，key 固定 `entityTypeKey`。curated 的 grouped imports、两个 Id imports、命令 family import、key import、logger/duration、tagging/retention/restart/new adapters 的完整字节在固定文件。**不能只改布局就把 Id 转换时点和 key 名改成 curated 特例。**

### 4.2 saga-coordinator 子 diff

#### T-C：完整原 body，125–153

```scala
  def initSagaEngine[C](sharding: ClusterSharding, context: C, system: akka.actor.typed.ActorSystem[_], globalTimeout: scala.concurrent.duration.FiniteDuration = 5.minutes): Unit = {
    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
    implicit val askTimeout: Timeout = Timeout(30.seconds)
    val extendedSystem = system.classicSystem.asInstanceOf[ExtendedActorSystem]

    val executorBehavior: String => Behavior[StepExecutor.Command] = name =>
      StepExecutor[Any, Any, C](
        PersistenceId.ofUniqueId(s"saga-executor-$name"),
        context = context,
        defaultMaxRetries = 5,
        initialRetryDelay = 100.millis,
        circuitBreakerSettings = StepExecutor.CircuitBreakerSettings(5, 30.seconds, 30.seconds),
        extendedSystem = extendedSystem)

    sharding.init(Entity(SagaTransactionCoordinator.entityTypeKey) { entityContext =>
      SagaTransactionCoordinator(
        PersistenceId.ofUniqueId(s"saga-coordinator-${entityContext.entityId}"),
        executorBehavior,
        globalTimeout = globalTimeout)(ec, askTimeout)
    })
  }

  /** Resolves the sharded coordinator for a transaction id (for SagaRunner). */
  def coordinatorRef(sharding: ClusterSharding, transactionId: String): EntityRef[SagaTransactionCoordinator.Command] =
    sharding.entityRefFor(SagaTransactionCoordinator.entityTypeKey, transactionId)
```

上例是 Scala 输出槽内容：原 Scala Template 字符串为转义内层插值，写 `$$name`、`$${entityContext.entityId}`；不是少了一个美元号的模板修改。

|construct id / 原位置|完整合同|JS / target 处理|
|---|---|---|
|C01 / T127|方法 `[C]` 无上下界 / 型变；参数顺序 sharding, context, system, globalTimeout；最后默认 `5.minutes`，返回 Unit。|missing-counterpart。拆行并使用已收集的 ActorSystem / FiniteDuration 简名是排版目标，不合成 C。|
|C02 / T128–130|依次 ec=system.executionContext；askTimeout=Timeout(30.seconds)；extendedSystem=classicSystem 强转 ExtendedActorSystem。|真实 cast 保留为 glue 约束，不改 Any actor system。|
|C03 / T132–139|String=>Behavior[StepExecutor.Command]；`StepExecutor[Any,Any,C]`；PID 前缀 saga-executor；context/retries=5/retry=100ms/breaker(5,30s,30s)/extendedSystem 按原序传。|原已有 Any 泛型擦除必须明示，不扩散为字符串业务分发。执行器 child name 的 step/phase 组成由 coordinator，bootstrap 不改拼法。|
|C04 / T141–147|注册 Entity(coordinator.entityTypeKey)；构造 coordinator 的 unique PID 为 saga-coordinator-entityId；第二实参 executorBehavior；named timeout；第二参数列表 `(ec,askTimeout)`。|先 definition 注册后允许 recovery 的应用级顺序须由 application-bootstrap owner 保证。|
|C05 / T149–151|保留 Javadoc；`coordinatorRef` 返回类型化 EntityRef[Command]，RHS entityRefFor(typeKey,transactionId)。|不能换成每个 saga 私有 actor / singleton / raw ActorRef lookup 后宣称相同。|

raw → approved-target 的有限排版示例（minus 为 [T127–130][T] 的真实原模板文本；此处不是伪造 JS counterpart）如下。默认值和方法体不变；shared imports 已有相应 TypeRef。

```diff
--- raw-scala/BootstrapTemplate.scala#renderSagaBootstrap
+++ approved-target/BootstrapTemplate.scala#renderSagaBootstrap
@@
-  def initSagaEngine[C](sharding: ClusterSharding, context: C, system: akka.actor.typed.ActorSystem[_], globalTimeout: scala.concurrent.duration.FiniteDuration = 5.minutes): Unit = {
-    implicit val ec: scala.concurrent.ExecutionContext = system.executionContext
+  def initSagaEngine[C](
+      sharding: ClusterSharding,
+      context: C,
+      system: ActorSystem[_],
+      globalTimeout: FiniteDuration = 5.minutes
+  ): Unit = {
+    implicit val ec: ExecutionContext = system.executionContext
     implicit val askTimeout: Timeout = Timeout(30.seconds)
     val extendedSystem = system.classicSystem.asInstanceOf[ExtendedActorSystem]
```

[Curated coordinator:1–49][CS] 的 API、PID 两前缀、defaults、executor / coordinator 调用和 coordinatorRef 与上述体一致；不同处：ActorSystem / FiniteDuration 简名、duration 通配 import、cast 用 `akka.actor.ExtendedActorSystem` FQN，类前专门的 PID 文档而非通用 Javadoc。它不能证明 JS frozen 0.3.0 JAR 提供 classic API，更不能证明真实 JVM 恢复已完成。

### 4.3 saga-transactor 子 diff

T-S [157–167][T] 派生 `sagaName=targetName`，`definitionObject=sagaName.replace("SagaTransactor", "") + "SagaDefinition"`；完整体只有下列方法，不是 TCC participant 或交易仓储。

```scala
  def init$sagaName(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler): Unit = {
    $definitionObject.register
    ()
  }
```

|construct id|合同与副作用|处理|
|---|---|---|
|S01 / T162|public init<原 sagaName>；一个 implicit 参数列表，ec 后 scheduler；返回 Unit；无泛型/构造器。|从 metadata 保留名；重复技术后缀需 shared naming 明确映射，不改 definition identity。|
|S02 / T163–164|先调用 definitionObject.register（无括号，依隐式参数），再 `()` 丢弃返回值。|不得把注册改异步 Future、不加“成功交易”回执。注册必须早于 sharding 恢复。|

raw → approved-target 仅简化已有 import 对应的 FQN 和排版，未添加业务默认体。

```diff
--- raw-scala/BootstrapTemplate.scala#renderSagaTransactorBootstrap
+++ approved-target/BootstrapTemplate.scala#renderSagaTransactorBootstrap
@@
-  def init$sagaName(implicit ec: ExecutionContext, scheduler: akka.actor.typed.Scheduler): Unit = {
+  def init$sagaName(implicit ec: ExecutionContext, scheduler: Scheduler): Unit = {
     $definitionObject.register
     ()
   }
```

[Curated MoneyTransfer:1–16][CT] 完整源码为 package `net.imadz.infrastructure.bootstrap`，imports Scheduler / `net.imadz.application.services.transactor.MoneyTransferSagaDefinition` / ExecutionContext，注释要求 recovery 前注册，trait `MoneyTransferSagaTransactorBootstrap`，方法 `initMoneyTransferSagaTransactor(implicit ec: ExecutionContext,scheduler:Scheduler):Unit`，体严格 `MoneyTransferSagaDefinition.register; ()`。JS 近似 aggregate/projection renderer 并不含这个分支；本项不据名称把 bank strict saga runtime / host 当作它。缺少 classic 模型输入和实际 JAR 方法时，此变体保留 missing-counterpart。

### 4.4 projection 子 diff

#### T-P：两种完整体和循环，169–218

共同先取 `projName=targetName`、`repoName=projectionRepo.get.name`、`sourceAgg=sourceAggregateType.get.name`。public 名字是 `init${projName.replace("Projection", "")}Projection`，这里是全字符串 replace，**不同于** bootstrap 文件名的尾缀删除。

single（projectionAggregateTags 为空）完整输出槽：

```scala
  def init${projName.replace("Projection", "")}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: $repoName): Unit = {
    ShardedDaemonProcess(system).init(
      name = $projName.projectionName,
      numberOfInstances = $sourceAgg.tags.size,
      behaviorFactory = index => ProjectionBehavior($projName.createProjection(system, sharding, index, repository)),
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
```

multi（projectionAggregateTags 非空）**完整生成循环**如下，来自原模板 [178–203][T]，包括每臂条件 / RHS / 最后异常，不能只记作“生成 dispatcher”。

```scala
val aggs = model.projectionAggregateTags.map(_.name)
val sizeOf = (a: String) => s"$a.tags.size"
def prefixSum(i: Int): String =
  (0 to i).map(j => sizeOf(aggs(j))).mkString(" + ")
val total = prefixSum(aggs.length - 1)
val arms = aggs.zipWithIndex.map { case (agg, i) =>
  val aggBase = agg.replace("Aggregate", "")
  val localIndex = if (i == 0) "index" else s"index - (${prefixSum(i - 1)})"
  s"""        if (index < ${prefixSum(i)})
          ProjectionBehavior($projName.createProjectionFor$aggBase(system, sharding, $localIndex, repository))"""
}.mkString("\n        else ")
```

将该循环结果填入以下完整体（异常字符串在原模板使用 `$$index` 转义，最终 Scala 使用 `$index`）：

```scala
  def init${projName.replace("Projection", "")}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: $repoName): Unit = {
    ShardedDaemonProcess(system).init(
      name = $projName.projectionName,
      numberOfInstances = $total,
      behaviorFactory = index => {
$arms
        else throw new IllegalStateException(s"projection tag index out of range: $index / $total")
      },
      settings = ShardedDaemonProcessSettings(system),
      stopMessage = Some(ProjectionBehavior.Stop)
    )
  }
```

|construct id|原 RHS / 顺序|target / 差距|
|---|---|---|
|P01 / T169–178|三 locals 的 `.get` 在分支之前；nonEmpty 才走 multi。|不能把 `.get` 改可空 repository 或伪成功。输入缺失须明确拒绝。|
|P02 / T179–189|声明序 aggs，prefix sums；第 0 臂 index，后续 index-(之前前缀和)；边界 index<包含本臂的前缀和；每臂 `createProjectionFor<agg去Aggregate>`。|对应 projection artifact 的准确符号、事件 envelope 和 tag 顺序，不能混流或换排序。|
|P03 / T191–201,205–215|唯一 public Unit init，无泛型/implicit；ShardedDaemonProcess(system).init 按 name→numberOfInstances→behaviorFactory→settings→stopMessage 顺序。|生命周期 owner 是 shared actor system/sharding，不是构建自己的 ActorSystem。|
|P04 / T197|最后抛 `IllegalStateException(s"projection tag index out of range: $index / <total表达式文本>")`；total 在字串内是模板展开的表达式文本，不是自动插值后的数值。|保留异常，不补 catch 后返回空 Behavior。CC 按臂数单列；不以 Any map 降分。|
|P05 / T211–214|single 的实例数为 primary tags.size；factory 调 `createProjection(system,sharding,index,repository)`，settings 从 system，stop Some(ProjectionBehavior.Stop)。|formal 的 journal.start() 并非同方法。|

legacy 最近似的 [bootstrap-dsl/emit.mjs:26–97][LE] 不经 metadata 提供 repositoryRef，猜 `${viewName}Repository`，方法名也无条件再加 Projection。真实 JS 模板 → raw 对应目标的结构性差异如下（模板语法两边均用 JS 插值说明拟移植规则；plus 不是已存在函数，也未裁定 inputs adapter）。

```diff
--- js/generators/bootstrap-dsl/emit.mjs#emitProjectionBootstrap
+++ proposed/scala-cqrs-play-service/bootstrap/templates/projection.mjs
@@
-  const repositoryName = `${viewName}Repository`;
+  const repositoryName = model.projectionRepo.name;
@@
-  def init${viewName}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: ${repositoryName}): Unit = {
+  def init${viewName.replaceAll('Projection', '')}Projection(system: ActorSystem[_], sharding: ClusterSharding, repository: ${repositoryName}): Unit = {
     ShardedDaemonProcess(system).init(
       name = ${viewName}.projectionName,
       numberOfInstances = ${instances},
```

plus 的 replaceAll 只是忠实表达 raw 的全 replace；**最终是否保留这条非尾缀语义，或只许以解析后的方法名发射，由 D5 决定**。共享 resolver 应在 Builder 给出完整方法名，Template 不应长期自行 replace。multi 的 forSources/activeGroups 也必须按 B-P 的 handler 归属规则对齐，不能只修上述两行。

[Curated projection:1–21][CP] 特例：文件/trait 是 `MonthlyIncomeAndExpenseBootstrap`，方法 `initMonthlySummaryProjection`，projection object 实为 `MonthlyIncomeAndExpenseSummaryProjection`，从该 object 单独 import `{createProjection, projectionName}`；repo 是 `MonthlyIncomeAndExpenseSummaryRepository`；实例数是 `CreditBalanceAggregate.tags.size`。余下五 named args 和 Stop 与 single raw 相同。文件名、方法缩写和 repository 名不能泛化为 builder 规则；curated 也没有 multi 例，不能代替它的验证。

## 5. JS 三条路由：Model / Builder / Template / 输出四层

### 5.1 formal 银行链路（真实调用，不按目录猜）

[generate-cli:17,37,92–101][CLI] 按 shipped generator 的 realpath 选择 `generatePlayService`；[play-service/generate:16–23,59–70][JG] 将继承 registry 的 `aggregate-dsl` 特别改走 `renderAggregateLayers`；[render-aggregate-layers:20–29][JL] 遍历模型按 role 选择 template，包成 `entry`，并继续调用 `renderAggregate(context,footprint,true)`。所以不能只改 domain renderer 或 `_deprecated` 后声称银行生效。

|层|实际内容|相对 Scala 的明确缺口|
|---|---|---|
|Model/Builder [build-aggregate-models:4–41][JB]|从 reference-layout 找 aggregate；owns 是 context 相等且 owner[0] 相等；查 commands 和 externalProducers；names/authority 共享；bootstrap role 固定 `persistenceIdentity:'unique-id'`；sources 仅 aggregate.source，dependencies 是 factory,aggregate,entity,fold,adapter 五文件路径；最后 copyImmutableData。|缺四变体 Model、TypeRef import Set、tagging / shards / key / emptyStateArg / sourceAggregateTags；这不是缺一个目录。其它 role groups/aliases 由同 Builder 产出，不能本项整文件重写丢弃。|
|命名 [aggregate-names:3–24][JN]|packageFor(context)、symbol(id)；bootstrap 路径用原 ref.id + Bootstrap.scala；factory 当前不在 factories；adapters 在 serialization；helpers 在 domain。|source 名和路径 stem 分开推导有碰撞/不一致可能；需 shared resolver，而不是局部 rename shell。|
|Template [1–35][JT]|先拒绝非 unique-id；authority 决定签名、argument、protocol wildcard 及 require；固定 import 顺序；object extends Factory；create require 然后 ESB[P,Event,State] ofUniqueId、initial、handler(hosts[,authority])、eventHandler.apply，最后两个 object adapters。|职责是本地 Behavior 工厂，未初始化 sharding、tagging、snapshot retention/backoff；没有 classic saga 或 daemon projection 分支。|
|输出|§4.1 三个完整固定文件，FundOrder authority=true，其它 false。|与 raw 不同输入形态；不能拿有 bootstrap 文件名算内容已复刻。|

formal 的 projection 不可一概说不存在：[render-service:20–28][SERVICE] 对 `service.projections.length` 明确拒绝；但 [render-journal-readside:215–259][JREAD] 在有 `projectionStore` 时生成 `infrastructure/projection/<store.id>{Schema,Repository,Projection,Domain}.scala` 和 `conf/sql/<store.id>.sql`。其中 [151–209][JREAD] 的 `watch/discover/start/shutdown/close` 是 journal PID discovery、kill-switch、scheduler polling 和 drain Future 协议，不是 ShardedDaemonProcess tags / `createProjectionForX`。这些必要生命周期不能在 bootstrap 重构时丢弃或并成伪同款。

银行固定 [ApplicationBootstrap:1–24][ACTAPP] 是 Play load / composition factory 校验与失败 close，不混入本 artifact 的 A 数量。它 import `.service/.integration` 以及 source 字符串类名的迁移由 application-bootstrap / service owner 负责；本项不写。

### 5.2 legacy：两个不同可达面

1. **standalone bootstrap-dsl**：[emit 全文:1–365][LE] 顶层读取 spec / outDir，默认 pkg=`net.imadz.infrastructure.bootstrap`、basePkg=`net.imadz.metarch`、kind=`aggregate`；kind 为 projection / policy 各走专门分支，其它均 aggregate。它是直接 CLI，不是 `generate-products` 注册项；其 [generator.json](../baseline/js/generators/bootstrap-dsl/generator.json#L1) 没有 core 要求的 inputSchema/products/artifactKinds；[parse.mjs](../baseline/js/generators/bootstrap-dsl/parse.mjs#L1-L5) 只拷贝 binding。core 不因 entrypoint=`emit.mjs` 自动调用它。
   - aggregate [142–237][LE] 除 raw-like init/apply 外有 servicePorts 扩展：所有 port 进 init/apply/eventHandler；commandHandler 若有 `ConceptDeltaAdjudicator` 类型只传该子集，否则全部；Id 判定来自 `spec.idIsString`，不是 StringType。imports 刻意含重复项，port imports 在 `net.imadz.common.Id` 后插入并破坏排序；发到 `.domain.service`（非批准 `.domain.services`）。固定生成版本头不应冒充当前 BC。
   - projection [26–97][LE] source 为 `forSources || [sourceAggregate去尾Aggregate]`；forSources 的 truthiness 触发 multi，即 `[]` 也为真；无 BC handler-FQN 过滤；prefix、offset、最后 throw、Stop 近似 raw，但名字和 repo 推导不同。
   - policy [99–133][LE] 是其它职责，不纳入四变体；ApplicationBootstrap [259–357][LE] 同物理 emitter 产生 global 产物且含 strictEntries 单例接线。必须分拆 owner，不能本项吞掉。
   - [359–365][LE] 默认同时写 trait 与 ApplicationBootstrap，只有 `skipTrait/skipApp` 抑制；直接 overwrite、mkdir、console，无 core ledger / anchor。`pipeline.mjs` [120–134][PIPE] 对它只登记 queued 并写 pipeline-manifest，**并未实际 exec emitter**。
2. **`_deprecated/scala-cqrs-es`**：目录名不意味着不可调用。[generate.mjs:16,23,153–177][LG] 真正调用 aggregateBootstrapModel/renderAggregateBootstrap、projectionBootstrapModel/renderProjectionBootstrap 并返回 entries。core [plan:23–42][CORE] 导入指定目录的 `generate.mjs`；[manifest:8–27][MANIFEST] 无 `_deprecated` 拒绝条件；其 [manifest:1–35][LM] 有所需旧 schema / kinds，故存在显式 legacy 路径，**但不在 formal shipped products realpath 清单**。本次未执行，不保证依赖闭包可运行。
   - [builder:14–85][LB] BOOT/AGG/PROJ 包硬编码 net.imadz.metarch；foldPorts / ports 按 trait FQN 排序；前者进 init/apply/event handler，后者只进 behaviorCall；model 存 `initSig/factoryCall/applySig/cmdType/behaviorCall/eventHandlerCall` 源码字符串，不是 Scala 19-field 同构。
   - [builder:91–127][LB] 调 `deriveView`，primary + activeGroups，multi=`isMultiAgg && activeAggs.length>0`；imports Set 后排序；每臂存 bound/localIndex 字符串；`name/repoName/initName` 仍按 projName 拼接。
   - [template:53–64][LT] 真正发 raw-like ESB/tagger/retention/backoff/adapters 和 single/multi projection；aggregate emptyState **始终 `Id.of(entityId)`**，没有 BC StringType 分支。这些是可复用内容，不是 formal 已接线；旧源码注释的历史 byte-verified 不是本轮证明。

### 5.3 family：已注册，但不是银行 formal 的替代事实

[generate-cli:19,40,97][CLI] 注册 `scala-cqrs-aggregate-core-v1`；[generate:11–23][FG] 要求 `scala-cqrs-aggregate-core@1`，由 registry `aggregate-core` producer buildModels→render。完整 [build-models:1–248][FB] 已分段阅读：

- 仅接受 options packages/names/protobuf；抽出新 role naming overrides，先构造 unchanged kernel/serialization；external-events producers 必须等于 domain-dependencies，且 **任何 external producer 非空都拒绝**（50–74）。不能拿它直接替换有 FundOrder authority 的银行。
- artifactSpec(18–28) 定义 bootstrap role=`bootstrap`、kind=`aggregate-bootstrap`、subpackage=`infrastructure.bootstrap`、suffix=`Bootstrap`、module=`glue`。共享命名 reserve、源 ordinal/ref/type/依赖一致性、guard/emission/fold 校验属于完整 Builder 的前置门，不能在提取 bootstrap 时绕过。
- metadata(115–118) 顺序为 ref,role,kind,module,name,identifier,package,fqn,path,sources,refs,directDeps；name/name identifier 经 resolveNameSet，path 经 MODULAR_CANDIDATE 的 resolveArtifactPath。聚合在 headers 顺序发全部 artifactSpec。
- setDeps(221–232) 给 bootstrap 依赖 factory,aggregate,eventHandler,actorProtocol,base.protocol,base.state,base.computations；sources 仅 base.source，refs 仅 base.ref。末尾校验所有事件有本地 producer、portable 路径不碰撞、依赖路径必须是实际 output、kernel 不依 glue(237–247)。这些检查不是四变体输入合同。
- [render:15–34][FR] productionJobs 为每聚合发 bootstrap job，同时还发 rules/helpers/...；render 又加 build / generated-tests。没有 bootstrap-only CLI flag。
- [template 全文:1–14][FT]：importsFor 按 Behavior；EventAdapter/PersistenceId/SnapshotAdapter；EventSourcedBehavior；actor/aggregate；factory；protocol；state；handler；hosts 分组，并 reserve `J`。输出 object extends factory，唯一方法 `create[J](PersistenceId,State,Hosts,EventAdapter[Protocol.Event,J],SnapshotAdapter[State]):Behavior[ActorProtocol.Command]`。依序 require PID 非空（含 trim）、initial、hosts、eventAdapter、snapshotAdapter；ESB 显式三型参，PID 原样传入，emptyState=initial，commandHandler=aggregate.commandHandler(hosts)，eventHandler=handler.apply，末尾 `.eventAdapter(eventAdapter).snapshotAdapter(snapshotAdapter)`。无 tags、sharding、retention、restart。
- [importsFor:3–25][FI] 会对与本 artifact/reserved/同名 FQN 冲突的项使用 `_root_.FQN`；同包 groups 组合 import 并去重，否则逐行输出。它比 formal 丰富，但仍须与 raw/approved import 顺序和名义类型合同对齐。
- [persistence-readside-v1/templates/persistence:149–157][FP] 的 factory 真正调用 `a.bootstrap.fqn.create[frame](persistenceId,initial,hosts,new eventAdapter,new snapshotAdapter)`。故改 family create ABI 会影响真实下游，不能删除泛型 J 或改变 adapter 所有权后只验 bootstrap。

## 6. 胶水、业务槽与不可修改的语义

### 6.1 完整依赖符号和消费条件

|符号 / 来源|本 artifact 所需接口与语义|证据 / 未证实部分|
|---|---|---|
|`akka.cluster.sharding.typed.scaladsl.{ClusterSharding,Entity,EntityContext,EntityTypeKey,EntityRef}`|`init(Entity(key)(factory))`、`entityRefFor(key,entityId)`；context.entityId；应用 command family 类型贯穿 EntityContext/Behavior/EntityRef。|模板和 framework refs；没有本次 classpath 验证。|
|`akka.actor.typed.{ActorSystem,Behavior,LogOptions,SupervisorStrategy,Scheduler}`；`akka.actor.typed.scaladsl.Behaviors`；`akka.actor.ExtendedActorSystem`|logMessages / setup；system.executionContext / classicSystem；withLogger/withLevel；restartWithBackoff+stash；Saga 强转及注册隐式 scheduler。|[GeneratorContext:89–113,194–203][CTX]。不得凭源码 import 推定 JAR API。|
|`akka.persistence.typed.PersistenceId`；`akka.persistence.typed.scaladsl.{EventSourcedBehavior,RetentionCriteria}`|二段 PID 与 unique PID 不等价；ESB 四 named args，tagger/retention/persist failure/adapters 顺序见 T-A。|BC [scaffold/build.sbt:10,95][BUILD] 固定 Akka 2.6.20；本次未解析或下载依赖。|
|`akka.cluster.sharding.typed.scaladsl.ShardedDaemonProcess`；`akka.cluster.sharding.typed.ShardedDaemonProcessSettings`；`akka.projection.ProjectionBehavior`|daemon 按 tags 分片，createProjection/ForX 返回可包 ProjectionBehavior 的 projection，Stop 终止消息。|BC projection 依赖 `com.lightbend.akka %% akka-projection-eventsourced / akka-projection-jdbc % 1.2.5`，见 [42,108–109][BUILD]。同名 API 不代表 formal journal polling 等价。|
|`scala.concurrent.ExecutionContext`；`scala.concurrent.duration.{DurationInt,FiniteDuration}`；`akka.util.Timeout`|ec 由 system 提供；默认 5.minutes / 30.seconds / 100.millis 等保持；不注入全局 EC。|T-C，Builder deps。|
|`org.slf4j.LoggerFactory`；`org.slf4j.event.Level`|logger `iMadz`，Level.INFO。|BC scaffold [190][BUILD] `org.slf4j:slf4j-api:2.0.4`；运行绑定未验。|
|`<frameworkPackage>.common.CommonTypes.Id` 与 `net.imadz.common.Id`|前者类型，后者 `Id.of(entityId)` 构造入口；不是可合并的 nominal 类型。StringType 不转换。|[GeneratorContext:266][CTX] + [TypeResolver:66–80][RESOLVE]；BC scaffold `net.imadz %% common-core % 0.2`。|
|`<base>.application.aggregates.<Agg>Aggregate / <Agg>Protocol`；`<base>.application.aggregates.behaviors.<Agg>Behaviors`|key/tags、command family、`Behaviors.apply` command handler；包和名由 resolver / 当前 raw replace 协作。|调用者依赖 aggregate-root / application-protocol / aggregate-behavior，而非 domain ActorRef。|
|`<base>.domain.entities.<Entity>`；`.entities.behaviors.<EventHandler>`；`<base>.infrastructure.persistence.<Agg>EventAdapter / SnapshotAdapter`|Entity.empty 接准确 ID 型；EventHandler.apply 演进状态；raw adapters 为 new class，actual formal adapters 为 object。|D2：构造器形式和生命周期必须随 adapter artifact 联审，不臆造 `new` 的成功实现。|
|`net.imadz.infra.saga.SagaTransactionCoordinator`；`<rootPackage>.infra.saga.StepExecutor`|classic engine ABI 见下面准确签名。|BC 默认消费 `net.imadz %% saga-core % 0.2`；JS formal [generate-cli:114–125][CLI] 验 local `saga-core_2.13/0.3.0` JAR SHA，pipelines 还验两 Monarch 0.3.0 固定 SHA。**两套坐标不相等**；不能以 curated 源码保证该 JAR 有 classic API。|
|`<base>.application.services.transactor.<Base>SagaDefinition`|`register(implicit ec,scheduler)`；返回 definition 后 bootstrap 丢为 Unit。|[Curated definition:61–65][CDEF] 实际先 `val defn=definition`，再 `SagaRegistry.register(defn)`，最后 defn。schema / version / runtime registry 不由 bootstrap 发明。|
|`<base>.application.projection.<Projection>` 和明确 repositoryRef|projectionName / createProjection / createProjectionForX 的名字、参数 `(system,sharding,index,repository)` 与 tags 对齐。|projection / repository owner 提供签名，缺项不是空实现。|

已读固定 classic 源码的准确 ABI（只是 source-content 证据）如下。

```scala
// curated-scala/.../StepExecutor.scala:149–155
 def apply[E, R, C](
     persistenceId: PersistenceId,
     context: C,
     defaultMaxRetries: Int,
     initialRetryDelay: FiniteDuration,
     circuitBreakerSettings: CircuitBreakerSettings,
     extendedSystem: ExtendedActorSystem
 ): Behavior[Command]
// StepExecutor.scala:77
 case class CircuitBreakerSettings(
     maxFailures: Int,
     callTimeout: FiniteDuration,
     resetTimeout: FiniteDuration
 )
// curated-scala/.../SagaTransactionCoordinator.scala:229–233
 def apply(
     persistenceId: PersistenceId,
     stepExecutorBehavior: String => Behavior[StepExecutor.Command],
     globalTimeout: FiniteDuration = 5.minutes
 )(implicit ec: ExecutionContext, timeout: Timeout): Behavior[Command]
```

[StepExecutor:156–175][EXEC] 建 breaker / LiveStepHolder，ESB 及 event adapter，并说明恢复由 coordinator 驱动；[coordinator:229–247][COORD] 内部创建 cache、phaseInFlight、选 tag、ESB。bootstrap 只是注入工厂和注册 sharding，不能据此宣称 crash recovery 的行为已经在本轮实测。

### 6.2 本族没有业务算法默认实现，不扩散 Scala 的债

BootstrapTemplate 没有 `???` 或 MANUAL 区；这不等于其依赖完工。`emptyStateArg` 和 `transactorContextInit` 是显式代码字符串槽，后者未读；Builder / Template 的字符串名称替换、TypeResolver 的 `resolveMetaRef = ???` 保留为债。聚合 behavior / helper 的 raw MANUAL / 默认回复算法由各自 artifact 管，不能在 bootstrap 里注入假 `Right(empty)` / Accepted 来绕过。

target 依赖合同必须保留：CommandHelper 在 `application.aggregates.behaviors`，含 `toParam / createFailureReply / createSuccessReply`；仅应用 Actor 命令按明确 reply 合同条件生成 typed replyTo，domain params/events 不含 ActorRef；失败不 persist；成功 persist 并 event application 后由 thenReply 读取新 state；`replyWith` 与 `replyWithAndPublish` 不等价。bootstrap 的 handler 接线必须能到达这些行为，不能保留旧无条件 emit-helper 然后只宣称新目录达标。PB 字段号、serializer ID/manifest/binding 范围、PID 前缀/拼接、名义类型和 addExact 溢出语义都不是本项的美化写面。

## 7. 第二阶段拟写集合、唯一组装 owner 与迁移

**下表是拟实施计划，不是本次改动。** 默认由 bootstrap owner 负责四变体内容；`shared-layout-types` / registry / writer / source mappings 只由集成者写。没有新建生产文件或 fixture。

|拟写路径（相对 JS 仓根）|动作 / 内容 / owner|
|---|---|
|`generators/scala-cqrs-play-service/bootstrap/model.mjs`（proposed）|bootstrap owner：显式承载 §2 的字段/判别变体及 source/类型依赖，不用 content:string 代替模型。废置槽明确标不发射。|
|`generators/scala-cqrs-play-service/bootstrap/build-models.mjs`（proposed）|bootstrap owner：四 Builder 规则与输入 adapter；类型/命名用集成者 shared 接口。D5 未审不得发明缺失 tagging/registry/投影输入。|
|`generators/scala-cqrs-play-service/bootstrap/templates/aggregate.mjs`、`saga-coordinator.mjs`、`saga-transactor.mjs`、`projection.mjs`（全部 proposed）|bootstrap owner：T-0 + 四体；multi 每臂结构化建模；source literal 槽只在批准字段内，优先发简名。|
|`generators/scala-cqrs-play-service/bootstrap/render.mjs`（proposed）|bootstrap owner：唯一四变体文件组装器 `renderBootstraps`（proposed symbol），每个 output path 只登记一次，负责头/import/body 拼接及将最终文本交公共 entry/writer。|
|`generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs`|待 D1/D2 后 replace / retire 原 object-only renderer；保留旧 profile adapter 的期限由集成者批准，不允许新旧同时占同文件。|
|`generators/scala-cqrs-play-service/build-aggregate-models.mjs`|共享冲突文件，**集成者单写**：先只分离 bootstrap role，保留其余六 role 的数据、sources、deps；之后接新模型。|
|`generators/scala-cqrs-play-service/render-aggregate-layers.mjs`、`generate.mjs`、`aggregate-names.mjs`、`generator.json`|共享冲突文件，集成者单写：取消原 bootstrap 重复输出，接 renderBootstraps，登记 products/variants/deps 和新布局；不得因此绕过 requireApplicationArtifact。|
|`generators/scala-cqrs-aggregate-core-v1/templates/bootstrap.mjs`、`build-models.mjs`、`render.mjs`|family owner 串行 adapt：明确是保留 local factory profile 还是消费共同结构；`create[J]` 的 persistence-readside caller 必须一起规划。不是无条件复用 formal 新 trait。|

公共依赖而非 bootstrap 自写：`lib/scala-target/naming.mjs` 的 `resolveName / resolveNameSet / resolveArtifactPath / targetData`（完整签名和行为见 [26–118][NAMES]）；imports/type/layout 的统一接口；`src/core/generate.mjs` 的 `applyEntries` / ledger / anchor 最终字节顺序；`lib/products/generate-cli.mjs` shipped producer 入口与 `generator.json` 的 product admission。建议明确模型依赖和物理依赖两列，参考 family artifact `{ref,role,kind,module,name,identifier,package,fqn,path,sources,refs,directDeps}`，但最终共享 shape 由集成者冻结。

唯一 assembly owner 规则：

- 每个 `<base>.infrastructure.bootstrap.<Type>` 文件的头、import、注释、trait/body、provenance 同属 `renderBootstraps` 的单个 entry；不得让 `renderAggregateLayers` 和新 registry 分别各发一次。
- `ApplicationBootstrap.scala`、BootstrapModule / Play loader、formal journal lifecycle 和 policy bootstrap 仍由各自 owner 组装。legacy `emit.mjs` 混合输出时必须隔离 `skipApp` 或先拆分，不授权本项覆盖 global 文件。
- 旧 local object 的 create / authority / factory 调用必须先有明确新 owner 和引用迁移清单；不能删除它后留下 `RepositoryImpl` 或 persistence factory 悬空。保留的旧 profile 不是新 profile 下的永久转发壳。
- source mapping 在最终 imports / 排版之后定位；由 writer 重算 fingerprint、manifest、ledger、anchors。禁止在成品格式化后沿用旧 offset；禁止手改这些账。本轮只写文档。
- 依赖顺序：shared-layout-types → domain-entity/event-handler + application-protocol/aggregate-root/aggregate-behavior/command-helper + aggregate-factory + persistence adapters；Saga 依赖 saga-definition/context 与 frozen JAR ABI；projection 依赖 projection/repository 和 tag-filter 合同；最后 application-bootstrap 联调初始化先后。

## 8. Fixture 与未来 CLI 验收合同（全部未执行）

### 8.1 最小等语义 fixture 矩阵

以下目录是 **proposed 测试资产**，本次没有创建，也不是第二业务真源：`docs/codegen-parity/fixtures/bootstrap/`。

|fixture|必须携带的输入及 expected 文件集合|检查点|
|---|---|---|
|`aggregate-id` / `aggregate-string`|同一个非银行小聚合的明确 metadata ↔ products 映射；commandFamily、entityRef、stateRef、behaviorRef、tagging、ID 类型和 adapters 全给；目标分别一份 `<AggregateBase>Bootstrap.scala` 加其依赖闭包|Id.of 与 entityId 两 RHS；fallback 与明确 ShardedTags；typed actor command 不污染 domain；PID identity 必须另有批准值。|
|`aggregate-external`|formal authority true/false；外部 port 及独立手写实现绑定|FundOrder 所示 authority 不丢，family no-external 必须诚实拒绝；不能靠空 authority 过门。|
|`classic-saga-none` / `classic-saga-two`|0 个和 2 个明确 classic definition/context；后者恰 1 coordinator + 2 transactor 文件，前者无两类文件|definition 注册先于 initSagaEngine；默认 timeout/retry/breaker；PID 字节；coordinatorRef 稳定类型。|
|`projection-single` / `projection-multi`|repositoryRef、primary/sourceAggregates 有序列表、event owner、handlers 和 aggregate tags|single 与各 ForX 全 RHS；0/边界/越界索引；两源剩一源仍 ForX；全部过滤为空必须按 D3 裁定拒绝或抑制，不伪造输出。|
|`invalid-and-layout`|缺 repositoryRef、零 tag、名称碰撞、重复后缀、包名冲突、非默认 rootPackage|明确诊断且不以 Any/no-op 兜底；single/multi 物理根分开；没有第四业务层。|

同输入 expected 应分别保存 `raw-scala/approved-target/actual-js` 完整文件集合；只有源头/输出 profile 明确后才能生成。此处没有这些新文件，不宣称 fixtures 已可用。

### 8.2 准确 CLI 形状和副作用边界

以下为**后续批准后**的命令形状，不在本阶段执行。绝对 paths 指 proposed fixture/candidate；不是“已经存在”的事实。CLI 没有 `--artifact bootstrap` 或 `--bootstrap-only`，范围须由小输入和其依赖闭包控制，而非全银行生成。

formal products 入口（可选 `--plan` 仅预览；真正生成移除它）：

```sh
node /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/bin/truthsrc.js generate-products \
  --request /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/bootstrap/formal/request.json \
  --generator /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-play-service \
  --out /Users/zhongdj/Workspaces/mad-polaris/parity-bootstrap-js-candidate \
  --options-json /Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/bootstrap/formal/options.json \
  --plan
```

- [CLI:66–88,104–145][CLI] 读取 request/options/manifest、内存 compileProductSet、选择实际 producer、生成 plan。formal 还读取并 SHA 检验本地 frozen runtime JAR、检查 externalSourceRoots；新 out 并不消除此读取依赖。无 JAR 就阻断，不下载/发布 runtime。
- `--plan` 在调用 applyEntries 前返回，**不写目标**；这里不等价于执行测试或编译 Scala。移除它后由 [core:246–267][CORE] 写计划的源码/config/build/test 文件及 `truthsrc.ledger.json`、`anchors.json`，可能执行已有 MANUAL merge/ownership 策略。不是只写 bootstrap 一个文件。所读 generate CLI/core 不会启动服务或 sbt；本轮未运行。不能泛称其它 generation 命令也无副作用。
- family 单独结构 fixture 使用同样四个必需 flags，把 `--generator` 换成 `/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/generators/scala-cqrs-aggregate-core-v1`，request/options 换 `fixtures/bootstrap/family/request.json` / `options.json`，out 换 `/Users/zhongdj/Workspaces/mad-polaris/parity-bootstrap-family-candidate`。它生成 kernel/serialization/aggregate/build/tests 闭包，不验证 classic 四变体。已注册的 module-seams / saga-monarch / play-application 若要 capture implementations，会被 generate-products 明确拒绝，须另行批准 generate-project，不以该命令冒用。

BC raw 入口：运行位置须是 `/Users/zhongdj/Workspaces/mad-polaris/backkend-codegen`，不是 workspace 根。准确配置是 JVM `-Dcodegen.*`，不是猜测的 `--system/--target`：

```sh
sbt \
  -Dcodegen.systemFile=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/bootstrap/bc/canonical.json \
  -Dcodegen.systemBindings=/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/docs/codegen-parity/fixtures/bootstrap/bc/bindings.json \
  -Dcodegen.targetDir=/Users/zhongdj/Workspaces/mad-polaris/parity-bootstrap-bc-candidate \
  "runMain net.imadz.codegen.CodegenMain"
```

- [CodegenMain:62–80][MAIN] 两 file flags 必须成对，且与 `codegen.system` 互斥。上面的 fixture adapter 必须先证明能表达四变体；如果 formal adapter 不能表达，D5 先裁定显式测试 system 的注册方式，不默回 Examples。不要给 `semanticProductsFile`，那是另一条模板链。
- [175–247][MAIN] 会创建 target、copy scaffold（以及可能的多模块 relocation）、产生全 system 闭包、knowledge manifest / formal-semantics 等输出；runCommon 还建 protobuf 目录和 ledger 状态。sbt 本身可能编译生成器、写 target/project 缓存并解析/下载依赖，因此仅在独立批准的供应/离线配置和单一运行窗口中执行。新输出路径不保证无旁路写入，不能本阶段试跑。
- raw single/multi 用不同候选输出：只有明确选择多模块时加真实 `-Dcodegen.multiProject=true`；不得比较 single 的 app 与 multi 的 modules 为同布局。
- 不把直接 `node bootstrap-dsl/emit.mjs <spec> <out>` 当最终验收：它默认还 overwrite ApplicationBootstrap，且不带 core ledger/anchors。若专门核 legacy，必须有 `skipApp:true` 的显式 spec 和单独授权/输出面。

### 8.3 分项验收义务，不虚构现成 suite

1. 完整文件对账：路径、文件数量、排序、package/import 分组、trait/object、全部方法参数/泛型/implicit/default、RHS 和 side-effect 顺序；只允许逐条登记的版本头/平台换行差异，不压平空白。
2. construct/RHS：逐行核 §2、B-A/C/S/P、T-0/A/C/S/P；尤其 tags 未使用字段、`.get`、filtered-empty fallback、string slot、constructor/new/object 差别。缺一个变体只阻断该变体实施，不吞掉已写规格。
3. 真实接口和行为（后续集中批末）：用批准的 JAR 与小 actor fixture 核 key/PID/tags、factory依赖、无额外发布、helper失败不persist、成功thenReply看新state；Saga definition注册早于recovery、coordinator/executor PID；projection按源索引/Stop。当前没有在本项读到并确认一个恰好覆盖这些语义的可执行 suite，**不发明 testOnly 类名**。其精确 runner、fixture 和 JAR pins 是 D8 的实施前阻断项，不能用仅 source patch 或 compile 替代。
4. 稳定生成两次比最终 bytes；单一字段/规则变更仅合理局部 diff；原 knowledge 身份 query 到新源位置，退役旧路径有明确 owned 删除与冲突报告。
5. 命名/布局/复杂度：普通方法 CC 目标 ≤5，6–10逐方法解释，>10重构或逐方法批准；投影多臂分发原始 CC 单列，不能 Map[String,Any] 降分。当前全为 **not-measured**；算法/工具版本待固定。不拿总行数或平均分验收。
6. 调度预算为首次小输入生成/对账 5 分钟、集中 compile/behavior 15 分钟的停止点建议，非已测耗时；超时返回已有证据，不自动升级为全银行/全仓跑测。

## 9. 具体未决项

|ID|须裁定的内容 / 阻断范围|
|---|---|
|D1|银行目前 explicit unique-id + local actor repository，BC A 要 sharded trait + two-part PersistenceId。选择新增明确 sharded profile还是保留 local factory 另归职责；给出旧/新 caller、entity key/tags/PID 的等价或批准迁移合同。禁止在现有 journal 上直接切算法。|
|D2|如何把 hosts / FundOrder ExternalAuthority、caller initial、adapter object 与 raw `Entity.empty / Behaviors.apply / new Adapter` 接成真实接口；factory implementation 放哪里、谁唯一所有、构造器参数是什么。依赖 aggregate-factory/behavior/adapters，未裁定前不删对象工厂。|
|D3|sourceAggregates 多源却全部 handlers 过滤为空时，是拒绝、抑制 bootstrap，还是有真正 single createProjection；非空 tags 的校验 owner；跨 projection Builder 同一过滤结果如何共享。raw fallback 不能当已安全。|
|D4|classic coordinator/StepExecutor/SagaRegistry API 在拟消费 frozen JAR 的可用性、准确坐标/SHA，以及非默认 rootPackage 下 StepExecutor 与固定 net.imadz coordinator 是否允许混用。无匹配依赖则 missing-counterpart，不 publishLocal 造绿。|
|D5|JS 产品输入如何无损承载 tagging、identifier.fieldType、commandFamily、classic sagas、repositoryRef、projection source/handler attribution；完整方法/类型名共享 resolver 如何替换 raw 全字符串 replace。没有同语义 adapter / fixture 时不填默认成功。|
|D6|singleton engine 与 per-definition init 的应用装配顺序及重复调用策略由谁保证；不能因本族有 register 方法便宣称 recovery 前已注册。ApplicationBootstrap owner 固定一次 engine、多次 definition 的次序。|
|D7|provenance 由直接 source refs 还是兼容 noteId patch 适配；raw projection patch `meta.nameBootstrap` 与实际去尾缀文件名不一致、multi writer 的 ledger 路径需要统一 owner 处理。不能手修旧账。|
|D8|同输入四变体的完整 expected、准确局部行为 runner、offline JAR pins、CC 工具/口径与逐方法例外尚未批准；本轮只有源码证据。|

`extraSources: []`：此次引用的生产源码和银行/curated 产物均读自冻结 baseline；当前阅读的 AGENTS、AUTHORING-CONTRACT、layout-and-style、批准计划及单条清单是任务合同，不作为额外生产源码副本。没有读取或复制 baseline 外的当前生产源码。

## 固定引用

[M]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/bootstrap/BootstrapModel.scala#L1-L54
[B]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/bootstrap/BootstrapBuilder.scala#L1-L238
[T]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/BootstrapTemplate.scala#L1-L219
[AM]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala#L5-L47
[TYPE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4-L52
[RESOLVE]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolver.scala#L19-L149
[DSL]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L1005-L1049
[CTX]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/GeneratorContext.scala#L35-L296
[IMPORT]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L13-L22
[MAIN]: ../baseline/bc/src/main/scala/net/imadz/codegen/CodegenMain.scala#L55-L247
[DISPATCH]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L203-L220
[CALL]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1134-L1194
[WRITER]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L331-L396
[PATCHES]: ../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L1102-L1131
[BUILD]: ../baseline/bc/scaffold/build.sbt#L1-L190
[AC]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/CreditBalanceBootstrap.scala#L1-L28
[AF]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/FundOrderBootstrap.scala#L1-L28
[AS]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/SipPlanBootstrap.scala#L1-L28
[ACTAPP]: ../baseline/actual-js/app/example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala#L1-L24
[CC]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/CreditBalanceBootstrap.scala#L1-L49
[CS]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/SagaTransactionCoordinatorBootstrap.scala#L1-L49
[CT]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/MoneyTransferSagaTransactorBootstrap.scala#L1-L16
[CP]: ../baseline/curated-scala/net/imadz/infrastructure/bootstrap/MonthlyIncomeAndExpenseBootstrap.scala#L1-L21
[CDEF]: ../baseline/curated-scala/net/imadz/application/services/transactor/MoneyTransferSagaDefinition.scala#L61-L70
[EXEC]: ../baseline/curated-scala/net/imadz/infra/saga/StepExecutor.scala#L149-L177
[COORD]: ../baseline/curated-scala/net/imadz/infra/saga/SagaTransactionCoordinator.scala#L229-L247
[CLI]: ../baseline/js/lib/products/generate-cli.mjs#L1-L146
[JG]: ../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L1-L71
[JL]: ../baseline/js/generators/scala-cqrs-play-service/render-aggregate-layers.mjs#L1-L30
[JB]: ../baseline/js/generators/scala-cqrs-play-service/build-aggregate-models.mjs#L1-L42
[JN]: ../baseline/js/generators/scala-cqrs-play-service/aggregate-names.mjs#L1-L30
[JT]: ../baseline/js/generators/scala-cqrs-play-service/templates/aggregate-bootstrap.mjs#L1-L34
[SERVICE]: ../baseline/js/generators/scala-cqrs-play-service/render-service.mjs#L1-L32
[JREAD]: ../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs#L151-L259
[LE]: ../baseline/js/generators/bootstrap-dsl/emit.mjs#L1-L365
[PIPE]: ../baseline/js/generators/pipeline.mjs#L99-L135
[LG]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generate.mjs#L138-L177
[LB]: ../baseline/js/generators/_deprecated/scala-cqrs-es/builders/bootstrap.mjs#L1-L182
[LT]: ../baseline/js/generators/_deprecated/scala-cqrs-es/templates/persistence.mjs#L50-L73
[LM]: ../baseline/js/generators/_deprecated/scala-cqrs-es/generator.json#L1-L36
[CORE]: ../baseline/js/src/core/generate.mjs#L1-L268
[MANIFEST]: ../baseline/js/src/core/manifest.mjs#L1-L28
[FG]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/generate.mjs#L1-L24
[FB]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/build-models.mjs#L1-L248
[FR]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/render.mjs#L1-L35
[FT]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/bootstrap.mjs#L1-L13
[FI]: ../baseline/js/generators/scala-cqrs-aggregate-core-v1/templates/imports.mjs#L1-L25
[FP]: ../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/persistence.mjs#L149-L157
[NAMES]: ../baseline/js/lib/scala-target/naming.mjs#L26-L118
