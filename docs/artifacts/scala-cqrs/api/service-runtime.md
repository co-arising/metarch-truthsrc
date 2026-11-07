# 服务Loader与生命周期装配

类别：`service-runtime`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

从应用上下文建立服务组合、路由和资源生命周期，不复制领域、Saga或Monarch运行内核。

## 输入与人工信息

Factory限定名、pin、完整配置、HTTP绑定及owner策略显式提供。

## 生产与所有权

- `js-formal`：`renderService` 生成 Loader/Components，并将启动过程拆到 `ApplicationBootstrap`；配置代码由独立 `renderConfiguration` 阶段提供，公共 `applyEntries` 负责落盘。
- `bc-semantic-products`：独立 Scala `ProductServiceBuilder/ProductServiceTemplate` 把 Factory 启动放在 Loader 中；配置由 `ProductServiceConfigurationTemplate` 提供，不照抄 JS 文件拆分。
- 两者生成的是安装、路由和生命周期接线。实际 Factory/Composition 与资源 owner 由应用提供，不能由 pin/ready/close 代码的存在推定业务或资源行为已验收。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

<Name>Loader/Components和ApplicationBootstrap；single Play root是当前银行形态，不自动拥有di-poc四模块结构。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

factory生成或手写实现按profile安装，startup/shutdown需完整清理；127.0.0.1和资源租约是单独运行门。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

反射/实现pin/初始化顺序、失败释放、实际HTTP监听与停止；编译通过不证明人工会话已运行。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`service-contract`、`application-bootstrap`、`application-configuration`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
