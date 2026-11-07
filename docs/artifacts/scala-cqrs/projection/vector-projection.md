# 向量检索与嵌入适配

类别：`vector-projection`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

为查询建立嵌入向量与相似检索读侧；不是领域事务、身份裁决或正确性的替代。

## 输入与人工信息

模型/维度/版本、输入内容、权限过滤和更新策略由技术绑定选择；不能给模型输出冒确定性业务含义。

## 生产与所有权

- `bc-single` / `bc-multi`：BC `ProjectionRepositoryBuilder.buildVector`、`ProjectionRepositoryImplBuilder.buildVector`、handler 重写器与 vector API 模板提供实际代码/委托；pgvector DDL 只是其中的 schema，不等于完整向量投影。
- `js-legacy`：`viewrepo` / `smviews` 对 `storage.kind=vector` 有实际输出；`vectorBodies` 生成对 PgVectorStore/OllamaEmbeddingClient 的调用，不生成外部存储、模型或服务。
- `js-retired`：退役 projection 存储分支、API 的 VectorSearchApiController 和 DDL 的 pgvector schema 是独立旧生产链。
- 真实存储/driver/嵌入实现由外部或手写适配提供。尚未确立原生通用 vector producer；委托源码存在不意味着服务、查询权限或检索行为已验证。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

pgvector DDL、PgVectorStore和OllamaEmbeddingClient等分别是模式与I/O适配；网络客户端不应放kernel。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

依赖外部模型/存储，由glue执行，服务端查询仍需权限与新鲜度边界；本地基础CLI不需要这些服务。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

维度/版本漂移、隔离过滤、重建与不可用降级；相似命中不证明同一知识身份。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。
