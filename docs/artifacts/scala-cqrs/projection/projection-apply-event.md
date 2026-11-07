# 读侧纯状态变换

类别：`projection-apply-event`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把领域事件与旧读模型映射为新读模型或更新指令。它是投影中的纯部分，不拥有数据库事务/连接。

## 输入与人工信息

字段血缘、identity、create/updateOnly/delete、时间戳零值和空值容忍语义由合同决定。不能把严格decode前置后改变旧业务守卫含义。

## 生产与所有权

- `bc-single`：不生成独立纯 ApplyEvent 产物。`ProjectionBuilder` 仅在 `codegen.multiProject=true` 时填充 applyEvents，生成器仅在该集合非空时输出；single handler 内的更新代码不是这个独立产物。
- `bc-multi`：BC `ProjectionBuilder → ProjectionApplyEventTemplate` 生成纯变换，和 glue 的解码/存储机制分开。
- `js-formal`：原生 `render-journal-domain.mjs` 的 `renderJournalDomain` 才是纯函数 producer，公共写入器落盘；`viewrepo.mjs` 生成仓储，不是纯 ApplyEvent。
- legacy `smviews` 的内联变换属于 handler 机制，不能新增记作独立纯文件生成能力。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

<View>ApplyEvent或按族合并的纯函数；与PO decode和Repository执行分离，业务字段命名遵循真实类型，不添加临时技术别名污染统一语言。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel纯函数只依赖领域Event/Row，glue ViewMachine读取旧行并执行写入。查无行时是否创建是显式规则。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

create与updateOnly两形、墓碑、复合键和存量脏数据容忍案例；纯函数测试不等真实投影事务验收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`read-model`、`domain-protocol`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
