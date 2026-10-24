# P11 部署面批设计（2026-10-24，冻结）

## 一、目标

部署面三面收口（用户令「开部署面批. mongo 可以用 docker 服务已经启动」——journal 选型=Mongo，用户决策）：

① **event-stream source**：聚合事件（TransferRequested）→协调器真实接线——生成 entry 增
   `installEventSource`（Persistence Query 读共享 journal 的 live 事件流→`from_eventTriggerStart`→
   幂等 Start），清掉 entry 头注释「The event trigger path still needs an event-stream source
   (declared obligation)」的账。
② **物理多 JVM**：D2 两进程集群测试（sbt fork JVM×2：seed/join），事件驱动全链路
   （命令触发聚合→journal 事件→source→协调器→participant→terminal→余额断言）。
③ **共享耐久 journal**：D1 从 persistence testkit 换 akka-persistence-mongo（共享 run-scoped
   db），严格序列化面经真实 journal（jackson-cbor/strict-saga proto）。

saga-core 零改动。A/B/C 测试（testkit 面）零改动。

## 二、勘探定案（事实基础）

1. **D1 现状**（emit-strict-spec.mjs:352-376）：双 ActorSystem 单 JVM、per-system testkit
   journal、seedFunds=PersistenceTestKit.persistForRecovery、startSaga=entry.start 直驱。
2. **事件触发绑定全家已在生成面**：SagaModule.from_eventTriggerContract /
   From_eventTriggerBinding + from_eventTriggerStart(source: TransferRequested, host, replyTo)
   （幂等 transactionId=operationId，TriggerStart(opId, Args(from,to,amount))）——缺的只是
   订阅本体。FixtureHost.from_eventTrigger 绑定实现在生成件内（含形状守卫）。
3. **事件面**：CreditBalanceEntity.TransferRequested(operationId, from, to, amount) extends
   CborSerializable（无 replyTo），由 StartTransfer 命令持久化；saga participant 面
   （ReserveFunds/RecordIncomingCredits…）由协调器经 FixtureHost 驱动，StartTransfer 自身
   不做资金动账（无双扣面）。
4. **协调器 Start 幂等语义**（StrictSagaCoordinator.scala:196-204）：同 txId+同 argsDigest+
   同 bytes → Status(state)；同 txId 异 args → ConflictingIdentity——多节点装 source 重复
   Start 安全。
5. **物理多 JVM 事实**：in-JVM ActorSystem eventStream 看不到另一 JVM 持久化的事件——
   event-stream source 的生产形态=共享 journal 的 Persistence Query live 流（journal 即
   事件总线），不是 ActorSystem eventStream。
6. **Mongo 插件事实**（maven jar 勘探实锤）：app scaffold build.sbt 已带
   akka-persistence-mongo-scala+rxmongo 3.0.8（reactivemongo 1.1.0-noshaded.RC21 Mongo6
   兼容线+dependencyOverrides 全套）与 akka-persistence-query 2.6.20；插件 id：journal=
   `akka-contrib-mongodb-persistence-journal`、snapshot=`akka-contrib-mongodb-persistence-snapshot`、
   readjournal=`akka-contrib-mongodb-persistence-readjournal`；driver 扩展类
   `akka.contrib.persistence.mongodb.RxMongoPersistenceExtension`（rxmongo jar reference.conf
   实锤；选 RxMongo=scaffold Mongo6 调优线）；read journal `ScalaDslMongoReadJournal.allEvents()`
   live 全库事件流（免 tag）；`use-legacy-serialization=false`→payload 走 akka serializers
   （CborSerializable→jackson-cbor、StrictDurable→strict-saga proto 均已绑定）。
   mongo URI key=`akka.contrib.persistence.mongodb.mongo.mongouri`。
7. **conf 链**：Play 把 `conf/` 当资源目录（target/scala-2.13/classes 实锤）→ test classpath
   有 application.conf→`include "serialization.conf"`→allow-java=off+jackson-cbor 绑定在测试
   生效（P10 allow-java=off 全 strict 面的生效链）。D 面新增 conf 全部测试内 parseString，
   conf 文件零改动（金样惰性）。
8. **金样事实**：example/tree 无 saga 文件→P9 golden 无 fixture 产物→emit-strict-{host,spec}.mjs
   改动金样惰性；**唯一金样可见变化=scaffold build.sbt（Test/fork:=true）**——两 JVM 测试需要
   fork 后 java.class.path 才是应用 test classpath（unforked=sbt launcher classpath，不可用）。
   本批金样重定基（diff 审查=build.sbt 一处），双跑字节恒等照旧硬门。
9. **funding 命令守卫**（CreditBalanceRules）：RecordIncomingCredits 60007（fresh 可过）/
   CommitIncomingCredits 60008（已 record 可过）——命令驱动 seeding 可行，比 testkit 直写
   更诚实（走聚合自身命令面，生产同款）。
10. **运行环境**：metarch-mongo 容器（mongo:6.0.3-focal）用户授权使用（0.0.0.0:27017，
    docker exec mongosh ping=1 实测）；不删 journal 证据→run-scoped db 命名留存
    （strict_deployment_d1/d2_<nanotime>）。
11. **BC 对应面**：FixtureHostTemplate.scala（template/application/transactor/）+
    BC scaffold build.sbt（mongo 依赖已 parity、无 fork）。
12. **配方**：串树=example/saga-money-transfer-serial；run-all
    `node run-all.mjs <tree> <out> [--saga-core-jar <abs>]`；spec 包名=fixture；
    应用测试 JDK11+sbt1.4.9+隔离缓存。

## 三、改动面

### truthsrc（本批先行）
1. **generators/saga-dsl/emit-strict-host.mjs**：entry 增 `installEventSource(system, sharding,
   coordinator)`——PersistenceQuery(system).readJournalFor[ScalaDslMongoReadJournal]
   ("akka-contrib-mongodb-persistence-readjournal").allEvents()→viaMat(KillSwitches)→按事件
   触发类型 pattern match（m.triggers 非 command 侧）→`coordinator ! from_eventTriggerStart
   (ev, host, replySink)`（replySink=吞回复 system actor）；返回 UniqueKillSwitch；每事件
   触发一条 match 分支；头注释 declared obligation→已交付描述。多事件触发器逐分支通用。
2. **generators/saga-dsl/emit-strict-spec.mjs**：
   - `mongoBaseUri`（SAGA_MONGO_HOSTPORT env 缺省 127.0.0.1:27017）+`mongoReachable`
     （TCP 2s 探测）assume 门——不可达=显式 canceled 带原因（诚实非静默 skip）；
   - `mongoClusterConfig(port, seeds, uri)` helper（cluster+mongo journal/snapshot/driver/
     mongouri）；
   - `seedFundsByCommands`（ask 聚合 RecordIncomingCredits→CommitIncomingCredits）；
   - **D1 升级**：双 system 单 JVM 共享同一 mongo run-db（journal 面单独隔离证明），
     startSaga 直驱保留，余额双系统断言+assertPublished 保留；
   - **D2 新增**：父测 ProcessBuilder fork 两 JVM（java -cp System.java.class.path +
     FixtureDeploymentNodeMain）；join 节点：命令 seeding→spawnClusterSingleton→
     installEventSource→sharding 发 StartTransfer→轮询 entry.status 至 terminal→断言
     Succeeded+余额→`D2-RESULT` stdout→exit 0；seed 节点：sharding+singleton 挂起；
     父测断言 join 退出码 0+stdout 结果行；日志落 target/deployment-face/（失败证据留档）；
   - 新工件 **FixtureDeploymentNode.scala**（test scope，同包 fixture）：seed|join 双模式
     main（与 spec 同一发射源，config/behavior/seeding 无漂移）。
3. **generators/scaffold-static/build.sbt**：`Test / fork := true`（+注释：两 JVM 部署面测试
   需要 fork classpath）。

### backkend-codegen（parity 移植，truthsrc 验证绿后）
4. FixtureHostTemplate.scala 同款（entry source+D1 mongo+D2+node main）。
5. scaffold/build.sbt fork parity。

### 不动
saga-core 全部；serialization.conf/application.conf；A/B/C 测试；BC/truthsrc 生成器其余；
run-all 接线（spec 发射入口已存在）。

## 四、验收门

1. 串树 run-all 重产→应用测试全绿：A1-A3/B1-B3/C1（testkit）+D1（mongo 单 JVM 双 system）
   +D2（mongo 两 JVM 事件驱动）。
2. D2 两 JVM 物理证明：join exit0+D2-RESULT 行；日志留档 target/deployment-face/。
3. 金样：P9 配方（example/tree 剥 loan 五件）重产→与 P9 golden diff=**仅 build.sbt fork 行**
   （重定基登记）；双跑字节恒等。
4. truthsrc 全量 npm test（基线 1705+）。
5. BC 全量 789/789+；BC 应用重产（P5 三输入+P10 jar→新轮产物）测试同绿（两管线同证）。
6. mongo run db 留档不删；D 面 allow-java=off 生效（serialization.conf include 链）。

## 五、红线自查

- 不 push/publish/publishLocal；commit 等用户明示。
- 生成应用修复全部走 generator/scaffold 源面（emit-strict-{host,spec}.mjs/scaffold build.sbt/
  BC template）+重产，不手补生成源码。
- 不启停共享服务：mongo 容器启动=用户本批明示（「mongo 可以用 docker 服务已经启动」，
  metarch-mongo 原卷配置启动）；不触 fsmams-*。
- 不占 9000/2551：集群端口 freePort 动态；mongo 27017 用户供给。
- run-scoped db 命名留证（不删 journal/失败证据）；D2 日志落 target 留档。
- 诚实标记：D1/D2 不可达=canceled 带原因（assume），非静默 skip；fork 依赖写入 spec 头注释；
  金样重定基显式登记（唯一 diff=build.sbt fork）。
- 完成侧（terminal 后 publishCompletion 的生产驱动者）不在本批冻结语义内——D1/B 面照旧
  测试驱动发布，D2 断言不含 ledger——登记为后续候选（谁拥有结果发布=独立语义决策）。

## 六、实施记录（2026-10-24，探针驱动 6 轮）

**改动清单**：
- truthsrc（3 改+1 新发射件）：
  - `generators/saga-dsl/emit-strict-host.mjs`：entry 增 `installEventSource`（PersistenceQuery
    readJournalFor[ScalaDslMongoReadJournal]("akka-contrib-mongodb-persistence-readjournal")
    .allEvents()→viaMat(KillSwitches)→事件触发类型 pattern match→`coordinator ! from_eventTriggerStart
    (ev, host, replySink)`；replySink=吞回复 system actor；implicit ec+SystemMaterializer
    (.materializer)+toMat(Keep.left).run()——返回 UniqueKillSwitch）；头注释 declared
    obligation→已交付描述；imports 增 Behaviors/PersistenceQuery/ScalaDslMongoReadJournal/
    KillSwitches/Materializer/SystemMaterializer/UniqueKillSwitch/Keep/Sink。
  - `generators/saga-dsl/emit-strict-spec.mjs`：头注释与类 docstring 改 D 面语义；增
    MongoHostPort（SAGA_MONGO_HOSTPORT env 缺省 127.0.0.1:27017）/mongoUri/mongoReachable
    （TCP 2s）/mongoClusterConfig（journal/snapshot/readjournal 三 id+RxMongo driver+run-scoped
    db URI）/seedFundsByCommands（RecordIncomingCredits→CommitIncomingCredits 聚合命令面）；
    D1 重写（双 system 单 JVM 共享一 Mongo db·直驱保留）；新增 D2（事件流 source 单 JVM——
    installEventSource 先于命令，命令发聚合不发协调器，identity.transactionId==opId 断言）与
    D3（ProcessBuilder 两 JVM：seed/join，join 节点 funding→source→命令→轮询 terminal→
    D3-RESULT stdout→exit0，父测断 exit0+结果行，日志落 target/deployment-face/）；新发射件
    **FixtureDeploymentNode.scala**（seed|join 双模式 main，与 spec 同一发射源）。
  - `generators/scaffold-static/build.sbt`：`Test / fork := true`（D3 需要 fork 后
    java.class.path）；**摘除 akka-persistence-mongo-scala 插件 jar**（见调试轮次 4）。
- backkend-codegen（parity 移植，同款语义）：FixtureHostTemplate.scala（renderEntry 同款
  installEventSource/头注释；renderSafetySpec 同款 helpers+D1/D2/D3；新增 renderDeploymentNode
  +generateTestFiles 挂 FixtureDeploymentNode）；scaffold/build.sbt 同款 fork+jar 摘除；
  FixtureHostSpec/SagaAnchorIndexSpec 钉点测试按新发射契约合法更新（D 三测断言+node 工件入
  锚集合）。

**调试轮次（6 轮）**：
1. run-all 调用面：serial 树需 `--saga-binding <tree>/../bindings.json`+树参数=**tree/ 子目录**
   （父目录→sagas:0 静默跳过 strict 段）。
2. installEventSource 三连编译错：缺 implicit ec（FixtureHost 构造需）/SystemMaterializer
   取法（`.materializer`）/Sink.foreach PF 类型（`[Any]`）。
3. runWith 语义：runWith 返回 sink 侧 Mat——改 `.toMat(Sink.foreach[Any]{…})(Keep.left).run()`
   取 source 侧 UniqueKillSwitch。
4. **全量套件套件级 abort 根因**：`akka-persistence-mongo-scala` 与 `akka-persistence-mongo-rxmongo`
   两插件 jar **都定义同名查询类**（CurrentAllEvents$ 等，签名 source(ScalaMongoDriver) vs
   source(RxMongoDriver, Materializer)）——双 jar 同类不同签名=classpath 掷币，read journal
   调用点 NoSuchMethodError（javap 双 jar 实锤）。修=摘除 scala 插件 jar（我们用 RxMongo
   扩展），两 scaffold parity。D1（无 read journal）先前已绿——错误只在 D2/D3 触发。
5. FixtureDeploymentNode 编译三连：import 合写非法（`{Behaviors, AskPattern._}`）→拆分；
   implicit ec 次序（spawnClusterSingleton 先于 join 分支声明）；typed `system.terminate()`
   返回 Unit（whenTerminated 才是 Future）。
6. BC 钉点测试两轮：FixtureHostSpec（Vector 单件→双件+D 三测名）；SagaAnchorIndexSpec（漏斗
   锚集合+test/fixture/FixtureDeploymentNode.scala）。

**验收结果**：
- truthsrc 串树应用（/tmp/p11-deployment-app）：**10/10**（A1-A3/B1-B3/C1 testkit 面+
  D1 共享 Mongo journal 5.2s+D2 事件流 source 2.9s+D3 物理两 JVM 13.5s，allow-java=off 全
  strict 面）。
- D3 证据：join 节点 stdout `D3-RESULT status=Succeeded op=op-d3-… alice=99900 bob=100100`
  （/tmp/p11-deployment-app/target/deployment-face/d3-{seed,join}.log）。
- 金样：P9 配方重产 diff **仅 build.sbt 两处**（mongo-scala jar 摘除注释+fork 行）——金样重定
  基成立，其余字节恒等；双跑字节恒等 ✓（/tmp/p11-golden）。
- truthsrc 全量 **1705/1705**。
- BC 全量 **789/789**（74 suites；两钉点测试按新契约更新）。
- BC 应用重产（P5 冻结三输入+P10 候选 jar 1009300e…，generatorVersion=p11-deployment-face-
  20261024）→ 落位工作区根 target/p11-deployment-face-20261024/ → FixtureSafetySpec 10/10
  （D 面同证，两管线 parity 达成）。
- mongo 证据：run-scoped db strict_deployment_d{1,2,3}_<nano> 留存不删（metarch-mongo 容器，
  用户授权使用；D3 最终绿轮三库=d1_247906778781169/d2_247911975970279/d3_247914857063712）。

**关键事实（登记备查）**：
- event-stream source 的生产形态=**共享 journal 的 Persistence Query live 流**（物理多 JVM 下
  in-JVM eventStream 看不到另一 JVM 持久化事件——journal 即事件总线）。
- Mongo 插件 id：journal=akka-contrib-mongodb-persistence-journal、snapshot=
  akka-contrib-mongodb-persistence-snapshot、readjournal=akka-contrib-mongodb-persistence-
  readjournal；driver 扩展=akka.contrib.persistence.mongodb.RxMongoPersistenceExtension；
  URI key=akka.contrib.persistence.mongodb.mongo.mongouri。
- 协调器 Start 幂等（同 txId+同 args→Status(state)；异 args→ConflictingIdentity）——多节点装
  source 重复 Start 安全。
- conf 链：Play 将 conf/ 当资源目录→test classpath 有 application.conf→include
  serialization.conf→allow-java=off+jackson-cbor 绑定在测试生效（P10 生效链本批实锤）。

**边界与遗留**：
- 完成侧（terminal 后 publishCompletion 的生产驱动者）未在本批冻结语义：D1/B 面照旧测试驱动
  发布，D2/D3 断言不含 ledger——「谁拥有结果发布」独立语义决策，留后续批。
- D3 集群 failover（杀协调器节点→singleton 迁移续跑）未含——候选后续批。
- 生产 conf（conf/application.conf 等）零改动——生产 journal 装配（Play 启动面）独立债。
- mongo run-scoped db 每轮新增不删（证据留存）；可定期人工清理（红线不删 journal 证据）。

