# 有限批定义与manifest

类别：`batch-definition`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义有限作业的area、批策略、资源、并发和execution上限，并封定逐项manifest。不是无限流处理或任意图语言。

## 输入与人工信息

ItemId/sequence、payload、area/compatibilityKey、policyVersion、retry/route上限和EOF语义显式提供。

## 生产与所有权

`monarch-r2`中的具体BatchDefinition、AreaDefinition和BatchPolicy是应用拥有的业务数据/手写装配，当前没有对应原生生成能力。库提供类型和执行约束，不替应用选择批量、路由、资源或EOF政策。

`BatchDefinition`声明在`batch/BatchProtocol.scala`，策略类型在`workflow/BatchModel.scala`。引用这些API不是提供了具体业务定义；`not-generated`不等库接口不存在。

逐profile及接口/实现证据区别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。银行仍锁P23，不据R2库类型存在推定银行已迁移。

## 结构与命名

BatchDefinition/AreaDefinition/BatchPolicy.single/countOrWait/compatible与BatchManifest分别描述业务批合同。`compatible`且`allowPartialOnClose=false`时，硬`minItems`不因EOF或timeout绕过；不能把这一限制无差别套在所有CountOrWait策略上。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

manifest封定后不能重组顺序/identity/payload，source adapter恢复重放同一输入及EOF。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

硬最低量、尾批、backpressure、同sequence冲突、manifest完整逐项覆盖/体积上限。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

`monarch-r2`引用的是库API与应用义务，不是已有完整业务生成实现；R1不含这组批定义。银行仍锁P23，未采用R2。测试源码或接口存在不能提升为生成/行为证据或最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/batch/BatchProtocol.scala` — `BatchDefinition`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/workflow/BatchModel.scala` — `BatchPolicy`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；本页摘录不是生产认证。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `workflow-program`：Finite R2 batch policy, original-item conservation, explicit release/whole Carry, query-only verification and typed inner Run mapping. Retry exhaustion and two-phase authorized recovery are explicit.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
