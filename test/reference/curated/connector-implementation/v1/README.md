# connector-implementation v1 — StockCatalog 工具门实现金样候选（toolgate 词汇重建）

> 前史：本目录曾有一版候选（`f34d93f`/`b41c6ba`）在讲解时被否决——它复制了 raw
> `scriptParam` 形态与无界 runner 合同。本版按 2026-11-19 裁定的四层 toolgate
> 形态重建，与已认可的第二族 v2 金样（bundle `f50c9f35`）同词汇。

## 本族制品解决什么问题

已认可的第二族 v2 解决了**门面**：`StockCatalogToolGate` 只收业务参数（SkuId），
工具绑定密封在实现侧。本族制品（传统清单第 25 族）就是密封舱本身：
`infrastructure.toolgates` 下的**生成实现类**——构造注入手写 runner lib、每方法
一个 MANUAL 块承载密封绑定委托、把子进程原始输出提升为类型化裁决。它解决四件事：

1. **装配闭环**：gate 无实现引用（kernel 隔离），生成的 impl＋bootstrap 模块
   （冻结自 v2）补上注入链（Guice 装配性质实测解析）。
2. **密封绑定委托合同**：每次 gate 调用恰一次 runner 调用，`ProcessRequest`
   （密封脚本＋`sku.value` 实参＋密封超时）逐字段相等；失败 Future 与同步抛错
   原样传播；畸形输出成具名 `ProtocolViolation` 走失败通道；拒绝留成功通道。
3. **MANUAL 所有权**：标记语法（四空格 `// ==== BEGIN MANUAL ====`/END）与配对
   定为结构性质（含 directed negative）；块内密封绑定委托体可手写演化，重生成
   字节保留是 writer 合同，生成器阶段验证。
4. **诚实边界**：真实进程机械坐在 `infrastructure.process` 固定 lib（冻结共享
   副本 `45b2b8c8…`，生成器永不创建）；沙箱门 deny process-exec，门覆盖＝编译
   ＋ScriptedRunner/ThrowingRunner 双打缝合合同，不虚假声明进程已运行。

## 范围（21 payload）

- 生产 8 文件：**本族制品** `StockCatalogToolGateImpl`（@Singleton @Inject() 构造、
  两方法 MANUAL 块、共享类型化 lift）＋冻结复用 7 文件（gate trait `2b7f0280…`、
  三个结果类型、装配模块、ReservationValues `48f29020…`、LocalProcessRunner lib
  `45b2b8c8…`——全部与已认可 v2 bundle 或其冻结链字节相同）。
- 测试 4 文件：闭式 payload 形状＋ScriptedRunner/ThrowingRunner 双打、独立 oracle、
  34 条性质（8 负对照：委托 4＋度量 4）、度量器元性质（逐字节冻结复用）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点

| 项 | 本样例的显式选择 |
|---|---|
| V2-CARRIED | 2026-11-19 全部裁定（toolgate 词汇／业务签名／scriptParam raw-only／runner 固定 lib 三句契约／加固只动 runner 缝）对本族不变地适用 |
| D1 | 实现镜像**完整**已认可 gate ABI——两方法、业务参数形状；raw「仅首方法/参数 Nil」的债不复现；no-helper `???` 与多 helper 形态记为 raw 形状、推迟到生成器阶段 fixture |
| D2 | 门内不执行真实进程（沙箱 deny process-exec）；门覆盖＝编译＋双打（含同步抛错 ThrowingRunner） |
| D7 | MANUAL 标记语法与配对冻结为结构性质＋directed negative；块内容重生成字节保留是 writer 合同（生成器阶段验证） |
| D4/D5 | connector-assembly-integrator／共享 writer／anchors 归属推迟给相应 owner；不伪造 @knowledge 锚注释 |

## 委托合同（ScalaCheck 实测）

恰一次 runner 调用／每次 gate 调用，`ProcessRequest` 逐字段相等；同输入重复调用
结果一致；失败 Future 原样传播不重试；同步抛错从调用点原样抛出（同实例）；畸形
输出→失败通道具名 ProtocolViolation；refusal 留成功通道；MANUAL 标记成对
（负对照：缺 END／多 BEGIN 必须判失败）；装配性质走真实 Injector。

## 质量状态

- 独立窗口对本候选字节实测（回执见 `.rounds/` 与 review-status）：两段编译
  exit 0，度量门 16 文件 0 violation / 0 excess，34 性质三 seed 740001-740003
  全过。本目录只是候选；认可以 bundle sha＋讲解裁定为准。
