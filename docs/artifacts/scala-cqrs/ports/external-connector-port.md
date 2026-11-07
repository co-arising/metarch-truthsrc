# 外部系统连接器接口

类别：`external-connector-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

声明外部能力、输入输出及执行/查询分离的契约。不把一个函数返回成功等同于外部结果已确证。

## 输入与人工信息

端点能力、版本、codec、身份/幂等、回执验证和未知结果处理必须显式。

## 生产与所有权

BC由ConnectorBuilder/Template读取application.connectors，生成application/connectors/<Name>.scala。connector-iface未列入targetModuleOf的kernel分支，多模块当前回落root/app；模板还无条件生成@ImplementedBy。接口内层化、外层绑定是目标，不是这条原始生产路径已达成的事实。

JS正式render-technical-ports.mjs#renderTechnicalPorts消费reference-layout、saga-host-contract及artifact-contract，输出<host>TechnicalPorts.scala中的trait、Bindings、Installed和install；Installed校验身份/版本并委托已提供callback，不生成外部I/O或权限oracle。legacy connector-dsl另生成Future返回的Connector trait及实现骨架，不能与正式严格端口互认语义。

各profile的接口生成、装配和实现责任见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码识别不等于本轮编译、外部集成或最终批准。

## 结构与命名

Connector trait、TechnicalPorts及Installed组合器；strict PhasePort和Monarch ExternalOperationPort为更强的具体协议，分册详细说明。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

目标是实现adapter在外层ext/glue、接口不依赖实现；BC当前root输出与@ImplementedBy债如上。JS正式路径负责声明/严格准入和callback委托，不提供默认成功I/O；此保证不能直接套到legacy接口骨架。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

缺实现、版本/codec错配、执行/查询参数身份与未知结果；外部安全性需要独立集成证据。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-single / bc-multi / js-formal及JS legacy connector-dsl。BC当前root放置与注解债、JS正式严格准入和legacy Future接口不能互相代替。

- `bc:src/main/scala/net/imadz/codegen/scaffolding/cqrs/template/application/ConnectorTemplate.scala` — `ConnectorTemplate`。
- `js:generators/scala-cqrs-application/render-technical-ports.mjs` — `renderTechnicalPorts`。
- `js:generators/connector-dsl/emit.mjs` — legacy Connector trait输出。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`signature-value-closure`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
