# P9 设计冻结：metarch-truthsrc 独立文件版代码生成器达标（2026-10-24）

> 用户目标纠偏（2026-10-24）：「metarch-truthsrc 是文件版代码生成器，是不需要 BC 可以独立存在的」。
> 两批制：**批A「拿到就能编译」（已完成）** + **批B「拿到就能跑」（设计冻结，待实施）**。

## 一、距离审计结论（开工前实测，scratch /tmp/p8-audit-*）

- run-all v3 对 serial 树：17/18 生成器 ok、39 文件完整 sbt 骨架+聚合 CQRS 面——底座已存在。
- 三段缺口：①proto-dsl 不支持 Map 类型 state 字段（P5 深化 6 个 Map 字段产非法类型名）+
  连字符事件名非法 proto 标识符 → 编译红；②saga 面零接线（run-all 不调 saga-dsl；strict-scala
  封禁）；③saga-core strict jar 未发布+验证回路缺失。
- **封禁理由已被事实证伪**：SAGA_RUNTIME_BINDING_UNVERIFIED 说「无已验证运行时 API shape」，
  而 P4/P5/P8 的 BC 生成物对真 strict runtime 三轮 8/8（含 C1 恢复/D1 跨节点）——shape 知识
  完整存在于 BC 模板，缺的只是移植。

## 二、批A 交付（已完成，2026-10-24）

八处修复（全部金样惰性——metarch 金样树前后字节 diff 恒等实证）：

| 面 | 修复 |
|---|---|
| proto-dsl/emit.mjs | Map[K,V]/Map<K,V>→`map<key,val>`（键标量折叠 string）；contractIds（kind=id→string）；连字符事件名→下划线（消息名+oneof 字段名，BC 同款）；optional 不前缀 map 字段 |
| run-all.mjs | `--saga-binding`（默认 `<tree>/../bindings.json`）装载 TypeContracts：kind id→contractIds、kind money→合成 VO{minorUnits,currency}；serial 规范化（事件名下划线×events+commands[].produces join 面、id 类型折叠 String、Map 键折叠）；valueobject/converter 目录∪money VO；PHASE1_EXTRA_VIEWS/SERVICE_PORTS 按 sagaBinding 门控；scaffold-static/app 递归复制（sagaBinding 时）；monarch-dsl 过滤 staged |
| aggregate-dsl/emit.mjs | emptyDefault Map→`Map.empty`；renderFold 结构化三算子（put `state.m+(k->v)`/remove `state.m-k`/money-apply MoneyOps.shift 桶合并，`literal:` 值→JSON 字符串）；voImports 追加 money 元素 VO+MoneyOps import（Map 值侧手拆） |
| api-dsl/emit.mjs | 零参查询命令调用 `Cmd(replyTo)`（去空逗号） |
| invariant-dsl/emit.mjs | checkAggregate 无 status/时间戳标记字段时不发 S2-8 门卫（链首 if/收尾 None 适配）；`有 Params 才有 Rule` 过滤（GetBalance 类零参查询命令不悬空） |
| adapter-dsl/emit.mjs | ScalaPB oneof 访问器驼峰化（`result_compensated`→`ResultCompensated`；PascalCase 金样名不变） |
| converter-dsl/emit.mjs | Map 字段→`toProtoMap/fromProtoMap(p.f, StringConv, VConv)`（trait 已继承 PrimitiveConverter） |
| bootstrap-dsl/emit.mjs | `idIsString`：字符串 id 聚合 empty 直传 entityId（不 Id.of） |
| scaffold-static/app/**（新 4 文件） | CommandDsl.scala（ingested-app 逐字转录）、CommandRoleMap.scala（standalone 空 maps 变体=scope 兜底语义）、MoneyOps.scala/PrimitiveConverter.scala（BC scaffold 逐字转录）——sagaBinding 门控复制 |

**验证**：金样（metarch 树）run-all 产物前后 **diff 字节恒等**（golden-before/after ×11 轮回归）；
serial 树 run-all 产物（~40 文件）**sbt compile exit0（30s，11 轮迭代）**；truthsrc 全量
**1705/1705**。隔离缓存 .rounds/p8-anchors-20261024/{app-boot,app-sbt-global,app-ivy}。

## 三、批B 移植冻结（strict-scala 发射器，待实施）

### 3.1 移植源（BC 三层，全部通读定案）
- `StrictSagaModuleTemplate.scala`（268 行）——SagaModule 本体模板（TypeContract/PhaseContract
  形状串、phasePort require 链、trigger/completion 绑定、Host trait、definition/behavior 收尾）。
- `StrictSagaModuleBuilder.scala`（61 行）——v3 契约→模型：addresses(payload.participants×
  binding.participants)、steps(schedule.prepare 序×SagaPhase.all)、reads(StepReceipt 输入→
  producer pin)、triggers/completions、argsFields。
- `FixtureHostBuilder.scala`（320 行）——证据推导：shapeOf（id/text→String、money→args 字段
  FQN）；聚合 face（protocol/entityKey/reply/**read-only 查询命令**/behaviors/EventHandler）；
  **prepare evidence=writtenBy 命中 `确认事件.txid槽` 的 state 字段**；**commit/compensate=
  marker 字段三重 fail-closed（名 committed/compensated+血缘+键型与同 step prepare 证据 Map
  结构等值）**；completions 发布命令=produces 反查唯一 producer；fundingSeed=第二参与者
  prepare+commit 确认对；能力面 SupportedCapabilities 十项校验。
- `FixtureHostTemplate.scala`（925 行）——六渲染器（types/ExactMoneyCodec/ArgsCodec/
  FixtureHost/StrictSagaEntry/FixtureSafetySpec）。
- `FixtureHostModel.scala`（109 行）——IR 字段语义注释（每个成员的推导来源）。

### 3.2 关键推导规则（已钉）
- **命名**（NamingConventions）：strictSymbol=连字符→下划线（拒绝关键字）；strictPhaseStem=
  firstUpper(step)+firstUpper(phase)；nested=stem+role（"Input"/"Receipt"/"CompletionInput"）；
  member=firstLower(stem)+role（"Binding"/"Resource"/"Trigger"/"Completion"）；getBaseName=后缀
  剥离链（Aggregate→Controller→Entity→…回退非空）。
- **v3 契约→执行面**（SagaIrAdapter.saga 解码规则）：participants=definition.payload.steps
  （serial 按 group 排序）×binding.participants(addressing)×binding.steps(技术面 port/mapper/
  confirmation/query/receipt/idempotency)；schedule={prepare/commit:顺序, compensate:逆序}；
  args={codec:binding.codec, slots:payload.args, types:binding.types}；triggers=payload.triggers×
  binding.triggerMappers(triggerId)；completions=payload.completions{kind,eventRef,bindings}×
  binding.completionMappers(kind)；hostRequirements=engine.requiredCapabilities+resilience+
  admission/safety/invariants。
- **lowerInputs**（ref→source）：`txid`→transaction-id；`step:<step>:<phase>:<slot>`→
  receipt-field(step,phase,slot)；`args:X`→args(X)。trigger argsMapping 用 `source:X`（same-name）。
- **类型表**：kind id/text={minLength,maxLength}→BoundedText；money={scale,precision,codec,
  currency:ISO-4217, encoding:minor-unit-string}→MoneyShape；Wire 序守卫=文本槽在前货币槽
  在尾（codec 解析序）。
- **truthsrc 侧原料**：truthsrc 自己的 lowerSagaRuntimeBindingV3 产同一 contract-v3 JSON
  （P5 钉证）→ JS 发射器直接消费契约 JSON（跳过 BC Model 中间层，Builder 规则内联）。
  聚合侧证据（writtenBy/produces/read-only 命令）从 canonical aggregates 取（批A 规范化后）。

### 3.3 实施结构（规划）
- `generators/saga-dsl/emit-strict.mjs`（新）：v3 契约+canonical → 7 文件（SagaModule/types/
  ExactMoneyCodec/ArgsCodec/FixtureHost/StrictSagaEntry + test/FixtureSafetySpec）。
- saga-dsl/generate.mjs：strict-scala 分支解封（去 runtimeBlocked；诚实标记红线：**契约工件
  strict-contract 三 JSON 的 contract-only/runnable=false 不动**——strict-scala 是新发射模式，
  flags 翻转语义另立批定案，不因测试绿改写）。
- run-all：sagaBinding 时接 saga-dsl strict-scala → app/fixture/ + test/fixture/；`--saga-core-jar
  <path>` 复制到 `<out>/lib/`（sbt 默认 unmanaged classpath，build.sbt 零改动；akka/scalapb/
  play-json 已在 scaffold-static/build.sbt，BC 对账 delta=仅 saga-core）。
- 验证：独立产物 sbt compile + `testOnly fixture.FixtureSafetySpec` 对齐 BC 8/8（守恒/幂等/
  补偿/恢复/跨节点 D1 双节点集群）；金样字节恒等回归；truthsrc 全量。

## 四、红线（延续）
金样字节恒等为每轮硬门；诚实标记不因验证绿改写（契约工件 contract-only/runnable=false 永久）；
digest 双钉点不动；缓存不入库；不 push/commit 等明示；scratch 隔离；ps 只 pid/comm。

## 五、边界
- Play HTTP 服务面 strict 装配（ApplicationBootstrap reconcile-token）不在批B——FixtureSafetySpec
  以 persistence-testkit 自足（BC 同款），部署面另立批。
- legacy saga 面（SagaSpec 0.2）不迁移——金样复制纪律。
- runnable/runtimeBindingVerified 翻转语义：批B 交付后单独定案批。
