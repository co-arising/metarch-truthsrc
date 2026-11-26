# co-arising 2.0 EARS 工具链发布前缺口清单（Release Readiness Backlog）

> **文档状态**：Release Readiness Tracker（v2.0 Preview → v2.0 GA）  
> **适用范围**：`metarch-truthsrc`（`feat/co-arising-v2-ears-native`）与参考试点 `bank-wealth-demo`（`feat/co-arising-v2-pilot`）

---

## 发布基线判断

- **v2.0 GA（对外公开发布）**：**P0（#1–#4）、P1（#5–#7）、P2（#8–#10）全部 10 项已落地并验证通过**，具备正式合并主干与公开发布条件（待用户确认后执行主干合并与远端推送）。

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

- [x] **#8 外部开发者文档、错误码手册与站点同步**
  - **已落地**：编写 [co_arising_v2_quickstart.md](../guides/co_arising_v2_quickstart.md)、[ears_v2_grammar_reference.md](../reference/ears_v2_grammar_reference.md) 与 [v2_diagnostics_error_codes.md](../reference/v2_diagnostics_error_codes.md)；并同步更新 `co-arising.github.io` 中英文架构蓝图实现落地附录。

- [x] **#9 分支合入规划与跨平台 CI 矩阵**
  - **已落地**：新增 `metarch-truthsrc/.github/workflows/co_arising_v2_ci.yml` 与 `bank-wealth-demo/.github/workflows/v2_pilot_ci.yml`（Linux + macOS 矩阵，自动安装 Z3/Scala 2.12/ScalaTest 并以 `--strict` 模式执行全套校验与 `init-v2` 烟雾测试）。
  - **主干合入顺序（待用户审批后执行）**：
    1. 将 `metarch-truthsrc` 的 `feat/co-arising-v2-ears-native` 合入 `main` 并打标 `v2.0.0`；
    2. 将 `bank-wealth-demo` 的 `feat/co-arising-v2-pilot` 合入 `main`（确认 v1 `npm run validate` 100% 绿灯）；
    3. 推送 `co-arising.github.io` 的 `main` 站点同步提交。

- [x] **#10 编辑器支持（TextMate 语法高亮 + 轻量 LSP）**
  - **已落地**：新增 `editor/ears-vscode/`（`package.json`、`language-configuration.json`、`syntaxes/ears.tmLanguage.json` 中英双语语法高亮）与零依赖 LSP 3.17 stdio 服务 `lib/v2/ears-lsp.mjs`（`truthsrc lsp-ears`，支持实时领域边界与 `V2_PATH_LAYER_MISMATCH` 诊断、跳转 `structures/*.yaml` 符号定义与 Hover 提示）。
