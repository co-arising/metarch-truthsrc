# 统一真源实施合同与验收账

日期：2026-11-04；执行更新至2026-11-05。用户已授权按 `PROJECT-UNIFICATION-DESIGN.md` 全面实施并进行有明确验收的多轮闭环。本文件记录实施合同；通过项必须附实际命令，不以计划代替结果。

## 固定合同

- 推荐作者根为 `truth/<system-id>/system.yaml`，版本 `truthsrc.author/v1`；上下文声明为 `contexts/<context-id>/context.yaml`，版本 `truthsrc.context/v1`。保留现有原子语义和 `parseDoc`/`emitDoc` 的无依赖语法，不宣称通用 YAML。旧 `truthsrc/v1` canonical 与正式产品版本不改变含义。
- 系统和上下文声明定义身份，路径段必须与声明一致；项目配置引用上下文，聚合等现有语义声明保留显式 context。缺失、冲突、多上下文执行不支持均拒绝，不自动补领域事实。
- 只推荐上述一种新作者布局。七阶段/十三类旧 JS 树与 BC `metarch.truth.v1` 为显式兼容输入。新树只允许十三类编号 inbox，允许不适用类别缺省；未知知识文件、混合布局拒绝。README 只作说明，不参与业务编译。
- 现有合格的语义 ID 在其限定域内保留。没有独立 ID 的对象使用限定名称/事件目标描述其当前身份，重命名不冒称自动连续；历史 noteId 为别名，重复时返回歧义。`origin.seq` 冻结；不以数组位置、路径或 hash 充当永久知识 ID。
- 来源记录包含 canonical 快照摘要、canonical pointer、真实原子文件与对象 pointer。文件级关联不升级为符号/行级认证；裸 `nextN` 只能返回带事件/目标字段解释的候选。
- `generate-project --update` 是显式受控再生；默认拒绝覆盖策略保留。更新必须有同项目/生成器/文件类别的上次成功基线，代码未偏离或仅修改合法 MANUAL 区域。停止生成的文件保留并报告，不自动删除。所有写入仍经唯一 apply，不保证跨进程锁或跨文件事务。
- `query-project` 与 `status-project` 区分代码字节、输入/配置/工具新鲜度、历史来源和缺失来源；当前语义编译失败也不能把上次成功证据报为当前。
- 银行当前语义身份保留 `bankwealth`，系统存放名为 `bank-wealth`。新增根 `truthsrc.project.json` 指向新作者树；旧根树及 V1 冻结树不删除、不覆盖。切换前在新建输出/临时副本验完整四流保真与技术绑定，不运行暂停 runner。
- BC 源仓与共享应用只读。BC 兼容验收须保留真实树所有作者内容；支持不了的生成面明确不支持，不回落旧树。整体 BC 现役作者切换需要其 owner 协调，不冒称本轮完成。

## 轮次与验收门

| 轮次 | 必须交付 | 正向门 | 反向/保护门 |
|---|---|---|---|
| A 表达合同 | 根/上下文/身份合同，银行十三类承接表及当前/历史入口清单 | 每类有真实载体或明确状态，四流范围不缩水 | 不虚构故事/批准/五层完备，不拿历史快照掩盖缺项 |
| B 作者树与来源 | 新布局、显式旧格式迁移、来源索引 | 非银行、银行现役V1、BC真实树分别对账；新树物理路径及原子字节 roundtrip | 未知目录/文件、混合 inbox、身份冲突、缺 context、多 context 生成拒绝；旧字节门不改绿 |
| C 查询与再生 | 双向查询、状态、受控 update | 真实知识改变后过期、影响计划、再生、反查闭环 | 重排/移动不串源，歧义不选首个；手改代码/基线缺失/跨owner拒绝；MANUAL/KEEP保留，废弃文件不删除 |
| D 银行与教学 | 一个当前入口、完整四流知识承接，基础与高级教程 | 同一公共入口编译14产品并生成；非银行与银行真实切片可重现；自定义生成器与不重叠手写协作实跑 | 原tree/V1/绑定/1134/P23/journal不变；不凭生成通过声称新运行时验收；不访问旧秘密 |
| E 复核闭环 | 明确测试清单、命令、退出码、独立审阅与修正记录 | 新增与相关旧回归串行通过 | 失败保留记录并修复后复测，未验证项目保持未验证 |

## 当前交付状态与剩余门

本轮执行已结束，所有自有进程已回收；下面记录的未完成项不自动进入下一轮。公共文件闭环和银行当前作者/生成/查询/安全再生/离线编译已交付，但**不宣称整份设计的BC现役切换和运行级窗口全部完成**。

| 能力/目标 | 状态 | 证据或限制 |
|---|---|---|
| 唯一推荐作者语法与项目入口 | 已实现 | system/context声明、严格未知/重复拒绝、初始化与旧兼容回归通过。 |
| 真实银行作者收敛 | 已实现 | 当前303原子、15叙事载体、8具名技术绑定；旧287原子与执行家族保真。 |
| 14产品→193服务源码→文件回锚 | 已验证 | 公共plan/apply、完整银行变更闭环5/5，最终candidate02同步且故事引用诊断为空。 |
| 查询/过期/安全再生/MCP | 已验证 | 重排、移动、缺失、旧保留文件、新增未生成、手改/竞争反例；符号仅候选。 |
| 自定义生成器/两agent手写协作 | 已验证 | 普通CLI自定义生成、实际Counter产品驱动接口、两个独立手写模块再生后字节保持。 |
| BC五产物兼容 | 已验证 | 1917原子完整输入，73测试，五产物严格对象/顺序一致。 |
| BC新作者全量迁移与现役切换 | 阻塞 | 七项历史stage含义冲突需BC owner裁定；原输入保留，不自动改或兜底；这部分仍是整体设计未完成项。 |
| 新候选Scala/Test compile | 已通过 | 尝试3在OS禁止网络/源写入下完成499应用Scala＋6测试源码编译，exit0；35手写/冻结依赖/输入/沙箱前后均未变。没有执行测试或服务。 |
| 全四流HTTP/数据库/浏览器/恢复窗口重签 | 未进行 | 保持1134原有签收，不用源码/文件锚通过冒充新运行认证；需独立资源窗口。 |
| 提交/发布 | 用户已授权本地提交（2026-11-05） | 仅纳入本轮成果，提交号以Git记录为准；不推送/发布。JS原`.gitignore`与银行README、continuation等他人dirty排除。 |
| retry、源码风格/inline anchors | 独立OPEN | 本轮不修复/重发runtime，不借统一入口关闭旧账。 |

## 受保护面和停止条件

实施验证阶段不提交、推送、发布、联网下载、创建 worktree、启动服务/容器；后续用户明确授权本轮成果本地提交，不包含推送/发布。不改三 runtime、共享应用或他人 dirty。重型执行位为1。retry/backoff/deadline 始终 **OPEN**，不能作为合理有限模型豁免；1134 有界发行不撤销、不重签。

物理删除/覆盖旧树、修改冻结制品、改变银行业务政策均超出本轮自动处理范围。若确有必须改变业务而缺少批准的冲突，保留为阻塞，不用改期望或降低门槛消除。新增并验证一个当前作者入口不等于已经将 BC 所有作者面切换；退出兼容期须其所有当前消费者改为新作者模型的机器派生物，并通过全量保真门。

## 实际执行记录

- 开始基线：JS `45f27a3c72a67746c2ce5c513a62b9515f700c64`，分支 `execution-compiler-v1`；`.gitignore` 已有他人改动，排除写面。银行 `0b42e6edbb3f1849d56191a6b08777c5b2a6cce6`，README/续接文档已有修改，排除写面。
- 本次工具列表没有 Serena 接口，未声称已激活；使用本地文件/命令工具。未重新全仓审计。
- 公共工具新增模块：`lib/author-{parse,surface,tree,migrate}.mjs`、`lib/source-index.mjs`、`lib/compat/metarch.mjs`、`lib/project/{query,narrative-links}.mjs`；复用现有compile/validate/decompose/project/apply/MCP接线，没有新增第二个源码写入器或业务专用compiler。
- 银行新增作者树/根配置、具名bindings、公共入口薄包装、当前合同测试及教程；旧命令只加明确历史选择，旧业务源/手写源/生成模板/runtime未修改。
- 实施验证结束时Git HEAD为JS `45f27a3`、银行 `0b42e6e`，当时未提交/推送。2026-11-05用户随后授权本地提交，本轮提交接在上述基线之后，不推送。共享`ingested-app`和`metarch-app` tracked状态核查为空；BC原dirty不认领。
- 各轮结果如下；更早失败保留日志，不以最终绿色抹掉修复过程。

### 第一轮：作者布局与来源闭环

- `node --test --test-concurrency=1 test/author-tree.test.mjs test/roundtrip.test.mjs test/snapshot-products.test.mjs`：61通过，exit0。新格式迁移、物理路径往返、源码原子来源通过；原legacy纯worker和canonical字节oracle未改。
- `node --test --test-concurrency=1 test/project-cli.test.mjs test/generate-update.test.mjs test/anchor-query.test.mjs test/generate-anchors.test.mjs`：143通过，exit0，日志 `/private/tmp/truthsrc-unification-core-tests.log`。
- 新项目查询闭环5通过：源变更→changed→update plan→apply→current，原子移动与fold重排不串源，手改生成文件拒绝且证据不改。
- `project-init/project-cli/project-query/saga-mcp`组合34通过，exit0。

### 第二轮：独立审阅与反例修复

独立只读审阅查出15项可复现边界。已逐项修复：重复/转义重复键；numeric ID字符串；结构payload覆盖/未知header；policy阶段/seq遗漏；迁移root版本/字段丢失；输入输出重叠；源变化和计划修改；derived surface错误指针；descendant/reorder定位；useCase身份；输入/证据一致捕获；anchor双向完整性；保留/当前文件分离；错误根decompose零写。

- 严格作者49新测试＋5现有：54通过。
- 来源负例＋现有project-query：24通过。
- migration保护扩至8项；MCP真实调用修复`await`缺失；两个独立代理分别实现request/presenter，集成测试从真实Counter产品重生接口后使用且手写字节不变。
- 最终 `npm run test:unification`：380测试，379通过/1显式BC外部oracle跳过，0失败，exit0；日志 `/private/tmp/truthsrc-unification-all.log`。
- 正式产品回归（product-generation-cli、product-contracts、product-plan、semantic-product-files、exact-value-products、domain-source-derivation、external-source-derivation、nominal-text-product-generation-v2）：70通过，exit0；日志 `/private/tmp/truthsrc-product-regression.log`。
- 教程自定义生成器、两代理手写协作、显式叙事关联、真实MCP组合6通过，exit0。

### 第三轮：实际BC与银行消费

- BC只读真实树适配：73通过，0失败/0跳过，五产物与外部BC compiler的值/递归键顺序/序列化顺序一致。1919已读文件、1917原子、1592notes、478次重复noteId保留；1个`.DS_Store`仅在显式选项下报告忽略。
- 加强的新作者门实际阻塞7项BC历史`origin.stage`/`payload.stage`冲突。五产物保真仍成立，但**BC全量新作者迁移/现役切换未完成**；未改旧事实，也未降低门槛。完整列表见 [COMPATIBILITY.md](COMPATIBILITY.md)。
- 银行287旧V1原子表示迁移在内存通过；新当前树加入15描述性原子后303原子，validate0hard/37notice、roundtrip成功。当前执行家族与旧V1相等，14编译产品payload逐项相等。
- 银行当前contract测试：4通过、1显式service集成跳过，exit0，日志 `/private/tmp/truthsrc-bank-current-tests-2.log`。旧模糊CLI拒绝，需要historical；新请求不读编号requests或旧authored绑定。
- 完整新service预览193源码＋4工具证据，applied=false，目标未创建；已从校验SHA的干净1134归档准备6个冻结JAR/POM，仅本地缓存，不重建/重发。
- `BANK_TRUTHSRC_INTEGRATION=1 node --test --test-concurrency=1 ../bank-wealth-demo/test/unified-truth.test.mjs`：5通过/0跳过，exit0，约290秒。完整193源码＋4证据apply、双向查询、临时副本真源错误码变更→过期→update plan/apply→repeat零写通过，原当前/旧V1不改；日志 `/private/tmp/truthsrc-bank-integration-1.log`。
- 最终BC oracle（含7项新作者冲突拒绝断言）再次73通过、exit0，日志 `/private/tmp/truthsrc-bc-final-oracle.log`。
- 两条叙事引用修正后：`npm run test:unification`再次379通过/1显式跳过，exit0；银行current＋v1-inputs/service-inputs/joint历史回归11通过/1显式完整集成跳过，exit0，日志 `/private/tmp/truthsrc-bank-final-contracts.log`。此前完整opt-in5/5结果单独保留，不以这次skip冒充重新完整执行。
- 最后公开入口/新增知识反例复验：统一suite381项，380通过/1显式BC跳过，exit0；银行最终源合同5通过/1集成跳过，0失败。
- 最终`target/truthsrc-service-build-candidate-20261105-02`生成197entry成功，status synchronized=true；TA故事关联40文件、SIP35、ReserveFunds4，叙事诊断为空。与旧generated失败候选区分，不清理旧数据。
- 银行`generated/`完整实际写入成功：193源码＋4证据＋ledger/anchors，共199文件。离线尝试1停在sbt启动的TrapExit替换SecurityManager，build exit1/验证器exit2；未进入Scala/Test编译。归档/1065供给文件/guard编译与探针均通过，199候选/35手写/7runtime文件前后未变；回执 `bank-wealth-demo/target/truthsrc-build-20261105-01/result.json`，进程全部回收。未删除证据、未放宽网络/写入guard。
- sbt TrapExit无有效禁用开关且checkWrite/checkDelete不委托旧manager，未放开替换。改用父进程继承的macOS Seatbelt：真实23项网络/外部写入/删除/symlink拒绝，Java manager移除与native两代子进程均不能绕过；3项允许的evidence写入通过，canary/control字节未变。独立probe=`target/truthsrc-os-sandbox-probe-20261105-zmmuSW/independent-result.json`，仅增加精确`/dev/null`设备例外，无网络例外。
- 实际kernel边界探针通过后尝试2仍在sbt启动exit2（1.885秒），stdout/boot update日志为空，compile/Test compile未开始；`target/truthsrc-build-20261105-02/result.json`为blocked，各输入/供给/沙箱前后不变。用新的有界启动探针定位exit来源，不改旧回执、不撤网络保护。
- 启动诊断两probe：原setting exit2/2.079s；fixed forcestart=true的about/exit0/7.058s。实际sbt在Unix boot socket被拒绝后，非交互false选择Exit2；true选择无socket继续，autostart仍false，网络/写入profile不改。当前`generated/current`再次生成197entry、repeat0、synchronized=true后进入全新尝试3。
- 第三次实际离线构建 **passed / exit0**：`generated/current`，回执`bank-wealth-demo/target/truthsrc-build-20261105-03/result.json`。9protobuf、499应用Scala源（含35手写以及派生源）和6生成测试Scala编译完成，build59.665秒。13条弃用/外部引用warning及dependency eviction提示保留；没有执行Scala测试/HTTP/数据库服务。199输入文件、35手写、7runtime、1065供给、current inputs及OS canary/control检查全部true，所有阶段process已回收。
- 独立银行叙事复核发现2条将execution-port字符串当technical-port的引用，已改为真实`BankTaEffectExecute`/`BankSipDispatchExecute`；新查询报告缺失/歧义叙事引用，新银行用例引用测试和公共引用反例通过。无资金规则/执行产品变更。

### 失败与修正记录

- 银行建树脚本创建bindings子目录时缺父目录，exit1；新树保留，不删除重来，核对后只续建缺失绑定与配置。
- 新增角色/context说明初次不在旧单refining sessionOrder内，validation拒绝；显式在新system声明追加实际使用的阶段，旧树不改。
- 收紧decompose父链后，roundtrip使用macOS `/var`别名导致symlink拒绝；改用`realpathSync(tmpdir())`，保护检查不放宽，银行current复测通过。
- MCP新异步tool最初返回Promise空对象；dispatcher改为await，实际stdio测试通过。
- 两代理协作集成测试的default结构误读`field`及双重转义换行，均修正为正式`target`与真实换行后通过；未修改领域期望。
- 最终银行公开`compile`（不仅capture/generate）发现remove-fold可选说明expression为undefined，完整不可变返回拒绝；来源索引省略不存在的说明键，补纯JSON断言后公开CLI exit0、14产品。新增尚未生成的作者知识查询以`currentSelection/not-generated`明确返回，不套用旧pointer。
- 一次工具报告临时目录ENOSPC；`df`仍有40GiB，本轮未清理他人文件，读取实际测试日志发现上述symlink失败，按实际原因修复。
- BC后期严格作者迁移失败是历史语义冲突，不是允许自动修复的工具错误，单列为未决。
