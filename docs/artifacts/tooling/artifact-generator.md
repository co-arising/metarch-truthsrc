# 产物生产器与模板

类别：`artifact-generator`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把已声明信息与架构规则确定性转成产物entries，是工具源码，不是每个业务仓必须复制的胶水。

## 输入与人工信息

明确输入schema、语义产品、producer版本、kind/deps/knowledge来源和目标profile；原始业务决策来自作者，不由模板猜。

## 生产与所有权

- `tooling`：JS/BC维护者手写实现loader、planner、builder、renderer和writer；这些工具不由业务真源生成，也不是每个应用的私有引擎。
- 普通JS `generate(ctx)`同步返回entries数组，每项含`path`、`content`、`kind`及可选来源/依赖信息；不是调用`ctx.emit`。`src/core/generate.mjs`的`plan`加载manifest、检查kind并比较两次返回值，`applyEntries`负责最终写入。
- 正式语义产品使用`planProductSet`及声明产品准入；`run-all` strict source分支和legacy直接emitter有各自输入/写入合同，不能因目录注册就视为同一种producer。
- `js-starter-copy`只指复制教学starter源码的reference用途，不证明业务生成能力。BC还须追到`writeArtifact`及pipeline实际apply/最后写者。

逐profile的生命周期、生产链和证据级别见派生的[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)；注册、定位producer、观察生成、编译、行为验证和最终批准分别判定。

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

机器目录按profile区分手写工具、派生输出及reference starter；完整变体见本页生产说明和派生矩阵。测试源码或注册入口存在不是生成、编译、行为验证证据，最终模板批准仍未授予，BC JavaScript输出不充当独立golden。

- `js:src/core/generate.mjs` — `plan`、`applyEntries`。
- `js:src/core/product-plan.mjs` — `planProductSet`。
- `js:src/core/manifest.mjs` — `loadManifest`。
- `js:generators/_template/generate.mjs` — `generate`。
- `js:generators/run-all.mjs` — `strictSourceEntries`。
- `js:generators/monarch-dsl/emit.mjs` — `writeFileSync(outPath, out)`。
- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/CQRSApplicationGenerator.scala` — `writeArtifact`。

来源revision、摘要及处置见[sources.lock.json](../sources.lock.json)；源码定位不是执行认证。

### 类别依赖

`artifact-manifest`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Pure target naming/structure contracts only; generator:null and no new manifest. 结构、兼容差异及资格见[目标合同](../scala-cqrs/TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
