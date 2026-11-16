# 生成代码布局与 OO + Plain FP 标准

状态：用户已确认的质量约束 + 本阶段的具体执行标准。**不是当前生成代码已经达标的声明。** 适用于 A、B 及整改过的 JS 生成器。每个制品仍须遵循自己的内容级 diff；不得用泛化的“去重”覆盖具体协议合同。

## 1. 两层质量，分别验收

| 对象 | 必须达到的结果 | 不算通过 |
|---|---|---|
| JS 生成器 | Model/Builder/Template 职责与对应传统 Scala 制品一致；输入与输出依赖显式；每个构造及其 RHS 可追踪 | 仅新建三个同名目录，内部仍是拼源码的大函数 |
| 生成的 Scala | 人能理解、局部修改、独立验证；目录、命名、依赖、协议、业务与副作用顺序正确 | 只编译绿、测试数量多、字节数减少或 CC 平均值降低 |

原始 Scala 模板、人工打磨参考与最终目标分开保存：原始实现不完美的部分必须在 diff 中显式解释，不宣称传统仓库“完全纯函数/完全无代码字符串”。

## 2. 唯一布局规则

权威来源：固定的 [PackageLayout.scala](baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala)、[NamingConventions.scala](baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala) 与 [CQRSApplicationGenerator.scala](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala) 的写入规则。

用户覆盖规则：**业务根包下面只能存在 `domain`、`application`、`infrastructure` 三个架构层**。

```text
<base>/
├── domain/
│   ├── values/
│   ├── entities/
│   │   └── behaviors/            # 纯事件应用
│   ├── invariant/               # 规则；params 依制品合同
│   ├── services/                # 纯领域计算
│   ├── policy/
│   └── events/                  # 仅实际模型需要的独立事件
├── application/
│   ├── aggregates/              # Actor-facing Protocol、Aggregate
│   │   ├── behaviors/           # 行为组、CommandHelpers
│   │   ├── factories/
│   │   └── repository/          # repository interface
│   ├── services/
│   │   └── transactor/
│   │       └── behaviors/
│   ├── projection/
│   │   ├── handlers/
│   │   └── repository/
│   ├── queries/
│   └── connectors/
└── infrastructure/
    ├── bootstrap/
    ├── persistence/
    │   ├── converters/
    │   └── strategies/
    ├── repositories/
    │   ├── aggregate/
    │   ├── projection/
    │   └── saga/
    ├── connectors/
    └── proto/
```

- 禁止 `<base>.service`、`.integration`、`.web` 等平行层；不要把一个混合职责类整体挪入 application 就称分层正确。
- `CommandHelpers` 在 `application.aggregates.behaviors`；它是 command→param、error/state→reply 胶水，不是 domain 中的事件构造函数集合。
- `AggregateProtocol` 在 `application.aggregates`，Commands/Replies/Handler alias 分段；domain Entity 负责领域 State/Events。纯领域参数不可为满足 `replyTo` 要求而引入 ActorRef。
- Repository interface 和技术实现分别放在 application 与 infrastructure；Factory 按 BC 的 factories 子包；不留错误 domain 包的永久转发壳假装完成迁移。
- Scala 原始 `$base.modules` 与用户三层规则不一致：目标中的 DI/装配归 `infrastructure.bootstrap`，逐个 diff 记为显式覆盖，不修改原始基准。
- BC 的顶层 `controllers` 在业务根包之外，按实际模板保留。不得再创建 `<base>.api` 作为第四层。视图/路由/Play 配置在框架分区；若确需新的基础设施子包，先在对应 diff 定义。
- 单工程 `app/<package>/` 与多模块 `modules/<module>/src/main/scala/<package>/` 是物理构建根，不等于架构层。选择必须显式，同输入比较不得将两种布局混为一体。
- `.proto`、`conf/routes`、`build.sbt`、配置、测试的根也遵循所选 BC profile；生成测试不能散落无 package 的默认包来绕过布局。
- 只登记实际需要的目录，不预先创建空目录树。各制品表必须给出完整目标文件路径，不仅写所属层。

## 3. 标识符与依赖

### N1 — 区分业务身份与源码名称

- 类型、trait、object、对应文件：PascalCase；方法、参数、val：lowerCamelCase。
- 稳定的业务 ID、operation ID、persistence ID、protobuf 字段号与 serializer manifest 不参与改名。可以从业务名称派生源码名，但不得再用源码名反推稳定身份。
- `bank_cash_payment_v1Execution` → 例如 `BankCashPaymentV1Execution`；该例是源码命名目标，不是把 `bank-cash-payment-v1` 合同 ID 改掉。
- 禁止重复技术后缀：`BankServiceService`、`...HostHost`。标识符分词/角色后缀由单一命名模型解析，不用多个模板各做 `.replaceAll('-', '_')`。
- 关键字、大小写文件碰撞、缩写与数字须由统一 resolver 检查；不靠写文件时覆盖消解冲突。
- 可复用现有 [scala-target/naming.mjs](baseline/js/lib/scala-target/naming.mjs) 的 `resolveName` / `resolveNameSet` / `resolveArtifactPath`。先核与 BC NamingConventions 语义一致；不是直接换 API 后宣称产物一致。

### N2 — imports 是模型结果，不是补丁

- TypeRef 应区分 FQN、简短 signature、类型参数和导入依赖。参考 [TypeSystem.scala](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala)。
- 收集嵌套参数与返回类型所需依赖；识别同名冲突，再在 import、显式别名和有限 FQN 中选择。
- 无歧义时使用简名；禁止同一长 FQN 在字段、事件、方法体中重复铺满。
- A 的 import 分组与声明顺序遵循目标 diff；B 的顺序为 Scala/JDK、外部框架、项目依赖，组内确定排序与去重。不强制把所有显式 import 换成通配。
- 不以引入隐式全局导入掩盖 Model.dependencies 缺失。也不在不理解嵌套 owner 的情况下删除 qualifier。

## 4. OO：对象应承载职责，不是文件数量

1. 对象/trait 封装稳定能力和不变式；实现通过明确构造参数/端口依赖，不使用 service locator、隐式全局配置或字符串路由代替类型合同。
2. 领域核心不依赖 Play、JDBC、Actor 生命周期、HTTP DTO 或 wire 编码；桥接归 application/infrastructure。A 若原始模板有框架注解等依赖，忠实列出，不隐瞒为“纯领域”。
3. 组合优先；继承用来表达稳定协议/角色，不造万能 `BaseEverything`。不把所有 Repository、Handler、Factory 强行改成同一个泛型基座。
4. 转发层需要真实理由：端口实现、访问边界、生命周期或协议适配。既无语义又无边界的壳不应出现；是否可删除必须考虑既有调用方和 A 的目标合同。
5. 构造器应完整表达必需依赖；多字段同类型参数用命名实参，避免顺序错位。不能靠一批可空字段和后置 `require` 代替合理结构。
6. 业务拒绝、基础设施故障和协议冲突要有可区分结果。禁止总是 `true`、`Right(empty)`、空回执掩盖尚未实现的分支。

## 5. Plain FP：业务是可读的值变换

1. 决策是 `State × Param → Either[Error, Events]` 等已定义的纯合同；事件应用生成新 State。输入相同输出相同，没有隐式时间、随机数或 I/O。
2. 应用命令、纯规则参数、领域事件、外部 DTO 不混成一种“通用消息”。领域类型与 wire/PO 边界明确。
3. 多态用具名 sealed ADT / 模式匹配 / 普通函数组合；不为压 CC 把业务分支搬进 `Map[String, Any]`、反射或万能解释器。
4. 表达式渲染遵守类型与运算符优先级，保真消除双重否定和多余括号；不得对最终源码做 regex 替换来简化逻辑。
5. 简单赋值直接表达：

```scala
case event: AccountInitialized =>
  state.copy(
    initialized = true,
    accountBalance =
      state.accountBalance.updated(event.currency, event.amount)
  )
```

只有需要一次求值、跨字段依赖、复用或说明计算时才有临时变量，并使用业务名。不因去 `next0/next1` 破坏求值顺序/异常顺序。
6. Money、精度、单位、溢出和舍入是语义，不是样板：`addExact` 不可无条件换 `+`；distinct nominal types 不可仅因字段同构就 alias 合并。
7. I/O 边界允许局部可变 buffer、actor 协调或资源注册状态；必须有清晰所有者和退出路径。禁把它们泄漏到纯模型/领域决策。

## 6. CommandHelper 与行为组不可被替代为空壳

预期形式（用户指定参考，非所有聚合通用算法）：

```scala
implicit object DepositHelper
    extends CommandHelper[
      Deposit,
      CreditBalanceState,
      Money,
      CreditBalanceConfirmation
    ] {
  override def toParam(
      state: CreditBalanceState,
      command: Deposit
  ): Money = command.change

  override def createFailureReply(param: Money)(
      error: iMadzError
  ): CreditBalanceConfirmation =
    CreditBalanceConfirmation(Some(error), Nil)

  override def createSuccessReply(param: Money)(
      state: CreditBalanceState
  ): CreditBalanceConfirmation =
    CreditBalanceConfirmation(None, state.accountBalance.values.toList)
}
```

- 错误分支不持久化；成功分支先持久化并应用事件，再用新 State 构造 reply。
- `runReplyingPolicy(rule, helper)(state, command).replyWith(command.replyTo)` 的含义由库实现决定，不能替换成 `Effect.persist(events).thenRun(_ => Accepted(events))` 就说等价。
- `replyWithAndPublish` 增加事件发布，不可替换 `replyWith`。
- `replyTo` 在应用 Actor 命令中按明确回复合同生成；只读 query 不要求生成写命令 Helper，领域参数/事件不含 ActorRef。
- 行为按实际业务组组织，参考 direct/reserve/incomingCredit；不要将所有命令再包进 Execute 然后嵌套巨型 match。

## 7. 可读性与复杂度门

这些阈值是本次拟实施的质量目标，不是已测量结果或行业唯一标准。度量工具/版本/Scala语法口径须在实施前固定，未测时写 `not-measured`，不编造分数。

| 维度 | 标准 |
|---|---|
| 普通方法 McCabe CC | 目标 ≤5；6–10逐方法说明职责；>10默认不接受，先重构 |
| 普通业务嵌套 | 目标 ≤2；出现第3层优先提炼具名职责；>3须整改或明确例外 |
| sealed ADT 穷尽分发 | 单列原始CC；按业务组拆分，分支保持短小。必要超限逐方法审定，无全局generated豁免 |
| 行宽 | B默认120字符，长字符串/协议常量等不可拆内容单列；A严格按目标diff，包括显式排版覆盖 |
| 参数/字段 | 长case class/多字段构造按行排版；相同类型且易错位时使用命名实参 |
| 方法组织 | 一个层次、一个职责；不同阶段具名分离。禁止helper1/helper2式拆分刷分 |
| 复杂度统计 | 看每方法最大值和认知负担，不用全项目平均值洗掉热点 |

禁止以减少代码行数/文件数/检查数为唯一目标；不能把分支转成无类型表或删掉验证来达标。未实施复杂度工具前以逐构造阅读核查，不假称有自动门。

## 8. 生成流程的落点

- Model只承载结构与明确代码槽；Builder推导；Template输出。Scala基准里已有代码槽须在diff明示，不能蔓延为“整个content都放Model”。
- 格式、名字、import、布局在最终产物字节固定之前确定；fingerprint、manifest和anchor基于最终字节。不能格式化后保留旧offset。
- 每个A比较完整文件集合、顺序、构造、RHS和glue；不得用压平所有空白的normalize称一比一。
- 复用元数据来生成多份必要登记是合理的；不能为了少输出一份表扩大serializer的接收类型或破坏协议边界。
- 旧文件退役必须有引用迁移、owned输出计划和清晰冲突报告。不能直接手改生成目录或覆盖手写实现。

## 9. 坏味道建议不是自动修改授权

完整原文已固定为 [user-generated-smells.md](baseline/user-generated-smells.md)。每条建议按 `smell-dispositions.json` 区分：直接表达整改、需语义/ABI裁定、不得原样采用。

重点禁止：以type alias折叠业务身份；合并不同事件协议；把规则/实体/app边界全删；`addExact→+`；广泛绑定 `scalapb.GeneratedMessage`；用字符串分发表替代类型化dispatch；把身份摘要格式改成统一样式而改变稳定ID。

最终是否通过，必须由可读代码、完整内容diff、必要行为证据共同给出，不能由文档存在或计数自动判定。
