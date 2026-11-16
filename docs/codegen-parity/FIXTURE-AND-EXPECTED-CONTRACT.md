# 同输入内容验收的 fixture 与 expected 准入

最后更新：2026-11-16。状态：**fixture来源与映射规格；没有新双端可执行fixture、没有全42族目标字节、没有生成执行。**

实读来源：[fixture-source-evidence.md](details/fixture-source-evidence.md)及[逐字段机器表](details/fixture-source-evidence.json)。原固定基线保持852文件；本次额外33份输入/参考/适配源码准确字节见[补充索引](supplemental/fixture-index.json)，110604字节。复制是证据保存，不是创建第二个业务作者树或可运行测试项目。

## 1. 为什么现在不能声称“同输入已对齐”

| 对照 | 已有事实 | 具体阻断 |
|---|---|---|
| F1 classic CreditBalance | raw `Examples.bankingSystem`，人工Protocol/Helper/Behavior/Entity参考 | raw ReplyMappingConfig仅有类型引用，Helper Builder用通用位置参数构造，不能产生人工余额回复；raw事件/状态/默认值和人工参考也不同 |
| F2 Warehouse | `scaffold/persistence-readside-project`作者树/技术绑定；`test/reference/aggregate-core`与`persistence-readside`独立HAND参考 | 目前没有该输入到传统BC runCommon的无损adapter；BC文件adapter会合成reply/identifier字段，改变输入 |
| 银行已有输出 | 真实formal service产物，具体PB/PID/金融规则 | 不是classic CreditBalance：AccountId/TxId、命令事件与state不同；不能同名换包后冒称同输入 |
| Scala products入口 | 可生成独立products | 不是传统39族，不能拿同样flat Protocol/emit/nextN产品当本次金样 |

`test/reference`是当前真实参考目录，不是`reference`。新family的HAND资产可以提供独立语义数据，不能直接贴成传统Scala target并宣称一比一。

## 2. F1：classic CreditBalance最小纵向切片

### 2.1 固定来源与范围

- raw输入：[Examples.scala](baseline/bc/src/main/scala/net/imadz/meta/Examples.scala)的BankingSystem/`CreditBalanceAggregate`与所需Money/Entity/规则/协议关系。
- 人工参考：`baseline/curated-scala/net/imadz/`下CreditBalance文件，只作明确补全算法来源。
- 范围：value/entity/event-handler/invariant、protocol/helper/behavior/root/factory、必要repo/bootstrap/codec闭包；不是声称整个Examples的query/Saga/API都覆盖。

### 2.2 必须显式映射的内容

| 输入槽 | 精确要求 |
|---|---|
| Actor commands | AddInitial/Deposit/Withdraw/GetBalance及六个资金阶段命令的原字段与顺序；replyTo仅应用层 |
| 回复族 | raw有七种reply；人工额外TransferConfirmation单列，不默默加入raw输入 |
| 纯参数 | Money单值、Id单值、(Id,Money)有序tuple；GetBalance只读不生成写Helper |
| Helper两臂 | Deposit等失败`(Some(error),Nil)`、成功`(None,newState.accountBalance.values.toList)`是用户指定人工目标；其他回复逐方法用param/param._1，不通用猜字段 |
| State与empty | raw缺省值策略、metadata optional、人工三Map.empty分开；不把生成器中性1/null写成银行规则 |
| Fold | 保留七事件拼写；raw未完成helper与人工完成计算分开；只用确切RHS，不猜currentBalance或时钟 |
| runtime identity | entityTypeKey字符串、tag前缀/数量、PID、proto文件、serializer由技术绑定给，不根据名字重新生成 |

**重要raw缺陷**：当前non-formal helper默认可能发`CreditBalanceConfirmation(param,None)`，但真实字段是`error,balances`。不能把该不匹配称为可编译raw金样，也不能将人工方法体伪称原Builder对所有输入的产物。

### 2.3 未来应保存的完整文件资产

每项必须有manifest记录来源SHA、profile、input mapping、变体、头部白名单、执行命令与输出SHA：

1. 原样raw输入与实际raw生成结果（允许揭示编译缺陷，不洗掉）。
2. 人工参考准确字节，注明curated，不改源库。
3. 用户明确覆盖后的目标完整文件；未裁定内容不填空成功，相关包状态blocked。
4. 新JS公开CLI真正生成的完整文件。
5. raw→target和JS→target两份统一diff；不压平空白、删除包名或只比AST。

本轮尚未建立这五类全套资产。文档内的完整片段只证明目标可讨论，不自动等于以上expected已冻结。

## 3. F2：Warehouse名义类型与持久化接缝

精确输入副本在`supplemental/fixtures/metarch-truthsrc/scaffold/persistence-readside-project/`；它仍只是来源快照，不作为第二项目入口。

已确定原语义：
- 四个独立String carrier：TxId/WarehouseId/SkuId/ReservationId，不合并。
- ReserveSkuQuantity检查quantity>0、已有receipt时成功空事件，调用显式ReservationIdentity后产生SkuQuantityReserved；此事件fold为identity，**不擅自加库存扣减**。
- CommitSkuReservation同txid已记录时空成功，否则发SkuReservationCommitted；fold只更新receipts对应键。
- state原HAND只有receipts；BC SerialCanonicalAdapter会加入identifier时不能装作等价。
- 显式persistence binding/serializerId=736401/envelopeVersion=1及三条typeId/version/layoutSha固定；synthetic admission `.repeat(64)`不是实际wire pin。
- HAND Actor还是Execute/GetState/Accepted/Rejected，不等classic逐业务CommandHelper；这是F2需要完善的接口覆盖，不是已满足目标。

F2用于非银行名义类型、codec、cross-role event/state拒绝和持久化接缝。更宽复杂嵌套/跨上下文类型、所有Saga/投影变体需要附属fixtures，不能用F2名字冒充全部覆盖。

## 4. 后续fixture矩阵的最小分类

| 组 | 必须明确触发的条件，不只happy path |
|---|---|
| values/types | 0/1/22/23+字段，keyword，optional/default/Instant，重复简名，不同nominal，精确decimal/Long边界 |
| Entity/fold | 0/多事件，scalar/collection赋值，put-all单次求值，空fold与未完成槽区别，未知事件策略 |
| protocol/helper/behavior | 有/无replyTo声明，只读/写命令，单值/tuple/Params，独立Replies，失败无persist/成功新State回复/不意外publish |
| factory/repository/bootstrap | 本地与sharding分开，真实初始化ask、identity、四Bootstrap变体、关闭/恢复owner |
| serialization | aggregate/shared proto，nullable/presence/nominal map，字段号及manifest/serializer ID，旧byte到new decoder，不放宽allowlist |
| projection | single/multi、0/1/多handler、source grouping、create/update/delete/persistenceId形式，JDBC/外部sink事务不同 |
| API/service/connector | 参数/错误/授权/typed reply、manual slots、routes marker、typed外部调用与资源生命周期；不造现实金融政策 |
| Saga/strict/composition | classic与strict不同输入，phase/receipt/query/unknown/恢复边界，fixture与真实业务owner分开 |
| B输出 | 每个logicalOutput规定目标路径、construct、变体和具体fixture；不能“其它”免检 |

矩阵是覆盖规格，不声称上表已全有可执行作者输入。中央分区与42份diff收齐后应按实际variant反查，而不是机械为每个category建一项任务。

## 5. 实际可用的入口与副作用

以下均**未执行**：

```bash
# JS：generator在PROJECT配置中选择，不能虚构 --profile 参数
node /absolute/tool/bin/truthsrc.js generate-project \
  --project /absolute/owned-project/truthsrc.project.json \
  --out /absolute/new-target --plan

# 仅对不要求live implementation capture的明确注册producer可用
node /absolute/tool/bin/truthsrc.js generate-products \
  --request /absolute/derived-request-manifest.json \
  --generator /absolute/tool/generators/selected-producer \
  --out /absolute/new-target \
  --options-json /absolute/options.json --plan

# BC传统入口不是preview；只在获准运行窗口使用，不能默认banking-app
JAVA_OPTS="-Dcodegen.system=Examples -Dcodegen.targetDir=/absolute/new-target" \
  sbt "runMain net.imadz.codegen.CodegenMain"
```

- project plan会live capture、validate/roundtrip及内存编译/plan；roundtrip创建/清OS临时树。不会写target/磁盘知识库，但不是零工作。
- `--update --plan`还有overwrite/MANUAL预检；普通plan不是所有写前冲突检查的替代。
- project实跑写项目SQLite snapshot/generation、target源/build/test/config、四JSON、ledger/anchors；失败可能已写部分，不保证跨文件回滚或自动删旧输出。
- product plan捕获文件并内存编译；application profile还读取本地冻结JAR/外部根；module-seams/Saga-Monarch/Play-application要求generate-project live implementations，raw product入口包括plan都拒绝。
- BC的`systemFile/systemBindings`成对进入SerialCanonicalAdapter，不是任意SystemMetadata JSON接口；semanticProductsFile另一路不作传统39族金样。
- sbt可能写编译/工具缓存、解析下载依赖并复制scaffold；本阶段不执行，不因新target就假设没有旁路写入。

## 6. 收口与时间约束

推荐先把F1的Protocol/Helper/Behavior/Entity四件完整目标与输入槽一起裁定，再实施公共类型/名字/Writer接口。不能每件模板分别启动sbt：真实生成与必要编译集中到小依赖闭包一次完成。每批先说明预计耗时和停止点，不自动重跑163分钟银行workshop。

当前阻断清楚可执行：**不是缺目录或缺测试数，而是缺无损输入映射、逐命令回复算法来源、明确source-local/JAR owner、raw与目标有限差异裁定，以及全部变体的实际expected字节。** 未解决这些前不启动相应生成器整改，不将fixture说明文档冒称同输入验收通过。
