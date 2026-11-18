# external-connector-port v1 — StockCatalog 连接器金样候选

## 范围

独立小样例：传统第 13 族 `external-connector-port` 的应用层外部连接器能力面。
一个连接器 `StockCatalogConnector`（2 方法，scriptParam Some/None 各一）＋
类型化结果 ADT＋纯 codec＋委托式参考实现＋注入式 runner 缝。

- 生产 7 文件：port trait（本族制品）、两个结果类型＋共享
  `ProtocolViolation`、runner 缝、参考 impl、冻结复用的
  `ReservationValues`（与第一族已认可 v3 金样字节相同，sha256 `48f29020…`）。
- 测试 4 文件：闭式 payload 形状、独立 oracle、34 条性质（8 条负对照）、
  度量器元性质（含 boundary 层新模式）。
- 质量骨架 4 文件：Scalameta 度量引擎（新增 boundary 层：Future 词名与
  port→impl import 获准，其余禁令不变）、分层 inputs、JSON 输出、入口。

## 业务语义

`probeAvailability(script)` 跑外部可用量探针脚本，返回 `Answer(sku, available)`
或显式 `Refused(code, message)`——拒付是成功通道上的类型化业务结果；
传输失败与 `ProtocolViolation` 走失败通道，两者绝不互转。
`locationDirectory()` 取仓库位置目录快照，保持声明顺序与重复项。

## 关键合同点（对应族 diff 的未决项）

| 项 | 本样例的显式选择 |
|---|---|
| D2 | 保留传统 `@ImplementedBy(classOf[infrastructure Impl])`（与 curated CreditBalanceRepository 同构），import 方向作为记录在案的例外 |
| D3 | 参考 impl 与 port ABI 完全一致：两方法、两参数形状、共享类型化 lift；不复现旧 impl"仅首方法/参数 Nil"的债 |
| D6 | 去掉未用 `javax.inject._` 通配、`Future` 用短名、单块字母序 import——作为对 raw 模板的显式排版例外 |
| D7 | 一切畸形 payload／非法标识符／非单行输入 → 具名 `ProtocolViolation` 走失败通道；不静默截断、不改写、不造默认值 |
| D1 | 只移植传统 Node 工具连接器面；银行 TechnicalPorts 映射不在本样例 |

## 委托合同（ScalaCheck 实测，非声明）

恰好一次 runner 调用／每次 port 调用；script 原样透传；失败不重试、
不吞异常、不造合成成功；refusal 留在成功通道；无参方法用绑定 script 原文。

## 质量状态

- 源码与合同已就绪，**完整质量门尚未执行**；不预支任何通过。
- 门：domain＋boundary 编译 → Scalameta 三层度量门（domain 5/2 固定、
  boundary 5/2＋精确例外、support 5/2＋闭式分发例外）→ 三 seed
  740001-740003 各 1000 最小成功。
- 本目录只是候选；认可以 bundle 比对＋讲解裁定为准。
