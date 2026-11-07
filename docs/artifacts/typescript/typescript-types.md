# TypeScript类型声明

类别：`typescript-types`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为TypeScript消费者声明领域或边界类型，避免把整个artifact目录仅限Scala而漏普通generator。

## 输入与人工信息

字段/名义类型/optional和来源由该独立spec提供；不自动赋予运行验证或业务行为。

## 生产与所有权

- `js-ordinary`：独立 `ts-types/emit.mjs` 是当前普通 TypeScript emitter，从 definitions/fields 输出接口文本，不属于原生 Scala 服务 profile。
- `js-legacy` 是旧目录分类的兼容参考，不代表第二套更强的 TS producer。
- 当前实现只做 primitive 类型映射：integer/long/timestamp/number 映射到 JavaScript `number`，未知类型回退为 `string`；忽略 optional/default/nominal 语义，不生成运行时 JSON validator，也不提供精确金额或大整数保证。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

独立ts-types emitter输出TypeScript文本，旧式直接emit与正式Scala product profile不同；TS命名按语言目标规则。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

上游spec和实际消费者约定须一致，不因类型可编译就认为JSON/金额精确转换已认证。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

类型字段/optional/命名和golden对账、unknown类型拒绝；没有执行证据不称客户端运行可用。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
