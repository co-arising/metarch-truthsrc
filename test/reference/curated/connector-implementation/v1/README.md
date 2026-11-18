# connector-implementation v1 — StockCatalog 连接器实现金样候选

## 本族制品解决什么问题

应用层通过 external-connector-port（第 13 族制品，已认可）声明"要调外部工具的什么
能力"，但 kernel 模块不承载实现、也不知道子进程机械。本族制品（传统清单第 25 族）
就是缺口的另一半：`infrastructure.connectors` 下生成的实现类——构造注入手写基建、
每方法一个 MANUAL 块承载机械委托、把子进程原始输出提升为类型化结果，并配
`infrastructure.bootstrap` 显式绑定。它解决四件事：

1. **装配缺口**：port 无实现引用（用户裁定，kernel 隔离），生成的 impl＋bootstrap
   模块补上注入链（Guice 装配性质实测解析）。
2. **委托合同**：每次 port 调用恰一次 runner 调用、script 原样透传、失败 Future 与
   同步抛错原样传播、畸形输出成具名 ProtocolViolation 走失败通道、拒绝留在成功
   通道——全部性质实测，非声明。
3. **MANUAL 所有权**：标记语法（四空格 `// ==== BEGIN MANUAL ====`/END）与配对
   定为结构性质（含 directed negative）；块内委托体可手写演化，重生成字节保留是
   writer 合同，在生成器阶段验证，本样例不冒称。
4. **手写外域归属**：真实进程机械坐在 `infrastructure.process`（生成器永不创建
   该文件）；沙箱门禁止 process-exec，门内以编译＋scripted/throwing 双打验证缝
   合同，不虚假声明进程已运行。

## 范围

独立小样例：与已认可 port 金样同一 StockCatalog 域，展示实现侧三件套。

- 生产 8 文件：**本族制品** `StockCatalogConnectorImpl`（@Singleton @Inject() 构造、
  两方法 MANUAL 块、共享类型化 lift）＋手写缝 `NodeSubprocessRunner`
  （infrastructure.process 手写外域）＋冻结复用 6 文件（port trait、两个结果类型＋
  共享 ProtocolViolation、装配模块、ReservationValues——与已认可 port v1 金样
  字节相同，sha 见 manifest）。
- 测试 4 文件：闭式 payload 形状＋ScriptedRunner/ThrowingRunner 双打、独立 oracle、
  34 条性质（8 条负对照：委托 4＋度量 4，含 Guice 装配解析与 MANUAL 结构检查）、
  度量器元性质（方向感知模式，套件名换族）。
- 质量骨架 4 文件：Scalameta 度量引擎与 family-2 逐字节相同（boundary 层、
  方向感知 import 规则）；分层 inputs；JSON 输出；入口。

## 关键合同点（对应族 diff 的未决项）

| 项 | 本样例的显式选择 |
|---|---|
| D1 | **候选裁定（讲解待批）**：实现镜像**完整** port ABI——两方法、两参数形状；raw Builder "仅首方法/参数 Nil" 的债不复现（该形状对已认可 port 类型不兼容）；no-helper `???` 与多 helper 形态记为 raw 形状、推迟到生成器阶段 fixture，不在本样例伪造 |
| D2 | runner ABI = `run(script: String): Future[String]` 单重载；无参方法用绑定 script 常量原文；script 不转义不改写；真实进程机械手写在 infrastructure.process，**门内不执行**（沙箱 deny process-exec），门覆盖＝编译＋缝合双打 |
| D3 | **用户裁定（2026-11-18）延续**：无 @ImplementedBy；impl 名 = connectorName + "Impl"；装配为 infrastructure.bootstrap 显式 Guice 绑定（模块文件与 port 金样字节相同） |
| D6 | 多模块隔离形态：生成 impl 在 infrastructure.connectors，手写 helper 源在 infrastructure.process（手写外域，BC PackageLayout L105–111），装配在 infrastructure.bootstrap；方向感知 import 门强制内核隔离。**记录分歧**：已认可 port 金样把 runner 缝留在 infrastructure.connectors（port 样例支撑文件），本族按本族合同把 helper 移到 infrastructure.process——port 金样冻结不动 |
| D7 | MANUAL 标记语法与配对冻结为结构性质＋directed negative；块内内容重生成的字节保留是 writer 合同（生成器阶段验证）；helper 同步抛错与失败 Future 都原样传播，绝不转换 |
| D4/D5 | connector-assembly-integrator／共享 writer／anchors 归属推迟给相应 owner；本样例不伪造 @knowledge 锚注释 |

## 委托合同（ScalaCheck 实测，非声明）

恰一次 runner 调用／每次 port 调用；script 参数与绑定常量原样透传；失败 Future
原样传播且不重试；同步抛错从调用点原样抛出（同实例）；畸形输出→失败通道具名
ProtocolViolation；refusal 留在成功通道；同输入重复调用结果一致；MANUAL 标记
成对（负对照：缺 END／多 BEGIN 都必须判失败）。

## 质量状态

- 独立窗口对本候选字节实测（见 `.rounds/` 回执）：两段编译 exit 0，度量门 16 文件
  0 violation / 0 excess，34 性质（8 负对照）三 seed 740001-740003 全过。
- 供给与 family-2 相同的 26 个 pin 工件（Guice 4.2.1 no_aop＋完整 guava 闭包）；
  装配性质用真实 Injector 解析 port 绑定。
- 本目录只是候选；认可以 bundle sha＋讲解裁定为准。
