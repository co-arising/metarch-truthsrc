# HTTP过滤器与健康端点

类别：`http-observability`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

提供请求日志、审计和健康/readiness观察，不能作为业务认证或隐藏恢复重试入口。

## 输入与人工信息

可记录字段、脱敏、关联身份、健康与readiness的分别定义由运行规范提供。

## 生产与所有权

- `bc-multi`：这里只登记已检查应用的参考实例，不是 BC 生成器的健康端点承诺。
- `di-poc`：过滤器是手写实现参考，`HealthController` 有现存具体源码。其旧生成头不足以确立原始 producer；历史归属仍未建立，按 source-copy/reference-only 边界解释，不能说没有代码。
- `js-legacy`：退役 API 的 `options.retiredControllers` 可把调用方提供的源码原样返回为 support-controller，再由通用写入器落盘。这是源码复制/参考路径，不是原生 observability 行为生成。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

LoggingFilter/CommandAuditFilter/HealthController位于root；correlation信息不包含凭据或原始敏感请求。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖HTTP壳和受控观测端口；liveness不代表数据库/投影caught-up，健康探测不触发资金效果。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

日志秘密遮蔽、响应头/错误观测、未ready状态；过滤器不能吞业务失败改为成功。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
