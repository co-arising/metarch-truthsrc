# Strict阶段执行与查证端口

类别：`saga-phase-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

用typed execute与read-only query提交阶段并返回带身份的证据。拒绝/超时/None不等安全未执行。

## 输入与人工信息

OperationIdentity、receiptCodec、querySafety及参与者的真实耐久证据；NotExecuted.safeToRetry还需参与者fencing/idempotency保证。

## 生产与所有权

- `saga-strict`由库提供PhasePort/PhaseOutcome等接口和结果语义；接口存在不表示应用I/O已实现。
- `js-formal`通过`renderDefinitions`/TechnicalPorts生成typed桥；`bc-strict`由StrictSagaModuleTemplate生成Module内桥，`bc-semantic-products`由ProductApplicationTemplate独立生成，不能共用JS来源认领能力。
- `bank-p23`将生成桥与手写权威执行/查证绑定组合；`js-run-all-strict`是单独的旧strict source入口。实际金融证据政策由应用拥有。

逐profile和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。query返回None仍是Unknown，不是safe-to-retry；P23业务retry/backoff/deadline保持OPEN。

## 结构与命名

PhasePort[A,R]/PhaseBinding[A]/PhaseOutcome，生成Definition为TechnicalPorts绑定typed桥。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

不绑定未知任意Any，操作结果必须与原交易/step/resource/phase相符。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

ACK丢失先query、身份错配、假安全重试、不可用与codec替换拒绝。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

库接口、JS/BC生成桥与bank手写执行实现按profile分开。测试源码不等权威回执行为证据；P23冻结，OPEN业务政策不被技术查证关闭，最终批准未授予。

- `saga:src/main/scala/net/imadz/infra/saga/strict/StrictSagaDefinition.scala` — `PhasePort`、`PhaseBinding`。
- `js:generators/scala-cqrs-application/render-host.mjs` — `renderDefinitions`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/transactor/StrictSagaModuleTemplate.scala` — `generate`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/products/ProductApplicationTemplate.scala` — `generate`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；以下签名是接口，不是默认正确的银行实现。

### 真实端口形状

```scala
trait PhasePort[A, R] {
  def receiptCodec: PayloadCodec[R]
  def querySafety: QuerySafety
  def execute(request: OperationRequest[A]): Future[PhaseOutcome[R]]
  def query(request: OperationRequest[A]): Future[PhaseOutcome[R]]
}
```

ConfirmedReceipt、Unknown、Rejected、NotExecuted的证据强度不同；只有可信未执行且满足safeToRetry约束时才允许同身份安全重发，不能按异常文本自行推论。

### 类别依赖

`value-object`、`exact-value-codec`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `protocol`：Nominal bounded inventory values, typed Saga results/ports and optional typed Run Input/State/Output/leaf protocols; no Akka dependency.
- `strict-saga-bridge`：Two-resource serial TCC definition and typed phase bridges consuming fixed Strict Saga artifact; original association, query, result delivery and authorized bounded recovery.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
