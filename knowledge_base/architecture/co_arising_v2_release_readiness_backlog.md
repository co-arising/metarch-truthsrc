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

- [ ] **#5 扩展 EARS 语言表达力与 v2 业务投影**
  - 支持 `WHEN event <Aggregate>.<Event>` 跨聚合事件驱动编排与应用层多步 `k`-step BMC；
  - 增强集合量词（`forall`/`exists`）、`Sequence` 聚合（`sum`/`count`）、`Option` 模式匹配与时间窗口比较；
  - 将 v1 的 `project-spec`（PM 可读 AC / DMN 决策表）与 `.zh.ears` 中英语义等价门禁接入 `compile-v2`。

- [ ] **#6 扩展 S1 效果协议 TCK 协议族与多语言执行器**
  - 在 `three-phase-reconcile` 基础上新增 `transactional-outbox`、`saga-compensation`、`idempotent-consumer` 等通用 S1 协议族；
  - 支持对 Scala/JVM 适配器直接执行 S1 故障注入 TCK（不再仅限 Node ESM 模块）。

- [ ] **#7 增强 YAML 解析健壮性与源码级诊断体验**
  - 补强 `lib/v2/yaml-parser.mjs` 对复杂多行块标量与流式语法的兼容；
  - 为 `EARS_*` 与 `V2_*` 诊断补齐精确 `file:line:col` 源码片段高亮定位。

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
