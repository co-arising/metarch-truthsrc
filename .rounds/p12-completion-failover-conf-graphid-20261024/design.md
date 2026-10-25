# P12 批弧设计（2026-10-24，冻结）：完成侧发布者 + D4 failover + 生产 conf journal 装配 + BC 推图 id 统一验证

四候选（用户全列）按依赖序串成一个批弧（p12-completion-failover-conf-graphid-20261024），
每子面独立门，末尾全门。

## 一、勘探定案（事实基础）

1. **协调器单事务生命周期**（StrictSagaCoordinator.scala:196-204 实锤）：终态后
   state.identity 保持 → 新 txId Start=ConflictingIdentity——一个 persistenceId 一笔事务。
   **多事务生产形态（per-transaction 协调器/分片协调器）=独立语义边界，本批不越界、如实登记**。
2. **终态标记**：StrictEvent.Succeeded/Aborted=case object（无 identity 载荷）+RecoveryRequired
   非终态。协调器 journal 事件与聚合事件同库（共享 Mongo）→source 的 allEvents() 流看得到。
   **无竞态窗口**：单事务生命周期下，Succeeded/Aborted 落库瞬间协调器状态即该事务终态
   （下一笔 Start 会被 ConflictingIdentity 拒），ask GetStatus 所得=该事务终态 ✓。
3. **publishCompletion 语义**（entry）：非终态显式抛错；Aborted+有 prepare 确认→compensated
   否则 rejected-before-effects；RecoveryRequired→recovery-required kind（非终态不发布——
   等 Reconcile 续驱后的 Succeeded/Aborted 标记再发布 ✓）；幂等（sagaResults map-absent 守卫）。
4. **bootstrap 现状不对称**：BC ApplicationBootstrapTemplate 已有 strictWiring 块
   （strictEntries→spawnClusterSingleton，reconcile-token 缺 key 即启动失败=P5 fail-closed）；
   **truthsrc bootstrap-dsl 无 strict 槽（P9 批B 缺口）**——串树应用 bootstrap 不装配协调器。
   两 app 的 application.conf 均 include "persistence.conf"（文件缺失态，include 静默忽略）。
5. **conf 转录门控**：run-all strict 段逐字转录 serialization.conf（sagaBinding 门控=金样惰性）
   ——新 persistence.conf 挂同段。
6. **④ 现状**：跨管线活通道已统一——BC anchors.json key=`saga:<sagaId>`（SagaAnchorIndex:64）
   +truthsrc graphstore/anchors 节点 knowledgeId=`saga:<id>`（P7/P8，联合查询 10 locations 全
   source-verified）。`application.services.transactor.*` 形状仅存于 meta 模型 fullQualifiedName
   （ArchitectMetadata:85）与求值器/历史 prompt 文档——**无活跨管线消费者**。
7. mongo 证据库红线：run-scoped db 留存不删；metarch-mongo 容器沿用（用户前批授权）。

## 二、子面设计

### ① 完成侧发布者（语义冻结：事件流 source 拥有 terminal 观察与结果发布）
- entry.installEventSource 流处理增第二匹配：协调器自身 journal 事件
  （persistenceId==`<NamespacePrefix>/<module>`精确过滤）中 `StrictEvent.Succeeded`/`Aborted`
  case object→ask GetStatus→state.terminal→`publishCompletion(sharding, host, state)`
  （fire-and-forget+失败打到 stderr——幂等守卫使重发安全；RecoveryRequired 不触发——
  非终态，Reconcile 续驱后的终态标记自然接手）。
- 头注释语义升级：source=trigger+completion 双面（「谁拥有结果发布」=部署接线层，即 source）。
- D2/D3 断言升级：**去掉手工 assertPublished，改断言 sagaResults ledger 由 source 自动落账**
  （状态查询 sagaResults.get(txId).contains(kind)）；D1（无 source·直驱面）保留手工
  assertPublished（证 entry API 独立可用）；B 面（testkit·无 read journal）不动。
- 边界登记：单事务生命周期内 multi-tx 排队/丢失触发事件的处理（ConflictingIdentity 吞回复）
  ——per-transaction 协调器形态独立批。

### ② D4 failover（物理两 JVM·杀协调器节点→singleton 迁移→授权 Reconcile 续驱）
- FixtureDeploymentNode 增角色 `failover`：fund→装 source→发命令→`D4-STARTED` stdout→
  循环{轮询 status；terminal→出；否则对 identity 发授权 Reconcile(token,32)——活跃期
  Denied/不匹配 ConflictingIdentity 均忽略重试（迁移前协调器活跃=Denied，迁移后恢复体
  enabled=false→接受→drive）}→terminal→**轮询 sagaResults ledger（source 自动发布）出账**
  →`D4-RESULT` stdout→exit0。
- 父测：起 seed+join(failover)→轮询 join 日志 D4-STARTED→**destroy seed**→等 join exit0+
  D4-RESULT+余额/ledger 行。失败日志留 target/deployment-face/。
- 断言语义：结果必为 Succeeded（参与者存活无拒因·Reconcile 只续驱不翻案）+守恒+ledger。

### ③ 生产 conf journal 装配（saga 门控=金样惰性）
- run-all strict 段新发射 `conf/persistence.conf`：journal=akka-contrib-mongodb-persistence-
  journal、snapshot=…-snapshot、driver=RxMongoPersistenceExtension、
  `mongouri = "mongodb://127.0.0.1:27017/<workshop>-saga"` + `mongouri = ${?SAGA_MONGO_URI}`
  （HOCON env 覆盖——本地缺省+部署显式覆盖，诚实双态）。application.conf 的 include 已在
  （此前缺文件态）→落盘即激活为**缺省链**（全部测试显式覆盖 journal 插件，不受影响）。
- BC 侧同款 conf 发射（找到 BC serialization.conf 发射点同段挂）。
- bootstrap 接线：BC ApplicationBootstrapTemplate strictWiring 增 installEventSource 行；
  **truthsrc bootstrap-dsl 增 strictEntries 槽（清 P9 批B 缺口）**+run-all 从
  sagaBinding.sagas[].engine.entrypoint 传参（缺省[]——金样树无 binding→块不发射→金样惰性）。
- 新测试（spec 增一测·两管线）：生产 conf 链装配断言——`ConfigFactory.load()` 的
  journal plugin=mongo id+mongouri 键在（解析不实例化，测试安全）。

### ④ BC 推图 saga 节点 id 统一（验证+残留登记，不加投机代码）
- 端到端联合寻址证据：BC p11 应用 anchors.json（saga:money-transfer）×truthsrc serial 树
  js 索引联合查询→跨管线 locations 全 source-verified；graphstore 通道节点
  knowledgeId=saga:money-transfer 同证。
- 残留登记（不写码）：meta 模型 fullQualifiedName=application.services.transactor.<name>
  仅存于求值器/历史文档——待真实 BC 图推送面出现时以 kind:id 别名统一（投机零消费者代码
  违反诚实最小纪律）。

## 三、验收门
1. truthsrc 串树应用：A/B/C+D1(手工发布)+D2/D3(source 自动发布断言)+D4 failover 全绿。
2. BC 应用重产：同套件同绿（两管线 parity）。
3. 金样：example/tree 剥 loan 配方重产 diff=**零**（③ 的 conf/bootstrap 全 saga 门控）+
   双跑恒等。若非零→按重定基纪律登记 diff 审查。
4. truthsrc 全量 1705+；BC 全量 789+（钉点测试按新发射契约更新）。
5. mongo 证据库留存不删；D4 日志留档。
6. ④ 联合寻址证据入 known-result。

## 四、红线自查
- 不 push/publish/publishLocal；commit 等明示。
- 生成面修复全走 generator/scaffold 源面+重产；saga-core 零改动（单事务生命周期边界不改运行时）。
- 不启停共享服务（metarch-mongo 沿用前批授权；不触 fsmams-*）；不占 9000/2551（freePort）。
- 诚实标记不动；runnable=false/contract-only 契约工件语义不因接线改动翻正（bootstrap 接线
  ≠ 运行时验证，诚实标记仍由 D 面测试背书）。
- 金样惰性优先：一切 conf/bootstrap 改动 saga 门控。

## 五、红线自查
- 不 push/publish/publishLocal；commit 等明示。
- 生成面修复全走 generator/scaffold 源面+重产；saga-core 零改动（单事务生命周期边界不改运行时）。
- 不启停共享服务（metarch-mongo 沿用前批授权；不触 fsmams-*）；不占 9000/2551（freePort）。
- 诚实标记不动；runnable=false/contract-only 契约工件语义不因接线改动翻正（bootstrap 接线
  ≠ 运行时验证，诚实标记仍由 D 面测试背书）。
- 金样惰性优先：一切 conf/bootstrap 改动 saga 门控。

## 六、实施记录（2026-10-24/25，探针驱动 6 轮）

**改动清单**：
- truthsrc（4 文件）：
  - `generators/saga-dsl/emit-strict-host.mjs`：installEventSource 完成侧——流处理改
    `Sink.foreach[EventEnvelope]` 双分支：envelope.persistenceId==`<NamespacePrefix>/<module>`
    （协调器自身 journal id 精确过滤）且 event 为 `StrictEvent.Succeeded|Aborted`（case object
    终态标记）→ask GetStatus（15s）→state.terminal→`publishCompletion`（fire-and-forget，失败
    打 stderr——幂等守卫使重发安全；RecoveryRequired 不触发）；否则按事件触发类型 match 驱动
    Start。头注释升级 trigger+completion 双面（「谁拥有结果发布」=部署接线层）。
  - `generators/saga-dsl/emit-strict-spec.mjs`：D2 断言升级（去手工 assertPublished→
    `awaitPublished` 轮询 sagaResults ledger——source 自动发布）；新 D4（父测 D4-STARTED 门后
    destroy seed→join exit0+D4-RESULT+ledger=succeeded 断言）；node main 增 `failover` 角色
    （fund→装 source→命令→D4-STARTED→收敛循环{status 轮询+非终态持续授权
    Reconcile(token,32)}→terminal→awaitLedger→D4-RESULT→exit0；手递窗 status 异常吞掉置
    null 重试）；node 系统名从 seedAddr 派生（去引号+stripPrefix，D3/D4 同参同名）；新
    「production conf chain」测试（ConfigFactory.load 断言 journal/snapshot/driver/mongouri
    四键=装配面）；node 增 awaitLedger 助手+StrictState 导入。
  - `generators/bootstrap-dsl/emit.mjs`：ApplicationBootstrap 增 `strictEntries` 槽（**清 P9
    批B 缺口**）：spawnClusterSingleton（reconcile-token 缺 key 启动失败 fail-closed，BC parity）
    +installEventSource 接线；空态渲染回归原字节（金样惰性）。
  - `generators/run-all.mjs`：appSpec 传 strictEntries（sagaBinding.sagas[].engine.entrypoint，
    缺省[]）；strict 段新发射 `conf/persistence.conf`（saga 门控=金样惰性）：journal/snapshot
    插件 id+RxMongo driver 钉+缺省 mongouri `mongodb://127.0.0.1:27017/<workshop>`+`${?MONGO_URI}`
    env 覆盖（BC scaffold 同名惯例 parity；application.conf 的 include 此前缺文件态，落盘即
    激活为生产缺省链；全部测试显式覆盖 journal 不受影响）。
- backkend-codegen（4 文件）：
  - `FixtureHostTemplate.scala`：renderEntry installEventSource 同款完成侧升级（EventEnvelope/
    duration import/头注释）；renderSafetySpec 增 awaitPublished+D2 断言升级+D4+conf 装配测试；
    renderDeploymentNode 增 failover 角色+awaitLedger+系统名派生；s""" 模板内 `"\""` 转义注意
    （三引号串禁三连引号，见调试轮 5）。
  - `scaffold/conf/persistence.conf`：driver 显式钉定 RxMongo（防双插件 jar 类路径掷币的显式
    证词；本 scaffold 已只带 rxmongo jar）。
  - `ApplicationBootstrapTemplate.scala`：strictWiring 增 installEventSource 行（P12 注释）。
- saga-core：零改动。

**调试轮次（6 轮）**：
1. 完成侧首版编译双错：Sink.foreach[Any] 无 envelope 成员→`[EventEnvelope]`；entry 缺
   `scala.concurrent.duration._`。
2. HOCON env 转义：JS `\$${'?MONGO_URI'}` 发出 `$?`（HOCON Parse 崩、11 测全红——conf 解析
   失败株连全部 withFallback 测试）→ `\${?MONGO_URI}` 正确发出 `${?MONGO_URI}`。
3. D4 系统名：node main 硬编码 "SafetyClusterD3" 而 D4 seed 地址=SafetyClusterD4→join 永远
   2 members 不可达（"Dropping Handshake… unknown local address"）→系统名从 seedAddr 派生。
4. 派生首版漏引号：arg 是 config 形状（带字面引号）→ActorSystem 名非法（IllegalArgumentException）
   →先 replace 引号再 stripPrefix。
5. BC 模板三引号终止符：`\\"""` 含 `"""`→主编译 20 错→`\"""`（发射 `"\""`，最大连引号=2）。
6. D4-STARTED 证据行 `$$opId`：JS 模板 `$$` 原样透传=Scala s-string 字面 $→日志打 `$opId`；
   JS/Scala 模板转义不对称（BC 的 Scala 模板 `$$` 恰好正确）→JS 侧改 `$opId`，重跑 D4 绿且
   证据行携带真实 op id。
7. node 系统名派生三轮：①硬编码 "SafetyClusterD3"（D4 seed=SafetyClusterD4→join 永远
   "cluster did not reach 2 members"）→②从 seedAddr 派生但 `stripPrefix("akka://")` 漏引号
   （arg 是 config 形状带字面引号→ActorSystem 名非法）→③`replace("\"", "")` 在 **Scala
   s""" 模板被转义处理吃掉反斜杠**（`\"`→`"`，发射出 `replace(""", "")` 三连引号=unclosed
   literal，BC 编译 20 错）→④引号安全派生 `dropWhile(!isLetterOrDigit)` 取到 "akka"（停在
   `://` 冒号）→⑤终版 `seedAddr.takeWhile(_ != '@').reverse.takeWhile(_.isLetterOrDigit).reverse`
   （取 @ 前最后一段字母数字；JS 侧模拟验证 SafetyClusterD4 ✓）——两管线 12/12。
8. BC journal-id 死串：BC 模板惯用法两形态——`$$${"{X}"}`（发射 `${X}` 产物源码=运行时插值 ✓）
   与 `$${"{X}"}`（发射 `${"{X}"}` 嵌套字面量=运行时产出死串 `${X}` 文本 ✗）。installEventSource
   的 coordinatorJournalId 误用后者→`"strict-saga/${SagaModule.Name}"` 永不匹配真实 pid
   `strict-saga/money-transfer`→完成分支静默不触发（触发分支不经此串所以 saga 照常完成、
   余额全对、仅 ledger 空——awaitPublished 30s 超时）。mongo 直接查 journal 实锤写侧完好
   （协调器 11 事件含终态标记全在）→定位读侧匹配串→diff 两管线发射文件现形。修正
   `$${SagaModule.Name}`（`$$`→`$`+无 $ 前缀花括号字面=发射 `${SagaModule.Name}` ✓）→
   BC 应用 12/12。

**验收结果**（终轮，全部修复后）：
- truthsrc 串树应用 **12/12**（A1-A3/B1-B3/C1+D1 共享 Mongo+D2 事件源 source 自动发布
  awaitPublished+D3 两 JVM 21.6s+D4 failover 22.6s+生产 conf 装配测试；allow-java=off 全
  strict 面）。
- BC 应用重产（P5 三输入+P10 候选 jar 1009300e…·generatorVersion=
  p12-completion-failover-conf-graphid-20261024）→ target/p12-completion-failover-20261024/
  → **12/12**（D2 3.1s/D3 13.8s/D4 12.8s）——两管线同证。
- D4 证据（truthsrc）：`D4-STARTED op=op-d4-1792883853498` →（seed destroy）→
  `D4-RESULT status=Succeeded op=op-d4-1792883853498 alice=99900 bob=100100 ledger=succeeded`。
- D4 证据（BC）：`D4-RESULT status=Succeeded op=op-d4-1792884605958 alice=99900 bob=100100
  ledger=succeeded`；D3：`op-d3-1792884592151 alice=99900 bob=100100`——节点丢失→singleton
  迁移→授权 Reconcile 续驱→收敛，ledger 由 source 自动发布。
- 金样 **零 diff**（out5 终复核；bootstrap-dsl 空态回归原字节；spec/conf 模板改动全 saga 门控
  构造性惰性）。
- truthsrc 全量 **1705/1705**；BC 全量 789/789（模板终版复跑见补记）。
- ④ 联合寻址证据（p12 索引）：`queryAnchorsIndex('saga:money-transfer', [js 索引, BC p12
  应用索引])`→**11 locations 全 source-verified**（js saga-dsl 3+BC codegen-main 8，含新
  test/fixture/FixtureDeploymentNode.scala），definitionDigest 钉 3a586c81 不变——kind:id
  双通道（anchors+graphstore）已统一；meta 图 id（application.services.transactor.*）无活
  消费者=残留登记不写码。

**边界与遗留**：
- 协调器单事务生命周期（一 persistenceId 一事务）为运行时语义——多事务生产形态（per-transaction
  协调器/分片）独立批；本批 source 的多事务行为=重复 Start 被 ConflictingIdentity 拒（幂等安全，
  新事务不丢失——由新事件重新触发）。
- meta 图 id 统一待真实 BC 图推送消费者出现。
- mongo run-scoped db 留存不删。

