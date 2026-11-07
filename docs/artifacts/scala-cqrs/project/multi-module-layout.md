# 多模块布局与依赖方向

类别：`multi-module-layout`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在模块边界约束依赖，降低生成与扩展耦合。逻辑层次不等于必须拆成许多模块；当前di-poc已从历史细分收敛四模块。

## 输入与人工信息

应用模板选择、源根和产物放置由架构profile决定；不从包名或旧注释猜当前module。

## 生产与所有权

- `bc-multi`：`targetModuleOf` 和 scaffold relocation 提供部分源码放置能力，不是完整多模块项目生成。复制的 `build.sbt` 只声明 root，未补齐 kernel/glue 等模块定义。
- `di-poc`：kernel/glue/ext/root 四模块是已有手写构建参考，不能归功于 BC 的布局开关。
- BC API 读取路径含 `modules/kernel/src/main/scala/app/...`，投影 handler/converter 后处理路径含 `modules/glue/src/main/scala/app/...`；Scala 生成器实际写到 `modules/{kernel,glue}/src/main/scala/<pkg>/...`。源码放置、台账路径和后处理读写路径必须分别核对。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

kernel一库包内结构/接口/逻辑；glue依赖kernel；ext依赖kernel和glue；root依赖全部。proto位于glue，不照抄顶部旧注释的root位置。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel不依赖glue/ext，不含具体I/O；root唯一组合边界。BC targetModuleOf未登记kind会单模块回退，该差异需暴露。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实际build依赖、source inventory与FQN、port闭包、反向import和I/O黑名单；“glue无test目录”不是测试豁免。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Finite two-module kernel/glue source roots and root build aggregation, not the full kernel/glue/ext/root application or its composition root.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/build.mjs#buildArtifacts`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 构建定义生成、直接编译与实际 sbt 执行分别记录，不从领域行为测试给 build 文件自动晋升。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Explicit kernel/glue/ext/root dependency graph and separate source roots; no generator integration. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
