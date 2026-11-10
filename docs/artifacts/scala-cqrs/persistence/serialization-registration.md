# 序列化注册与扩展

类别：`serialization-registration`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

集中注册具体消息/状态类型与serializer，实现运行期可解析的序列化依赖。

## 输入与人工信息

类型清单、serializer ID/manifest、extension初始化顺序与配置层叠由运行profile提供。

## 生产与所有权

JS正式注册配置由scala-cqrs-domain/scaffold.mjs#renderScaffold、applicationBuild及所选child/effect配置增补共同生成。非Play目标输出src/main/resources/application.conf；Play service重映射到conf/serialization.conf并由application.conf包含。输入为serializationModel、所选host/child/effect合同及显式runtimeArtifact，不是凭空生成运行库。

saga-strict的reference.conf由saga-core库提供，应用合并配置并补应用类型；库源码资源存在不证明发布jar或实际消费配置。di-poc SerializationExtension是按participant类/manifest维护ConcurrentHashMap的旧策略注册机制，不是strict运行库的新注册方式；legacy run-all复制的静态serialization.conf又是独立支持路径。

按profile区分生成接线、运行库提供和历史维护机制，见[能力矩阵](../../CAPABILITY-MATRIX.md)。本轮未编译、加载实际序列化系统或最终批准。

## 结构与命名

SerializationExtension/策略注册与reference.conf/serialization.conf；基础运行库可随jar携带自己的注册，应用只补实际集成面。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

避免宽泛父trait绑定捕获内部消息；extension必须在相关actor行为使用前就绪，启动延时不是跨版本保证。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实际序列化系统注册、ID冲突、配置缺失及新State/Event覆盖；不把配置文本存在当运行接线成功。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：di-poc旧participant策略注册、saga-strict库配置、JS正式应用配置生成及legacy静态复制。strict库不把旧participant注册机制恢复为应用生成要求；发布制品与消费配置需另有证据。

- `dipoc:modules/glue/src/main/scala/net/imadz/common/serialization/SerializationExtension.scala` — `SerializationExtension`，legacy注册。
- `saga:src/main/resources/reference.conf` — strict库提供的序列化配置。
- `js:generators/scala-cqrs-domain/scaffold.mjs` — `renderScaffold`。
- `js:generators/scala-cqrs-application/render-build.mjs` — `applicationBuild`，结合选定child/effect增补。
- `js:generators/scala-cqrs-play-service/generate.mjs` — `inherited`，Play配置重映射。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`protobuf-serializer`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

## 第六批有限 persistence-readside 候选登记

本类新增 `js-persistence-readside-candidate-v1`，由显式 `scala-cqrs-persistence-readside-v1`／`scala-cqrs-persistence-readside@1` 提供；模块为 `glue`。本段只登记实际源结构，不宣称本批已完成或已编译。

实际输出合同（可覆盖同一物理文件中的不同职责，不按合同数冒充文件数）

- `persistence-runtime`／`persistence-runtime`：Versioned frame validation and event/state encode/decode dispatch through the existing DomainConverters ABI; explicit wire-registration rows, not a journal implementation. 路径 `modules/glue/src/main/scala/**/infrastructure/persistence/*.scala`。
- `serialization-config`／`serialization-config`：Explicit Akka serializer registration and binding for this Frame, with no journal default. 路径 `modules/glue/src/main/resources/reference.conf`。

输入为唯一业务作者树、原七个 family2 产品及显式 persistence-readside 技术 binding；wire layout SHA 必须核对，不能自动重签。沿用 family2 kernel/glue 和唯一 writer；生成测试与独立 oracle 分开，sbt 定义存在不等任务执行。

本次登记移除旧 active evidence 引用，原24观察和旧回执在[独立历史索引](../../evidence/capability-persistence-readside-prior-current06-history.json)保真；新观察要在生产冻结后单独采集并通过原公共验证器。本段及目录 implemented 仅表示实现存在，当前 generated/compiled/behavior/final-approved 不由本配方晋升。范围与限制见[本族合同](../PERSISTENCE-READSIDE.md)。

读侧文件库重放不是生产 Actor journal 耐久性；不扩张为 MySQL、任意读模型、HTTP、银行/Saga/Monarch 或架构批准。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `serialization-registration`：Explicit fixed Saga/R2 serializer bindings; no journal or production storage defaults.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
