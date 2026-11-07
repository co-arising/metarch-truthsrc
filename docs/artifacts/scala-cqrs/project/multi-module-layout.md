# 多模块布局与依赖方向

类别：`multi-module-layout`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在模块边界约束依赖，降低生成与扩展耦合。逻辑层次不等于必须拆成许多模块；当前di-poc已从历史细分收敛四模块。

## 输入与人工信息

应用模板选择、源根和产物放置由架构profile决定；不从包名或旧注释猜当前module。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`generated`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

kernel一库包内结构/接口/逻辑；glue依赖kernel；ext依赖kernel和glue；root依赖全部。proto位于glue，不照抄顶部旧注释的root位置。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel不依赖glue/ext，不含具体I/O；root唯一组合边界。BC targetModuleOf未登记kind会单模块回退，该差异需暴露。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实际build依赖、source inventory与FQN、port闭包、反向import和I/O黑名单；“glue无test目录”不是测试豁免。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bc-multi / di-poc。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `dipoc:build.sbt` — `dependsOn(kernel, glue)`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `targetModuleOf`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
