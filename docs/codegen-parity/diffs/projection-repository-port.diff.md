# projection-repository-port（23）内容规格

## 1. 范围、状态、固定来源

- Artifact id：`projection-repository-port`；状态：`decision-required`。已有 legacy 对应 renderer，但 formal 银行链没有同责任接口，不能因 `Repository` 同名标 exact。
- 基准是传统 Scala 链，不是 `template/products`。固定 HEAD、SHA-256 见 [inventory](../scala-artifacts.json) 与 [snapshot index](../baseline/index.json)。
- 完整 M/B/T：[ProjectionRepositoryModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/ProjectionRepositoryModel.scala)、[ProjectionRepositoryBuilder](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/builder/application/ProjectionRepositoryBuilder.scala)、[ProjectionRepositoryTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionRepositoryTemplate.scala)。
- 调度：[CQRSApplicationGenerator](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala#L803) 对 infrastructure repositories 中每个 `ProjectionRepositoryMetadata` 先发接口、再发实现；不是每个 handler 一仓库。每个元数据对象一文件，内部含 DTO companion 与 trait。
- 单项目路径 `app/<business-base>/application/projection/repository/<Base>Repository.scala`；multi-project 为 `modules/kernel/src/main/scala/<business-base>/application/projection/repository/<Base>Repository.scala`。尖括号中的包路径以 `/` 分隔。遵循传统 BC 包布局，业务 base 下只保留 `domain/application/infrastructure` 三层；模块是物理源根，不能成为第四业务包。
- [人工参考](../baseline/curated-scala/net/imadz/application/projection/repository/MonthlyIncomeAndExpendsSummaryRepository.scala) 的文件名拼写 `Expends` 与声明 `Expense` 不一致，不能复制为命名标准。人工方法是 `filterByPeriodLCRO/updateIncome/updateExpense`，不是把 raw 模板的 upsert 方法改名即可得到的业务。

## 2. Model 全字段与 Builder 推导

字段按构造器原序；未注明默认值即必填。

| Model | 原序、类型、默认值及消费 |
|---|---|
| `ProjectionRepositoryModel` | `selfType: TypeRef`（trait/文件身份）；`isImplementedBy: TypeRef`（单项目 DI）；`dtoModel: StructModel`；`methods: Seq[RepositoryMethodModel]`；`dependencies: Set[TypeRef]`；`morphisms: Seq[MappingMorphism] = Nil`；`noteIds: Seq[String] = Nil` |
| `StructModel` | `name: String, companionName: String, fields: Seq[FieldDef]`；生成 `<Base>Table.<Base>`，不是顶层 Row |
| `RepositoryMethodModel` | `name: String, parameters: Seq[FieldDef], returnType: TypeRef, logicIntent: String`；定义在 [AggregateRepositoryModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/model/application/AggregateRepositoryModel.scala#L23) |
| `FieldDef` | `name: String, typeRef: TypeRef, defaultValue: Option[String] = None, comment: Option[String] = None, noteId: Option[String] = None, description: String = ""`。本模板只消费名称/类型及锚描述，不输出 defaultValue/comment |
| `TypeRef` | `name: String, packageName: String, typeParams: Seq[TypeRef] = Nil`；`signature` 保留泛型，TupleN 输出元组；依赖递归含自身和参数。`shouldImport` 排除空包、同包、scala 根包、java.lang |

共享完整定义：[TypeSystem](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)、[ArtifactModel](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala)。继承的 `fqn` 是包名拼 selfType.name，`registerTo` 默认只注册自己；morphisms/noteIds 进入 writer 台账，不自动变成 Scala 成员。

### 2.1 所有存储变体

Builder L67–73 明确分派 `PgVectorTableMetadata / Neo4jGraphMetadata / MongoDocumentMetadata / 其他→table`。不能把四路压成一个 JDBC CRUD。

1. **共同 DTO 血统**：`getBaseName(meta.name)` 去约定后缀，以该 DTO 名查 `ProjectionMetadata`，而不是以 repository 名查 registry。fields 保留 schema 原序；类型用 resolver；`Instant` 且 nullable 缺省/true 包 `Option[Instant]`，显式 false 不包；`noteId/description` 随字段。companion 名 `<Base>Table`。
2. **table（L230–329）**：优先非空 readModelSchema；否则 Table 列原序，VARCHAR→String、INT→Int、DECIMAL 前缀→BigDecimal、其余 `customDataType`。非 Table 的 fallback 是空列 `<base-lower>_table`。每个 metadata method 原序映射：Upsert→Unit；Query 解析返回类型，顶层 List/Option 包 Future，顶层 Future 保留，仅其**直接**泛型参数名为 Summary/Any/DTO 名时替换成嵌套 DTO；不是任意深度递归替换。标量 Long 包 Future；其他类型原样。参数正常解析，不自动把所有参数强制 String。
3. **Mongo（L79–83）**：复用 table DTO/方法逻辑，只把实现绑定改 `<Base>MongoRepositoryImpl`；不是新的 BSON interface。分页/count 是否存在仍由 metadata.methods 决定。
4. **graph（L89–140）**：schema DTO 仍生成，即使方法不消费它；方法按 metadata 原序，Upsert→Unit，Query 按声明返回类型解析（不做 table 的 Future 包装）；key/props/tenant 参数来自 metadata，通常 `Map[String,String]`，label/keySpace/端点结构不进入参数。Builder 不自行合成五动词；有声明才发。
5. **vector（L147–222）**：不使用 metadata.methods，固定顺序如下，所有参数均无默认值。

```scala
def upsert(view: View): Unit
def findByIdentity(tenantId: String, sourceType: String, sourceId: String): Future[Option[View]]
def delete(sourceType: String, sourceId: String): Unit
def search(tenantId: String, queryEmbedding: Array[Float], k: Int, sourceType: Option[String]): Future[List[View]]
```

其中 `View` 代表真实 `<Base>Table.<Base>`；向量 embedding 列不作为额外 DTO 字段注入。同步 upsert 内含嵌入调用的意图；delete 缺 tenantId 依赖 sourceId 全局唯一前提，不可擅自推广到银行。

### 2.2 依赖、回锚与 DI

- DTO 字段、方法返回值/参数的 `collectAllDependencies` 合并；table/vector 另加 Inject/Future/List；graph 没有这一组固定 Future/List。非 multi 加实现类型和 ImplementedBy；multi 去掉这两项；最后 `shouldImport(pkg)`。
- [TypeResolverDSL](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeResolverDSL.scala#L474) 统一 repository 命名与 DTO 嵌套 FQN；[PackageLayout](../baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala#L68) 提供包路径。
- `morphismsOf`：DirectField→writtenBy 到事件字段端点；AggregateIdentity→rmOf 到源聚合；Computed/Constant/Unresolved 及不能解析的端点不发。`memberOwner=DTO名, memberNoteId=字段noteId`。不能为 computed 凭空补关系。`noteIds` 是投影号，不是所有字段号。
- Builder 读取 sys.props，而 template 的 `multiProject` 是可变开关；实施须避免两者不同步造成接口无注解却残留实现 import。

## 3. 从上到下的输出 construct/RHS 账

| 顺序 | 完整生成规则 |
|---|---|
| 1 package | `package model.selfType.packageName` |
| 2 imports | dependencies 按 fqn 排序→取 fqn→过滤空/等于当前包/java.lang 前缀→追加单项目 `com.google.inject.ImplementedBy, javax.inject.Inject` 或 multi 仅 Inject→distinct。最后 [CodeGenerationDSL.ImportDeclaration](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/dsl/CodeGenerationDSL.scala#L20) 再全局排序。不得误写成“固定 imports 最后输出” |
| 3 DTO object | `object <Base>Table { ... }`，无父类、构造参数/注解；`KnowledgeAnchorDoc.fieldDoc(fields)` 紧邻嵌套 `case class <Base>(field: Type, ...) {\n\n}`，字段按 Model 序、关键字转义。raw 不加 final，不发 codec |
| 4 trait 文档/注解 | Repository Interface / DTOs in companion 两行文档；单项目 `@ImplementedBy(classOf[Impl])`，multi 无该注解（但仍可能有未使用 Inject import） |
| 5 trait | `trait <Base>Repository { import <Base>Table._; ... }`；无父接口/self-type/type alias/构造器 |
| 6 方法循环 | 按 methods 序：参数锚文档→`def name(params): ReturnType`→下一行 `// Logic: intent`，方法间空行。参数是一个普通参数列表；无 implicit、curried、overload 合成、默认值、RHS、执行副作用或 MANUAL body |

[KnowledgeAnchorDoc](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/KnowledgeAnchorDoc.scala) 仅给真实 noteId 发 `@param ... @knowledge id@hash`，无来源不造锚。本阶段记录旧规则，不授权新增知识注释。用户命名/import 标准覆盖历史瑕疵：类型 PascalCase、方法/参数 lowerCamelCase，SQL 列名与 Scala 字段名分开映射；不能把 snake_case SQL 名直接当 Scala API，也不能刷出 ServiceService/HostHost。

## 4. JS 四层差异与有上下文对照

| lane | 已读固定源码/符号 | 结论 |
|---|---|---|
| formal 银行 | [render-journal-repository](../baseline/js/generators/scala-cqrs-play-service/render-journal-repository.mjs#L62) `renderJournalRepository/indexMethods`；[render-journal-readside](../baseline/js/generators/scala-cqrs-play-service/render-journal-readside.mjs#L214)；[generate.registry](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L59) | 输入 projectionStore 的 streams/indexes，不是 ProjectionRepositoryMetadata；直接拼模板，没有 port Model；输出 DataSource concrete repository + path-dependent Session，非应用层 DTO trait |
| legacy | [viewrepo](../baseline/js/generators/projection-dsl/viewrepo.mjs) `indexCanonical/tableMethods/graphMethods/vectorMethods/renderTrait/generateViewRepos`（L108/177/253/288/321/937）；[run-all 调用](../baseline/js/generators/run-all.mjs#L2081) | 有 trait/DTO 对应件，不是完全缺失。读取 session field notes/storage，字段和 keys 排序，固定 Metarch 包，PAUSE_VIEW 特例；SQL 追加分页/元素查找，graph typed props 可变成 Any，均不等于 Scala 本次输入/分支 |
| deprecated | [repository renderer](../baseline/js/generators/_deprecated/scala-cqrs-es-projection/templates/repository.mjs) `methodsOf/renderRepository` | 保留四存储接口形状；固定包/旧 stamp，单项目 ImplementedBy；不是 formal service 的 producer |
| 新 family | [buildModels](../baseline/js/generators/scala-cqrs-persistence-readside-v1/build-models.mjs)、[repositoryTemplate](../baseline/js/generators/scala-cqrs-persistence-readside-v1/templates/repository.mjs#L5)、[productionJobs](../baseline/js/generators/scala-cqrs-persistence-readside-v1/render.mjs#L13) | 有经过校验/命名的 Model 和 final-byte writer，但 `Repository.Session` 是 event/state/checkpoint 事务端口，仍是 infrastructure.readside；不能当作应用 read-model repository port。独立 profile 接线见 [generate](../baseline/js/generators/scala-cqrs-persistence-readside-v1/generate.mjs) |

结构性对照，非同输入字节比较。minus 摘自 [银行实际输出](../baseline/actual-js/app/example/bankwealth/infrastructure/projection/BankJournalReadsideRepository.scala#L11)，plus 是明确的传统 BC 接口目标骨架，方法采用人工参考而**不暗示银行已声明月度收支用例**。

```diff
-package example.bankwealth.infrastructure.projection
-object BankJournalReadsideRepository {
-  final case class Row(pid: String, kind: String, resource: String, account: Option[String], principal: Option[String], last: Long, observed: Option[Long], payload: Option[Array[Byte]])
-}
-final class BankJournalReadsideRepository(namespace: String, dataSource: DataSource) {
-  def read[A](f: Session => A): A = transaction(writable = false)(f)
-  def write[A](f: Session => A): A = transaction(writable = true)(f)
-}
+package example.bankwealth.application.projection.repository
+import scala.concurrent.Future
+object MonthlyIncomeAndExpenseSummaryTable {
+  case class MonthlyIncomeAndExpenseSummary(userId: String, income: BigDecimal, expense: BigDecimal, year: Int, month: Int)
+}
+trait MonthlyIncomeAndExpenseSummaryRepository {
+  import MonthlyIncomeAndExpenseSummaryTable._
+  def filterByPeriodLCRO(userId: String, startFromYear: Int, startFromMonth: Int, untilYear: Int, untilMonth: Int): Future[List[MonthlyIncomeAndExpenseSummary]]
+  def updateIncome(userId: String, amount: BigDecimal, year: Int, month: Int, day: Int): Unit
+  def updateExpense(userId: String, amount: BigDecimal, year: Int, month: Int, day: Int): Unit
+}
```

plus 采用无实现依赖的 multi/显式装配方向；若选传统单项目则必须另列 ImplementedBy/import 与 root DI 迁移裁决。禁止删除 journal 的重复事件校验、ownership 或 freshness 契约来伪装完成此替换。

## 5. 胶水与实现槽

- `scala.concurrent.Future` / List/Option 是 Scala 类型；这里没有 Future.successful 假实现。
- `com.google.inject.ImplementedBy` / `javax.inject.Inject` 是 Guice/JSR-330；multi 的 root RepositoryBindingModule 由装配组负责，本模板不发。源码可见不证明目标 JAR/模块方向可用。
- DTO、实现类由本族其它制品提供；graph/vector/Mongo 的外部存储依赖不应进入中立 port，但单项目 raw 的 Impl import 是真实例外，不称全 Onion-clean。
- 人工月度参考有专用范围查询和增量更新语义；raw table Builder 对 Query 仅拼等值条件，不能从这些 method 名推断 LCRO 已实现，详见 [实现 diff](projection-repository-implementation.diff.md)。

## 6. 明确后续 JS 写集合（本次未改）

- proposed：`generators/scala-cqrs-projection-v1/build-repository-models.mjs`、`templates/repository-port.mjs`；负责四存储 Model、方法类型、声明序、锚来源，复用 legacy 的有限派生规则而不是复制它的固定包/例外表。
- proposed：本组公共 `generators/scala-cqrs-projection-v1/build-models.mjs`、`render.mjs`、`generate.mjs`、`generator.json`。**组装 owner 为 projection 集成者**：一份 job graph 发 port/impl/projection/apply-event/handlers，不能五份 writer 抢同一文件。
- adapt/retire-after-migration：`generators/projection-dsl/viewrepo.mjs` 的 renderTrait/tableMethods 等；`generators/run-all.mjs` 停旧 writer 仅在新调用方/manifest/path/回锚全部迁完之后。deprecated 路仅作来源，不重新上线。
- formal 的 `generators/scala-cqrs-play-service/generate.mjs`、`render-journal-readside.mjs` 是调用方协调写集合，不在本阶段动；银行 journal 是否保留为独立技术投影待 D-P01。
- 公共 names/type/layout/writer/registry 与产品 schema 由集成者管理；本组只提依赖，不直接改共享文件或生成应用。

## 7. 验收与具体未决项

全部未运行：同等 metadata 输入逐文件对账（四存储 × single/multi）、字段/方法/参数原序、完整 imports/注解/RHS 缺席、DTO 嵌套、标量/容器返回型、nullable Instant、锚与物理路径、重复生成稳定性；真实 DI 编译/绑定与 repository 行为验证另经授权。未来命令形状可用 `diff -u <approved-scala-output> <approved-js-output>`，以及目标独占目录内 `sbt compile`；不把现有 repo 验证命令当作本族测试，未编造 testOnly suite。生成与测试会写 target/cache，本阶段禁止执行。

普通方法 CC≤5；>10 要拆分或逐方法例外审批，不能换 String/Any dispatcher 降分。计数：本文件 3 个未决语义（组内共享编号不重复计数）。

- **D-P01**：选 Akka Projection 应用仓库路线、保留银行 per-PID journal 技术投影，或双轨并存？迁移源/namespace/offset/查询/ownership 的接口及退役边界必须显式确定；现状非 exact。
- **D-P02**：单项目 `@ImplementedBy` 反向依赖是否按 multi 方式统一转 root binding；同时是否接受 Future/List/Option 一层替换而非任意深度解析？这是 ABI/DI 决策，不是格式修改。
- **D-P03**：vector 三键身份与两键 delete 的全局唯一假设、graph typed props 是否保持 Map[String,String]，以及字段/identityKeys 声明序与 legacy 字母序，须用明确输入合同裁决，不能靠相似名归类。

`generatorsModified=false`；`runtimeExecuted=false`。
