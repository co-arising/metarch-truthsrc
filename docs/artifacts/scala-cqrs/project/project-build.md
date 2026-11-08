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

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Three distinct generated build shapes; direct Scala compilation and actual sbt execution must remain separate; no automatic build behavior evidence.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/build.mjs#buildArtifacts`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 构建定义生成、直接编译与实际 sbt 执行分别记录，不从领域行为测试给 build 文件自动晋升。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。本族使用自己的build模板，而非机械改family1路径：3份build含Scala 2.13.14、Akka 2.6.20、ScalaPB 0.11.14、ScalaTest 3.2.15、protoc 3.21.9与sbt 1.4.9。三份构建定义已有complete-plan generated观察，仍无build compiled/behavior-verified资格；直接compiler通过不代表执行sbt。

本页登记的物理输出为 `build.sbt`、`project/build.properties`、`project/plugins.sbt`。实际来源为 `generators/scala-cqrs-aggregate-core-v1/templates/build.mjs#buildArtifacts`；`generators/scala-cqrs-aggregate-core-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族构建/布局已取得complete-plan generated观察；三份build定义不在同样例源码compiled/behavior-verified资格中，不证明实际sbt执行，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Independent Scala 2.13.14 reference build and explicit offline direct-compiler runner. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。

### 第五批有限module-seams候选

两个build条目声明四模块及已捕获外置绝对源根；项目移址后重新capture/generate。direct Scala compiler通过不等于sbt已执行。 该显式产品链与旧BC/legacy/ref-only变体并存，不互相继承资格。生成源码经唯一writer回锚；外置实现仅独立file级来源，不能认证任意symbol/span。完整说明见[有限多模块接缝](../MODULE-SEAMS.md)。
