# WorkflowProgram业务适配

类别：`workflow-program`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义R2 workflow的业务映射，是应用应提供而不是运行库可猜测的核心接缝。

## 输入与人工信息

definition、capacities、resourceEvidence、connector(area)、operation(manifest)、complete(manifest,terminal)、verifyRoute由显式业务/技术知识和实现决定。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`not-generated`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

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

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：monarch-r2。R1/R2公开运行库有对应实现；当前银行生成仍锁P23，不宣称JS原生R2生成、兼容旧journal或生产认证。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/WorkflowHost.scala` — `WorkflowProgram`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

## 真实接口形状

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
