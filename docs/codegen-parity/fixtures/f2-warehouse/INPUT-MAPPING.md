# F2 Warehouse：输入映射、无损 adapter 准入与 expected 文件角色

状态：**content-specification；传统 BC counterpart 仍 missing-counterpart。** 本文件与 [mapping.json](mapping.json) 是新文档，不是作者树、public schema、可执行 fixture、实现许可或运行回执。

## 1. 边界与来源身份

本轮只写这两个文件；不修改作者/生成器/catalog/生成应用/.truthsrc/ledger/anchors/银行/基线/旧稿，不复制外部源码，不执行生成、validate、roundtrip、编译、测试、typecheck、服务、下载、发布或 Git 操作。没有调用子 agent/Workflow/任务工具。**CC 全部未测；同输入未建立；实际 expected 未生成。**

本轮用户更窄授权优先于仓库日常执行规则（[D-agents] L31–33）。文档授权不是实施授权（[D-authoring] L1–3、17、47–48；[D-fixture] L3、52–64、115）。主agent分工转述的要求是 `net.imadz:common-core_2.13:0.2` 发布制品优先、实施前另锁字节；common-core 演进属另一会话，本轮未调查 glue，`withPost/policy` 不当发布 API。三退休任意源码槽全部 **blocked**，不用 B 兜底。这些约束为主agent分工转述，不是用户逐字原话，也不伪装成固定源码事实。

证据严格分层：

- **author snapshot**：既有 scaffold 的 11 个作者文件；identifier/guards/folds/host/四 nominal 的事实来源，不另造作者项目。
- **technical input**：既有 project config + persistence binding；不与 BC 的 saga-type binding 混同。
- **independent HAND**：固定 aggregate-core/persistence-readside 参考源码、proto、config 与旧 ABI 文档；不是新 JS 输出，也不是传统 Scala raw 金样。
- **BC adapter snapshot**：固定 `SerialCanonicalAdapter.scala`，只作现状差异证据；未调用、未制作 canonical/SystemMetadata。
- **synthetic admission snapshot**：重复字符 pin 的测试源码，未运行，绝不能作真实 wire bytes。

下文 source ID 都在末尾链接到**已存在固定副本**；`L` 是该文件 1-based 行号。完整来源绝对路径、原仓身份、实际 SHA-256、bytes、行数见 JSON `sources`。该表记录 27 个固定来源及 6 个指引/文档的实际 SHA；不把来源文件 SHA 当 layout SHA 或历史 bytes SHA。文档的输入 pin 不意味着永远不变，后续必须按 SHA 重新核对。

## 2. 原输入 → HAND/JS 来源 → BC 差异 → 准入逐槽表

所有“准入”均为未来有限 adapter 的必要条件，**不是本轮批准或通过**。HAND 列只描述实读源码/声明；JS generator 只依既有 config 与来源证据定位，未运行它或调查可变生成器。每槽状态为 `missing-counterpart`；已有源事实不因缺 adapter 而被改写。
### F2-01 项目/context/package 与入口

| 面 | 内容 |
|---|---|
| 原输入 | system.id=persistence-readside；workshop=persistence-readside-reference；context=inventory；canonicalId=inventory-domain。项目选择 scala-cqrs-persistence-readside-v1 和八个显式 products。 |
| HAND / JS 来源 | options.packages 给 example.inventory；protobuf.package 给 example.inventory.protobuf；names/exactTypes/exactCodecs/assemblies 为空。配置是既有输入，不是本轮运行结果。 |
| BC 固定 adapter 差异 | assemble 接 canonical + bindings；context/system 从 workshop 拆连字符转 PascalCase 推导，不读取此项目 packages/protobuf 配置。若投影保留该 workshop，则为 PersistenceReadsideReference / PersistenceReadsideReferenceSystem，而非显式 inventory/example.inventory。未制作该 canonical，非实跑输出。 |
| 无损准入 / 保守默认 | 分别锁定业务 ref 的 context、Scala FQN、PB package 与系统/workshop 身份；不得只换包忽略输入差异。无已批准的 Warehouse→传统 runCommon 同输入投影。 |

证据：[S-warehouse-system][S-warehouse-system] L3–19；[S-warehouse-context][S-warehouse-context] L3–7；[S-warehouse-config][S-warehouse-config] L2–38；[S-bc-file-adapter][S-bc-file-adapter] L38；[S-bc-file-adapter][S-bc-file-adapter] L397–416；[D-fixture][D-fixture] L9–16。
### F2-02 技术 binding 不可直接互换

| 面 | 内容 |
|---|---|
| 原输入 | documents[id=persistence].file=bindings/persistence.json；roles.persistenceReadsideBinding=persistence；binding 为 truthsrc.persistence-readside-binding/v1。 |
| HAND / JS 来源 | wire 三注册与 store/Receipt 配置是独立技术输入；不是业务作者的第二份 canonical。 |
| BC 固定 adapter 差异 | BC 在 /bindings/sagas/*/types 读取 bound types，且要求至少一个；当前 Warehouse persistence binding 无此入口。不能称原 binding 可直接传入；未实际调用 assemble。 |
| 无损准入 / 保守默认 | 若未来有有限 adapter，必须显式保存不同技术协议之间的投影来源；不伪造 saga/type 长度约束或手写 canonical/request/compiled 绕过入口。 |

证据：[S-warehouse-config][S-warehouse-config] L16–25；[S-warehouse-binding][S-warehouse-binding] L1–45；[S-bc-file-adapter][S-bc-file-adapter] L69–130。
### F2-03 名义类型 TxId

| 面 | 内容 |
|---|---|
| 原输入 | inventory/type/TxId，version="1"，dataType=String，fields=[]；两命令 txid、commit 事件 txid 与 receipts 的 key。 |
| HAND / JS 来源 | DomainConverters.encodeTxId/decodeTxId 使用独立 domain TxId 与 PB TxIdValue，载体为 .value / f0；PB string f0=1。HAND 值类声明本身不在所选固定副本内，不能称定义闭包已齐。 |
| BC 固定 adapter 差异 | 现有 bound kind id/text 降成 StringType；dtype 按 bound.dataType 返回，最后只为 money 产生 valueObjects。把四类型补作 id/text 也会丢失 nominal，且要求原输入未给的 minLength/maxLength。 |
| 无损准入 / 保守默认 | 保留 TxId 的 context/ref/version/FQN 与独立 encode/decode 边；不得 alias String、合并其它 ID、新增 UUID/格式/长度规则。相同 PB 形状不等于名义类型相同。 |

证据：[S-warehouse-txid][S-warehouse-txid] L3–12；[S-warehouse-config][S-warehouse-config] L29–32；[S-warehouse-converter][S-warehouse-converter] L23–27；[S-warehouse-domain-proto][S-warehouse-domain-proto] L12–14；[S-bc-file-adapter][S-bc-file-adapter] L89–117；[S-bc-file-adapter][S-bc-file-adapter] L136–159；[S-bc-file-adapter][S-bc-file-adapter] L394–410。
### F2-04 名义类型 WarehouseId

| 面 | 内容 |
|---|---|
| 原输入 | inventory/type/WarehouseId，version="1"，dataType=String，fields=[]；aggregate identifier id 与两命令 warehouseId；不在 HAND state 中。 |
| HAND / JS 来源 | DomainConverters.encodeWarehouseId/decodeWarehouseId 使用独立 domain WarehouseId 与 PB WarehouseIdValue，载体为 .value / f0；PB string f0=1。HAND 值类声明本身不在所选固定副本内，不能称定义闭包已齐。 |
| BC 固定 adapter 差异 | 现有 bound kind id/text 降成 StringType；dtype 按 bound.dataType 返回，最后只为 money 产生 valueObjects。把四类型补作 id/text 也会丢失 nominal，且要求原输入未给的 minLength/maxLength。 |
| 无损准入 / 保守默认 | 保留 WarehouseId 的 context/ref/version/FQN 与独立 encode/decode 边；不得 alias String、合并其它 ID、新增 UUID/格式/长度规则。相同 PB 形状不等于名义类型相同。 |

证据：[S-warehouse-id][S-warehouse-id] L3–12；[S-warehouse-config][S-warehouse-config] L29–32；[S-warehouse-converter][S-warehouse-converter] L29–33；[S-warehouse-domain-proto][S-warehouse-domain-proto] L16–18；[S-bc-file-adapter][S-bc-file-adapter] L89–117；[S-bc-file-adapter][S-bc-file-adapter] L136–159；[S-bc-file-adapter][S-bc-file-adapter] L394–410。
### F2-05 名义类型 SkuId

| 面 | 内容 |
|---|---|
| 原输入 | inventory/type/SkuId，version="1"，dataType=String，fields=[]；两命令 skuId 与 host 参数。 |
| HAND / JS 来源 | DomainConverters.encodeSkuId/decodeSkuId 使用独立 domain SkuId 与 PB SkuIdValue，载体为 .value / f0；PB string f0=1。HAND 值类声明本身不在所选固定副本内，不能称定义闭包已齐。 |
| BC 固定 adapter 差异 | 现有 bound kind id/text 降成 StringType；dtype 按 bound.dataType 返回，最后只为 money 产生 valueObjects。把四类型补作 id/text 也会丢失 nominal，且要求原输入未给的 minLength/maxLength。 |
| 无损准入 / 保守默认 | 保留 SkuId 的 context/ref/version/FQN 与独立 encode/decode 边；不得 alias String、合并其它 ID、新增 UUID/格式/长度规则。相同 PB 形状不等于名义类型相同。 |

证据：[S-warehouse-skuid][S-warehouse-skuid] L3–12；[S-warehouse-config][S-warehouse-config] L29–32；[S-warehouse-converter][S-warehouse-converter] L35–39；[S-warehouse-domain-proto][S-warehouse-domain-proto] L20–22；[S-bc-file-adapter][S-bc-file-adapter] L89–117；[S-bc-file-adapter][S-bc-file-adapter] L136–159；[S-bc-file-adapter][S-bc-file-adapter] L394–410。
### F2-06 名义类型 ReservationId

| 面 | 内容 |
|---|---|
| 原输入 | inventory/type/ReservationId，version="1"，dataType=String，fields=[]；reserve 事件 reservationId、commit 参数 reservationId 与 host 输出。 |
| HAND / JS 来源 | DomainConverters.encodeReservationId/decodeReservationId 使用独立 domain ReservationId 与 PB ReservationIdValue，载体为 .value / f0；PB string f0=1。HAND 值类声明本身不在所选固定副本内，不能称定义闭包已齐。 |
| BC 固定 adapter 差异 | 现有 bound kind id/text 降成 StringType；dtype 按 bound.dataType 返回，最后只为 money 产生 valueObjects。把四类型补作 id/text 也会丢失 nominal，且要求原输入未给的 minLength/maxLength。 |
| 无损准入 / 保守默认 | 保留 ReservationId 的 context/ref/version/FQN 与独立 encode/decode 边；不得 alias String、合并其它 ID、新增 UUID/格式/长度规则。相同 PB 形状不等于名义类型相同。 |

证据：[S-warehouse-reservationid][S-warehouse-reservationid] L3–12；[S-warehouse-config][S-warehouse-config] L29–32；[S-warehouse-converter][S-warehouse-converter] L41–45；[S-warehouse-domain-proto][S-warehouse-domain-proto] L24–26；[S-bc-file-adapter][S-bc-file-adapter] L89–117；[S-bc-file-adapter][S-bc-file-adapter] L136–159；[S-bc-file-adapter][S-bc-file-adapter] L394–410。
### F2-07 ReserveSkuQuantity 参数与决策顺序

| 面 | 内容 |
|---|---|
| 原输入 | 有序参数 (txid:TxId, warehouseId:WarehouseId, skuId:SkuId, quantity:Long)，均 BUSINESS_INPUT。先 quantity>0，否则 quantity-positive/reject；然后 receipts 不含 txid，否则 succeed-empty；最后 emit。 |
| HAND / JS 来源 | HAND rules 先检查 >0L，再 receipts.contains，再 emit；helper 只在最后分支调用 reservationIdentity(txid,warehouseId,skuId,quantity)。Right(Vector.empty) 不调用 host。 |
| BC 固定 adapter 差异 | BC ParameterMetadata 保留参数数组次序并用 dtype 解析，guard 原 JSON 保留在 FormalGuards；这不证明 guard 执行顺序/空成功已由传统目标实现，nominal 与 host 槽仍不通。 |
| 无损准入 / 保守默认 | 不得交换两 guard：已有 receipt 的非正 quantity 仍拒绝。已有 receipt 的正 quantity 空成功，不按 receipt value 判定。不得新增库存可用量/warehouse-sku 归属/数量上限或默认 quantity。 |

证据：[S-warehouse-reserve][S-warehouse-reserve] L8–55；[S-warehouse-rules][S-warehouse-rules] L20–24；[S-warehouse-helpers][S-warehouse-helpers] L9–15；[S-bc-file-adapter][S-bc-file-adapter] L207–224；[S-bc-file-adapter][S-bc-file-adapter] L300–305。
### F2-08 ReservationIdentity 两层输入合同

| 面 | 内容 |
|---|---|
| 原输入 | technical-port ReservationIdentity@1 声明 inputType=TxId/outputType=ReservationId；host-computation 同 ref@1 关联 ReserveSkuQuantity，明确四个 inputDependencies，stableIdentityContract=reservation-per-original-inputs@1 的 keys 也是四个原参数。 |
| HAND / JS 来源 | HAND helper 调用 hosts.reservationIdentity(command.txid,command.warehouseId,command.skuId,command.quantity)；这证明调用形状，所选副本未包含 WarehouseComputations trait/实现。 |
| BC 固定 adapter 差异 | reserve binding.expr 是对象 {form:host,id,version}；BC emissions 用 _.str 提取 expr，不支持此对象。不能保证得到整理后的 Left；静态可见直接 .str 形状不匹配，未执行异常复现。 |
| 无损准入 / 保守默认 | 保留 port 声明与 host-computation 四输入层次，不因 inputType=TxId 就删另外三参。稳定身份合同不是具体算法或实际 ReservationId；不得 randomUUID、拼接、hash、返回 txid 或造成功值。有限表达式/行为 port 接入仍 blocked。 |

证据：[S-warehouse-port][S-warehouse-port] L3–14；[S-warehouse-host][S-warehouse-host] L10–113；[S-warehouse-reserve][S-warehouse-reserve] L67–80；[S-warehouse-helpers][S-warehouse-helpers] L9–15；[S-bc-file-adapter][S-bc-file-adapter] L247–267。
### F2-09 事件 SkuQuantityReserved 与 identity fold

| 面 | 内容 |
|---|---|
| 原输入 | 只一个 payload reservationId:ReservationId，origin=COMPUTED；由 ReserveSkuQuantity 产生，host binding 赋值；foldAssignments=[]。没有 txid/warehouseId/skuId/quantity payload。 |
| HAND / JS 来源 | helper Vector(SkuQuantityReserved(hostResult))；HAND fold case _: SkuQuantityReserved => state。这里 identity 是状态不变，不是计算 ID，也不是库存扣减。 |
| BC 固定 adapter 差异 | BC 空 fold 不产生 FormalFold；AST 对所有事件都放 referenceCode=Some("state")。reserve 的 identity 只有作者+HAND 联合证据可认定，不能把所有 AST identity fallback 当真实业务 fold。 |
| 无损准入 / 保守默认 | 必须保持无状态字段变更；若 receipt 仍不存在，重复 reserve 会再次调用 host 并 emit，不得增加 reserve 去重/预留表。host 的稳定性不等于空事件幂等。 |

证据：[S-warehouse-reserve][S-warehouse-reserve] L31–33；[S-warehouse-reserve][S-warehouse-reserve] L56–84；[S-warehouse-helpers][S-warehouse-helpers] L9–15；[S-warehouse-fold][S-warehouse-fold] L7–12；[S-bc-file-adapter][S-bc-file-adapter] L268–299；[S-bc-file-adapter][S-bc-file-adapter] L379–388。
### F2-10 CommitSkuReservation 参数与决策

| 面 | 内容 |
|---|---|
| 原输入 | 有序参数 (txid:TxId, warehouseId:WarehouseId, skuId:SkuId, reservationId:ReservationId)，均 BUSINESS_INPUT；仅 receipts map-absent guard，onFail=succeed-empty。 |
| HAND / JS 来源 | 存在 key 就 Right(Vector.empty)；否则 emit SkuReservationCommitted(command.txid)。helper 不消费另外三参，但命令仍保留它们，且此分支不调用 host。 |
| BC 固定 adapter 差异 | BC 保留参数/produces/guards 形状但 nominal 降格；未获同输入执行证明。不能用删掉未消费参数来假称无损。 |
| 无损准入 / 保守默认 | 无 receipt 时可直接 emit，所选输入没有校验先 reserve、reservationId 匹配或库存算法。已有同 txid 即空成功，即使其它输入不同；新增一致性/先后规则属于新业务语义，blocked。 |

证据：[S-warehouse-commit][S-warehouse-commit] L8–47；[S-warehouse-rules][S-warehouse-rules] L26–29；[S-warehouse-helpers][S-warehouse-helpers] L17–21；[S-bc-file-adapter][S-bc-file-adapter] L207–224；[S-bc-file-adapter][S-bc-file-adapter] L315–330。
### F2-11 事件 SkuReservationCommitted 与 receipt fold

| 面 | 内容 |
|---|---|
| 原输入 | 只一个 payload txid:TxId，PROPAGATED，binding expr=param.txid；fold 为 receipts put event.txid -> literal:SkuReservationCommitted。 |
| HAND / JS 来源 | HAND fold state.copy(receipts=state.receipts.updated(value.txid,"SkuReservationCommitted"))。保留其它键，对该键置固定文本；不是取 reservationId、receipt 对象或回复。 |
| BC 固定 adapter 差异 | BC 可把 put 行存到 FormalFold；但 EntityBehavior AST 对 commit 仍是 identity fallback。丢弃 FormalSemantics 后仅比较 AST 会漏掉此唯一状态变化。 |
| 无损准入 / 保守默认 | 显式区分 command guard 与 event fold：正常重复 commit guard 不发事件；直接 fold/replay commit 仍 updated 该键。不得用 state identity 代替 receipt fold，也不新增 UUID、库存、金额或时间字段。 |

证据：[S-warehouse-commit][S-warehouse-commit] L48–74；[S-warehouse-helpers][S-warehouse-helpers] L17–21；[S-warehouse-fold][S-warehouse-fold] L8–12；[S-bc-file-adapter][S-bc-file-adapter] L268–299；[S-bc-file-adapter][S-bc-file-adapter] L378–388。
### F2-12 state、identifier 与初值来源

| 面 | 内容 |
|---|---|
| 原输入 | aggregate identifier id:WarehouseId，origin=BUSINESS_INPUT；stateFields 恰为 receipts:Map[TxId,String]，author default=[]。entity 名为 WarehouseEntity。 |
| HAND / JS 来源 | HAND WarehouseState(receipts:Map[TxId,String]=Map())；WarehouseState.empty=WarehouseState()。作者 [] 是该 map 的表示，非 List 业务类型；identifier 不属于此 HAND state。 |
| BC 固定 adapter 差异 | BC stateFields 只取 name/dataType/writtenBy，未读 default；stateVo 又把 identifier 加在首字段，改变构造参数及 PB 根布局。若 id/text 补绑定，receipts key 还变成 String。 |
| 无损准入 / 保守默认 | state 只保留 receipts 与明确空 map 初值；identifier 保留为聚合元数据/调用方输入，不注入 state、事件或 snapshot。不得猜 id/empty(id)/random UUID 或从 PID 反推。 |

证据：[S-warehouse-author][S-warehouse-author] L11–24；[S-warehouse-state][S-warehouse-state] L5–11；[S-bc-file-adapter][S-bc-file-adapter] L186–204；[S-bc-file-adapter][S-bc-file-adapter] L89–94。
### F2-13 receipt 不是持久化/回复身份

| 面 | 内容 |
|---|---|
| 原输入 | 业务 receipts:Map[TxId,String] 与技术 index Receipt/table receipt/by_resource 引用同一 state-field；wire/storage binding 的 identity.kind=envelope-resource。 |
| HAND / JS 来源 | HAND receipt fold 仅固定文本；旧独立 ABI 规定 PID/resource/namespace 外部传入，projection 的 reserve event 可推进 checkpoint 而 state 不变；empty-success 不造投影步骤。这些是 ABI 文本，不是本轮 JDBC 行为结果。 |
| BC 固定 adapter 差异 | BC 此 assemble 返回空 infrastructure projections/repositories；未消费 Warehouse store/Receipt binding，且自行设 ShardedTags(name.toLowerCase,1)。 |
| 无损准入 / 保守默认 | 保留 TxId key、字面 receipt 与 index 映射；不能将 aggregate id、命令 warehouseId、resource、PID、namespace 互相猜值，也不以 receipt 文本替代 manifest/持久化回执。更完整读侧实现不纳入本轮覆盖。 |

证据：[S-warehouse-binding][S-warehouse-binding] L28–44；[S-warehouse-fold][S-warehouse-fold] L8–12；[S-warehouse-reference-contract][S-warehouse-reference-contract] L9；[S-warehouse-reference-contract][S-warehouse-reference-contract] L134–148；[S-bc-file-adapter][S-bc-file-adapter] L375；[S-bc-file-adapter][S-bc-file-adapter] L411–415。
### F2-14 Actor protocol 与回复非同构

| 面 | 内容 |
|---|---|
| 原输入 | 作者仅两条业务命令，无额外 GetState slice、无 classic per-command replyFamily 定义；参考 actor API 是独立应用层接口。 |
| HAND / JS 来源 | Execute(domain Command,ActorRef[Reply])；GetState(ActorRef[WarehouseState])；Reply=Accepted(Vector[Event]) / Rejected(String)。纯领域输入/事件不注入 replyTo。 |
| BC 固定 adapter 差异 | BC 为业务命令生成 typed CommandReplyRef(WarehouseReply)，族 WarehouseReplies 的 WarehouseReply(error:Option[iMadzError])。GetWarehouseStateReply(state) 只在存在 guard-less 且 produce-less query command 时加；F2 两命令不触发，不能声称 BC 已自动加 GetState。 |
| 无损准入 / 保守默认 | Accepted/Rejected/String code 与 error-only reply 不可互换；不得猜每命令 confirmation、reservationId/receipt/new-state 回复值，亦不为补接口新增作者命令。classic CommandHelper 目标需有限应用层 mapping 的另行裁定。 |

证据：[S-warehouse-author][S-warehouse-author] L6–8；[S-warehouse-reserve][S-warehouse-reserve] L31–54；[S-warehouse-commit][S-warehouse-commit] L31–46；[S-warehouse-actor][S-warehouse-actor] L7–22；[S-bc-file-adapter][S-bc-file-adapter] L217–224；[S-bc-file-adapter][S-bc-file-adapter] L340–361。
### F2-15 PB 名称、字段号与 required map

| 面 | 内容 |
|---|---|
| 原输入 | project 显式映射四个 *IdValue、WarehouseSnapshot、WarehouseSkuQuantityReserved、WarehouseSkuReservationCommitted；PB package=example.inventory.protobuf。 |
| HAND / JS 来源 | 固定 proto 的三个 roots 与 map wrapper/entry 字段号见 pbLayouts；state.receipts 为 Some(wrapper(present=true,...))，缺 root/wrapper/key 消息或 present=false 拒绝，重复 decoded TxId key 拒绝。 |
| BC 固定 adapter 差异 | BC assemble 不读取此 protobuf option；identifier 前插、StringType nominal 降格都不能视作保持该 layout。没有实际 BC Warehouse PB 输出。 |
| 无损准入 / 保守默认 | 保留 message 名、字段号、required presence 和 map key nominal；不可把显式 wrapper 改成原生 protobuf map 或缺省空 map；layout pin 不是 proto 源文件 SHA。 |

证据：[S-warehouse-config][S-warehouse-config] L25–37；[S-warehouse-domain-proto][S-warehouse-domain-proto] L1–48；[S-warehouse-converter][S-warehouse-converter] L10–11；[S-warehouse-converter][S-warehouse-converter] L47–100；[S-bc-file-adapter][S-bc-file-adapter] L186–204；[D-fixture][D-fixture] L52–64。
### F2-16 map 字节序与名义转换边界

| 面 | 内容 |
|---|---|
| 原输入 | receipts 的 key 为 TxId，value 为 String；作者不规定 Map 迭代顺序或 String 格式增强。 |
| HAND / JS 来源 | encode entry 后以 encoded.copy(f1="").toByteArray 取 keyBytes，用 unsigned byte 词典序排序；拒绝相同编码 key；decode 拒绝重复名义 key。四 value codec 直接用 value/f0，无新增 UUID/非空规则。 |
| BC 固定 adapter 差异 | 当前 BC nominal StringType 不满足这些独立 typed codec 边；本轮未定位 Warehouse 同输入 raw converter 产物。 |
| 无损准入 / 保守默认 | 保留排序算法/单个 key 编码含义，不换成 Scala String 排序或 hashCode；typed API 与 raw PB wire 形状分开。同形字符串 wrapper 可有相同字节，不宣称 payload 自带名义认证。 |

证据：[S-warehouse-converter][S-warehouse-converter] L13–70；[S-warehouse-domain-proto][S-warehouse-domain-proto] L12–47；[S-bc-file-adapter][S-bc-file-adapter] L89–94；[D-evidence-md][D-evidence-md] L105–108。
### F2-17 wire 注册、layout pins 与 synthetic 区分

| 面 | 内容 |
|---|---|
| 原输入 | serializerId=736401，envelopeVersion=1；event warehouse.reserved@1、event warehouse.committed@1、state warehouse.state@1 的三条 layoutSha256 来自 persistence binding。 |
| HAND / JS 来源 | HAND WirePins 三值与 binding 完全相同；注释自述历史 layout diagnostic，但本轮不读取 .rounds 或重算 PB。synthetic test 的 1/2/3.repeat(64) 明确不是 runtime layout。 |
| BC 固定 adapter 差异 | BC 此 adapter 无 Warehouse wire registry/pins 消费入口；不能拿自动 proto 名或其它 profile 的 pin 替换。 |
| 无损准入 / 保守默认 | 只把真实固定常量作为待实施输入 pin；来源文件 SHA、layout SHA、真实序列化 bytes SHA 三类分开。旧 REFERENCE-CONTRACT 第19行 pins pending 已被所选常量文本补齐，但运行/兼容性仍未测。 |

证据：[S-warehouse-binding][S-warehouse-binding] L7–27；[S-warehouse-wire][S-warehouse-wire] L3–9；[S-persistence-test-fixture][S-persistence-test-fixture] L7–16；[S-warehouse-reference-contract][S-warehouse-reference-contract] L19；[S-warehouse-persistence][S-warehouse-persistence] L17–25。
### F2-18 Frame、manifest 与角色拒绝

| 面 | 内容 |
|---|---|
| 原输入 | 独立技术 Frame package=example.inventory.persistence.protobuf；六个字段号固定；不修改 inventory_domain.proto。 |
| HAND / JS 来源 | HAND 检查 outer unknown fields/envelopeVersion、非空且有界 payload/serializedSize、完整 registry tuple，再校验 decoder role；manifest 精确 warehouse-frame/1/<role>/<typeId>/<wireVersion>/<layoutSha256>。parse 比对 manifest 后执行注册的一个 domain decoder。 |
| BC 固定 adapter 差异 | 没有此输入到传统目标 Frame/adapter 的无损对应证据；一般 PB parser 成功不是等价证明。 |
| 无损准入 / 保守默认 | event Frame 调 decodeState、state Frame 调 decodeEvent 必须拒绝；未知 type/version/layout/role/manifest 不回退。不能扩大此承诺为所有同 wire 形状错换或所有 nested PB unknown fields 都拒绝。 |

证据：[S-warehouse-frame-proto][S-warehouse-frame-proto] L1–13；[S-warehouse-persistence][S-warehouse-persistence] L26–60；[S-warehouse-converter][S-warehouse-converter] L23–45；[D-evidence-md][D-evidence-md] L107–108。
### F2-19 Serializer / EventAdapter / SnapshotAdapter 历史入口

| 面 | 内容 |
|---|---|
| 原输入 | 技术配置只绑定 example.inventory.persistence.protobuf.Frame 到 warehouse-persistence serializer。 |
| HAND / JS 来源 | Serializer.fromBinary(bytes,manifest) 返回 parse 得到的 Frame；EventAdapter.fromJournal(Frame,manifest) 核 manifest 后 EventSeq.single(decodeEvent)；SnapshotAdapter.fromJournal(Any) 只收 state Frame；factory 原样传 pid/initial/hosts 与两 adapter。 |
| BC 固定 adapter 差异 | BC 自带 PersistenceConfig(name,ShardedTags(lowercase,1)) 不是上述调用方 pid/initial/hosts/Frame ABI 的替代；无 Warehouse 同输入历史 bytes 证明。 |
| 无损准入 / 保守默认 | 只绑定 Frame，不改成 AnyRef/GeneratedMessage，也不从类名推 wire identity；历史 decoder 必须读保存的 bytes+manifest，不用新 encoder 现场造输入冒充旧 bytes。factory 不能制造初始 id 或 host。 |

证据：[S-warehouse-serializer-config][S-warehouse-serializer-config] L1–2；[S-warehouse-persistence][S-warehouse-persistence] L62–85；[S-bc-file-adapter][S-bc-file-adapter] L366–375；[S-warehouse-reference-contract][S-warehouse-reference-contract] L84。
### F2-20 历史 bytes / readside 接口证据边界

| 面 | 内容 |
|---|---|
| 原输入 | binding 声明 source=warehouse-events@1、identity=envelope-resource；固定独立 ABI 声明 WarehouseEnvelope.capture(pid,resource,sequenceNr,manifest,bytes) 与 currentEvents(pid,after,limit)。 |
| HAND / JS 来源 | 该 ABI 要求 capture/access 均复制 bytes，old duplicate 需 PID/resource/source/stream/manifest/bytes 一致；empty-success 不造事件；读取历史通过 source pages。所选 fixed 集合没有实际历史 bytes 文件或这些 readside 类的实现字节。 |
| BC 固定 adapter 差异 | 未有 BC/JS 新 candidate 或相同输入双端旧字节 decoder 结果；不得把文档条款/常量 pin 当运行回执。 |
| 无损准入 / 保守默认 | 将历史 corpus、独立 oracle、旧 writer/new decoder 版本/制品 provenance 列为缺件；本轮无 .bin/.hex/base64 actual bytes，SHA=null。禁止访问旧运行产物来补猜，禁止新造数据声称历史。 |

证据：[S-warehouse-binding][S-warehouse-binding] L29–38；[S-warehouse-reference-contract][S-warehouse-reference-contract] L88–138；[S-warehouse-reference-contract][S-warehouse-reference-contract] L152–182；[D-fixture][D-fixture] L40–50。
## 3. 两种 fold 的精确边界

这里的 **identity fold** 仅指 `SkuQuantityReserved → state`；和 `ReservationIdentity` host 的稳定 ID 合同不是一个概念。reserve event 仍是事件：旧独立读侧 ABI 允许它推进 checkpoint，但业务 state 不变；没有 receipt 的重复 reserve 仍会再次经过 host/emit。**receipt fold** 只在 `SkuReservationCommitted` 时 `updated(txid,"SkuReservationCommitted")`，保留其它 keys。现有 key 的 command 空成功与 event 重放 fold 不可混为一谈。

证据：[S-warehouse-reserve] L34–54、56–84；[S-warehouse-helpers] L9–21；[S-warehouse-fold] L7–12；[S-warehouse-host] L72–113；[S-warehouse-reference-contract] L136–138（独立 ABI，非本轮执行事实）。BC AST 两事件都是 identity fallback，但 commit 的真实 put 只在 FormalSemantics；不得丢附件后称 parity（[S-bc-file-adapter] L268–299、378–388）。

**不得暗加**：state.identifier、reserved inventory、库存扣减、先 reserve 校验、warehouse/sku/reservationId 一致性新规则、UUID/拼接/hash ID 算法、reply 的 ID/receipt/state 猜值。现有明确输入先保留；任何增强都是新业务语义，仍 blocked。作者 context 自限“reservation identity and commit receipts … not stock accounting or old Warehouse idempotence”（[S-warehouse-context] L7）。

## 4. PB layout 与 wire pin 账

PB package `example.inventory.protobuf`，proto3、ScalaPB `flat_package=true/single_file=true`（[S-warehouse-domain-proto] L1–10）；Frame 独立 package，不修改原 domain proto（[S-warehouse-frame-proto] L1–13）。字段号如下，不从名字重排。

| Message | 字段号 / 类型 / 名称 | 固定来源 |
|---|---|---|
| `TxIdValue` | `1:string f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L12–14 |
| `WarehouseIdValue` | `1:string f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L16–18 |
| `SkuIdValue` | `1:string f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L20–22 |
| `ReservationIdValue` | `1:string f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L24–26 |
| `WarehouseSnapshot` | `1:WarehouseSnapshotField0 f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L28–30 |
| `WarehouseSnapshotField0` | `1:bool present`; `2:repeated WarehouseSnapshotField0Entry f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L32–35 |
| `WarehouseSnapshotField0Entry` | `1:TxIdValue f0`; `2:string f1` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L37–40 |
| `WarehouseSkuQuantityReserved` | `1:ReservationIdValue f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L42–44 |
| `WarehouseSkuReservationCommitted` | `1:TxIdValue f0` | [S-warehouse-domain-proto][S-warehouse-domain-proto] L46–48 |
| `example.inventory.persistence.protobuf.Frame` | `1:uint32 envelope_version`; `2:string role`; `3:string type_id`; `4:uint32 wire_version`; `5:string layout_sha256`; `6:bytes payload` | [S-warehouse-frame-proto][S-warehouse-frame-proto] L6–13 |

`serializerId=736401`，`envelopeVersion=1`，payload/整 frame 上限 `1048576` bytes（[S-warehouse-binding] L7–27、37；[S-warehouse-persistence] L19–34）。这不是旧 byte corpus 的校验结果。

| Role / typeId / v | Domain → PB root | 真实固定 layoutSha256 | 来源 |
|---|---|---|---|
| `event/warehouse.reserved/1` | `SkuQuantityReserved` → `example.inventory.protobuf.WarehouseSkuQuantityReserved` | `1eccd9ea9c05f5be946f4004559f989bcacdc380c543e4f8fd3c31888e8d7384` | [S-warehouse-binding][S-warehouse-binding] L12–14；[S-warehouse-wire][S-warehouse-wire] L7 |
| `event/warehouse.committed/1` | `SkuReservationCommitted` → `example.inventory.protobuf.WarehouseSkuReservationCommitted` | `52f2395e2b6abfa6dafaaea866918efe3ec022ff5835981f6c18e80bbdaa8c80` | [S-warehouse-binding][S-warehouse-binding] L17–19；[S-warehouse-wire][S-warehouse-wire] L8 |
| `state/warehouse.state/1` | `WarehouseState` → `example.inventory.protobuf.WarehouseSnapshot` | `fe21099de54414f4a08cdf8342f685ed8941569876f11f5ae3bfa54cda2b5ba7` | [S-warehouse-binding][S-warehouse-binding] L22–24；[S-warehouse-wire][S-warehouse-wire] L9 |

对照 `test/persistence-readside-fixture.mjs` 的 `'1'.repeat(64)` / `'2'.repeat(64)` / `'3'.repeat(64)`，该固定测试源码明确称其 synthetic、非 observed layout、producer 应拒绝；未执行该测试（[S-persistence-test-fixture] L7–16）。

真实 pin 在此意为 **既有实际 binding 与 HAND 固定常量一致**，不是本轮重新计算 descriptor/layout、更不是历史序列化字节已到手。WirePins L3–5 只是原参考注释的历史诊断来源自述；本轮没有读取该 `.rounds`。旧 ABI L19 的“pins pending”不能覆盖现有常量，也不能据常量将旧 ABI L184 的运行 pending 改成通过。

## 5. codec 拒绝与历史 bytes 接口

HAND 实际静态入口（[S-warehouse-persistence] L40–84）：

- `encodeEvent(Event): Frame` / `decodeEvent(Frame): Event`；`encodeState(WarehouseState): Frame` / `decodeState(Frame): WarehouseState`。
- `manifest(Frame)` 精确组成 `warehouse-frame/1/<role>/<typeId>/<wireVersion>/<layoutSha256>`；`parse(bytes:Array[Byte],m:String):Frame` 验外框、manifest 和注册 domain decoder。
- `WarehouseSerializer.fromBinary(bytes,manifest):AnyRef` 返回 Frame；`WarehouseEventAdapter.fromJournal(frame,manifest):EventSeq[Event]` 还做 event role decode；`WarehouseSnapshotAdapter.fromJournal(Any):WarehouseState` 只接受 state Frame。
- serializer 注册只允许 Frame（[S-warehouse-serializer-config] L1–2）。这些签名来自 HAND，不推断 common-core 的发布 API。

独立 ABI 的历史接缝是 `WarehouseEnvelope.capture(pid,resource,sequenceNr,manifest,bytes)`、`bytes` 的 capture/access 防别名及 repository/event-source 的 `currentEvents(pid,after,limit)`（[S-warehouse-reference-contract] L88–117、152–160）。其 JDBC、重放、drain 行为只是旧合同条款，本轮没有相关实现/运行证据，也不补拷实现。

以下是**从源码导出的待验义务**，不是已执行测试、不是已冻结 oracle 数据。输入 ID/具体 host 返回值由将来的独立 owner 提供，不在此猜造。

| 义务 | 所需观察 | 来源 |
|---|---|---|
| `reserve-nonpositive-existing-receipt` | quantity<=0 且 key 已存在仍拒绝 quantity-positive；无 host/事件 | [S-warehouse-rules][S-warehouse-rules] L20–24 |
| `reserve-positive-existing-receipt` | quantity>0 且 key 已存在：Right(Vector.empty)，无 host/事件；不检查已有 value | [S-warehouse-rules][S-warehouse-rules] L20–24 |
| `reserve-no-receipt` | quantity>0 且无 key：host 四原参一次，event 仅 host 返回的 ReservationId；fold state identity | [S-warehouse-helpers][S-warehouse-helpers] L9–15；[S-warehouse-fold][S-warehouse-fold] L8–11 |
| `reserve-repeat-before-commit` | identity fold 未记 receipt；相同原参再次 reserve 仍经 host 并 emit；不预填具体 ID | [S-warehouse-rules][S-warehouse-rules] L20–24；[S-warehouse-fold][S-warehouse-fold] L8–11；[S-warehouse-host][S-warehouse-host] L72–113 |
| `commit-no-receipt` | 仅 txid 发事件；不隐加先 reserve/库存/参数匹配检查；fold put 固定文本且保留其他 keys | [S-warehouse-rules][S-warehouse-rules] L26–29；[S-warehouse-helpers][S-warehouse-helpers] L17–21；[S-warehouse-fold][S-warehouse-fold] L10–11 |
| `commit-existing-key` | 任意已有 value 都空事件成功；正常 command 不再 fold；直接 event fold 则仍 updated | [S-warehouse-rules][S-warehouse-rules] L26–29；[S-warehouse-fold][S-warehouse-fold] L10–11 |
| `nominal-boundary` | 四个 ID 保留不同 typed API；不要求相同 carrier 生成不同 wire 字节 | [S-warehouse-converter][S-warehouse-converter] L23–45；[S-warehouse-domain-proto][S-warehouse-domain-proto] L12–26 |
| `map-empty-present` | 合法 empty state 的 map wrapper 必须 present=true；缺 root/wrapper/key 或 present=false 拒绝，不等同 Map.empty | [S-warehouse-converter][S-warehouse-converter] L47–80 |
| `map-order-and-duplicates` | key 编码 unsigned-byte 排序；重复 decoded key 或 ambiguous encoded key 拒绝 | [S-warehouse-converter][S-warehouse-converter] L13–21；[S-warehouse-converter][S-warehouse-converter] L53–69 |
| `event-state-cross-role` | 有效 state Frame 给 decodeEvent、有效 event Frame 给 decodeState 均拒绝；snapshot 不靠 outer manifest 免检 | [S-warehouse-persistence][S-warehouse-persistence] L30–52；[S-warehouse-persistence][S-warehouse-persistence] L78–80 |
| `frame-identity` | 错 typeId/version/layout/envelope/role/outer unknown fields 拒绝；错误 manifest 拒绝，不尝试别的 parser | [S-warehouse-persistence][S-warehouse-persistence] L30–59 |
| `frame-size-and-malformed` | 空/null/超 1048576 bytes/malformed frame/domain required message 拒绝；完整 frame 和 payload 分别有界 | [S-warehouse-persistence][S-warehouse-persistence] L21–38；[S-warehouse-persistence][S-warehouse-persistence] L54–59；[S-warehouse-converter][S-warehouse-converter] L10–11 |
| `serializer-allowlist` | Serializer 只接受 Frame；SnapshotAdapter 只接受 state Frame；不扩 AnyRef 注册 | [S-warehouse-persistence][S-warehouse-persistence] L62–80；[S-warehouse-serializer-config][S-warehouse-serializer-config] L1–2 |
| `historical-byte-read` | 旧 writer 实存 bytes+manifest 经 fromBinary → Frame → event/snapshot decoder；新编码自循环不替代该证据 | [S-warehouse-persistence][S-warehouse-persistence] L54–80；[S-warehouse-reference-contract][S-warehouse-reference-contract] L182 |
| `readside-identity-fold` | reserve event 可推进 checkpoint 而 state 不变；empty-success 没有 event/投影步；旧 duplicate 不再 fold 属 ABI 待验条款 | [S-warehouse-reference-contract][S-warehouse-reference-contract] L136–138 |

精确拒绝范围：outer Frame 未知字段/身份/role/manifest 和 required message/map/duplicate key。**不声称四种 nominal 的 raw PB 字节自带类型认证**：四 wrapper 都是 `string f0=1`；两个 event 根都是第1号字段嵌套单 string wrapper，合法注册头下的同形内容替换未必能辨认。也不扩写成所有 nested domain PB unknown fields 均拒绝（[S-warehouse-domain-proto] L12–47；[S-warehouse-converter] L23–45、82–100；[S-warehouse-persistence] L30–59）。

实际历史 bytes：**所选固定集合未提供** `.bin`/`.hex`/base64 corpus；不是全工作区不存在的断言。未来至少需要 reserved/committed event、empty/nonempty state 的独立旧 writer bytes、原 manifest、payload/frame 各自 SHA/length、writer/decoder 版本与制品 SHA，以及具体成功字段或具体拒绝。当前全部 `null`/空列表。新 encoder 当场产再 decode 不能充当旧 bytes；不伪造实际 bytes，不读旧运行产物补证。

## 6. expected 文件角色与资产车道

下表是**文件角色清单，不是生成清单或新输出路径承诺**。已固定的 HAND 原文件可引用；真实 target 的 layout/owner、实现/运行窗口另批。本轮不新建 expected 目录、fixture 作者树、输入 JSON、源码、bytes 或 manifest。`targetPath` / `actualExpectedPath` / `actualExpectedSha256` 都是 `null`。

| 角色 | 文件职责 | 已有/缺件身份 |
|---|---|---|
| R01 | 四个独立 nominal 定义文件/角色：TxId、WarehouseId、SkuId、ReservationId | 作者和 codec 引用已固定；对应 HAND value 类声明未在所选 supplemental 记录中冻结；不能补拷。 [S-warehouse-txid][S-warehouse-txid]；[S-warehouse-id][S-warehouse-id]；[S-warehouse-skuid][S-warehouse-skuid]；[S-warehouse-reservationid][S-warehouse-reservationid]；[S-warehouse-converter][S-warehouse-converter] |
| R02 | 纯领域命令/事件声明：两条有序命令、两个单字段事件 | 作者 payload 与 HAND 使用点可定位；WarehouseProtocol.scala 声明本身未在所选固定集合中；目标是否拆文件待明确。 [S-warehouse-reserve][S-warehouse-reserve]；[S-warehouse-commit][S-warehouse-commit]；[S-warehouse-helpers][S-warehouse-helpers] |
| R03 | WarehouseState 与 empty/receipts 构造 | 固定 HAND WarehouseState.scala 是独立参考，不是 raw BC 或 JS 新产物。 [S-warehouse-state][S-warehouse-state]；[S-warehouse-author][S-warehouse-author] |
| R04 | WarehouseRules、WarehouseCommandHelpers、WarehouseEventHandler | 三份 HAND 源码已固定；WarehouseRuleParams.scala 声明未固定；不得把 emit helper 当 classic CommandHelper ABI。 [S-warehouse-rules][S-warehouse-rules]；[S-warehouse-helpers][S-warehouse-helpers]；[S-warehouse-fold][S-warehouse-fold] |
| R05 | ReservationIdentity/四参数 WarehouseComputations port 与独立 host oracle | 只有声明/调用形状；trait 定义、实现与稳定 ID 预期值未冻结。算法/UUID 不可补猜。 [S-warehouse-host][S-warehouse-host]；[S-warehouse-port][S-warehouse-port]；[S-warehouse-helpers][S-warehouse-helpers] |
| R06 | WarehouseActorProtocol；traditional protocol/helper 映射目标 | 固定 Execute/GetState/Accepted/Rejected 参考存在；classic 两臂/逐命令 typed reply 映射 blocked。 [S-warehouse-actor][S-warehouse-actor]；[S-bc-file-adapter][S-bc-file-adapter] |
| R07 | inventory_domain.proto 全文件 | 固定 HAND proto 原字节可用；ScalaPB 生成源码/descriptor bytes/新目标 expected 未生成。 [S-warehouse-domain-proto][S-warehouse-domain-proto]；[S-warehouse-config][S-warehouse-config] |
| R08 | DomainConverters.scala 全文件 | 固定 HAND converter 可用；按源码约束列拒绝项，不称已运行 codec。 [S-warehouse-converter][S-warehouse-converter] |
| R09 | warehouse_persistence_frame.proto 全文件 | 独立 frame proto 已固定；PB 编译字节与历史 Frame corpus 未固定。 [S-warehouse-frame-proto][S-warehouse-frame-proto] |
| R10 | WarehousePersistence.scala 中 registry/codec/Serializer/EventAdapter/SnapshotAdapter/factory | 一个固定 HAND 文件承载多个逻辑角色，不是多个已生成 expected；未来目标分拆路径/owner 待冻结。 [S-warehouse-persistence][S-warehouse-persistence] |
| R11 | WarehouseWirePins.scala 与 serializer reference.conf | 真实固定常量/config 可用；不能替换为 synthetic repeat pin；制品与真实 wire bytes 未锁。 [S-warehouse-wire][S-warehouse-wire]；[S-warehouse-serializer-config][S-warehouse-serializer-config]；[S-warehouse-binding][S-warehouse-binding] |
| R12 | WarehouseBootstrap/Factory 调用闭包及 readside Envelope/source 合同 | factory 调用点和独立 ABI 文本已固定；被调用 bootstrap/readside 实现未在所选集合冻结；不扩为完整 JDBC/42族交付。 [S-warehouse-persistence][S-warehouse-persistence]；[S-warehouse-reference-contract][S-warehouse-reference-contract] |
| R13 | 历史正向 event/state bytes、manifest 与独立语义期望 | 应分别保留 reserved/committed、empty/nonempty state 和 writer/decoder provenance；无实际 .bin/.hex/base64 文件，输出 SHA=null。 [S-warehouse-persistence][S-warehouse-persistence]；[S-warehouse-reference-contract][S-warehouse-reference-contract] |
| R14 | 历史拒绝 corpus 与 raw→target / JS→target 完整文件 diff | 应覆盖角色、版本、layout、manifest、required/duplicate 等；尚无拒绝 bytes、双端产物或统一 diff。 [S-warehouse-persistence][S-warehouse-persistence]；[S-warehouse-converter][S-warehouse-converter]；[D-fixture][D-fixture] |

资产必须分车道，不以 HAND 覆盖 raw 缺陷（[D-fixture] L40–50、108–115）。

| 车道 | 状态 | 含义 |
|---|---|---|
| `source-inputs` | `fixed-existing-supplemental-not-new-fixture` | 既有 author/project/binding 副本；不复制为第二作者树 |
| `independent-HAND` | `selected-source-bytes-available-not-complete-build-closure` | 上表 11 份 HAND 源码/配置＋1 份旧 ABI 文档只作独立来源，不冒充传统 target |
| `BC-input-adapter` | `missing-counterpart` | 未创建同语义 canonical/SystemMetadata/finite adapter；raw 输出为空缺，不编造 |
| `BC-raw-generated` | `not-generated` | 未来保存实际 raw 全文件，即使显示缺陷也不洗掉 |
| `approved-target` | `decision-required-not-generated` | 有限映射、布局、reply/host 等裁定后才可冻结目标全文件 |
| `JS-public-generated` | `not-generated` | 尚无本轮公共入口输出；固定 HAND 不是它 |
| `historical-wire-corpus` | `bytes-not-supplied-in-selected-fixed-set` | 没有真实 event/state historical bytes/manifest 文件；三 layout 常量不填补此缺口 |
| `comparison-and-manifest` | `not-created` | 应另锁输入 SHA/profile/variant/头部白名单/制品/命令/输出 SHA 与两份完整 unified diff；本轮无运行命令或输出 SHA |

每个未来全文件资产须锁来源 SHA、profile、input mapping、变体、头部白名单、实际命令和输出 SHA；raw→target 与 JS→target 两份全文件 diff 不删除 package/空白来伪装一致（[D-fixture] L40–50）。这里没有命令已运行或输出已生成的证据。声明/port/bootstrap 等缺件指**所选固定来源未冻结该文件**，不指原项目中必然没有；本轮没有外部源码补拷范围。

## 7. 相对 F1 的有限接口增量

比较基准是 [D-fixture] L18–64 和 [D-evidence-md] L23–28、69、85–111 的 F1/F2 范围，不是对整个 Examples 的能力断言。“F2 覆盖”仅指输入/参考/接口证据覆盖，运行全部未测。

| F2 补充接口 | F1 比较边界 | 逐槽定位 |
|---|---|---|
| 四同 carrier nominal 的独立 API/PB 边与 TxId map key | F1 主要为 Id/Money/余额，不能代替此四 nominal 组合 | F2-03, F2-04, F2-05, F2-06, F2-16 |
| 显式 host-computation 四原输入及 stableIdentityContract | F1 不提供本 ReservationIdentity 调用/稳定身份原输入合同 | F2-08 |
| 先 quantity reject 再 receipt succeed-empty；identity event 与 receipt put 分离 | F1 的资金 fold 不证明此 Warehouse 的零状态变更与空成功边界 | F2-07, F2-09, F2-10, F2-11 |
| identifier 不在 HAND state 与显式 required nominal-key map wrapper | F1 raw state 本含 userId（[D-evidence-md] L69），不能暴露同一个 BC 前插 identifier 的 F2 差异 | F2-12, F2-15 |
| 显式 Frame role/type/version/layout、精确 manifest、Frame-only serializer 与 snapshot/event 双入口 | F1 没有这组三个 Warehouse pins/框架 ABI；不是断言 F1 完全不涉及序列化 | F2-17, F2-18, F2-19 |
| historical bytes parse/fromBinary/fromJournal 与 Envelope/currentEvents 的接口合同 | F2 补充所需接口来源，不等于历史 bytes 已取得或 F1 恢复测试已完成 | F2-19, F2-20 |

不扩大到全部42族、任意 nested/cross-context 类型、全部 Saga/投影/Bootstrap 变体、全部同形 wire 替换、完整 JDBC/runner/recovery，亦不称已有双端可执行项目（[D-fixture] L64–80）。

## 8. 保守默认与仍 blocked

默认只保存现有显式事实；不可无损表示就拒绝准入，不降成 String、不填成功、不绕 arbitrary source 槽。保持 author/HAND/raw/target/candidate/历史 bytes 各自身份；所有缺件保留空值。建议是文档级默认，**不批准新业务语义、schema 或实现**。

- **B1**：Warehouse→传统 BC runCommon 有限无损 adapter 不存在于本次已固定映射；原技术 binding 不兼容，id/text 会丢 nominal，host expr 对象不适配。（F2-01, F2-02, F2-03, F2-04, F2-05, F2-06, F2-08）
- **B2**：state 不加 identifier、保留 author default 与 commit FormalFold；传统目标必须明确消费语义附件而非 AST identity fallback。（F2-09, F2-11, F2-12）
- **B3**：Actor 应用接口到 classic protocol/helper 的有限映射未裁定；不得合成 reply 数据或新增业务命令。（F2-14）
- **B4**：ReservationIdentity 具体算法/trait 完整声明/独立期望值未冻结；四原参保持，新增 UUID/库存/一致性校验等业务语义仍 blocked。（F2-08, F2-10）
- **B5**：实际历史 event/state bytes、独立 oracle、完整 HAND 编译闭包、双端产物/目标全文件及输出 SHA 均未建立。（F2-15, F2-19, F2-20）
- **B6**：制品实施前另锁；common-core_2.13:0.2 的发布制品优先，另一会话负责演进；本轮未调查 glue，不推断 withPost/policy 为发布 API。（主agent分工转述，非用户逐字原话）
- **B7**：三退休任意源码槽全部 blocked，不转 B 兜底；本轮不改 public schema/作者/实现，不含外部源码补拷授权。（主agent分工转述，非用户逐字原话）

本轮只做静态 JSON 编排/解析、来源行号边界、链接路径存在性和选定来源 SHA/bytes 核对。27 个固定来源与 supplemental index 逐文件相符；另记录6个指引/文档实际 SHA。**这些不是运行验收。** 未用 repo module、生成器或测试来得到本文件；CC 全部未测。

## 9. 实际来源指纹

以下 SHA 均为本轮读取文件的原始字节 SHA-256；完整绝对路径与 original repository identity 在 JSON `sources`。本节不抄写 baseline 全索引。

| source ID / 身份 | 行数 | bytes | source SHA-256 |
|---|---:|---:|---|
| [S-warehouse-config][S-warehouse-config] / `fixed-project-technical-input` | 39 | 2134 | `b3a427adbdcb63d69554328ba9f656af0dc5a0e6f35ce1d1fe5fba1afb49c02e` |
| [S-warehouse-binding][S-warehouse-binding] / `fixed-project-technical-input` | 45 | 1898 | `3f51cdce0bc99403b5abd0e8a52e59cd68542b54f7604e7282aee167ca4d9069` |
| [S-warehouse-system][S-warehouse-system] / `fixed-author-input` | 19 | 362 | `56ef46e0b177ae48f8db738be212bfbd4a7114a70f6fb847b508ca8d44711c91` |
| [S-warehouse-context][S-warehouse-context] / `fixed-author-input` | 7 | 339 | `b2e1efdc6e3389efdb38d1620298028593bef0de0c062bcf12f53153c5f660ad` |
| [S-warehouse-author][S-warehouse-author] / `fixed-author-input` | 25 | 574 | `007e0dd813f9400c72192a97313e91de068051992511ce8c2d921420f30588b9` |
| [S-warehouse-reserve][S-warehouse-reserve] / `fixed-author-input` | 84 | 1962 | `b4c2caf53bbfe8bf62f3438dc5af04c855612e724113622feda3493d3f2391ee` |
| [S-warehouse-commit][S-warehouse-commit] / `fixed-author-input` | 74 | 1615 | `71f6f0f20943ee29ea6d44002887ec4b11d6477f240d765338f208625a8a3a90` |
| [S-warehouse-txid][S-warehouse-txid] / `fixed-author-input` | 12 | 213 | `078e96185b7caa86be604df234adc3252edab6f02e54dd272a8d16f255b13c32` |
| [S-warehouse-id][S-warehouse-id] / `fixed-author-input` | 12 | 227 | `d554389600ac30ff044ad84d33fae550d6f365c937f47794ebd2be0d3a62c579` |
| [S-warehouse-skuid][S-warehouse-skuid] / `fixed-author-input` | 12 | 215 | `287ec071123ee799d74232873d962a4b6fd55397bd3726da89db25e45845ca53` |
| [S-warehouse-reservationid][S-warehouse-reservationid] / `fixed-author-input` | 12 | 231 | `88e3bc57cc0bfa4555b857d4c293a6954c71b44e9cf180e6ffe73134859ecc45` |
| [S-warehouse-host][S-warehouse-host] / `fixed-author-input` | 114 | 2449 | `16aa581f39bee008f7566fe8977e95145bfd538745d8763561175862897969ea` |
| [S-warehouse-port][S-warehouse-port] / `fixed-author-input` | 14 | 332 | `a1bfd272dcf68c49eb7b81f7b11e7aea5b04961ac82c790139b4c6965f36a937` |
| [S-warehouse-state][S-warehouse-state] / `fixed-independent-HAND-reference` | 11 | 223 | `40af157f9b50fe29d84e845b610b89dac892aca666616a860381340095be2484` |
| [S-warehouse-actor][S-warehouse-actor] / `fixed-independent-HAND-reference` | 23 | 606 | `12558f67c9b895f6a86ff057f40443c5ecebfd7be158a18ca29c8f11047b1d31` |
| [S-warehouse-rules][S-warehouse-rules] / `fixed-independent-HAND-reference` | 30 | 1506 | `4375126ca5255fc19f5d19557376ef6a728521fa4364f863cef722fdaccf7a7b` |
| [S-warehouse-helpers][S-warehouse-helpers] / `fixed-independent-HAND-reference` | 22 | 793 | `66aaf99f4dc9848bd158eec1d6e06c5b1d088c8bd2ce44b7616f81c51661429a` |
| [S-warehouse-fold][S-warehouse-fold] / `fixed-independent-HAND-reference` | 13 | 514 | `2d4e8869e3df5abba71b6d1355c5418fd65eb2b2ee7b15b7290badbf26d0655e` |
| [S-warehouse-converter][S-warehouse-converter] / `fixed-independent-HAND-reference` | 101 | 4247 | `f2f0ddb71e569f290bc152f02bddd7265773d4294d53bb987a99fd02efb534d4` |
| [S-warehouse-domain-proto][S-warehouse-domain-proto] / `fixed-independent-HAND-reference` | 48 | 726 | `96640e3776a90246d777cd4a6dcdf0a7ef9835c23b317f9249bf4c91bfecb3d6` |
| [S-warehouse-frame-proto][S-warehouse-frame-proto] / `fixed-independent-HAND-reference` | 13 | 415 | `d92dff015172afeb8f06a7c305bae21c2139296b5b5a1cabf6d6c205d96b7456` |
| [S-warehouse-persistence][S-warehouse-persistence] / `fixed-independent-HAND-reference` | 85 | 5781 | `3b1bd7cc953637d753dd2c4139463ae673db2ead4e38ff48f37bf8f27df7f422` |
| [S-warehouse-wire][S-warehouse-wire] / `fixed-independent-HAND-reference` | 10 | 595 | `e764ef3cf224bc45fd8839e0d33c05fcc2ed2bf11d5e8977d8dc7e3623744b8e` |
| [S-warehouse-serializer-config][S-warehouse-serializer-config] / `fixed-independent-HAND-reference` | 2 | 219 | `256bbcb4666f4b0b5199863f033f0ed2f032373e884e6e3485e9c6b58fe2e2f0` |
| [S-warehouse-reference-contract][S-warehouse-reference-contract] / `fixed-independent-HAND-reference` | 184 | 16771 | `f8ddb2912b1d2c5b5cad22d18c0ee4296e92473518197045660693c218dc1b9c` |
| [S-persistence-test-fixture][S-persistence-test-fixture] / `fixed-synthetic-admission-source-not-wire-evidence` | 41 | 2800 | `c3e7e7078ac798d4a62de0234f0e8075b322e25fd8d57342aef5d22e07b9f879` |
| [S-bc-file-adapter][S-bc-file-adapter] / `fixed-BC-adapter-source-not-output` | 419 | 25331 | `95a7e7d67f4e38b3a2e3b17b3b3797fa95cd67cda5b56739517f4f05f572d171` |
| [D-agents][D-agents] / `instruction-or-document-bytes-pinned-at-this-authoring` | 109 | 6108 | `8bfd761390a6fc90b09663157f9d35b23c0c58b20c9f6a41dd5698450015d601` |
| [D-authoring][D-authoring] / `instruction-or-document-bytes-pinned-at-this-authoring` | 73 | 5941 | `9c827000f1e864b6a86a04a855df4853a4457b854bd5b2f0bfff14b1ce9514a9` |
| [D-fixture][D-fixture] / `instruction-or-document-bytes-pinned-at-this-authoring` | 115 | 9684 | `cced314341408c7834bfdd8723aa55ac9ae39ea85c50e74a651b2052a7df2222` |
| [D-evidence-md][D-evidence-md] / `instruction-or-document-bytes-pinned-at-this-authoring` | 162 | 18352 | `2e8298e923144376ff26f7a5551f762379b85fbd119bebfc41b5e4704f2a7ae9` |
| [D-evidence-json][D-evidence-json] / `instruction-or-document-bytes-pinned-at-this-authoring` | 1959 | 101028 | `0e7c861823141b2d603a341c475ae5913ff6b70090814aab66445cf2829bf0e4` |
| [D-index][D-index] / `instruction-or-document-bytes-pinned-at-this-authoring` | 407 | 28332 | `006028d35f2d7850ada62558abd36fc853db8faffdfd32d8e05f801ff4d985a1` |

<!-- Source links point only at the already-existing evidence files. -->
[S-warehouse-config]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truthsrc.project.json
[S-warehouse-binding]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/bindings/persistence.json
[S-warehouse-system]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/system.yaml
[S-warehouse-context]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/context.yaml
[S-warehouse-author]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/aggregates/warehouse/aggregate.yaml
[S-warehouse-reserve]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/aggregates/warehouse/slices/reserve-sku-quantity.slice.yaml
[S-warehouse-commit]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/aggregates/warehouse/slices/commit-sku-reservation.slice.yaml
[S-warehouse-txid]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/value-objects/tx-id.vo.yaml
[S-warehouse-id]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/value-objects/warehouse-id.vo.yaml
[S-warehouse-skuid]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/value-objects/sku-id.vo.yaml
[S-warehouse-reservationid]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/value-objects/reservation-id.vo.yaml
[S-warehouse-host]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/formal-products/host-computation/--inventory---reservation-identity--.formal.yaml
[S-warehouse-port]: ../../supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/truth/persistence-readside/contexts/inventory/formal-products/technical-port/reservation-identity.formal.yaml
[S-warehouse-state]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/kernel/src/main/scala/example/inventory/domain/WarehouseState.scala
[S-warehouse-actor]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/glue/src/main/scala/example/inventory/application/aggregates/WarehouseActorProtocol.scala
[S-warehouse-rules]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/kernel/src/main/scala/example/inventory/domain/invariant/WarehouseRules.scala
[S-warehouse-helpers]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/kernel/src/main/scala/example/inventory/domain/command/WarehouseCommandHelpers.scala
[S-warehouse-fold]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/kernel/src/main/scala/example/inventory/domain/entities/behaviors/WarehouseEventHandler.scala
[S-warehouse-converter]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/glue/src/main/scala/example/inventory/infrastructure/serialization/DomainConverters.scala
[S-warehouse-domain-proto]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/aggregate-core/project/modules/glue/src/main/protobuf/inventory_domain.proto
[S-warehouse-frame-proto]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/persistence-readside/protobuf/warehouse_persistence_frame.proto
[S-warehouse-persistence]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/persistence-readside/scala/example/inventory/infrastructure/persistence/WarehousePersistence.scala
[S-warehouse-wire]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/persistence-readside/scala/example/inventory/infrastructure/persistence/WarehouseWirePins.scala
[S-warehouse-serializer-config]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/persistence-readside/resources/reference.conf
[S-warehouse-reference-contract]: ../../supplemental/fixtures/metarch-truthsrc/test/reference/persistence-readside/REFERENCE-CONTRACT.md
[S-persistence-test-fixture]: ../../supplemental/fixtures/metarch-truthsrc/test/persistence-readside-fixture.mjs
[S-bc-file-adapter]: ../../supplemental/fixtures/backkend-codegen/src/main/scala/net/imadz/meta/filesystem/SerialCanonicalAdapter.scala
[D-agents]: ../../../../AGENTS.md
[D-authoring]: ../../AUTHORING-CONTRACT.md
[D-fixture]: ../../FIXTURE-AND-EXPECTED-CONTRACT.md
[D-evidence-md]: ../../details/fixture-source-evidence.md
[D-evidence-json]: ../../details/fixture-source-evidence.json
[D-index]: ../../supplemental/fixture-index.json
