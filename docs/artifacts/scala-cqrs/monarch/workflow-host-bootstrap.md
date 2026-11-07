# WorkflowHost启动与激活

类别：`workflow-host-bootstrap`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在有限本地namespace中装配资源域、batch、inbox、Run及Operation，并按显式jobId激活/恢复。不是自动全局sharding服务。

## 输入与人工信息

ActorSystem、namespace、WorkflowProgram、maxJobs/maxChildren和库配置由应用提供，必须单有效宿主。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`library`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

new WorkflowHost(system,namespace,program)、job/reconcile/resourceDomain；内部cache受上限约束，不承诺无限身份淘汰/扫描。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

库构造既有Coordinator，应用不再复制；重启后显式访问原jobId恢复，停止宿主不等外部效果停止。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

bootstrap配置、身份冲突、容量、恢复激活与关闭边界，不能把示例局部HTTP页当生产系统。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：monarch-r2。R1/R2公开运行库有对应实现；当前银行生成仍锁P23，不宣称JS原生R2生成、兼容旧journal或生产认证。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/WorkflowHost.scala` — `WorkflowProgram`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`workflow-program`、`batch-coordinator`、`managed-operation-wait`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
