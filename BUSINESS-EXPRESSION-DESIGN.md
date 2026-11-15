# 业务函数、BDD 与外部契约：联合设计

最后更新: 2026-11-15

**状态：P0 设计落档；语义方向已确认，有限合同尚未冻结，P1–P5 未实施。**

本文件是本议题的设计维护源；[PROJECT-OPEN-ITEMS](PROJECT-OPEN-ITEMS.md)、BC BACKLOG S2-104 与门户 DEF-21/22/23 只维护问题、状态及导航，不复制一套设计。DEF-25 的多上下文能力是后续独立线。

## 1. Context 与交付边界

用户要求评估缺失后无法完整表达业务的重要挂账，明确两项：

- 函数的**签名＋独立 BDD 用例集合**，表达式能引用，编译器能解析；不是只有自然语言描述或生成 Gherkin 展示。
- 外部数据集、消息流入、API 调用契约，连到内部消费、读写模型及代码架构 ArtifactType；不是只有外部系统名称或一条 connector 接口。

本次只落档设计和挂账，不改作者语法、schema、编译器、生成器、业务树或历史证据，不运行银行、服务或运行库升级。批准本路线不等于标准版本、schema 草案或运行实现已经验收。

调研基线：JS `86c525e`（包含调研期间完成的 legacy 保真修复）、BC `cc335eb1`、门户 `1b56199` 加既有 DEF-23/24 未提交内容。实现前重新核对工作树。结论来自源码阅读，未执行函数或外部集成验收；未成功返回的独立设计审查不计通过，外部官方规范联网核验未完成。

## 2. 现状：有历史基础，但当前严格链缺闭环

| 范围 | 已有事实 | 尚缺的能力 |
|---|---|---|
| BC 函数 | `knowledge_base/functions/functions.yaml` 的 `signature`、`callExpr`、`implRef`、`seam`；`cases/*.yaml` 的独立 Given/When/Then | 声明含调用点 `from` 和 Scala 字符串；不是当前语言的通用函数产品 |
| BC 测试 | `tools/gen_function_specs.mjs` 已接 pipeline，预期来自用例 | 固定 `ContentFingerprint.invoke`；无 case 跳过；空 `then.output` 可无断言，`then.notEqual` 不由该生成器执行 |
| BC 函数引用 | `knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` 的 `fnSpecs` 与 `fn:` | 未解析可留 TODO；emission 的 `expr:` 与函数表存在调用串双写；不等于严格符号/类型检查 |
| JS legacy | [SCHEMA](SCHEMA.md) 的 `declaredFunction`；[aggregate renderer](generators/aggregate-dsl/render.mjs) 的 `fn:` | 失败可透传，retired function-specs 从 options 消费历史用例；不能当正式产品资格 |
| JS 严格表达式 | [expressions](lib/domain-products/expressions.mjs) 与 [values](lib/domain-products/values.mjs) 的有限操作、显式路径和绑定阶段 host 值 | 缺通用 `call` 节点、函数注册/版本解析、独立 BDD 和实现绑定的贯通 |
| BC 外部契约 | `ArchitectMetadata.scala` 的 `ExternalContractMetadata(name, protocol, sync)`、`ExternalSystemMetadata`、Connector 模型 | 报告级描述和特定工具 connector 不等于版本化外部接口/数据合同 |
| JS 外部结果 | [external-events](lib/domain-products/external-events.mjs) 检查 producer、类型、映射、身份、端口版本；[artifacts](lib/products/artifacts.mjs) 检查实现义务 | 未统一到通用外部契约原文、消费声明及对应架构产物 |
| JS API/读侧 | [api-contract](lib/products/api-contract.mjs) 的本地有限 API；[persistence-readside](lib/products/persistence-readside.mjs) 的持久化读侧 | 前者不是 OpenAPI 导入；后者明确拒绝 external producers，并要求本地 command 产生事件 |

因此，DEF-21 是**既有函数机制向当前严格链的补全**，不是从零发明 `functions.yaml`。DEF-22/23 是**外部契约—消费—版本—产物的闭环**，不是宣称现有契约/端口全部不存在。

BC 原函数表已区分纯算法与有副作用的 ActionType 面，并记录“声明 vs 实现＝骨架 vs 血肉”。本设计沿用项目内已确认边界，不以尚未核验的外部产品类比扩大能力承诺。

## 3. 函数契约

### 3.1 作者与实现分离

推荐 context 内 `functions/<slug>.function.yaml`，一函数一原子，签名和 BDD 就近。**这是新位置提案，当前工具不接受此语法。** 使用现有小型作者格式、`parseDoc/emitDoc`、快照和来源映射，不新建通用 YAML 解释器。

| 对象 | 作者信息 | 不应承载 |
|---|---|---|
| FunctionDefinition | context、稳定 id、契约 version、意图、有序具名参数与名义类型、返回/失败约定、获准调用位置 | Scala FQN、任意 `callExpr`、算法实现正文 |
| FunctionCase | case id、场景、typed Given、明确 When 引用、Then 结果/错误/关系断言、独立预期来源 | 从待测实现推导的 expected、仅展示的 Gherkin |
| FunctionCall | 完整函数引用、精确版本、显式实参表达式 | 同名字段猜测、路径末段猜参数、隐式重载 |
| ImplementationBinding | 函数契约到 computation port/method/实现的显式关系、实现版本、来源及目标模块 | 第二套手工签名、业务树内构建哈希、全局可变 Access 门 |

函数接口来自同一作者声明。需要 module-seams 输入时由它派生，不让函数原子和另一手写 port 声明同时成为签名权威。算法代码保持代码归属，不藏进编译器常量。

### 3.2 编译与 BDD

- 两遍处理：登记符号与签名，再解析调用。完整身份包含 context 和显式版本；具体 reference/schema 版本在 P0-F1 冻结。
- 初版无隐式重载、泛型推断或递归调用。支持不同声明顺序，不以文件遍历顺序决定解析结果。
- 显式 `call` AST 进入 guard、event binding、fold、集成纯转换各自获准位置。guard 只读 state/param；fold 只读事件和同一事件前状态；转换只读明确输入。
- 参数重复/缺失/多余、类型/返回目标、版本和作用域不符，均在生成前拒绝；诊断同时指向定义与调用的实际来源。不能以 TODO 或原串透传当成成功。
- 复用名义类型、精确数值、optional/map 规则。module-seams 支持 `Either` 不代表 value evaluator 或测试载体自动支持；返回失败值如何映射需同步冻结和测试。
- 每个可执行函数规格必须有非空、有效的 BDD 集合；未知断言、空预期、重复 case、悬空 case 引用拒绝。关系断言如 `notEqual` 必须执行或明确拒绝，不能忽略。
- 类型错误的调用是编译负例；合法输入产生领域失败值是 BDD 行为例，两者不混淆。
- 语义编译不执行 `implRef`。生成显式接口、调用及契约测试后，测试运行器再执行真正目标实现。缺实现可保留为草稿，但不能获得 runnable 资格。
- 错误实现变异必须让独立 BDD 失败；生成代码或测试文件的存在不等于测试已执行。Gherkin 是可选投影，不是验收输入的替代品。

### 3.3 纯度与重放

`pure` 是义务，不是对任意 Scala 代码纯净或终止的数学证明。编译器检查类型、依赖和绑定；实现审查、独立用例、重复运行与依赖清单另作证据。

- 纯函数无隐式时钟、随机数、网络、数据库、可变全局依赖。有此需要的计算走 host/port/effect，结果进入事件或明确摄入记录。
- fold 保留同时读取事件前快照、唯一目标赋值；失败不得变成默认值、部分更新或静默跳过。
- **初版方向为每条持久流固定行为 bundle**：锁住函数、实现及传递依赖；恢复不能用 `latest`，缺旧实现或摘要不符则拒绝。仅有部署配置里的当前 pin 不足以证明旧流用过哪个版本。
- bundle 与流的耐久绑定、首次绑定时机、snapshot/事件恢复如何比对，列入 P0-F2；未解决前不得开放函数化 fold 的持久运行资格。已有流没有凭据时不得自动绑定为“当前版本”。
- 同流算法升级另做迁移；本路线不自动改既有 event/snapshot wire、不重签旧证据。有副作用动作仍由 command、application flow、Saga/Monarch 管理，不是纯函数调用。

## 4. 外部契约与消费

```text
外部系统/数据产品 → 版本化契约与类型 → 显式消费/调用 + 纯转换函数
  ├─ 写侧：验证/翻译 → 业务命令 → 本地决策 → 本地事件
  ├─ 读侧：外部记录 → 摄入/处理/投影/存储 → 自有读模型
  └─ 出站：应用端口 → 外部 API → 已确认/拒绝/未知结果
                       ↓
             技术绑定与具体架构产物
```

外部观测不是本地已确认事实。已有 authority-event 桥保留其独立权限/身份合同，不能作为通用消息任意写聚合的入口。

| 层 | 契约内容 |
|---|---|
| ExternalContract | 外部 owner/source、id/version、operation/message/dataset 引用、payload/错误/语义；保留原文及节点定位 |
| Consumption/Invocation | 消费者、驱动/被驱动方向与数据流方向、过滤/转换函数、目标命令或读模型、字段映射及冲突策略 |
| IntegrationBinding | 协议、codec、端点/channel/文件、secret 引用、幂等身份、顺序、checkpoint、重建、期限/重试与结果核实 |
| Artifact realization | 复用 artifact/port/implementation 义务，连接职责类别、目标 profile、producer/手写责任和具体实例 |

HTTP 主动拉取的数据流是入站，但控制由本系统发起；收到 HTTP 回调或消息则是外部驱动。分类不能只看中间件名字。

### 4.1 标准适配边界

推荐按职责评估 OpenAPI（HTTP）、AsyncAPI（消息接口）、JSON Schema（payload）；CloudEvents 为可选信封候选。**版本与支持子集尚未冻结，也没有全规范支持承诺。** 数据集另需主键、snapshot/delta、删除和新鲜度语义；ODCS 是否采用独立评估，不成为首批前置。

外部原文作为显式项目输入保留，归一化 IR 派生，不再手写一份 payload schema。编译默认不联网抓引用；远程依赖须预先显式获取并纳入快照。引用循环、递归类型、未知 dialect/关键字如何拒绝，在 P0-F3 列清，不静默删除不支持语义。

工具 schema、外部 contract、binding、函数、wire 各自版本化；同 semver 不自动证明兼容。固定版本及来源摘要是可复现基础，不替代兼容性规则和测试。

### 4.2 读侧与履约语义

- 新增明确外部消费/读投影 profile，复用现有类型/投影/存储/生命周期能力；不删除旧 persistence-readside 的 no-external 限制。
- 不为了生成读模型虚构命令、聚合或本地域事件。输入身份、source authority、字段血缘和消费者拥有的状态分别记录。
- 明确去重键、分区/顺序、同 ID 异正文、坏 payload、未知版本、迟到/乱序/重复及不可恢复输入的处理。
- 如果声称投影写入与 checkpoint 同事务，二者必须在同一实际存储事务中验证；跨命令或外部调用不继承 exactly-once。
- 重建依赖保留的输入和转换版本；fixture 可回放、SQL 可重建、真实提供者保留历史是三项不同保证。
- 出站超时/ACK 丢失保持 unknown，不自动变成业务失败或盲目重发。execute/query、幂等键及核实策略要有独立用例。DEF-18 的运行时期限/重试债仍单列。

## 5. ArtifactType 与同图追踪

[ArtifactType catalog](docs/artifacts/catalog.json) 是类别登记单源，不是业务契约原文，也不是运行实现认证。类别、语义产品、generator kind 与物理文件是多对多关系。

| 表达节点 | 优先复用的类别 |
|---|---|
| 函数签名/算法/BDD | `computation-port`、显式手写 implementation、`function-contract-test` |
| 外部端口与适配 | `external-connector-port`、`connector-implementation`、`port-binding-module` |
| 特定受信外部结果 | `external-event-bridge`，仅限其 authority 合同 |
| 外部输入到读模型 | `projection-handler`、`projection-repository-port`、`projection-repository-implementation`、`projection-schema` |

P0-F4 检查 ingress decoder/consumer 是否需新类别，不能用一个既有标签掩盖缺 producer。实现绑定必须同时定位具体产物与获准 profile；不能只有 `ArtifactType=...`。

沿现有图/来源机制增加版本化关系：函数调用、契约消费、转换、目标字段、实现、生成来源。能从外部字段/函数查使用处和代码，亦能反查定义与独立测试；文档边与可执行依赖边分开。手写仅有 file 证据时不伪造 symbol/span，也不恢复 inline `@knowledge`。

## 6. 分期与退出合同

JS 当前文件真源严格链为新能力主线。BC 历史机制作为迁移基线及对照；新语义的 BC 消费另分 parity 子批，未支持则明确拒绝，不同时再造一套语言。

| 批次 | 交付 | 退出条件 |
|---|---|---|
| P0 | 联合设计、旧机制迁移映射、标准子集、ArtifactType 映射、独立样例和冻结清单 | 下节 F1–F5 有版本化可审查结果；仅落文档不算总冻结完成 |
| P1 | 函数原子/BDD、来源、compile/decompose/roundtrip、符号和类型产品 | 往返保真；正确引用可解析；缺失/歧义/错类型/空断言全部拒绝 |
| P2 | 获准位置的 call、实现绑定、生成接口/调用/BDD、实际 Scala 执行 | 独立正反例通过；错误算法变异必失败；旧 profile 不变；重放合同成立 |
| P3 | 外部标准子集、引用/类型/版本闭包、读写两支消费语义 | 不丢不支持语义；字段/转换/目标可追踪；版本变化影响可定位 |
| P4 | 独立非银行邮件安全示例：消息/批文件/本地 mock API→转换→SQL读模型/查询 | 实际输入、存储/HTTP、重投/乱序/unknown、checkpoint 恢复和重建对账 |
| P5 | 显式兼容迁移/拒绝、安装移址、同图往返、能力目录和门户对账 | 同候选新证据逐层成立；旧证据保留；按条目自己的合同关闭挂账 |

依赖：P0→P1→P2，P0→P3，P2+P3→P4→P5。共享作者入口、类型/符号与最终 writer 归主集成；契约固定后其他部分可独立实施。

多上下文/context map（DEF-25）、跨命令/流程通用 BDD、DEF-24 inbox、DEF-09 业务叙事、DEF-18 runtime 均是独立后续，不让它们无限延长本路线，也不顺带关闭。

## 7. P0 冻结清单

以下是**明确待解决的问题**，不是“已经冻结”的隐含假设。

| ID | 必须冻结的结果 | 当前状态 |
|---|---|---|
| P0-F1 | 函数原子及 `call` 精确形状、版本表、Either/optional/精确值载体；已有 functions/ports/cases 的逐项兼容映射 | 方向已确认；精确 schema 与迁移表待编写/核验 |
| P0-F2 | 行为 bundle 与持久流的耐久绑定位置/首次写入/恢复验证；旧流缺凭据处理和独立恢复反例 | 固定 bundle 方向已确认；存储合同未冻结，不开放持久 fold 执行 |
| P0-F3 | 外部标准准确版本、dialect/关键字/引用支持与拒绝清单；官方来源核验 | 待核验；本地已有契约不等新标准导入支持 |
| P0-F4 | 当前 ArtifactType 到具体 producer/profile/写者的复用映射，ingress 是否需新类别 | 已定位候选类别；新输出/责任矩阵待冻结 |
| P0-F5 | 非银行函数与集成 fixture 的完整输入、人工可审查预期、失败矩阵和重建基准 | 邮件大盘场景方向在案；精确 fixture/oracle 尚未建立 |

P0-F5 的最小候选应覆盖：外部批数据明确 upsert/delete；消息按 `source+messageId` 去重并拒绝同键异正文；纯分类函数采用固定合成规则而非臆测真实邮件策略；API mock 包含正常/拒绝/超时未知；空读库从同一锁定输入重建后结果一致。没有真实企业规则或原始业务数据的批准，不把候选规则推广为用户业务事实。

## 8. 实施定位与验证

复用，不重写：

- 作者/保真：`lib/author-surface.mjs#checkResidence`、`author-structures.mjs`、`compile-snapshot.mjs#compileSnapshot`；保留 `86c525e` 的 legacy carrier 交叉核验。
- 产品/符号：`lib/products/registry.mjs`、`compile.mjs`、`lib/project/derive.mjs`，`domain-products/references.mjs#compileReferences`/`refKey`。
- 类型/调用：`values.mjs#canonicalType`/`validateValue`、`expressions.mjs#parseExpression`/`infer`；版本化增加 call，不透传宿主字符串。
- 签名/绑定：`module-seams-contract.mjs#signatureReferences`/`seamsMethod`、`module-seams-composition.mjs`、`artifacts.mjs#compileArtifacts`。
- 实现捕获：`lib/project/implementations.mjs#captureImplementations`/`assertImplementationsUnchanged`。
- 目标与写入：`lib/scala-target/`、相应结构模型/模板、`src/core/generate.mjs#applyEntries`；图与回锚使用 `lib/project/graph.mjs` 及现有查询入口。

实施批需要的验收层：

1. 作者 validate + roundtrip；旧输入/新原子/坏引用/诊断来源负例。
2. typed 产品与限定作用域、版本、缺实现、无断言、未知断言拒绝。
3. 新自有候选生成和真正 JDK11/Scala 编译；独立 BDD 与错误实现变异。
4. 本地合成消息/文件/HTTP mock 到 SQL 查询、关闭恢复和重建；无真实外部服务操作。
5. 安装包移址后的同样例消费、代码/作者/契约/用例的双向查询。
6. 适用 Node 回归、ArtifactType 目录/兼容检查与门户静态检查；失败/跳过保留。

按 T0作者与外部契约→T1产品→T2同图→T3实现及产物→T4回锚/证据收尾；BC 采用既有 feedback-ring 门表。P0 当前只动设计和问题文档，不运行或冒领以上业务层验收。

## 9. 官方参考入口

以下为待核验的规范入口，**不是本项目已实现或已兼容的证据**：

- [Palantir Actions](https://www.palantir.com/docs/foundry/action-types/overview/) / [Functions](https://www.palantir.com/docs/foundry/functions/overview/)
- [OpenAPI](https://spec.openapis.org/oas/latest.html)
- [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/latest)
- [JSON Schema](https://json-schema.org/specification)
- [CloudEvents](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md)
- [Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard)
