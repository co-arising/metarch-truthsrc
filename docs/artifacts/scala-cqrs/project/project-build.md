# 工程构建与依赖配置

类别：`project-build`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义编译/测试源码根、插件、框架依赖、模块和打包。构建文件是技术产物，不是手工解决生成错误的补丁入口。

## 输入与人工信息

JDK/Scala/Play版本、完整runtime artifact pin、源根、模块布局和隔离测试模式必须明确；不能只改版本号宣称语义升级。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`generated`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

build.sbt、project/build.properties、plugins.sbt；单模块app与多模块modules/*/src/main/scala分别配置。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

库按发布制品消费，不自动引用sibling源码；固定P23/R1/R2不可覆盖。ScalaPB managed sources单独统计。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

真实源码根/classpath/版本、独立干净供给和实际编译；staging绿不能代替真实目标仓。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bc-single / bc-multi / js-formal。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `dipoc:build.sbt` — `dependsOn(kernel, glue)`。
- `js:generators/scala-cqrs-application/render-build.mjs` — `applicationBuild`。
- `js:generators/scala-cqrs-play-service/generate.mjs` — `externalSourceRoots`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
