package net.imadz.codegen.scaffolding.cqrs.builder.application


import net.imadz.codegen.scaffolding.cqrs.model.application.{ProjectionRepositoryModel, RepositoryMethodModel, StructModel}
import net.imadz.codegen.scaffolding.cqrs.{FieldDef, GeneratorContext, MorphismEndpoints, TypeRef, TypeResolver}
import net.imadz.codegen.structure.NamingConventions
import net.imadz.meta._

object ProjectionRepositoryBuilder {

  /** DTO 字段构造（表/向量/图三路径共用）——readModelSchema 血统。
    *
    * EP_GenerationTime_Code_Anchors P1（用户 2026-09-23 拍板·决策 1「A 本体口径」）：
    * 视图字段的**知识 id ＋ 描述**随行带进 `FieldDef`，模板据此发射 `@param … @knowledge`——
    * 此前三路径都只传 `name/type`，id 在这一环丢第二次（第一次在 `ReadModelField` 无槽），
    * 这是 rm 面 `codeFqn` 恒 0 的直接原因。`None` 时模板不发射（不编造）。 */
  private def dtoFieldsOf(schemaFields: Seq[ReadModelField], ctx: GeneratorContext): Seq[FieldDef] =
    schemaFields.map { f =>
      // EP_Functional_Terminal_Form_Template_Batch S2（P5 终形）：Instant 列 nullable 判定——
      // 显式 nullable=false 不包；其余（未标记 or 显式 true）包 Option（批④ 104/104 longOpt 证据：
      // 视图 Instant 列 SQL 天然可空·缺省 Option 化与真仓手改终形逐字节同构）。
      val tr0 = ctx.typeResolver.resolve(f.dataType)
      val tr = tr0 match {
        case t if t.name == "Instant" && f.nullable.getOrElse(true) =>
          t.copy(name = "Option", packageName = "scala", typeParams = Seq(t))
        case t => t
      }
      FieldDef(f.name, tr, noteId = f.noteId, description = f.description)
    }

  /** ★ rm 面态射（EP_GenerationTime_Code_Anchors S2）——**builder 显式构造**「这个视图字段从哪来」。
    *
    * 与已删除的全局后置求解器 `DerivedKnowledgeAnchors.solve`（S2b 删·逐条对账已证可取代）**同源同数据**，但由本 builder 出：
    * 它手里同时有 `ProjectionMetadata.readModelSchema`（携带 `derivation`）与 registry（解端点）。
    * 差别在**可达性**：后置求解器只扫 `system.infrastructure.projections`，
    * 结构性够不着 proto/converter/工厂等方法参数面（那正是它「已产未销」的成因）。
    *
    * 关系词（照词表 canonical 取·不自造）：
    *   · `DirectField(ev, fld)` → **writtenBy**——词表 semantic 逐字「状态字段的值来自事件载荷路径」，
    *     读模型字段是同一语义在 rm 面的实例（端点＝事件载荷字段·**字段级端点**）。
    *   · `AggregateIdentity` → **rmOf**——词表「读模型取自聚合」，容器级词在字段级的实例
    *     （端点＝聚合·**概念级端点**，走 registry）。
    *   · `ComputedField` → **不发**：词表无「表达式派生」的登记词——**登记为缺口**，不编造（实测本系统 0 例）。
    *   · `ConstantField`/`UnresolvedField` → 无源，不发。
    * 端点解不到也**不发**（漏一条是可知的，错一条是静默的）。
    */
  private def morphismsOf(proj: Option[ProjectionMetadata], schemaFields: Seq[ReadModelField],
      dtoName: String, ctx: GeneratorContext): Seq[MappingMorphism] = {
    val sourceAgg = proj.map(_.sourceAggregate).getOrElse("")
    schemaFields.flatMap { f =>
      val (rel, ep) = f.derivation match {
        case DirectField(ev, fld) =>
          (RelationWord.WrittenBy, MorphismEndpoints.fieldOf(ctx, ev, fld))
        case AggregateIdentity =>
          (RelationWord.RmOf, MorphismEndpoints.byName(ctx, sourceAgg))
        case _: ComputedField | _: ConstantField | _: UnresolvedField =>
          (RelationWord.WrittenBy, None)   // 不发（computed 无登记词·constant/unresolved 无源）
      }
      ep.toSeq.map(e => MappingMorphism(rel, MorphismDimension.Derived, e, f.name,
        // 落点消歧双键（S3 判例·见 `MappingMorphism.memberOwner`）：成员直接所属类型＝DTO 名
        // （rm 面当前一视图一文件故未触发歧义，但按同一纪律给全，防后续 face 变化时静默假锚）
        memberOwner = Some(dtoName),
        memberNoteId = f.noteId))
    }
  }

  def build(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext): ProjectionRepositoryModel = {
    meta.storageConfig match {
      case _: PgVectorTableMetadata => buildVector(meta, ctx)
      case _: Neo4jGraphMetadata    => buildGraph(meta, ctx)
      case _: MongoDocumentMetadata => buildMongo(meta, ctx)
      case _                        => buildTable(meta, ctx)
    }
  }

  /** [视图存储重设计 2026-10-08] Mongo 文档视图接口：table 同源方法集（元数据 methods 驱动——
    * 装配侧已补 findByTenantPaged/countByTenant），DTO＝readModelSchema 血统同表路径。
    * Impl 绑定翻转为 *MongoRepositoryImpl（@ImplementedBy 指向·Guice 单点切流）。 */
  private def buildMongo(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext): ProjectionRepositoryModel = {
    val implName = s"${NamingConventions.getBaseName(meta.name)}MongoRepositoryImpl"
    val isImplementedBy = ctx.typeResolver.projectionRepositoryImpl(implName)
    buildTableWithImpl(meta, ctx, isImplementedBy)
  }

  /** [S2-65 图读模型] 图仓库接口：元数据四动词方法集驱动（批B graphRepositoryMethods 声明——
    * upsertNode/updateNodeProps/deleteNode〔＋可烧录边卡 mergeEdge〕·值参数在接口，
    * label/keyName/keySpace/端点结构烧进 Impl）。图节点属性全 String——DTO＝nodeProps 血统
    * （readModelSchema 同源），接口签名零 DTO 依赖（key/props 值面）。 */
  private def buildGraph(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext): ProjectionRepositoryModel = {
    val pkg = ctx.layout.application.projection.repository.root
    val selfType = ctx.typeResolver.projectionRepository(meta.name)
    val implName = s"${meta.name}Impl"
    val isImplementedBy = ctx.typeResolver.projectionRepositoryImpl(implName)

    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoCompanionName = s"${dtoName}Table"

    // DTO 字段：readModelSchema 血统（与向量/表路径同源）；图 props 全 String
    // 2026-09-23 S2：把投影元数据本身留住——态射构造要用它的 sourceAggregate（AggregateIdentity 的端点）
    // S7（2026-09-23 实测）：本查找正确——`getBaseName` 剥 `Repository`，33 个表路径仓库的
    // dtoName 全命中投影（探针逐条 resolved=true）。**不得改成「按 meta.name 先查」**：
    // `resolveByName` 的 `isInstanceOf[T]` 在调用点被类型擦除，同名**派生**
    // ProjectionRepositoryMetadata 会命中并 ClassCastException（WriteTerritorySpec 实证）。
    val projMeta = ctx.metaRegistry.resolveByName[ProjectionMetadata](dtoName)
    val schemaFields = projMeta.flatMap(_.readModelSchema).map(_.fields).getOrElse(Nil)
    val dtoFields = dtoFieldsOf(schemaFields, ctx)
    val dtoModel = StructModel(dtoName, dtoCompanionName, dtoFields)

    // 接口面＝元数据方法集（全 UpsertMethod 动词面·Unit 返回）；参数类型机械解析（props=Map[String,String]）
    val methods = meta.methods.map { m =>
      val (returnType, logicIntent) = m match {
        case u: UpsertMethod => (TypeRef.Unit, u.logic.intent)
        case q: QueryMethod  => (TypeResolver.resolve(q.returnType, ctx), q.logic.intent)
      }
      RepositoryMethodModel(
        name = m.name,
        parameters = m.parameters.map(p =>
          // 2026-09-23 EP_GenerationTime_Code_Anchors B4（断链修复）：`ParameterMetadata` 带 noteId，
          // 此前只搬 name/type ⇒ 查询/写入方法的参数到不了模板（本文件两处·图/表两路径）。
          FieldDef(p.name, TypeResolver.resolve(p.parameterType, ctx), noteId = p.noteId, description = p.description)),
        returnType = returnType,
        logicIntent = logicIntent
      )
    }

    val dtoDeps = dtoModel.fields.flatMap(_.typeRef.collectAllDependencies)
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(_.typeRef.collectAllDependencies)
    }
    val deps = methodDeps.toSet ++ dtoDeps.toSet ++
      (if (sys.props.get("codegen.multiProject").contains("true")) Set.empty[TypeRef]
       else isImplementedBy.collectAllDependencies) ++
      (if (sys.props.get("codegen.multiProject").contains("true")) Set.empty[TypeRef]
       else Set(ctx.knownFrameworkTypes("ImplementedBy")))
    val dependencies = deps.filter(t => t.shouldImport(pkg))

    ProjectionRepositoryModel(selfType, isImplementedBy, dtoModel, methods, dependencies,
      morphisms = morphismsOf(projMeta, schemaFields, dtoName, ctx),
      noteIds = projMeta.flatMap(_.noteId).toSeq)
  }

  /** [M3 向量读模型] 向量仓库接口：固定方法集（upsert/findByIdentity/delete/search）——
    * 元数据 methods 不再驱动（装配侧技术方法集与向量面语义不同）；
    * Impl 注入手写基建 PgVectorStore＋OllamaEmbeddingClient（真仓 infrastructure.persistence.vector，
    * HTTP/池逻辑全在手写基建，模板只机械发射调用）。
    * search 契约：tenantId 租户硬门＋queryEmbedding(Array[Float])＋k＋sourceType 过滤。 */
  private def buildVector(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext): ProjectionRepositoryModel = {
    val pkg = ctx.layout.application.projection.repository.root
    val selfType = ctx.typeResolver.projectionRepository(meta.name)

    val implName = s"${meta.name}Impl"
    val isImplementedBy = ctx.typeResolver.projectionRepositoryImpl(implName)

    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoCompanionName = s"${dtoName}Table"

    // DTO 字段：readModelSchema 血统（与表路径同源）；向量列＝存储实现细节不进 DTO
    // 2026-09-23 S2：把投影元数据本身留住——态射构造要用它的 sourceAggregate（AggregateIdentity 的端点）
    // S7（2026-09-23 实测）：本查找正确——`getBaseName` 剥 `Repository`，33 个表路径仓库的
    // dtoName 全命中投影（探针逐条 resolved=true）。**不得改成「按 meta.name 先查」**：
    // `resolveByName` 的 `isInstanceOf[T]` 在调用点被类型擦除，同名**派生**
    // ProjectionRepositoryMetadata 会命中并 ClassCastException（WriteTerritorySpec 实证）。
    val projMeta = ctx.metaRegistry.resolveByName[ProjectionMetadata](dtoName)
    val schemaFields = projMeta.flatMap(_.readModelSchema).map(_.fields).getOrElse(Nil)
    val dtoFields = dtoFieldsOf(schemaFields, ctx)
    val dtoModel = StructModel(dtoName, dtoCompanionName, dtoFields)
    val dtoType = ctx.typeResolver.projectionDtoType(dtoName, dtoCompanionName, pkg)

    val futureOf = (t: TypeRef) => ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(t))
    val methods = Seq(
      RepositoryMethodModel(
        name = "upsert",
        parameters = Seq(FieldDef("view", dtoType)),
        returnType = TypeRef.Unit,
        logicIntent = s"投影写侧 upsert $dtoName 行（同步嵌入）"
      ),
      RepositoryMethodModel(
        name = "findByIdentity",
        parameters = Seq(
          FieldDef("tenantId", TypeRef.String),
          FieldDef("sourceType", TypeRef.String),
          FieldDef("sourceId", TypeRef.String)),
        returnType = futureOf(TypeRef("Option", "", Seq(dtoType))),
        logicIntent = s"按标识键 (tenantId, sourceType, sourceId) 查单条 $dtoName"
      ),
      RepositoryMethodModel(
        name = "delete",
        parameters = Seq(
          FieldDef("sourceType", TypeRef.String),
          FieldDef("sourceId", TypeRef.String)),
        returnType = TypeRef.Unit,
        logicIntent = s"按 (sourceType, sourceId) 删 $dtoName 行（sourceId 全局唯一·删除事件折叠）"
      ),
      RepositoryMethodModel(
        name = "search",
        parameters = Seq(
          FieldDef("tenantId", TypeRef.String),
          FieldDef("queryEmbedding", TypeRef("Array", "", Seq(TypeRef("Float", "")))),
          FieldDef("k", TypeRef.Int),
          FieldDef("sourceType", TypeRef("Option", "", Seq(TypeRef.String)))),
        returnType = futureOf(ctx.knownFrameworkTypes("List").copy(typeParams = Seq(dtoType))),
        logicIntent = s"租户内向量近邻检索 $dtoName（cosine·k 截断·sourceType 过滤）"
      )
    )

    val dtoDeps = dtoModel.fields.flatMap(_.typeRef.collectAllDependencies)
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(_.typeRef.collectAllDependencies)
    }
    val multi = sys.props.get("codegen.multiProject").contains("true")
    val deps = methodDeps.toSet ++ dtoDeps.toSet ++
      (if (multi) Set.empty[TypeRef] else isImplementedBy.collectAllDependencies) ++
      Set(ctx.knownFrameworkTypes("Inject"), ctx.knownFrameworkTypes("Future"), ctx.knownFrameworkTypes("List")) ++
      (if (multi) Set.empty[TypeRef] else Set(ctx.knownFrameworkTypes("ImplementedBy")))
    val dependencies = deps.filter(t => t.shouldImport(pkg))

    ProjectionRepositoryModel(selfType, isImplementedBy, dtoModel, methods, dependencies,
      morphisms = morphismsOf(projMeta, schemaFields, dtoName, ctx),
      // S7（EP §二 G1）：本面此前只接在 buildGraph（8/42＝图路径），表/向量两路径漏传——
      // 三路径同源 projMeta，一并补齐（42/42）。
      noteIds = projMeta.flatMap(_.noteId).toSeq)
  }

  private def buildTable(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext): ProjectionRepositoryModel = {
    val implName = s"${meta.name}Impl"
    val isImplementedBy = ctx.typeResolver.projectionRepositoryImpl(implName)
    buildTableWithImpl(meta, ctx, isImplementedBy)
  }

  private def buildTableWithImpl(meta: ProjectionRepositoryMetadata, ctx: GeneratorContext,
      isImplementedBy: TypeRef): ProjectionRepositoryModel = {
    val pkg = ctx.layout.application.projection.repository.root
    val selfType = ctx.typeResolver.projectionRepository(meta.name)

    // DTO Model——storageMeta 仅 table 形状消费（列兜底）；mongo/vector/graph 形状 schemaFields 必非空
    // （readModelSchema 血统），此硬转对非 Table 形状不触达（schemaFields.nonEmpty 短路）
    val storageMeta = meta.storageConfig match {
      case t: TableMetadata => t
      case _ => TableMetadata(s"${NamingConventions.getBaseName(meta.name).toLowerCase}_table", Nil)
    }
    val dtoName = NamingConventions.getBaseName(meta.name)
    val dtoCompanionName = s"${dtoName}Table"

    // 2026-08-21 治本修复：DTO 字段类型优先从同名 ProjectionMetadata 的 readModelSchema 的 DataType 解析
    // （CustomType 原生支持泛型，TypeResolver 直接得到 List[String] 等）；TableMetadata 列类型是存储层
    // 字符串（VARCHAR 等），作为兜底走 customDataType 映射。
    // 2026-09-23 S2：把投影元数据本身留住——态射构造要用它的 sourceAggregate（AggregateIdentity 的端点）
    // S7（2026-09-23 实测）：本查找正确——`getBaseName` 剥 `Repository`，33 个表路径仓库的
    // dtoName 全命中投影（探针逐条 resolved=true）。**不得改成「按 meta.name 先查」**：
    // `resolveByName` 的 `isInstanceOf[T]` 在调用点被类型擦除，同名**派生**
    // ProjectionRepositoryMetadata 会命中并 ClassCastException（WriteTerritorySpec 实证）。
    val projMeta = ctx.metaRegistry.resolveByName[ProjectionMetadata](dtoName)
    val schemaFields = projMeta.flatMap(_.readModelSchema).map(_.fields).getOrElse(Nil)
    val dtoFields = if (schemaFields.nonEmpty)
      dtoFieldsOf(schemaFields, ctx)
    else
      storageMeta.columns.map { c =>
        val scalaType = c.dataType.toUpperCase match {
          case s if s.startsWith("VARCHAR") => TypeRef.String
          case "INT" => TypeRef.Int
          case s if s.startsWith("DECIMAL") => TypeResolver.resolve(BigDecimalType, ctx)
          case _ => ctx.typeResolver.customDataType(c.dataType)
        }
        FieldDef(c.name, scalaType)
      }
    val dtoModel = StructModel(dtoName, dtoCompanionName, dtoFields)

    // DTO Type Ref (用于替换方法中的泛型)
    // 它是定义在 Companion Object 中的，所以路径是 Package.Companion.DTO
    val dtoType = ctx.typeResolver.projectionDtoType(dtoName, dtoCompanionName, pkg)

    val methods = meta.methods.map { m =>
      val (returnType, logicIntent) = m match {
        case q: QueryMethod =>
          val resolvedType = TypeResolver.resolve(q.returnType, ctx)

          // [FIX] 核心逻辑：检查返回类型是否是 List[Summary]，如果是，替换泛型参数为正确的 DTO
          // 2026-08-24 投影仓库标准方法集：Option[DTO] 同样替换泛型并包 Future（findByIdentity 契约）
          // [视图存储重设计 2026-10-08] 标量聚合（countByTenant 声明 Long）也包 Future（Repository 契约
          // ——ViewApi for-comprehension 需要 Future[Long] 作 total）
          val fixedReturnType = if (resolvedType.name == "List" || resolvedType.name == "Future" || resolvedType.name == "Option") {
            // 递归检查泛型参数
            val newParams = resolvedType.typeParams.map { p =>
              if (p.name == "Summary" || p.name == "Any" || p.name == dtoName) dtoType else p
            }
            // 如果是 List/Option，还需要包一层 Future (Repository 契约)
            if (resolvedType.name == "List" || resolvedType.name == "Option") {
              ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(resolvedType.copy(typeParams = newParams)))
            } else {
              resolvedType.copy(typeParams = newParams)
            }
          } else if (resolvedType == TypeRef.Long) {
            ctx.knownFrameworkTypes("Future").copy(typeParams = Seq(TypeRef.Long))
          } else resolvedType

          (fixedReturnType, q.logic.intent)

        case u: UpsertMethod => (TypeRef.Unit, u.logic.intent)
      }

      RepositoryMethodModel(
        name = m.name,
        parameters = m.parameters.map(p =>
          // 2026-09-23 EP_GenerationTime_Code_Anchors B4（断链修复）：`ParameterMetadata` 带 noteId，
          // 此前只搬 name/type ⇒ 查询/写入方法的参数到不了模板（本文件两处·图/表两路径）。
          FieldDef(p.name, TypeResolver.resolve(p.parameterType, ctx), noteId = p.noteId, description = p.description)),
        returnType = returnType,
        logicIntent = logicIntent
      )
    }

    val dtoDeps = dtoModel.fields.flatMap(_.typeRef.collectAllDependencies)
    val methodDeps = methods.flatMap { m =>
      m.returnType.collectAllDependencies ++ m.parameters.flatMap(_.typeRef.collectAllDependencies)
    }
    val multi = sys.props.get("codegen.multiProject").contains("true")
    val deps = methodDeps.toSet ++
      dtoDeps.toSet ++
      (if (multi) Set.empty[TypeRef] else isImplementedBy.collectAllDependencies) ++
      Set(ctx.knownFrameworkTypes("Inject"), ctx.knownFrameworkTypes("Future"), ctx.knownFrameworkTypes("List")) ++
      (if (multi) Set.empty[TypeRef] else Set(ctx.knownFrameworkTypes("ImplementedBy")))

    val dependencies = deps.filter(t => t.shouldImport(pkg))

    ProjectionRepositoryModel(selfType, isImplementedBy, dtoModel, methods, dependencies,
      morphisms = morphismsOf(projMeta, schemaFields, dtoName, ctx),
      // S7（EP §二 G1）：本面此前只接在 buildGraph（8/42＝图路径），表/向量两路径漏传——
      // 三路径同源 projMeta，一并补齐（42/42）。
      noteIds = projMeta.flatMap(_.noteId).toSeq)
  }
}
