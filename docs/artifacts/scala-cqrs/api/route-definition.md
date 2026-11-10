# 路由定义与反向路由配置

类别：`route-definition`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把HTTP method/path关联到控制器/typed endpoint，含路径参数和必要页面路由；不是业务行为实现。

## 输入与人工信息

公开API版本、路径、方法、CSRF和受众为显式产品设计；目录退役不应把/api/v1改为v2。

## 生产与所有权

- `bc-single` / `bc-multi`：BC Scala `RoutesTemplate` 写初始路由块，BC Node `gen_api_controllers/index.mjs` 写 API 标记块；两者是不同写入步骤，`gen_api_layer.mjs` 只是兼容入口。
- `js-formal`：`renderService` / `renderPageLoader` 生成 Loader/Components 内嵌的 `Router.from` 与可选页面 alias 表，再经 `applyEntries` 写入；不是生成 `conf/routes`。
- `bc-semantic-products`：独立 Scala `ProductServiceTemplate` 生成服务 Loader 路由，不从原生 JS 模板派生。
- `js-legacy`：保留 `api-dsl` 的 route fragment/run-all 标记块；`js-retired`：退役 API 路由 emitter；`js-legacy-scaffold`：旧 scaffold/run-all 路由装配。它们的 routes 文件不能代表原生 Loader 输出。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

conf/routes或生成Service Components的匹配表；root Play承载路由编译。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖可用controller/loader和授权端口；共享MANUAL路由区不能被全量覆盖。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

路由解析/优先级/参数/反向路由、未授权与错误方法；跨模块路由目标应实际可编译。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`http-controller`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `http-routes`：Real Play routes compiler inputs with internally safe parameter bindings.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
