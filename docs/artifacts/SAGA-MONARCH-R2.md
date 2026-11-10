# Strict Saga / Monarch R2 生成合同

`scala-cqrs-saga-monarch-v1` 是显式的非银行候选入口，target 为 `scala-cqrs-saga-monarch@1`。它生成应用装配，不生成或替换 Saga/Monarch 内核；银行 P23、旧日志与冻结制品不随此入口迁移。

## 职责

唯一作者树表达两资源库存预留的串行完整 TCC、typed result port、有限 workflow，以及可选纯多步骤或单外部操作 Run。Strict Saga 负责事务决策/receipt/补偿与授权恢复；Monarch R2 负责 Run、durable operation、批次、资源与逐项结算。两者不能互换。

## 输入与人工信息

使用 `scaffold/saga-monarch-project/truthsrc.project.json` 所配置的 `truth/saga-monarch`。该树是唯一业务修改面；`bindings/` 固定 artifact、codec、技术身份、构造 ABI 和外置实现位置。不得手改生成 canonical/request、账本或 anchors。

每次作者编辑后执行 `validate` 与 `roundtrip`。二者通过只说明作者结构与保真，不是执行资格。八个显式产品为 reference-layout@1、exact-value-types@1、exact-value-codecs@1、saga-contract@2、saga-runtime-contract@2、execution-contract@2、workflow-contract@1、saga-host-contract@3。

固定供应：

- `monarch-persistence_2.13:0.3.0-dev.r2-20261106-dc168f96fa62`；SHA-256 `2dea09f3c97b4832fd78552f546a1d5fb4f68d5b92c42cb3d4466101c59d21b0`。
- `monarch-core_2.13:0.2.1`；SHA-256 `66223d37ab979b59cde557500f3da7aafaf532ddfe3268401c5f786093e0f971`。
- `saga-core_2.13:0.2.1-p23.20261027.1`；SHA-256 `f20ad61eba670d2766cd39a1f75bd236351d0069b0480bb85d7335ffff93f8cf`。

声明字符串不证明已安装或实际加载正确的 JAR；运行资格另核供应与 CodeSource。

## 生产与所有权

公共链：作者树 → source-index → deriveProjectRequest → compileProductSet → 同图 AST → planCompiledProducts → planProductSet → applyEntries。所有生成项来自一个 producer plan，一次 writer；不从参考源码复制生成应用，也不以生成后替换名称弥补模板缺陷。

kernel 放 nominal 值、协议和有界 codec；glue 放 Strict bridge、typed Run、WorkflowProgram；ext 为已捕获的手写业务叶子；root 显式构造。外置代码按声明整组捕获，其字节参与 freshness，但不变成生成账本成员。`FileInventoryPorts` 是测试用协议模拟，不是生产库存算法；证书摘要也不是生产密码学授权。

## 结构与命名

packages/names 由集中 resolver 验证。可覆盖 Scala 名称，但不能把 actor 世代、批次位置或渲染序号当作耐久业务 identity。五种 Saga 结果严格分为三个终态与两个非终态；原请求、transaction ID、phase/resource/receipt codec 和 digest 不能丢失。

字符串 nominal 与 phase receipt handle 的码点长度上下界均被消费。派生 transactionPrefix + SHA-256 hex 必须落入已声明 transaction 类型域。codec 字符串版本不转整数；新 dotted codec 名只由显式新版本合同准入，旧 v1 规则保留。

## 依赖与装配

外层 `WorkflowHost` 固定只有 `execute` / `batch-codec-1`。内层业务 Run 保留自己的 definition、step、state/request codec。workflow 的 run action 明确声明每个输入取原 request 或 transaction-id，所有结局逐一映射，单个 nominal result output 必须消费。

独立 Run 生成 typed Input/State/Output、ports/leaf、reads→参数、writes→检查点和 outcomes→状态，而不是把完整编排留给通用回调。纯 Run 可有固定多步骤，业务停止后不再调用后续叶子；managed Run 当前是一阶段、一外部 operation。未知类型、不支持的形状、缺输入/输出映射、未绑定 leaf 均拒绝。

外部业务叶子只实现 submit/query/evidence 协议；durable operation、计时、重试与 journal 来自已固定 R2。NotFound 不意味着 SafeToSubmit，成功项不能重做。

## 回锚与更新

源码映射绑定最终 UTF-8 spans，可从 phase、workflow area、Run step、技术 binding 和实现声明双向定位。改作者、binding、手写实现都须变 stale；合法显式 update 后重新验证。零源码写再生不等于任意场景下零证据写，也不承诺全局回滚。MANUAL 与已有 ownership 由公共 writer 管理。

可将已安装包内的 `scaffold/saga-monarch-project/` 复制到新的用户目录，再调用公开 `generate-project --plan`、`generate-project`、`verify-project`。raw `generate-products` 没有 live implementation capture 时拒绝，即使只要 plan 也不能绕过。

## 验证

参考、生成、安装是不同 lane。Node contract/model/source tests、Scala 分模块编译、业务执行、真实 JVM journal 恢复、installed 无 checkout fallback 均单列。使用固定 `SerializedValidationJournal` 和耐久外部协议 fixture；不据此宣称生产 LevelDB/Mongo、断电或脑裂保证。默认 Node discovery 不启动 JVM，JVM 每阶段有界且必须真实 reap。

业务 Retry 仅允许 managed Run 确认无效果拒绝分支，显式 delay、maxExecutions、maxTransitions 和 `onExhausted: {kind: fail|hold, reason}`。达到执行或转换预算时生成 Failed/Hold，而不是发送 R2 会拒绝的非法 Retry。R2 `Drained` 不等于全业务成功。

## 版本与实例

普通 query 不会创建一个冷 Run actor，因为 R2 recovery 会自动恢复其未完成执行。冷查询返回不可用/未知；显式 ensure 或授权 recovery 才激活原身份。

`recoverRuns(manifest, token)` 先验证耐久原关联与授权，再验证原 Blocked batch 和 Granted resource，有限激活原 inner Run。Reconcile 的回复只是受理，不是完成。待只读查询确认所有 inner Run 的耐久终态，再调用 `resumeRuns(manifest, token)` 唤醒原 outer batch；未到终态不消耗外层恢复轮次。无生成轮询引擎，也不通过换 namespace 规避恢复。

不支持动态参与者、任意 fork/join、无限流、隐式业务重试或通用 durable transaction/job deadline。最终通过与安装/运行证据以独立验收记录为准，本页不授予架构 owner 批准、发布或银行迁移资格。
