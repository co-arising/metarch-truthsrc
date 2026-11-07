# 版本化Run定义与提交信封

类别：`run-definition-submission`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

冻结definition/version/codec和初始请求bytes，支持同RunId StartOrAttach，不因重启改计划。

## 输入与人工信息

RunId、definition ID/version、codecVersion、stage IDs和canonical initial state由宿主从稳定业务身份构建。

## 生产与所有权

- `monarch-r1`：库提供RunDefinition及RunProtocol.StartOrAttach/GetRun，应用拥有具体定义、初始状态和路由；此基线没有RunSubmission/RunSubmissionPort。
- `monarch-r2`：保留R1合同并增加RunSubmission不可变信封和RunSubmissionPort.ensure/query。具体信封、稳定身份与resolver仍属应用手写装配，未建立原生生成能力。
- P23的旧StartRun/Execution wrapper不是上述版本化提交API的采用证据，也不因R2源码存在自动迁移。

逐profile、来源和证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。接口存在不等具体业务实现已生成。

## 结构与命名

R1使用RunDefinition与RunProtocol.StartOrAttach/GetRun；R2新增RunSubmission及RunSubmissionPort.ensure/query，并由resolver稳定路由。提交信封不是R1既有类型，旧StartRun也不是该版本化API的别名。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

R1由应用固定definition/初始状态并用StartOrAttach附着同Run；R2交接方还须在发送前持久化不可变RunSubmission信封。恢复不得换Run身份，同ID不同fingerprint须拒绝，不能把提交端责任误记为库已替应用完成。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

版本/初始bytes冲突、重复attach不启动第二engine、缺结果/RecoveryBlocked与wire上限。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R1与R2的提交表面分开，不从当前R2源码反推R1已有RunSubmission。测试源码不等提交/恢复行为验证；P23冻结、银行未采用R2及最终批准边界不变。

- `monarch:src/main/scala/net/imadz/monarch/persistence/RunProtocol.scala` — `RunDefinition`、`StartOrAttach`、`GetRun`（R1起）。
- `monarch:src/main/scala/net/imadz/monarch/persistence/RunSubmission.scala` — `RunSubmission`、`RunSubmissionPort`（R2增加）。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；库类型不是具体业务producer。

### 类别依赖

`monarch-state-codec`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
