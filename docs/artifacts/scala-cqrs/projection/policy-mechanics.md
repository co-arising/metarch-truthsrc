# 策略执行机制束

类别：`policy-mechanics`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将命令发送到正确聚合/系统并返回执行回执，提供副作用机制，不在这里重新裁定领域规则。

## 输入与人工信息

Entity寻址、ask timeout、回复解码与执行端口必须明确。超时是结果未知，不是安全重发证明。

## 生产与所有权

- `bc-single` / `bc-multi`：BC Node `gen_policy_exec.mjs` 构造并写入执行机制代码，不是 `ledgerRowOf` 在生成正文。
- `js-legacy`：`policyexec.mjs` 的 `mechanicsFile` 返回内容，run-all 写入。
- `js-retired`：退役 `scala-cqrs-es-policy-exec` 保留独立机制 emitter，不能升级记为原生服务 producer。
- 只有明确 `executionSide` 且签名可解析时才能形成相应执行代码；`targetAggregate` 不足以确定发送目标、参数及回执合同。运行框架/真实端口仍需宿主提供。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

<Cmd>Mechanics.scala位于glue，函数束可替代无意义接口层；不得直接依赖ext实现形成循环。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖sharding/Repository接口、Protocol和运行配置；由handler调用，再由dispose分类。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实际寻址、返回码/超时/冲突分类，不能把Future完成等同业务提交。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`aggregate-repository-port`、`application-protocol`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
