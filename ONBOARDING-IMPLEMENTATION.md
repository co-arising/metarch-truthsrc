# 精品上手实施：接口与批次记录

2026-11-06：用户已要求“继续，完成一个精品”。实施依据 `ONBOARDING-DESIGN.md`。本文件记录当前接口，不替代独立验收。

## 独占分工

- CLI/包/工具README与教程：`bin/truthsrc.js`、`package.json`、`lib/cli-presentation.mjs`、`lib/node-runtime.mjs`、工具四份入门文档、对应测试。
- 回锚验证：`lib/project/verify.mjs`、`test/project-verify.test.mjs`；必要的查询批量API由该负责人改。
- 主集成：`lib/project/view.mjs`、银行编排/供给/文档及最终验收。
- HTML展示：`lib/workshop/render.mjs`、`lib/workshop/client.js`、`lib/workshop/style.css`及对应测试。
- 运行准入与租约：银行 `truthsrc-runtime-admission.mjs`、`verify-truthsrc-runtime.mjs`、新 `truthsrc-runtime-lease.mjs`及对应Node测试。

实施阶段没有git提交/push/registry发布授权。收口时用户另行要求先本地提交并提供压缩上下文，再继续推进并精简银行仓；本次只提交两仓本轮源码/文档，不推送或发布。作者/35手写/31冻结测试/7冻结供给已经捕获至银行 `target/onboarding-baseline-20261106.4rIRIO/protected.json`。原 `.gitignore`/`.DS_Store`/`__pycache__` 不认领；BC混合协调板不代提交他人改动。

## 公共新接口

- `verifyProject({project,out,required=[]})` / `verifyProjectCli(args)` → `truthsrc.project-verification/v1`；`passed`、`checks`、`diagnostics`、`snapshot`、`graph:{snapshot,generation}`、`codeDigest`、完整生成源码`files`、`counts/coverage`、`runtimeVerified:false`。
- `viewProject({project,out,config,knowledge})` → `truthsrc.project-view/v1`（内存只读模型）；银行报告覆盖层由银行 `bank-workshop-view.mjs` 核snapshot/codeDigest后接入，不允许公共接口传未认证成功布尔。
- `viewProjectCli(args)`：`--project <config> --out <generated> --html <new-file> [--tour <json>]`。只读项目，唯一写入为显式新HTML；不重建图/覆盖生成物。
- 默认JSON兼容；项目命令`--format human|json`由dispatcher剥离并格式化，不传入核心parser。

## 展示模型 v1（主集成与renderer共享）

```text
{
  schemaVersion: 'truthsrc.project-view/v1',
  title, subtitle,
  project: {name, system, context},
  snapshot: {source, knowledge, generation, codeDigest},
  freshness: {state, checkedAtExport: true, live: false},
  verification: {passed, checks, counts, diagnostics},
  evidence: [ {id, label, status:'passed'|'not-run'|'blocked'|'failed', summary, scope} ],
  nodes: [ {
    id, identity, label, kind, owner: [], description,
    state: 'mapped'|'not-generated'|'ambiguous'|'unmapped'|'stale',
    sources: [ {file, pointer, label, text, startLine, sha256} ],
    locations: [ {file, startLine, endLine, text, highlight:{startLine,endLine},
      fingerprint, precision:'span'|'file', sourceIdentity, reverseIdentities: [],
      reverseLocations: [{identity, precision, startLine, endLine}]} ],
    diagnostics: []
  } ],
  edges: [ {from,to,kind:'declared-reference'|'source'|'context',label,proof,asserted:false} ],
  chapters: [ {id,title,kicker,description,nodeIds:[],questions:[]} ],
  totals: {nodes, edges, shownNodes, omittedNodes},
  limitations: []
}
```

`from/to`为实际nodes.id。只展示实际存在边；`context`仅讲解线（虚线）。renderer不得根据标题推断状态/edges，不能伪造passed或runtime结果。任意文本都按不可信内容呈现。源码/作者摘录由主集成按已验证来源捕获，renderer不读取磁盘/网络。

## Renderer合同

`renderWorkshop(view)` 从 `lib/workshop/render.mjs` 导出，返回完整单文件HTML。把CSS/client嵌入，不依赖CDN/网络。接受上述模型；所有内容须safe JSON embedding、DOM textContent；禁止eval/innerHTML处理输入。固定应用模板可用innerHTML但不得插用户文本。默认中文，桌面/窄屏，键盘可操作，reduced-motion。导出时静态快照标签不可隐藏。展示验证/运行证据缺失要显著。

浏览器验收由主集成用现有Playwright/Chromium执行；设计风格为深色墨蓝背景、暖白内容面、青绿/琥珀语义强调、清楚排版，避免毛线图和装饰占满首屏。节点选择、章节导航、搜索过滤、作者/代码切换与反查必须真可用。

## 实施结果

CLI、只读完整回锚、五幕离线图、银行分层编排、独立人工会话Launcher均已实现。官方Node22.13.0/本机22.23.4安装与Counter实测；公开onboarding33、银行workshop76、原统一400通过1跳过。银行新actor64/readside47实际编译执行；运行入口新准入235inputs/194classpath与4class独立Launcher编译通过，固定crash02恢复24窗/72JVM通过。测试集合有重叠，不汇总冒独立覆盖。

精度review修复已覆盖：完整多span集合、持久化identity associations、精确技术binding pointer、未声明symbol拒绝、有界JSON/FIFO拒绝、逐身份自己的反查行范围。最终图浏览器实测第14/15行相邻fold隔离、五章导航、证据卡、桌面/手机、无外部请求/错误。

完整银行服务仍受Docker离线阻断，人工体验只有代码和控制器合同验证，未冒实际服务通过。原干净材料的获取渠道与三位真人可用性尚未签收。详情及证据路径见银行 `docs/ONBOARDING-ACCEPTANCE.md`；不会把设计、安装或局部成功等同于全部新人交付完成。
