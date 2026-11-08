# 有限多模块接缝候选

目标：`scala-cqrs-module-seams@1`。生成入口：`generators/scala-cqrs-module-seams-v1/`。

本页描述单context Parcel候选，不是完整CQRS应用生成器，也不是架构owner的最终批准。完整modular profile仍保持 `generator:null`、`approval:null`。catalog 2.4.0已登记本族当前generation/compiled/behavior观察，资格限实际Parcel样例；当前各类别计数见[能力矩阵](../CAPABILITY-MATRIX.md)，整批收口与最终批准分别裁定。

## 输入只有两种维护面

- **业务作者树**：`scaffold/module-seams-project/truth/module-seams/`。8个值对象唯一定义，3个port引用这些值；`canonical.json`是编译结果，不能手改。每次作者修改均需validate与roundtrip同时通过。
- **技术binding和外置实现**：`bindings/module-seams.json`声明模块、完整Scala名称、class/object、构造实参及port选择；`handwritten/{kernel,glue,ext}`是用户维护源码，不是业务知识副本。绑定不定义第二套方法签名、业务算法或任意Scala表达式。

两个产品分别是 `module-seams-contract@1` 和依赖它的 `module-seams-composition@1`。静态readiness不等于运行认证。

## 四模块职责

| 模块 | 生成责任 | 外置手写责任 |
|---|---|---|
| kernel | ParcelValues、QuoteError、CapacityPolicy、RouteRepository、QuoteFlow、条件CapacityPolicyBridge | CapacityRule纯规则实现 |
| glue | 构建接线 | InMemoryRouteRepository |
| ext | 构建接线 | DefaultQuoteFlow |
| root | ParcelModule工厂与四模块build | 不猜测资源实现 |

主样例7份生成生产Scala＋3份外置手写Scala。另有2份build和2份形状测试，项目writer另写4份派生证据；这些计数不能混成“全部业务实现由JS生成”。

root公开API：

```scala
def create(routes: Map[RouteId, Route])
  (implicit executionContext: ExecutionContext): QuoteFlow
```

Bridge只适配同kernel纯实现；直接实现port时不生成冗余Bridge。kernel不能依赖ext，生产classpath不包含compiler或ScalaTest。

## 捕获、生成与来源

样例必须复制到工具安装根之外的独立项目。原scaffold处于工具自身目录，不作为特殊豁免的可写项目。

```bash
truthsrc validate --tree /absolute/project/truth/module-seams
truthsrc roundtrip --tree /absolute/project/truth/module-seams
truthsrc compile-project --project /absolute/project/truthsrc.project.json
truthsrc generate-project --project /absolute/project/truthsrc.project.json --out /absolute/project/generated --plan
truthsrc generate-project --project /absolute/project/truthsrc.project.json --out /absolute/project/generated
truthsrc verify-project --project /absolute/project/truthsrc.project.json --out /absolute/project/generated
truthsrc query-project --project /absolute/project/truthsrc.project.json --out /absolute/project/generated --implementation repository
```

每个外置源码根的完整membership与声明必须一致，不按扩展名忽略额外文件。生成前后重验身份、stat、字节与membership，拒绝symlink/hardlink、别名、交叠和未声明来源。仅原live capture允许生成；JSON/AST克隆只供展示或对账。raw `generate-products`对本族拒绝，因为它缺少项目mixed-input准入。

生成代码使用唯一writer及原 `source-plan/v1`。最终UTF-8 span关联作者或技术binding；手写来源独立且仅file级，`symbolVerified/spanVerified/runtimeVerified=false`，不伪装generated anchors。`--file`仍限generated根；外置导航用 `--implementation`。

作者、binding或手写变化均需报告过期并显式update。移址项目/安装前缀后重新capture和生成，不承诺旧build中的绝对外置路径原地可移址。apply晚失败可能已写图或文件，不承诺全局回滚。

## 有限验收口径

2026-11-08主样例reference和generated-mixed均真实通过四模块direct Scala编译、原34独立业务案例、原七组编译控制；生成lane另跑两个形状测试。扩展控制验证constructor/EC/delegate/缺实现/同名类与两项固定业务变异。五种作者变体验证分组文件互引、sum/root与支持suite同短名、direct实现无Bridge。

离线tarball安装、prefix移址、仅installed来源的新项目、三输入stale/update以及installed混合源码编译和12项扩展控制均已执行；共享helper修后，旧family1/family2的reference/generated四lane共93阶段通过。冻结后current06对三个family重新执行109阶段并登记24条当前观察，本族代码的generation/compiled/behavior使用同一输入及相同artifact集合。build只登记generation，不冒sbt执行或产品全输入认证。

这些有限工程结果不等发布或架构批准。完整公共Node full17为4084通过/15既有opt-in跳过/0失败，artifact68/68、onboarding34/34及BC文档门通过；BC50/Play32派生同步及八仓3424来源核验通过。详细逐门结果、full12预算FAIL保留及最后文档保护边界见[第五批有限验收](../MODULE-SEAMS-ACCEPTANCE.md)。失败回执和原独立oracle保持，不从本页声明推导未执行门通过。

## 明确不支持

不自动组合Actor、持久化、PB、serializer、PID、codec、真实数据库、Saga或Monarch。Saga跨聚合事务与Monarch流程编排仍是不同机制。没有银行服务replay/R2切换；retry/backoff/deadline债仍OPEN。

允许的有限签名为String/Boolean/Long、已声明名义record/closed sum以及Option/Vector/Map/Either；不支持递归名义类型、开放sum、默认值、重载、任意外部Scala类型或代码表达式。BC的mjs目标代码不属于用户认可金样，不能用其输出作为独立oracle。
