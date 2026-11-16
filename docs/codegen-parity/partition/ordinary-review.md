# ordinary-review 逻辑制品分区规格

状态：`content-specification`。机器合同为 [ordinary-review.json](ordinary-review.json)。只覆盖 `teaching-template`、`ts-types`、`product-design-review`，不授予生产修改、生成或运行许可。

## 1. 范围与计数

| 项目 | 数量与含义 |
|---|---|
| producer | 3 |
| catalog producer-output 合同 | 12，逐条有 `catalogCoverage` 与精确 `catalogRefs` |
| 逻辑条目 | 16：A=0，B=16 |
| 有 catalog 对应的逻辑条目 | 13；两个共享核心回执去重，project-evidence 拆为四种职责 |
| 额外逻辑条目 | 3：TS 中间 spec、项目知识库、共享 pipeline 队列清单 |
| 未列入本组合同的真实写出记录 | 4；另一个是 anchors 原子提交临时文件，属于既有 anchor 条目，不另增逻辑制品 |
| 未覆盖 catalog 合同 | 0 |
| 补充只读资料 | 4 个 `extraSources`；未复制进 baseline |

这里的 12 不是物理文件数。一次正式设计评审计划包含 **7 个 renderer entries**：模型 JSON、五张平面图、来源索引。项目 wrapper 再加四种证据；实际 apply 还有共享回执、项目图副作用。源码路径和条件只能证明可达性，不能证明这一次写出了任何文件。

A=0 是内容判断，不是因为文件后缀不是 Scala。教学摘要没有 State/Events 实现；复制的 JS 是生成器作者起点；TS 只有结构载荷；设计模型、图和来源索引没有应用行为；回执、派生输入、存储和队列有独立基础设施职责。没有把糟糕的 Entity/Actor/Repository 实现移到 B，也没有把名字含 Command 的接口冒充 Actor 协议。

传统 Scala 基准仍是 `scala-artifacts.json` 的 **39 族＋单列 3 扩展**。本组未使用 `template/products/*` 充当金样，未伪造 Scala 缺项；缺项由集成者跨组反查。

## 2. 入口、注册与银行消费必须分开

### teaching-template

- catalog ID 是 `teaching-template`，普通 manifest 的真实 `name` 是 `_template`，没有 version，普通 apply 默认 generator version 为 `unknown`。
- [generate.mjs:1–16](../baseline/js/generators/_template/generate.mjs) 接受 canonical，返回摘要 entries；普通核心 [plan:23–43](../baseline/js/src/core/generate.mjs) 实际装载并进行两次一致性比较。
- [CLI:304–315](../baseline/js/bin/truthsrc.js) 的 `init-generator` 是**独立复制通道**，复制 `generate.mjs` 和 `generator.json`，随后改写 manifest 名称；不会调用生成器，不会附加 ledger/anchors。
- `init-generator` 当前使用 recursive mkdir 和默认 copy 覆盖；它并不具备“目标已存在就拒绝”的保护。此事实不是本阶段覆盖许可。

### ts-types

- [emit.mjs:1–14](../baseline/js/generators/ts-types/emit.mjs) 与 [parse.mjs:1–16](../baseline/js/generators/ts-types/parse.mjs) 都有真实顶层 CLI 和 `writeFileSync`。
- **统一普通入口缺接线，但 emitter 并非不存在。** [manifest](../baseline/js/generators/ts-types/generator.json) 仅声明 `name/version/baseline/entrypoint/golden`；[loadManifest:15–22](../baseline/js/src/core/manifest.mjs) 还要求 `inputSchema/products/artifactKinds/output`，而普通核心固定导入 `generate.mjs`，不读取 `entrypoint=emit.mjs`。
- 因此 `typescript-types` 的 catalog `channel=manifest` 保留不改，`declarationStatus=implemented` 指真实直接发射器存在；JSON 另明确普通入口不可据此认定可调用。
- [pipeline.mjs:120–135](../baseline/js/generators/pipeline.mjs) 只将存在 `emit.mjs` 的项目标成 `queued` 并写队列 JSON。导入 `execSync`、注释说 delegate，都不是实际调用 parse/emit 的证据。
- 附带 `generators/ts-types/bank-types.spec.json` 的 `OrderCredited`、`AbandonOrder` 是教学载荷输入，不能证明银行消费。

### product-design-review

- [generate.mjs:1–9](../baseline/js/generators/product-design-review/generate.mjs) 显式注册唯一 `product-design-review` 实现；[manifest:1–15](../baseline/js/generators/product-design-review/generator.json) 固定 `product-design-review@1`、`reference-layout@1`、`product-design@1`，不接受 options。
- [planProductSet:70–105](../baseline/js/src/core/product-plan.mjs) 要求完整成功 compilation 与重编译结果一致，精确产品合同、可信 registry、两次相同 entries；来源 keys、footprint、路径、kind 等有准入检查。本文未调用这些检查。
- [registeredProductProducer:92–102](../baseline/js/lib/products/generate-cli.mjs) 分别登记 review、Play service 和独立 family 候选。review 可走 `generate-products`，也可由显式选择它的项目走 `generate-project`。

### 本组三个 producer 均不是银行选中的 emitter

[银行固定配置:278](../baseline/bank/truthsrc.project.json) 选择 `scala-cqrs-play-service`。同一配置 59–63 行请求 `product-design` **产品**，不等于选择 `product-design-review` **生成器**。

银行真实继承链是：

```text
scala-cqrs-play-service.generate
  → createEffectRegistry('2')
      → applicationRegistry('2')
  → service 包装器的版本钉住/覆盖
  → play-service-dsl
```

完整内容依据是 [service generate:13–71](../baseline/js/generators/scala-cqrs-play-service/generate.mjs)、[effect registry:1–29](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs)、[application registry:1–33](../baseline/js/generators/scala-cqrs-application/produce.mjs)，以及 [service manifest:140–305](../baseline/js/generators/scala-cqrs-play-service/generator.json)。其中没有本组三个 emitter。共享项目证据和 apply 核心也被银行使用，并不意味着银行继承 review。

## 3. 教学与 TS 的具体 B 合同

以下均是规范目标，不是已改动生产布局的声明。`<outDir>` 为显式独占目标；新目录和新接线均待对应 owner 批准。

| 逻辑职责 | 明确目标 | 内容与 fixture 要点 |
|---|---|---|
| 聚合摘要 | `<outDir>/aggregates/<validatedAggregateName>.md` | 保留标题、commands/events 两行、无名项过滤、空列表 `(none)`、尾换行；fixture `ordinary-review/teaching-empty-and-named-v1` 覆盖空聚合、空列表、重名/路径字符 |
| 复制的生成器源码 | `<newGeneratorDir>/generate.mjs` | 完整头注释、export、局部初始化、循环、entry 六字段、return；没有 import 或运行资源；fixture `ordinary-review/init-generator-contract-v1` 比较全文并覆盖已有文件保护 |
| 复制的 manifest | `<newGeneratorDir>/generator.json` | 保留输入版本、products、kind、output、description；只派生合法 generator 名，不能无转义拼 JSON；同一 init fixture |
| TS 结构接口 | `<outDir>/typescript/contracts.ts` | 文件头、description、接口和必填字段顺序、空行、尾换行；fixture `ordinary-review/ts-shapes-v1` 覆盖所有现有类型分支、未知类型、重复名、注释闭合及精度边界 |
| TS 派生输入 | `<outDir>/.truthsrc/ts-types/definitions.spec.json` | `{source, definitions}`；每定义只含 name/description/fields；fixture `ordinary-review/ts-parser-round-v1` 使用真正的单定义 `.spec.json` 输入，不把 emitter 的聚合样例冒充 parser 输入 |

TS 当前类型映射必须准确保留在差距账中：`number/integer/long/timestamp → number`，`object → Record<string, unknown>`，未识别类型退回 `string`。它不生成字段 optional、discriminant、名义品牌、构造器、行为或 ActorRef。改变 long 的表示、时间单位或 fallback 都是语义决策，不是普通格式修整。

当前 parser 使用目录枚举顺序，没有显式排序、不递归；直接覆盖任意 `outPath`，不建父目录。未来排序、重名拒绝和受管 writer 要以确定 fixture 固定，不在本阶段擅改行为。

应用 [layout-and-style §2、§3、§5、§7、§8](../layout-and-style.md)：独立非 Scala 输出根；名称/身份分离；显式有限类型规则；保留数值/名义语义；先固定最终字节再生成回执。不存在为遵循 Scala 三层而把 TS 或 Markdown 放入领域包的理由。

## 4. 设计评审的三种职责，不是 UI 实现

实际生成内容全部读自 [produce.mjs:1–64](../baseline/js/generators/product-design-review/produce.mjs)。

### 模型 JSON

目标保留 `<outDir>/design/product-designs.json`。根为 `schemaVersion/purpose/runnable/product/designs`，明确 `design-review-only`、`runnable=false`，完整保留 typed designs，不执行 action，不推断反馈实现。

`json()` 以 `pretty.length <= 65536` 选择缩进或紧凑 JSON，判断口径是 JS 字符长度而非 UTF-8 字节；两分支均有尾换行。fixture 要有 Unicode 与阈值两侧输入，不能把排版变化留给指纹之后的后处理。

### 五张 Mermaid 平面图

明确保留以下五个目标文件，共用一逻辑条目的五个条件变体：

- `<outDir>/design/strategy.mmd`
- `<outDir>/design/scope.mmd`
- `<outDir>/design/structure.mmd`
- `<outDir>/design/skeleton.mmd`
- `<outDir>/design/surface.mmd`

每张图包括 generated/non-runnable 注释、`flowchart TD`、节点和边。选中条件是 `node.plane === plane`；关系只要任一端被选中就保留，同时补齐另一端，因此**跨平面端点不能被省略**。局部编号 `d<i>n<index>` 不是业务身份。

节点 label 转义由 `label()` 承担；边标签为产品的关系 kind。没有导入、类、生命周期和运行时初始化需要塞进业务代码；`surface.mmd` 也不代表 UI 已落地。

### 来源索引

目标保留 `<outDir>/design/source-index.json`。必须覆盖九种实际 role：

`design`、`node`、`action`、`action-parameter`、`feedback`、`feedback-resource-key`、`feedback-watermark`、`relation`、`domain-reference`。

索引保留 `artifact/node/relation/role/source/related/references`；审批来源、参数来源、反馈 key/watermark 来源不能被简化掉。每 design 从 `design.references` 沿 layout declarations 的 dependencies 遍历，seen 以完整限定引用去重，找不到声明拒绝。

全部 source/related 形成 `source:<document>#<pointer>` keys，作为七个 entries 的共同元数据。该 JSON **不是代码锚索引**，没有最终源文件指纹和代码跨度。当前 review entries 没有 codeMappings；后续 apply 最多据其来源 keys 建立文件级锚，不能宣称 action/node 级精确代码定位。

三个逻辑职责共用 fixture `ordinary-review/design-five-planes-v1`：五平面、同/跨平面边、两个 design、label 转义、九种来源角色、审批/反馈可选分支、引用环/菱形、缺失引用与 JSON 阈值。所有 fixture 状态为 `specified-not-executed`。

## 5. 回执与项目证据的唯一组装所有者

### 共享 ledger / anchors

两个 producer 的同名合同分别精确回指同一逻辑 ledger 与同一逻辑 anchor，原因是确实共用 [core.applyEntries:246–269](../baseline/js/src/core/generate.mjs)，不是按文件名猜测可复用。

| 明确目标 | 唯一所有者 | 不可抹平的 profile 差异 |
|---|---|---|
| `<outDir>/truthsrc.ledger.json` | `src/core/generate.mjs::applyEntries` | teaching 为 `_template/unknown`；review 为 `product-design-review/1`；无 ownership 取 merged plannedRows，项目 ownership 只给 accepted outcomes 且 kind/owner 合法的行记录最终 bytes 指纹 |
| `<outDir>/anchors.json` | `src/core/anchors.mjs::writeAnchorsIndex/materialize` | teaching 默认 `final-bytes` 且没有新 knowledge keys；review direct 为 `written-only`；项目另加 ownership 过滤 |
| `<outDir>/.anchors.json.tmp-<pid>-<uuid>` | 同一 anchor owner | 瞬态资源，不是新的业务制品或第二个稳定索引 |

ledger 行保留全部实际字段：path/kind/schemaCategory/schemaNode/families/deps 及可选 noteIds/causedBy/productFootprint/knowledgeIds/ownership；concern 的 scope/hash/计数也保留。没有 ownership 时不能把 plannedRows 一概解释成成功写出的最终文件。

anchor 保留完整 location、身份、指纹、状态、验证级别和可选 definitionDigest；families 不会自动变成知识 key。源码中的 `source-verified` 指真实源字节层级，不是本阶段已经验证，也不是 runtime PASS。

必须保留副作用顺序：预检与捕获 → 应用文件写入及最终 bytes 对比 → ledger → anchor 临时文件独占创建、写入、sync、close、复核、rename。失败清理只能删除自己 inode 的临时文件；不存在跨全部源文件、ledger、anchors 的事务回滚。详细资源操作位于 [anchors:543–612](../baseline/js/src/core/anchors.mjs)。

### 四种 project-evidence

[projectPlan:211–225](../baseline/js/lib/project/cli.mjs) 是唯一组装者，core 是唯一文件 writer。明确拆为：

| 路径 | 完整内容责任 |
|---|---|
| `<outDir>/.truthsrc/canonical.json` | `ast.canonical` 的派生副本，不是第二作者入口 |
| `<outDir>/.truthsrc/request.json` | `ast.request` 的完整产品编译请求 |
| `<outDir>/.truthsrc/compiled.json` | `ast.compilation.result`，不是整个 wrapper，不扩大静态 readiness |
| `<outDir>/.truthsrc/inputs.json` | sources、validation、sourceIndex、generatedFiles、canonicalId、graph，以及存在时的 implementations |

四文件均为紧凑 JSON 加换行，entry `kind=project-evidence/deps=[]/knowledgeIds=[]`。`inputs.generatedFiles` 在附加四证据之前计算，本 profile 对应七个 review entries，**不是整个输出目录清单**。所有证据只在 project 路由存在；raw product 生成不附加。

上述条目要求 `shared-generation-core/receipt-outcomes-v1` 与 `ordinary-review/design-project-evidence-v1` 两组 fixture，分别覆盖两种 producer、plan/apply、ownership/update、保留/合并/失败结果和同批来源关联；本次均未执行。

## 6. 未列入本组 catalog 合同的真实写出

这些记录是本组入口的附带/中间/瞬态写出，不借机认领其它 producer 的业务产物。

1. **TS parser 中间 spec**：`parse.mjs:15` 直接写 argv 的 outPath。目标与 fixture 已在第 3 节具体规定。
2. **项目旁的知识库**：`<dirname(projectFile)>/.truthsrc/knowledge.sqlite`。project apply 先发布 snapshot，再写目标文件，再从实际 anchors 发布关联；planOnly 用内存库而非这个磁盘文件。schema/write owner 是 `lib/knowledge-sqlite.mjs::SqliteKnowledgeGraphStore`，项目编排 owner 为 `lib/project/graph.mjs`。保留 metadata/snapshots/nodes/relations/generations 和索引、独立事务、finally close。前置 snapshot 可以早于后续 apply 失败存在，不能宣称数据库与文件整体原子。fixture 为 `shared-project-evidence/graph-publish-v1`。
3. **anchors 提交临时文件**：与第 5 节索引共享逻辑条目。其创建、sync/close、rename 和失败清理不是可省略的 writer 责任。
4. **共享 pipeline 队列清单**：`<explicitStagingOrTargetDir>/pipeline-manifest.json`。完整根含 tree/out/generators/timestamp；每项 queued 或 skip。它只有队列观察，不是 TS 生成成功回执。默认 staging 为 cwd 下 `.staging`，direct 选 OUT，check 不写；fixture 为 `shared-generation-core/pipeline-queue-v1`。跨组由集成者按同一 writer 去重。

知识库和 pipeline 元数据都适用 [layout-and-style §2、§4.6、§5.7、§8](../layout-and-style.md)：派生根与作者/业务包隔离；资源有所有者；失败与成功状态有区别；稳定身份不变。带 timestamp 的队列清单不冒充确定性代码清单。

## 7. 补充来源与未决边界

24 个固定资料条目的完整字节 SHA/bytes 与原 index 对应；registry 只登记实际读过的区间，所有本组生成入口、renderer 与直接 writer 均读取了相关完整内容。四个未入原基线的资料如下，准确 SHA 与绝对路径在 JSON 的 `extraSources`，本组没有另存快照：

- `lib/project/graph.mjs`：项目图路径、snapshot 与 anchor 关联发布。
- `lib/knowledge-sqlite.mjs`：SQLite schema、终端写入、事务与资源关闭。
- `generators/ts-types/bank-types.spec.json`：附带的教学接口样例，不是当前银行运行证据。
- `generators/ts-types/README.md`：仅标题，没有补足统一入口的接线合同。

后续实施前仍须裁定：

- TS 保留直接 CLI，还是补齐普通/产品 API；不能把当前 `entrypoint` 字段当作已接通。
- TS 数值精度、时间单位、未知类型 fallback、optional 与名义类型输入合同；本规格不批准改业务语义。
- `init-generator` 拒绝已有目录还是仅保护同名文件，以及合法 name 的取得与 JSON 转义策略。
- 教学摘要若需知识锚，如何取得真正的 source/knowledge 身份；review 若需细粒度跨度，如何提供 codeMappings。
- 共享 ledger/anchor、project evidence/graph、pipeline queue 的中央去重和唯一 writer 所有权；不得反推银行消费 review。
- 集成者是否另行固定四份 extraSources；不修改原 852 文件基线或 index。

稳定业务 ID、PB 字段、PID、serializer、摘要、名义类型与溢出规则均未改动。没有新增算法、公共 API 或银行切换获得隐含批准。

## 8. 本阶段证据上限

只进行了源码内容阅读、固定字节哈希对账、人工映射及 Python 标准库的文档 ID 覆盖核对。没有导入或执行工程代码，没有应用/CLI runtime、测试、typecheck、编译、生成、下载、服务、Git 写操作；没有创建任务、worktree 或代理。

fixture 均未执行，复杂度 `not-measured`。本组文件完整与 12/12 覆盖仅说明规格清单完整，**不构成 parity-PASS、behavior-PASS 或银行运行通过**。
