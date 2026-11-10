# WorkflowProgram业务适配

类别：`workflow-program`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义R2 workflow的业务映射，是应用应提供而不是运行库可猜测的核心接缝。

## 输入与人工信息

definition、capacities、resourceEvidence、connector(area)、operation(manifest)、complete(manifest,terminal)、verifyRoute由显式业务/技术知识和实现决定。

## 生产与所有权

`monarch-r2`的WorkflowProgram接口由库声明，具体业务映射由消费者应用手写，当前未建立原生JS/BC生成实现。这里的`handwritten`/`not-generated`描述应用义务，不表示已经有一个完整银行实现。

`operation`/`complete`必须是纯映射，connector及资源证据各有独立实现；完成分类须恰好覆盖manifest，不能用默认拒绝冒充已实现业务安全。逐profile及证据边界见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行仍P23，不从R2接口存在推定迁移完成。

## 结构与命名

实现WorkflowProgram trait；完成分类使用Completed/Failed/Retry/Route/Hold并恰好覆盖manifest全部ItemId。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

operation只构造原请求，complete只作纯分类；执行/查询在connector，资源证据由validator；未知不能伪装Failed或Retry。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

分类遗漏/重复/陌生项、路由/延时上限、成功项不再执行、业务独立账本核对。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页是R2应用义务，R1不含WorkflowProgram/WorkflowHost；不存在据此认领银行完整实现的授权。测试源码或接口存在不是生成/行为证据，最终批准未授予，P23冻结不变。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/WorkflowHost.scala` — `WorkflowProgram`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；下列签名是API，不是生成示例。

### 真实接口形状

```scala
trait WorkflowProgram {
  def definition: BatchDefinition
  def capacities: Map[String, Int]
  def resourceEvidence: ResourceEvidenceValidator
  def connector(area: String): ExternalOperationPort
  def operation(manifest: BatchManifest): OperationProtocol.Request
  def complete(manifest: BatchManifest, terminal: OperationProtocol.Terminal): Either[String, BatchCompletion]
}
```

另有默认拒绝的verifyRoute。完整签名由公开源提供；本例不是已生成的银行实现，也没有给出业务回执校验的默认成功代码。

### 类别依赖

`batch-definition`、`external-operation-connector`、`resource-evidence-policy`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `workflow-program`：Finite R2 batch policy, original-item conservation, explicit release/whole Carry, query-only verification and typed inner Run mapping. Retry exhaustion and two-phase authorized recovery are explicit.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
