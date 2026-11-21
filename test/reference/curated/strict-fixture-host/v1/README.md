# strict-fixture-host v1 — S1a′ strict saga 技术宿主族金样候选

> 传统清单第 41 族（strict 扩展）：每 admitted saga execution 对应一份
> **技术宿主族**——types 别名面、无 money 分支的 StrictWire 文本框架、
> canonical ArgsCodec、六个相位的 binding/receipt codec（命名类，E1）、
> 部署 Entry＋对账授权器。上游＝#40 admitted `StockTransferSagaModule`
> （字节一致复制）。多 fixture 多文件；composition-host 归 #42。
>
> 2026-11-20 裁定链（开工前用户全批 F1–F12，门内实证追加 F13）：
> **F1 供给＝S1a′ 复用**（saga-core 0.3.0 staged，闭包＋sharding 运行面
> 补充坐标）/ **F2 落点＝O1 一致**（production 五件进模块同包 transactor；
> 协议在 application/aggregates、状态在 domain/entities、事件在 domain/
> events）/ **F3 命名＝N1 沿用**（PascalCase 茎＋lowerCamel 成员，wire ID
> 逐字）/ **F4 边界＝Y2 沿用** / **F5 聚合义务＝新增手写 warehouse 供给**
> / **F6 行为面＝B2 真**（单节点自 join 真实 cluster＋真实 ClusterSharding
> ＋真实 WarehouseEntity）/ **F7 wire 形状扩展**（Integer/Enumeration→Text；
> raw fail-closed 行为记档）/ **F8 收据来源偏离**（聚合回执产出＋持久标记
> 精确重读；raw 回声式 B06 对本模块必败记档）/ **F9 回执形状**（2 态 typed
> PhaseReply）/ **F10 证据面**（六张相位标记图兑现 read-only-evidence-query）
> / **F11 raw test 发射不可达**（money 版 S/N 不进金样；测试树＝curated
> 套件）/ **F12 installEventSource 仅编译面** / **F13 SupportedCapabilities
> 修正**（固定十项＋模块要求三项——warmup 护栏链实证）。

## 本族制品解决什么问题

strict saga 运行时之外的**技术宿主实现**：模块 Host trait 的生产实现——
exact-resource 寻址、逐相位 ask/证据查询、收据 wire 编解码（逐相位命名
codec 类、pin 逐字，目标侧 Prepare 走 pin v2）、合同/能力/护栏 fail-closed
校验、触发器全量映射（含事件触发的确定性 64-hex sha256 txid）、部署 Entry
（spawn/singleton/事件源/status/completionEvent/publishCompletion＋恒时
比较授权器）。聚合侧：六相位命令＋持久相位标记 keyed by txid＋确定性
预订/订单 id（nameUUIDFromBytes，无随机面）。

## 范围（21 源文件进门）

- 生产 12 文件＝**族工件 5**（types/StrictWire/StockTransferArgsCodec/
  FixtureHost/StockTransferSagaEntry）＋**上游模块 1**（#40 字节复制）＋
  **业务供给 5**（warehouse 协议/实体/事件＋#40 携带的命令/事件）＋**公共
  供给 1**（Id）。
- 测试 5 文件（test/ 树镜像模块包路径）：确定性用例＋frozen oracle＋真实
  cluster fixture（SagaEntryKit/SagaEntrySharding/SagaEntryFixture 三层拆解
  避免类初始化死锁）＋行为 58 条＋结构/引擎元 28 条（合计 86，25 条
  negative: 前缀负例；含上游模块字节身份 sha256 全量复核）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点（裁定状态）

| 项 | 状态 | 一句话 |
|---|---|---|
| F1 供给 | ✅ | saga-core 0.3.0 staged；闭包 125 坐标（含 sharding 运行面 agrona/lmdbjava/lz4/reactive-streams/java8-compat 1.0.2/slf4j-simple） |
| F2 落点 O1 | ✅ | raw packagePath 语义＝模块同包；raw admission 冲突＝平台债 |
| F5 聚合 | ✅ | 六命令逐字对齐 PhaseContract.command；GetWarehouseState 只读；RecordTransferCompleted 幂等 |
| F6 行为面 B2 | ✅ | 真协调器全流程：成功/蓄量不足中止/首 persist 失败→Unknown→RecoveryRequired→拒权→授权对账→重驱成功/发布幂等/单例部署 |
| F7 wire 扩展 | ✅ | UUID/Int/枚举全文本框架；trailing bytes 拒收文案逐字；64 集合上限 |
| F8/F10 证据 | ✅ | 收据＝聚合产出＋标记图精确重读（非 raw 回声）；六相位证据查询全部实测 |
| E1 命名类 | ✅ | 6 binding＋6 receipt codec＋2 trigger＋1 completion 全命名私有 final 类 |
| D5 var 债 | ✅ | raw var/while wire 体→ByteString 切片尾递归，检查顺序逐字保留 |

## 行为合同（ScalaCheck 实测，86 条；58 行为＋28 结构/引擎元）

- **wire 面**：StrictWire 单/多字段往返、截断/负长/64 上限拒收、frozen hex
  oracle、ArgsCodec canonical 往返＋字段序＋trailing/短字段/坏 UUID/坏数量
  拒收、六收据 codec 往返＋pin 全量复核（v2 锁定目标侧 Prepare）。
- **宿主合同面**：requireImplemented happy＋8 条 fail-closed（能力/决策布线
  /补偿布线/预算/不变量/清单/pin/类型集）、exact-resource 寻址、settings
  pin（1000ms/32）、namespace 卫兵、触发器边界与确定性映射、completion
  mapper、entry PID、授权器四态、status fail-closed、publishCompletion
  非终态拒收。
- **真实 cluster 流**：全串行成功（双仓结算＋库存守恒）、发布幂等＋一次
  落库、蓄量不足中止（标记零污染）、首 persist 失败（PID 级 failNextPersisted
  注入）→ask 折叠 Unknown→RecoveryRequired→错误令牌拒→授权 Reconcile→
  重驱成功、同参 Start 幂等/异参 ConflictingIdentity、终态 Reconcile 短路
  回 Status、单例部署面。
- **结构面**：布局路径、上游模块 sha256 全量、import 白名单（akka/strict/
  mongo/stream/ByteString 逐文件）、100 列、禁 token、domain 纯净、六命令
  八事件逐字、命名类清单、能力/护栏字面量、entry 全构造、引擎计数语义/
  E2b/NewAnonymous/Y2/域方向/全 app 面分层净检。

## JS 生成器（字节比对验收）

`tools/gen-strict-fixture-host.mjs`（输入合同
`truthsrc.strict-fixture-host-input/v1`，fixture
`test/fixtures/strict-fixture-host-v1/input.json`）：同一输入重现五个族工件
**逐字节**（types.scala 852 / StrictWire.scala 3132 / StockTransferArgsCodec.scala
1928 / FixtureHost.scala 26954 / StockTransferSagaEntry.scala 9560 字节，
produced sha256 = golden sha256 逐文件相等），双跑确定；20 条 fail-closed
负对照（重复槽位/未知 typeId/缺相位/pin 归零/重复 step/String 资源/命令载荷
未知槽或非法源/证据提取未知收据槽/事件触发器非派生哈希/映射不覆盖
args 槽/same-as 未知引用/解码模式名长度或重复/能力集重叠固定十项/空不变量/
安全表缺项/非正超时/完成数非一/非法命名空间前缀）全部拒收且诊断逐字匹配。
全部名字、pin、载荷映射、证据图、护栏串、触发器派生出自输入合同——发射器
不嵌金样字节；布局按金样冻结并逐处记录：统一 pack 限 96（收尾括号/尾逗号
计数，续行 +2）、平语句 ≤100 单行、八条 HostRequirements 接线检查逐字段
断行表、TriggerStart/Args 首行两参、identity 形证据先断 `NotExecuted(identity,`
再以 100 限打包、绑定类声明恒两行、派生哈希触发器声明两行、
publishCompletion 签名与 FixtureHost 类头为冻结模板、args-codec 与宿主
收据解码的 Failure 续行缩进分别为 +4/+2。永不自 declare 通过，比对报告由
verify 模式打印。

## 质量状态

- discovery 轮（`.rounds/strict-fixture-host-quality-20261120-01`）：两段
  编译＋度量门（21 文件 1230 scope 0 violation 0 excess；types 别名文件
  零可执行 scope 由 QualityInputs 家族修订记录）＋86 性质三 seed 全过。
- final-bytes 轮（`.rounds/strict-fixture-host-quality-20261120-02`）与
  同字节复跑（`-03`）：prepared pin 相等 `74fbfb16…` 即证零漂移。
  本目录只是候选；认可以 bundle sha＋讲解裁定为准。

## 沙箱门家族修订（本族登记）

- 网络规则：B2 真实 cluster 需要 loopback 套接字——SBPL 数值 IP 过滤不可用
  （`host must be * or localhost`；名字形式不匹配 JVM 数值 socket 操作，
  BindProbe/ConnProbe 实证）→ 门 profile 改为**端口限定**两条规则
  `("*:25551")`，外部端口仍被 deny，离线供给保证保持（只有族 cluster
  端口可达）。
- 预算：墙钟 40 分钟（D 级部署面 fixture：每 seed 真实 cluster join＋
  region/entity 预热＋九条真实流）；properties 单段上限 420 秒。
- `-Dquality.candidate`：结构性质的文件读取以候选根为基准（门 JVM cwd=
  attempt 目录）。
- slf4j-simple 入闭包：B2 面失败需要可见日志。
- PersistenceTestKit 经 `akka.persistence.testkit.scaladsl.PersistenceTestKit`
  获取；实体工厂 lambda 必须在 SagaEntryFixture 类外（类初始化死锁实证）。
