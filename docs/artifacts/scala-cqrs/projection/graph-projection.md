# 图读侧适配与变更执行

类别：`graph-projection`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把领域变更写入独立图读侧，维护图键、关系和查询边界。不要与工具本地知识/代码锚图混成同一数据库语义。

## 输入与人工信息

图schema、租户/namespace、键生成、关系更新与业务允许的容忍策略需明确。

## 生产与所有权

- `bc-single` / `bc-multi`：BC 仓储 builder 的 graph 分支、实现模板及 handler 后处理生成每视图代码/委托，依赖外部手写存储和 driver；不是只有 multi 才有 graph 源码。
- `di-poc`：`GraphProjectionRepository` 是手写 kernel port/纯助手，`GraphMutationExecutor` 是手写 glue。它们是实现参考，不是 BC 每视图生成器本身。
- `js-legacy`：`viewrepo`、`smviews` 对 `storage.kind=graph` 有实际代码生成；退役 `scala-cqrs-es-projection` 也保留存储分支。两者不能归为原生服务 graph producer。
- legacy `mergeLinkTolerant` 仍为 `???`，相关行为需手写；BC 通用 ViewApi 明确排除 graph 查询。生成委托、图查询面和完整可运行图服务必须分开，当前没有确立原生通用 graph 生产能力。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

GraphProjectionRepository为kernel port；GraphProjectionRepositoryImpl可在ext，driver与GraphMutationExecutor为glue。FqnBuilder等纯计算可在kernel。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

接口不得依赖Neo4j driver，root注入实现；file-graph/tenant-graph与JS本地图版本不同，跨图身份不能靠字符串同名相连。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

租户隔离、节点边幂等、悬空/缺字段容忍、查询和投影offset；没有真实图验证不宣称关系完整。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
