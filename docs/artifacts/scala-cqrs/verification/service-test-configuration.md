# 服务测试配置与隔离支持

类别：`service-test-configuration`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

建立unit/testkit环境与只允许固定suite的runner，避免单元测试意外启动生产服务或连接真实数据。

## 输入与人工信息

明确Test配置、source roots、网络/写入策略和suite集合，不能静默继承service.conf。

## 生产与所有权

- `js-formal`：`renderTestSupport` 返回 unit 配置/支持源码，服务 `generate.mjs` 调整 build/test 任务，公共写入器落盘。
- `bc-semantic-products`：独立 Scala `ProductServiceTestTemplate` 与 `ProductServiceTemplate.build/isolateTests` 提供其配置、runner 与任务，不由 JS 模板代产。
- `js-retired`：退役 rules 的测试 builder 保留固定 shared test configuration，不能归作当前原生服务能力。
- 配置、runner 和测试源均是生成代码/测试基础设施（generate-code），不是 derive-evidence。生成器侧门或源码检查通过也不是目标 Scala suite 的执行结果。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

service-unit.conf、UnitConfigurationCheck、UnitTestMain、GeneratedUnitStorageSpec；生产配置另生成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

编译与测试执行分开，testOnly受限是profile纪律，不得绕过runner拼接全测试目录。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

错误配置/网络连接拒绝、suite集合核验、fork进程结束状态和未授权资源写入反例。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
