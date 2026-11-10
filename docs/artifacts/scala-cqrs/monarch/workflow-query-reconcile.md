# 工作流查询与有限恢复授权

类别：`workflow-query-reconcile`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

R1查询已提交Run/Operation状态，R2再扩展作业/批/资源观察和WorkflowHost有限恢复入口。显式查证是受控动作，页面轮询不得自动触发reconcile。

## 输入与人工信息

R1需要可信Run/Operation身份与明确Reconcile权限；R2还需job/batch身份、分页和相应有限恢复预算。缺状态或超时报告不可用，不从页面显示制造业务终态。

## 生产与所有权

- `monarch-r1`的查询/查证入口是RunProtocol.GetRun及OperationProtocol.Get/Reconcile，不包含WorkflowHost或Batch查询。
- `monarch-r2`在上述基础上提供WorkflowHost/Batch等查询与有限reconcile；应用仍手写身份路由、授权和观察接口，未建立原生生成能力。
- 查询只观察已提交事实，显式授权的reconcile是受控动作；两者都不等业务完成，也不授权页面自动重试。

逐profile的API、应用义务及证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行P23查询/恢复不能改称R2采用，失败服务与OPEN retry政策保持原结论。

## 结构与命名

Get/GetRun/Operation Get与host.reconcile分别是观察和受控动作；恢复授权已提交不等业务完成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

R1维持原Run/Operation身份与不可变请求；R2交接还须维持Delivery身份。预算不会因重启/配置变化重置，查询不自动触发恢复授权。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

未授权/陌生batch、重复动作、有未完成调用时的拒绝、Blocked/RecoveryBlocked与终态区分。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R1仅在Run/Operation层提供对应查询/查证；R2才扩展WorkflowHost/Batch。测试源码不等恢复动作已执行，查询成功也不等业务完成或最终批准。银行继续冻结P23、未采用R2。

- `monarch:src/main/scala/net/imadz/monarch/persistence/RunProtocol.scala` — `GetRun`（R1起）。
- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/OperationProtocol.scala` — `Get`、`Reconcile`（R1起）。
- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/WorkflowHost.scala` — `WorkflowHost`（R2）。
- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/BatchProtocol.scala` — `Get`（R2）。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；不从R2引用反推R1接口。

### 类别依赖

R2装配关联`workflow-host-bootstrap`；R1只依赖对应Run/Operation查询和查证接口。类别关联不代替真实Scala import或执行顺序验证，也不把R2宿主变成R1依赖。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `workflow-program`：Finite R2 batch policy, original-item conservation, explicit release/whole Carry, query-only verification and typed inner Run mapping. Retry exhaustion and two-phase authorized recovery are explicit.
- `application-root`：Typed construction of captured external providers and Run Leaves/Hosts, caller-owned lifecycle and finite authorized recovery/resume of original batches.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
