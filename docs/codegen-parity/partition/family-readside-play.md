# family-readside-play 逻辑制品分区规范

状态：`content-specification`。仅第一阶段文档；没有运行应用、CLI、测试、typecheck、编译、生成或服务。本文与 [机器分区](family-readside-play.json) 配套，遵守 [分区合同](../PARTITION-AUTHORING.md)、[作者合同](../AUTHORING-CONTRACT.md) 与 [布局标准](../layout-and-style.md)。任何 fixture 均为 `specified-not-executed`，复杂度为 `not-measured`。

## 1. 输入与计数边界

本组独占两个 producer：`scala-cqrs-persistence-readside-v1`（34项）与 `scala-cqrs-play-application-v1`（53项），合计 **87 条 catalogCoverage**。本片段含 **79 个逻辑条目（A 37、B 42，含7类公共附加输出）**；逻辑行可以共享两个精确 catalogRefs，也可把一个物理文件拆为多个职责。附加公共写入另列，不扩张87分母。不是87个物理文件、传统模板族或行为能力。

全部入口、renderer、相关模板及插入式JDBC模板已逐内容读取；固定来源记录完整字节数与SHA，回查 [baseline/index.json](../baseline/index.json)。本次未把工作副本复制成新基线。未捕获的 `lib/project/graph.mjs`、`lib/knowledge-sqlite.mjs` 在JSON `extraSources` 登记准确SHA，仅为核实附加公共写入。

## 2. 两条候选链与银行边界

- persistence入口要求八个products，构建模型先重降binding并核wire layout SHA/既有converter ABI，再 `aggregateProductionJobs → kernelProductionJobs`，追加frame、JDBC读侧、三份构建文件和三类生成测试。
- Play入口要求完整固定manifest、十个products和live implementation capture；复用 **persistence的productionJobs/testJobs**，不是调用其完整render。Play另发构建三件套、HTTP/application层和HTTP smoke。相同模板内容合行，但生成标记、productFootprint、构建依赖和外置实现条件必须保留差异。普通 `generate-product` CLI会拒绝Play候选，项目capture通道才可调用。
- [银行固定配置](../baseline/bank/truthsrc.project.json#L278) 选择 **scala-cqrs-play-service**。其 [真实入口](../baseline/js/generators/scala-cqrs-play-service/generate.mjs#L16) 经 **createEffectRegistry('2') → applicationRegistry('2')**，再做service覆盖；不是本组family。两family独立registered、current、not-selected；不是retired，更不是银行已消费。
- `renderJobs` 检查真实依赖DAG，再由所选SourceEntry写最终字节与映射；`planProductSet`有重放/双plan检查。这里是源码事实，**这些检查本轮均未执行**。

## 3. A/B 边界与同文件组装

### 3.1 纯业务输入、领域事件、Actor请求必须分开

`domain/{Aggregate}Protocol.scala` 同时容纳纯Command与Event。纯Command没有ActorRef，单列B，目标 `modules/kernel/src/main/scala/{basePath}/domain/invariant/params/{Aggregate}Commands.scala`。Event与State对应A `domain-entity`，由唯一实体owner组装到 `domain/entities/{Aggregate}Entity.scala`。不能把所有名为Command的类型算Actor Protocol。

真正的ActorProtocol在glue，发 `Execute(domain.Command, replyTo)`、`GetState(replyTo)` 和Accepted/Rejected。它仍是A的实际差距：缺逐业务应用请求和Handler alias。`Aggregate.scala` 分为A聚合入口与A行为体；Effect、domain、protocol imports及object闭合由唯一owner汇总，行为移至 `application/aggregates/behaviors/{Aggregate}Behaviors.scala`。

`CommandHelpers.scala` 实际只按声明slot序构造纯事件。它对应 **A aggregate-rules-formal 的成功臂**，不是classic `command-helper`。规则参数、守卫、emit成功臂归统一Rules目标owner。当前没有classic的 `toParam/createFailureReply/createSuccessReply` 或 `runReplyingPolicy` 接线；不能以重命名假补齐。`Accepted(events)`也不等于根据持久化后的新State形成业务回复，`replyWith`与`replyWithAndPublish`不互换。

### 3.2 持久化与读侧

| 当前复合容器 | 职责分配与目标 |
|---|---|
| Persistence.scala | B WireRegistration、注册表、frame验证/manifest/parse；A领域↔Frame转换桥。共同原文件头一次，目标分别 `infrastructure/persistence/{Aggregate}WireProtocol.scala`、`.../converters/{Aggregate}PersistenceConverters.scala`。 |
| Envelope.scala | B防御复制信封/身份摘要；A projection-repository-port 的typed Cursor/Row/Page；B StoredState/ProjectResult/CatchUpResult/ShutdownResult。目标为应用projection载体、仓储companion和ProjectionProgress，不能把技术进度误当领域State。 |
| Repository.scala | A Session端口与A JDBC实现分开。补主仓储接口时保持transaction同步session；ThreadLocal、ownerThread、connection/statement/result关闭、unknown commit处理仍由唯一实现owner负责。 |
| EventSource.scala | A source/provider端口与JDBC实现分开。JDBC source读取投影库event副本，**不是journal**。Play实际open另接LevelDB JournalSource。 |
| Runner.scala | A初始化/consume/catchUp/discover/start的投影协调；B容量接纳、失败Promise、计数、poll/shutdown timer与drain。`schedulePoll`原方法不能两份复制：A提供工作，B独占timer。 |

JDBC处理的顺序固定为：复制信封 → 验frame → 事务检查offset/重复bytes → decode领域事件 → 旧State fold → append event → replace state → replace index → checkpoint → commit。序号用 `Math.addExact`；不改成普通加法。commit已尝试后不能把rollback视作确定未提交。PID摘要是原UTF8 SHA256小写hex，不能“统一格式”改变。

B的明确目标还包括Frame `.proto`、严格Frame serializer、H2 Schema和DDL、`reference.conf`、empty-state/replay/frame测试。Frame六字段号1–6、serializer ID/manifest与注册typeId/version/SHA全部冻结。当前Frame的 `base.persistence.protobuf` 技术namespace是布局例外，不能为三层布局静默改PB包。A的业务proto/converter与B的技术frame/精确文本codec也不混为同一族。

### 3.3 Play应用与HTTP

| 逻辑职责 | 分类与完整目标模式 |
|---|---|
| Outcome/CommandResult/Request DTO | B `modules/kernel/src/main/scala/{basePath}/application/services/{Aggregate}Api.scala`；保留错误码和NoChange/Applied区别。 |
| 查询接口与Receipt struct | A `modules/kernel/src/main/scala/{basePath}/application/queries/{Aggregate}Queries.scala`；interface/companion一次组装。 |
| 业务command/query服务 | A `modules/glue/src/main/scala/{basePath}/application/services/{Aggregate}CommandService.scala` 与 `application/queries/{Aggregate}QueryService.scala`。 |
| Authority与HTTP codec | B `modules/glue/src/main/scala/{basePath}/infrastructure/web/{Aggregate}Authority.scala`、`{Aggregate}HttpCodec.scala`；前者只有认证/CSRF接口，真实算法由ext提供。不是退役Scala Policy。 |
| 资源目录 | B `modules/kernel/src/main/scala/{basePath}/application/services/{Aggregate}ResourceDirectory.scala`，显式三种身份，不从类名反推PID。 |
| 应用装配 | A `src/main/scala/{basePath}/infrastructure/bootstrap/{Aggregate}ApplicationBootstrap.scala`；构造executor/pool/actors/repo/source/runner/services并立即注册清理。 |
| 请求就绪与排空 | B `src/main/scala/{basePath}/infrastructure/bootstrap/{Aggregate}ApplicationRuntime.scala`，独占ready/closing/admitted/Promise；与装配不重复创建资源。 |
| Settings、Lifecycle、CloseReport | B `src/main/scala/{basePath}/infrastructure/bootstrap/{Aggregate}{Settings,ResourceLifecycle,CloseReport}.scala`，JSON逐文件展开，固定deadline/逆序释放/错误资源具名。 |
| Controller与授权门 | A `src/main/scala/controllers/{Aggregate}Controller.scala`；B `modules/glue/src/main/scala/{basePath}/infrastructure/web/{Aggregate}RequestAuthorization.scala`。原controller imports/class头唯一owner，角色/资源/CSRF校验先后不改。 |
| Play错误/Components/Loader | B `src/main/scala/controllers/{Aggregate}HttpErrors.scala`；`src/main/scala/{basePath}/infrastructure/bootstrap/{Aggregate}{Components,Loader}.scala`。 |
| routes/view/config | A `conf/routes`；B `app/views/{viewName}.scala.html`、`conf/application.conf`。DTO/数据库不得另开未授权页面查询路径。 |

当前 `composition`、业务根内 `controllers` 是三层布局差距，目标不是把整块混合代码挪一层便结束。保留family多模块物理根：kernel/glue/root与Play框架view/conf不混同银行formal的app根。禁止新增业务根第四层api/web。

应用的可读业务路径是：HTTP有界body → application.admit → authenticate → 角色/资源 → 写操作CSRF → typed Request → CommandService → Actor Execute → pure Rules/emit → persist/fold → reply；另一路真实journal Frame → projection handler/JDBC index → QueryService →同权限JSON或Twirl页。该路径来自源码接线，不代表已经运行成功。

## 4. B的fixture与质量合同

JSON每行均有具体目标、完整construct迁移、fixture触发条件和layout章节；不使用“其它”桶。重点fixture必须覆盖：

- 精确金额precision/scale/unit、非法canonical text、typed map重复键与encoded-byte排序，名义类型不能因同构合并。
- 正常、重复、冲突与gap事件；resource/PID分区；事务回滚、提交不确定、session外泄/跨线程/重入；部分schema、IGNORECASE或不兼容键拒绝。
- runner容量、null/throw Future、同PID共享catchup、关闭排空/超时、失败后停止poll；应用逐资源构造失败后的逆序释放。
- 重复JSON键、多个root、非法UTF8、Long字符串边界、resource绑定cursor、reader写拒绝/CSRF失败、认证基础设施故障、HTML转义。
- build两profile分开；源码capture ABI、外置root disjoint、loader/config缺失失败，不能自动填凭证/存储路径。

imports由模型汇总，不靠FQN铺满或全局隐式导入。B采用Scala/JDK、框架、项目分组；所有Scala按普通方法CC目标≤5、超过10待拆或逐方法例外；当前没有测量。generated tests只测空State、空history、Frame smoke与raw JSON parser，不能替代独立非空业务/真实JDBC/跨JVM oracle。

## 5. 附加公共写入与固定来源

真实terminal channel额外写 `.truthsrc/canonical.json`、`request.json`、`compiled.json`、`inputs.json`、`truthsrc.ledger.json`、`anchors.json`；项目通道还写 `{projectDirectory}/.truthsrc/knowledge.sqlite`。共七类，已列 `uncataloguedOutputs` 的B行，含具体目标、职责和fixture。

这些是 **本组manifest合同之外** 的公共wrapper/apply输出，不断言全catalog其他producer缺项。集成者按公共owner去重。anchors的自有临时文件是该逻辑制品的瞬态资源，不另算永久文件。SQLite不等银行业务读库，也不据源码猜测特定journal mode。本片段不授权写这些文件，本次均未写。

## 6. 基准例外与实施阻断

1. A以 [scala-artifacts.json](../scala-artifacts.json) 的raw classic 39+3为参照。DomainService/InvariantRule/QueryService自身有 `???`，CommandHelpers/Behavior有MANUAL槽，Bootstrap有四变体；不把人工完成golden或`template/products/*`替代基准。
2. `invariant-rule` catalog键在本family实际是formal rules；`command-helper`键实际是纯emit成功臂。映射依据内容，不改catalog键以美化计数。没有伪造classic缺项JS输出；全42族反查交集成者。
3. main Repository API端口缺失、通用Actor Execute/reply合同、Frame技术namespace与classic分片bootstrap差异均是具体A/接口缺口，不因源码存在就标通过。
4. readside Cursor允许空mapKey，而HTTP cursor解析要求非空scalar；是否允许该索引值须明确裁定，不能在格式整改中改变分页语义。
5. source存在/可达、bank consumption、同输入产物、runtime pass是四个独立结论。本组前两项分别为conditional callable、bank not-selected；后两项未运行。不可标parity-PASS/behavior-PASS。

唯一组装owner在JSON `physicalAssemblies` / `targetAssemblies`，包括文件头、imports、trait/companion、初始化和资源管理。实施者必须先统一接口，再迁移全部引用与final-byte映射；本阶段稳定业务ID、PB、PID、nominal和overflow均保持不变。
