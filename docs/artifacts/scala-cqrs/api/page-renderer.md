# 页面renderer与客户操作视图

类别：`page-renderer`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

将已授权读模型呈现为客户/操作员页面并提供显式操作入口，不根据视觉状态制造交易终态。

## 输入与人工信息

页面信息架构、交互、错误/未知状态、响应式布局和文字需要产品设计及实现；后端profile不等完整前端自动生成。

## 生产与所有权

- `js-formal`：`render-service-pages.mjs` 生成可选 PageRenderer 接口、installed pin 检查及路由接线，不生成产品页面实现。
- `bank-p23`：`BankBrowserPages` 手写页面 shell、脚本和 render 行为；UI 成果归应用实现，不是生成器生成的前端。
- `bc-semantic-products`：独立 Scala `ProductServicePagesTemplate` 提供可选页面接口/接线，不使用 JS 页面模板，也不补出手写 renderer。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

PageRenderer端口、BankBrowserPages手写实现及Play controller/loader接线；静态教学知识图不是银行业务服务。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖服务查询/操作端口，界面轮询只读；权限/CSRF由真实服务验证。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

浏览器桌面/移动端、权限/未知结果/重复操作、无外部请求与真实业务流程；agent自动化不是真人可用性签收。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`query-service`、`service-contract`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `receipt-view`：Twirl SSR receipt table/empty state/next link, escaped text, same query and authorization; no browser-layout qualification.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
