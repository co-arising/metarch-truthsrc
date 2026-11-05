# BC 七项阶段差异：待 owner 裁决的精确合同

日期：2026-11-05。用户要求解决阻塞后，对既有编译、拆分、摄入和合并消费进行定点核查。本记录提供能落到代码的裁决材料，**不是代替 owner 批准，也不修改旧真源**。

## 结论

两个字段在代码上分开存放，但现有合同互相冲突，不能自动认定任何一端错误：

- BC `src/main/scala/net/imadz/codegen/ingest/domain/Note.scala:5–7` 说明 session 决定当前阶段，note.stage 只作信息标注。
- `tools/truthsrc/decompose.mjs:147–162,282–285` 从 session 写 origin；`compile.mjs:189–203` 按 origin.stage/board/seq 重建 session，payload 原样放回。只能据此称 origin 为**来源会话位置**，不能追认它一定是首次捕获时间。
- `skills/workshop-ingest/SKILL.md:71–73` 却要求 notes[].stage 与 session 相同。
- `src/main/scala/net/imadz/codegen/ingest/application/MergeEngine.scala:104–145` 跨 session 按 type/name 合并时使用 note.stage 排序。因此 payload.stage 不是可以无影响地改掉的展示文字。
- 旧 `tools/truthsrc/validate.mjs:156–170` 不比较两 stage，只能证明旧门没有这条检查，不能证明差异已经获批。

七项差异在旧 `.ingest/metarch.json` 的历史提交已存在，不是本次树拆分或 JS adapter 新造。不得用新 reader 自动选边使迁移变绿。

## 精确对象

BC 读取基线：`c612626f51bc5465d7466f122388cc87e6c9ef24`。以下对象均为 `origin.stage=refining`、`origin.board=board1`，其 author/createdAt 为空；不要补造作者、时间或审批。

| 名称 | 源文件（相对 BC） | seq | payload.stage | header id / noteId |
|---|---|---:|---|---|
| SubmitDoRFindings | truth/metarch/contexts/main/aggregates/do-r/notes/command-rf-submit-do-r-findings-288.yaml | 288 | storyMapping | b3e10d41-34cb-4046-8550-9cff46ea3c1e |
| DoRFindingsSubmitted | truth/metarch/contexts/main/aggregates/do-r/notes/event-rf-do-r-findings-submitted-289.yaml | 289 | storyMapping | 889692b6-9138-4e18-8ee0-40af2178be55 |
| KnowledgePatch | truth/metarch/inbox/refining/aggregate-rf-knowledge-patch-247.yaml | 247 | aggregateDiscovery | 21d57ca3-9d00-44d2-bf31-c59aa67c8822 |
| OrganizationMember | truth/metarch/inbox/refining/aggregate-rf-organization-member-266.yaml | 266 | aggregateDiscovery | 8d51c927-11de-41ba-9723-d9997c66c084 |
| AI Agent | truth/metarch/inbox/refining/role-rf-ai-agent-94.yaml | 94 | commandStorming | f3859a0e-9ede-41a0-b58f-93ae620a7cfc |
| System | truth/metarch/inbox/refining/role-rf-system-271.yaml | 271 | storyMapping | 3135f150-cce8-41f7-866d-6330632b3275 |
| SystemOperator | truth/metarch/inbox/refining/role-rf-system-operator-263.yaml | 263 | storyMapping | 5e61e0bb-136c-4070-8f58-aa9ddd034a3c |

各文件第3–16行包含上述身份和阶段。按表顺序的实际文件 SHA-256：

```text
d805fbb77a790f8e713b9d94750fe7332468e64b6b7de61f031dc562ca70dd4c
ea2653051d1066f816879d7574cff9d07a7dc55820aa0d5d1e6b567242ac700a
242114cea27bbfdb1e78b33c9bcb4d5893a088b2b7649cb3e3380aa8f747b938
eccefbc60f9d5a59f4030983354894db86df3f0691a0f4a0ca981e052a1f4169
e270ccfbc3f02f0a8b6a3b324f3ed04daef2eb076d5bdf64a590ad5741824770
2cfa05796e74a1d8454a55921de855a28c14843f1a2622f36f8c2a9c8b4cb14f
07613450e1356bbf0da4791c73d91e1a2fdb06c0afd5a1c91fe950bda5f02180
```

`inbox/commandStorming/role-cs-ai-agent-8.yaml` 还有同 noteId 的 AI Agent。不能按 ID 合并或删除其中一个来消冲突。

历史证据（仅解释来源，不冒称当前运行）：

- `47891afa068df3efb100e0176ffeddbbc1df8eb7`：SubmitDoRFindings、DoRFindingsSubmitted、SystemOperator、System 已在 refining session 中保留 storyMapping 标注。
- `aaa0db8cf4d86ab8134007ff612189e9e3a1fd4d`：KnowledgePatch 已有 refining/aggregateDiscovery 差异。
- `52a5b73347f156338ca94a2fa16ccde62f4c0c50`：OrganizationMember、refining 中 AI Agent 已有差异。
- 拆树前 `1178ca2172e2fad1f0261078e0a99fadd21d18ef` 已有表内七个 ID、seq 和组合。更早版本未有 noteId，不能把后补 ID 追认为最初身份。

## 推荐裁决及替代方案

**推荐确认双阶段合同、保留两值：** origin.stage 是会话位置，payload.stage 是原阶段标注，并继续保留既有合并优先级语义；同时明确摄入文档相等约束的适用范围。该推荐最少改变既有消费，但仍需 owner 明确选择，当前未批准。

若获选择，实施门应包括：

1. 在新作者合同显式表达两个维度，分别校验，不把全体 stage 差异免检。
2. 七项决定绑定具体文件、身份、seq及上述SHA；文件改变、出现第八项或裁决不完整仍拒绝。
3. 原树保持字节，决定只作用于经授权的新作者表示；来源回查能解释两个原字段。
4. 全量五产品及序列化保真，新增实际 MergeEngine 消费结果比较；不能只用 adapter oracle 代替现役消费。
5. 独立认领 BC 新作者输入覆盖接口与消费者切换；未完成前不把兼容投影称为全工具链统一。

替代方案是确认 payload 标注有误（改为 refining），或确认会话位置有误（移动到 payload.stage）。两者都改变现有语义/顺序，必须按业务事实修订而非纯格式迁移验收；后者还涉及同号 AI Agent 与 seq 落点，不建议机械处理。

## 消费切换的实际接缝

- Node `tools/truthsrc/load.mjs:19–64` 默认内存编译旧树，当前没有源目录覆盖参数。
- Scala `StateFileStore.scala:21–48` 固定读当前目录下缓存，`IngestedSystem.scala:13–19` 有错误回落为空的路径。新接口应显式、只读、缺失即失败，而不是改工作目录偷换缓存。
- `CodegenMain.scala:62–80` 的 `codegen.systemFile` 是 SerialCanonicalAdapter 输入，不能直接塞入五产品中的 WorkshopState。
- 裁决后先在全新自有目录生成五产品，独立跑 `WorkshopStateJson.read → AssemblyEngine.assemble`，不写 BC 现役缓存、不运行可能刷新共享 journal/索引的旧 pipeline。

本次未改 BC 源/缓存、未生成共享应用；上述调查不是图验证、切流完成或新运行认证。银行运行门不依赖此裁决，可独立推进。
