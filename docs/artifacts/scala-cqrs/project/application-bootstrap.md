# 应用启动装配

类别：`application-bootstrap`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

按依赖顺序初始化聚合/投影/服务组件并提供失败清理，不在bootstrap补领域规则。

## 输入与人工信息

实例/依赖、生命周期、配置、port与角色选择来自技术合同。框架extension顺序应验证，不把固定sleep当永恒保证。

## 生产与所有权

- `bc-single`：BC `ApplicationBootstrapTemplate` 生成应用启动接线。
- `bc-multi`：BC 按 bootstrap kind 放入 glue；di-poc root 的手写 `BootstrapModule` 是另一层安装代码，不是该生成器。
- `js-formal`：`renderService` 生成 `ApplicationBootstrap`，核对 Factory/Composition 的安装 pin 并装配生命周期。实际 Factory/Composition 实现及资源所有权由应用提供。
- `js-legacy`：保留 `bootstrap-dsl` 的应用接线；`js-retired`：退役 `scala-cqrs-es` 的旧装配。不能把两者的集群启动机制归给原生服务。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

glue ApplicationBootstrap与root BootstrapModule/runner分离；JS服务Bootstrap核Factory/Composition pin与失败清理。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖Factory/Repository接口和实际adapter，领域核心不能反向调用root初始化。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

缺依赖/重复注册/失败释放、初始化前置与关闭排空，单元配置和服务配置不混用。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`aggregate-bootstrap`、`projection-bootstrap`、`port-binding-module`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
