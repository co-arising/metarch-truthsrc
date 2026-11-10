# 运行资源所有者与目录

类别：`runtime-owner`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

管理当前宿主创建的actor/连接/TA worker生命周期及业务身份到运行引用的映射。不允许按端口或名称杀未知资源。

## 输入与人工信息

单writer、namespace、spawn/close、原身份与当前owner输入必须明确；内存cache不是恢复权威。

## 生产与所有权

- `bank-p23`：`BankRuntime`、目录与清理组件属于银行手写宿主。即使其消费生成的本地 Repository/Bootstrap，实际 spawn、资源归属及释放责任仍不转给生成器。
- 成功 spawn 的内存缓存不是持久业务真源，也不证明跨 JVM 恢复。R2 库的有限宿主能力不能直接记为银行当前 owner 实现。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

BankRuntime/BankRuntimeDirectory及ResourceCleanup；R2 WorkflowHost是库提供的有限宿主，不能直接等同当前银行owner。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

组合生成Repository/Bootstrap与手写适配；只清理自身资源，不删除journal或用空数据库冒恢复。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

部分创建失败、关闭重复、同ID异正文、恢复与停机后的资源检查；业务终态与资源停止分开。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`aggregate-repository-implementation`、`saga-invocation-host`、`application-configuration`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `resource-directory`：Explicit bounded resource/PID/envelope-resource association, shared by command and journal adapters.
- `application-lifecycle`：Immediate resource registration, reverse cleanup, independent cleanup workers and one fixed close deadline; incomplete cleanup remains failed.
- `application-root`：Complete finite assembly of actor runtime, repository, journal source, readside runner and API services; Play owns HTTP runtime.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
