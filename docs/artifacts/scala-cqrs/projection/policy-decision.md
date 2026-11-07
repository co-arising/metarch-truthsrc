# 反应式策略纯决策

类别：`policy-decision`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

根据已发生事件计算后续命令，并对执行回执给出显式处置。它不同于InvariantRule的命令前校验，不能把两者文档混配。

## 输入与人工信息

trigger、target、参数血缘、幂等键、dispose白名单/错误分类为真实决策输入；不因targetAggregate存在就认定executionSide。

## 生产与所有权

- `bc-single` / `bc-multi`：当前 BC Node `rules_domain_gen` 生成分组 domain/policy 的 `on(event)` 决策；`gen_policy_exec.mjs` 另生成 `<Cmd>Policy.decide/dispose` 执行侧 wrapper，后者委托前者，不独占整条决策生产链。
- BC `PolicyBuilder/PolicyTemplate` 源码仍在，但 `CQRSApplicationGenerator.generateDomainLayer` 中的分派已注释，属于退役/参考路径，不能记为当前 Scala policy producer。
- `js-legacy`：`policy-dsl/emit` 提供领域决策，`policyexec.mjs` 的 `policyFile` 提供执行 wrapper，run-all 写入。
- `js-retired`：退役 `scala-cqrs-es-policy-exec` 是另一路径。执行侧生成仍要求 `executionSide` 与可解析签名；尚未确立原生服务 policy producer。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

旧BC domain/policy骨架与当前kernel application/projection/policy/<Cmd>Policy的decide/dispose纯函数是不同版本；单个kind policy-exec可覆盖多职责。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel只保留纯函数与数据；decode/execute机制在glue，通过唯一PolicyMachine装配；不要重新注入一套无必要effect类。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

触发/非触发、目标参数、永久/暂时失败及幂等政策；未声明不发命令。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`domain-protocol`、`rule-parameters`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
