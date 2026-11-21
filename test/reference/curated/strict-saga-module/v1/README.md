# strict-saga-module v1 — S1a′ strict saga 模块金样候选

> 传统清单第 40 族（strict 扩展）：一份 admitted saga execution 对应**一个**
> `app/<base>/application/services/transactor/<ModuleName>.scala` 模块 object——
> 上游身份常量、技术合同、逐相位 Input/Receipt/binding/port、触发器与完成桥、
> definition 与 behavior。多 saga 多文件，fixture-host/composition 归别的族。
>
> 2026-11-20 裁定链（开工前用户逐项拍板）：**S1a′** 供给＝Maven Central 发布件
> `net.imadz:saga-core_2.13:0.3.0`（2026-11-12 发布，v0.3.0 tag＝冻结源 4352a31，
> staged 字节复制 sha256 550fbd5c…／POM 105f2c4d…，p23/p15 候选 jar 全退役）／
> **O1** 落点＝三层批准目标路径 application/services.transactor／**N1** 命名＝
> PascalCase 茎＋lowerCamel 成员（wire ID 一律逐字不动）／**Y2 沿用**／**H1**
> Host 面＝raw 抽象义务＋测试探针 codec／**B2** 行为面＝persistence-testkit
> 真实协调器往返／**D4a** raw 债逐条记录不修／**F8** fixture＝serial-two。
> **G1** 闭包排除：geronimo-jta（common-core→scalikejdbc→dbcp2 三层声明、
> 全缓存零踪迹、可执行面实证不需要）记为 omitted 边。

## 本族制品解决什么问题

strict saga 运行时的**合同投影**：协调器（持久化证据机）之外的一切身份/合同/
护栏都收在这一份生成物里——上游旗标不撒谎、codec pin 与合同全等、每次交互
重验 codec identity 与 contract、收据读取走真实 private[strict] 上下文、
completion 只做显式 map。**零机制**：不发事件、不落库；持久化、调度、对账
全部在 saga-core runtime。

## 范围（15 源文件进门）

- 生产 4 文件＝**族工件 1**（StockTransferSagaModule，~940 行）＋**平台供给 1**
  （common Id）＋**业务供给 2**（触发命令＋域事件）。
- 测试 7 文件（test/ 树镜像模块包路径 application/services/transactor/）：
  探针编解码＋记录型 binding＋可武装 Host（ProbeHost）＋persistence-testkit
  fixture（冷启动一次性预热，per-ask 5 秒紧口径）＋输入形状＋期望直陈＋
  行为 30 条＋结构/引擎元 34 条（合计 64，19 负对照；含 W8 digest 复核：
  sha256(semantic-payload.json) 与模块常量逐字节比对）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点（裁定状态）

| 项 | 状态 | 一句话 |
|---|---|---|
| F1 供给 S1a′ | ✅ | Central 0.3.0 staged 钉扎（jar+POM sha 双钉，provenance=bank-wealth 供给回执）；声明闭包 124 坐标 prepare 走查零缺件（除 G1 排除） |
| F2 落点 O1 | ✅ | D1 的三层方向在金样层落地；BC 准入侧适配归平台 |
| F3 命名 N1 | ✅ | 茎 ReserveSourceStockPrepare；Name→name 等 12 常量按 §9 符号表改写，值不变 |
| F4 边界 Y2 | ✅ 沿用 | 禁前缀表不变；akka/strict import 仅模块文件（结构性质钉） |
| F5 Host 面 H1 | ✅ | 嵌套 Args；trait Host 全抽象；探针 Host 实现义务 |
| F6 行为面 B2 | ✅ | 真实 StrictSagaCoordinator 全流程：成功/补偿中止/授权对账/拒权/超时/交互中 codec-swap 与 contract-drift 围栏 |
| E1 匿名端口 | ✅ | raw 匿名 PhasePort → 命名 private final 类（引擎 NewAnonymous 判别力性质钉住依据）；护栏逐字 |
| D4 raw 债 | ✅ 记录 | deps 非递归/Money 固定串/FieldDef 不发 default/Plan 保留名缺两个 shape——raw 接受 |
| E2b | ✅ 沿用 | 命名实参准／赋值违规，两档性质 |

## 行为合同（ScalaCheck 实测，63 条；30 行为＋33 结构/引擎元）

- **definition 面**：参与者 prepare 序＋身份逐字；codec eq；checkedArgsCodec
  fail-closed ×4（implemented 拒／address 漂移／pin 漂移／null host）。
- **trigger 面**：command/event 两源 Start 构造＋canonical 往返；fail-closed ×5
  （binding 漂移／implemented 拒／pin 漂移／非规范编码／空 txid）。
- **completion 面**：map-only 透传；身份三元漂移 ×3＋binding 漂移拒收。
- **behavior 面**：构造＋namespace 记录；timeout pin 不符拒收；null 拒收。
- **真实协调器**（persistence-testkit journal，事件走 strict protobuf 序列化链）：
  全串行成功（prepare2 输入携带经真实收据上下文解码的 prepare1 收据字段；
  参与者描述符收据 pin 含 v2）；safe-absent 自动中止＋真实补偿（补偿相位读取
  自身 prepare 收据）；Unknown→RecoveryRequired→授权对账→成功；无授权/超预算
  拒收；交互超时折叠；**交互中 codec 替换/合同漂移被逐读围栏**（ Uncertain
  证据入账）；Start 幂等/冲突。
- **结构面**：import 面／头注释／常量序／合同声明序／相位块序与护栏序／
  单收据双槽／Host 成员序／guard 链序／文件白名单／100 列／命名组合／
  wire ID 计数。
- **引擎元**：计数语义（底数 1＋if/&&/case 增量）、E2b、**NewAnonymous 判别力**
  （E1 依据）、Y2 准入＋禁前缀、Support 豁免结构不豁免 unsupported-term、
  domain 方向负、全 app 面分层净检。

## JS 生成器（字节比对验收）

`tools/gen-strict-saga-module.mjs`（输入合同 `truthsrc.strict-saga-module-input/v1`，
fixture `test/fixtures/strict-saga-module-v1/input.json`）：同一输入重现金样
**逐字节**（produced sha256 = golden sha256 = `74ea1745…`，47795 字节），双跑
确定；13 条 fail-closed 负对照（重复槽位/未知 typeId/缺相位/pin 缺失或归零/
不支持源/未知生产者/String 资源/非法完成源/非规范 digest/非法模块名/重复
step/非正超时）全部拒收且诊断逐字匹配。发射布局按金样冻结：wire 向量在
resource 元后断行、case-class 参数组按类型签名表、内联阈值 90/98——永不自
declare 通过，比对报告由 verify 模式打印。

## 质量状态

- discovery 轮（`.rounds/strict-saga-module-quality-20261120-01`）：两段编译
  exit 0（沙箱内），度量门 4 文件 208 scope 0 violation 0 excess，63 性质三
  seed 740001-740003 全过（随机性质各 ≥1000 次，合计 5058 次评估/seed）。
- final-bytes 轮在本候选提交字节上执行；prepared pin 与 discovery 轮相等即证
  零漂移。本目录只是候选；认可以 bundle sha＋讲解裁定为准。

## 共享冻结件的严格强化（本族登记）

- `test/reference/compiler-pom.mjs`：①`<reporting>` 剥离（dbcp2 japicmp 配置
  块非编译面）；②`${project.*}` 身份替换（netty 兄弟引用，纯机械）；③
  dependencyManagement **scope 继承**（netty 把 mockito 钉成 test 的 maven
  继承语义）。三者只删假编译面/解析到自身身份，既有 POM 解析集不变。
