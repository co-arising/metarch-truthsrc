# WorkflowHost启动与激活

类别：`workflow-host-bootstrap`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在有限本地namespace中装配资源域、batch、inbox、Run及Operation，并按显式jobId激活/恢复。不是自动全局sharding服务。

## 输入与人工信息

ActorSystem、namespace、WorkflowProgram、maxJobs/maxChildren和库配置由应用提供，必须单有效宿主。

## 生产与所有权

`monarch-r2`的`WorkflowHost`类由运行库提供；应用负责调用、namespace/配置及WorkflowProgram装配，不复制内部Coordinator。引用应定位`WorkflowHost`本身，不能以同文件的`WorkflowProgram`接口替代宿主实现。

未建立JS原生R2 bootstrap producer；P23生成Execution.behavior及银行手写BankRuntime不是该宿主的采用证明。逐profile责任和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)，银行保持冻结且不升级R2。

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

WorkflowHost是R2库宿主，R1不含它；应用启动配置仍须显式装配。测试源码不等真实启动/恢复证据；银行仍冻结P23、未采用R2，本页不授予最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/WorkflowHost.scala` — `WorkflowHost`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；宿主实现与WorkflowProgram接口分开定位。

### 类别依赖

`workflow-program`、`batch-coordinator`、`managed-operation-wait`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `application-root`：Typed construction of captured external providers and Run Leaves/Hosts, caller-owned lifecycle and finite authorized recovery/resume of original batches.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
