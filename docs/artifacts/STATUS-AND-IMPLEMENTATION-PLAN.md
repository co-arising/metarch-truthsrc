# ArtifactType现状盘点与剩余落地计划

记录日期：2026-11-07。用户要求保存本次盘点，并说明剩余工作的落地方式。**本页交付是报告与实施路线，不是剩余生成器已经完成，也不构成发布、运行库升级或共享资源操作的授权。**

本页沿用已完成P0和后续P1–P4成果路线，不重做类别清点工程、已实现公共验证闭环或聚合参考切片。数字对应本次捕获状态；后续实施必须从实际catalog及证据重新派生，不持续手工维护另一份类别真源。

## 第八批 API／有限 Play 应用（2026-11-11，有限工程收口）

[本族合同](scala-cqrs/PLAY-APPLICATION.md)把唯一作者树的十产品落到四模块应用：DTO/service/controller/routes/Twirl/Loader、真实LevelDB journal reader、H2读侧及资源组合根。独立参考、实际生成、离线安装后主样例与真实名字/包变体已经通过sbt/direct compiler及HTTP／存储／生命周期／故障验证；六项权限/签名/依赖负控、迟到Ready/Loader、漏释放负控和四个生成suite也已执行。16完整旧plan992项恒等。

catalog2.7.0／638变体／45producer／36观察已落盘，原28观察保真历史化。能力文档74/74通过；完整Node4345项中4328通过、2安装consumer超时、15既有跳过；测试侧消除重复捕获后，受影响2项复验通过，原全量FAIL保留。BC50／Play32受控同步、八仓3655来源及27451文件＋2362元数据保护通过，120进程运行证据已组合对账。详见[验收记录](PLAY-APPLICATION-ACCEPTANCE.md)。本批按有限合同收口，不扩成银行迁移、runtime发布、所有家族自由组合或最终架构批准。下文早期批次数字仍是对应历史。

## 第七批 Strict Saga / Monarch R2：有限工程收口（2026-11-10）

[新非银行合同](SAGA-MONARCH-R2.md)与[验收记录](SAGA-MONARCH-R2-ACCEPTANCE.md)对应唯一作者树、八产品及固定dev.r2／Strict Saga装配。主样例及typed Run／retry／whole Carry的generated与installed证据已闭合；installed主28恢复窗、八项精确变异及注册／命名控制通过。catalog2.6.0新增20变体，19代码项达到同输入行为层，build仅generated，final-approved仍0。

完整Node原4314项中的30失败保留；7个影响suite复验178项通过，不重签原FAIL。BC50／Play32兼容文档、八仓来源与历史保护通过；旧28观察[按原字节历史化](evidence/capability-saga-monarch-prior28-history.json)。本批不迁移银行、不发布runtime或完整modular应用。下文较早批次数字均为各自历史，不是当前资格。

## 第六批持久化与读投影：有限工程收口（2026-11-09）

[有限family4合同](scala-cqrs/PERSISTENCE-READSIDE.md)对应显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1`：Warehouse唯一业务作者与独立技术binding经8产品及单一writer形成kernel＋glue；不自动组成四模块应用或生产journal。

catalog `2.5.0`登记125类、571变体及43个producer，新增35个本族变体、34项输出合同，真实主样例39个producer条目。当前28项观察由12个既有生成样例、三个旧族及本族同样例分层资格构成；完整矩阵以[派生结果](CAPABILITY-MATRIX.md)为准，不将合同数、文件数、类别数或测试数互换。旧current06的24项观察及544处引用已[保真历史化](evidence/capability-persistence-readside-prior-current06-history.json)，旧回执不重签。

独立参考14项测试及双JVM文件重放通过；最终generated和installed各通过44个阶段：14项独立测试、原/同名Frame各4项shape、6对运行时正负控制、3正/2负编译控制及改名ABI正编译。H2默认IGNORECASE设置误判曾导致真实失败，已按独立3库实测修复并复验，失败回执保留。旧14完整plan共942条目和module11条目完整恒等。JDBC正常关闭/重开重放不证明生产Actor journal耐久性、强杀断电或MySQL/Mongo兼容；build、SQL及config不冒称Scala编译资格，final-approved仍0。

**第六批按有限候选合同工程收口，不等最终批准。** 完整回归、原失败到新通过、来源及最后文档保护的精确范围统一见[本批验收](PERSISTENCE-READSIDE-ACCEPTANCE.md)；后置文档不追认为原测试输入。

## 第五批有限接缝（历史，2026-11-08）

家族3已实现[显式module-seams候选](scala-cqrs/MODULE-SEAMS.md)：单Parcel作者树经contract/composition两产品、lowering/model/templates和唯一writer，输出7份生产Scala并只读消费3份外置手写实现。A/B正式门、C/D主样例和五布局、ABI/缺实现/两业务变异、安装移址与三输入stale/update已有执行结果；没有启动银行或R2。最初产品未实现、missing-import RED及obs0停点保留在[历史检查点](MODULE-SEAMS-CHECKPOINT.md)，不能再用于描述当前实现。

当前catalog `2.4.0`为125类/536变体/42producer，**active observations=24（current06）**；现役JS代码应生成/定位65类105变体，generated64类103变体，compiled及behavior各23类37变体，final-approved=0。三份手写实现保持handwritten、routes为空；原14个modular reference-only不被覆盖。旧20观察/510引用继续[保真退休](evidence/capability-module-seams-prior-history.json)，失败候选不改写。生产冻结下完整Node已执行4099项：4084通过、15项既有外仓opt-in跳过、0失败；artifact68/68、onboarding34/34及BC文档2/2通过。BC50/Play32受控同步、八仓3424来源及snapshots通过；只更新82条来源，其余3342条不变。两次有界只读review无新增具体缺陷；原full12预算FAIL保留，full17新身份完成，不改测试或业务timeout。详细结果、最后文档保护复核与非结论见[第五批有限验收](MODULE-SEAMS-ACCEPTANCE.md)。下文第四批及更早数字仍是对应批次历史，不是今天的现役完成率。

## 第四批family2有限交付（历史，2026-11-08）

catalog `2.3.0`登记125类、523变体、41个producer及534条输出合同。新增 `js-aggregate-core-candidate-v1` 对应实际 `scala-cqrs-aggregate-core-v1`／`scala-cqrs-aggregate-core@1`：复用已有13类family1基础，再关联10类纯decide/fold及有限Actor职责，共23条变体，不复制category或同一Aggregate文件；手写generator不计生成代码完成率。当前现役JS代码/装配应生成及定位为63类/95变体，派生证据为3类/3变体。

**active observations=20；现役JS代码/装配generated为62类/93变体，compiled及behavior-verified各20类/29变体，final-approved=0。** 原16观察、74条引用及旧锁下正确资格保留在[historical-not-current索引](evidence/capability-domain-kernel-final-history.json)，receipt原路径/字节不变。初/二/三批原报告与历史通过事实不洗掉，也不自动冒今天的current资格。current01八份family回执的command含本机路径，已用current02实际重新生成并登记便携描述；原20回执／510引用保真存入[独立历史索引](evidence/capability-aggregate-core-current01-history.json)，原能力与安装路径suite14/14通过。

[本族合同](scala-cqrs/AGGREGATE-CORE.md)、[当前有限验收](AGGREGATE-CORE-ACCEPTANCE.md)与[阶段提交历史快照](AGGREGATE-CORE-CHECKPOINT.md)分别记录技术约束、逐门结果与原FAIL。主Warehouse完整源码合同24 entries = 22独立生产参考（18 Scala + 1 proto + 3 build）+ 2生成测试；最终reference/generated的35／37案例及控制通过，Counter七fold8项和谓词16项通过。生成测试只是基线，不替代独立oracle；availability=implemented不等最终批准。

生产／注册／scaffold／package／classify已冻结，旧12＋family1完整计划恒等；family1真实22／23与旧Warehouse各24回归通过。20现役current02观察已实际生成登记。完整Node最终close02为 **3638项：3623通过、0失败、15既有opt-in跳过**；artifact68/68，离线安装及上手33/33通过。首轮12缺观察失败及close01单个安装路径失败作为历史保留，没有改测试或旧receipt。23类别当前说明已修正；BC50／Play32受控同步实际改27项，3370来源只更新这27条bytes/SHA，其他3343保持，local／八仓／副本检查通过。第四批按有限候选合同收口，不重做前三批；build只有generation资格，direct compiler不冒sbt执行，无银行／服务切换或架构批准。

**第一批历史续接实施（保留原记录，非当前完成率）：** 下文保留校准前的125类/284变体/66项登记事实，不能当今天的完成率。第一批已形成v2[能力合同](CAPABILITY-CONTRACT.md)及[派生矩阵](CAPABILITY-MATRIX.md)：覆盖原全部记录并追加漏登/拆分通道，现125类、473变体、39manifest；类别未增加。现役JS代码/装配61类有明确producer，其中60类有本批纯生成样例，另有3类派生证据中的2类已观察。新台账下编译、独立行为及最终审定仍为0条有效晋升；旧局部Scala/银行验收保留在原报告中，不自动套到本次全部profile。批次执行事实见[校准验收](CAPABILITY-ACCEPTANCE.md)。

## 一、盘点结论

| 用户的问题 | 本次数字 | 数字真正表示什么 |
|---|---:|---|
| 完整ArtifactType清单 | **125类** | 来源范围内的职责类别；113类在Scala CQRS目录，12类属于工具/证据/其他语言 |
| 已记录在案 | **125类** | catalog登记齐套，另有284条适用profile变体；不是284个独立类别 |
| 已完成文档说明 | **125类、125份类别文档** | 职责、输入、所有权、结构、装配、回锚、验证和版本章节齐套；不等每个实现状态已被语义审定 |
| 已有JS生成支持 | **登记66类；准确核验数尚未建立** | 54类`js-formal`、11类`js-legacy`、1类`js-ordinary`标为implemented；不能据此宣称66类已完成原生生成 |
| 目标模板达到最终“完美” | **0类已有最终验收记录** | 已有可用代码及局部参考测试，但没有完成适用版本下的最终质量签收；不表示0类可使用 |

另有**39份generator manifest**：10份正式产品profile、22份顶层旧式/普通入口、7份嵌套retired入口。manifest、物理源码文件、逻辑职责类别和语义产品必须分别计数，不能互相替代。

66项登记的所有权拆分为49 generated、13 mixed、4 derived。这些仍是待核的元数据，不是额外完成证据。125类中也包含应由运行库、手写扩展或历史适配承担的职责，**不能用125−66推算“缺59个生成器”**，不能通过给运行库内核补一个复制模板凑覆盖率。

### 本次核数依据

- 权威类别与变体：[catalog.json](catalog.json)；捕获时文件SHA256为`9087b7e147041da020ebab34a321de09896f6f6835bd1ae1d8b0459c38172ae8`。
- 来源及计数：[sources.lock.json](sources.lock.json)、[coverage.json](coverage.json)。此前已复核8仓3181来源文件，但文件来源全覆盖不等生成能力或设计质量全覆盖。
- 基线HEAD：工具`31a1480db11fbe611b11be38fcc90ae4570c03ba`，银行`cf75af01b71607697548277f1ffbc04a27256ffd`；捕获时还包含上一批已测试但未提交的公共验证闭环改动。不能只用HEAD描述整个工作树。
- 本次直接运行`checkLocal()`通过：125类别、39 manifest；文档/来源机械校验的保证以[维护说明](MAINTENANCE.md)为准。
- 当前“JS支持登记数”的复算方法：对`catalog.categories`按类别去重，选存在`variant.profile.startsWith('js-')`且`availability === 'implemented'`的项。本次每类恰好只有一个这样的变体；今后不能默认变体数等于类别数。

## 二、必须先纠正的台账问题

### 1. 六项JS变体没有直接引用本仓生成器

| 类别 | 本次事实与处置边界 |
|---|---|
| `projection-repository-port` | JS变体sourceRefs只有BC Scala模板和di-poc实例；旧JS projection producer中实际存在Repository产出，故不能按缺引用认定缺实现。需核现役/retired入口及最终写者 |
| `role-and-view-key-map` | JS变体引用BC的JS脚本和di-poc实例；需明确`metarch-truthsrc`自身的产出路径、适用入口和是否仅历史能力 |
| `saga-bootstrap` | 引用运行库/BC bootstrap，需区分生成装配、调用运行库与运行库内核 |
| `saga-participant` | 引用运行库/BC；当前JS可生成StrictParticipant/PhaseBinding装配，但不能把消费这些类型写成生成运行库类型 |
| `saga-serializer` | 机器目录`js-formal`记为generated，而文档明确library所有权；引用也是运行库serializer，存在实质归属矛盾 |
| `serialization-registration` | 引用di-poc及运行库配置；需定位JS真正生成的应用注册，区分依赖JAR自带注册 |

这六项是**映射或归属核验缺口**，不是六个已确认缺失的生成器。反方向也要查：有些没有`js-*`变体的类别引用了JS源码，例如Monarch checkpoint集成；源码引用可能仅证明调用运行库，不能把它直接补成生成覆盖。

### 2. implemented混合了不同事实

[约定](scala-cqrs/CONVENTIONS.md)已经规定implemented只说明列出的实现存在。它不同时证明：

- 本仓JS有可达生产者，而非只引用BC脚本或运行库；
- 输入来自明确公共合同，而非历史sidecar、硬编码或手工补丁；
- 生成的是该类别本身，而非调用它的装配代码；
- 目标代码符合推荐架构、命名及可维护性要求；
- 新候选编译、行为、序列化、恢复及独立验收全部通过。

现有校验检查文档章节、文件/符号、来源SHA、kind及兼容副本，尚不自动证明上述关系。因此此前“目录覆盖完成”仍只代表P0齐套门，不应扩展为生成状态已校准或模板已打磨完成。

### 3. 七份聚合参考不等于七类最终完成

已有Warehouse参考包括State、Entity、Protocol、Aggregate、Behaviors、Factory、Bootstrap，共**7个Scala源码文件**。参考版与生成版曾分别编译通过、各24测试成功，银行候选另有Actor64/Readside47实测。结果与限制见[聚合验收](../../../bank-wealth-demo/docs/architecture/AGGREGATE-REFERENCE-ACCEPTANCE.md)。

这些是兼容profile下的工程参考候选：旧domain Actor入口、载体别名、具体本地Repository等差异仍在；文件数也不是类别数。[参考资格](scala-cqrs/REFERENCE-DEVELOPMENT.md)明确区分成熟Scala依据、兼容候选、新设计候选及回归快照。**BC mjs产物不因有测试、写入catalog或位于reference目录就成为用户认可的金样。**

## 三、先确定“最终完成”的有限含义

不承诺数学意义上永无缺陷的“完美”。建议以**某个category × target profile × generator version的质量合同通过**作为工程终点，保留未批准、失败和不适用状态，不用一个总passed覆盖差异。

每项拟达到最终完成至少需要以下证据：

1. **职责与输入成立。** 真实owner、作者信息、技术binding、运行库职责和开放手写点清楚；未知能力拒绝，不从散文猜规则。
2. **设计有依据。** 参考来自适用的成熟Scala设计或独立实现；新的架构决策与参考资格有明确裁定，不让待验renderer自己生成金样。
3. **结构可维护。** 不可变结构模型、集中类型/命名/依赖解析、逐职责模板分开；DDD、FP/OO与洋葱依赖方向成立，拒绝内层反向依赖实现。
4. **目标代码已验证。** 使用真正编译器；纯行为、Actor持久化、协议/codec、读侧事务等按该类别职责分别实测。没有本地test目录不等于豁免。
5. **独立预期和反例有效。** 预期不是当前输出快照；测试覆盖错误输入、命名碰撞、缺少实现、未决外部结果等相关失败情形，跳过不算通过。
6. **最终写入链成立。** 检查真实最终writer、MANUAL/所有权保护、确定性再生及UTF-8 span；代码和展开知识可双向定位，不恢复inline `@knowledge`。
7. **消费与演进成立。** 至少一个非银行样例及适用的银行新候选消费；明确兼容/迁移与版本策略，安装后的包不依赖作者绝对路径。行为变化使原验收过期，不重签旧回执。
8. **最终审定独立记录。** 自动检查、独立审阅和架构owner裁定分开。未发生的人工审定不伪造；对运行库/手写/不适用项给出边界证据，不计成JS模板通过。

每批开始前固定必选检查、允许写面和退出条件。新增问题若影响本批正确性就阻断本批；无关问题回到既有任务，不能持续追加guard小批次、把终点无限推后。

## 四、推荐落地顺序

### 第一批：校准全量能力台账，先得到可信分母

**优先级最高；不再先扩充零散公共工具。** 对全部125类和284条变体作处置，不只处理上述六项；对39个入口反向核对，防止遗漏“有产出却没登记”的职责。

每条变体必须明确：

- 当前所有权、适用profile/runtime版本、现役/legacy/retired状态；
- 是否应由JS生成：生成应用代码、只生成装配、消费library、独立手写、派生证据或历史只读；
- 实际入口、builder/model/template与最后writer，输入合同及输出形状；
- 当前证明层级：仅声明、定位producer、样例产生、实际编译、行为验证、最终审定；
- 对应证据、未满足项、责任方，以及新源/工具变化后的失效条件。

**实现位置：** 继续以`catalog.json`为类别/变体唯一登记源，演进其版本化字段和validator，原来源摘要仍放source lock；不要新增第二份手工维护的“所有权总表”。从登记和证据派生可读能力矩阵及统计。精确schema变更、兼容读取和反例先在文档工具中实施，不修改业务tree/schema。

**关键写面：** `lib/artifact-docs/catalog.mjs`、`sources.mjs`、`vocabulary.mjs`及对应测试；`catalog.json`、相关类别页、source lock/coverage。生成器和银行业务源码在本批只读。若类别纠正影响BC/Play兼容页，经既有check/sync通道更新，不手写第二份事实。

**退出条件：** 125类/284变体全部得到明确处置；未解释映射、所有权矛盾和重复计数为0。真正应生成但尚无实现的项允许存在，必须作为真实backlog列出。能够给出“应该生成多少、producer已定位多少、样例可生成多少、已编译/行为验证多少、最终验收多少”的独立数字；library/手写/retired不进入新模板完成率分母。该批本身不能将任何模板晋升为最终完成。

### 第二批：固定目标profile、命名规则和独立参考

**本批已完成并验收：** [目标合同](scala-cqrs/TARGET-PROFILES.md)及[第二批验收](TARGET-PROFILE-ACCEPTANCE.md)记录显式兼容/推荐candidate、集中命名/结构模型和独立Parcel参考。没有新增generator manifest或切换银行；新参考编译不晋升现役模板最终批准。下面保留该批的原交付合同。

先利用已完成的聚合切片，不重写七份参考来冒新增成果。把现有银行的**legacy-compatible约束**与新项目推荐的目标结构明确分开：前者守住旧载体，后者消除内层Actor入口、混合命名和不合理依赖。是否新增profile及其确切合同在本批形成可审阅决策，不在本页擅定技术选择。

命名解析统一区分知识ID、Scala类型、Scala成员、包、SQL/PB/wire、持久化/操作身份；覆盖连字符、缩写、关键字、Unicode及碰撞。**不做全局字符串驼峰替换**，不为风格迁移冻结PB/PID/codec。

参考以两个明确场景为主：已有Warehouse聚合覆盖纯行为/Actor；另一个小型多模块场景覆盖计算/应用/Repository port、签名VO闭包、外置实现及root binding。银行继续作真实消费样例，不能成为生成器唯一输入或唯一oracle。成熟BC Scala与di-poc按具体职责/版本只读取证；BC JS未经打磨部分不作为预期。

**关键写面：** `scala-cqrs/CONVENTIONS.md`、`REFERENCE-DEVELOPMENT.md`、独立`test/reference/`源码/测试、集中命名与结构模型合同及测试。先参考和失败测试，后模板；未经批准的新设计保留candidate状态。

**退出条件：** 推荐结构、兼容例外、命名/碰撞、模块方向及最终质量门均有有限合同；参考能独立编译/测试，实际批准状态有记录。此时不声称所有类别已有模板。

### 第三批起：按依赖家族收敛生成器，而不是逐文件刷绿

**第三批family1实施：** 新增显式 `scala-cqrs-domain-kernel-v1`，合同见[领域kernel](scala-cqrs/DOMAIN-KERNEL.md)。它只推进值、纯Command/Event、State、RuleParams及必要计算签名／真实PB转换支撑，原九个Scala入口与银行P23选择不变。当前验收事实分项记录，不能把已编译的独立参考或单一样例等同全profile批准；inline技术配置物理字段回锚、完整modular应用和银行消费仍分开。

第一批校准结果决定每个家族的准确类别集合。以下是实施顺序，不是预先认定每个职责都需新生成器，也不是把所有profile绑成一次大迁移。

| 顺序 | 家族与交付 | 必需的独立验证 |
|---|---|---|
| 1 | VO、精确值codec、Command/Event、State、RuleParams；统一符号与类型引用 | 真编译、字段/默认值/范围/名称碰撞、纯值与状态往返；稳定身份不变 |
| 2 | 纯决策/事件fold、CommandHelpers及port签名；将已有聚合切片补齐到约定目标 | 纯规则/事件演进与拒绝路径；Actor确认前不得回复、恢复及Factory/Repository生命周期 |
| 3 | 多模块port、实现、条件Bridge、签名VO闭包及root binding | kernel独立编译、模块依赖无环、实现放置/绑定、无反向import及缺实现负例 |
| 4 | 应用侧持久化接缝、PB/converter/serializer注册、Repository与投影Schema/Handler/Runner | PB/codec往返与错版本拒绝、存储/投影事务、offset和重放；库内核不复制生成 |
| 5 | 选定版本的Saga/Monarch definition、phase port、host/plan、外部结果桥与恢复调用者 | Prepare/Commit/补偿边界、未知先核实、操作身份/ACK丢失/重启；不把编排当跨聚合事务 |
| 6 | API/DTO、query/service、controller/routes、页面接缝、Loader/build/config及组合根 | 实际请求/授权、DTO/读模型与资源生命周期；端口和开放手写实现明确 |

各家族横向都包含生成测试、来源/ledger/anchors、独立安装和兼容预览；这些不是留到最后才做的尾项。一个文件可能跨职责或多次写入，必须核最终输出，不能只验中间模板。

每家族固定交付包：独立参考与测试 → 结构模型 → 模板 → 完整producer计划 → 新候选编译/适用行为测试 → 最终代码回锚 → 台账更新。证据缺失则保留未完成，不以更新golden掩盖差异；已有正确producer直接复用，不为了“重新打磨”重写无问题代码。

### 工具与开发视图：沿真实需求收敛，不挡住核心模板线

承接任务172及P3，不重新搭建已验的public files/process/worker/lease/inventory/outcome/runner和Catalog闭环。

- 旧build进程与新process回执合同不直接替换；需要迁移时明确版本/producer/reader双向兼容，并用新回执，不修改历史`-f`证据伪装成`-p`。
- 其余workshop/Docker/relay只有在上述新候选实际消费需要时按独占写面拆分公共机制；端口、凭据、金融场景和独立oracle留银行。每项必须减少业务仓重复机制，不能只增加公共wrapper和更多文件。
- 目录收敛先建立当前/派生/历史引用处置表，再检查所有消费者并迁移。默认入口保持业务作者、技术配置、手写、独立测试、文档和按需生成输出；原formal-inputs、compiled、qualification及固定历史对象不能为降低目录数而盲删。
- 验收看安装后非银行项目能否复用、银行当前路径是否可解释、保护材料是否完整，不以“mjs数量减少”或“目录数更少”单独宣布完成。

### 最终独立交付门：不能等同于模板测试

接续任务169/133/134/137/139/145及既有P4。新候选先完成source、code和anchors，再分别给出actor/readside、24恢复窗、真实数据库/HTTP/browser、全新读库replay的证据；完整服务通过后才进入人工session。

- **service02新读库replay**：先核根因和最小复现，再修实际责任层；不能延长90秒期限、改oracle或换JAR代替排障。现失败是P23消费，不能归因未接入的R2。
- **R2下游（任务168）**：独立合同明确真源能力、lowering、生成装配、新依赖和新候选；先核runtime owner当前基线与交接。不是本路线暗含的立即升级授权。
- **retry/backoff/deadline OPEN**：先形成尝试/execute-query/总期限/跨重启预算和恢复调用者的可测合同，再在获授权版本实施。涉及runtime时另开新制品，不能覆盖P23。该债不能靠“有限profile限制”豁免，也不混入命名改造。
- **材料与新人交付**：先完成离线完整材料包/来源许可/取得方式的本地演练；实际上传、registry或Release发布需要对应授权。未参与实现的读者真实上手并单独签收，agent/自动化不能替代。

退出条件是每个必需交付门都有同一候选链上的有效证据。某门未获授权或等待真人输入，就明确阻塞该门，其余可逆工程继续；不能据此把整个项目描述为已交付，也不能无限续接无关小修。

## 五、协作、进度与范围控制

### 推荐的并行边界

主集成负责共享catalog schema、集中命名/接口、写盘apply和证据收口。只读全量核验可按家族分工；独立参考与测试、模型/模板、消费检查可在接口固定后使用互不重叠写面。共享生成应用不交给并行代理修改，JVM/数据库等重型运行排队并使用新owner/租约。代理失败、空输出或未实际运行不计审阅通过。

### 每批只报告这些可复核成果

1. 本批准确类别/profile清单与原始分母，进入/完成/阻塞数量；同一类别多个版本不重算类别总数。
2. 代码/配置最终产物是否变化、变化责任及兼容后果；无业务变化也不能沿用旧工具指纹。
3. 真正执行了哪些测试、哪些跳过/失败、来源是否在执行前后稳定。
4. 哪些模板达到已约定质量合同，哪些只是reference candidate、library消费或未审定。
5. 真实剩余工作及其owner/授权门；不重启已经完成的P0或公共闭环任务。

### 当前请求的写入边界

本次只保存报告、细化计划、接入中央/银行导航，并按既有工具刷新文档source lock/coverage和校验。**不在这次记录中修改66项登记、自动审定参考、实现剩余生成器、改银行作者/手写/固定测试、apply生成或重签回执。** 校准catalog字段/类别归属是第一实施批，需要配套版本/测试和完整逐项证据，而不是直接删改数字。

保持原冻结runtime、PB/PID/codec、金融政策和历史保护集合；不清数据/journal/失败目录，不操作共享应用，不stash/reset，不新建worktree，不自动commit/push/tag/publish。上一批45文件未提交成果继续保留，报告记录不等于本次已提交或已发布。

## 六、本计划的起手交付与终点

**实际起手批就是“125类/284变体/39入口的生成能力矩阵校准”**：先解释六项映射缺口与Saga serializer矛盾，再完成全量正反向核对，输出可信的应生成分母、现有producer和缺口列表。不得先挑一两个模板改漂亮就跳过台账问题。

之后按第二批固定的质量合同推进上述六个依赖家族；每批达到自己的有限结束条件才计完成。最后分别关闭公共复用、目录体验和完整业务交付门。这样终点是适用版本的模板/消费质量合同与真实交付证据，而不是“所有文件有说明”或不断增长的测试数量。
