# external-connector-port v2 — StockCatalog 本地工具门金样候选（toolgate 词汇修订）

## 2026-11-19 用户裁定的四层修订

v1（bundle `725e03a1`，已认可）保持冻结。v2 落实当轮裁定：

1. **词汇改名（名实一致）**：connector→toolgate。`application.toolgates` /
   `infrastructure.toolgates`，port 面为 `StockCatalogToolGate`；注册表族 ID
   `#13/#25` 不变（台账语义：迁移哪个 raw 制品）。
2. **签名只讲业务语言**：`probeAvailability(sku: SkuId)`——script/进程/超时词汇
   全部退出应用面。raw `scriptParam`（调用方指定执行哪个脚本）判为 raw-only，
   只进生成器观察 fixture，永不进目标。
3. **runner 升格为固定 lib**：`infrastructure.process.LocalProcessRunner` +
   `ProcessRequest(script, argument, timeoutMs)`，手写外域、两族共用、生成器永不
   创建；具名违约值 `TimeoutViolation`/`ConcurrencyRejected`/`ScriptRejected`
   走失败通道，永不抛出。
4. **安全链归属**：编码侧字符集（域值类型）→ 传输级注入（runner argv 直传条款）
   → 协议帧（codec 解码侧）→ 工具身份与进程资源（runner 钉扎钩子＋部署加固阶梯：
   bounded lib → 钉扎脚本 → 沙箱 spawn → daemon 客户端，全部只动绑定）。
   调用方授权在应用层，永不属 runner。

## 范围（21 payload）

- 生产 8 文件：gate trait（无实现引用）、两个结果类型＋`ProtocolViolation`、
  **样本支撑参考实现**（密封绑定：脚本常量＋超时预算＋类型化 lift；生产实现合同
  归 tool-gate-implementation 族）、`LocalProcessRunner` lib（三句契约：argv 直传、
  有界生命周期击杀、钉扎钩子）、`StockCatalogModule` 装配、冻结复用
  `ReservationValues`（sha `48f29020…`）。
- 测试 4 文件：闭式 payload 形状＋`ScriptedRunner`（逐条记录 `ProcessRequest`）、
  独立 oracle、36 条性质（8 负对照，含 Guice 装配解析与密封绑定逐字段相等断言）、
  度量器元性质（引擎四文件与 scope 例外表逐字节冻结复用）。
- 质量骨架 4 文件＋政策/清单/输入/回执。

## 委托合同（实测）

恰一次 runner 调用／每次 gate 调用，`ProcessRequest`（密封脚本＋`sku.value` 实参
＋密封超时）逐字段相等；失败原样传播不重试；畸形输出→失败通道具名值；refusal
留成功通道；无参方法用密封目录绑定；装配性质走真实 Injector。

## 质量状态

- 独立窗口对本候选字节实测：两段编译 exit 0，度量门 16 文件 0 violation / 0
  excess，36 性质三 seed 740001-740003 全过（回执见 `.rounds/` 与 review-status）。
- 本目录只是候选；认可以 bundle sha＋讲解裁定为准。
