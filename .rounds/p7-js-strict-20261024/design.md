# P7：js 生成器 saga-strict 支持 + SQLite 类本地轻量图 + 1:N 回锚认证（p7-js-strict-20261024）

## 一、范围来源（用户大背景逐字映射）
用户 2026-10-23 口述（锚点存照）：「代码生成器（**scala codegen + metarch-truthsrc 的 js 生成器都要支持**）
→ 回锚真源。两条管线：backkend-codegen 重流水线（编译产物推图、回锚回图、需服务端）；**metarch-truthsrc
全文件真源树、无服务端、轻量（回锚回真源树文件）**。图的后续方向：**本地 SQLite 类嵌入存储**——轻量、
方便、拿到就能跑（P7 设计输入）。」

P1–P6 已让 scala codegen 全链支持（v3 契约→ArchitectMetadata→SagaModule/FixtureHost/Bootstrap，
r13 应用构建 exit0+八套件绿）。本批兑现 js 生成器半边 + 轻量线图存储 + 回锚认证。

## 二、现场勘探结论（2026-10-24）
1. **saga-dsl 已有 strict-contract 模式**（generate.mjs）：canonical+binding+ir → 三件契约工件
   `contracts/sagas/<id>.{contract,phases,consumption}.json`，metadata 内建诚实标记
   `readiness:'contract-only'/runnable:false/runtimeBindingVerified:false`；`strict-scala` 有意封禁
   （SAGA_RUNTIME_BINDING_UNVERIFIED——无已验证运行时形状）。**缺口：entries 无 knowledgeId →
   core apply 不产锚**；且从未在 serial 真树上端到端走过。
2. **core apply 锚通道现成**：`entry.knowledgeId → anchorInputs → planAnchors → writeAnchorsIndex`
   （写后逐 location 对实际字节 SHA256 核验）；`anchors.json = knowledgeKey → locations[]` 天然 1:N；
   `queryAnchorsIndex` 逐文件指纹核验 source-verified/stale。generator.json artifactKinds 已含三种
   strict kind；CLI `--options-json` 明说支持嵌套 bindings/IR。
3. **图已建模 saga**：lib/query.mjs `buildGraph` 节点寻址含 `saga:money-transfer`/
   `saga-participant:…`/`saga-phase:…`——**图节点 id 与锚 knowledgeKey 同型**（`saga:<id>`）。
   anchors 动词 v0.5 诚实缺口自述：「back-anchors not yet landed」——indexFile 分支已实现待喂。
4. **node:sqlite 可用**：Node 22.23.4 内建 DatabaseSync（ExperimentalWarning 已知），零 npm 依赖
   ——truthsrc「zero dependencies」纪律下的「SQLite 类嵌入存储」唯一合规落点。
5. **serial 例树三输入齐备**：`example/saga-money-transfer-serial/{tree,bindings.json,runtime-binding.json}`；
   digest 锚=`sha256:3a586c81…`（definitionDigest，P4 起稳定，BC r13 SagaModule 同值）。
6. run-all.mjs=旧基线 1:1 金样复制管线（metarch 树，无 saga）——**本批不动**（金样纪律）。

## 三、交付三条（全在 truthsrc，BC/saga-core 零改动）
### A. js 生成器 saga-strict 支持 = 锚接通 + 真树端到端
- `buildStrictPlan` 三 entries 增 `knowledgeId: saga:<definition.id>`（机械取自 canonical saga id；
  与图节点寻址同型，零发明）。诚实标记原样进 JSON 内容，不动。
- 端到端：serial 树 compileTree → core apply（`truthsrc generate --generator generators/saga-dsl
  --options-json {mode:strict-contract, binding}`）→ ledger + anchors.json 真实产出。
- strict-scala 封禁保持；run-all 不动；BC 侧不重复发射（其 SagaModule/Host 面已交付）。

### B. SQLite 类本地轻量图 = lib/graphstore.mjs（node:sqlite）
- `buildGraphStore(canonical, {file})`：复用 buildGraph 图模型 → 单文件库三表
  `meta(key,value)/nodes(id,kind,name,atom)/edges(from,relation,to)`+索引；meta 存
  schemaVersion `truthsrc.graphstore/v1`/workshop/nodeCount/edgeCount/canonical sha256——
  **无时间戳无隐藏状态**（I4）；临时文件+原子 rename。
- `graphFromStore(file)`：读回 `{nodes:Map, edges[]}` —— 与 buildGraph 产物深等 ⇒ 全部查询动词
  零改动可用。
- CLI：`node bin/truthsrc.js graph --tree <dir> --out <db>`（或 --canonical）。
- out/ 纯缓存语义（可删可重建）；库文件字节不承诺稳定（SQLite 页序），以**内容集确定性**+查询
  parity 为准。

### C. 1:N 回锚认证 = 认证套件（test/saga-strict-anchors.test.mjs）
serial 树 scratch 端到端，五认证面：
1. **1:N**：`saga:money-transfer` → anchors[key].locations 恰 3（contract/phases/consumption）。
2. **指纹核验**：queryAnchorsIndex 逐 location 当前字节 SHA256 → 全 source-verified。
3. **回锚回树文件**：consumption ledger 的 sourceMap 指针 → 树文件逐一存在（用户大背景第二条
   管线语义：回锚回真源树文件）。
4. **跨管线 digest 对账**：ir.definitionDigest == `sha256:3a586c81…`（与 BC r13 SagaModule 同源
   身份——1 树 : 2 管线产物）。不伪造跨仓 location 进 anchors.json（锚索引只记 core apply 真实
   发射面；BC 对账走 digest）。
5. **图+锚汇合**：graphstore 重开图 → `anchors('saga','money-transfer',{indexFile})` →
   source-verified；sagaParticipantsOf/sagaPhasesOf parity。

## 四、实施顺序
Stage 1 knowledgeId（+既有 saga-generator 测试随断言面更新）→ Stage 2 graphstore+CLI →
Stage 3 认证套件 → Stage 4 全量 node --test + validate/roundtrip + digest 零抖（saga.yaml 不动）→
Stage 5 证据落盘+登记（无 commit 等明示）。

## 五、红线
runnable=false/readiness contract-only/runtimeBindingVerified=false 不得改写；strict-scala 封禁
保持；run-all 金样管线不动；树原子（tree/）本批零改动 ⇒ digest 零抖必须；零 npm 依赖；
scratch 全 realpath 隔离、不触共享面；无 commit/push。

## 六、实施记录（2026-10-24 实测闭环）

### A. knowledgeId 锚接通（saga-dsl/generate.mjs buildStrictPlan）
三 entries 增 `knowledgeId: saga:<definition.id>`（与 buildGraph 节点寻址同型）。CLI 端到端
（compile→core apply）实证 `saga:money-transfer` → 3 locations 全 source-verified。
saga-generator 57/57 绿（两测试参照自生成，非手钉金样）。

### B. graphstore（lib/graphstore.mjs + bin graph 子命令）
- node:sqlite 惰性导入 + Node≥22.5 显式守卫（工具链基线 Node≥18 不破——graphstore 模块外
  零影响；CLI usage 注明）。
- **extra 列泛化**：节点对象除四基列外可能携带节点级字段（qualifiedRef/sagaId——勘探两轮
  撞见），以 JSON extra 列全量承载，杜绝打地鼠；边以 seq 列保 buildGraph 插入序（数组序敏感）。
- 全量重建 parity：serial（65 节点 96 边）+ v1 + fab + example/tree 四树 deepStrictEqual；
  describe/expand/lineage/search/sagaParticipantsOf/sagaPhasesOf 双图等值；跨进程重开实证；
  CLI graph 子命令 + 显式 --out 门（绝不误写 canonical.json）。

### C. parseDoc 流式空 map 三连环修复（勘探撞出的存量缺陷，非本批引入）
P4 查询 slice 刻意写 `events: {}`（SCHEMA 查询约定）触发三层断链：
1. **parseDoc**（lib/shared.mjs）：顶层内联流式值 `events: {}` 落标量分支 → 字符串 "{}" →
   字符串迭代出幻影键 "0"/"1" → validate 4 hard（V4×2/V6×2 伪影）。**P5 段「CLI 权威路径
   0 hard」的登记与今日实测不符**（stash 核验：HEAD 干净态同样 4 hard）——此更正如实记。
   修复：内联 `{}`/`[]` 走 JSON.parse（带引号字符串不进此分支；全树扫证无其它内联流式值）。
2. **compile**（lib/compile.mjs）：空 events 无池条目可重建 → 按 v0.5.1 surface carry 先例
   （decision/fold 同类）骑 canonical 命令 atom；非空 events 仍走 evPool/order 机制。
3. **decompose + emitDoc**（lib/decompose.mjs/lib/shared.mjs）：空对象块内联渲染 `events: {}`
   （原两行块式也 parse 正确但字节不合）；events 从 payload rest 剥离（surface 字段非 payload）。
结果：**serial 树 validate 0 hard（2 既有 notice）+ 四树 roundtrip 全绿**（serial 17 atoms
首次恒等；v1 11/fab 14/demo 27 atoms 不变）；全量 1699/1699 无回归；canonical 投影仅
GetBalance atom 增 `events:{}` 空标记（saga ir 不含 aggregates ⇒ digest 双钉点
3a586c81/ba60f58a 套件内看守不变）。BC 侧冻结金样资源不受影响（不重编译树）。

### D. 认证套件（test/saga-strict-anchors.test.mjs，3 测十断言面）
1:N（3 locations）/指纹逐 location 当前字节核验/诚实标记 in-artifact 断言（contract-only/
runnable=false/runtimeBindingVerified=false/blocked/unverified runtimeRequirements）/ledger
748 指针全导航（canonical+binding 双文档）/definitionDigest 3a586c81 跨管线钉/I2+I1 回树/
图库重开 × anchors 动词汇合 source-verified/双目录重产字节恒等+锚索引 repo 归一后恒等。

## 七、边界（本批之外，如实登记）
- run-all 金样管线未动（旧基线 1:1 复制纪律；metarch 树无 saga）。
- strict-scala 封禁保持；js/scala 运行时接线不在 js 生成器侧（BC 侧已交付 scala 面）。
- anchors 跨仓 BC location 不伪造进索引（对账走 definitionDigest）。
- 根级不存在 tree/ 时 CLI validate/roundtrip ENOENT 崩溃为既有行为（未修，本批不扩）。
- MCP 面未接 graphstore（未来能力；verb 层已 store-compatible）。
