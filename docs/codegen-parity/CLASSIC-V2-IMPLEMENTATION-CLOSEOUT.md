# classic @2：15文件原字节闭包收口

日期：2026-11-16。位于 `metarch-truthsrc` 分支 `fix/classic-cqrs-f1-byte-parity`，实施基线提交 `9cc11eb5379d7fff93cca0ac198ddbe2c527be8e`。用户随后授权一次本地提交；该提交身份以 Git 历史与提交后上下文窗口为准，不授权 push、merge或发布。承接 [实施范围](CLASSIC-V2-SCOPE.md) 和 [反馈裁定](CLASSIC-V2-FEEDBACK.md)。

## 已实际成立的结论

**新 `classic-architecture@2` 公开目标在两份既有完整同输入下，各15份完整Scala源码与传统Scala原 `CodegenMain` 实产逐字节一致。重复生成稳定，六组文件负对照有效，版本/引用/占位准入与现役profile保护均实际观察。** 没有trim、去头、换行转换、AST替代或差异白名单。

这是当前fixture×两个已锁定输入的 **scaffold scoped parity**。不是42族全量、15业务用例、应用可编译/运行、Plain FP/ScalaCheck或银行财富业务验收。独立复核已直接核42真实回执、30完整expected及当前313source／170extra／203owned pins；发现的汇总元数据错误通过新记录补正并独立核其实际字节，限定闭包完成。最终入口为 [final-completion](../../.rounds/classic-cqrs-v2-closeout-20261116-01/final-completion.json)。

| 内容 | 完整文件数／真实观察 |
|---|---|
| 原四件 | Protocol／CommandHelpers／Behaviors／Entity，共4；旧`@1`两输入各4/4回归未破坏 |
| 本包新增族 | Money VO 1、InvariantRule 9、EventHandler 1，共11 |
| 新`@2`整体 | 每输入15complete Scala；actual目录恰17件，另ledger/anchors仅inventory |
| 独立raw资产 | 两输入30份Scala，72067 bytes；baseline36034、timestamp-int36033 |
| 原Scala生成范围 | 四次各108regular files；本scope15，另93每套只inventory，不读取/复制payload |
| 可复用公开重放 | `tools/codegen-parity/replay-classic-v2.mjs`，二gen二compare真实exit0，修后各15/15 |

## 公开接口及实现

输入schema仍是 `truthsrc.classic-architecture-input/v1`，不裁剪原完整SystemMetadata；新产品版本2、payload `/v2`、capability `classic-source-scaffold@2`，目标目录 `generators/scala-cqrs-classic-v2/`。`@1`保留原四族、原manifest/readiness及bytes，不原地扩大其含义。

三族新增模型／Builder／Template位于 `generators/scala-cqrs-domain/{models,builders,templates}/` 对应 `value-object.mjs`、`invariant-rule.mjs`、`entity-behavior.mjs`。旧四件MBT复用；共享 `lib/classic-architecture/assembly.mjs` 统一完整sourcefileheader、路径、typed dependencies、source ownership及footprint，不借私有writer或expected整文件生成。

版本2事件StructRef有明确声明及唯一实体owner；foreign event、命令冒充结构、未知类型与错误retained/Either拒绝。`???`仅exact registered manifest＋trusted Symbol＋singleton正确版本＋live recompile＋exact non-runnable readiness允许，JSON无法开启`allowPlaceholders`；现役domain profile原21entries仍plan，literal???和任意allowPlaceholders仍拒绝。

## 真正执行过的最终闭合

最终 [completion](../../.rounds/classic-cqrs-v2-final-20261116-13/completion.json) 为 `PASS_BOUNDED_FINAL_RUNTIME_PROBES`，`wholeBatchClosed=true`。42项按范围分账：

| 类别 | 项数 | 观察及边界 |
|---|---:|---|
| 实际生成 | 2 | final两输入actual；每输入15Scala＋两receipts |
| 字节比较 | 4 | 两组raw参考比较＋两组相同候选的重复byte比较；每组15 |
| 实际文件negative | 6 | 空格、生成头、EOF、缺件、多件、query???→实现，全部exit1；原非零supervisor记录保留passed:false |
| 准入reject | 21 | 20原拒绝项＋无效空集合输入，全部exit2；版本混配、typed refs、unregistered target、额外合法product及旧profile等实际触达 |
| 合法额外plan | 7 | helper Left、null/empty reference、wide23默认、多owner、合法只读emptyfamilies、旧domain21；没有同输入原Scalaexpected，不能迁签广variant parity |
| 产品compile | 2 | 单classic及合法额外product graph经公开compile-products；不是生成Scala编译或应用可运行 |

final13承接32项先前真实成功回执、实际补跑10项；不是一次全部重跑。早期所有FAIL_STOP、错误probe、stdout/stderr和actual保留。来源313pins及extra/owned前后无漂移，最终仅本轮lock释放、used标记保留、句柄关闭；进程均直接子回收、组空。

独立核对还发现原plan汇总保留41命令／2310000ms，实际42step与原receipt逐项一致、总期限为2326887ms。原plan/completion保持不动；新 [acceptance-record](../../.rounds/classic-cqrs-v2-closeout-20261116-01/acceptance-record.json) 明确是事后对账而非可重执行计划，按42step重算并修正来源文字。独立 [hash-check](../../.rounds/classic-cqrs-v2-closeout-20261116-01/independent-hash-check.json) 核7文件actualbytes/SHA、11绑定和42逐id期限通过。2326887=2310000+新增合法readonly探针30000−旧消耗13113；这是各步骤allowance合计，不是延长或重置batchdeadline。补正没有新执行，不覆盖初次BLOCKED或待核completion。

重复范围特别说明：严格比较器的scope分区互斥，不将相同ledger/anchors放两分区。两次原actual各先核17件完整库存，再逐字节捕获15源文件到只含15件的临时compare roots，保存source→capture pins，零内容改变；ledger另核原bytes一致，anchors包含输出根因此只inventory。没有借切片清洗Scala正文或临时忽略diff。

## 在哪里查看生成的代码

本机由 **JS公开CLI实际生成** 的两套源码可直接打开（以下路径在忽略目录中，不随Git提交）：

- [baseline 实际代码](../../.rounds/classic-cqrs-v2-reusable-replay-20261116-02/actual/baseline/app/net/imadz/banking/)
- [timestamp-int 实际代码](../../.rounds/classic-cqrs-v2-reusable-replay-20261116-02/actual/timestamp-int/app/net/imadz/banking/)

baseline 的 `application/aggregates/` 和 `application/aggregates/behaviors/` 是3个应用层文件；`domain/entities/`、`domain/entities/behaviors/`、`domain/invariant/`、`domain/values/` 是Entity、Handler、9个Rule和Money，共15个完整Scala文件。目录外的ledger/anchors不是源码字节比较目标。

仓库保存的 [baseline金样](../../test/reference/classic-cqrs-v2/baseline/app/net/imadz/banking/) 和 [timestamp-int金样](../../test/reference/classic-cqrs-v2/timestamp-int/app/net/imadz/banking/) 是**原Scala生成器独立实产的归档**，不是JS实际目录或curated业务参考；与对应JS15文件逐字节一致，可在新clone查看，并按下节命令生成新的JS actual。不要将两种来源混称。

## 可复用的真实命令

从物理仓根，用Node≥22.13（本机固定22.23.4），明确不存在的独占输出根：

```sh
node tools/codegen-parity/replay-classic-v2.mjs \
  --out /absolute/physical/repo/.rounds/new-classic-v2-replay
```

也可使用 [参考README](../../test/reference/classic-cqrs-v2/README.md) 的两个public `generate-products`＋两个 `codegen-parity.mjs`命令。expected 只读且可随repo复用；run receipt指向本机，不伪装portable历史运行。

本机修后可复用 [replay completion](../../.rounds/classic-cqrs-v2-reusable-replay-20261116-02/completion.json)，505 source/asset/tool pins无漂移。先前 [execution03](../../.rounds/classic-cqrs-v2-byte-parity-20261116-execution-03/completion.json) 记录旧@1两套4/4及首次@2两套15/15；最后两处stripMargin修正不参与@1输出路径。

## 修复、审阅与失败保全

- 实际反馈修新RuleBuilder的`invariants.root`接线；独立审阅修VO>manual22和handler fallback漏原Scala `stripMargin`，仅对应原插值位置处理，不在比较器normalize。
- 两baseinputs并没有新增三族文件字节红→绿：schema/producer接线先拒绝，修后首次实产即15/15。宽分支staticfinding与baseparity分账，不编造反例双端运行。
- 独立接缝复核具名placeholder/version/owner/sourcegraph没有boundedfinding；三族review两finding已修，独立限定复核无新增问题。中断无结果代理未计完成。
- 新driver的路径/profilehash/父目录、scope互斥、无效empty正例、@1capability拼错、empty unregistered目录漏copy等失败均按 [反馈裁定](CLASSIC-V2-FEEDBACK.md) 保存；修caller/oracle，不改rawexpected／比较器，续接预算不延长。

## 尚未完成与持续范围

- 三族条件全集（defaults、Instant、>22、其它字段/notes、多实体及formal folds）无独立双端新Scalaexpected，仍OPEN；额外plan只是表明当前准入/发射分支可达。
- 原curated用户target、正常命名/import、Deposit正确回复、三层/Plain FP、ScalaCheck性质、独立金融oracle/CC、字段级回锚、生成应用可运行与银行默认消费仍独立。
- F2、其余传统族/B输出、4个classic Trigger缺项和3退休外部源码槽不因本包完成而解封。common0.2.1已发布且pins已有，本包未验证新consumer唯一供给或effects/ABI，也未改raw追新common。
- 未启动JVM/build/test/typecheck、银行38/R2/relay、服务/容器、下载/发布、shared app/作者树/generated-current/.truthsrc/journal/旧ledger写入，没有新commit/push；独立新输出仅由公共CLI派生，所有原数据/金样/成功与失败证据保留。
