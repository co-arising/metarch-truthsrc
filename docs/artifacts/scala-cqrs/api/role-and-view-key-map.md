# 命令角色与视图键映射

类别：`role-and-view-key-map`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将明确的权限/视图identity声明编译为端点可消费的表，避免controller各自推断。

## 输入与人工信息

角色许可、命令/视图键和字段来源由知识或技术设计显式声明；未知映射拒绝而非默认为管理员。

## 生产与所有权

- `bc-single` / `bc-multi`：BC `gen_api_controllers/index.mjs` 生成 CommandRoleMap/ViewKeys；`gen_api_layer.mjs` 仅是兼容入口。
- `js-legacy`：`api-dsl` 的 viewkeys 分支生成 ViewKeys；`auth-dsl` 独立生成较窄的角色要求表，不等同 CommandRoleMap 全套实现。
- `js-retired`：退役 `scala-cqrs-es-api` 有两个映射的实际 emitter；`js-legacy-scaffold` 则是 run-all 的 saga-only 静态 CommandRoleMap 复制，不能互相代记。
- 实际 fallback 必须保留：`auth-dsl.requires` 缺项返回 `Roles.User`，BC/di-poc `CommandRoleMap.of/ofCommand` 缺项返回 `Nil`。生成映射本身不证明未知权限会在运行时 fail-closed。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

CommandRoleMap/ViewKeys，可能是项目全局产物而不是某一聚合族。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

供HTTP授权、查询寻址和组合DSL消费；角色名不能替代真实鉴权主体，ViewKey不能为空默认。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

完整声明覆盖、缺映射/错误租户/身份参数及权限反例；全局产物不能在按族生成时静默遗漏。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
