# P10 设计冻结：strict-command-serialization（2026-10-24）

## 一、目标

P9 批B 序列化定案的收尾批：strict saga 跨节点命令面从 java 兜底转 strict——saga-core
Command/Reply 族 CborSerializable 化，jackson-cbor 自动接住，两管线（truthsrc run-all /
BC CodegenMain）allow-java-serialization 收 off，D1 双系统跨节点测试重验 8/8。

用户原话（P9 中途质询）：「allow-java=off 下 strict 消息序列化失败 => 没有 proto 覆盖
strict saga？那也太不 strict 了」。本批消除该兜底，不改任何公开 API。

## 二、勘探定案（事实基础）

1. **绑定面零改动即接住**：saga-core reference.conf 已绑
   `net.imadz.common.CborSerializable = jackson-cbor`（旧 saga 族 StartSaga/SagaStartReply/
   StatusSnapshot 正是 ride 这条跑跨节点）；trait 定义在 common-core 0.2（saga-core
   build.sbt:73 已依赖）；akka-serialization-jackson 2.6.20 已在主依赖（build.sbt:52）。
2. **缺口确为 strict 族独有**：javap 实锤 StrictSagaCoordinator$Start/GetStatus 只
   implements java.io.Serializable。strict 源码头注释自认「Commands/replies are
   local-only in this batch」——app 把协调器放上 ClusterSingleton 跨节点 ask 才成缺口。
3. **wire 面类型图**（StrictSagaCoordinator.scala:18-28）：
   - Command：Start(String, ByteString, ActorRef[Reply]) / Attach / GetStatus / Abort /
     Reconcile(TransactionIdentity, String, Int, ActorRef)；Drive/Returned/Deadline 为
     private local-only（Returned 含 Try[Evidence]，永不过线）。
   - Reply：Status(StrictState) / Denied(String) / ConflictingIdentity。
   - 嵌套：TransactionIdentity/OperationIdentity/CodecPin 全 case class(String+Int)；
     Phase/Evidence/StrictStatus 嵌套 sealed trait；StrictState 含
     `evidence: Map[OperationIdentity, Evidence]`。
4. **app 侧已达标**（appJ 实证）：生成协议 `<Agg>CommandFamily extends CborSerializable`、
   `sealed trait <Agg>Event extends CborSerializable`——app 命令/事件面早已 ride
   jackson-cbor，生成器零改动。
5. **爆炸半径锁定**：D1 journal=persistence testkit（eventserialization 默认 off，事件
   不序列化）；翻 off 后测试内唯一序列化活动=跨节点 remoting 消息，全部 CborSerializable
   可覆盖（akka 内部=protobuf）。
6. **已知风险（探针先行）**：`Status(StrictState)` 的 evidence Map（case class 键+嵌套
   sealed trait 值）与 Phase/StrictStatus/Evidence 嵌套 sealed trait 是 jackson 已知痛点。
   先写 roundtrip 探针 spec 实证；红则最小修复（saga-core 内 SimpleModule+mixins+
   reference.conf `jackson-modules` 追加），不改公开 API、不改 journal 纯模型。

## 三、改动面

- **saga-core**（源改动纪律由「零改动」放开为本批正身；不 commit 等明示）：
  - StrictSagaCoordinator.scala：`sealed trait Command extends CborSerializable` +
    `sealed trait Reply extends CborSerializable` + 头注释更新（local-only 声明撤回）。
  - StrictSagaModel.scala / reference.conf：头注释与 strict 段注释修正（不再宣称
    local-only；P9 发现的注释漂移一并诚实修正）。
  - 新 StrictCoordinatorSerializationSpec.scala：allow-java=off 门下全 wire 类型
    jackson-cbor roundtrip 回归（含全量 StrictState 图）。
  - （探针红则）StrictJacksonModule.scala + reference.conf jackson-modules 追加。
- **候选 jar**：bounded `Compile/packageBin`（JDK11+sbt1.4.9+隔离缓存），SHA256 记录，
  无 publishLocal/无 push。
- **truthsrc**：scaffold-static/conf/serialization.conf `allow-java-serialization` on→off；
  重产独立应用（新 jar）→FixtureSafetySpec 8/8（D1 strict 端到端）；金样字节恒等门
  （serialization.conf 仅 sagaBinding 段复制→metarch 树产物零变化）；npm test 全量。
- **BC**：scaffold/conf/serialization.conf 同款 on→off（两管线 parity）；BC 全量；
  BC 侧应用重产（P5 配方+新 jar）→8/8 两管线同证。
- **零改动**：truthsrc 树/binding（digest 双钉点 ba60f58a/3a586c81 不动）、契约诚实标记
  （runnable=false/runtimeBindingVerified=false/contract-only）、app 生成器、saga-core
  公开 API 签名、strict-saga journal 序列化面（StrictDurable→strict-saga 不动）。

## 四、验收门

1. 探针 spec 绿：allow-java=off 下全 wire 类型 roundtrip（含全量 StrictState 图）。
2. truthsrc 独立应用（零 BC）重产：Test/compile exit0 + FixtureSafetySpec **8/8**
   （D1 双系统跨节点，全消息面 strict）。
3. 金样字节恒等：metarch 树 run-all 产物前后 diff 恒等。
4. truthsrc 全量 1705/1705（或+N 探针相关的 truthsrc 侧测试）。
5. saga-core 全量测试（源改动无回归）。
6. BC 全量 + BC 侧应用重产 FixtureSafetySpec 8/8（两管线同证）。
7. 登记：本轮 design/known-result + EP + 协调板 + 锚点；无 commit 等明示。

## 五、红线自查

不 push/tag/publish/publishLocal（commit 仅用户明示）；不写共享 ingested-app/metarch-app；
不启停共享服务；scratch 全 realpath 隔离；缓存不入库；诚实标记不动；`--direct --dry-run`
禁止组合；saga-core 新 jar 只 packageBin 落 rounds 证据目录。
echo "appended"
__zcode_status=$?
if [ "$__zcode_status" -eq 0 ]; then pwd -P > '/var/folders/09/lh3_46994bl20qlyt9kwv9sh0000gn/T/zcode-24e35cfb-6d7b-4e5e-bebc-758cced8b156-cwd'; fi
exit "$__zcode_status"
## 六、实施记录（2026-10-24，探针驱动 5 轮）

**改动清单**：
- saga-core（5 改+2 新）：StrictSagaCoordinator.scala（Command/Reply extends
  net.imadz.common.CborSerializable——trait 在 common-core 0.2，绑定面 reference.conf 既有
  `CborSerializable = jackson-cbor`；头注释 local-only 声明撤回）+ StrictSagaModel.scala
  （头注释同步）+ reference.conf（strict 段注释诚实修正+jackson-modules 挂载）+ build.sbt
  （akka-serialization-jackson % Test——此前只在 dependencyOverrides 不引入工件）+
  StrictSagaSpec（唯一翻转断言：GetStatus 不可序列化→可序列化正断言）+ 新
  StrictJacksonModule.scala（~190 行：ByteString base64/Phase·StrictStatus 名字查表/
  Evidence kind 标签多态/OperationIdentity 对象+Map 键逐字段 base64×12 '|' 连接，全
  fail-closed）+ 新 StrictCoordinatorSerializationSpec.scala（3 测：全命令/回复族 roundtrip
  +全量 StrictState 图无损+活 ActorRef 送达）。
- truthsrc：generators/scaffold-static/conf/serialization.conf `allow-java-serialization`
  on→off。BC：scaffold/conf/serialization.conf 同款（diff 逐字 parity 保持）。

**调试轮次（5 轮）**：
1. 探针首跑：`Serialization(system)` API 误用+akka-serialization-jackson 不在 saga-core
   类路径（build.sbt 只在 dependencyOverrides）→ SerializationExtension+Test 依赖。
2. 二跑：Serializer.manifest 静态类型（SerializerWithStringManifest 才有）→ 模式匹配；
   JacksonCborSerializer 引用改 getClass.getSimpleName 字符串断言。
3. 三跑：**探针命中预期双墙**——`ByteString` 无 Creators（akka 2.6.20 默认 jackson-modules
   不含 ByteString 支持）+`Cannot find a (Map) Key deserializer`（case class 键）。
4. StrictJacksonModule 首版：漏 ByteString import+JsonDeserializer import+SerializerProvider
   签名误用 → 修正。
5. jackson-modules 配置根实测为 `akka.serialization.jackson`（非 akka.actor.serialization.
   jackson——2.6.20 reference.conf 实锤）→ 移位后 **探针 3/3 全绿**。

**验收结果**：
- saga-core：探针 3/3+全量 **118/118**（11 suites）。
- 候选 jar：`saga-core_2.13-0.2+1-cf26cd7a+20261024-2108-SNAPSHOT.jar`
  sha256:1009300e2253b0aa70e9a1da91a850ecad2ee1c70dd4c280518dfaccc5ad66d8（packageBin·
  无 publish；jar-sha256.txt 记录）。
- 金样字节恒等 ✓：P9 基线（/tmp/p9b-9355/golden-final）复现配方=example/tree 剥离
  {aggregates/loan, read-models/loan-overview-decision-view.rm.yaml,
  policies/policy-cs-close-loan-on-full-repayment-8.policy.yaml,
  policies/policy-cs-auto-disburse-on-approval-7.policy.yaml, value-objects/money.vo.yaml}
  → run-all 产物 diff 恒等——conf 翻转证明金样惰性（serialization.conf 仅 sagaBinding 段复制）。
- truthsrc 独立应用（零 BC）：serial 树 run-all（新 jar→lib/）→ conf off 落盘 →
  **FixtureSafetySpec 8/8**（D1 cross-system topology 3.16s，allow-java=off 全 strict 面）。
- truthsrc 全量 **1705/1705**。
- BC 全量 **789/789**（74 suites；conf 翻转对 BC 面惰性）。
- BC 侧应用重产（P5 冻结三输入+新 jar，generatorVersion=p10-strict-command-serialization-
  20261024）→ **FixtureSafetySpec 8/8**（allow-java=off）——两管线同证。

**过程事实（登记备查）**：
- BC strict 目标路径门：/tmp 符号链接被拒（symlink in strict target path）；仓内路径被拒
  （overlaps protected repository/generator repository）——正确落位=工作区根
  `target/p10-strict-command-serialization-20261024/app`（非仓非链接）。
- 候选 jar 开关双读：生成期 `-Dcodegen.candidate.sagaCore` 决定发射，应用构建期同 prop
  决定 unmanagedJars 替换（漏带则回落 Ivy saga-core 0.2 无 strict 类→289 编译错）。
- serial run-all 17/18 generators ok=设计内（api-dsl skip：saga face 无 HTTP controller）；
  双跑 diff 恒等（REGEN-DETERMINISTIC）。
- BC 应用产物位置（工作区根 target/，不入库）：truthsrc 应用在 /tmp/p10-serial-app。

**边界与遗留**：legacy saga 的 OperationSucceeded/ManualFixCompleted business-result 类型
仍依赖 allow-java=on（reference.conf 已登记的技术债，非 strict 面，本批不动）；D1 journal
仍是 persistence testkit（物理多 JVM+共享耐久 journal 留部署面）；app 事件面 journal 序列化
（生产 journal 下）是独立债，本批未触。
