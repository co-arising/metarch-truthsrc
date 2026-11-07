# 应用流程端口

类别：`application-flow-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

声明应用流程的输入输出，使controller/宿主消费抽象而非静态调用ext实现。允许异步端口但不等于纯领域算法。

## 输入与人工信息

用例参数、主体/租户、返回错误/回执和可用性由用例合同决定；生成接口不能发明用例政策。

## 生产与所有权

di-poc的FlowPorts与bank-p23的BankApplicationPorts是分别维护的手写接口，不能把它们算成BC或JS已生成的具名FlowPorts。

JS正式Play service另有真实的应用流程调用合同：render-service.mjs#renderService消费artifact-contract中的service.endpoints及明确port/input/output/implementation ID，输出<Artifact>Service.scala中的Endpoint[I,O].run、Bindings、Composition与Factory。这属于本类别的生成能力，但不是上述具名trait的生成器，也不是端点背后的业务实现。

按profile区分手写接口、生成调用边界和实现责任，见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码定位不证明本轮生成、端点装配执行、业务验收或最终批准。

## 结构与命名

di-poc FlowPorts含NoteParamEnricherPort/RegisterUserFlowPort/RequestDoRFlowPort，手写接口可与签名VO同文件。JS正式合同位于service/<Artifact>Service.scala，Endpoint的run为(Principal, I) => Future[Outcome[O]]，Bindings持有各端点；这不是生成一个名为FlowPorts的trait族。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

di-poc接口放kernel、实现放ext、root绑定；ext可依赖glue I/O而glue不反向依赖ext。JS正式单项目由显式Composition/Factory提供Authority、Bindings及生命周期，Endpoint.run的业务体由实现方提供，不能据此推定同样的kernel/ext模块布局。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

接口可替换、错误类型与Future生命周期、权限/用例独立oracle；不可把手写接口标为BC已全自动生成。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：di-poc / bank-p23的手写接口与js-formal的Endpoint.run/Bindings合同。生成调用边界属于本类别，但不改变具名FlowPorts及其业务实现的手写所有权。

- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/application/FlowPorts.scala` — `RegisterUserFlowPort`。
- `bank:handwritten/scala/example/bankwealth/integration/BankApplicationPorts.scala` — `BankReadQueries`。
- `js:generators/scala-cqrs-play-service/render-service.mjs` — `renderService`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`signature-value-closure`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Future-returning quote application port; failure and absence are distinct. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
