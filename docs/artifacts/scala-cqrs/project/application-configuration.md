# 运行配置与资源引用

类别：`application-configuration`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载环境端口、数据库引用、journal、序列化和部署角色配置；配置不是已取得外部服务的证明。

## 输入与人工信息

引用名、限定版本和资源owner是可记录输入，凭据值只由实际环境提供，不写进truth/仓库/文档。

## 生产与所有权

- `bc-single` / `bc-multi`：配置来源是 BC scaffold 的复制/装配；`ProjectLayout.conf.application` 只是路径描述，不是 emitter。multi 的资源放置仍须与实际 build 核对。
- `js-formal`：`renderConfiguration` 生成 `Configuration.scala` 及其测试源码，`renderService` 生成 HOCON，`generate.mjs` 调整继承产物的 serialization 路径，最终由 `applyEntries` 写入。
- `bc-semantic-products`：独立 Scala `ProductServiceConfigurationTemplate` 与 `ProductServiceTemplate` 提供配置代码及 HOCON，不消费原生 JS 模板。
- `js-legacy` 是旧 run-all 配置路径的兼容参考；`js-legacy-scaffold` 是静态配置源码复制，不从业务事实推导配置。任何配置文件都不创建外部服务或自动完成 schema 初始化。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

conf/application/service/serialization/projection等配置与Test专用资源分离；root打包配置，库reference.conf提供默认合同。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

应用读取生成配置并验证必需值，unit test不得误读生产连接设置。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

缺值/错误命名空间/旧端口/未知version拒绝、配置分层与实际listener检查。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
