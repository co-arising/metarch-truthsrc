# 端口签名类型闭包

类别：`signature-value-closure`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

规定端口输入输出及递归引用的领域值必须在接口可依赖模块中可见的架构义务。kernel-vo指这种放置变体，不是新的复制业务类型；本类别名称不代表闭包已经被检查证明。

## 输入与人工信息

应以真实方法签名与字段引用递归构造待核对的类型集合，分别处置外部框架类型和业务类型，不能只检查首层字段。这是所需检查输入和义务，不是宣称现有portDecls已经执行了递归算法或输出闭包证明。

## 生产与所有权

本类别是已有VO/port上的放置与装配义务，不是额外生成一套VO，也不是已经执行并产出结果的证据artifact。BC多模块的targetModuleOf负责VO放置，rules_domain_gen.mjs#portDecls负责签名和受限imports；两者都不能证明通用递归签名闭包已检查。原始Repository模板仍可带kernel到glue的@ImplementedBy，更不能由模块标签宣告闭包完成。

di-poc的FlowPorts/IdentityStoreApi展示EnrichedCaptureNote、UserDoc等接口载体同置kernel，但TenantCtx、OkReceipt、ApiError、CaptureNoteReq等可达类型还需独立递归核查；几个文件实例不是全应用证明。

各profile记录的是部分放置/接线责任与未证明的闭包缺口，见[能力矩阵](../../CAPABILITY-MATRIX.md)。本轮不新增或冒充闭包检查器，不把源码扫描说成生成、跨模块编译或最终批准。

## 结构与命名

纯VO/请求载体及EnrichedCaptureNote可在kernel包内结构/接口层。不要为跨模块复制同名VO形成两个schema。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

kernel接口不能指向ext/glue具体类型；必要的boundary DTO需显式定义并解释与领域对象关系。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

递归可达类型、跨模块编译及缺类型反例；仅看文件路径不证明依赖纯净。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

### 第三批有限 domain-kernel 候选

`js-domain-kernel-candidate-v1`（实际入口 `scala-cqrs-domain-kernel-v1`，manifest `scala-cqrs-domain-kernel:1`）为显式选择的有限实现；不切换旧入口或银行消费。Finite resolved signature value placement/dependencies share existing kernel definitions. No duplicate closure artifact and no complete modular port/bridge family.

实际来源为 `generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`；结构经 `buildModels`／`serializationModel`、有限 `render` 与逐职责模板，`sourceEntry` 记录来源，最终写入仍由 `src/core/generate.mjs#applyEntries` 承担。共享输出不重复算文件；完整范围见[有限合同](../DOMAIN-KERNEL.md)。

`implemented` 只表示上述代码确实存在。此登记阶段没有刷新观察或 source lock／coverage／矩阵，也没有编译、独立行为或最终审定通过声明；`approval:null`。真实证据必须绑定同一输入、全套最终产物字节及冻结工具指纹。 既有第二批14项 reference-only 资格不变；稳定外置 source 映射不恢复 inline `@knowledge`。

### 第四批有限 aggregate-core 候选（当前登记，非验收）

`js-aggregate-core-candidate-v1` 对应实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。复用单份kernel值/协议/Params/Computations闭包与完整deps；闭包职责不再生成同名VO文件。本族Actor-specific Repository留在glue，不冒family3 runtime-neutral业务port。

本页登记的物理输出为 `modules/kernel/src/main/scala/**/domain/values/*.scala`、`modules/kernel/src/main/scala/**/domain/*.scala`、`modules/kernel/src/main/scala/**/domain/ports/*.scala`、`modules/kernel/src/main/scala/**/domain/invariant/params/*.scala`。实际来源为 `generators/scala-cqrs-domain-kernel-v1/templates/values.mjs#valueTemplate`；`generators/scala-cqrs-domain-kernel-v1/templates/protocol.mjs#protocolTemplate`；`generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#computationsTemplate`；`generators/scala-cqrs-domain-kernel-v1/templates/params.mjs#paramsTemplate`；`generators/scala-cqrs-domain-kernel-v1/build-models.mjs#buildModels`。新入口组合复用的family1生产jobs和本族jobs，经 `generators/scala-cqrs-domain-kernel-v1/render.mjs#renderJobs` 与固定 `entry.mjs#aggregateSourceEntry` owner，最后由 `src/core/generate.mjs#applyEntries` 写入；复用指向原物理模板，不存在新族VO/PB复制模板。

冻结工具/来源指纹下，catalog当前实际登记20份观察（原12份样例generated；family1/family2各1份complete-plan generated及3份同样例源码generated/compiled/behavior-verified）。本页本族源码已取得同一Warehouse样例的generated、compiled、behavior-verified资格，包含实际生成的支持测试；只证明该冻结输入与最终产物字节，不推广至全profile，final-approved=0。原16条观察及74条变体引用已原样保入[历史索引](../../evidence/capability-domain-kernel-final-history.json)，原receipt路径/字节不动、不续签，其旧锁下的资格不算current；初/二/三批原验收仍保留。两类build只取得generated资格，不借源码编译/行为回执晋升。有限范围见[本族合同](../AGGREGATE-CORE.md)；无Bank、外部结果桥、完整四模块/服务或最终批准。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-multi的VO/port放置与di-poc维护的kernel签名载体。它们支撑部分放置/接线描述，不支撑已执行递归检查或独立闭包证据artifact的宣称。

- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/application/FlowPorts.scala` — `EnrichedCaptureNote`。
- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/infrastructure/auth/IdentityStoreApi.scala` — `UserDoc / IdentityStoreApi`。
- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `portDecls`，不是递归闭包证明器。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`value-object`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Recursive value/sum/container signature closure and explicit module ownership for this finite candidate. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。

### 第五批有限module-seams候选

从真实作者port方法、参数、结果递归展开有限签名闭包，复用唯一值定义；不生成第二套VO，不把closure本身算额外物理文件。 该显式产品链与旧BC/legacy/ref-only变体并存，不互相继承资格。生成源码经唯一writer回锚；外置实现仅独立file级来源，不能认证任意symbol/span。完整说明见[有限多模块接缝](../MODULE-SEAMS.md)。
