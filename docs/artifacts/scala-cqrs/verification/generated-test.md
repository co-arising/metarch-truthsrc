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

## 版本与实例

本页按上述 profile 区分当前原生、保留/退役路径与手写参考；不跨 profile 传播实现或验收结论。完整来源 revision、摘要和生产链由目录、派生矩阵及 `sources.lock.json` 记录，本页不另抄暂定统计。

### 类别依赖

`independent-business-oracle`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
