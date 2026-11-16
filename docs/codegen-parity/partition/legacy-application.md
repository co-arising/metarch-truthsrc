# legacy-application：按实际职责编制的逻辑制品分区

状态：`content-specification`。配套机器账为 [legacy-application.json](legacy-application.json)。本片段只覆盖 `api-dsl`、`auth-dsl`、`bootstrap-dsl`、`connector-dsl`、`readmodel-dsl`、`repository-dsl`、`service-dsl` 七个 legacy producer；不是生产实现、迁移批准或验收结果。

## 1. 范围、计数和证据边界

| 计数口径 | 数量 |
|---|---:|
| producer | 7 |
| 分配的 producer-output 合同 | 36 |
| 映射到实际逻辑构造的合同 | 36 |
| 逻辑行（含额外发现的中间产物） | 40 |
| A 逻辑行 | 21 |
| B 逻辑行 | 19 |
| catalog 未列出的真实中间写出合同 | 11 |
| 上述中间写出共享的逻辑行 | 4 |
| 实际阅读并登记完整字节 SHA-256 的固定来源文件 | 51 |
| 未解析的 catalog 覆盖项 | 0 |

**逻辑行不是文件数、模板族数或能力通过数。** 传统 Scala 基准仍是39族，加单列3扩展；此处不增加族数。35条合同有实际内容 writer，另1条是 queue-only 计划证据。`implemented` 仅表示机器账所列的构造可由对应 writer 发出，不能把 `???`、TODO、缺 DI 或有缺陷的代码解释为业务已实现。

已全文读取七组 emit/parse、manifest，相关静态支撑，以及 A 分类所用的 raw traditional Scala Template。`run-all.mjs` 阅读了本组模型构造、实际调用与终端写入的完整相关区间，另做全文件 writer/specDir 定位；未冒充其它组 renderer 的全文审计。来源范围及完整字节 hash 均在 JSON `sources`。这些字节与 [baseline/index.json](../baseline/index.json) 的 bytes/SHA 一致；这是文件身份与文档账的机械对照，不是运行验证。

本次所需源码均有固定副本，`extraSources=[]`。没有复制新基线，没有运行应用、CLI、测试、编译、typecheck、生成器、依赖解析、下载或服务，没有修改源码、作者树、catalog、baseline、生成应用、ledger、anchors 或 Git。写入前两个分区文件都不存在；只创建本组 JSON/MD。

## 2. legacy 可调用不等于银行消费

银行配置 [truthsrc.project.json:278–298](../baseline/bank/truthsrc.project.json) 明确选择 `scala-cqrs-play-service`。实际继承链是：

1. [play-service/generate.mjs:16–23](../baseline/js/generators/scala-cqrs-play-service/generate.mjs) 调用 `createEffectRegistry('2')`，而非缺省版本1；aggregate、invariant 另有服务侧覆盖。
2. [produce-effect.mjs:6–26](../baseline/js/generators/scala-cqrs-application/produce-effect.mjs) 包装 `applicationRegistry(version)`。
3. [produce.mjs:17–30](../baseline/js/generators/scala-cqrs-application/produce.mjs) 的完整 registry keys **不含本组七个 producer**。
4. [generate-cli.mjs:92–101](../baseline/js/lib/products/generate-cli.mjs) 独立注册 formal 与各 family 候选；候选注册不是银行自动切换。

因此七个 producer 的 `bankConsumption.status` 都为 `not-selected`，不是 `retired`。各自 `generator.json` 的 `entrypoint=emit.mjs` 证明 legacy CLI 寻址，不证明 product registry 继承、银行实际消费或运行通过。

| legacy 编排面 | 真实调用边界 |
|---|---|
| API controller | `run-all:1296–1757`；有 `sagaBinding` 时跳过 controller |
| ViewKeys | `run-all:1759–1778`；与上面的 controller 跳过条件不同 |
| Repository | `run-all:1098–1121` 仅调用 aggregate 分支 |
| Service | `run-all:1781–1792` 仅调用 port 分支，不调用 application/query/domain 壳 |
| Bootstrap | `run-all:1880–2030` 调聚合、投影与最终 ApplicationBootstrap |
| Policy bootstrap | 独立 `kind=policy` 仍有代码；`run-all:2050–2066` 已用另一套 policyexec 生成器替代 |
| ReadModel | 独立 parse/emit 仍在；`run-all:1027–1087` 明确改用 projection-dsl |
| Auth、Connector | 未在所读 run-all 调用面接线；有独立 CLI |
| pipeline.mjs | [120–132行](../baseline/js/generators/pipeline.mjs) 只记录 queued/skip，不调用 producer |

## 3. 复合文件与单一组装所有者

### 3.1 Controller：调用点不冒充 DSL 支撑实现

[api-dsl/emit.mjs](../baseline/js/generators/api-dsl/emit.mjs) 的 `*ApiController.scala` 分为两个 A 逻辑行，均对应 raw `http-controller`：

- `http-controller/command-and-flow`：文件头、`package controllers`、联合 imports、注入构造器、`controllerComponents`、5秒 timeout、可选 `emptyBodyReads`、全部 endpoint 方法、注释锚与副作用顺序。
- `http-controller/request-and-conflict-dto`：文件尾顶层 Req/409 payload case class、同名 companion 与 `Json.reads`/`Json.format`。**不是 controller companion 的内嵌 DTO**，catalog 的这一描述应更正。

两行共享 `controller-file` owner。它收集 DTO 与 endpoint 的联合依赖并组装完整文件，不能只移动 class、留下错误 imports 或隐式初始化。目标仍是 `app/controllers/<Aggregate>ApiController.scala`，在业务根包之外。

`command-endpoint-dsl` 这条 API catalog 记录映射到上述 controller 调用点，因为实际内容是 `api.tenant/global/anonymous.write` 组合，不是生成 Endpoint 库。真正的信封/guard 支撑件来自 bootstrap 所属的静态复制通道。

必须保留的行为顺序包括：IdGuard 外层、InstantGuard 内层、可选 enrich、必要时生成 ID、typed `replyTo` 的 Actor ask、`reply.error.fold`，以及409查重前置与 Flow 委托。纯 HTTP 请求数据、Actor-facing Command、领域参数/事件是不同合同，不向纯 payload 注入 ActorRef。

### 3.2 ReadModel：行 schema 属 A，默认行与 TODO 属 B

[readmodel-dsl/emit.mjs](../baseline/js/generators/readmodel-dsl/emit.mjs) 只有 case class 和默认行 object：

- **A `readmodel/row-schema`**：读侧行字段结构，对应 raw [ProjectionRepositoryTemplate:45–60](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ProjectionRepositoryTemplate.scala) 的 DTO construct 子集。目标放到 `app/<basePath>/application/projection/repository/<View>Repository.scala` 的 Table/行类型范围。它不是整个 repository 已实现，也不是领域 Entity/ValueObject。
- **B `readmodel/default-row-factory`**：零值 `empty` 与投影意图注释，目标为 `app/<basePath>/application/projection/<View>Defaults.scala`。没有事件处理、journal、offset 或 SQL 写入，不能将 TODO 算成 projection/handler 实现。

默认 `objectName=viewType+"View"`，通常并非 case class 同名 companion。共享 package/BigDecimal import 由 `projection-readmodel-assembly` 收口；目标拆文件后 Defaults 自己导入行类型。它与 `repository/projection-port` 用同一个共享 fixture，避免两套 renderer 重复声明同一行类型。

结构性对照，**非同输入生成字节比较**：

```diff
- // readmodel-dsl/parse.mjs:23，当前真实输入损失
- fields: (payload.fields || []).slice(0, 5).map(f => ({name: f.name, dataType: f.dataType})),
+ // 目标规格：使用完整的、已解析类型引用的字段集合；不截断，不丢 optional/nominal 信息。
+ // 具体共享模型 API 尚未实施，本行不是拟造一个已存在的函数。
```

### 3.3 Port：trait 与 Bridge 必须一起审计

[service-dsl/emit.mjs:206–268](../baseline/js/generators/service-dsl/emit.mjs) 将能力 trait 和可选 Bridge 写在**同一个文件**：

- B `service/computation-port` 拥有逐方法签名、文档和导入依赖。
- B `service/port-bridge` 拥有具名 object、逐方法 override 与 `bridge.target.method(args)` 转发。
- 单一 `computation-port-file` owner 负责文件头、包、联合 imports 与写入；目标为 `app/<basePath>/domain/services/<PortName>.scala`，仅在委托目标确为内层纯函数时成立。

`bridge.fq` 只取末段类名，不使用其包前缀。签名 parser 按逗号拆参数且以大写词猜 imports，不能正确表达一般嵌套 `Map[K,V]`、多个参数组或所有 Js 类型。若委托目标属于外层基础设施，必须先裁定拆分后的依赖方向，不能把全部文件整体搬入 application 就称分层完成。

### 3.4 Bootstrap：初始化和资源注册不能遗漏

A `bootstrap` 分为 aggregate、projection-single、projection-multi、policy-runner-projection 四个真实职责变体。`policy` 变体的内容是 ShardedDaemonProcess 启动仪式，**对应 projection bootstrap 职责，不对应被退休的 Scala PolicyTemplate**。

A `application-bootstrap` 同时覆盖：classic→typed system 转换、EC、依赖注入、聚合/投影有序初始化、strict coordinator ActorRef 字段、reconcile token 读取、singleton spawn 及 event-source 安装。这些在 raw [ApplicationBootstrapTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/bootstsrap/ApplicationBootstrapTemplate.scala) 已有对应，不另把 strict 初始化漏列为无主代码。

`forSources` 普通/For-form 分别登记；空数组当前会生成错误表达式。`ApplicationBootstrap` 在零 traits 时仍拼空 `extends`，是 JS/raw Scala 共同存在的缺陷，不是应保留的“gold”。

## 4. B 的具体目标与 fixture

目标采用 classic 单工程物理根；`basePath` 来自明确 base package。新增/移动位置是内容规格建议，不是本轮源码写许可。每行的逐构造处置、qualityRules 与未决项详见 JSON。

| B 逻辑行 | 明确目标 | 独立职责与 fixture |
|---|---|---|
| auth/view-key-constants | `app/<basePath>/infrastructure/auth/ViewKeys.scala` | 常量名称碰撞/排序不改稳定 key；`parity-auth-view-keys-v1` |
| auth/endpoint-role-policy | `app/<basePath>/infrastructure/auth/<RolePolicyName>.scala` | METHOD/path角色表和未知项缺省；`parity-auth-endpoint-policy-v1` |
| scaffold/build-definition | `build.sbt`、`project/plugins.sbt`、`project/build.properties` | 显式版本、依赖与 strict overrides；`parity-legacy-play-build-v1` |
| scaffold/application-config | `conf/application.conf` | includes、模块、环境边界；`parity-legacy-configuration-v1` |
| scaffold/empty-command-role-map | `app/<basePath>/infrastructure/auth/CommandRoleMap.scala` | scope-only 空索引，不是身份认证；`parity-scope-only-role-map-v1` |
| scaffold/primitive-codec-support | `app/<basePath>/infrastructure/persistence/converters/PrimitiveConverter.scala` | S/P、Option/List/Map、Id/Currency/String 胶水；`parity-primitive-codec-support-v1` |
| scaffold/minor-unit-arithmetic | `app/<basePath>/domain/services/MinorUnitArithmetic.scala` | BigInt minor-unit 原语；`parity-minor-unit-arithmetic-v1` |
| scaffold/project-ignore | `.gitignore` | 本地输出保护，非业务构建模型；`parity-project-ignore-v1` |
| scaffold/serialization-config | `conf/serialization.conf` | 精确 serializer 绑定集与 Java off；`parity-serializer-registration-v1` |
| scaffold/mongo-persistence-config | `conf/persistence.conf` | journal/snapshot plugin、环境覆盖；`parity-mongo-persistence-config-v1` |
| scaffold/runtime-binary-provision | `lib/<ExplicitRuntimeArtifactFile>.jar` | 显式文件供给、hash/同名冲突；`parity-runtime-binary-provision-v1` |
| pipeline/queue-manifest | `out/codegen-plans/legacy-pipeline-manifest.json` | queued/skip 的计划证据，不是执行回执；`parity-legacy-pipeline-queue-v1` |
| readmodel/default-row-factory | `app/<basePath>/application/projection/<View>Defaults.scala` | 默认行合法性及投影未实现；`parity-readmodel-row-and-defaults-v1` |
| service/computation-port | `app/<basePath>/domain/services/<PortName>.scala` | 逐方法能力声明；`parity-computation-port-bridge-v1` |
| service/port-bridge | 同上；由同一个 owner 组装 | 转发方法/参数/返回合同；同上 fixture |
| intermediate/normalized-binding-spec | `<exclusiveScratch>/legacy-application/specs/<api-dsl或auth-dsl>/<inputId>.json` | API/Auth 的 JSON 值重序列化；`parity-legacy-spec-intermediates-v1` |
| intermediate/verbatim-binding-spec | `<exclusiveScratch>/legacy-application/specs/<producerId>/<inputId>.json` | 四个字节相同 parser 的 UTF-8 透传；同上 fixture |
| intermediate/readmodel-derived-spec | `<exclusiveScratch>/legacy-application/specs/readmodel-dsl/<readModelId>.json` | 不安全括号扫描/5字段截断的替代合同；同上 fixture |
| intermediate/run-all-owned-specs | `<exclusiveScratch>/legacy-application/specs/<producerId>/<inputId>.json` | 本组 API/Repository/Port/Bootstrap scratch 生命周期；同上 fixture |

所有 B Scala 产物同样服从 [layout-and-style](../layout-and-style.md) 的三层、PascalCase/lowerCamelCase、TypeRef/import 模型、显式依赖、纯领域/I/O 分离、方法 CC 目标与手写领地保护。复杂度 **not-measured**。JSON/config/JAR/ignore 不套 Scala 包，但必须有正确物理根与唯一写入 owner。

## 5. 目录文字与实际字节的差异

1. **静态 CommandDsl 属 A，但不是把 scaffold 整体算进39族。** [固定49行支撑件](../baseline/js/generators/scaffold-static/app/net/imadz/metarch/infrastructure/api/CommandDsl.scala) 与 raw [CommandDslTemplate](../baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/infrastructure/api/CommandDslTemplate.scala) 同样定义 OkReceipt、ViewListDto、ViewItem、IdGuard、InstantGuard。它是该族的一个 source-copy 实现实例。静态 MoneyOps/PrimitiveConverter 则是通用算术/codec 支撑 B，不冒充按业务模型产生的 DomainService 或聚合 PO converter。
2. **初次 build 复制和最终 build 不同。** `run-all:2139` 复制 build.sbt，但 `2220–2256` 在 strict jar 分支追加 Akka overrides，不能把最终文件永远描述成 byte-exact scaffold。
3. **配置写入条件比 catalog 更窄。** serialization/persistence 写入位于 `if (sagaCoreJar)` 内，且需前面的 Saga lowering 成功。只有 sagaBinding 不足以写出这两份配置；与递归 `scaffold-static/app` 支撑复制条件不同。
4. **serialization 以实际副本为准。** [serialization.conf:19](../baseline/js/generators/scaffold-static/conf/serialization.conf) 已是 `allow-java-serialization=off`；run-all 附近仍有旧 Java fallback 注释。已有 `scalapb.GeneratedMessage` 广泛绑定要登记为技术债，既不能扩大，也不能未经 ABI/制品裁定悄悄收窄。
5. **最终 routes writer 会覆盖手写领地。** api-dsl 的 `routes.fragment` 是临时输入，run-all 删除后另装 `conf/routes`；后者先整文件重写，再添加 E301 marker。A 目标必须像 raw RoutesTemplate 那样管理标记区域，不以当前坏 writer 为标准。
6. **查询 DTO 不需要拆成 B。** raw QueryServiceTemplate 本身就含 companion case class、可选 ReadModel、Timeout 与查询方法槽，因此 service/query A 全部保留。对照之下，纯 port trait/Bridge 不等于领域服务算法，单列 B。

## 6. 未决实施问题：零覆盖缺口不等于零内容缺口

以下均已在对应逻辑行给出具体条件和 fixture；没有以 `unknown` 分类规避责任。

- **输入完整性**：ReadModel parser 截断前5字段；手工括号扫描不理解字符串；字段点转下划线与未知类型→String/Map[String,Any] 会丢失身份或类型。目标必须依据完整类型合同，而非改少字段使编译通过。
- **仓储接口与实现**：stamped aggregate trait 不发额外 methods，但 impl 会 override；projection 分支忽略 projectRoot/traitPackage，且 DTO、DI、依赖与 SQL body 未接。真实 `???` 必须维持未实现标记。
- **应用/连接器算法**：application/query/domain service 与 ConnectorImpl 的 body 槽尚未实现；query 提示注释不会自动变成算法。raw Scala 也有手写槽，不是允许 fake success 的理由。
- **HTTP 合同**：Metarch 特例寻址、复合键、随机多目标、409软删除/租户规则、enrich、scoped Flow、Endpoint 真实 API 与冻结 JAR 需要明确对齐；不能以 raw Scala 的 JsNull/stub 缺陷替代已有语义。
- **端口边界**：签名解析/import 推断、同名异型注入、fq与物理路径漂移、Bridge 目标依赖方向均需显式模型裁定，禁止 String/Any dispatcher 降复杂度。
- **装配/配置闭包**：静态 application.conf 包含未由本组生成的 include/模块和开发配置。原 `$base.modules` 迁移到 `infrastructure.bootstrap` 必须同时迁移配置引用；不能只看到 ApplicationBootstrap 类就宣称应用可启动。
- **兼容性和数值**：共用库副本与消费 JAR 可能重名；类/包移动、serializer 绑定、strict token/启动顺序需迁移合同。MoneyOps 的 `sign` 当前未限制±1，增加限制也属语义变化。稳定 business ID、PB编号、PID、摘要、nominal 与精度/溢出合同不动。
- **真实但未编目写入**：七个 parser 的 outPath，加 run-all 为本组四个 producer 创建的 spec，共11条。只登记本组，不接管其它组中间件。`specDir` 的全文引用定位未见 run-all 清理，不得声称独占 scratch 已有完整退出路径。

## 7. 可读业务路径与下一阶段检查对象

可供后续共享语义 fixture 使用的阅读路径是：HTTP Req/guard → 应用 Actor Command/typed replyTo → application repository EntityRef → aggregate bootstrap 的持久化行为 → Reply 错误/成功翻译；另一路是读模型行类型 → projection repository 方法 → query service DTO → HTTP 读信封。外部能力经 application connector port → infrastructure implementation；纯计算经 domain service/port，但不能越层调用外部服务。

这是说明职责的 fixture 路径，**不虚构七个 legacy producer 已贯通银行基金购买端到端**。下一阶段应分别检查完整同输入文件/construct/RHS、实际 glue API、必要行为证据、稳定再生与回锚；本轮没有运行任何此类验证，也不提出未确认存在的测试命令或 CLI flag。
