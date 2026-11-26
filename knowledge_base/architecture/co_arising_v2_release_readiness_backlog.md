# co-arising 2.0 EARS 工具链发布前缺口清单（Release Readiness Backlog）

> **文档状态**：Release Readiness Tracker（v2.0 Preview → v2.0 GA）  
> **适用范围**：`metarch-truthsrc`（`feat/co-arising-v2-ears-native`）与参考试点 `bank-wealth-demo`（`feat/co-arising-v2-pilot`）

---

## 发布基线判断

- **v2.0-preview / 内部试点**：已具备条件（正交 `structures / behaviors/{domain,application} / bindings` 布局、严格领域边界 4 项门禁、Path-to-Layer 门禁、Z3/First-Hit/边界等式证人、L1 零 Token 生成、L2/L3 `@cloze` 锁定预言机、变异击杀、100% 覆盖率账本、8 场景 S1 混沌 TCK 均已真实跑通）。
- **v2.0 GA（对外公开发布）**：必须先完成下方 **P0（#1–#4）**。

---

## P0：对外正式发布前必须补齐（GA Blocker）

- [x] **#1 跨平台 CI 防“静默跳过”与环境 Preflight**
  - **已落地**：`lib/ears/smt-solver.mjs` 新增 `checkSolverAvailable()` 与跨平台安装指引；`lib/v2/compiler.mjs` 编译前执行 solver preflight（缺失报 `V2_SOLVER_MISSING`）；`lib/v2/verify-gate.mjs` 新增跨平台 Coursier/Ivy2/Maven 探查、`--scala-classpath` / `COARISING_SCALA_CP`、`--strict`（CI 默认开启，缺失依赖直接失败而非静默跳过）与 `runV2Preflight()`。

- [x] **#2 Scala 目标补齐 `layer: application`（与 TypeScript 对齐）**
  - **已落地**：`lib/v2/codegen/scala.mjs` 生成应用层 `*Port.scala` 与 `*Cloze.scala`；`lib/v2/test-emitter/scala-scalatest.mjs` 与 `emit.mjs` 生成并锁定可执行应用层 `*EarsSpec.scala`；`bank-wealth-demo` 已全量对齐 **5 TS + 5 Scala** 套件真实编译通过。

- [x] **#3 反作弊 Hooks 下沉为 `truthsrc` 一等子命令**
  - **已落地**：新增 `lib/v2/guard-write.mjs` 与 `truthsrc guard-write` / `truthsrc init-hooks` 一等子命令；`bank-wealth-demo/tools/coarising-guard-write.mjs` 收敛为薄代理包装层。

- [x] **#4 一键脚手架与聚合门禁命令（Onboarding DX）**
  - **已落地**：新增 `lib/v2/init-v2.mjs`（`truthsrc init-v2 <dir>`，开箱生成标准 `structures / behaviors/{domain,application} / bindings` + hooks + 100% 覆盖率清单）与 `lib/v2/check-v2.mjs`（`truthsrc check-v2`，单命令串联 compile + verify + audit-coverage）。

---

## P1：复杂生产业务能力短板（Preview 可声明限制，GA 后演进）

- [x] **#5 扩展 EARS 语言表达力与 v2 业务投影**
  - **已落地**：支持 `WHEN event <Aggregate>.<Event>` 跨聚合事件编排（带 `EARS_UNKNOWN_TRIGGER_EVENT` 门禁）与应用层 `pin`/`SHALL NOT dispatch` `k`-step BMC；支持 `forall`/`exists` 量词、`sum`/`count`/`len` 序列聚合、`is some`/`is none` Option 匹配与 `within <dur> [of <ref>]` 时间窗（含 `ms/s/m/h/d` 时长字面量）；已将 Style E AC / Style B DMN 决策表投影（`--out-ac`/`--out-tables`）与 `.zh.ears` 双语等价门禁（`V2_BILINGUAL_DRIFT`）接入 `compile-v2`。

- [x] **#6 扩展 S1 效果协议 TCK 协议族与多语言执行器**
  - **已落地**：`lib/v2/effect-tck.mjs` 在 `three-phase-reconcile`（8 场景）基础上新增 `transactional-outbox`（5 场景）、`saga-compensation`（5 场景）、`idempotent-consumer`（5 场景），并提供基于 `scalac`+`scala` NDJSON IPC 的 JVM/Scala TCK 执行器（`truthsrc run-tck-v2 --protocol <p> --scala-src <dir> --jvm-class <Main>`）。

- [x] **#7 增强 YAML 解析健壮性与源码级诊断体验**
  - **已落地**：`lib/v2/yaml-parser.mjs` 支持多行块标量（`|`/`|-`/`|+`/`>`/`>-`/`>+`）、跨行流式集合（`[...]`/`{...}`）、`---`/`...` 文档分隔符与结构化 `V2YamlError`；新增 `lib/v2/diagnostics.mjs` 为全部 `EARS_*` / `V2_*` 诊断附带 `file:line:col` 与 `^` 源码高亮片段。

---

## P2：对外推广与生态配套

- [ ] **#8 外部开发者文档、错误码手册与站点同步**
  - 编写 `v2 Quickstart`、`EARS v2 Grammar Reference` 与 `EARS_*` / `V2_*` 错误码字典；
  - 同步更新 `co-arising.github.io` 公开蓝图与 v2.1 全域治理实践文章。

- [ ] **#9 分支合入与跨平台 CI 矩阵**
  - 建立 GitHub Actions（Linux + macOS）矩阵，自动运行 `metarch-truthsrc` 的 `lint` / `test:ears` / `test:v2` 与 `bank-wealth-demo` E2E；
  - 完成 `feat/co-arising-v2-ears-native` 与 `feat/co-arising-v2-pilot` 合入规划。

- [ ] **#10 编辑器支持（TextMate 语法高亮 + 轻量 LSP）**
  - 提供 `.ears` 语法高亮定义与最薄 LSP（跳转 `structures/` 符号定义、实时提示越界符号与 `V2_PATH_LAYER_MISMATCH`）。
