# 工程构建与依赖配置

类别：`project-build`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

定义编译/测试源码根、插件、框架依赖、模块和打包。构建文件是技术产物，不是手工解决生成错误的补丁入口。

## 输入与人工信息

JDK/Scala/Play版本、完整runtime artifact pin、源根、模块布局和隔离测试模式必须明确；不能只改版本号宣称语义升级。

## 生产与所有权

- `bc-single`：`CodegenMain.run → FileSystem.copyDirectory` 复制 BC `scaffold/build.sbt` 等构建文件；di-poc 的 build 不是此生成器的模板。
- `bc-multi`：源码可放入 kernel/glue，但复制的 build 仍只声明 root，属于不完整构建支持，不能称已生成 di-poc 四模块项目。
- `js-formal`：应用 build renderer 与服务 `generate.mjs` 组合构建文件、外部源码根和测试任务，由公共写入器落盘。
- `bc-semantic-products`：独立 Scala ProductBuild/ProductHostSupport 与 `ProductServiceTemplate.build` 负责其构建，不是 JS 产物复制。
- `js-legacy` 是旧 run-all 构建路径的兼容参考，`js-legacy-scaffold` 是静态 build/plugin 复制；`js-formal-subproducer` 指 domain scaffold 的较窄构建来源，不等于完整服务 profile。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

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

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Independent Scala 2.13.14 reference build and explicit offline direct-compiler runner. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
