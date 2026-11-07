# BC文件管线参照与兼容迁移对照

最后更新: 2026-11-07

完整产物职责说明现统一到 [artifactType目录](docs/artifacts/scala-cqrs/README.md)，包括本文原范围之外的多模块port/绑定、BC JS最终写者和Monarch R1/R2。这不扩大下文任务108的兼容验收结论；本表是特定profile对照，不是所有新产物均已被银行消费的认证。旧文档、模块放置和命名差异见[漂移记录](docs/artifacts/DRIFT.md)。

用户在任务108明确选择**兼容迁移**：允许必要银行手写接线调整，使生成仓储、读侧和
启动装配真正被使用；保留公开API、原State/Event/Request/Reply载体、protobuf、PID、
金融行为及冻结runtime。必要结构差异逐项声明并验证，本地Actor仓储不冒称集群sharding。
本表按这一裁定验收，不再把“所有手写仍冻结”作为阻塞，也不改称BC全量字节相等。

## 1. 参照范围与独立证据

参照BC `13c151b8e5e9a707b23a5e678229b5d8b9219e8c` 的普通`CodegenMain`与JS
最终写者，不以`semanticProductsFile`提前返回分支代替完整文件管线。本轮BC只读，
没有为BANK运行BC生成器，没有写共享应用或改BC输入。

普通`tools/gen_pipeline.mjs:466–535`列出codegen、rules、projection handlers、
policy execution、API、DDL、tests/functions、provenance和manifest/apply。其中
`:491–520`明确把部分JS步骤限于Metarch；不能声称该脚本已经直接为BANK生成一份完整oracle。
当前验收使用明确家族对照、已批准兼容差异、冻结迁移前金融产品/公开源码字节和未修改的
独立业务测试，而非用新生成器同时重写两边预期。

## 2. 家族、真实责任与兼容差异

| 家族 | 当前生成落点／实际责任 | 具名兼容差异与验证 |
|---|---|---|
| 精确值、命令与事件载体 | 原`domain/values`、`domain/*Protocol.scala` | 原case class与JVM类名保留；不同于BC将定义搬入Entity/application。逐字节核对旧Protocol、VO、PB和converter，绝不新增replyTo到领域payload。 |
| Entity与状态初始化 | `domain/entities/*Entity.scala`负责唯一empty初始化；旧`*State.empty`转发 | Entity导出原类型及伴生对象，不重复定义状态；Events命名空间避免与State/Event别名冲突。默认值来自既有domain-folds，不猜中性值或首字段ID。 |
| application Command/Reply | `application/aggregates/*Protocol.scala`导出真实Request/Reply及handler类型 | Actor命令族是旧Aggregate.Request，不误用纯业务payload Command；同时导出构造/extractor伴生对象。 |
| 命令行为 | `application/aggregates/behaviors/*Behaviors.scala`进行authority检查、命令分派、Rules决策和Effect持久化后回复 | 原顺序、空事件成功、拒绝及外部入口检查保留。新代码由Bootstrap真实调用，不是无人使用的facade。 |
| 规则与参数 | `domain/invariant/*Rules.scala`与`params/*RuleParams.scala` | 保留完整封闭规则核心、显式开放计算端口和旧方法签名薄入口；未替换为待补桩。 |
| 事件fold | `domain/entities/behaviors/*EventHandler.scala`是唯一fold核心，旧入口转发 | 每条fold与事件分支的精确映射跟随真实核心。金融操作/前状态求值/顺序逐段对照旧渲染；不引入默认忽略事件。 |
| Factory／聚合Bootstrap | application Factory端口，`infrastructure/bootstrap/*Bootstrap`装配EventSourcedBehavior | 旧`Aggregate.apply`和Factory入口均进入新实现；沿用`PersistenceId.ofUniqueId`和原adapters，不引入BC tag、快照或backoff策略。旧domain包Actor入口明确是历史兼容层，不将其视为纯领域核心。 |
| Aggregate Repository | `application/aggregates/*Repository`实际缓存并按显式身份查找ActorRef；BANK Runtime已消费 | 采用用户批准的本地Actor技术扩展，不是BC`ClusterSharding.entityRefFor`。spawn/PID登记/停止仍由BANK资源owner提供，仓储关闭只拒绝新查找并释放缓存，不能擅停共享ActorSystem。 |
| 持久化／序列化 | 原PB、DomainConverters、serializer和Event/Snapshot adapters | 保留原固定字段、manifest与JVM载体，不迁成BC EventPO oneof；完整字节对照，实际PB往返与旧事件测试验证。 |
| Saga／pipeline／宿主 | 既有严格finite producers与冻结runtime | 保留三方付款、TA、独立退款、有限SIP，Saga与pipeline不合并；retry/backoff/deadline仍OPEN，未修复或重发。 |
| 服务/API/页面/应用Bootstrap | 原Service协议与Components；两种Loader调用`infrastructure/bootstrap/ApplicationBootstrap` | Bootstrap拥有唯一Factory反射装载、pin核验、composition检查及失败清理；原十四端点、ready等待、鉴权、页面与资源停止职责保留。不自动公开聚合。 |
| 关系型Schema／Repository／投影 | 显式`projectionStore`生成`infrastructure/projection/*Schema/Repository/Projection/Domain`及`conf/sql/*.sql` | 新`truthsrc.journal-readside/v1`采用原PB状态＋关系索引。不是扁平业务表CRUD，不复用BC手写sidecar或独立嵌套事务。事件、状态、所有权、索引、checkpoint在同Connection/namespace锁事务提交。 |
| 读模型业务选择／授权 | BANK `BankReadside`仅保留typed Ownership/index-selection与查询DTO组装，调用生成读侧 | 六份read-model说明不被猜成SQL；业务owner校验、pending条件、读时跨PID连接仍显式手写端口。SQL、DDL、PB回放、checkpoint、订阅／排空生命周期已由生成代码承担；不是旧读侧整体套壳。 |
| 测试 | 既有生成tests＋固定旧四流actor／JDBC／鉴权／页面测试 | 不用生成器自己构造金融oracle；不改冻结`v1/test`。新独占H2/testkit窗口不冒真实MySQL、HTTP server、浏览器或跨JVM认证。 |
| provenance／manifest／apply／回锚 | 公共图AST、唯一apply/ledger、最终字节span、同图锚 | 使用用户已选择的外置映射，不新增inline `@knowledge`；同一知识在同一文件允许多个真实span，构建准入完整核对它们，不去重为一个文件锚。 |

## 3. 不是本轮新增的生成家族

没有声明独立executionSide policy或graph/vector读侧，相关BC阶段本轮无输入。
此判断不覆盖关系型读侧：后者已显式增加技术声明并真实生成。旧`service.projections`
的event-to-record profile仍不受此实现支持，非空时继续明确拒绝；新增能力是独立具名
`projectionStore`，不把两个合同混为同一个功能。

## 4. 关键参照位置

- BC `src/main/scala/net/imadz/codegen/CodegenMain.scala:183–189`：semantic分支提前返回。
- BC `tools/gen_pipeline.mjs:466–535`：完整最终写者列表与Metarch限定步骤。
- BC `.../template/domain/DomainEntityTemplate.scala:44–101`：State/Event/empty/handler类型职责。
- BC `.../template/application/AggregateProtocolTemplate.scala:33–108`：Command/Reply/handler类型。
- BC `.../template/application/AggregateRepositoryTemplate.scala:37–70`和
  `.../template/infrastructure/repository/AggregateRepositoryImplTemplate.scala:35–55`：Repository查找与sharding实现。
- BC `.../template/infrastructure/bootstsrap/BootstrapTemplate.scala:88–113`：持久化装配、tag/retention/backoff。
- BC `.../template/infrastructure/bootstsrap/ApplicationBootstrapTemplate.scala:43–85`：应用组件启动。
- BC `.../template/application/ProjectionHandlerTemplate.scala:65–178`及
  `knowledge_base/design_docs/field_template/tools/gen_projection_handlers.mjs:186–279`：Scala壳与JS最终handler职责。
- BC `knowledge_base/design_docs/field_template/tools/gen_projection_ddl.mjs:67–103`：DDL最终写者。

省略号路径前缀均为`src/main/scala/net/imadz/codegen/scaffolding/cqrs`。
实际命令与成功/失败回执在BANK `docs/TRUTH-COMPATIBLE-COMPOSITION.md`；总体状态仍须以
[MINIMAL-DELIVERY.md](MINIMAL-DELIVERY.md)最终验收为准，不由本表的结构描述自动推定通过。
