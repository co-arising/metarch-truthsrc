# 2026-11-15 生成代码评审与交付目标记录

状态：**用户要求与评审结论已记录；不是生成器整改完成、业务方案审定或机构验收。**
本轮只保存记录和上下文，不修改生成器，不运行生成/构建/测试/数据库/浏览器验收。

## 1. 主线与交付目标

用户确认继续：

**Scala 清单 → JS A/B 分区 → 逐 ArtifactType 内容级 diff → 按 diff 对齐实现。**

基准是传统 `backend-codegen`（本地目录 `backkend-codegen`）的 Model/Builder/Template 内容与产物，不是只模仿文件名，也不是拿后加 `template/products/*` 中同样机械的输出作为证明。每份 diff 要覆盖命名、目录、包、import、声明顺序、class/object/trait/type alias/method/constructor，以及**等号右边的内容、完整方法体、胶水库调用与副作用顺序**。

用户进一步明确：最小交付必须是“一个大概真实的有血有肉的可执行的代码”；用例逻辑不清晰时，要补充丰富用例逻辑。工业级意味着可理解、可维护、有明确业务规则与异常路径，而不只是编译成功或跑完工作坊。不能以任务数、报告数、测试数或 artifact 覆盖计数替代质量。

银行业务侧的目标与后续虚拟角色协作记录见 [基金购买业务交付要求](../../../bank-wealth-demo/docs/FUND-PURCHASE-BUSINESS-DELIVERY-20261115.md)。该文是本会话目标，不复制另一会话的公共业务表达 schema/设计。

## 2. 用户指定的失败样本

原始坏味道文档固定于 [baseline/user-generated-smells.md](baseline/user-generated-smells.md)；以下是随后补充的要求。

| 样本 | 问题性质 | 必须达到的目标 |
|---|---|---|
| `bank_cash_payment_v1Execution.scala` 等 | 将稳定业务ID直接拼作源码symbol；snake_case混入类型名 | 类型/文件PascalCase，方法/参数lowerCamelCase；业务ID、PID与幂等键不随代码重命名改变 |
| `BankServiceService`、`bank_payment_hostHost` | 无条件拼接角色后缀，语义重复 | 单一命名模型处理业务名与制品角色，禁止重复后缀 |
| `example.bankwealth.service` | 业务根包出现第四层，混合应用合同/Play/配置/生命周期 | 业务根包只允许domain/application/infrastructure；按实际职责拆分与放置，不仅搬整个类 |
| `val next0: Boolean = true`、`val next1: Map[String, FQN] = ...` | 机械中间值暴露成源代码，简单状态变化失去可读性 | 简单变更直接使用命名state.copy实参；必要临时值有业务名且保留求值顺序 |
| 到处 `example.bankwealth...` FQN | 类型/符号/依赖与import组织缺失 | TypeRef区分FQN和signature，完整收集依赖并处理冲突，无歧义时用简名 |
| `if (!(!((state.compensatedOutgoing).contains(p.txid)))) ...` | 外层守卫取反叠加内部not；过量括号 | 结构化表达式保真简化与优先级渲染，不用生成后regex洗代码 |
| domain Protocol混放Command/Event，业务命令无replyTo | 正式JS的协议职责与Scala不对应 | 应用Actor命令有明确typed replyTo与独立Replies；领域State/Events另归Entity，纯参数不引入ActorRef |
| `CommandHelpers.emitX(...): Vector[Event] = Vector(...)` | 事件构造器被误称为命令处理胶水 | 在application/aggregates/behaviors生成implicit CommandHelper，具备toParam/createFailureReply/createSuccessReply，并正确接runReplyingPolicy |
| 创建计划需穿过Execute→Behavior→domain Rules→Params→invariant Rules→emit→Event | 多层恒等转发，业务阅读路径碎裂 | 每一层必须有独立职责；用例决定可直接读懂，不为文件数量或形式分层牺牲理解成本 |

全体 A/B 输出都遵守目录合同。BC原始 `$base.modules` 与用户三层规则有差异，必须显式记录覆盖，不能偷偷改金样。框架顶层controllers与业务根包下新增第四层不是同一情况。

## 3. Repository 具体评审

用户提供的 `CreditBalanceRepository[K]` 包含本地Actor缓存、双mutable Map、同步锁、identity/behavior/spawn函数注入和close标志。它实际接近**本地Actor注册/创建缓存**，不等于传统Scala中的聚合访问Repository端口。

从该片段能确定的内容：
- `get`在同步区间调用identity/behavior/spawn并缓存Handle。
- `close`将closed置true并清空映射；片段本身没有stop、watch、drain或await Actor终止。
- 没有在该片段看见跨JVM归属、Actor死亡后的缓存失效、容量/淘汰、失败创建后的完整生命周期合同。

这些观察不能升级成“整个工程绝无上述保障”，但不能以mutable Map和synchronized就冒称工业级Repository。对齐时需比较传统Scala的Repository interface / injected implementation / ClusterSharding.entityRefFor / EntityTypeKey / bootstrap责任；采用分片还是原本地独占模式是运行语义差异，不是单纯美化。

## 4. CreateSipPlan：业务逻辑没有被表达清楚

用户贴出的代码不是完全没有业务逻辑。下列检查包含真正的业务决定：

- 创建请求是否与已经受理的creation intent一致；
- 既有planId/revision/config是否冲突；
- 相同重复请求是否幂等返回，不重复发事件；
- 计划版本、生效时点、账户关系、基金代码和金额是否满足本示例要求。

前几项属于受理一致性、冲突与幂等，不应统称普通参数校验。问题是这些含义藏在超长布尔式、字符串错误码和多层转发中，而不是由具名业务决定表达。

Event Sourcing的`当前状态＋请求 → 拒绝/无新事件/事件 → 持久化 → 演进状态`本身合理；最后生成`SipPlanCreated`很简单不等于业务缺失。创建计划不应为了“更丰满”就附带扣款、TA受理或份额确认。完整生命周期的用例需要单独查明并补齐，不能靠想象增加金融规则。

目标阅读结构是：

1. 明确业务请求和成功/失败回复；
2. 校验受理一致性与请求身份；
3. 区分重复请求、冲突和首次创建；
4. 验证新计划配置；
5. 决定产生的事实；
6. 由成熟胶水持久化并在新State上回复。

需要可核对的业务流程、具体规则/计算、状态机、错误与恢复，而不是更多空壳或以`Right(empty)`模拟未完成分支。

## 5. 四种模拟评审视角（非本人发言）

下列是主agent按工程思想所做的**模拟评审**，不是Robert C. Martin、Greg Young、Martin Odersky或真实银行专家的引述、认可或实际参与。

- **整洁架构/OO视角**：架构应突出用例；分文件不等于职责分离；没有独立意义的wrapper/Params/转发加重耦合。依赖注入不能替代正确的Repository/生命周期抽象。禁止为解决坏抽象继续堆万能框架。
- **Event Sourcing视角**：先说清请求、决定、事件所代表的事实与幂等身份；失败不persist，成功应用事件后才构造reply。技术恢复机制可以必要，但不能掩盖支付成功、TA受理、份额确认与退款之间的差别。
- **Scala/Plain FP视角**：使用有意义的类型、不可变值、普通纯函数、清楚的模式匹配和import；不要把编译器IR式nextN、snake_case、FQN与多层否定直接打印给业务读者。不需要复杂类型体操来做到可读。
- **能读代码的基金业务专家视角**：要能回答购买/定投签约、扣款、申购受理、交易日、份额确认、失败退款、重试/未知结果、配置修订影响范围等具体问题。问题是业务核查清单，未自动转化为已确定政策。

共同结论：**不仅逐制品内容要正确，跨文件的业务阅读路径也要能解释“为什么这么做”。** 39类各自相似但整体仍需十次跳转的结果不算目标达成。

## 6. 圈复杂度与语义保护

详见 [layout-and-style.md](layout-and-style.md)。普通方法CC≤5为目标；>10不能默认接受；同时看认知嵌套与职责，不用项目平均数或String/Any分发表刷分。数值阈值是本次目标，不是当前已测结果。

不能机械采用坏味道清单中会改语义的建议：`addExact→+`、将同构名义类型全部alias、合并持久化事件、扩大serializer接收范围、修改摘要/幂等身份、删除所有边界转发。A严格对照原始基准与用户认可目标，B也需具体目标/fixture，不以“无同款”免检。

## 7. 当前成果与限制

截至本次封存前：
- 已有39传统模板族清单与3项可选strict/composition扩展的来源入口；基线852文件，记录约10.4MB源码/已有产物，不含构建缓存和运行秘密。
- 已落盘15份diff（属于规格草稿，不自动等于已审定/可实施/实现完成）：value-object、domain-entity、aggregate-root、protobuf-schema、proto-converter、event-adapter、snapshot-adapter、projection-repository-port、projection-repository-implementation、projection-apply-event、projection、projection-handler、saga-participant、saga-definition、saga-context。
- 尚缺27份diff；`js-partition.json`、`assignment-map.json`、`glue-dependencies.md`、同输入原始生成/目标样例资产与完整收口未完成。目录存在不能冒称A/B分类完成。
- 45个catalog producer/641个output contract已导航，102类别/802关联不等独立文件数；映射要按逻辑construct核实，不能按名字机械分A/B。
- 工作流`artifact-diff-documents`受到中转站限流；原run `wf_cc6d3b3d-c13`已结束且没有成功返回的agent结果。已有文档来自先前代理写入，文件事实优先。曾承诺重试，但在后续用户讨论与压缩请求前**尚未重新launch该workflow**，不得描述为仍在自动续跑。
- 历史181pending已做价值重评建议：174为审阅过程步骤；建议归档未执行，不批量假记完成。本轮只完成新的记录与窗口任务。
- workshop37在准确旧候选上完整PASS，约163.4分钟；自有容器/网络已清，数据/回执保留。它不是生成代码质量证明；session38仍未启动。

## 8. 当前请求的停止点

用户要求：保存本轮评审、已有diff和新业务目标，生成压缩窗口；**本次不修改生成器、不重跑验收**。不在压缩过程中补27份diff、不重启工作流、不启动新业务角色代理、不提交/推送/发布。

压缩后继续时，先读窗口HANDOFF，然后接续#679/#680/#681；恢复限流工作流要先看已有文件，按真实不重叠写集合继续。上游错误可以按用户授权重试，不把它当业务缺陷；完成/失败均以落盘事实和回执核定。角色工作坊是后续业务澄清机制，不能替代diff内容对齐与实际行为验证。
