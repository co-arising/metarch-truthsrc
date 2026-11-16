# bank-wealth-demo 生成代码机械味道清单（按 artifactType）

扫描范围：`bank-wealth-demo/generated/current/`（235 个文件，约 205 个已映射到 artifactType）。
artifactType 权威定义：`metarch-truthsrc/docs/artifacts/catalog.json`（125 个 category，本工程实际覆盖约 45 个）。
文件映射方式：catalog variants.outputs 路径模式 + 文件名后缀启发式。

> 注：catalog 中的 monarch-\* 与 saga-\* 类型在本工程没有独立产物文件——它们的实际载体是
> `application/bank_*_host*.scala` / `*_v1Execution.scala`（effect-host / workflow-program）、
> `conf/serialization.conf` 绑定块与 build.sbt 依赖。

---

## 1. value-object（118 文件，domain/values/）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 1.1 | **领域字段混用 wire 类型**（类型边界泄漏） | VO 引用上游请求时直接持有 `MoneyWire` 等 wire 类型，金额精度校验在领域内失效（BankSipCreate.scala） | 领域 VO 一律用 `Money`；wire 类型只留 serialization 边界 |
| 1.2 | **Receipt/Query payload 字段机械展开** | 15 个 Receipt 含 `payloadTxid/payloadResource/payloadAmount/payloadCurrency/payloadAvailable` 纯复制字段；12 个 Payment/Refund Receipt 结构几乎相同 | 生成 `payload: BankPaymentArgs` 复用字段组；Receipt 骨架（transaction/definitionVersion/argsDigest/participant/step/phase）抽共享 `SagaEnvelope`，12 行→3 行 |
| 1.3 | Input/Query/Receipt 同构三件套仍逐对生成编码函数 | 同一 saga 步骤的 PrepareInput/CommitInput/CompensateInput 结构相同，各自生成 4 个转换函数 | 同构类型 type alias 复用一套 encode/decode |
| 1.4 | **金额校验逻辑三份重复** | `checkedAmount` 在 Money.scala 与 AmountDecimal.scala 逐字符相同；plus/minus 内再各校验一次（3 层）；converters `fixed/readExact` 第三套 | 提取公共 `ExactAmount` helper，生成器只引用 |
| 1.5 | **Wire/PO 双轨类型 + 三层中转** | Money/AmountDecimal 各产生 4 个类型 + 8 个转换函数；`XToWire` 与 `XToPO` 逐字相同 | Wire==PO 时合并；检测"中转后字段相同"合成单条转换路径 |
| 1.6 | 超长单行 case class + 同包全限定名 | 字段 ≥7 个的 Receipt/View 单行 2900+ 字符（BankSipPlanView 等） | 同包引用去全限定名；>5 字段逐行输出 |
| 1.7 | ID 包装类校验不一致 | PlanId/TxId 等零校验，Money 有校验，readExact 对 ID 不做 bound 检查 | 统一策略：要么统一生成非空/长度 require，要么明确声明信任上游 |
| — | 不存在的味道 | Play JSON 样板、手写 equals/hashCode、companion 模板均无 | 无需处理 |

## 2. domain-state（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 2.1 | **全限定名内联 → 巨型单行 case class**（横向最普遍味道） | 所有字段全限定 + 单行，FundOrderState 30 字段单行 ~2900 字符 | `import ...values._` + 每字段一行 |
| 2.2 | State 是转发空壳 | `XxxState.empty` 委托 `XxxEntity.empty`，默认值定义割裂两处 | empty 直生成在 State（唯一权威点），Entity 做别名 |

## 3. invariant-rule（9 文件：invariant/*Rules + domain/*Rules + invariant/params/*RuleParams）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 3.1 | **三层纯转发链**：domain Rules → invariant Rules → Params 包装 | 每命令 4 段样板；FundOrder 22 命令 → 22 转发方法 + 22 Params case class；实现头部固定 3 行 `val state/p/hosts = input.x` 解构 | 整体删除 domain Rules 与 Params 两层（约 700 行），invariant 实现直接收 `(state, p, hosts)` |
| 3.2 | **`if(!(!(...)))` 双重否定守卫** | 每条不变式机械取反，复杂条件 8 层括号单行（invariant/FundOrderRules.scala:13,249,28-33） | 生成 `guard(cond, code)` / either 组合子；`replayable(map, txid, amount, code)` helper 替代逐 map 内联 |
| 3.3 | 同族命令前置校验块复制粘贴 | TA Accepted/Confirmed/Rejected/Unknown 族、Refund 族共享 5-7 行相同守卫，出现 4 次/文件 | 识别命令族，公共守卫提升为 `validateTaContext(state, p)` |
| 3.4 | Params 字段名不一致（command vs p） | Params 定义 `command`，实现解构成 `p` | 统一命名（若 3.1 删除则自动消失） |
| 3.5 | Long 字面量渲染成 `java.lang.Long.parseLong("9223372036854775807")` | 10+ 处 | 直出 `9223372036854775807L` / `Long.MaxValue` |

## 4. domain-protocol（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 4.1 | **outcome 五连事件展开** | 每个 outcome 类命令生成 Succeeded/RejectedBeforeEffects/Compensated/RecoveryRequired/OutcomeUnknown 5 个同构 case class，FundOrder 20 个；且每个事件带 `kind: String` 逃生阀 | 生成 `sealed trait Outcome` + 单个携带枚举的事件，5 分支可折叠；kind 用 sealed enum |
| 4.2 | Event 字段逐字复制 Command 字段列表 | TA 事件 4 个 × 9 字段重复 | 生成共享 `TaReceiptContext` 值对象内嵌 |

## 5. command-helper（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 5.1 | `emitXxx(state, p, hosts)` 一行一函数，参数几乎从未用 | 18+22+7 个同构单行；多数只用 `p`；与 Rules 尾行一一对应 | invariant rule 内联事件构造，删除整个 CommandHelpers 层（~250 行）；或去掉未用参数 |
| 5.2 | outcome 字符串字面量内联重复 | "succeeded" 等 5 个串在 Rules/Protocol/EventHandler/emit 四处必须严格一致 | 生成 `Outcomes` 常量对象或 sealed enum，四处共用 |
| 5.3 | 空 `object XxxComputations {}` 占位 | CreditBalanceCommandHelpers.scala:166 | 无实现时省略 |

## 6. event-handler（6 文件：domain/ 根 3 个壳 + entities/behaviors/ 3 个实现）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 6.1 | 根级 EventHandler 是 3 行纯转发壳（3 文件逐字同构） | 两包两名单一逻辑 | 删除转发层，只留一份 |
| 6.2 | `val nextN: Type = ...` 编号临时变量 + 全限定类型标注 | FundOrder 33 分支 ~100 个 next 变量 | 内联进 copy 实参，删显式类型标注，可减 ~60% 行 |
| 6.3 | 同族 outcome 分支逐字相同 | 5-outcome 家族除字符串外相同，事件已带 outcome 字段分支再内联常量 | 与 4.1 联动改 sealed enum，单分支；FundOrderEventHandler 148→~80 行 |
| 6.4 | `java.lang.Math.addExact(state.x, java.lang.Long.parseLong("1"))` 计数器样板 | SipPlanEventHandler 7 处 | `state.x + 1` |

## 7. aggregate-root / aggregate-factory（domain/ 3+3 与 application/ 3+3）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 7.1 | Request/Reply 骨架三份逐字相同 + Factory 恒等转发 | Execute/GetState/Accepted/Refused 6 件套每聚合重复 | 参数化公共基座 `AggregateRequest[S,C,E]`；Factory 删除 |
| 7.2 | `Ingestbank_payment_result_compensated` 机械展开：蛇形命名混入 case class 名 | 每外部事件一个 Request case，11 个同构（FundOrderAggregate.scala:35-45） | 统一 `Ingest(event: ExternalEvent, ...)` + sealed ExternalEvent；至少转驼峰 |
| 7.3 | Aggregate/Factory/Protocol 都是转发壳 | application 层 3 文件/聚合近乎空 | 合并为单一 `{Agg}Application.scala` |

## 8. domain-entity（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 8.1 | Events 别名区：每事件 4 行 type+val 双别名 | FundOrder 33 事件 = 132 行，占文件 94% | `val Events = FundOrderProtocol` 一行替代；3 文件 ~250 行→~15 行 |
| 8.2 | `empty` 30 个位置参数无一命名 | 字段顺序耦合，插入字段静默错位 | 命名实参逐字段一行 |

## 9. external-event-bridge（1 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 9.1 | 每外部事件 `convert` + `_identity` 成对函数，11 对同构；蛇形函数名 | FundOrderExternalEvents.scala:196-205 | 与 4.1/7.2 联动收敛为 3 对；驼峰命名 |

## 10. aggregate-behavior（application/aggregates/behaviors/，3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 10.1 | externalBehavior 逐事件 4 行模板重复 11 次；标识符出现 4 次/事件；persist 与 Accepted 各构建事件一遍 | FundOrderBehaviors.scala | 数据驱动表 + 通用 handler；~70 行→~15 行 |
| 10.2 | executionBehavior 命令→Rules 一行分发表 | 21+18+7 个 case，签名统一 | 输出 `Vector[(Extractor, Rule)]` 表 + 单 fold |
| 10.3 | decision match 尾部样板 + orElse 链 3 文件逐字相同 | 3/3 聚合 | 提为共享 helper `Effect.fromDecision(reply)(decision)` |

## 11. aggregate-repository-port / aggregate-repository-implementation（6 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 11.1 | **Repository 整文件克隆**（3/3 diff 全为标识符替换） | 每聚合一份 100% 相同实现 | 生成泛型 `AggregateRepository[K,C]`，生成文件只留 type alias |

## 12. application-protocol（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 12.1 | type+val 双别名逐条展开（与 8.1 同根） | FundOrderProtocol.scala 5.5KB 几乎全是别名 | `import domain.XAggregate._` 一行；文件缩为 ~10 行 |

## 13. workflow-program（\*_v1Execution.scala，4 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 13.1 | Promise 桥接 actor 模板逐 stage 克隆（~20 行/stage，两文件逐字同构） | 每个外部调用 stage | 通用 `InvocationBridge[HostReq, Reply]`，每 stage 1 行绑定 |
| 13.2 | Result→StageError 4 分支映射模板 | 每 stage result sealed trait | 按 kind 语义标签查表；`trait StageResult { def semantics: String }` |
| 13.3 | StateCodec 逐字段 input0..N `getOrElse(throw ...)` 600+ 字符超长行 | decode 逐字段 | 字段表 `Vector[(name, enc, dec)]` 派生 codec |
| 13.4 | 空 `trait PureStages {}` | 所有实例均空 | 不生成（连带省 install 参数） |

## 14. effect-host / saga-invocation-host（4 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 14.1 | **EffectHost 双文件近乎逐字克隆**（diff 后仅类型/常量名差异，各 ~13KB） | bank_sip_dispatch vs bank_ta_effect；bank_payment_host vs bank_refund_host 同样 | 【最高优先级】泛型 EffectHost 运行器 + 每 effect 配置对象；~13KB→<1KB |
| 14.2 | operationIdentity 手写 SHA-256 分段拼接样板；两 Host 细节不一致（sha256: 前缀漂移） | 每 host | 框架 `identityDigest(Vector[String])`，生成器只输出向量字面量 |
| 14.3 | admission/observe/deliver 状态机整套逐字同构 | Host 文件 | 抽 Host 运行时骨架，生成物只留 4 个差异点 |

## 15. host-io（2 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 15.1 | deliver 的 5 分支同构；expected 构造在每分支重复 | kind→port 映射 | kind 表 + 通用 `deliverKind`；expected 提出 match 外 |

## 16. protobuf-serializer（\*HostSerializer/\*EffectHostSerializer 4 + DomainProtoSerializer\* 4）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 16.1 | host/effect serializer 双双互为克隆 | kind 字符串 ↔ case 类双向 match | 泛型 `HostEventSerializer(eventCodec, pbType)` |
| 16.2 | **三重列表**：manifest match + fromBinary match + conf 绑定（250+ 绑定）同一清单渲染 3 次 | DomainProtoSerializerPartN × conf/serialization.conf | scalapb `GeneratedMessageCompanion` 类型类驱动；conf 按包通配绑定 `scalapb.GeneratedMessage`；**可删 ~800 行** |

## 17. proto-converter（DomainConverters\*.scala，6 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 17.1 | **`Some(encodeX)` / `getOrElse(throw new IllegalArgumentException("required typed value missing"))` 成对爆炸：189 对（~378 处）** | 每非 proto 标量字段 | 一次定义 `def req[T](o: Option[T]): T` helper；或 PB required 语义直连 |
| 17.2 | 位置索引字段名 f0..fN | PB 字段名与 domain 不一致 | scalapb 保留原始字段名 |
| 17.3 | X/XWire/XPO × PB 笛卡尔转换族 | 每 VO 6 函数，ToWire/ToPO 逐字相同 | 泛型 `ExactView[T](encode, decode)` |
| 17.4 | Part 切片机制 + `fixed/readExact` 在 6 个文件头部重复粘贴 | 单 object 超 100 行即切 PartN | helper 独立 trait 生成一次；按聚合语义分文件取代 PartN |

## 18. event-adapter（3 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 18.1 | 每事件 3 处 match + manifest 登记（FundOrder 32 事件 × 3=96 case）；3 文件 100% 结构克隆 | manifest/toJournal/fromJournal 三段平行 | 事件清单数据驱动 `Seq(Entry(...))` + map 循环；与 16.2 共享注册表 |
| 18.2 | 兜底异常文案逐字重复 | 3 文件 | 共享 trait |

## 19. projection 族（4 文件，非克隆，质量较高）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 19.1 | 三聚合 fold 分支克隆；account 分支有 7 个逐事件 identity-require 而 order 分支无（**规则不一致，疑似 bug**） | BankJournalReadsideDomain.scala:34-53 vs 64-66 | 按"事件是否有 resource 字段"判定；泛型 fold 参数化 |
| 19.2 | 方法尾随 `()` 凑 Unit | Repository 方法 | 表达式体 |
| 19.3 | **命名拼接 bug**：`queryOccurrenceby_plan` / `queryPendinglisting` | BankJournalReadsideRepository.scala:184,202 | 生成器命名规范化——优先修 |

## 20. aggregate-bootstrap（4 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 20.1 | 3 个 {Agg}Bootstrap 纯改名克隆（28 行 × 3） | EventSourcedBehavior 装配 | 泛型 `eventSourced[C,E,S](...)` helper，每聚合 3 行 |
| 20.2 | 复制粘贴式 require 守卫 | `require(x != null && x.nonEmpty && ...)` | `requireNotNull/requireNonEmpty` helper |

## 21. service-runtime / service-contract（3 文件，非克隆）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 21.1 | `requireInstalled` 每端点 1 行 200+ 字符 6 条件与链，14 个端点；版本串重复 14 次 | BankServiceService.scala:82 | 抽 `checkEndpoint(name, ep)`；版本提常量 |
| 21.2 | apiActions/pageActions 双份路由表 + 下标位置耦合 | BankServiceLoader.scala:73，`apiActions(0)..(13)` | `.map(_.copy(...))` 推导；按 name 引用 |
| 21.3 | Route 15 字段位置参数 + 布尔魔法 | BankServiceLoader.scala:57 | 命名参数/builder |

## 22. generated-test（6 文件）

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 22.1 | 每测试文件复制 `UnitConfigurationCheck.main(Array.empty)` 哨兵；GeneratedFiniteHostSpec 空壳无 test | 5/6 文件 | 哨兵移 build.sbt；删空壳 |
| 22.2 | 聚合测试三连克隆（spawn→GetState→expectMessage） | GeneratedActorStateSpec 等 | 参数化 `actorStateRoundtrip[A](factory, stubHosts)` |

## 23. conf / build

| # | 味道 | 触发条件 | 优化建议 |
|---|------|----------|----------|
| 23.1 | **serialization.conf ~250 个逐类绑定**（与 16.2 三重列表同根） | 每 PB 类一行 | 绑定 `scalapb.GeneratedMessage` 按包通配，~295 行→~30 行 |
| 23.2 | 生成段与手写段无分隔标记、文件无 @generated 头（serialization.conf 尾部 strict-saga/host 绑定） | 再生成 diff 噪音 | 拆 `serialization.generated.conf` / `serialization.host.conf` |
| 23.3 | build.sbt 同一 key 重复声明 + 本机绝对路径 `file:///Users/zhongdj/...` | 不可移植 | 合并赋值；路径参数化 |

---

## 跨 artifactType 横向杠杆（生成器改动收益排序）

1. **单一 PB 注册表**（16.2 + 18.1 + 23.1）：一个类型清单驱动 serializer match、adapter match、conf 绑定，删 ~800 行，消除三处同步漂移风险。
2. **required-field helper**（17.1 + 13.3）：删 378 处 `Some(...)/getOrElse(throw ...)`。
3. **删除恒等转发层**（3.1 + 6.1 + 8.1 + 12.1 + 7.1/7.3 + 2.2 + 11.1 + 20.1）：Rules→Params、EventHandler 壳、Entity 别名区、Protocol 别名、Factory、Repository/Bootstrap 克隆——合计可删 ~2000 行。
4. **outcome sealed enum 化**（4.1 + 5.2 + 6.3 + 7.2 + 9.1 五处联动）：单一最大语义优化，~400 行 + 类型安全。
5. **EffectHost/Definition 运行时骨架化**（14.1/14.3 + Definition phase 四件套）：每 host ~12KB→~1KB。
6. **全限定名内联 + 单行渲染**（2.1 + 1.6 + 6.2 等横向）：`import ...values._` + 逐字段换行，涉及全部文件。
7. **命名规范化 bug**（19.3、7.2、9.1）：`queryOccurrenceby_plan`、`Ingestbank_payment_result_compensated`——生成器命名规则应优先修复。
8. **规则不一致疑点**（19.1 order 分支缺 identity-require；14.2 sha256 前缀漂移）——生成器行为漂移的信号。
