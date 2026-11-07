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
