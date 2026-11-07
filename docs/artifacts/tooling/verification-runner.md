# 验证运行器与证据报告

类别：`verification-runner`。这类工具验证明确输入和执行证据，不是业务compiler，也不能从一个`passed`字段推断整条业务链成功。

## 职责

公共工具现在提供三组可选机制：文件取证、受限进程监督及静态进程/工作线程证据校验。工具归属清单校验另外检查文件覆盖与显式职责引用。银行通过薄adapter消费这些机制，同时保留金融场景、固定suite/oracle、供给、资源租约和总验收决策。

这些源码由工程开发维护，不是业务真源生成的产物。抽离减少重复实现及错误依赖方向；不意味着历史脚本全部退役，或新业务只提供一棵truth就能得到全部实现与测试。

## 输入与人工信息

- 文件取证需要调用者明确绝对路径、最大字节数和可选解析器。默认拒绝symlink、路径别名、非普通文件和hardlink；显式hardlink例外属于调用者政策。
- 受限运行需要明确executable、args、cwd、env、新evidence basename、timeout和已核摘要的Seatbelt profile。调用者负责给定可执行文件、输入范围、网络/写权限、凭据脱敏值及所需的barrier校验。
- 工作线程校验接受完整JSONL记录、关闭回执和显式期望字段。银行adapter另绑定TA路径、schema、配置/fixture摘要、关闭交换和锁文件。不能凭线程关闭证明金融结果。
- 业务验收需要独立预期。银行的24恢复场景、付款/TA/退款/定投断言、公开API及冻结runtime坐标都不成为公共默认值。

## 生产与所有权

`lib/verification/`由公共工具维护；银行`tools/truthsrc-evidence.mjs`、`truthsrc-runtime-process.mjs`及`truthsrc-worker-evidence.mjs`承载项目政策。当前build/admission保留旧函数导出，以兼容既有消费者；轻量租约不再经整个build/admission获取文件原语。

完整静态报告通过公共机制复核原始回执和日志，不重签旧证据。工具源改变后，既有项目/报告的工具指纹可能过期；这是真实来源变化，必须使用新窗口，不能重写旧失败来获得通过。

## 结构与命名

| 公共模块 | 入口 | 边界 |
|---|---|---|
| `lib/verification/files.mjs` | `assertCanonicalPath`、`captureEvidenceFile` | 路径准入和同一缓冲区取证；不带银行目录、`.scratch`或固定归档政策 |
| `lib/verification/process.mjs` | `runVerifiedProcess`、`validateProcessReceipt`、`inspectProcessEvidence` | 有界运行、纯成功回执检查、只读文件复核；当前执行后端仅Darwin Seatbelt |
| `lib/verification/worker-evidence.mjs` | `parseWorkerTranscript`、`validateWorkerLifecycle` | 纯记录/关闭身份校验，不访问文件或探测PID |
| `lib/verification/tooling-ownership.mjs` | 工具归属清单校验API | 文件库存和声明引用可核验；不推断任意程序的运行依赖或业务语义 |

公共进程默认schema为`truthsrc.verified-process/v1`，银行adapter强制保留`bank.truthsrc-runtime-process/v1`。已有银行回执、PID及业务协议不因目录抽离而改名。平台不支持时明确拒绝，不悄悄换成无sandbox运行。

## 依赖与装配

全部为可安装包内的可选库API，复用`immutable-data`与已有strict JSON能力。基础`truthsrc`的help、validate、compile、Counter生成不因此要求JDK、Docker或Seatbelt。基础文件API不把产品JSON的“只允许安全整数”规则强加给所有消费者：解析策略由调用者明确提供，报告adapter仍采用其原严格规则。

```js
import { captureEvidenceFile } from '@madpolaris/truthsrc/lib/verification/files.mjs';
import { runVerifiedProcess, inspectProcessEvidence }
  from '@madpolaris/truthsrc/lib/verification/process.mjs';

const profile = captureEvidenceFile('/absolute/owned/sandbox.sb');
const receipt = await runVerifiedProcess({
  executable: '/absolute/node',
  args: ['/absolute/owned/check.mjs'],
  cwd: '/absolute/owned',
  env: { HOME: '/absolute/owned', PATH: '/usr/bin:/bin' },
  base: '/absolute/owned/new-run',
  timeoutMs: 5000,
  sandbox: {
    executable: '/usr/bin/sandbox-exec',
    profile: '/absolute/owned/sandbox.sb',
    profileSha256: profile.sha256
  }
});
if (!receipt.passed) throw new Error('Execution failed; preserve its evidence');
const checked = inspectProcessEvidence('/absolute/owned/new-run');
```

这里的profile由调用者提供，必须保护日志/回执/profile免受子进程写入，并按实际任务限定权限。示例不创建资源租约或自动生成隔离政策，不授予运行任意业务服务的权限。

公共runner在spawn前独占保留三份证据文件；显式env不继承调用者环境，记录envKeys而不记录值。secret只在内存中匹配，跨chunk、重叠及EOF前缀在落盘前脱敏。超时/取消只监督本次创建的直接子进程和原进程组，不认证故意脱离该组的任意后代；预期SIGKILL成功还需已验证callback实际定向发送信号。计时采用单调时钟，清理预算耗尽后撤销pipe写入再关闭描述符。callback必须让出事件循环；未settle的异步callback会被撤销，阻塞后逾期返回也会失败，但无限同步循环不能由同线程timer抢占。

## 回锚与更新

共享验证机制属于技术实现，不伪造银行知识来源，也不写生成ledger/anchors。业务源码回锚继续由公共writer和同图校验负责；手写文件显式来源关系由独立`handwritten-provenance`负责，不能以进程通过替代其验证。

来源指纹必须覆盖真正加载的新公共模块及银行adapter，不能只保留原wrapper的SHA。执行依赖、保守的历史保护库存和完整工具归属清单是三个不同维度；历史文件仍被指纹保护不等于运行它。

## 验证

- 公共文件反例检查完整路径、大小上限、alias/symlink/hardlink、非普通文件及取证期间替换；hash和parse基于同次捕获。
- 公共process检查成功、失败、超时、取消、callback/信号、后代回收、输出上限、脱敏及排他证据。静态检查绑定command/profile/log摘要、basename、完整状态和嵌入回执，不探测旧PID。
- 线程记录校验与live退出等待分开。`inspectRuntimeWorker`只读原件；`checkRuntimeWorker`只用于当前运行窗口的已知线程，不能用历史PID判断今天哪个进程应该退出。
- 银行fresh-import测试核轻量lease、session及公共adapter实际依赖；安装测试从离线tarball移动prefix后，在无银行checkout的非银行样例中消费API。
- 工具归属检查不执行被扫描源码，不自动fetch或读旧运行数据。库存声明的正确性仍需审阅；元数据自洽不是完整执行认证。

`npm run test:verification`是公共定向入口；银行使用其显式`test:public-tools`及原Node verifier/workshop suites。新测试均不代替真实银行JVM、HTTP/数据库、跨JVM和真人上手验收。摘要/文件哈希只能证明一致性，不提供针对可重写整套证据者的密码学真实性；调用者仍须拥有并信任证据根。

## 版本与实例

`tooling`变体对应上述公共机制，`bank-p23`变体对应银行政策与编排。P1整体仍未完成：完整lease提取、build报告通用化、工作坊步骤编排、Docker资源适配、现役crash/browser对历史政策文件的其余依赖尚未全部拆分。银行仍P23，完整service的新读库replay失败、人工会话未执行；本次不升级R2、不增加超时、不改变oracle。

- `js:lib/verification/files.mjs` — `captureEvidenceFile`。
- `js:lib/verification/process.mjs` — `runVerifiedProcess`、`inspectProcessEvidence`。
- `js:lib/verification/worker-evidence.mjs` — `validateWorkerLifecycle`。
- `bank:tools/truthsrc-runtime-process.mjs` — `runRuntimeProcess`。
- `bank:tools/truthsrc-worker-evidence.mjs` — `inspectRuntimeWorker`。
- `bank:tools/verify-truthsrc-build.mjs` — `admitCandidate`。
- `bank:tools/bank-workshop-verification.mjs` — `inspectService`。

银行的来源、全部工具职责和构建顺序在其`docs/BUILD-RECIPE.md`与`docs/architecture/TOOLING-OWNERSHIP.json`，不复制成公共金融政策。完整revision、摘要及来源清点处置见本目录的`sources.lock.json`；清点不是生产运行认证。

### 类别依赖

`artifact-manifest`、`code-provenance`、`independent-business-oracle`。这些是职责依赖，不代替真实import或执行顺序验证。
