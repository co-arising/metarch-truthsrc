# classic @4：十九件源码的范围合同

本包继续逐字节优先主线，新增传统目录第12族 `aggregate-repository-port` 与第22族 `aggregate-repository-implementation`，复用 @3 的十七件。范围内真实公开CLI、独立源码/执行材料复核及证据审计已闭合，结论 `PASS_SCOPED_RAW_BYTE_AND_BOUNDED_INTERFACE`；十九件rawbyte与有界准入成立，不扩为类型闭包、编译或业务通过。

## 输入、路径与独立 expected

输入是完整原 `truthsrc.classic-architecture-input/v1`：`test/fixtures/classic-cqrs-f1/baseline.json` 与 `timestamp-int.json`。保留全部层、原constructor、未消费metadata、名称与顺序。新request仅选择 `classic-architecture@4`／payload `/v4`／`classic-source-scaffold@4`，不裁剪或复制第二份业务真源。

每输入十九件完整Scala：

- 原 @3 十七件：Protocol、Helpers、Behaviors、Entity、VO、九个Rules、Handler、Root、Factory。
- 新 Port：`app/net/imadz/banking/application/aggregates/repository/CreditBalanceRepository.scala`，1425 bytes。
- 新 Impl：`app/net/imadz/banking/infrastructure/repositories/aggregate/CreditBalanceRepositoryImpl.scala`，1243 bytes。

独立 expected 在 `test/reference/classic-cqrs-v4/{baseline,timestamp-int}/`。实测baseline43037 bytes、timestamp-int43036 bytes，38 Scala共86073 bytes。十九个相对路径及expectedOnly/actualOnly在比较之前固定于 `scope.json`。metadata在比较根之外；expectedOnly为空，actualOnly仅 `anchors.json`、`truthsrc.ledger.json`。

资产保管owner独立复核四套原CodegenMain实产的十九个selected原bytes及repeat，新增两件binarycopy；原十七件亦与既有独立v3 expected核对。原库存每套108 regular files（83Scala＋3proto＋22其它），本包未读／未认证剩余89 payload／套。源码保管核41个selected-route Scala source payload与35个docs/frozen-source pair；这是有界来源库存，**不是整个CodegenMain的transitive build closure认证**。

portable manifest要求43份其它shipped资产（38Scala＋2requests＋README＋scope＋provenance），含manifest自身共44份。忽略目录中的local audit不是新clone的必需文件；不从localhash猜补缺件。

## 独立发射与拒绝范围

`scala-cqrs-classic-v4`有精确manifest、新trusted Symbol及shipped realpath注册，readiness为 `classic-scaffold-only/runnable=false`。旧 @1/@2/@3不改含义。MBT只新增两个不相交的三模块组，复用原十七个未stamp artifact，再统一header/footprint/plan/apply。

Port只由 `application.repositories` 的AggregateRepositoryMetadata调度；Impl只由 `infrastructure.repositories` 的相应声明调度。保留完整相等且唯一的两层pair；缺对应声明、错误aggregate或路径alias拒绝。不按“有aggregate”自动制造仓库，ProjectionRepository不在本包发射。

公开QueryMethod只支持原基准所需的单个required/non-generic参数、空optionalWhen、可忠实渲染的非关键字名称，以及指向该aggregate实际commandFamily的EntityRef返回。解析发生在同名entityRef过滤之前；零参entityRef不会被安全跳过。多参、generic参数、optional、非EntityRef、错误commandowner、non-null storage等fail closed，不把raw首参/类型损失包装成通用能力。UpsertMethod只retained/ignored。

## 原字节与未解决类型缺陷

新增两件在既有两输入中相同，timestamp扰动只影响原Entity。额外合法plan不等新增changed-output独立Scala expected。

保留Port重复EntityRef/ImplementedBy imports、原 `@ImplementedBy` 依赖、Port双末尾LF／Impl单末尾LF。尤其保留原坏默认family：

1. Port：`CreditBalanceAggregateProtocol.CreditBalanceAggregateCommandFamily`；对应Protocol object不存在。
2. Impl：`CreditBalanceProtocol.CreditBalanceCommandFamily`；Protocol存在但该member未声明。
3. 实际Protocol声明 `CreditBalanceCommand`，输入显式query使用它；不造alias或替换坏合成family。

源码owner-prefix路由是file association，不是声明或类型解析通过。十九件**不是type-closed、不可认证编译或运行**，Port的application→infrastructure注解依赖也未认证用户目标的依赖方向。原???只未来手写隔离归属候选，不即时迁移或实现。

## 验收边界

实际公开接口采用4generate＋6compare核心，完整十九件raw bytes、A/B sources-only确定性；ledger原bytes另列，anchors仅inventory/pins。外侧独占材料含字节／membership负例、严格拒绝／合法plan与 @1/@2/@3共享源码回归。预先批准的50有效观察不是50族覆盖率；实际调用、carry、失败、未执行与期限只能按真实回执记账。

本包不跑tests/typecheck/internal import-and-call；不新JVM/build/protoc/服务/下载，不修改银行/shared apps或原回执，不自动提交／推送。PlainFP、ScalaCheck、ScalaCompilation、FinancialOracle、BusinessRuntime、common ABI/effects、BankMigration保持NOT_RUN；其它传统族/条件/B/F2/四Trigger/字段回锚及用户target另立闭包。
