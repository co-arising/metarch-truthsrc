# emitter-unification 交接文件 — 2026-11-23

> 目的：新会话（或新执行者）从本文件出发即可继续 emitter-unification 工程。
> 阅读顺序：本文件 → `docs/emitter-unification-plan.md`（含 §16 范围修订）→
> `docs/emitter-unification-host-family-rulings.md`（裁定台账，§15/§16 为最新）。
> 开工前必做：plan §8 Phase 0 基线复核（六步门）。

## 1. 双仓状态（交接时点）

| 仓库 | 分支 | HEAD | 工作树 |
|---|---|---|---|
| `metarch-truthsrc` | `emitter-unification` | `6665a32` | 干净 |
| `bank-wealth-demo` | `fix/pending-replay-20261111` | `83ced0d` | **14 个未提交文件属并行会话，不是我们的——禁碰禁提交**（清单见 §7 红线） |

bank 的 `generated/current/`（235 件）**gitignore 但就是交付物**：磁盘状态＝
139 件统一发射器形＋96 件 classic 形，与账本/verify 一致。本会话终态已过
六步门（含冷 sbt 编译 `[success]`）。

## 2. 本会话（2026-11-23）完成

| 提交 | 内容 |
|---|---|
| metarch `71267eb` | value-object 家族 #1 注册（handwritten-golden：金样 8 件＋合同 schema `truthsrc.value-object-input/v1`＋派生层＋emission 桥＋第 12 注册，+3142 行） |
| metarch `f45cad2` | #43 face 家族修复完整落地（伴名化＋trait 内 import＋emitHost `md.hostIo`＋金样 5 件同步） |
| bank `83ced0d` | 手写 4 文件（face 伴名 import 2 行＋TA ABI 对齐，两次 F7 豁免均记档） |
| metarch `fe43e54` | value-object 翻转登记（F5 清单 118/118 呈报；plan §5 行 ✅） |
| metarch `6665a32` | **§16 范围裁定**：退役＝bank 范围停用；`generators/` 永久保留，F4 摘除/F8 物理删除撤销 |

关键事实发现（详见 rulings §15.1）：此前记录的「2 个重复定义错误」实为
scalac 命名阶段中断——typer 从未跑完，深层缺陷被掩盖。R7 冷编译门首跑
暴露并修复三簇（A′ trait 裸名／B emitHost 硬编码 BankPaymentHostIO／
C TA 手写停在旧 ABI，含恒真守卫静默禁用重试授权的 bug）。

## 3. 程序框架（30 秒版）

- 目标：bank-wealth-demo 的生成路由全部走统一发射器（`emitter/families/`，
  现注册 **12 族**）；metarch 的 classic 生成器集（`generators/` 364 mjs /
  43,671 行，与 backend-codegen 对齐的基线）**永久保留，永不删除（§16）**。
- 进度：**139/235 件已翻转**（rules 9＋face 簇 12＋value-object 118）。
- 每族一提交；族门序不豁免（预裁定链呈报→手写金样→沙箱三轮→逐条裁定→
  模块→bank 翻转→六步门→F5 逐文件 diff 呈报→提交）。
- F7 兼容面冻结（truth YAML／绑定／手写供给零改动）——豁免须用户明示裁定，
  已授予 3 次（全部记档 §15/§15.1）。

## 4. 剩余路线（§16 修订后）

| 节拍 | 族（件数） |
|---|---|
| 下一拍 | **#2 domain-entity（6）**：entity 3＋state 3 |
| 其后 raw 簇 | #6/8/9 aggregate 簇（12）→ #7/10 protocol＋helpers（9）→ #12/22 repository（3）→ #3 event-handler（6）→ #17 saga-definition（2） |
| 未实现族面 | serialization/converter/proto #29–32（22）→ execution-plan #16/17（4）→ service 装配＋api #38/39/35-37（14）→ external-event-bridge #13/25（1，**映射待核**：开工前产地 grep） |
| 附属 | build/test/evidence 15 件（跟随服务装配节拍） |
| Phase 4 收尾 | bank 全 235 件经统一发射器＋六步门全绿＋`all31Closed` 评估（用户决定） |
| Phase 5 | Explorer 快照重锚＋Pages 旧引用句刷新 |

随行登记债（不阻塞）：#11/#13/#25/#26 电池债 4 件；gen-aggregate-state-controller
CLI 参数错位；验收 spec 旧世代名 dangling（不在构建内）。

## 5. 六步门（每族 bank 侧验收，plan §8 有完整命令）

1. `node tools/bank-workshop.mjs doctor --through source --format human`
2. `node tools/truthsrc-project.mjs validate`（hard 0）
3. `node tools/truthsrc-project.mjs compile`（知识树编译，exit 0）
4. `node tools/truthsrc-project.mjs generate --out "$PWD/generated/current" --update`
   （**显式 update 必须 `--update`**，否则 drift 拒绝写；成功输出 COVER/IDENTICAL
   计数；`.truthsrc/inputs.json` 账本随写）
5. verify 12 项（metarch `lib/project/verify.mjs`，见 plan §8 内嵌命令）→ 全 true
6. **R7 冷编译**：`cp -R generated/current /private/tmp/<sandbox>`＋手写副本＋
   build.sbt 重指向 → `sbt -Dsbt.color=false "Compile/compile" < /dev/null` →
   `[success]`。工作区不落 `target/`。

## 6. 操作坑（本会话实测，勿再踩）

- npm 套件：`node --test --test-reporter=tap`（**`node --test test/` 形式会
  MODULE_NOT_FOUND**；全量约 20 分钟，flaky 判别法：失败文件两树各跑一遍，
  失败集逐名相同＝环境 flake）。
- parity：`node emitter/parity.mjs`（JSON 输出 `allGreen`；12 族金样等值＋
  双跑确定＋负测电池）。
- 知识树编译 ≠ 应用编译：`compile` 只编译 knowledge products——R7 存在的
  原因；**重复定义错误会中断 scalac 命名阶段、掩盖其后全部 typer 错误**
  （#43 的教训：看到「恰好 N 个错」先怀疑掩盖）。
- bank 手写引用伴名成员：`import example.bankwealth.application.<Stem>Ports.{...}`；
  家族模块硬编码跨案名（如 `BankPaymentHostIO`）是缺陷模式——一律 `md.*`。
- 金样同步：渲染家族 fixture 后覆盖金样树（`/tmp/face-golden-sync.mjs` 可再生）
  ——金样树是规格，手工件（test/ 下 oracle 等）手改。
- 沙箱资产（可删可重建）：`/tmp/vo-sandbox`（修复前对照树，恰 2 错证据）、
  `/tmp/r7-fixed`（全绿树）、`/tmp/vo-flip-diff-manifest.json`（F5 清单）、
  `/tmp/rules-products-dump.json`。
- bank 提交：**只 stage 我们的手写文件**（`git add <逐个文件>`）；分支
  `fix/pending-replay-20261111` 是 bank 翻转提交的历史分支，照旧。

## 7. 红线（持续有效）

1. bank 并行会话未提交文件禁碰禁提交：`.DS_Store`、`test/truthsrc-runtime-db-*.test.mjs`、
  `tools/bank-workshop-session.mjs`、`tools/truthsrc-runtime-*.mjs`、
  `tools/verify-truthsrc-runtime.mjs`、`docs/FUND-PURCHASE-*`、`docs/RELAY-*`、
  `docs/business-design/`、`generated-smells-by-artifactType.md`、`tools/bank-database-relay.mjs`。
2. **不删除 metarch 任何生成器代码（§16）**；「退役」只发生在 bank 生成路由。
3. 手写金样零 classic 式类型名；face 族无生成头（L1）。
4. F7 冻结面改动必须用户明示豁免；动 `generators/`/`lib/` 必翻 bank 指纹 →
  显式 `--update` 重生成 → verify 12 项。
5. 每族一次提交；族级裁定题按门序呈报，不自裁。

## 8. 下一拍开局（domain-entity #2）

1. 预裁定链呈报：产地 grep（`renderAggregate`/`render-domain.mjs` 的 entity/state
  部分）＋bank 6 件变体矩阵＋派生缝宽评估 → AskUserQuestion 金样语义裁定
  （预期同 value-object：handwritten-golden curated，仅 L1/N1 两偏差）。
2. 手写金样 6 件 → 沙箱三轮（合同完备／ABI 编译不变量/delta 纪律）。
3. 家族模块＋派生层＋桥＋注册（EXPECTED_FAMILY_COUNT 13）→ parity allGreen。
4. bank 显式 update → 六步门 → F5 呈报 → 单提交。
