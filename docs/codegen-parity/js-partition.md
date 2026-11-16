# JS A/B 逻辑制品分区总览

最后更新：2026-11-16。状态：**全部生产者/输出导航键已覆盖；已知源码内容已分区，3个未提供外部源码槽仍阻塞完整内容闭合。不是实现完成或运行通过。**

机器正表：[js-partition.json](js-partition.json)，读取时按producerId/outputId或logical id提取，不裸打印约4.4MB全文。机械装配结果：[partition-assembly-report.json](details/partition-assembly-report.json)。

## 1. 数字的准确含义

| 单位 | 本次结果 | 不能解释成 |
|---|---:|---|
| producer | 45 | 45份Scala模板或45个已交付应用 |
| producer-output导航合同 | 641条，精确覆盖、无漏key/重复key | 641物理文件或641项都满足完整内容合同 |
| 经跨组纠正的逻辑出现位置 | 591：A283、B308 | 独立文件数、全部去重后的语义族数、通过数 |
| Scala基准 | 39传统族＋3扩展 | 42文件或42个统一enum |
| 有部分JS职责对应的Scala族 | 38 | 完整实现了38族 |
| 完全未定位对应的classic Trigger族 | 4 | 可以跳过的需求 |
| 未提供任意外部源码槽 | 3 | 一律B或“剩下638都完整”的依据 |
| 附带writer观察记录 | 53（含跨profile重复观察） | 53份新增永久生成制品 |

分类单位是逻辑construct/变体及其producer/profile出现位置。一个文件可以同时有A参数记录、B sealed分发骨架、A事件声明，必须由同一个assembler组装。相同source在多个profile继承时仍保留准确版本/条件；不能把591理解为已全局语义去重。

## 2. 分组导航与中央纠正后计数

| 分组 | producers | 导航合同 | 逻辑出现位置 | A / B |
|---|---:|---:|---:|---:|
| [formal-service](partition/formal-service.md) | 1 | 60 | 89 | 34 / 55 |
| [formal-domain](partition/formal-domain.md) | 2 | 40 | 33 | 17 / 16 |
| [formal-application](partition/formal-application.md) | 6 | 214 | 75 | 28 / 47 |
| [legacy-domain](partition/legacy-domain.md) | 8 | 34 | 50 | 35 / 15 |
| [legacy-application](partition/legacy-application.md) | 7 | 36 | 40 | 22 / 18 |
| [legacy-orchestration](partition/legacy-orchestration.md) | 5 | 38 | 70 | 32 / 38 |
| [family-domain-aggregate](partition/family-domain-aggregate.md) | 2 | 33 | 31 | 18 / 13 |
| [family-readside-play](partition/family-readside-play.md) | 2 | 87 | 80 | 38 / 42 |
| [family-seams-saga](partition/family-seams-saga.md) | 2 | 20 | 33 | 10 / 23 |
| [ordinary-review](partition/ordinary-review.md) | 3 | 12 | 16 | 0 / 16 |
| [retired-seven](partition/retired-seven.md) | 7 | 67 | 73 | 49 / 24 |
| 公共project roundtrip补记 | — | 不增分母 | 1 | 0 / 1 |

分组原稿保留初稿数字/观点；**上表与机器中央表已应用明确裁定**，不能把两种时点混用。详见[分类裁定](PARTITION-RESOLUTIONS.md)、[复核补充](PARTITION-REVIEW-RESOLUTIONS.md)及中央`classificationCorrections`。

## 3. A具体差在哪里：按传统职责而不是命名

| A族/组 | 已定位JS内容 | 明确缺口/偏离 |
|---|---|---|
| value-object | 普通record、名义wrapper、精确值、legacy JSON分支 | formal缺raw JSON/default分支、FQN/长单行；无单位decimal必须保留；wire/PO声明仍是值声明A，codec B，不合并类型 |
| domain-entity | State、Protocol中的Event、layered alias容器 | 真实State/Event所有权散在domain根；Entity只是别名壳；默认值/owner/type注册差异不靠搬目录解决 |
| event-handler | formal fold、legacy行为、family直接copy | nextN/FQN与求值次序；raw fallback/未完成helper与JS语义不同；不能改addExact或吞事件 |
| invariant-rule / formal-rules | 普通legacy规则、formal guards/emission/参数 | 两族不混签；pure command参数record部分A、sealed dispatch B；多层转发、双否定及错误/集合接口待对齐 |
| domain-service | 纯Computations/计算port、legacy服务骨架 | 算法与声明分开；trait/object、super-interface、方法输入和实现槽不同；没有body不是归B的理由 |
| application-protocol | 外层Request/Reply、Execute/GetState与alias | 不能用逐业务命令都包Execute替代独立typed replyTo与Replies；domain纯参数/事件不引ActorRef |
| command-helper | legacy有三方法，formal和family当前只有emit | 银行正式路线缺toParam/failure/success及runReplyingPolicy；成功要读事件应用后State，不只是Accepted(events) |
| aggregate-root / factory / behavior | handler委托、行为dispatch、本地factory | 缺raw key/tags或初始化ask；flat ESB装配已改归bootstrap，不能保留在root假称对齐 |
| aggregate repository | 本地缓存impl；family/legacy有port形状 | 正式银行缺独立port；close清Map不等stop/drain/deathwatch；分片vs本地profile需明确迁移 |
| connector port / impl | typed technical trait＋Installed guarded callback | 接口、具体外部委托A、安装机制B分开；真实外部业务仍手写不等生成侧无adapter实现 |
| application/query service | legacy骨架、seams声明、family8实际服务 | 正式银行Endpoint运行callback尚不构成传统独立service；不能拿安装表充业务算法 |
| projection五族 | legacy多存储/handler；formal per-PID重建；family有限读侧 | 事务session、offset、生命周期、视图函数不同；raw ViewMachine定义/ABI未定位；当前同类资源owner不等最终目标结构已定 |
| proto/converter/adapters | 全context PB图、精确codec、具体类型白名单 | raw oneof/PO与当前PB不同；不能改字段号/presence/int64/manifest或double替精确金额；共享converter单owner需目标合同 |
| HTTP/DSL/routes | legacy controller/静态信封、formal embedded routes | 请求/角色/CSRF/错误层级、marker writer和复合文件声明归属；typed action不等Endpoint库已齐 |
| bootstrap / app bootstrap | local ESB与Play装配、legacy/family根 | 4 Bootstrap变体和DI/生命周期不同；配置/资源不能因改名提前创建或多次关闭 |
| classic Saga | legacy内联step、Context、Definition有部分对应 | 不等AskParticipant/独立classic模型；typed阶段/回复/Args动态名、runner语义均有差距 |
| strict/composition | strict模块、codec/entry/completion、pipeline/child宿主部分对应 | 只按具体construct对照，不能把整effect/direct host当classic；持久身份/未知/发布/child权威与运行API保留 |

上述不是结论代替diff；每项实施必须进入该族完整MBT/construct/RHS账，并同时读[内容勘误](CONTENT-REVIEW-CORRECTIONS.md)。

## 4. Scala缺项不能从表中移走

中央`scalaCoverage`明确没有JS counterpart的四族：

- [saga-trigger-protocol](diffs/saga-trigger-protocol.diff.md)
- [saga-trigger-entity](diffs/saga-trigger-entity.diff.md)
- [saga-trigger-root](diffs/saga-trigger-root.diff.md)
- [saga-trigger-behaviors](diffs/saga-trigger-behaviors.diff.md)

classic participant/definition/context虽有legacy的**部分职责**，原diff中`missing-counterpart`指完整经典形态缺失，中央不把部分对应改签成完整实现。所有42族均继续各自diff工作包。

## 5. 银行实际选择，不把新family自动算进来

[固定项目配置](baseline/bank/truthsrc.project.json#L278)选择`scala-cqrs-play-service`。真实路径是`createEffectRegistry('2') → applicationRegistry('2')`，service覆盖aggregate/invariant并包装build/config/test。不是bank改用family1–8；也不是旧command-dsl/render在正式路线被调用。

**所选producer可产生 ≠ 该实例已触发所有变体**。中央`bankSelectedLogicalIds`只表示所选producer的候选内容。固定ledger有233条记录，两个invocation-host实物均为pipeline；direct host/entry-mapping在该银行实物中未启用。精确依据见[bank-selection-observation.json](details/bank-selection-observation.json)。其它条件尚未全量做实例materialization核对，不能把所有formal-service行称为银行正在消费。

银行所选profile当前没有传统独立对应的项目包括：普通invariant模板、三方法CommandHelper、aggregate repository port、独立application/query service、classic Saga七族（含四Trigger）、projection repository port/ApplyEvent、aggregate-state-controller、command-endpoint-dsl。**这是按选定传统职责的缺项，不是声称银行没有规则、回复、查询或Saga能力。** 当前相近功能仍在其它逻辑行中，必须按split/adapt明确补齐职责而非改口径。

## 6. 三个完整内容阻塞的准确范围

| 退休入口/输出 | 目前已知 | 未能认证的内容 |
|---|---|---|
| scala-cqrs-es-api / support-controller | 已读三个固定sidecar controller键及passthrough选择机制 | 任意新增path/content；未提供的代码不能凭文件后缀分B |
| scala-cqrs-es-projection / projection-handler | 模板/推导体/已定义MANUAL选择规则 | supplied manualBlocks选中的任意方法体；不能说都为纯ApplyEvent |
| scala-cqrs-es-projection / projection-repository-impl | 四存储模板及override选择 | implOverrides整文件替换；模板覆盖不证明替换文件内容 |

后续若该退休入口进入某fixture范围，先固定实际input/sidecar的准确完整字节，再分构造。不主动复活、不用unknown兜底、不阻塞无关formal文档编制；但完整A/B总任务不能仅凭641/641改绿。

## 7. B不是垃圾桶，目标同样具体

B包括独立sealed分发骨架、外部身份/关联状态机、effect/Monarch运行桥与checkpoint、安装/生命周期/权限/HTTP呈现、精确wire codec和serializer、SQL/config/build/tests、工具计划/ledger/anchors/graph/临时校验输出等。

每条中央logicalOutput保留：当前路径＋准确source/construct、变体/入口、目标路径＋成员处理、唯一assemblyOwner、fixture、质量规则和未决项。不得生成String/Any万能dispatcher、吞异常、合并nominal或降低资金精度来刷复杂度。

**目标未定的诚实处理**：Projection资源和context converter先固定现有唯一owner；最终按Scala结构拆分的API/layout仍blocked。retain位置不是最终质量豁免，也不是批准继续保留mechanical Parts/FQN；不能只给两个目标文件名就称已完成接口设计。

## 8. 文档复核和实际执行分开

本轮完成源码内容调查、50项中央记录调整（含split/merge/范围校正，不是50个代码修改）、精确导航双向对账与来源快照。部分review对pure parameters发生分歧，最终按record/dispatch subconstruct拆分，并保留初稿/审阅原文，不伪造一致意见。

未执行：任何生成器实跑、编译、测试、应用/数据库/浏览器、真实JAR ABI、CC度量或新回锚验证。没有commit/push/release、运行库重发或共享应用写入。下一步是同输入fixture/目标内容/公共接口裁定与分工收口，之后才按已获准工作包实施。
