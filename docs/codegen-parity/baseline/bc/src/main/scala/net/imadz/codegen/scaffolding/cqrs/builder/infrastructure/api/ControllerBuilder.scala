package net.imadz.codegen.scaffolding.cqrs.builder.infrastructure.api

import net.imadz.codegen.scaffolding.cqrs.model.infrastructure.api.{
  Addressing,
  ControllerModel,
  CtorArgRef,
  DslFlags,
  EndpointModel,
  ErrorPayloadVo,
  GateKind,
  GuardSpec,
  ReqVo,
  ServesTarget,
  ViewForm,
  ViewReadModel
}
import net.imadz.codegen.scaffolding.cqrs.{
  FieldDef,
  GeneratorContext,
  TypeRef,
  TypeResolver
}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._

object ControllerBuilder {

  def build(
      meta: ControllerMetadata,
      ctx: GeneratorContext
  ): ControllerModel = {
    val pkg = ctx.layout.infrastructure.api.root
    val selfType = ctx.typeResolver.controller(meta.name)

    // 构建端点
    val endpoints = buildEndpoints(meta, ctx)

    // S7（EP §二 G1）：控制器知识身份＝**聚合号**（真源 0 条 controller 便签——实名核实后
    // 挂母元素聚合；ControllerMetadata 是应用层派生制品·无自带便签，且无 aggregate 字段）。
    // 归属判定复用既有 resolveCommand（serves 命令→其属主聚合·与注入面同源）；
    // 解析失败留空不抛——控制器发射优先级高于知识锚，不因缺号阻断生成。
    val ownerNoteIds: Seq[String] = endpoints
      .flatMap(_.serves.collect { case ServesTarget.Command(cmd) => cmd })
      .flatMap(resolveCommand(_, ctx))
      .map(_._2)
      .distinctBy(_.name)
      .flatMap(_.noteId)
      .distinct
    // S7 #1c：读侧端点（ServesView）的号在投影面——viewDef.repository 反查投影（viewNoteIdsFor）。
    // 此前只收命令侧 ⇒ ViewApiController 类控制器 0 号。两侧并集＝「本控制器服务的全部知识」。
    val viewNoteIds: Seq[String] = endpoints
      .flatMap(_.readModel)
      .flatMap(viewNoteIdsFor(_, ctx))
      .distinct

    // 构建注入的服务
    val injectedServices = buildInjectedServices(meta, ctx)

    // 收集并过滤依赖
    val dependencies = collectDependencies(endpoints, injectedServices, ctx)

    // S2-32 R5a：聚合级 DSL flags（M8——纯决策，不改动既有注入面/依赖面）
    val dslFlags = buildDslFlags(endpoints)

    // S2-32 R5b 合法回补：DSL 控制器注入面/import 面素材（node buildAggregateController
    // 注入面决策的 SystemMetadata 化——api 由 Template 固定渲染，repository/Flow 经
    // injectedServices 补齐；gate=None 控制器不经此路径——零漂移承诺保持）
    val (finalServices, finalDependencies) =
      if (dslFlags.aggHasDsl)
        backfillDslInjections(endpoints, injectedServices, dependencies, ctx)
      else (injectedServices, dependencies)

    ControllerModel(
      selfType,
      meta.basePath,
      finalServices,
      endpoints,
      finalDependencies,
      dslFlags,
      modulePkg = Some(ctx.basePackage),
      noteIds = (ownerNoteIds ++ viewNoteIds).distinct
    )
  }

  /** 构建端点模型列表
    */
  private def buildEndpoints(
      meta: ControllerMetadata,
      ctx: GeneratorContext
  ): Seq[EndpointModel] = {
    meta.endpoints.map { epMeta =>
      // S2-32 R5a：DSL 轴判定（B1-B3/B6——纯决策零文本）；既有六字段填充逻辑逐字保留
      // （B4 签名收窄／M10 OkReceipt 统一／M11 命令名升格＝R5b Template 消费新轴后的分支改造面）
      val dsl = buildDslAxis(epMeta, ctx)
      EndpointModel(
        method = epMeta.method,
        path = epMeta.path,
        actionName = epMeta.actionName,
        parameters = buildEndpointParameters(epMeta, ctx),
        serviceMethod = epMeta.logic.intent,
        returnType = resolveResponseType(epMeta, ctx),
        gate = dsl.gate,
        gateKind = dsl.gateKind,
        serves = dsl.serves,
        reqVo = dsl.reqVo,
        errorPayloads = dsl.errorPayloads,
        idGuard = dsl.idGuard,
        instantGuard = dsl.instantGuard,
        ctorArgs = dsl.ctorArgs,
        addressing = dsl.addressing,
        readModel = dsl.readModel,
        skip = dsl.skip
      )
    }
  }

  // ==========================================
  // S2-32 R5a：DSL 轴判定（发射规格 23162fd §一 B1-B3/B6·§三门表·§四 Req 双轨·§五 409）
  // 纯决策零文本：判定结果进 EndpointModel DSL 字段，发射归 R5b Template。
  // gate=None＝未声明门＝存量 stub 路径（§三 Vega 拍板·渐进采纳）——全默认零判定。
  // ==========================================

  /** 单端点 DSL 轴判定结果（Builder 内部装配载体——逐字段落入 EndpointModel）。 */
  private final case class DslAxis(
      gate: Option[String] = None,
      gateKind: Option[GateKind] = None,
      serves: Option[ServesTarget] = None,
      reqVo: Option[ReqVo] = None,
      errorPayloads: Seq[ErrorPayloadVo] = Nil,
      idGuard: Option[GuardSpec] = None,
      instantGuard: Option[GuardSpec] = None,
      ctorArgs: Seq[CtorArgRef] = Nil,
      addressing: Option[Addressing] = None,
      readModel: Option[ViewReadModel] = None,
      skip: Option[String] = None
  )

  private def buildDslAxis(
      epMeta: EndpointMetadata,
      ctx: GeneratorContext
  ): DslAxis =
    epMeta.gate match {
      case None => DslAxis() // 未声明门＝不校验不改造（H053 触发面＝gate 非空——R4 语义对齐）
      case Some(ref) =>
        val gateKind = tierOf(ref.value, epMeta.actionName, ctx) // B1＋H053 第二防线
        val serves = epMeta.serves.map(toServesTarget(_, ctx))
        val errorPayloads = epMeta.errorPayloads.map(toErrorPayloadVo(_, ctx))
        serves match {
          case Some(ServesTarget.Command(commandName)) =>
            resolveCommand(commandName, ctx) match {
              case Some((command, aggregate)) =>
                deriveCommandAxis(
                  epMeta,
                  ref.value,
                  gateKind,
                  serves,
                  errorPayloads,
                  command,
                  aggregate
                )
              case None =>
                // 生成期 fail-fast 兜底（对齐 H053 第二防线先例——炸出优于静默 null）：
                // Req VO/guard/ctor 均依赖命令参数，命令不可解析即无法产出完整 IR。
                throw new IllegalArgumentException(
                  s"[ControllerBuilder] Endpoint('${epMeta.actionName}') serves=ServesCommand($commandName) 在聚合命令族中不可解析——DSL 轴无法推导（命令存在性主防线归命令族校验器；fail-fast 先例＝resolveIdentityStoreHook）"
                )
            }
          // S2-40 R6：读侧轴（ServesView → ViewKeyDefinition 查表——ViewApiController 发射规格形态 5）
          case Some(ServesTarget.View(viewKey)) =>
            deriveViewAxis(epMeta, ref.value, gateKind, viewKey, ctx)
          case _ =>
            // ServesUseCase（形态 3 Flow 委托）／未声明 serves：Req 走 requestBody 辅轨；
            // Flow 参数编排深化归 R5b/R5c（node register 硬编码四件的元数据化承接）。
            DslAxis(
              gate = Some(ref.value),
              gateKind = Some(gateKind),
              serves = serves,
              reqVo = epMeta.requestBody.map(explicitReqVoOf),
              errorPayloads = errorPayloads
            )
        }
    }

  /** B1/§三：tierOf 判定——ApplicationLayer.gates 声明驱动（node GATE_NAMES/BOOTSTRAP_TIERS
    * 硬编码表的元数据化升级：门名是应用数据，(requiresIdentity, requiresTenant) 两维决定档位）。
    * H053 第二防线（生成期 fail-fast）：gate 未注册即炸——真源绕过校验直驱生成时兜底
    * （主防线＝R4 SystemMetadataValidator；对齐 node core.mjs:36 与 resolveIdentityStoreHook 先例）。 */
  private def tierOf(
      gateName: String,
      endpointName: String,
      ctx: GeneratorContext
  ): GateKind =
    ctx.metaRegistry.resolveByName[GateDefinition](gateName) match {
      case Some(gate) =>
        (gate.requiresIdentity, gate.requiresTenant) match {
          case (false, false) => GateKind.Anonymous
          case (true, false)  => GateKind.Global
          case (true, true)   => GateKind.Tenant
          case (false, true) =>
            throw new IllegalStateException(
              s"[ControllerBuilder] H053 fail-fast: 门 [$gateName] 声明 (requiresIdentity=false, requiresTenant=true)——语义矛盾（GateDefinition 构造器第一防线应已拦截）"
            )
        }
      case None =>
        throw new IllegalArgumentException(
          s"[ControllerBuilder] H053 fail-fast（生成期第二防线）: Endpoint('$endpointName') 引用门 [$gateName] 未在 ApplicationLayer.gates 注册——无法判定门档（主防线＝SystemMetadataValidator H053；fail-fast 先例＝node core.mjs:36/resolveIdentityStoreHook）"
        )
    }

  /** 命令解析：serves=ServesCommand(cmd) → (命令, 归属聚合)——聚合身份字段（identifier）
    * 是路径寻址/工厂发号判定的声明源。 */
  private def resolveCommand(
      commandName: String,
      ctx: GeneratorContext
  ): Option[(SubordinateCommandMetadata, AggregateRootMetadata)] =
    ctx.metaRegistry
      .resolveAll[AggregateRootMetadata]
      .flatMap(agg =>
        agg.commandFamily.commands
          .find(_.name == commandName)
          .map(cmd => (cmd, agg))
      )
      .headOption

  /** 命令直发端点的 DSL 轴推导（B2 Req 五规则＋B3 guard/ctor 组成＋B6 skip）。 */
  private def deriveCommandAxis(
      epMeta: EndpointMetadata,
      gateName: String,
      gateKind: GateKind,
      serves: Option[ServesTarget],
      errorPayloads: Seq[ErrorPayloadVo],
      command: SubordinateCommandMetadata,
      aggregate: AggregateRootMetadata
  ): DslAxis = {
    val skip = skipOf(command)
    if (skip.isDefined) {
      // B6：skip＝显式注记不发射（形态 8 同族）——不推导 Req/guard/ctor
      DslAxis(
        gate = Some(gateName),
        gateKind = Some(gateKind),
        serves = serves,
        errorPayloads = errorPayloads,
        skip = skip
      )
    } else {
      // B2·T02 保守化：路径寻址键＝tenant 档且命令含聚合同名 Id 参数
      // （node aggNamed 命名约定的声明式升级：AggregateRootMetadata.identifier 即聚合身份字段）
      val pathKey: Option[ParameterMetadata] = gateKind match {
        case GateKind.Tenant =>
          command.parameters.find(p =>
            isIdType(p) && p.name.equalsIgnoreCase(aggregate.identifier.name)
          )
        case _ => None
      }
      val addressing =
        if (pathKey.isDefined) Addressing.Path else Addressing.Factory
      val strictFields = strictFieldsOf(command, gateKind, aggregate, pathKey)
      // §四双轨：requestBody 显式声明优先（Vega 拍板）；主轨＝命令参数五规则推导
      val reqVo = epMeta.requestBody
        .map(explicitReqVoOf)
        .getOrElse(derivedReqVo(command, strictFields))
      DslAxis(
        gate = Some(gateName),
        gateKind = Some(gateKind),
        serves = serves,
        reqVo = Some(reqVo),
        errorPayloads = errorPayloads,
        idGuard = idGuardOf(command, gateKind, aggregate, pathKey),
        instantGuard = instantGuardOf(strictFields),
        ctorArgs = ctorArgsOf(command, gateKind, aggregate, pathKey),
        addressing = Some(addressing),
        skip = None
      )
    }
  }

  /** S2-40 R6：读侧轴推导（ServesView → ViewKeyDefinition 查表 → ViewReadModel——发射规格
    * §二形态 5·ViewApiController 发射源的判定面）。三防线/判定：
    * ①H052 生成期第二防线：viewKey 未在 ApplicationLayer.viewKeys 注册即 fail-fast（对齐
    *   tierOf H053 先例——主防线＝SystemMetadataValidator，动态槽位绕过校验直驱生成时兜底）；
    * ②查询注入源＝ViewKeyDefinition.repository（投影仓库——node ViewModel.repoParam/viewName 的
    *   元数据化；行类型＝投影 DTO 的 <Repo>Table 嵌套位·node ROW_TYPE 同构，仓库不可解析即 fail-fast）；
    * ③形态＝端点签名承载（(page,pageSize)＝分页列表／(entityId)＝单行——node 一视图两端点映射）；
    * ④读档＝tenant/global 两档（node 读侧形态集）——anonymous 读 fail-fast。
    * 已知边界（如实注记·不硬造）：tenantOf 过滤发射 `_.tenantId`（node 固定形态——行 DTO 须有
    * tenantId 字段）；findAll/findByIdentity 为投影仓库标准读契约（banking monthly 仓库声明
    * filterByPeriodLCRO——发射按 node 契约、方法集缺口属真源元数据边界，归延伸批）。 */
  private def deriveViewAxis(
      epMeta: EndpointMetadata,
      gateName: String,
      gateKind: GateKind,
      viewKey: String,
      ctx: GeneratorContext
  ): DslAxis = {
    val viewDef = ctx.metaRegistry.resolveByName[ViewKeyDefinition](viewKey).getOrElse(
      throw new IllegalArgumentException(
        s"[ControllerBuilder] H052 fail-fast（生成期第二防线）: Endpoint('${epMeta.actionName}') serves=ServesView($viewKey) 未在 ApplicationLayer.viewKeys 注册——读侧轴无法推导（主防线＝SystemMetadataValidator H052；fail-fast 先例＝tierOf H053）"
      )
    )
    if (gateKind == GateKind.Anonymous)
      throw new IllegalArgumentException(
        s"[ControllerBuilder] Endpoint('${epMeta.actionName}') ServesView($viewKey) 声明 anonymous 档——读侧端点不在发射集（node ViewApiController 仅 tenant/global 两档读：身份档才可挂 CommandRoleMap.of(vk) 角色门）"
      )
    val form = viewFormOf(epMeta)
    if (form == ViewForm.ItemView && !viewDef.singleKey && gateKind != GateKind.Tenant)
      throw new IllegalArgumentException(
        s"[ControllerBuilder] Endpoint('${epMeta.actionName}') ServesView($viewKey) 复合键视图 item＋非 tenant 档——compositeItem 为 tenant 档固定形态（ViewApiController:92-98），global 档读侧仅 globalList/globalItem 两形态"
      )
    val repoMeta = ctx.metaRegistry
      .resolve[ProjectionRepositoryMetadata](viewDef.repository)
      .getOrElse(
        throw new IllegalArgumentException(
          s"[ControllerBuilder] Endpoint('${epMeta.actionName}') serves=ServesView($viewKey) 的投影仓库 [${viewDef.repository.targetName}] 不可解析——读侧查询注入源缺失（ViewKeyDefinition.repository 引用悬空）"
        )
      )
    val repoTypeRef = ctx.typeResolver.projectionRepository(repoMeta.name)
    val baseName = NamingConventions.getBaseName(repoMeta.name)
    val rowType = ctx.typeResolver.projectionDtoType(
      baseName,
      s"${baseName}Table",
      ctx.layout.application.projection.repository.root
    )
    DslAxis(
      gate = Some(gateName),
      gateKind = Some(gateKind),
      serves = Some(ServesTarget.View(viewKey)),
      readModel = Some(
        ViewReadModel(
          viewKey = viewKey,
          constName = viewKey.split('-').filter(_.nonEmpty)
            .map(w => s"${w.head.toUpper}${w.tail}").mkString,
          rowType = rowType,
          repository = FieldDef(
            s"${repoTypeRef.name.head.toLower}${repoTypeRef.name.tail}",
            repoTypeRef
          ),
          form = form,
          singleKey = viewDef.singleKey
        )
      )
    )
  }

  /** S7 #1c：读侧端点的投影读数——`viewDef.repository`（投影仓库引用）→ 其投影的号。
    * 与 `viewDefinitionOf` 同源解析（ViewKeyDefinition.repository 唯一入口）；
    * 投影反查复用 `ProjectionRepositoryImplBuilder` 的 `repositoryRef` 手法。解不到如实留空。 */
  private def viewNoteIdsFor(readModel: ViewReadModel, ctx: GeneratorContext): Seq[String] = {
    val repoName = readModel.repository.typeRef.name
    ctx.metaRegistry
      .resolveAll[DomainDrivenMetadata]
      .find(m => m.name == repoName && m.isInstanceOf[ProjectionRepositoryMetadata])
      .flatMap(_ => ctx.metaRegistry.resolveAll[ProjectionMetadata]
        .find(_.repositoryRef.exists(_.targetName == repoName)))
      .flatMap(_.noteId)
      .toSeq
  }

  /** R6 读端点形态判定（端点签名承载——node 一视图两端点映射）：(page: Int, pageSize: Int)＝
    * 分页列表（pageGuard 契约）；(entityId: String)＝单行；其他签名 fail-fast（读侧签名契约外
    * 不可发射——半吊子读端点炸出优于错发射）。 */
  private def viewFormOf(epMeta: EndpointMetadata): ViewForm =
    epMeta.parameters match {
      // 只按「名字 + 类型」认读侧签名契约——**投影成元组再匹配**，元数据加字段（optional/noteId/description…）
      // 这里永不碎。此前用位置模式 + 占位参数，每加一个字段就崩一次（2026-09-20 连踩两次）。
      case Seq(a, b) if (a.name, a.parameterType, b.name, b.parameterType) ==
        (("page", IntType, "pageSize", IntType)) =>
        ViewForm.ListView
      case Seq(a) if (a.name, a.parameterType) == (("entityId", StringType)) =>
        ViewForm.ItemView
      case other =>
        throw new IllegalArgumentException(
          s"[ControllerBuilder] Endpoint('${epMeta.actionName}') ServesView 读端点签名不在读侧契约（(page: Int, pageSize: Int)＝分页列表／(entityId: String)＝单行——实际签名 [${other.map(p => s"${p.name}: ${p.parameterType}").mkString(", ")}]）"
        )
    }

  /** B6 skip 决策：VO-List 嵌套 VO 命令（node 白名单放行机制是 Atlas 锁定区特判，Scala 侧
    * 暂全 skip——B4 邻接余量）／查询型 Reply（isReadOnly——读侧契约归 R5c 形态 5）。 */
  private def skipOf(command: SubordinateCommandMetadata): Option[String] =
    command.parameters.find(isVoListParam).map(p =>
      s"${command.name}(${p.name}: List[...])——VO-List 嵌套 VO 命令暂缓（B4 邻接余量）"
    ).orElse(
      if (command.isReadOnly)
        Some(s"${command.name}（查询型 Reply——读侧契约归 R5c 形态 5·暂缓）")
      else None
    )

  private def isVoListParam(p: ParameterMetadata): Boolean =
    p.parameterType match {
      case CustomType("List", _, Seq(StringType)) => false
      case CustomType("List", _, _)               => true
      case _                                      => false
    }

  /** B2/§四：载荷严格必填字段集五规则（node strictFieldsOf 语义翻译）：
    * ①triggeredBy 剥离（ctx 身份注入位：tenant 档 ts.userId／global 档 gc.userId）
    * ②tenant 档 tenantId 一律会话注入（Id.of(ts.tenantId)——c898bd0），不入 body
    * ③global 档聚合同名 Id＝工厂发号（Id.of(generatedId)），不入 body；非聚合同名（accept 的 tenantId）保持 body 契约
    * ④路径寻址键不入 body（路径参数走 IdGuard）
    * ⑤Id/Instant 入 VO 降 String＋optional→Option[String]（reqTypeOf 承载） */
  private def strictFieldsOf(
      command: SubordinateCommandMetadata,
      gateKind: GateKind,
      aggregate: AggregateRootMetadata,
      pathKey: Option[ParameterMetadata]
  ): Seq[ParameterMetadata] = {
    val identityName = aggregate.identifier.name
    command.parameters.filterNot { p =>
      p.name == "triggeredBy" ||
      (gateKind == GateKind.Tenant && p.name == "tenantId") ||
      (gateKind == GateKind.Global && p.name
        .equalsIgnoreCase(identityName) && isIdType(p)) ||
      Some(p) == pathKey
    }
  }

  /** M2：Req VO 主轨装配——严格字段集推导；空集退化→形态 2（write[JsObject]＋emptyBodyReads）。 */
  private def derivedReqVo(
      command: SubordinateCommandMetadata,
      strictFields: Seq[ParameterMetadata]
  ): ReqVo =
    if (strictFields.isEmpty)
      ReqVo(
        reqName = "play.api.libs.json.JsObject",
        reqFields = Nil,
        hasEmptyBody = true
      )
    else
      ReqVo(
        reqName = s"${command.name}Req",
        reqFields = strictFields.map(p =>
          FieldDef(scalaId(p.name), reqTypeOf(p))
        ),
        hasEmptyBody = false
      )

  /** §四辅轨：requestBody 显式声明——直接引用既有 VO 形状（R5b 导入引用·不重复发射 companion）。 */
  private def explicitReqVoOf(body: DataType): ReqVo = body match {
    case CustomType(typeName, _, _) =>
      ReqVo(typeName, Nil, hasEmptyBody = false, explicit = true)
    case other =>
      ReqVo(
        other.getClass.getSimpleName,
        Nil,
        hasEmptyBody = false,
        explicit = true
      )
  }

  /** §四规则⑤：Id/Instant→String（边界由 Guard 转换）；List[X]→List[映射 X]；
    *  optional→Option[...]；原语保持；其余 CustomType 按声明携带。 */
  private def reqTypeOf(p: ParameterMetadata): TypeRef = {
    val mapped = jsonTypeOf(p.parameterType)
    if (p.optional) TypeRef.Option(mapped) else mapped
  }

  private def jsonTypeOf(t: MetaType): TypeRef = t match {
    case StringType     => TypeRef.String
    case IntType        => TypeRef.Int
    case LongType       => TypeRef.Long
    case DoubleType     => TypeRef.Double
    case BooleanType    => TypeRef.Boolean
    case BigDecimalType => TypeRef.BigDecimal
    case CustomType(typeName, _, _)
        if typeName == "Id" || typeName.contains("Instant") =>
      TypeRef.String
    case CustomType("List", _, typeParams) if typeParams.nonEmpty =>
      TypeRef.List(jsonTypeOf(typeParams.head))
    case CustomType(typeName, packagePath, _) => TypeRef(typeName, packagePath)
    case ref: MetaRef                          => TypeRef(ref.targetName, "")
    case other =>
      throw new IllegalArgumentException(
        s"[ControllerBuilder] 不支持的 Req 字段类型: $other"
      )
  }

  /** B3：Id 边界防护组成（node idRefsOf 翻译）——Id 型参数经 Guard 解析（bad UUID→400）；
    *  tenant 档 tenantId 会话注入位排除（路径键除外）；global 档聚合同名 Id 工厂发号排除。 */
  private def idGuardOf(
      command: SubordinateCommandMetadata,
      gateKind: GateKind,
      aggregate: AggregateRootMetadata,
      pathKey: Option[ParameterMetadata]
  ): Option[GuardSpec] = {
    val identityName = aggregate.identifier.name
    val idRefs = command.parameters.filter { p =>
      val excluded =
        (gateKind == GateKind.Tenant && p.name == "tenantId" && Some(
          p
        ) != pathKey) ||
          (gateKind == GateKind.Global && p.name
            .equalsIgnoreCase(identityName) && isIdType(p))
      !excluded && isIdType(p)
    }
    if (idRefs.isEmpty) None
    else
      Some(
        GuardSpec(
          pairs = idRefs.map(p =>
            if (Some(p) == pathKey) (p.name, "id")
            else (p.name, s"req.${scalaId(p.name)}")
          ),
          binds = idRefs.map(cidNameOf)
        )
      )
  }

  /** B3/形态 7：Instant 边界防护（非 ISO-8601→400）——外层 InstantGuard→内层 IdGuard
    *  嵌套固定顺序的组装归 R5b（node tpl_dsl.mjs guardWrapped 先例）。 */
  private def instantGuardOf(
      strictFields: Seq[ParameterMetadata]
  ): Option[GuardSpec] = {
    val instants = strictFields.filter(p => isInstantType(p.parameterType))
    if (instants.isEmpty) None
    else
      Some(
        GuardSpec(
          pairs = instants.map(p => (p.name, s"req.${scalaId(p.name)}")),
          binds = instants.map(instantBindOf)
        )
      )
  }

  /** B3/M5：ctor 实参来源决策（node ctorArgsDsl 结构化——逐参数有序，表达式文本组装归 R5b）。 */
  private def ctorArgsOf(
      command: SubordinateCommandMetadata,
      gateKind: GateKind,
      aggregate: AggregateRootMetadata,
      pathKey: Option[ParameterMetadata]
  ): Seq[CtorArgRef] = {
    val identityName = aggregate.identifier.name
    command.parameters.map {
      case p if Some(p) == pathKey =>
        CtorArgRef.FromPathId(p.name, cidNameOf(p))
      case p if p.name == "triggeredBy" =>
        CtorArgRef.FromSessionUser(p.name, gateKind)
      case p if p.name == "tenantId" && gateKind == GateKind.Tenant =>
        CtorArgRef.FromSessionTenant(p.name)
      case p
          if gateKind == GateKind.Global && p.name
            .equalsIgnoreCase(identityName) && isIdType(p) =>
        CtorArgRef.FromGeneratedId(p.name)
      case p if isIdType(p)          => CtorArgRef.FromGuard(p.name, cidNameOf(p))
      case p if isInstantType(p.parameterType) =>
        CtorArgRef.FromInstantGuard(p.name, instantBindOf(p))
      case p if p.optional           => CtorArgRef.FromBodyOptional(p.name)
      case p                         => CtorArgRef.FromBody(p.name)
    }
  }

  /** M7：EndpointTarget → ServesTarget 映射。S2-32 R5c（P5）：ServesUseCase 富化——
    * UseCaseMetadata 声明的 flowMethod/flowArgs（形态 3 Flow 委托编排轴）；用例不可解析时
    * 走默认值（H052 悬空校验归主防线，Builder 保持容忍——与 requestBody 辅轨同语义）。 */
  private def toServesTarget(
      target: EndpointTarget,
      ctx: GeneratorContext
  ): ServesTarget =
    target match {
      case EndpointTarget.ServesCommand(command) => ServesTarget.Command(command)
      case EndpointTarget.ServesUseCase(useCase) =>
        val uc = ctx.metaRegistry.resolveByName[UseCaseMetadata](useCase)
        ServesTarget.UseCase(
          useCase,
          flowMethod = uc.flatMap(_.flowMethod),
          flowArgs = uc.map(_.flowArgs).getOrElse(Nil)
        )
      // S2-40 R6：读侧——ViewKeyDefinition 查表归 deriveViewAxis（此处仅词表映射；
      // 未注册/仓库悬空的 fail-fast 与 IR 推导同点承载）
      case EndpointTarget.ServesView(viewKey) => ServesTarget.View(viewKey)
    }

  /** M3：409 payload VO——VO 名＝errorCode PascalCase 声明式推导
    *  （node ConceptNameTaken 名字特判的元数据化：CONCEPT_NAME_TAKEN→ConceptNameTaken）。
    *  S2-32 R5c（P1）：conflictMessage＝errorCode→invariant 条件关联（§五「查重条件由既有
    *  invariant 体系承载（errorCode 关联）」的消费）；无锚点＝None（发射回退 errorCode·不硬造文案）。 */
  private def toErrorPayloadVo(
      spec: ErrorPayloadSpec,
      ctx: GeneratorContext
  ): ErrorPayloadVo =
    ErrorPayloadVo(
      spec.errorCode,
      pascalCaseOf(spec.errorCode),
      spec.payloadFields,
      conflictMessageOf(spec.errorCode, ctx)
    )

  /** §五：errorCode 关联既有 invariant 语义——全系统 InvariantCondition.errorCode 命中
    *  即取其 logic.intent 作为 409 冲突文案（既有语义的约定推导，非生成器自造）。
    *  真源实证（R5c 侦察）：摄入侧条件码＝RC1/RC2 序号（AssemblyEngine:336），语义码
    *  （如 CONCEPT_NAME_TAKEN）不在结构化词表——文案需元数据作者在 invariant 条件上声明。 */
  private def conflictMessageOf(
      errorCode: String,
      ctx: GeneratorContext
  ): Option[String] =
    ctx.metaRegistry.resolveAll[InvariantRuleMetadata]
      .flatMap(_.conditions)
      .find(_.errorCode == errorCode)
      .map(_.logic.intent)

  private def pascalCaseOf(errorCode: String): String =
    errorCode
      .split('_')
      .filter(_.nonEmpty)
      .map(w => s"${w.head.toUpper}${w.tail.toLowerCase}")
      .mkString

  /** M8：聚合级 flags——全声明驱动（needsParkRepo＝errorPayloads 非空·node EstablishConcept
    *  特判的元数据化；needsRegisterFlow＝ServesUseCase 存在·node RegisterUser 特判的元数据化）。 */
  private def buildDslFlags(endpoints: Seq[EndpointModel]): DslFlags = DslFlags(
    aggHasDsl = endpoints.exists(e => e.gate.isDefined && e.skip.isEmpty),
    aggHasEmptyBody =
      endpoints.exists(e => e.skip.isEmpty && e.reqVo.exists(_.hasEmptyBody)),
    needsParkRepo = endpoints.exists(_.errorPayloads.nonEmpty),
    needsRegisterFlow =
      endpoints.exists(_.serves.exists(_.isInstanceOf[ServesTarget.UseCase]))
  )

  // ==========================================
  // S2-32 R5b：DSL 控制器注入面合法回补（发射规格 23162fd §一 B5——node
  // buildAggregateController/tpl_controller.mjs:8-11 注入面决策的元数据化：
  // api（全档·Template 固定渲染）＋repository（命令直发·单聚合约定）＋
  // <useCase>Flow（ServesUseCase·D3 手写编排锚点）；protocol/仓库/Flow TypeRef
  // 入 dependencies 供 Template import 面（protocol._／FQN）。
  // ==========================================

  private def backfillDslInjections(
      endpoints: Seq[EndpointModel],
      injectedServices: Seq[FieldDef],
      dependencies: Set[TypeRef],
      ctx: GeneratorContext
  ): (Seq[FieldDef], Set[TypeRef]) = {
    val active = endpoints.filter(e => e.gate.isDefined && e.skip.isEmpty)
    // ① repository：命令直发端点 → 归属聚合仓库（node 先例＝一聚合一控制器；多聚合 fail-fast 归 R5c）
    val commandAggregates = active
      .flatMap(_.serves.collect { case ServesTarget.Command(cmd) => cmd })
      .flatMap(resolveCommand(_, ctx))
      .map(_._2)
      .distinct
    val repositoryOpt = commandAggregates match {
      case Nil => None
      case Seq(agg) =>
        Some(FieldDef("repository", ctx.typeResolver.aggregateRepository(agg.name)))
      case many =>
        throw new IllegalArgumentException(
          s"[ControllerBuilder] DSL 控制器服务多聚合命令（${many.map(_.name).mkString(", ")}）——" +
            s"repository 注入面按单聚合约定发射（node 一聚合一控制器先例）；多聚合控制器归 R5c"
        )
    }
    // ①' S2-32 R5c（P1·形态 6）：409 查重视图仓库注入——errorPayloads 端点（needsParkRepo·node
    // EstablishConcept 特判的声明化）→ 归属聚合的投影仓库（ProjectionMetadata.repositoryRef 解析；
    // 单投影约定——多投影聚合的查重视图不可判定即 fail-fast，炸出优于错查重）。
    val parkRepoOpt = parkViewRepositoryOf(active, commandAggregates, ctx)
    // ①'' S2-40 R6（读侧）：视图查询仓库注入——ServesView 端点 readModel.repository
    // （ViewKeyDefinition.repository 解析的投影仓库·FieldDef 已在 IR 携带）；与 repository/
    // parkRepo 同名去重（一仓一注入），行类型 import 面由 Template 按 readModel.rowType 收窄。
    // 注入顺序＝parkRepo 先于 viewRepo（Template 409 查重仓库位按包位嗅探——保持 parkRepo
    // 可被 find 命中；读端点仓库走 IR 直引不受嗅探影响）。
    val viewRepoDefs = active
      .flatMap(_.readModel.map(_.repository))
      .distinctBy(_.typeRef.name)
    // ② Flow 委托注入：serves=ServesUseCase → <useCase>Flow（应用根包——node RegisterUserFlow 同位）
    val flowServices = active
      .flatMap(_.serves.collect { case ServesTarget.UseCase(uc, _, _) => uc })
      .distinct
      .map(uc =>
        FieldDef(
          s"${uc.head.toLower}${uc.tail}Flow",
          TypeRef(s"${uc}Flow", ctx.layout.application.root)
        )
      )
    // 同名 meta 服务去重（DSL 面以 canonical 名 repository 注入——避免双份同型注入）
    val repoTypeNames = repositoryOpt.map(_.typeRef.name).toSet ++
      parkRepoOpt.map(_.typeRef.name) ++ viewRepoDefs.map(_.typeRef.name)
    val remainingServices =
      injectedServices.filterNot(s => repoTypeNames.contains(s.typeRef.name))
    val services =
      repositoryOpt.toSeq ++ parkRepoOpt.toSeq ++ viewRepoDefs ++ flowServices ++ remainingServices
    // ③ import 面素材：protocol（命令聚合·与 AggregateProtocolBuilder 同名公式）＋仓库＋Flow
    val protocolDeps = commandAggregates.map { agg =>
      val baseName = NamingConventions.getBaseName(agg.name)
      TypeRef(s"${baseName}Protocol", ctx.layout.application.aggregates.root)
    }
    val deps = dependencies ++ repositoryOpt.map(_.typeRef) ++ parkRepoOpt.map(_.typeRef) ++
      viewRepoDefs.map(_.typeRef) ++ flowServices.map(_.typeRef) ++ protocolDeps
    (services, deps)
  }

  /** P1/形态 6：查重视图仓库解析——409 端点命令归属聚合 → ProjectionMetadata（effectiveAggregates
    *  命中·单投影约定）→ repositoryRef → 投影仓库 TypeRef（application.projection.repository 位）。
    *  无投影/多投影均 fail-fast（与单聚合 fail-fast 同族——半吊子查重不可发射）。
    *  字段名约定＝仓库类名 camelCase（node 硬编码 parkConceptViewRepository 的声明式推导变体）。 */
  private def parkViewRepositoryOf(
      active: Seq[EndpointModel],
      commandAggregates: Seq[AggregateRootMetadata],
      ctx: GeneratorContext
  ): Option[FieldDef] = {
    val dedupAggregates = active
      .filter(_.errorPayloads.nonEmpty)
      .flatMap(_.serves.collect { case ServesTarget.Command(cmd) => cmd })
      .flatMap(resolveCommand(_, ctx))
      .map(_._2)
      .distinct
    if (dedupAggregates.isEmpty) None
    else {
      // 单聚合约定已由 ① fail-fast 保证；409 聚合必属其子集——此处再校验防漏网
      val aggregate = dedupAggregates.head
      if (!commandAggregates.exists(_.name == aggregate.name))
        throw new IllegalArgumentException(
          s"[ControllerBuilder] 409 端点命令归属聚合 [${aggregate.name}] 与控制器命令聚合不一致——单聚合约定破坏"
        )
      ctx.metaRegistry.resolveAll[ProjectionMetadata]
        .filter(_.effectiveAggregates.contains(aggregate.name)) match {
        case Seq(projection) =>
          projection.repositoryRef.map { ref =>
            val typeRef = ctx.typeResolver.projectionRepository(ref.targetName)
            FieldDef(s"${typeRef.name.head.toLower}${typeRef.name.tail}", typeRef)
          }.orElse {
            throw new IllegalArgumentException(
              s"[ControllerBuilder] 409 查重视图仓库不可解析：投影 [${projection.name}] 未声明 repositoryRef"
            )
          }
        case Nil =>
          throw new IllegalArgumentException(
            s"[ControllerBuilder] 409 查重前置需要投影仓库——聚合 [${aggregate.name}] 无投影声明（errorPayloads 需要查重视图）"
          )
        case many =>
          throw new IllegalArgumentException(
            s"[ControllerBuilder] 聚合 [${aggregate.name}] 多投影（${many.map(_.name).mkString(", ")}）——查重视图不可判定（单投影约定；视图指定词汇归后续批）"
          )
      }
    }
  }

  // ── 词法助手（node core.mjs id/bindNameOf/cidNameOf 翻译）──

  /** Scala 标识符位反引号（关键字字段 `type` 等——BUG-005 约定；渲染位前移至 IR 名字）。 */
  private val SCALA_KEYWORDS = Set(
    "type", "class", "def", "val", "var", "object", "trait", "package",
    "import", "case", "match", "else", "then", "yield", "while", "return",
    "throw", "new", "extends", "with", "final", "sealed", "abstract", "lazy",
    "override", "implicit", "private", "protected", "this", "super", "try",
    "catch", "finally", "for", "do"
  )

  private def scalaId(name: String): String =
    if (SCALA_KEYWORDS.contains(name)) s"`$name`" else name

  /** 绑定名：关键字字段加 Param 后缀（case 模式里反引号标识符语义是「匹配既有值」——2026-08-26 编译实证）。 */
  private def bindNameOf(p: ParameterMetadata): String =
    if (SCALA_KEYWORDS.contains(p.name)) s"${p.name}Param" else p.name

  /** cid 绑定名：去尾 Id 加 Cid（conceptId→conceptCid 同款约定）。 */
  private def cidNameOf(p: ParameterMetadata): String = {
    val stripped = p.name.replaceAll("[iI]d$", "")
    s"${if (stripped.isEmpty) p.name else stripped}Cid"
  }

  private def instantBindOf(p: ParameterMetadata): String =
    s"${bindNameOf(p)}Instant"

  private def isIdType(p: ParameterMetadata): Boolean =
    isIdType(p.parameterType)

  private def isIdType(t: MetaType): Boolean = t match {
    case CustomType("Id", _, _) => true
    case _                      => false
  }

  private def isInstantType(t: MetaType): Boolean = t match {
    case CustomType(typeName, _, _) => typeName.contains("Instant")
    case _                          => false
  }

  /** 构建单个端点的参数定义
    */
  private def buildEndpointParameters(
      epMeta: EndpointMetadata,
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    epMeta.parameters.map(p =>
      FieldDef(p.name, ctx.typeResolver.resolve(p.parameterType))
    )
  }

  /** 解析端点响应类型
    */
  private def resolveResponseType(
      epMeta: EndpointMetadata,
      ctx: GeneratorContext
  ): TypeRef = {
    ctx.typeResolver.resolve(epMeta.responseType)
  }

  /** 构建注入的服务列表
    */
  private def buildInjectedServices(
      meta: ControllerMetadata,
      ctx: GeneratorContext
  ): Seq[FieldDef] = {
    meta.dependencies.map { depType =>
      val serviceRef = ctx.typeResolver.resolve(depType)
      FieldDef(toCamelCase(serviceRef.name), serviceRef)
    }
  }

  /** 将类名转换为驼峰命名法的字段名
    */
  private def toCamelCase(className: String): String = {
    s"${className.head.toLower}${className.tail}"
  }

  /** 收集所有依赖关系并过滤掉无效的导入
    */
  private def collectDependencies(
      endpoints: Seq[EndpointModel],
      injectedServices: Seq[FieldDef],
      ctx: GeneratorContext
  ): Set[TypeRef] = {
    val baseDeps = getBaseDependencies(ctx)
    val paramDeps = collectParameterDependencies(endpoints)
    val returnDeps = collectReturnDependencies(endpoints)
    val serviceDeps = collectServiceDependencies(injectedServices)

    val allDeps = baseDeps ++ paramDeps ++ returnDeps ++ serviceDeps
    filterValidDependencies(allDeps)
  }

  /** 获取基础依赖
    */
  private def getBaseDependencies(ctx: GeneratorContext): Set[TypeRef] = {
    Set(
      ctx.knownFrameworkTypes("ControllerComponents"),
      ctx.knownFrameworkTypes("BaseController"),
      ctx.knownFrameworkTypes("Action"),
      ctx.knownFrameworkTypes("AnyContent"),
      ctx.knownFrameworkTypes("Request"),
      ctx.knownFrameworkTypes("Json"),
      ctx.knownFrameworkTypes("ExecutionContext"),
      ctx.knownFrameworkTypes("Future")
    )
  }

  /** 收集端点参数的依赖
    */
  private def collectParameterDependencies(
      endpoints: Seq[EndpointModel]
  ): Set[TypeRef] = {
    endpoints
      .flatMap(_.parameters)
      .flatMap(_.typeRef.collectAllDependencies)
      .toSet
  }

  /** 收集端点返回类型的依赖
    */
  private def collectReturnDependencies(
      endpoints: Seq[EndpointModel]
  ): Set[TypeRef] = {
    endpoints
      .flatMap(_.returnType.collectAllDependencies)
      .toSet
  }

  /** 收集注入服务的依赖
    */
  private def collectServiceDependencies(
      injectedServices: Seq[FieldDef]
  ): Set[TypeRef] = {
    injectedServices
      .flatMap(_.typeRef.collectAllDependencies)
      .toSet
  }

  /** 过滤掉无效的依赖
    */
  private def filterValidDependencies(
      dependencies: Set[TypeRef]
  ): Set[TypeRef] = {
    dependencies.filterNot {
      case dep if dep.packageName.trim.isEmpty => true
      case dep
          if Seq("Any", "String", "Int", "Long", "Boolean", "Unit").contains(
            dep.name
          ) =>
        true
      case dep
          if dep.packageName == "scala" || dep.packageName == "java.lang" =>
        true
      case _ => false
    }
  }
}
