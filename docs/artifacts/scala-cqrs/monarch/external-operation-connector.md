# 外部操作连接器与证据验证

类别：`external-operation-connector`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

实现submit/query和领域证据验证，按原请求核实外部事实。NotFound、Idle、timeout都不是安全未执行证明。

## 输入与人工信息

connector ID/version、ledgerEpoch、OperationKey/EffectKey、request/evidence codec及有界I/O；ledgerEpoch不是宿主PID。

## 生产与所有权

`monarch-r1`和`monarch-r2`均由应用拥有具体connector、request/evidence编码和安全证明实现，责任为`handwritten`、能力为`not-generated`；库只提供`ExternalOperationPort`接口和Typed helper。未定位JS/BC原生R1/R2具体connector producer。

默认拒绝的validator是安全边界，不是已经实现领域查证。银行手写TA effect binding属于P23宿主合同，不能算作本接口的R2采用证据。

逐profile责任与证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。NotFound/timeout不授权安全重发，业务retry/backoff/deadline仍需独立实现与验收。

## 结构与命名

ExternalOperationPort和Typed[A]/PayloadCodec；validateEvidence与validateSafeToSubmit默认拒绝，后者证明同key幂等或先前执行不可能再生效。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

库先验key/digest/epoch，再调用纯证据校验；阻塞I/O使用独立有界执行上下文，页面查询不制造完成。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

ACK丢失无taskId仍query原请求、假/错epoch回执、查询为空、安全重发证明与预算耗尽。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

R1/R2提供接口，不提供具体业务connector的默认正确实现。银行仍P23；测试源码存在不证明金融查证已执行，最终批准仍需独立证据。

- `monarch:src/main/scala/net/imadz/monarch/persistence/operation/ExternalOperationPort.scala` — `ExternalOperationPort`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；接口签名不是银行R2采用证明。

### 真实端口形状

```scala
def submit(request: Request): Future[Observation]
def query(request: Request, lastEvidence: Option[Evidence]): Future[Observation]
def validateEvidence(request: Request, observation: WithEvidence): Either[String, Unit]
def validateSafeToSubmit(request: Request, proof: Evidence, lastEvidence: Option[Evidence]): Either[String, Unit]
```

后两项默认Left；宿主必须给出可信领域证明。查询的NotFound不是safeToSubmit，timeout也不能释放资源或清空预算。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `typed-run`：Pure fixed-step or single-operation managed Run generated reads/writes/outcomes, typed leaf adapters, six-field identity checks and bounded Host. Low-level reference facade is separate from declared Run generation.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
