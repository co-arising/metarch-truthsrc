# aggregate-state-controller v1 — S1 聚合状态查询控制器金样候选

> 传统清单第 34 族：N 个合格聚合共用**一份** `app/controllers/AggregateStateApiController.scala`
> （multi 项目下 controller → root 领地；N=0 时零文件零方法）。
>
> 2026-11-20 裁定链（开工前用户逐项拍板）：**S1** 框架供给钉扎（play 2.8.18＋play-json 2.9.3
> ＝BC 的 override＋akka 2.6.20 typed 分片闭包，88 坐标全离线）／**O1** TokenService 裁剪到
> 验签读取面（JWT 实现归平台 auth-core jar）／**Y2** 引擎边界禁前缀表去掉 play/akka（结构性质
> 逐文件白名单钉住）／**T1** IdGuard 裁剪单件／**F6** 行为面全可执行（官方 TestEntityRef 缝）。
>
> 实探拦下的错误判断：akka 2.6.20 的 `EntityRef.ask` 是 `(resolveTo)(implicit timeout)` 接口
> 成员、**无 Scheduler 参数**——raw 模板的 ask 调用编译无缺陷（javap＋编译探针双证）。

## 本族制品解决什么问题

前端要看"某条预订/某笔库存现在是什么状态"。本族制品是**写侧强一致状态查询控制器**：
`GET /api/state/<kebab-agg>/:id` → `api.global.read()` 鉴权 → `IdGuard.parse` 边界翻译 →
`repository.entityRef(id).ask(Get<X>State(解析Id, replyTo))` → reply 直接返回（implicit
OWrites 序列化）。**零机制**：不发事件、不落库、不持久化、不发布；序列化收在 controller 层
（逐字段手写 OWrites，>22 字段无宏路径——raw 模板注释的设计动机）。

## 范围（21 源文件进门）

- 生产 12 文件＝**族工件 1**（控制器）＋**平台供给 5**（Endpoint 三门裁剪到 global 门／
  ApiError 包适配＋消费面裁剪／TokenService 验签读取面／冻结 IdGuard 单件／common Id）＋
  **业务供给 6**（两个 domain 状态、两个协议、两个仓储端口）。
- 测试 5 文件：输入形状＋oracle（期望 JSON 直陈）＋fixture（真实 play Action 栈＋本地
  typed ActorSystem＋官方 TestEntityRef 缝＋FixedVerifier）＋行为 13 条＋结构/引擎元 33 条
  （合计 46，15 负对照）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 关键合同点（裁定状态）

| 项 | 状态 | 一句话 |
|---|---|---|
| F1 供给 S1 | ✅ | 88 坐标＝play 2.8.18/play-json 2.9.3（BC override）/akka 2.6.20 全闭包，全在本地缓存，prepare 闭包断言零缺件 |
| F2 auth O1＋R-A 修订 | ✅ | TokenService＝验签读取 trait 面；Endpoint 恢复 curated varargs 签名 `read(roles: String*)`（零参＝零声明角色＝缺省 User，声明角色须命中；migration gate 分支收归平台）——auth-core API 形状不被本族改写 |
| F3 引擎 Y2 | ✅ | boundary 禁前缀表去 play/akka；domain 层零改动；play/akka 文件白名单由结构性质钉住 |
| F5 IdGuard T1 | ✅ | 冻结 scaffold-static 裁到 IdGuard 单件；消息回退位 getClass→具名常量（结构门禁反射名，正文/键位/400 形状逐字一致） |
| F6 行为面 | ✅ | TestEntityRef 官方测试缝让 ask 往返/私有 writer JSON/超时折叠全部真实可执行；声明序走结构面 |
| E2b 引擎 | ✅ 沿用 | Term.Assign 按上下文判（实参位两层准入／语句位两层违规），元性质 2 条 |
| D-LAYOUT-100 | ✅ 沿用 | 100 列纪律，import 豁免，结构性质钉住 |
| R-D 已知债 | ✅ 本轮修 | stateType 必填／gate-builder 统一去后缀 base／registry miss 拒收／noteId 删除——合同层修正＋生成器 fail-closed；D-P08 族 2026-11-21 闭环（见下节） |
| R-F 序列化面 | ✅ 用户裁定 | 全部 writer 改 private implicit val（raw 非 implicit T8 记为本族修掉的缺陷）；生成器契约＝同类型去重发射＋递归拓扑序（共享 Writes→状态 writer→回执 writer→方法） |

## 行为合同（ScalaCheck 实测，13 条全真实 HTTP 管线）

401×4（缺 Bearer／坏 header／无效 token／过期 token，各证明 expectNoMessage＝拒绝不触 ask）／
400×3（固定非法 id 全等形状＋随机非法 id 回显前缀＋stock 面，各证明不触 ask）／500（**真实 5 秒
ask 超时**折叠进崩溃护栏 INTERNAL_ERROR）／200×3（随机合法 id 记录解析后 Id＋settledAt=null 的
null-safe JSON＋settledAt ISO 串＋stock 独立字段形状）／无信封键／双跑字节相同。

结构 33 条：import 面逐字／成员序／ctor 序／每聚合 IdGuard＋ask 形状／play 白名单
（控制器＋两 auth 供给）／akka 白名单（协议＋仓储四件，控制器全限定零 import）／时钟 confinement
（仅 Endpoint）／身份 confinement（UUID.fromString 仅 common Id、Id.of 仅 IdGuard）／100 列／
零机制 token／领域状态纯度／仓储端口无 ask 实现；引擎元 8＋E2b 2＋Y2 准入 1＋方向负 4＋语法负 1。

## 质量状态

- discovery 轮（`.rounds/aggregate-state-controller-quality-20261120-10`）：两段编译 exit 0，
  度量门 21 文件 508 scope 0 violation 0 excess，46 性质三 seed 740001-740003 全过
  （随机性质各 ≥1000 次，合计 15123 次评估）。
- final-bytes 轮在本候选提交字节上执行；prepared pin 与 discovery 轮相等即证零漂移。
  本目录只是候选；认可以 bundle sha＋讲解裁定为准。

## JS 生成器与 D-P08 修复轮（2026-11-21）

`tools/gen-aggregate-state-controller.mjs`（输入合同
`truthsrc.aggregate-state-controller-input/v1`，fixture
`test/fixtures/aggregate-state-controller-v1/input.json`）同一输入逐字节重现族工件
（`66c82bfb…`，produced sha = golden sha，双跑确定）；供给 11 件不发射、只带真
sha256 登记。verify 三合一＝字节等值＋双跑确定＋12 条负测电池（另有独立
`negatives` 模式），全部 exit 0。

**D-P08 fail-closed 族债闭环（R-D 当年按用户指示排后的唯一遗留）**，金样字节
零改动：

- **DP08-1 strict-schema 通吃**：通用未知键拒收落到四层（input／aggregates[i]／
  stateFields[j]／supplied[k]）。登记的 strict-schema guard 此前超前于代码——
  探针实证杂键（含 degraded 标记）能一路滑进发射，现在为真话。
- **DP08-2 raw-debt token 深扫**：输入全部字符串叶禁 `???`（占位债）与
  `degraded`（raw degraded 形标记，不分大小写），拒在输入边界、不论是否可达发射；
  token 集故意最小（`net.imadz.metarch` 在本族是合法 import 前缀，#26 内核 token
  表不转移）。
- **DP08-3 unknown-dialect 面归位**：FIELD_SIGNATURES 精确名义匹配（play-json
  builtins ∪ 共享 Instant/Id）即序列化方言准入，已在岗，登记归位，零新代码。
- **DP08-4 负测电池进工具**：8→12 条（新增两条通用未知键＋routeBase 携 `???`＋
  值携 degraded 标记），修复「登记说 verified 但 repo 无 runner 可重放」的缺口，
  与 #40/#41/#42 的内置电池纪律拉齐。

**writer-face 质疑（用户 2026-11-21）探针裁定**：要求把状态 writer 换成
`Json.format` 风格宏声明（此前确有依赖序＋去重的 formats 生成代码——本族金样的
去重＋拓扑序正是该要求的落地）。探针（pinned 栈 scala 2.13.14＋play-json 2.9.3
离线编译）：`Json.writes` 8 字段编译运行成功（共享 null-safe Instant writer 被宏
吸收，null→JsNull），**23/30 字段均炸 `No unapply or unapplySeq function found`**
（2.13 超 22 字段 case class 无元组形 unapply 供宏消费）。结论：手写逐字段面维持
——宏面会给「无字段数上限」性质塞 22 字段硬帽；reply 信封也不能宏派生（wire 平铺
`r.state`，宏会套 `state` 键）。去重＋依赖序本来就在；合同行 497「没做版本能力
实测」的豁免缺口由本探针回执闭合（technical-input.probes）。
