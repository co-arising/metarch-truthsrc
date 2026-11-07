# 端口默认实现薄桥

类别：`port-bridge`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在合法依赖方向内把已存在纯实现转换为port实例；不是替代实际实现或恢复旧全局可变Access门。

## 输入与人工信息

bridge目标、module和方法签名必须声明；真实现位于ext时不能在kernel发桥静态引用它。

## 生产与所有权

BC多模块的桥由Metarch选定pipeline中的rules_domain_gen.mjs#portDecls按functions/ports声明生成；MULTI && bridge.module成立时省略桥，绑定留给root，并不输出旧Access全局对象。它不是raw Scala CodegenMain自带的通用桥生产能力。di-poc的ContentFingerprintBridge是同kernel纯实现的参考实例。

JS legacy service-dsl/emit.mjs#emitPort也真实输出trait与可选桥，但只检查fq/target，不实现BC的bridge.module多模块抑制，签名/import推断亦受限。retired scala-cqrs-es-rules的声明桥是另一历史路径；都不应当作正式typed-product链已经保证跨模块安全。复制的BC式文件头不改变JS实际写入者。

桥的生成/省略条件和所有权按profile分别记录，见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码支持不等于已执行依赖闭包、编译或最终批准。

## 结构与命名

ContentFingerprintBridge与trait同文件可合法。BC源码的实际省略条件是MULTI && bridge.module，由root承担对应绑定；JS legacy emitPort不执行该条件，不能照搬BC的模块安全保证。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

只允许接口模块依赖既有内层实现；跨层依赖通过root装配解决，不以复制实现绕过。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

多模块桥生成/省略两分支、签名参数透传和依赖方向，缺bridge不能默认为缺功能。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-multi / di-poc及JS legacy service-dsl；retired路径见上文。BC的桥省略条件未由JS legacy实现，是否统一属于后续工具链裁决，本批只保留差异而不修改生成器。

- `bc:knowledge_base/design_docs/field_template/tools/rules_domain_gen.mjs` — `portDecls / bridgeSkip / bridgeBlock`。
- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/domain/service/ContentFingerprintPort.scala` — `ContentFingerprintBridge`。
- `js:generators/service-dsl/emit.mjs` — `emitPort`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`computation-port`、`domain-service`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Same-layer pure bridge delegates to CapacityRule; no static external implementation reference. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。
