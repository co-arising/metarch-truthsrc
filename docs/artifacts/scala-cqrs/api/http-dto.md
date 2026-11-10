# HTTP请求与响应DTO

类别：`http-dto`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义外部HTTP表示及严格JSON转换，与领域值、事件及持久化PO分开。

## 输入与人工信息

字段、optional/default、分页、精确数值和错误体由接口合同决定；不能把领域primitive Double直接暴露为Money。

## 生产与所有权

- `bc-single` / `bc-multi`：BC API 后处理的 `index.mjs → tpl_controller/tpl_views` 生成 Req 伴生对象与 ViewWrites；multi 路径/构建问题仍需独立核验。
- `js-legacy`：`api-dsl` 生成请求载体；`js-retired`：退役 `scala-cqrs-es-api` 另有 ViewWrites 等输出，不能把 BC 模板记作 JS 来源。
- `bank-p23`：`BankServiceJson` 是手写 JSON 边界实现。
- 原生 `js-formal` 服务消费外部安装的 Reads/Writes；仅有 typed Endpoint 不建立服务专用 DTO/codec 生成能力，也不证明严格 JSON 或精确金额转换。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

controllers/vo/*Reqs或generated domain.values中的具名边界载体；类型命名可共享词汇但wire字段由独立合同固定。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

由Controller解码后调用应用port，向客户端返回DTO而非ActorRef/内部state；编码实现可手写注入。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

JSON读写、缺字段/额外字段/重复键、可选字段向后兼容与精确金额。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `api-dto`：Pure typed command DTOs, results, failures and keyset query carriers.
- `http-codec`：Strict JSON/UTF-8/Long-string codecs, exact event outputs, resource-bound canonical keyset cursors.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
