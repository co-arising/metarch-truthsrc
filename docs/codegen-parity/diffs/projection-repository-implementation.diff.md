# projection-repository-implementation（24）内容规格

## 1. 范围、状态与来源

Artifact id `projection-repository-implementation`；状态 `decision-required`。传统 Scala 四存储实现、legacy renderer、formal 银行及新 family 的职责分别对账，不按 Repository/Handler 相似名称判 exact。固定版本见 [inventory](../scala-artifacts.json)、[snapshot index](../baseline/index.json)。完整 [Model](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/infrastructure/repository/ProjectionRepositoryImplModel.scala)、[Builder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/infrastructure/repository/ProjectionRepositoryImplBuilder.scala)、[Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/repository/ProjectionRepositoryImplTemplate.scala) 均已全文阅读。

[CQRSApplicationGenerator L803–840](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L803) 对每个 ProjectionRepositoryMetadata 在接口后发一个 Impl。`table/vector/graph` 名为 `<Base>RepositoryImpl`，Mongo 为 `<Base>MongoRepositoryImpl`。单项目 `app/<business-base>/infrastructure/repositories/projection/<Impl>.scala`；multi 为 `modules/glue/src/main/scala/<business-base>/infrastructure/repositories/projection/<Impl>.scala`。虽然 layout accessor 叫 `infrastructure.persistence.repositories.projection`，实际包**不含 persistence**，见 [PackageLayout L97–101](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L97)。业务 base 下只允许 domain/application/infrastructure，不新增 readside/service 第四层。

[人工完整实现](../baseline/curated-scala/net/imadz/infrastructure/repositories/projection/MonthlyIncomeAndExpenseSummaryRepositoryImpl.scala) 不是 raw 默认实现：包含逐月范围查询、income/expense 累加；其范围上界 `month <= untilMonth` 与名称 LCRO 不一致，且增量更新重放会重复累加，必须单列语义而非宣称标准 upsert。

## 2. Model 全字段与公共推导

| 类型 | 原序、默认值、实际用途 |
|---|---|
| `ProjectionRepositoryImplModel` | `selfType: TypeRef, interfaceType: TypeRef, dtoType: TypeRef, methods: Seq[JdbcMethodModel], dependencies: Set[TypeRef], injectedConstructorParams: Seq[FieldDef] = Nil, extraMembers: Option[String] = None, noteIds: Seq[String] = Nil` |
| `JdbcMethodModel` | `name: String, params: Seq[FieldDef], returnType: TypeRef, isFuture: Boolean, bodyLogic: String`；isFuture 在本 Template **不消费**，Future 必须已存在于返回类型/源码 body 中 |
| `FieldDef` | `name, typeRef, defaultValue=None, comment=None, noteId=None, description=""`，精确类型分别 String/TypeRef/Option[String]/Option[String]/Option[String]/String；参数模板仅名称/类型及锚描述；构造器参数连关键字转义都未调用 |
| `TypeRef` | `name: String, packageName: String, typeParams: Seq[TypeRef]=Nil`；signature 泛型/Tuple 规则、递归依赖及过滤见 [TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)。继承 ArtifactModel 的 morphisms 默认 Nil、registerTo 只注册自己 |

`bodyLogic`、`extraMembers` 是原始 Scala 源码字符串槽，Builder 直接生产 SQL/codec/委托语法；不能把 Scala 自身描述成完全纯结构 MBT。后续 JS 目标应将这些分成结构化语句模型和 template，但必须保留实际 RHS/副作用次序。

Builder L70–87 先由所有 ProjectionMetadata 反查第一个 repositoryRef.targetName 命中的投影 noteId，四路共享；依次匹配 PgVector/Neo4j/Mongo，否则 table。公共 self/interface/DTO 由 [TypeResolverDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L759) 与 layout 推导，Impl 的 `dtoType` 是 package 内简单 DTO 名，靠 `<Base>Table._` 补嵌套作用域。

## 3. 四路 Builder / RHS 全账

### 3.1 JDBC table（Builder L480–614，readExpr/bindExpr L25–68）

- TableMetadata 原样消费；其它未知 storage fallback `<dto-lower>_table, Nil`。schema 优先同名 ProjectionMetadata.readModelSchema 非空 fields，兜底每个表列都按 StringType，**与 port 的 VARCHAR/INT/DECIMAL 兜底不同**。keys 从 Table columns.isPrimaryKey 原序取得，不是 readModel identityKeys。
- methods 按 metadata 原序，params 用 resolver + noteId/description。所有 Query：顶层 Option→Future[Option[DTO]]，其余→Future[List[DTO]]，无标量 Long 例外（与 port/Mongo 不一致）；Upsert→Unit。不据 logic.referenceCode 执行业务算法。
- 每个 Upsert 的 RHS：`DB.localTx { implicit session => sql"""INSERT INTO table (反引号列) VALUES (?, ...) ON DUPLICATE KEY UPDATE 非主键列 = VALUES(列)""".bind(字段值原序).update.apply() }`。表名不反引号；所有非主键是**覆盖**而非累加；无非主键时 updates 空，未作专门防御；body 假定参数名 `view`。
- 每个 Query 的 RHS：`Future { DB readOnly { implicit session => sql"""SELECT 列 FROM table [WHERE 参数名 = ? AND ...]"""[.bind(参数原名)].map(rs => DTO(namedArgs原序)).headOption.apply()/list.apply() } }`。无参无 WHERE/bind；没有 ORDER BY、limit/offset、租户自动条件或 LCRO 算法；Option 用 headOption，其余 list。查询 bind 名未经过 scalaIdentifier。
- 写值映射：Instant→`view.f.map(x => java.lang.Long.valueOf(x.toEpochMilli)).orNull`；List→`Json.toJson(view.f).toString()`；Id→`.toString`；其它→`view.f`。
- 读值映射：Int→rs.int；Long→rs.long；Boolean→rs.boolean；BigDecimal→`rsBigDecimal("col")`（此固定文件没有定义该符号）；Instant→longOpt.map(Instant.ofEpochMilli)；List[Inner]→Json.parse(rs.string).as[List[resolved Inner]]（缺内型用 String）；Id→Id.of(rs.string)；所有其它→rs.string。
- 依赖：Future/ExecutionContext/interface + List 时 Json + Id 时 `net.imadz.common.Id` + List 内层递归依赖 + 方法参数递归依赖；非所有 DTO 列都收集，最后 shouldImport。nullable=false Instant 仍按 Option 读写；List[VO] 注释声称由 Table companion 提供 codec，但已读 [port Template](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionRepositoryTemplate.scala) 只发 case class、没有该 codec，不能据注释判可编译。

### 3.2 Graph（L273–352）

无注入构造器、无 extraMembers；`<base>.infrastructure.graph.GraphMutationExecutor` 静态委托。方法按 metadata 原序，**全部** Unit/isFuture=false，参数递归依赖合并 interface/executor。

| 方法 | 实际 RHS 与失败边界 |
|---|---|
| upsertNode | `apply(UpsertNode(label, nodeKey, s"keySpace:$key", props), ExecutionMode.Strict)` |
| updateNodeProps | 同上换 UpdateNodeProps |
| deleteNode | `apply(DeleteNode(label, nodeKey, prefixedKey, Some(tenantId)), Strict)` |
| mergeEdge | 只收 `relationKey == nodeKey && toKeyId.trim.nonEmpty` 的 edgeMappings；空集合时 Builder 抛异常；按原序生成 edgeType match→(toLabel,toKeyName,toPrefix)，未知 edgeType 抛 IllegalArgumentException；再 `apply(MergeEdge(edgeType, label, nodeKey, prefixedFromKey, toLabel, toKeyName, s"$toKeyPrefix$toKey", Map("tenantId" -> tenantId)), Strict)` |
| mergeLinkTolerant | 原样 `??? // CM-11...`，容忍悬空端点的 Strict+catch 语义属于手写槽，不是默认成功 |
| 其它方法名 | Builder 直接抛异常，绝不能默认为 Unit 成功 |

Graph source 字段名检查与 `*GraphView` handler 的字符串判别并非同一个 storage 判别系统，需避免声明为 graph 但走表 handler。

### 3.3 Vector（L354–478）

schema/identityKeys 原序；列 camel→snake；embedding 输入优先 snake 后为 embed_text 的列，否则取首列（空 schema 会 head 失败）。固定四方法及签名与 [port diff](projection-repository-port.diff.md#21-所有存储变体) 一致，方法顺序 upsert/findByIdentity/delete/search，不读 metadata.methods。

1. upsert：同步 `embeddingClient.embed(view.<embedField>)` → `pgVectorStore.upsert(table=..., columns=Seq("snake" -> view.field,...), embeddingColumn=..., embedding=embedding, keyColumns=Seq(...))`。model/dims 仅进入注释；endpoint/timeout 不在此配置 client。
2. findByIdentity：Future 内 `findByKeys(table, keys=Map(identityKeys→同名参数), columns=ViewColumns).map(rowToView)`；固定参数只有 tenantId/sourceType/sourceId，schema keys 不匹配将引用不存在变量。
3. delete：同步 `pgVectorStore.delete(table=..., sourceType=sourceType, sourceId=sourceId)`；没有 tenantId。
4. search：Future 内 `search(table, tenantId, queryEmbedding, k, sourceType, columns=ViewColumns).map(rowToView)`。
5. 额外成员置于方法**之后**：`private val ViewColumns: Seq[String]`；`private def rowToView(row: Map[String, Any]): DTO = DTO(field = row("snake").asInstanceOf[resolvedType],...)`。这是真实 Any/cast 例外，不扩散为新通用 dispatcher。
6. 构造器注入原序 pgVectorStore:PgVectorStore、embeddingClient:OllamaEmbeddingClient；依赖仅 Future/ExecutionContext/interface/两 client 后 shouldImport，未收全 DTO 类型。

### 3.4 Mongo（L90–271）

`<Base>MongoRepositoryImpl(viewStore: MongoViewStore)`；store 包 `<base>.infrastructure.persistence.mongo`。schema 原序；kindValue 非空用 `_id` 及 `"kind:" + naturalKey`，否则 keyField。

- Query 返回 Long→Future[Long]，Option→Future[Option[DTO]]，其它→Future[List[DTO]]；Upsert→Unit；params 带锚。
- upsert→`putDocument(collection,keyCol,composite(view.keyField.toString),viewToJson(view))`；findByIdentity→`findByKey(...).map(_.flatMap(safeRowToView))`；findByTenantPaged→store 分页 + kind Map/Map.empty 后过滤解码；countByTenant→findAll→safe解码→count(_.tenantId==tenantId)，不是 store count；findAll→safe解码.toList；其它方法按所有参数生成等值 Map（kind 条件在前），调用 findByFields→列表。
- 额外成员原序 `viewToJson`→`safeRowToView`→`rowToView`。JSON 显式字段：Instant 写 Option[JsString]、Id null→JsNull、其余 Json.toJson；kind 末尾追加。读 Instant 接受 Long epoch 或 String.parse，Id asOpt 失败→null，List asOpt 失败→Nil，其余 as[resolved type]。无 kind 用 Try(rowToView(json)).toOption；有 kind 先 parse、递归 `\\ "kind"` 取首值匹配，再 Try(rowToView(JsValue))，错误行静默跳过。
- 依赖 Future/EC/interface/store/Json/JsString、条件 JsNull、List 内型、全部 schema 类型，shouldImport。JSON 串 API 与 legacy 的 BSON Document API 不可混接；count 的集合.count 实际产 Int 与声明 Future[Long] 需真实编译确认，不可仅凭注释称正确。

### 3.5 其它 storage

[ArchitectMetadata](../baseline/bc/src/main/scala/net/imadz/meta/ArchitectMetadata.scala#L673) 还定义 EsIndexMetadata/RedisKeyMetadata；这两者在本 Builder 没有真正实现，落 table fallback，不代表 ES/Redis 支持。未建模/未知字段类型 rs.string 兜底也不是通用类型转换能力。

## 4. Template 全部 construct / imports / RHS 装配

1. package=selfType.packageName。
2. base imports=dependencies 按 fqn 排序，排空/等于当前 package/java.lang；追加 `<interfacePkg>.<dtoName去Repository>Table._`, `scalikejdbc._`, `scala.concurrent.ExecutionContext.Implicits.global`, `javax.inject.Singleton`，非空 injectedConstructorParams 再 Inject；distinct 后 [DSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20) 全局排序。图/向量也无条件带 scalikejdbc/global，属于 raw 历史多余依赖。
3. Implementation 文档 → `@Singleton` → `class Self [@Inject() (按模型原序参数)] extends Interface`。没有 final、type 参数/self-type/父构造实参/伴生 object/辅助构造器。零参数不发 `()`；注入参数无 val/var。
4. methods 原序：fieldDoc(params, "  ") → `override def name(params): ReturnType = {` → BEGIN MANUAL → bodyLogic 每行前加四空格 → END MANUAL → `}`。模板不根据 isFuture 自动包 Future；完整 body 是 Builder 产物，MANUAL 不等于“都是未知”。
5. extraMembers Option[String] 原文放所有方法后；它**不在 MANUAL 块内**，不能假称重生成一定保留人工更改。table/graph None；vector/Mongo 有。
6. knowledge noteIds 由 writer 记账，文件指纹也由 [writeArtifact](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L359) 前置，不是模板自己制造历史 stamp。

## 5. JS formal/legacy/family 与真实对照

- formal：[renderJournalRepository](../baseline/js/generators/scala-cqrs-play-service/render-journal-repository.mjs) 输出 namespace/DataSource concrete class、Row/Payload/State/Owner/index records 与 Session；[实际银行全文件](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideRepository.scala) 含 SQL 初始化、schema-version 锁、read/write 事务、PID SHA-256 防碰撞、连续序列、事件 payload、防旧 row、观察水位和索引 put/delete/query。没有 Scala table/graph/vector/Mongo Model，也没有实现应用 trait。
- shared JDBC [templates](../baseline/js/generators/shared-jdbc/templates.mjs) 是可复用基础：bindOne 支持 None/Some/bytes/Long/Int/Boolean/String，否则抛；query/execute 关闭 statement/result；事务 RepeatableRead/autocommit=false→callback→commit→返回；NonFatal 回滚，附 suppressed，finish/close。新 family 才开启 unknownCommit/finishBeforeCommit/threadConfined；不能把两套失败语义写成相同。
- legacy [viewrepo](../baseline/js/generators/projection-dsl/viewrepo.mjs) 已有 renderImpl/sqlBodies/mongoBodies/graphBodies/vectorBodies，不是 missing renderer。当前 SQL List 是子表同事务先删后插 + hydration，不是 Scala JSON 单列；Mongo 是 BSON Document/putDocumentDoc/findByKeyDoc，countByTenant 推到 store，不是 Scala JSON 串+安全解码计数；graph 可 typed Any，向量硬编码 embedText；存在按业务名的例外和固定 Metarch 包，不能直接复用成通用实现。
- deprecated [impl](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/impl.mjs) 四路较贴近 raw，但也有 Id import、排序/return type 等差异；[repoSpecs](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/builders/repoSpecs.mjs) 跳 Mongo/List[VO] 并使用 null Instant 固定库名，不能拿其存在覆盖所有变体。
- 新 family [Model](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs)、[repository/handler templates](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/repository.mjs)：单 aggregate、一个名义 String→String map index、h2-2、frame pins/compatibility key、线程约束事务、重复 envelope 判定、event→state→map index→checkpoint；`Repository.Session` 嵌套是事务协议，不是 `<View>Repository`。准入限制来自 [compilePersistenceReadside](../baseline/js/lib/products/persistence-readside.mjs)，不能称支持银行多流或 graph/vector。

结构性对照，非同输入字节比较。minus 为银行实际 Session 写入；plus 为 Scala Template+Builder 的实现骨架（`View`/表列是示意输入，不捏造银行业务语义）。

```diff
-final class BankJournalReadsideRepository(namespace: String, dataSource: DataSource) {
-  def write[A](f: Session => A): A = transaction(writable = true)(f)
-}
+package example.bankwealth.infrastructure.repositories.projection
+import example.bankwealth.application.projection.repository.ViewRepository
+import example.bankwealth.application.projection.repository.ViewTable._
+import scalikejdbc._
+import javax.inject.Singleton
+@Singleton
+class ViewRepositoryImpl extends ViewRepository {
+  override def upsert(view: View): Unit = {
+    // ==== BEGIN MANUAL ====
+    DB.localTx { implicit session =>
+      sql"""INSERT INTO view_table (`id`, `label`) VALUES (?, ?)
+            ON DUPLICATE KEY UPDATE `label` = VALUES(`label`)"""
+        .bind(view.id, view.label).update.apply()
+    }
+    // ==== END MANUAL ====
+  }
+}
```

不能把 minus 的同一事务 checkpoint 保障删掉后仍称 exactly-once parity。normal imports/lowerCamelCase 是目标覆盖标准；原 SQL 标识符必须单独映射，不能改表名来追求 Scala 外观。

## 6. 胶水、事务边界和未来写集合

| 胶水 | 必需 API / 来源 / 当前证据 |
|---|---|
| `scalikejdbc.DB`, `sql`, `WrappedResultSet` | localTx/readOnly、bind/map/update/headOption/list；[scaffold](../baseline/bc/scaffold/build.sbt) 声明 ScalikeJDBC 3.5.0、Projection 1.2.5、common-core 0.2；声明依赖不证明消费 JAR 可用 |
| `net.imadz.common.application.projection.ScalikeJdbcSession` | [完整固定实现](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSession.scala)：DB.connect→autoClose(false)；withConnection begin/withinTxWithConnection；commit/rollback/close。repo 另开 DB.localTx 不使用 handler session，不能证明 offset+业务写同事务 |
| `ScalikeJdbcSetup` | [固定实现](../baseline/common/src/main/scala/net/imadz/common/application/projection/ScalikeJdbcSetup.scala)：ActorSystem config→Hikari/default ConnectionPool；termination closeAll。需确认谁调用 init、是否与共享服务争 pool |
| `play.api.libs.json.Json/JsString/JsNull`, `net.imadz.common.Id` | List/DTO codec、null与UUID；VO codecs/rsBigDecimal 没有在本固定模板中补齐，不能拿注释作接口证明 |
| `<base>.infrastructure.graph.GraphMutationExecutor` | apply + 五 mutation 类型/ExecutionMode.Strict；手写库，租户/CAS/端点容忍 API 未在已读固定胶水中验证 |
| `<base>.infrastructure.persistence.vector.PgVectorStore`, `OllamaEmbeddingClient` | upsert/delete/findByKeys/search，embed 同步；真实返回容器、超时、维度、事务/失败语义未验证 |
| `<base>.infrastructure.persistence.mongo.MongoViewStore` | Scala JSON 串 putDocument/findByKey/findByTenantPaged/findAll/findByFields；legacy Doc API 是另一 ABI；offset 在 JDBC、Mongo 写非同资源事务 |

后续 proposed 本组文件 `generators/scala-cqrs-projection-v1/build-repository-models.mjs`、`templates/repository-implementation.mjs`，由 projection 集成者的 `build-models.mjs/render.mjs/generate.mjs/generator.json` 统一组装；adapt `generators/projection-dsl/viewrepo.mjs` 时把四路派生与 template 分离，DDL、Mongo indexes 交存储配置 owner；`generators/run-all.mjs` 旧调用在 manifest/回锚迁移后退役。formal `render-journal-repository.mjs` 保留至 D-P01 决策，不替换为 fake-success 方法。shared-jdbc/types/naming/layout/writer/registry 由公共集成者协调，不能本组私自覆盖；生成银行输出不在本次写集合。

## 7. 验收与未决项

当前 **全部未执行**。未来先四存储等输入完整文件 `diff -u <scala-file> <js-file>` 与 construct/RHS/方法顺序/MANUAL 保留/锚对账；再目标独占目录 `sbt compile` 及经批准真实 store/session 接口与行为用例。须覆盖主键全列、nullable=false Instant、VO list codec、标量 count、未知 storage、graph 非白名单、vector 键/维度、Mongo 毒行/kind、重复投递与 offset 写失败。以上命令会写 target/cache、数据库行为更有资源副作用，本阶段不运行，不编造 spec 名。CC≤5，>10 拆分或逐方法批准，禁用 String/Any 泛化刷分。

本文件新增 4 个未决语义，另依赖 D-P01/02/03。

- **D-P04**：采用 handler ScalikeJdbcSession 同事务 repository 还是保留 DB.localTx 独立事务？Mongo/vector/graph 的 at-least-once、幂等键和外部写失败重放合同必须逐 sink 定义，不能沿用 ExactlyOnce 名称作证明。
- **D-P05**：table/port 类型不一致（fallback、Long、nullable Instant）、rsBigDecimal 未定义、VO codecs 缺席如何在目标修正，修正应作为显式规格 delta，不复刻可疑 raw。
- **D-P06**：List JSON 单列 vs 子表、Mongo JSON 串 vs BSON Doc、毒行计数 vs 数据库 count 的持久化/查询 ABI 选型及迁移；graph/vector 手写 store 签名/超时/tenant 契约需确证。
- **D-P07**：月度人工例的上界闭/开、day 粒度与重复事件增量累加是否正确，必须按业务重新裁决；不能作为银行已定义行为。

`generatorsModified=false`；`runtimeExecuted=false`。
