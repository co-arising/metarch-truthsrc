# 单发射器计划（emitter unification）— 2026-11-21

> **决定（用户指令，2026-11-21）**：「metarch-truthsrc 只留一个代码生成器」——
> classic 发射器逐族退役，curated 架构泛化为唯一发射器。
> 本计划即开工授权（用户：「做一个完整的计划，写下来。然后换一个新的会话开干」）。
> 程序级裁定基线＝下文 F1–F8（随本计划授权执行）；**族内部裁定仍走各自门序**
> （预裁定链→手写金样→沙箱三轮→讲解→逐条裁定→发射器），程序授权不豁免族门。

---

## 1. 现状事实（新会话开工前先复核，见 §8 Phase 0）

- **classic 发射器**（待退役）：`metarch-truthsrc/generators/`——364 文件、43,565 行、
  30+ 包（`scala-cqrs-*` v1→v5 全系列、`*-dsl`、`scaffold-static`），加 `lib/` 内发射编排
  （`lib/products/` 24 文件 6,544 行、`classic-architecture/`、`domain-products/`、
  `value-products/`、`execution/`、`saga/`、`scala-target/` ≈12.8k 行）。
  bank-wealth 台账 `ledger.generator = "scala-cqrs-play-service"`。
- **知识机器**（**保留，非生成器**）：`lib/` 的 author-parse/author-compact/graphstore/
  knowledge-*/validate/roundtrip/provenance/source-index/query ＋ `lib/project/`
  （cli/verify/view/query，2,045 行）＋ `lib/verification/`（12 项检查，2,206 行）等
  ≈11k 行。Pages 公共 CLI（`bin/truthsrc.js`）的全部子命令
  （init/generate-project/status-project/query-project/verify-project/view-project/
  compile-project）落在这一侧——**接口冻结**。
- **curated 线**（唯一发射器的架构来源）：`test/reference/curated/` 8 族金样
  ＋`tools/gen-*.mjs` 8 个字节等值生成器（合计 6,528 行）＋
  `test/fixtures/*-v1/input.json` 8 份输入合同。
  8 族＝aggregate-rules-formal(#11)、external-connector-port(#13)、
  connector-implementation(#25)、projection-apply-event(#26)、
  aggregate-state-controller(#34)、strict-saga-module(#40)、
  strict-fixture-host(#41)、composition-invocation-host(#42)。
- **bank-wealth-demo**（sibling `/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo`，
  输入 HEAD `f8ac7ca`）：`generated/current` 233 件。ledger kind 聚类见 §5。
  2026-11-21 五步门全绿（doctor/validate hard0/compile/generate written=0 全 IDENTICAL/
  verify-project 12 项全 true），`.truthsrc/inputs.json` 工具链指纹已更新为
  `2bb3bb715968…`（工具 commit `c350bb8`）。
- **枢纽缺口**：知识图→族输入合同派生层**不存在**（curated 生成器吃
  `truthsrc.<族>-input/v1` JSON，知识图尚无派生路径）。这是全计划的关键缝。

## 2. 目标架构

```
truth YAML ──知识机器(保留)──→ 知识图 ──派生层(fail-closed)──→ 族输入合同
                                                              ↓
                                        统一发射器 emitter/（每族模块：合同校验→布局引擎→字节确定发射）
                                                              ↓
                                                     应用（bank-wealth 及一切项目）
                                                              ↑
                              test/reference/curated/ 每族金样＝该族发射模块的规格
```

- 一个发射器、一个 CLI 入口（`generate-project` 不变）；每族一个模块；
  金样目录从"平行真相"变为发射器的规格说明。

## 3. 程序级裁定基线 F1–F8

| # | 裁定 |
|---|---|
| F1 | 统一发射器新包（`emitter/`），curated 模式泛化；单一 CLI 入口，`generate-project` 外接面不变 |
| F2 | 族输入合同＝curated JSON schema 为唯一发射输入；新增知识图→合同派生层，fail-closed（派生不出合法合同即拒发射，D-P08 纪律全局化） |
| F3 | 金样即规格：新族先金样后模块；金样升级＝发射器同步升级（pin 等值维护） |
| F4 | 逐族替换：发射器接一族→classic 对应包从 registry 摘除→五步门全绿→删除；**禁止整体切换**，任何时刻 bank-wealth 都能生成完整应用 |
| F5 | 每次族替换：五步门全绿＋新旧产物逐文件差异清单呈报用户；新族金样门沿用沙箱三轮＋性质＋裁定链 |
| F6 | 顺序：已定案簇先行（试点＝#42 调用宿主簇）→ 限定 raw 簇（value-object 118 最大头）→ 未实现族面殿后 |
| F7 | 兼容面冻结：truth YAML／绑定／手写供给／ledger/anchors/verify 机器／Pages 命令行／bank-wealth AGENTS.md 合同零改动 |
| F8 | 收尾：classic 发射器物理删除＋`all31Closed` 翻转评估＋Explorer 重锚（内容变化后才有意义） |

## 4. 分阶段计划

### Phase 0 — 新会话开工核验（半天）
1. `git -C metarch-truthsrc status`（干净，HEAD ≥ `c350bb8`）＋读本计划＋账本相关节。
2. bank-wealth 五步门复跑一遍确认基线绿（命令见 §8）。
3. 建工作分支（如 `emitter-unification`），登记开工。

### Phase 1 — 统一发射器骨架（1–2 天）
1. `emitter/` 包骨架：registry（族注册表）＋per-family 模块接口
   （`checkInput` fail-closed→`render` 字节确定→`NEGATIVES` 电池）＋
   差异对照工具（新旧产物逐文件 diff）。
2. 先移植一个已有族模块作为形态样板（建议 gen-aggregate-state-controller——
   339 行最小完整件）。
3. 验收：emitter 对 8 份 fixture 输入与 tools/gen-*.mjs 逐字节一致（同输入同字节）。

### Phase 2 — 派生层＋#42 试点（3–5 天，全计划枢纽）
1. lib/ 新 derivation 模块：知识图→族输入合同（先做
   `truthsrc.composition-invocation-host-input/v1` 形）。
2. 试点：bank-wealth 的调用宿主簇 12 件（invocation-host 2＋host-serialization 2＋
   technical-port 4＋effect-host 2＋effect-serialization 2，产地
   `generators/scala-cqrs-application/render-host*.mjs`）——
   知识图派生合同→emitter 出质量档→与 classic 版逐文件 diff 呈报用户。
3. **量出派生缝宽度**：缺口清单（知识图缺什么信息才能填合同）→34 族排期表。
4. 用户过目 diff 后：替换表登记该簇→classic `scala-cqrs-application` 对应模板摘除
   →五步门全绿→删除（F4 首例）。

### Phase 3 — 34 族逐族程序（主战役，按族排期）
每族固定节拍（=过去数周 8 族的门序）：
预裁定链呈报 → 用户裁定 → 手写金样 → 沙箱三轮门 → 讲解 → 用户逐条裁定 →
emitter 模块（字节等值＋双跑确定＋负测电池）→ bank-wealth 接入＋classic 模板摘除 →
五步门＋diff 呈报 → 删除。
顺序建议（F6）：
1. 已定案簇余量：#11 rules 簇（bank 9 件）接入（金样已有，无新门）。
2. 限定 raw 大头：value-object(#1，bank 118 件)→domain-entity(#2，6)→
   aggregate 簇(#6/8/9，12)→protocol/protocol-helper(#7/10，9)→
   aggregate-repository(#12/22，3)→event-handler(#3，6)→saga-definition(#17，2)。
3. 未实现族面：serialization(#29-32，7)→converter(#30，6)→proto(#29，5＋host/effect-proto 4)→
   execution-plan(#16/17)→service 装配(#38/39，13)→api(#35-37)→测试/build/证据面。
4. extension 三族（#40/41/42 已 curated）按需接入 multi 项目场景。

### Phase 4 — classic 下线完成
`generators/` 43.6k 行＋lib 发射编排全部删除；单一发射器重生成 bank-wealth 全应用；
五步门全绿；`all31Closed` 翻转评估（用户决定）；登记收口。

### Phase 5 — Explorer 重锚
生成内容已变——按既有隔离捕获流程重跑 `tools/export-explorer-snapshot.mjs`
（新快照 id＋current.json 指针＋SITE-FACTS 新 F 行＋锚定 doc＋浏览器证据）；
Pages 上引用旧生成器 id／文件头的句子同步刷新。

## 5. bank-wealth 233 件 → 族聚类（ledger kind 实测）

| 簇 | kind（件数） | 族 | curated 状态 |
|---|---|---|---|
| 已定案 | rules(9) | #11 aggregate-rules-formal | ✅ 金样已有 |
| 已定案 | invocation-host(2)＋host-serialization(2)＋technical-port(4)＋effect-host(2)＋effect-serialization(2) | 调用宿主簇（#42 族） | ✅ 金样已有（试点） |
| 已定案（待核） | external-event-bridge(1) | #13/#25 connector | ✅ 金样已有（映射待核） |
| 限定 raw | value-object(118) | #1 | 未 |
| 限定 raw | entity(3)＋state(3) | #2 | 未 |
| 限定 raw | event-handler(6) | #3 | 未 |
| 限定 raw | aggregate(3)＋aggregate-factory(3)＋aggregate-behavior(6) | #6/8/9 | 未 |
| 限定 raw | protocol(3)＋application-protocol(3)＋command-helpers(3) | #7/10 | 未 |
| 限定 raw | aggregate-repository(3) | #12/22 | 未 |
| 限定 raw | saga-definition(2) | #17 | 未 |
| 未实现面 | serialization-adapter(7)＋converter(6)＋proto(5)＋host-proto(2)＋effect-proto(2) | #29/30/31/32 | 未 |
| 未实现面 | execution-plan(4) | #16/17 execution | 未 |
| 未实现面 | service-runtime(7)＋service-config(3)＋aggregate-bootstrap(3)＋service-port(1) | #38/39/35-37 | 未 |
| 附属 | build(4)＋service-test(4)＋generated-test(3)＋project-evidence(4) | 脚手架/测试/台账 | 跟随 |

## 6. 纪律与常设规则（全程序有效）

1. **门序不豁免**：族内部裁定必须走完整门序；程序授权只覆盖架构与顺序。
2. **不硬编码**：发射器不得内嵌金样字节；名字/字段/消息/布局数据出自输入合同，
   仅逐处记档的排版形可冻结。
3. **字节确定**：每族模块双跑确定＋对金样逐字节等值＋负测电池进工具。
4. **fail-closed 全线**：合同校验、派生层、registry 摘除——一切拒绝要带诊断。
5. **登记旗标**：`rawAcceptanceUnchanged: true`、`all31Closed: false`（Phase 4 前不变）；
   `.rounds/` 不入库。
6. **任何删除前先对照呈报**：新旧产物 diff 必须让用户过目后才删 classic 模板。
7. **提交纪律**：每族替换＝一次提交（发射器接入＋classic 摘除＋登记）；计划文档
   与账本随收口提交。

## 7. 风险登记

| 风险 | 应对 |
|---|---|
| 派生缝过宽（知识图信息不足以填族合同） | Phase 2 试点先量宽度；缝宽则先补知识面（ truth YAML 作者侧）再排族 |
| value-object 118 件单族过大 | 金样按代表profile手写＋变体矩阵性质覆盖；发射器按表驱动 |
| 族映射误判（如 technical-port 是否属 #13/#25） | 每族开工前先做产地 grep 核对（本计划 §5 的映射标注了待核项） |
| 收据溯源 id 变化引发 Pages/文档漂移 | Phase 5 统一刷新；期间 Pages 命令行不受影响（F7） |
| 34 族战线过长 | 每族独立提交独立验收，随时可暂停；顺序表允许用户插队改序 |

## 7.5 开工登记（Phase 0 完成）

- 2026-11-21：分支 `emitter-unification` 自 `98748e7` 建立；工作树干净（HEAD ≥ c350bb8 ✅）。
- bank-wealth 五步门基线复跑全绿：doctor ✅／validate hard 0 ✅／compile exit 0 errors 0 ✅／
  generate written=0，identical 233/233 全 IDENTICAL ✅／verify 12 项全 true ✅。
- JSON 台账在位（`generated/current/truthsrc.ledger.json`，generator=`scala-cqrs-play-service`，
  33 类 kind 与 §5 聚类吻合）。注：md 账本 `second-family-v2-toolgate-approved.md`
  未在仓库内落盘（上会话会话内账本），其关键内容（8 族收口＋D-P08＋单发射器决定）
  已由本计划全文承载，不构成阻塞。

### Phase 1 完成登记（2026-11-21，同会话）

- `emitter/` 骨架就位：`registry.mjs`（fail-closed 注册表＋唯一发射封套 renderFamily）＋
  `families/` 8 族模块（自 `tools/gen-*.mjs` 逐字移植，注册块自带出处）＋
  `parity.mjs`（验收 harness）＋ `cli.mjs`（families/generate/verify/negatives/parity/diff）＋
  `diff-report.mjs`（F5 逐文件差异呈报件）＋ `test/emitter-unification.test.mjs`（4 测试入套件）。
- **Phase 1 验收全绿**：8 族 fixture 输入下 emitter 与 `tools/gen-*.mjs` 逐字节一致
  （toolsParity 8/8）＋curated 金样逐字节等值（goldenParity 8/8，27 件产物）＋双跑确定
  （8/8）＋内嵌电池全清（12/12、40/40、20/20、13/13）。
- **登记债务（呈报用户，不自裁）**：#11/#13/#25/#26 四族 curated 模块无负测电池
  （`battery: none`，parity 报告 `batteriesDebt=4`，测试断言债务集恒等于这四族）。
  是否按族门序补电池、何时补，待用户裁定；不阻塞 Phase 2（试点族 #42 电池齐全）。
- **顺带发现（参考件缺陷，未修，呈报）**：`tools/gen-aggregate-state-controller.mjs`
  的 CLI generate 模式参数错位（`inputPath=args[1]`＋`target=undefined`，历史上只跑过
  verify/negatives 门）；emitter 侧不受影响（纯函数路径）。
- aggregate-rules-formal 金样代次勘误：curated 树有 v1/v2/v3 三代，fixture 声明
  `goldenVersion: v3`，family.goldenRoot 锚定 v3（v1 为旧形，发射字节与之不等属预期）。
- **工具指纹范围发现（Phase 2 排期输入）**：bank-wealth `.truthsrc/inputs.json` 的工具链
  指纹覆盖 `lib/ src/ generators/ schema/ scaffold/ + bin/truthsrc.js + package.json`
  （`lib/project/cli.mjs` toolEvidence）。emitter/ 不在指纹内；但 Phase 2 起每次族替换
  动 `generators/` 必翻指纹 → bank-wealth 必须「显式 update 重生成→再 verify」作为族替换
  节拍的一环（本次曾因 package.json 加一行 emitter/ 触发 fail-closed 拒写，已撤回——
  emitter 打包进 npm files 的事宜推迟到 Phase 4 收口一并处理）。

### Phase 2 试点审计登记（2026-11-21）

- 产地核对结论：§5「调用宿主簇（#42 族）」映射**不成立**——12 件全部出自
  `generators/scala-cqrs-application/render-*`（saga-hosts/effect-hosts 产品驱动），
  #42 v1 合同语义级钉死于 wafer 场景，0/12 可表达，且 bank-wealth 无 #42 classic
  对应物。计划 §7「族映射误判」风险按设计触发并核对完毕。
- 缝宽结论：该簇真实派生缝**窄**（saga-hosts/effect-hosts 产品＝知识图→类型化合同
  完整派生；参与者业务名 source/target 可派生；判定槽集中在 R 组三处）。
- 13 件 1,210 行代码审查完成：骨架合格，命名/类型化/抽象/排版不达标，5 处工业级隐患。
- **裁定底稿已入册**：`docs/emitter-unification-host-family-rulings.md`
  （重聚类提案：pipeline-invocation-host(8 件)＋effect-host(4 件)；#42 归 extension；
  风格裁定基线 N/T/L/R/D 五组逐条待用户裁定）。裁定前不动 classic／不写金样／
  不建派生层。Phase 2 试点目标随裁定改写（§4）。

### 两宿主面门序登记（2026-11-22）

- **金样 13 件入册＋compile 门三轮绿**（提交 `0908738`…`751787b`）：
  `test/reference/curated/pipeline-invocation-face/v1/`（payment 案 7 件）＋
  `test/reference/curated/effect-face/v1/`（dispatch／ta 各 3 件）。
- **DDD 改名同步**（用户指令，F7 修正一次）：truth 两 structure 去 0/1/2 序数 →
  `ReserveInvestorFunds*/CreditFundCollection*/ReserveCashFundOrder*`＋refund 侧
  `DebitFundCollection*/CreditOriginalInvestor*`；bank-wealth 显式 update 重生
  233/233、verify 12/12（bank-wealth-demo 提交 `a87d2dc`）。
- **质量性质门三轮绿（2026-11-22，完整「沙箱三轮」闭合）**：结构度量引擎
  （source-structural McCabe＋host-face 层增量禁令）＋83 条 ScalaCheck 性质
  （27 directed negatives）×3 种子；官方证据
  `.rounds/host-faces-quality-20261122-02/attempt-0{1,2,3}/completion.json`
  （`HOST_FACES_QUALITY_GATE_COMPLETE`）。质量合同锚在 pipeline-face 候选
  （`quality-policy.json`＋`scope-exceptions.tsv`＋`expected-properties.txt`＋
  `quality/` 四件），闭包即验证单元；引擎与装置裁定、金样语义缺陷四件修复、
  L1 ≤120 列定案——全量记档见裁定文档 §6 质量轮记档。金样发射器模块
  （字节等值＋双跑确定＋负测电池）为下一步（emitter/families 两族）。
- **发射器模块两族入册（2026-11-23，统一发射器 8→10 族）**：
  `emitter/families/pipeline-invocation-face.mjs`（#43）＋`effect-face.mjs`（#44）
  ——13/13 金样逐字节等值＋双跑确定＋36＋33 条负测电池全拒（零电池债）；
  出处裁定 `handwritten-golden`（toolsRef null，registry/parity 契约扩展记档）；
  两 face `technical-input.json` 扩为发射完备合同（逐工件 doc 行逐字入合同，
  发射器零金样字节内嵌），fixture `test/fixtures/{pipeline-invocation-face-v1,
  effect-face-v1}/input.json` 落盘；金样三件后冻结整理（重复 import 去重、
  未用匹配绑定、columnLimit 100→120 补记）后本地重基线全绿。
  `node emitter/parity.mjs` 十族全绿、`node --test test/emitter-unification.test.mjs`
  5/5 绿。全量记档见裁定文档 §6 发射器模块两族入册。
  下一节拍：bank-wealth 接入（per-business-case 翻转 payment→refund→dispatch→ta，
  每翻转一提交且应用整体可编译；classic 模板摘除前逐文件 diff 呈报用户）。

## 8. 新会话开工指引（Phase 0 即做）

```bash
# 基线复核（bank-wealth 五步门）
cd /Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo
node tools/bank-workshop.mjs doctor --through source --format human
node tools/truthsrc-project.mjs validate          # hard 0
node tools/truthsrc-project.mjs compile           # exit 0
node tools/truthsrc-project.mjs generate --out "$PWD/generated/current"   # written=0 全 IDENTICAL
node --input-type=module -e "import {verifyProjectCli} from '/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/lib/project/verify.mjs'; \
const r=(verifyProjectCli(['--project','truthsrc.project.json','--out','generated/current']).result??verifyProjectCli(['--project','truthsrc.project.json','--out','generated/current'])); \
console.log(JSON.stringify(r.checks), r.passed)"  # 12 项全 true
```

关键文件：本计划；账本 `second-family-v2-toolgate-approved.md`（8 族收口＋D-P08＋
单发射器决定各节）；`tools/gen-*.mjs`（发射模块样板）；`lib/project/cli.mjs`/`verify.mjs`
（知识机器接口）；`generators/`（退役对象）。家族金样对照讲解纪律不变。
开工即建分支 `emitter-unification`，Phase 1 骨架＋Phase 2 试点按 §4 推进；
遇到族级裁定题（如仓储 mutable 注册表是否合法）按门序呈报用户，不自裁。
