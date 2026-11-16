# classic @2：反馈修正及验收分账

记录：2026-11-16。来源是 [实施范围](CLASSIC-V2-SCOPE.md)、新独立 [参考资产](../../test/reference/classic-cqrs-v2/README.md) 和本机公开CLI记录。以下保留失败成因，不用成功结论抹掉旧回执。本页不单独构成最终PASS。

## 生成器新增问题

| 问题 | 实际反馈／核对 | 修复与边界 |
|---|---|---|
| Rule Builder包接口描述错误 | public @2生成exit2，producer触发TypeError；main给代理的接口误称`ctx.layout.domain.invariants`是字符串 | 使用实际`invariants.root`；旧F1与两@2输入均由publicCLI重生成字节一致，expected未改 |
| VO >22默认表达式插值的stripMargin漏移植 | 独立审阅构造多行default带leading`|`，核固定Scala模板的最终`.stripMargin`；两字段Money未触发 | 新共享`text.mjs`只在manualReadsWrites对应位置处理；不是比较器归一化。新额外public plan单列，未取得此输入双端Scalaexpected |
| mutation无referenceCode回退的stripMargin漏移植 | 独立审阅构造多行intent带leading`|`，核固定ScalaBuilder回退分支 | 只处理null referenceCode的回退，空串与非null源码、helper Left/Right不改；新public plan观察，不迁签广variant parity |

`stripMargin`按固定Scala2.13.16 StringOps：CR/LF/CRLF逐行，前缀字符值`<=32`后跟`|`才删除；保留分隔符和空白行，不用Unicode `\s`扩大行为。修后两现有输入的可复用public重放仍各15/15；另一独立复核未发现本两修新问题。更宽variants保持OPEN。

## 运行包装／oracle问题（不改生成器）

- 首轮新out祖先`.rounds`缺literal目录read许可，首generate exit2、未compare；只在新轮增加目录项读取，不给旧payload／网络／生产write权限。
- final新轮搬移driver未替换短W常量，main guard在进程/lease前拒绝；下一轮新profile改路径却plan仍旧hash，supervisor在spawn前拒绝。原失败均保留，新plan固定实际新profilebytes。
- 重复比较缺旧actual祖先directory read；增加literal目录read，不改来源或比较算法。
- 原determinism scope把ledger/anchors同时放两分区，被严格“全分区互斥”正确拒绝。新比较捕获两次实际生成的15源码全文到sources-only根，零内容转换，先核原目录17文件完整库存；ledger单独原bytes比较、anchors只inventory。不修改比较器或旧scope。
- 新捕获根父目录未建、mkdir递归没有W终止条件，均是driver机械错误。修新driver，生成器/金样不变。
- 首negative profile仍绑定旧scope/readroot，只补明确reference和scope只读许可，不扩大写面。
- “空集合正例”保留10命令却清空规则/flows，违反已有unhandled命令准入，public exit2正确。原错误oracle保留；新合同将原输入判reject，另有只读命令＋空rules/handlers的合法plan，不修生成器放行。
- 两个@1探针错留@2 capability名称，正确先被request拒绝。修新probe使用`classic-aggregate-scaffold@1`后再验证target混配／eventStruct拒绝，不改生成器迎合诊断。
- File-only准备复制遗漏故意empty的unregistered generator目录，public ENOENT保留；新轮保留此空目录以真实触达shipped registry拒绝。
- 最终独立核对全部42真实回执、30完整rawexpected和当前pins通过，却发现旧plan汇总`bounds.commands=41`、`sumTimeoutMs=2310000`没有更新；实际steps/ready/completion为42，每step期限均与原receipt吻合，合计2326887ms。原plan/completion不改；新增post-execution验收记录重算汇总并指回原42receipts，且纠正旧文字中determinism来源／@1 pin数／extra合法plan数。补正不执行新命令、不增加运行期限，不把汇总sum当新的batchdeadline；原BLOCKED裁定保留至独立补正复核。

所有重跑使用新actual/evidence、保留原失败，已耗时从对应命令预算扣除，不延长原120秒/更短30秒限制。最终续接只补未完成项，已成功的原公开回执在源pins不变时显式carry，不能把carry说成重新执行。

## 证据类型不可混签

- 原Scalaexpected：独立asset owner从原四次`CodegenMain`成功实产获取；30完整Scala共72067bytes，未trim或修复。
- 实际JS当前两输入：15文件scoped rawbyte反馈；旧@1四件有独立回归。
- 六negative：在新隔离副本改内容/集合；预期exit1不改变supervisor `passed:false`。
- 非法输入：预期exit2，不称生成成功；合法额外输入只public plan或产品compile，不称同输入Scala parity。
- 独立审阅：静态发现/反驳，不替代public命令；transport EOF无结果者未计完成。
- 业务质量、Plain FP／ScalaCheck、F2、common效果顺序/唯一供给、银行runtime与完整field-level回锚，均不继承本15文件PASS。
