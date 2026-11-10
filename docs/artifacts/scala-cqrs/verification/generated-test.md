# 生成的合同与结构测试

类别：`generated-test`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

验证已声明规则、结构和生成接线；不能让实现和测试从同一错误推导互相证明业务正确。

## 输入与人工信息

测试场景/预期必须来自独立业务oracle或明确合同；生成断言需标明其覆盖范围。

## 生产与所有权

- `bc-single`：BC Node `tdd_test_gen.mjs` 及相关脚本生成测试代码，可明确记录 SKIP 或产生部分 suite。
- `bc-multi`：脚本仍使用 root `test/` 并解析既有源码路径，不能由共享类别推断多模块测试集成。
- `js-formal`：原生服务及其 domain/application 生产链生成合同/结构测试；`js-formal-subproducer` 仅标识 domain scaffold/verification 的较窄来源，不是另一份独立验收。
- `bc-semantic-products`：独立 Scala ProductVerification、host/execution/effect/service 测试模板生成相应测试代码。
- `js-legacy` 保留兼容参考，`js-retired` 对应退役 rules/projection/repository 测试 emitter；`js-run-all-strict` 生成有条件的安全测试与证据夹具源码。
- 所有上述生成输出都是代码（generate-code），包括名称含 evidence 的 fixture；未执行就不是证据。同模型推导出的实现与测试也不是相互独立的业务 oracle。

逐 profile 的生命周期、生产链与证据层级见[派生能力矩阵](../../CAPABILITY-MATRIX.md)。可用源码、生成接线、目标编译、行为验证和最终批准不是同一声明。

## 结构与命名

Generated*Spec、RulesSpec、ExecutableSpec及辅助runner；不是应用main产物，Test资源/源码根显式分离。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

遵循固定testkit/网络隔离和显式suite准入，不全仓挂载未知测试；Scala编译和真正测试执行分别记录。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

既验证正确生成也测试缺前提/篡改反例、测试发现清单、退出状态和执行数；跳过不算通过。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Generated empty-state protobuf-byte roundtrip test source; shared-model assertions are not the independent external oracle or an execution receipt.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/generated-tests.mjs#generatedTestArtifacts`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。输出包含两个目录：glue/src/test/.../infrastructure/serialization/*RoundTripSpec.scala复用family1真实PB空State往返；glue/src/test/.../domain/invariant/*ReplaySpec.scala由本族模板生成。主Warehouse具体文件为WarehouseStateRoundTripSpec.scala及WarehouseAggregateReplaySpec.scala；后者只有literal用例“empty event history preserves the explicitly declared initial state”。两个生成测试不是独立oracle，也不证明非空fold/业务决策。

本页登记的物理输出为 `modules/glue/src/test/scala/**/infrastructure/serialization/*RoundTripSpec.scala`、`modules/glue/src/test/scala/**/domain/invariant/*ReplaySpec.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/generated-tests.mjs#generatedTestsTemplate`；`generators/scala-cqrs-aggregate-core-v1/templates/generated-tests.mjs#generatedBehaviorTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`；`generators/scala-cqrs-aggregate-core-v1/templates/generated-tests.mjs#generatedBehaviorArtifacts`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`independent-business-oracle`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第五批有限module-seams候选

两形状suite放context.verification包，联合检查生产/手写/support名称和路径；业务同短名仍合法。形状测试不是原34例独立业务oracle，计数和资格分开。 该显式产品链与旧BC/legacy/ref-only变体并存，不互相继承资格。生成源码经唯一writer回锚；外置实现仅独立file级来源，不能认证任意symbol/span。完整说明见[有限多模块接缝](../MODULE-SEAMS.md)。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `generated-test`／`generated-test`：Three generated ScalaTest source responsibilities: inherited real-PB empty-state byte roundtrip, inherited empty typed-event-history replay baseline, and finite persistence-frame empty-state roundtrip/unknown-version smoke tests. Independent nonempty/JDBC oracle remains separate; source presence is not execution. 路径 `modules/glue/src/test/scala/**/infrastructure/serialization/*RoundTripSpec.scala`、`modules/glue/src/test/scala/**/domain/invariant/*ReplaySpec.scala`、`modules/glue/src/test/scala/**/infrastructure/persistence/*RoundTripSpec.scala`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第八批有限 Play 应用入口

新增 `js-play-application-candidate-v1`，由 `scala-cqrs-play-application-v1` 提供。原先profile的缺口描述保留为对应历史，不覆盖本段的新有限入口。

- `generated-test`：Three inherited domain/persistence smoke suites and one strict HTTP JSON codec suite; independent application oracle is separate.

唯一作者和显式技术/外置实现bindings经过公共单writer；源码、真实编译、HTTP行为、安装与最终批准逐层记证。有限范围及不适用项见[本族合同](../PLAY-APPLICATION.md)；旧回执不重签，不表示银行或完整modular target已最终批准。
