# ArtifactType 统一说明

本目录是产物说明的唯一维护源，描述“什么输入，由谁加工成什么产物，谁维护，如何装配和验证”。它不是银行业务真源，不替代compiler的语义schema，也不是任意第三方generator的白名单。

- [Scala CQRS / 多模块 / Saga / Monarch](scala-cqrs/README.md)：主目录。
- [TypeScript 类型](typescript/typescript-types.md)：独立语言目标。
- [工具与派生证据](tooling/artifact-generator.md)：generator、manifest、ledger、来源/回锚、知识图、验证运行器。
- [漂移与版本差异](DRIFT.md)：旧说法与实际状态，不通过改文档掩盖代码债。
- [机器目录](catalog.json)、[来源锁](sources.lock.json)、[覆盖清单](coverage.json)：分别记录类别/变体、可复核输入和全部清点处置。
- [来源与许可](SOURCES.md)：仓库别名、固定版本、证据精度和许可。
- [维护与校验](MAINTENANCE.md)：目录更新、兼容导出、版本语义和防遗漏纪律。
- [P0原验收](ACCEPTANCE.md)：该批覆盖数字、真实测试、失败保留与未纳入范围。
- [能力合同](CAPABILITY-CONTRACT.md)、[派生能力矩阵](CAPABILITY-MATRIX.md)及[本批验收](CAPABILITY-ACCEPTANCE.md)：分别说明v2所有权/生命周期/证据层级、全部类别与生成入口的双向映射、真实执行与剩余边界；登记、样例生成、编译、行为验证和最终审定分开计数。
- [目标profile与命名合同](scala-cqrs/TARGET-PROFILES.md)、[第二批验收](TARGET-PROFILE-ACCEPTANCE.md)：显式兼容保护、新推荐candidate、集中命名/类型闭包及独立四模块参考；未启用新生成入口，未自动批准金样。
- [领域kernel family1合同](scala-cqrs/DOMAIN-KERNEL.md)、[第三批验收](DOMAIN-KERNEL-ACCEPTANCE.md)：第三批显式候选入口；核心值/协议/State/RuleParams与必要真实PB转换支撑，不切银行或完整modular应用。
- [有限聚合 family2合同](scala-cqrs/AGGREGATE-CORE.md)、[第四批验收进度](AGGREGATE-CORE-ACCEPTANCE.md)、[阶段提交历史快照](AGGREGATE-CORE-CHECKPOINT.md)：显式no-external候选；纯decide/fold、Actor协议、本地生命周期及同样例能力观察逐门验收，不代替完整四模块或最终批准。
- [旧family1最终观察历史](evidence/capability-domain-kernel-final-history.json)：原16声明、74条变体引用和原receipt路径/字节保留，不重签、不计current。
- [现状盘点与剩余落地计划](STATUS-AND-IMPLEMENTATION-PLAN.md)：保留校准前125类/66项登记的原始盘点，以及先校准能力台账再按依赖家族收敛的路线。

## 第六批持久化与读投影：运行资格通过，最终回归进行中（2026-11-09）

[有限family4合同](scala-cqrs/PERSISTENCE-READSIDE.md)对应显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1`：Warehouse唯一业务作者与独立技术binding经8产品及单一writer形成kernel＋glue；不自动组成四模块应用或生产journal。

catalog `2.5.0`登记125类、571变体及43个producer，新增35个本族变体、34项输出合同，真实主样例39个producer条目。当前28项观察由12个既有生成样例、三个旧族及本族同样例分层资格构成；完整矩阵以[派生结果](CAPABILITY-MATRIX.md)为准，不将合同数、文件数、类别数或测试数互换。旧current06的24项观察及544处引用已[保真历史化](evidence/capability-persistence-readside-prior-current06-history.json)，旧回执不重签。

独立参考14项测试及双JVM文件重放通过；最终generated和installed各通过44个阶段：14项独立测试、原/同名Frame各4项shape、6对运行时正负控制、3正/2负编译控制及改名ABI正编译。H2默认IGNORECASE设置误判曾导致真实失败，已按独立3库实测修复并复验，失败回执保留。旧14完整plan共942条目和module11条目完整恒等。JDBC正常关闭/重开重放不证明生产Actor journal耐久性、强杀断电或MySQL/Mongo兼容；build、SQL及config不冒称Scala编译资格，final-approved仍0。

**完整Node、BC/Play副本、八仓来源与最终保护仍按收口门执行，本段不提前裁定整批完成。** 详细运行与限制见[本批验收进度](PERSISTENCE-READSIDE-ACCEPTANCE.md)。

## 第五批收口记录（历史，2026-11-08）

[有限多模块接缝合同](scala-cqrs/MODULE-SEAMS.md)已形成唯一作者树、两个严格产品、7份生成生产Scala与3份外置手写实现的完整候选链。A/B已通过，C/D的四模块编译、独立业务oracle、ABI/缺实现/变异控制、五种布局以及离线安装消费已执行；不自动组合Actor或完整CQRS应用。[最初暂停检查点](MODULE-SEAMS-CHECKPOINT.md)保留历史，不再代表当前实现状态。

catalog `2.4.0`登记 **125类、536变体、42个producer（15现役/20旧式/7退役）**，current06共 **24条当前观察**：旧12样例各一份generation，三个有限family各有完整计划generation及同样例代码generation/compiled/behavior。现役JS代码应生成及已定位65类/105变体，generated64类/103变体，compiled和behavior各23类/37变体，final-approved仍0；派生证据generated2类/2变体。build仅有generation资格，手写实现不计生成算法。

旧current02的20条观察及510处引用仍[保真归档](evidence/capability-module-seams-prior-history.json)，不重签为current。完整公共Node已执行：4099项中4084通过、15项既有opt-in跳过、0失败；artifact68/68、onboarding34/34、BC文档dispatch2/2通过，KB为0错误/1既有警告。BC50/Play32经公共同步，八仓3424来源及副本检查通过。原full12外层预算耗尽的FAIL保留；full17使用新身份完成，不改测试或业务deadline。各门及最后文档保护复核的范围见[第五批有限验收](MODULE-SEAMS-ACCEPTANCE.md)，不以24条观察替代执行结果。以下第四批数字是当时历史事实，当前资格以[派生矩阵](CAPABILITY-MATRIX.md)为准。

## 第四批收口时登记状态（历史，2026-11-08）

catalog `2.3.0`：**125类、523变体、41个producer、534条输出合同；active observations为20**。本轮复用13个family1类别并关联10条纯行为/Actor职责，共23条新profile变体，不增加类别。`artifact-generator`是手写工具；现役JS代码/装配应生成及producer已定位为63类/95变体，generated为62类/93变体，compiled及behavior-verified各20类/29变体，final-approved为0。派生证据应生成3类/3变体、generated2类/2变体，其余层级为0。资格限实际同样例，不推广至全profile。

新profile为 `js-aggregate-core-candidate-v1`，实际入口 `scala-cqrs-aggregate-core-v1`、manifest `scala-cqrs-aggregate-core@1`。主Warehouse源码合同24 entries = 22份独立参考生产源码 + 2份生成测试；同一Aggregate文件跨root/behavior职责只计一次。exact/ops样例库存更大，不能将Warehouse无exact产物的样例当全输出合同覆盖。

生产源码已冻结，主参考／生成双lane、Counter变体及旧入口回归通过；原12及family1完整计划恒等。现役current02观察已真实重生成登记，artifact68/68、完整Node **3623通过／0失败／15既有opt-in跳过**、离线安装及上手33/33通过。原close01的1回执安装路径失败保留，未修改测试或旧receipt。**第四批有限候选按合同完成工程收口**；不等最终架构批准。旧失败和回执不覆写，构建仅generated；当前结果与来源／副本收尾见[第四批验收](AGGREGATE-CORE-ACCEPTANCE.md)。初／二／三批报告保留历史资格；无银行或服务切换、完整四模块交付或最终批准。

## 四种不同的计数

语义产品、产物类别、生成器kind和物理文件不是同一种对象。`rules`可同时写规则与参数；`policy-exec`包含纯策略、Handler、Mechanics、Runner、Bootstrap；一个接口文件可含trait、伴生类型和Bridge。catalog保留这些多对多关系，不凑“一个kind一页”。

## 如何查

先按职责进入Scala/工具目录，再看每页的输入、生产与所有权、装配和适用版本。`catalog.json`可用类别ID、旧文档名、Scala模型名和kind查找。兼容目录的`catalog-index.json`保存原文档映射和central版本；BC/Play旧路径是可离线读取的派生副本，不应独立手改。

来源引用形如 `bc:src/main/...#symbol`，是本页可读的仓库内定位，不是假远端下载链接。完整revision/SHA由source lock提供。行号可能随编辑变化，符号/文件摘要才是核对依据。

## 检查命令

在工具源码或安装后的包目录运行：

```sh
node tools/artifact-docs-check.mjs --local
```

该检查不需要BC、银行、di-poc、JAR、sbt、Docker或数据库；通过只代表包内目录与声明的本地生产者一致，不代表重新验证全部外部源。

维护者进行完整复核时显式提供所有外部仓库：

```sh
node tools/artifact-docs-check.mjs --cross-repo --require-all \
  --repo bc=/absolute/path/backkend-codegen \
  --repo play=/absolute/path/playAkkaCQRS \
  --repo dipoc=/absolute/path/di-poc \
  --repo bank=/absolute/path/bank-wealth-demo \
  --repo saga=/absolute/path/saga-core \
  --repo monarch-core=/absolute/path/monarch-core \
  --repo monarch=/absolute/path/monarch-persistence
```

缺仓/源漂移/新文件/新kind不得显示完整通过。扫描只读源代码与文档，绝不执行被扫描的generator、启动服务、读运行库凭据或刷新业务数据库。当前银行生成示例是被核的本机派生输入，新clone若无该示例会明确报告未核。

## 维护规则

修改职责说明后同步catalog、来源证据和coverage；新增producer/输出必须明确类别与profile。不要以`misc`、平台豁免、删除难分类项或只取前N个样本获得零遗漏。来源范围包括普通、正式、条件和retired入口；不支持的能力显式写不支持。

兼容同步默认只检查：`node tools/artifact-docs-sync.mjs --target bc --root /absolute/path/backkend-codegen --check`。写模式要求精确原摘要清单并只写指定文档，不能代改生成源码或原台账。发布tarball并不等于发布registry，本目录不提供虚构下载地址。

R2文档纳入不等于银行已切换R2。金融规则、PB/PID、冻结制品和旧失败证据均保持原合同。
