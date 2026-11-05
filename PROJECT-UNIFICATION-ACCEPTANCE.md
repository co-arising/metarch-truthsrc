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
- BC旧真源/现役缓存与共享应用只读。兼容验收保留真实树所有作者内容；第八轮新增显式只读消费接口，第九轮将普通读取槽接入显式bundle选择，并使未适配旧读写入口提前拒绝。无选择仍保留旧入口，不安装全仓默认配置。支持不了的生成面明确不支持，不回落旧树；整体BC现役作者切换仍须覆盖完整消费者集合，不能冒称完成。

## 轮次与验收门

| 轮次 | 必须交付 | 正向门 | 反向/保护门 |
|---|---|---|---|
| A 表达合同 | 根/上下文/身份合同，银行十三类承接表及当前/历史入口清单 | 每类有真实载体或明确状态，四流范围不缩水 | 不虚构故事/批准/五层完备，不拿历史快照掩盖缺项 |
| B 作者树与来源 | 新布局、显式旧格式迁移、来源索引 | 非银行、银行现役V1、BC真实树分别对账；新树物理路径及原子字节 roundtrip | 未知目录/文件、混合 inbox、身份冲突、缺 context、多 context 生成拒绝；旧字节门不改绿 |
| C 查询与再生 | 双向查询、状态、受控 update | 真实知识改变后过期、影响计划、再生、反查闭环 | 重排/移动不串源，歧义不选首个；手改代码/基线缺失/跨owner拒绝；MANUAL/KEEP保留，废弃文件不删除 |
| D 银行与教学 | 一个当前入口、完整四流知识承接，基础与高级教程 | 同一公共入口编译14产品并生成；非银行与银行真实切片可重现；自定义生成器与不重叠手写协作实跑 | 原tree/V1/绑定/1134/P23/journal不变；不凭生成通过声称新运行时验收；不访问旧秘密 |
| E 复核闭环 | 明确测试清单、命令、退出码、独立审阅与修正记录 | 新增与相关旧回归串行通过 | 失败保留记录并修复后复测，未验证项目保持未验证 |

## 当前交付状态与剩余门

2026-11-05续接已完成银行作者/文件与原运行窗口。用户随后接受“知识正文、现场来源、演进规则分离”，第八轮解除七项历史stage语义决策阻塞并完成保真迁移；第九轮又将普通Node/Scala读取槽接入同一显式bundle，旧混合读写入口提前拒绝，真实默认槽消费通过。**整体默认切换尚未完成，但不再等待用户解释两stage含义**：实际BC在JS通用领域门有258hard/657notice，全部历史缓存消费者/写回尚未迁移，不安装现役默认配置。当前成果不关闭独立retry账、不重签1134，也不冒称五层产品定义完整。

| 能力/目标 | 状态 | 证据或限制 |
|---|---|---|
| 唯一推荐作者语法与项目入口 | 已实现 | system/context声明、严格未知/重复拒绝、初始化与旧兼容回归通过。 |
| 真实银行作者收敛 | 已实现 | 当前303原子、15叙事载体、8具名技术绑定；旧287原子与执行家族保真。 |
| 14产品→193服务源码→文件回锚 | 当前教学输出已同步；运行保持原时点证据 | 公共plan/apply及完整银行变更闭环5/5有原证据；本轮仅经公共update刷新当前tool来源，193源码和canonical/request/compiled完全不变，repeat0 artifact-entry写入、current/verified/synchronized=true。历史cold02保持原字节/tool时点。 |
| 查询/过期/安全再生/MCP | 已验证 | 重排、移动、缺失、旧保留文件、新增未生成、手改/竞争反例；符号仅候选。 |
| 自定义生成器/两agent手写协作 | 已验证 | 普通CLI自定义生成、实际Counter产品驱动接口、两个独立手写模块再生后字节保持。 |
| BC五产物兼容与迁移预检 | 已验证；无显式兼容政策仍拒绝七项冲突 | 第七轮专属oracle92/92；第八轮启用固定legacy-carrier政策后实际表示迁移及五产品字节保真通过。原1917原子完整输入、七项原SHA/身份、122重复别名组保留，政策不授权全仓默认切换。 |
| BC真实Scala兼容消费 | 已通过，非现役切换 | 最终fixture编译及Node7/7真实通过；1592notes/1114merged/27aggregates，完整WorkshopState、三个MergeEngine投影和AssemblyResult相等；差异/双解析失败负例有效，无active cache fallback。 |
| BC协调记录提交技术门 | 已解除，获本次本地提交授权 | 原证据文档已找到并改固定引用；提交前再跑KB lint413文档0error/1warning、真实本仓compile及专属Scala11/11通过。只纳入本人四行，不捎带peer板/EP/metrics修改。 |
| BC新作者表示迁移 | 显式兼容迁移已验 | 用户接受分离原则；七项以固定legacy-carrier政策保留，不立双领域stage。1918作者文件/完整roundtrip及五产品字节保真，显式Node/Scala消费者同结果。 |
| BC普通读取槽的单源选择 | 第九轮已接线，独立验收见下 | `truthsrc.bc-input/v1`由同一显式本地配置选bundle；Node保持同步、Scala默认metarch槽不吞错。旧混合读写入口拒绝，拒绝不冒称功能迁移。无现役默认文件。 |
| BC全仓默认作者与消费者切换 | 未完成，普通读取接线不等于全仓切换 | JS通用领域校验258hard/657notice与迁移前相同，历史直读缓存/独立手术脚本及外部collector仍未全覆盖。不只改指针制造双写，不再等待用户决定stage；见[BC-STAGE-DECISION.md](BC-STAGE-DECISION.md)。 |
| 新候选Scala/Test compile | 已通过 | 尝试3完成499应用Scala＋6测试源码编译，exit0；续接unit02在空缓存重新编译并执行生成单元测试，见下一行。 |
| 当前生成单元测试 | 已通过（续接窗口） | 新候选unit02真实执行23测试／5Suite，零失败/取消/忽略/pending/abort；实际sbt装载副本199输入机器对账，全部11项保护检查true，build71.053秒。finite host Suite为零测试，不算四流业务覆盖。 |
| 当前四流actor业务回归 | 已通过（续接窗口） | actor01新候选499main／14test冷编译、41业务＋23生成测试全部成功；实际测试闭包/源码、15TA journal、16正常worker退出和全部15保护检查通过。无HTTP/真实数据库/跨JVM认证。 |
| 当前运行测试源码/classpath交接 | 已通过 | 新候选冷02：9PB/499main/11test（六生成+五冻结main），194实际classpath、189JAR及隐式引用检查、14保护门通过；实际运行消费者准入通过，未把编译算运行。 |
| 新候选24个跨JVM指定恢复窗 | 已通过 | runtime-crash02：24/24case、72独立JVM和72worker、509.445秒/exit0。原barrier/资金/PB/身份/TA/SIP断言全部通过，来源/制品前后不变；进程退出、无timeout/锁。不是Mongo故障注入或retry策略验收。 |
| 新候选HTTP/数据库/浏览器运行 | 最终database11通过 | final工具重新实跑initial/restart/refund/replay，21鉴权拒绝/5MySQL负例/三个Chromium流程53+35+14观察通过；32额外API GET、restart/replay Mongo全库摘要不变。sourceBound/inputsUnchanged全true；2容器/2relay/8051exec及主进程归还。09成功/10失败保留，未改业务/重签1134。 |
| 提交/发布 | 第七/八轮已本地提交；当前第九轮未提交 | 前次授权已完成工具6320623、BC26ef103e，未推送。第九轮“继续”不新增Git授权；银行8f139b9为外部文档提交不认领，peer .gitignore/EP/metrics/94金样及其余板修改继续保护。 |
| retry、源码风格/inline anchors | 独立OPEN | 本轮不修复/重发runtime，不借统一入口关闭旧账。 |

## 受保护面和停止条件

早期实施验证阶段不启动服务/容器；2026-11-05用户要求解决阻塞后，按已允许的必要独占Docker集成测试层，建立[本轮资源合同](../bank-wealth-demo/docs/TRUTH-RUNTIME-WINDOW-20261105.md)，只启停本轮已登记的自有资源，不操作共享服务。实施验证无联网下载、worktree、提交、推送或发布；用户在验收结束后另行明确授权本轮成果本地提交，不包含推送/发布或他人改动。不改三runtime、共享应用或他人dirty。重型执行位为1且已归还。retry/backoff/deadline始终 **OPEN**；1134有界发行不撤销、不重签。

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

### 第四轮：独立生成单元执行（2026-11-05续接）

- 用户要求继续未完成任务后，只推进无网络/无服务/容器的生成单元窗口。BC七项未获新裁定，现役源/缓存/共享应用不写；HTTP/真实数据库/浏览器/跨JVM恢复未执行。无需重审全仓或重新做文件闭环。
- 银行`verify-truthsrc-build.mjs`增加默认关闭的`--run-generated-tests`，隐含测试源码编译，只调用生成build固定`Test / test`。仅执行模式固定五Suite/23个名字；compile-only保持原适用范围。不会追加历史测试或手改生成build。`npm run test:build-verifier`运行41项定向保护反例，全部通过。
- 独立审阅修正了末尾取消、symlink CLI静默成功、测试子回执过早封存、compile-only过度收紧、进程结果合成测试缺口、日志不可用事实unknown及初始hash错误留证问题。真实Node监督反例另发现EPERM不能当进程组已退出，修复后复测通过；失败证据保留。
- unit01新候选冷编译并实际执行23测试通过，build71.624秒。日志揭示sbt使用本轮`global/staging`副本；199源实测逐项相同。未改旧回执，新增正式装载根及副本字节门，重新生成unit02复验。
- **最终unit02 passed/exit0：**银行`target/truthsrc-unit-20261105-02/result.json`、`generated-tests.json`、`actual-build-sources.json`。9protobuf、499应用Scala及6测试Scala冷编译，独立fork23成功/五Suite完成/零失败取消忽略pending或abort；build71.053秒，ScalaTest1.735秒。全部11项checks=true；实际staging199输入、原candidate199输入、35手写、7runtime、1065供给、当前输入及沙箱控制/canary验证通过，进程全部归还，无timeout/残留group。
- `GeneratedFiniteHostSpec`零测试明确保留，其他生成测试仅为状态查询、转换、配置/JSON和内存testkit恢复。**这不是付款/TA/退款/SIP业务或四流运行门通过。**更高层适配/资源及TA旧snapshot消费阻点见银行[运行验收说明](../bank-wealth-demo/docs/TRUTH-RUNTIME-ACCEPTANCE.md)。
- 银行源合同再次5通过/1完整生成集成显式跳过，包含validate/roundtrip、冻结V1字节和14产品保真；不是重复实跑旧5/5完整生成变更闭环。公共JS执行源码与作者树本轮未改，不重新运行前轮381套件冒作新成果。
- 本轮不提交/推送；前次两笔提交仍为基线，JS `.gitignore`及银行README/continuation他人dirty原字节保留。1134与runtime不重发/重签，retry/backoff/deadline仍OPEN。

### 第五轮：固定四流actor业务回归（2026-11-05再次续接）

- 用户再次要求继续后，未启动服务/容器，只推进可独立的testkit业务窗口。八个冻结`v1/test`文件只读挂载，配当前六生成测试文件；13Suite共64测试，包括41业务（付款6/TA8/退款7/SIP20）和23生成。原生成`Test / test`、fork及UnitNoNetwork不替换，固定manifest拒绝多/少来源，不整目录发现。
- 新增显式配置TA core/worker及七场景冻结测试fixture。原状态机机械迁移到唯一core，旧snapshot入口兼容委托，默认行为保留；新worker无旧loader/工具Git依赖。fixture保存实际历史文件/pointer/SHA，标historical-frozen-test-fixture，不冒称新作者知识。Journal原路径/锁/持久化实现不改，仅使用新`.local/mock-ta/truthsrc-actors-*`独占目录。
- OS无条件禁网，原23次拒绝probe保留；额外拒读旧两树、`.scratch`、`dist/v1`及旧loader，config禁止写，只允许本轮TA根。原源码/手写/runtime/旧测试/发行不改。独立审阅查出重开文件为UUID而非数字，已只修校验器和测试fixture再复验。
- `npm run test:actor-verifier`实际135/135通过、0跳过：原执行器41、新actor闭包8、TA core/worker86。当前源合同5pass/1显式完整生成集成skip，含validate/roundtrip及14产品保真。没有调用旧mock-ta测试、暂停runner或全仓discovery。
- **实际新候选actor01 passed/exit0：**银行`target/truthsrc-actor-20261105-01/result.json`、`actor-tests.json`、`actor-workers.json`。9protobuf、499应用Scala、14测试源冷编译；64测试/13Suite全部完成，零失败/取消/忽略/pending/abort。build89.037秒，ScalaTest16.172秒。15TA journal、16worker启动正常close/exit0/wait；实际staging199输入及14测试闭包、17actor相关输入和全部15checks通过，无残留group/timeout/取消，进程归还。
- 付款本金1000/0→900/100、订单last commit、结果五kind，TA相关性/非终态，独立退款全本金与三phase自动恢复，有限SIP前缀/修订/暂停/派发/首terminal等原断言通过；不更改业务期望。SIP部分TA终态仍是测试命令，部分恢复是显式Reconcile，testkit恢复不是跨JVM；**不能关闭全部25项矩阵或HTTP/数据库/浏览器/恢复窗口**。
- 本轮无公共JS生成器源码/作者改动，BC七项/现役切换仍待owner；验证结束时没有提交推送，runtime不重发、1134不重签，retry/backoff/deadline继续OPEN。原两轮生成-only回执保留，新actor模式结果单列，不改写历史证据。
- 用户随后明确“提交，然后给压缩上下文”，已授权第四/五轮成果的本地提交；仅纳入上述验收工具、显式模拟器核心/worker/fixture、对应测试及验收文档，不纳入派生应用/本机journal/供给或他人dirty。提交号以两仓Git记录为准，不推送。

### 第六轮：定点解除运行阻塞（2026-11-05）

- BC定点调查确认七项stage差异早于树拆分；Note注释与摄入约束矛盾，MergeEngine按payload.stage决定合并优先级。因此强行对齐不是无害格式清理。新增`BC-STAGE-DECISION.md`明确七个源文件/ID/seq/SHA、历史证据和推荐双阶段保留裁决；独立只读复核引用及七SHA全匹配。未改BC真源/缓存、未代签owner决定。
- 银行资源门独立解除：本轮owner登记重型位1、18761/18762/18763、全新数据/凭据及本地固定镜像；不复用共享Mongo/旧1134资源。BC协调板仅新增本人两行，其余原字节及97个dirty文件保留。
- 运行编译新增显式`--compile-runtime-tests`，固定五个SHA-pinned旧main加六生成文件、固定Test依赖，只编译并封存classpath。runtime01在应用/Test编译成功后拒绝错误Play目录假设，保留blocked；修正后新runtime02冷9PB/499main/11test通过，build66.540秒，194classpath/189JAR和14checks true。JAR隐式引用与所有构建/来源/字节码回执连锁验证，真实运行消费者准入成功。
- 独立内核验证发现Seatbelt localhost还匹配本机接口/wildcard，改为明确有界`host-local-reserved-ports`，不宣称exactIPv4恶意代码沙箱；真实服务源/配置/监听另限127.0.0.1。原build/unit/actor及磁盘恢复仍deny-all。18761往返和父子孙57次EPERM通过，所有探针资源归还。
- 新TA runtime adapter复用原显式core和协议，固定24case/service路径、来源fixture、EOF重开；不复制状态机、不读旧snapshot。进程监督保留source-bound/超时/取消/回收，并在写盘前脱敏；真实反例修正IIFE漏调用、取消/回调撤销及EPERM误报。
- Node明确合同组合`npm run test:runtime-verifier`已371/371通过，零跳过；同期源合同5通过/1完整生成集成显式跳过，含当前validate/roundtrip/14产品保真。不把Node结果或skip替代真实运行。
- **新runtime-crash02实际24/24通过**：72个独立JVM、72个TA worker，24次确切barrier后main-only SIGKILL及48次恢复/验证，509.445秒/exit0。原资金/PB/身份/TA/定投断言不变，全部process passed、无timeout/取消/终止错误/锁；sourceBound/inputsUnchanged全true。crash01首case的监督误报失败完整保留。不是Mongo故障注入、多writer或retry策略验收。
- 后续Node回归379项中378通过/1显式relay网络opt-in跳过、0失败；relay独立真实18762字节/EOF测试5/5另行通过。数据库窗口先后发现并修正Unixsocket的macOS bind位置、控制面root TCP准入、internal网络不发布宿主端口、Java NIO默认mapped地址与tcp4策略不符、BSON诊断表示和DEBUG输出上限；各轮失败数据/回执保留，容器及relay均按owner关闭。database06的initial真实浏览器现金+SIP断言成功，但后继因日志上限失败，不算完整服务门通过。
- **最终database11 passed/exit0**：最终工具版本完整四生产阶段/三个Chromium流程102条观察/额外32API GET、21鉴权拒绝/5MySQL负例全部通过，restart与replay完整Mongo摘要不变（147→147/213→213）。sourceBound/inputsUnchanged/controls全true，2容器/2relay/8051exec全部关闭。09成功与10失败保留、不补签；最终Node384项383通过/1显式socketopt-in跳过，独立socket5/5另有实跑。当前JS银行运行线已完成，BC语义裁决/现役切换仍阻塞。
- 验收执行结束时runtime未重发、1134未重签、无新提交推送。用户随后明确授权本轮成果本地提交；银行37文件、工具仓三文档进入本次提交清单，提交号以Git为准。不推送。BC本人两行已签出协调记录保留未提交：该仓KB lint实跑仍为既有缺失链接1error/1warning（412文档），提交前sbt compile亦未运行；不绕过该仓门或改他人文件消红。

### 第七轮：BC技术前置门与来源预检（2026-11-05续接）

用户要求“继续解决阻塞问题和剩下的问题”。本轮不选择七项stage语义、不修改新作者相等门，不写BC真源/现役缓存/共享应用，不重跑银行冷02/crash02/database11。BC只认领S2-59的证据链接/日期及新的一行协调记录，旧本人两行和peer修改保留；没有本轮Git提交/推送授权。

- **#65技术门已解除。** 原证据实际在旧前端仓 `/Users/zhongdj/Workspaces/ingested-frontend/docs/UX_ROADSHOW_FINDINGS.md`，HEAD `cd4dace297eef368c7f66f2aabd811f462a2702c`、blob `bb8f2cee0d134df8e042557a9cd56702851652f4`，工作树与Git原文一致，69–75行包含所引P0-4。BACKLOG改为该提交/行号的固定链接，不补造缺失文件。未访问远端，因此不宣称验证过GitHub可达或CI已下载前端。
- 完整 `node scripts/kb_lint.mjs`：412文档，0error/1既有汇总warning，exit0；warning为20份文档缺更新标记，未代改这些文档。证据 `metarch-truthsrc/.rounds/bc-migration-preflight-20261105-OkwyVg/kb-lint-doc-51de13e828e0.log`。
- **真实BC仓库compile通过**：JDK11.0.11/sbt1.11.7/Scala2.13.16，413源码、exit0、51.82秒，12warning保留。全禁网、仅本地file Maven供给；实际repo/source/class根由任务断言，不用副本编译冒称本仓。初次sbt因目录写许可判断而转staging的尝试被拒并保留，第二次才是本结果。429已跟踪构建/main输入、99dirty、truth/cache及Bloop文件无漂移，HEAD/index不变，两JVM已wait/reap。证据目录 `bc-compile-tshcawof`。
- BC adapter现在用同一次原字节捕获进行解析和SHA，保存完整目录/文件/显式忽略OS文件，返回前重检。source-bound迁移只接受同一捕获的snapshot+metadata，拒绝旧快照搭配新摘要。写前检查包括完整plan、compatibility/provenance和最后一次目录捕获，不能靠改format保留伪造绑定。
- `migrate-author --plan` 对作者阻塞返回 `truthsrc.author-migration-assessment/v1` JSON并exit2。列明所有冲突的物理文件/原SHA/header id/payload noteId/完整origin/payload/pointer、全部重复别名出现和文件/root/governance承接；不创建输出父目录、不发可写计划。不把兼容投影成功等同于新作者准入、Scala消费或现役切换。
- 独立审阅补上了compatibility统计篡改仍可保留语义hash、源驱动的declaration错误不能进入JSON报告、最终空目录变化漏检、复制plan后改format绕绑定四个反例；随后把旧格式自定义stage无新目录落点的情况记为显式unmapped blocker，不按payload阶段挪动或放宽stage枚举。首次新fixture把保真样本当成零领域诊断样本，定向测试1失败；改为精确比较迁移前后10个原诊断及路径映射，不降低validator或删问题。
- **最终JS回归通过**：实际BC专属oracle92/92；统一suite400项中399pass/1显式外部BC skip，另行启用BC oracle的完整统一suite405/405；默认消费者1项显式skip，真实消费者运行另列；银行当前源合同5pass/1完整生成集成skip，14产品保真。最终真实公共BC `--plan` exit2，1920文件/映射（1916原子表示、2治理、1根、1OS忽略），97目录、1917atoms/1592notes；七项完整SHA/身份/origin一致，122重复别名组600处/478额外出现全保留。未支持stage的unmapped新反例通过，没有源/目标写入。最终证据 `node-closure-udl6sk3f/summary.json`，前轮91/399结果另保留。
- 初次Scala消费者fixture的两个严格read-allowlist启动均SIGABRT/-6、0.021秒、无class/无测试；失败目录 `consumer-o8xyvd4y` / `consumer-02pzcafy` 保留，不用BC compile通过代替消费者运行。
- **真实Scala消费者最终通过**：`consumer-recovery-wlfhmk5f/result.json`，Java11启动exit0/0.251秒，单独fixture编译exit0/2.553秒，显式opt-in Node7/7（六子case）exit0/5.571秒。完整实际1592notes/1114merged/27aggregates，解析后的WorkshopState、三个MergeEngine投影、完整AssemblyResult的system/parked/warnings均相等。五产品字节也单独相等；合成的stage强行对齐、ID-only删便签均真实检出差异，两个坏JSON必须失败。五个消费者JVM退出0/0/2/2/1均符合预期并wait/reap，无遗留。它们只读来源绑定的私有副本：2725 class+11资源/其他文件、80目录及6JAR，前后完整清单一致。没有StateFileStore/现役缓存fallback，cwd始终为空，不生成应用。
- 最终消费者使用同一份OS策略验证Java启动、编译与测试：保留可信系统读取，拒网络、仅本轮目录可写、数据读取仅显式当前源/回执/私有副本，原BC缓存和sharedapps不读。初始strict read-allowlist失败均保留；不将其追认为成功，没有修改BC业务源码/断言/七项stage去通过。
- **银行旧候选新鲜度如实变化**：公共工具指纹因本轮迁移工具改动更新，`generated/current`与cold02在首次status中均为 `inputs=changed / evidence=verified / synchronized=false`；唯一差异是tool指纹，197个artifact文件均unchanged。这是既有粗粒度工具新鲜度门的正确报告，不是业务或源码漂移。随后仅对当前教学目录走公共受控再生，历史cold02/crash02/database11及其输入保持不变，不追改成新工具下已验。
- **最终教学输出已同步**：`teaching-final-20261105-212hq1g8/closure.json`记录公共plan/apply/repeat/status全部exit0。193源码、canonical/request/compiled和anchor字节完全不变；apply仅1来源证据entry改变/196相同，实际字节改动仅inputs.json及ledger。repeat0 artifact-entry writes/197相同，ledger/anchors仍有字节相同的物理重写，不冒零FS写入。最终current/current-inputs/verified/synchronized=true；197artifact、199managed、200物理文件（含旧build-owner marker）、2464文件锚。44保护域含cold02/crash02/database11及之前全部回执保持。最终tool指纹 `57553f5d1dbe22404ff9d2b6a6a48d6568543d1ffb385121e03c821a5215017b`。没有运行或重签认证。
- **最终保护复核通过**：`consumer-final-check-20261105T071216Z-e9274a6c14.json`核460/460消费者输入、11支持pin和8classpath全部匹配当前可执行源码；最终unmapped修改不在消费者import闭包，不追写旧manifest。初始110文件中101不变、9允许变化、0意外修改；BC94未跟踪文件/peer metrics/EP、三.gitignore、银行README/continuation、三HEAD与空index保留。仅删除本轮新协调行即可还原初始整板字节，旧两行原样。

本轮证据根为 `.rounds/bc-migration-preflight-20261105-OkwyVg/`，完成签出见 `signout.json`：执行位0，所有本轮JVM已wait/reap，没有服务/容器生命周期操作；新协调行已让出窄锁，旧两行及peer成果保留。未提交/推送。BC任务指标只读查询返回10月10日stale缓存，未把它当本轮新指标，也未向受保护的peer metrics journal追加。上述是文件/真实代码消费证据，**未经图验证**；不写图、不证明现役服务、任意生成profile或BC切流。owner选择和原retry账独立保持OPEN。

### 第八轮：用户接受来源/正文/合并分离后的会话收口

本轮用户明确来源现场回溯需求和产品成熟度：战略层较细，范围主要交AI，结构/框架/表现层没有完成有效定义；随后接受分离原则并要求推进收口。不是批准“origin=首次发现”、两领域stage或Miro自动写回。

- 新可选provenance声明与sourceRefs支持具体session、同阶段多session、多现场/多原子引用。已知URI原样保留，只有boardId无URI返回不可导航；boardURI+itemId仍只称board级。来源通过source-index和双向项目查询呈现，whole-atom Saga/pipeline/scenario去掉作者来源头后再做语义编译，不漏到产品。无来源的银行/BC不补造现场。
- 七项显式政策 `bc-seven-legacy-carrier/v1` 由CLI `--legacy-stage-policy`选择。首次导入核原SHA/位置/完整身份/seq/stage，七作者marker与system兼容selector双向对账；没有政策仍拒绝，修改源/缺标记/第八项不放行。旧payload与origin原样，marker不是领域阶段或新合并算法。
- 实際新作者根 `.rounds/provenance-separation-20261105-y16x8vtt/author/metarch`已创建1918文件；结构准入/语义表示保真及roundtrip1918atoms通过。执行一般 `validate`真实exit1：258hard/657notice，含BC的system:now/复杂表达式等JS语言未支持项。对照迁移前snapshot，全部硬诊断/提示多重集相等，仅路径/展示次序变化；未放宽校验。`actual-comparison.json`记录五产品逐字节相等/无伪造URI。
- 新 `export-metarch`只在新目录产出五产品和source-bound manifest，不改BC缓存。JS读端重编译作者核五字节；Scala读端核完整manifest/source/products后解析WorkshopState（不自称实现JS编译器）。BC Node显式`loadProductBundle`、Scala`StateFileStore.loadBundle`和`IngestedSystem.systemMetadataFromBundle`均没有旧cache/空系统fallback；默认入口不切换。
- 实际JDK11/sbt1.11.7离线真实BCcompile通过（3增量main/1spec），专属Scala11/11。证据 `bc-final-w2kcy_mr`，16.981秒、sourceUnchanged、wait/reap、无残留JVM。新真实bundle消费者 `consumer-fgtob06j` fixture编译0/运行0，1592notes/1114merged/27aggregates，parsed/三个merge/完整AssemblyResult/显式IngestedSystem全相等。
- Node初轮1失败为新policy单测误将无profile职责放到兼容validator；普通作者拒绝门原样保留，修正测试边界。Bundle首轮13失败是合成fixture缺use-cases，补全fixture而非跳校验。真实迁移首轮notice次序比较失败，改为保留重复次数的排序多重集比较（产品序列化仍严格顺序），后续16/16实际迁移+bundle成功。
- 此批多个代理因上游422/限流未执行或未收口，主会话接手；未计独立审阅通过，未执行的测试不充数。若工具报临时ENOSPC，实测df仍25GiB可用，实际日志保留；没有清他人文件。最终反例由主会话与实测测试检查，不声称独立复核完成。
- **最终定向门**：`npm run test:provenance`启用真实BC后322/322（含actual迁移及来源whole-atom与查询回归）；相关统一suite401项400pass/1显式BC skip；BC最新KB lint413文档0error/1既有warning。初始纯来源套件314项311pass/3显式外部skip，随后opt-in已实际执行；不混计次数。日志 `provenance-final-02.log` / `unification-final-01.log` / `kb-lint-final-02.log`。
- **当前教学输出同步**：`teaching-sync-eNQ8Dt/closure.json`，公共plan/apply/repeat/status通过，193源码/canonical/request/compiled不变，inputs.json和ledger两文件字节更新，repeat0 artifact-entry写入（仍可能重写ledger/anchors）。最终current/verified/synchronized=true，tool `e7969730333a4788ba4888d13eeb4e3ffbc013031c58059ba833b3729cbe588d`。首准备扫描因历史运行目录已有symlink拒绝，未开始生成；改为核源码根/原候选和公开result回执，不遍历私有历史运行数据。
- **并行现场变化明确保留**：银行仓被外部会话提交README与continuation，HEAD由f796362变为8f139b9e108451055f4a2b4618e0345ee5f69125（文档提交），这两文件SHA与本轮基线相同；本会话没有commit/push，不回滚该提交。最终观测另有非本轮JVM运行，本轮记录的77240/81056/81145均已wait/reap，不认领或停止其他进程。

证据根 `.rounds/provenance-separation-20261105-y16x8vtt/`，签出见 `signout.json`。最终 `final-protection.json`核102保护文件、1920原BC真源文件全不变，剔除仅本轮协调行后整板等于基线；本轮三个JVM PID已无，外部JVM不认领。原BC缓存、peer、银行历史运行/1134保持；本轮没有默认BC切换、服务/容器运行、Git提交/推送或runtime发布。旧“stage待owner”已由明确分离决定取代；整体默认切换与未支持语言/旧读写入口问题仍如实未完成。

### 第七/八轮提交前记录（2026-11-05）

用户在上述验收后另行明确授权本地提交并要求压缩上下文。工具仓24个本人文件、BC8个本人文件精确列出；其中AGENT_COORDINATION由HEAD加本人四行构造索引，不包含其他既有+7/−2修改。银行已有外部8f139b9文档提交，当前无本人新增tracked提交内容。

提交前重新实际执行 `TRUTHSRC_BC_ROOT=... npm run test:provenance`，322/322、0skip、exit0，57.991秒；KB lint413文档0error/1warning、exit0；真实BC离线`compile`及`testOnly ...MetarchProductBundleSpec`为11/11、exit0、12.266秒，550源码/构建输入前后匹配。记录PID9305已wait/reap、无本轮process group残留。另一个JVM88853的cwd位于工作区外的独立演示应用，与BC目标不交叉；未读取其args/env、未停该进程。没有再生银行/重跑历史运行窗口。

提交证据位于 `.rounds/provenance-commit-20261105-Jt12VT/`。以前各轮“未提交”是执行时点记录，不覆盖这次新授权；旧回执不改字段，实际新提交号以Git为准。不push，不夹带派生bundle/作者候选/缓存/私有数据、他人.gitignore/EP/metrics/金样或银行文档。

### 第九轮：BC普通读取槽与旧写链隔离（2026-11-05继续）

用户在6320623/26ef103e提交和压缩后要求继续。本轮按#23推进显式来源选择；不改原真源/cache、peer EP、冻结runtime或银行运行窗口，不安装现役默认输入配置。独立计划为BC `EP_Truthsrc_Input_Selection.md`，证据根 `.rounds/bc-input-selection-20261105-84d03bc5f5ef/`。

- `truthsrc.bc-input/v1`四字段技术配置由`TRUTHSRC_METARCH_INPUT`指定；无变量时可发现本地默认文件但本轮不创建。严格拒绝未知/重复/空值及路径别名；Node同步五产品接口每次重验并返回副本，进程中选择、manifest或reader变化须重启。不是新的领域真源或业务生成profile。
- Scala metarch默认槽和`IngestedSystem.systemMetadata`接同一选择，选中后加载/组装错误不能变成空系统；旧save/path拒绝。其他历史workshop行为按原接口保留，不将选择扩成任意多上下文。
- 旧bridge/decompose/validate/roundtrip、land/service-sync、full-load/full-cycle、gen/kn pipeline、code-FQN写回、S77缓存/apply与混合index/provenance/relations/snapshot及对应MCP入口前置拒绝。拒绝不是完成这些功能的迁移；18处JS入口受本轮窄改，另含Scala入口。独立历史cache手术脚本和工作区外旧路径collector未纳完整切换认证。
- 258hard分类为V13未知表达式180（134system:now、46其他）、V3历史stage7、V11读模型source17、ES2timeline54；657notice为V2 316/ES3 51/ES4 46/CS3 27/CS4 1/CS6 7/CS8 209。数量是诊断次数，不全是语法差异，不补造字段、不修改七原值、也不由未知表达式推断语义合法。
- 实际Node普通读取验证 `actual-iC65dG/results.json`：新bundle从原已迁移验证树导出，原BC编译为独立oracle，五产品键序/数组序/序列化字节完全一致。传不存在的旧tree/root仍正常消费；selected compile-check退出0，默认compile及直接compileTree按预期退出1，原1920真源/5缓存/1918旧作者/6旧bundle文件前后不变。首个`actual-OGKgca`仅因macOS注入`__CF_USER_TEXT_ENCODING`被harness拒绝，失败保留。
- 定向BC选择/拒绝首门66，新增别名和KN门后70；服务夹具缺selector依赖已补最小copy，最终BC三文件90/90。独立拒绝测试中26为静态检查、12为隔离执行（含两项stubbed loader缓存热读）；不把静态检查或stub当全部实际服务入口已执行。
- Scala首轮`scala-zmp9hm2v`启动在私有TMP路径过长的Unixsocket限制退出2，0编译/0测试；package测试脚本变更未及时列入保护allowlist又挡住后继启动。均保留。新短私有`/private/tmp/bci-qmwthkzs`及明确本人package差异后，`scala-retry-g4nko4_i`真实repo断言/compile/91tests全部exit0，80新选择+11旧bundle；554源码/构建输入含元数据完全不变，62766wait/reap且无组残留，外部demo未操作。
- 扩展Node首轮`node-final-aa4840949e8c`315pass/7fail，是TMPDIR错误放在工具仓内导致PROJECT_OUTPUT保护拒绝，不改validator消红。使用仓外私有临时目录的`node-retry-5b475a6b2422`实际来源322/322、选择10/10、BC90/90，422passed/0failed/0skip/0timeout；源码SHA前后一致，全部进程wait/reap。

- 真实Scala默认槽 `consumer-DLMnirGk/result.json`：fixture编译0、实际输入0、坏version/缺manifest两拒绝模式各0；在OS禁止读取旧BC真源和cache的同一策略下，1592notes/1114merged/27aggregates完整解析、三个MergeEngine投影、整个AssemblyResult和两次默认IngestedSystem结果相等，旧save/path拒绝，九检查全true。空cwd保持空，编译和三个运行JVM stderr空，全部wait/reap，无进程组残留；554源、classpath、bundle和源清单保持。不是应用生成或服务认证。
- KB索引通过`kb_lint --fix`只添加一个新EP条目；414docs/0error/1既有warning，两次exit0，418其他文档保持。证据`kb-83be3c451c7b9f41-result.json`。独立代理的总审阅只返回“无额外发现”而未交付完整前序列表，不计完整独立审核；另一定向静态依赖复核确实找到并修复service-sync夹具缺copy问题。

- 最终只读预签出`final-check-1aa383fb8405.json`核2537保护文件：2535原样，两例外精确为本人package新测试script与本人协调两行；剥除本人行后peer整板等基线。三HEAD/index保持、staged为空、银行clean；源码/实际bundle/旧作者保持，193教学源码和197ledger artifact不变，current/verified/synchronized=true，tool指纹仍`e7969730333a4788ba4888d13eeb4e3ffbc013031c58059ba833b3729cbe588d`，没有必要再生。允许提交候选为本人39文件（BC35/TOOL4）；全工作树136文件中97项peer不认领，不能把该全清单用作git add。预检查26个本人PID已无，外部88853仍在且未动；随后普通全Scala回归单独记账，不把该预检查当其签出。

- 普通全Scala首跑`scala-full-8ginngwz`实际1157pass/1fail，全部1158执行、无排除。唯一失败为KnGraphSystemSpec写固定`out/kn-system-metadata-v99999.json`被OS拒绝，文件未创建；全测试JVM的onFailure导出后exit0不作为通过。先验扫描漏掉这一固定写点的事实保留，不将其称安全预检完成。原554source/2537保护保持，74330wait/reap；后继只抽原loadExport文件读体为包内私有重载，测试迁独占tmp并断言原精确错误，default发现/AB语义不改、不开放out写入。

- **最终全Scala通过**：`full-final-2e5q6zg4/result.json`真实repo preflight/compile/test/export全部exit0，1158/1158（ScalaTest1145/125suites＋mUnit/JUnit13），无fail/error/abort/排除；新2文件重编，旧固定out临时文件仍不存在。sbt84846退出后对最终classpath重新编译并执行实际默认槽oracle，九正检查及坏version/缺manifest两拒绝全部通过。2748classes/resources摘要绑定，554source/2537保护/三HEAD-index保持；全部自有组空/wait-reaped，无信号/timeout，外部JVM未动。两文件隔离修复另有完成的独立静态review无发现，不扩为全工具链独立审计。

本轮未提交/推送；输入选择读取子批验收完成，整体BC现役切换仍保留。

### 失败与修正记录

- 银行建树脚本创建bindings子目录时缺父目录，exit1；新树保留，不删除重来，核对后只续建缺失绑定与配置。
- 新增角色/context说明初次不在旧单refining sessionOrder内，validation拒绝；显式在新system声明追加实际使用的阶段，旧树不改。
- 收紧decompose父链后，roundtrip使用macOS `/var`别名导致symlink拒绝；改用`realpathSync(tmpdir())`，保护检查不放宽，银行current复测通过。
- MCP新异步tool最初返回Promise空对象；dispatcher改为await，实际stdio测试通过。
- 两代理协作集成测试的default结构误读`field`及双重转义换行，均修正为正式`target`与真实换行后通过；未修改领域期望。
- 最终银行公开`compile`（不仅capture/generate）发现remove-fold可选说明expression为undefined，完整不可变返回拒绝；来源索引省略不存在的说明键，补纯JSON断言后公开CLI exit0、14产品。新增尚未生成的作者知识查询以`currentSelection/not-generated`明确返回，不套用旧pointer。
- 一次工具报告临时目录ENOSPC；`df`仍有40GiB，本轮未清理他人文件，读取实际测试日志发现上述symlink失败，按实际原因修复。
- BC后期严格作者迁移失败是历史语义冲突，不是允许自动修复的工具错误，单列为未决。
