# 产物生产器与模板

类别：`artifact-generator`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把已声明信息与架构规则确定性转成产物entries，是工具源码，不是每个业务仓必须复制的胶水。

## 输入与人工信息

明确输入schema、语义产品、producer版本、kind/deps/knowledge来源和目标profile；原始业务决策来自作者，不由模板猜。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

普通generate(ctx)与正式planProductSet、legacy直接emit有不同准入合同；注册入口与未注册片段分别记录。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

Builder只建结构，Template渲染文本，公共writer处理文件/锚/ledger；BC完整输出还包含JS最终写者，不能只看CodegenMain第一步。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

确定性、完整输入、未知能力拒绝、路径/依赖/全producer覆盖和对独立golden的比较。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：tooling。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `js:src/core/product-plan.mjs` — `planProductSet`。
- `js:src/core/manifest.mjs` — `loadManifest`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `writeArtifact`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`artifact-manifest`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
