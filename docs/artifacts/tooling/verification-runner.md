# 验证运行器与证据报告

类别：`verification-runner`。这类工具验证明确输入和执行证据，不是业务compiler，也不能从一个`passed`字段推断整条业务链成功。

## 职责

公共工具提供可选的文件取证/清单、协作租约、结果汇总、串行验证闭环、受限进程监督及静态进程/工作线程证据校验。工具归属清单校验另外检查文件覆盖与显式职责引用。银行通过adapter消费这些机制，并在工作坊source阶段使用公共运行闭环；金融场景、固定suite/oracle、供给、端口/数据库政策和总验收决策留在银行。

这些源码由工程开发维护，不是业务真源生成的产物。抽离减少重复实现及错误依赖方向；不意味着历史脚本全部退役，或新业务只提供一棵truth就能得到全部实现与测试。

## 输入与人工信息

- 文件取证需要调用者明确绝对路径、最大字节数和可选解析器。默认拒绝symlink、路径别名、非普通文件和hardlink；显式hardlink例外属于调用者政策。
- 受限运行需要明确executable、args、cwd、env、新evidence basename、timeout和已核摘要的Seatbelt profile。调用者负责给定可执行文件、输入范围、网络/写权限、凭据脱敏值及所需的barrier校验。
- 工作线程校验接受完整JSONL记录、关闭回执和显式期望字段。银行adapter另绑定TA路径、schema、配置/fixture摘要、关闭交换和锁文件。不能凭线程关闭证明金融结果。
- 业务验收需要独立预期。银行的24恢复场景、付款/TA/退款/定投断言、公开API及冻结runtime坐标都不成为公共默认值。

## 生产与所有权

`lib/verification/`由公共工具维护；银行`tools/truthsrc-evidence.mjs`、`truthsrc-runtime-process.mjs`及`truthsrc-worker-evidence.mjs`承载项目政策。当前build/admission保留旧函数导出，以兼容既有消费者；轻量租约不再经整个build/admission获取文件原语。

完整静态报告通过公共机制复核原始回执和日志，不重签旧证据。工具源改变后，既有项目/报告的工具指纹可能过期；这是真实来源变化，必须使用新窗口，不能重写旧失败来获得通过。

`tooling`是公共验证原语的手写实现；`bank-p23`是银行显式验收政策/编排的手写实现，两者都不是由业务真源生成的runner。完整银行监督器和资源政策尚未全部迁入公共库。逐profile责任与证据级别见[CAPABILITY-MATRIX.md](../CAPABILITY-MATRIX.md)，测试源码存在或Node检查通过均不自动成为目标编译、业务行为或最终批准证据。

## 结构与命名

| 公共模块 | 入口 | 边界 |
|---|---|---|
| `lib/verification/files.mjs` | `assertCanonicalPath`、`captureEvidenceFile`、`fingerprintEvidenceFile` | 同缓冲区hash/parse；流式指纹用固定缓冲区，不把大归档读入内存 |
| `lib/verification/inventory.mjs` | `inventoryEvidence`、`snapshotEvidenceFiles`、`createEvidenceReferences` | 显式文件/目录成员、排除目录、引用及复核；不发现业务输入 |
| `lib/verification/outcome.mjs` | `verificationOutcome`、`summarizeVerificationStages` | 显式必选检查全部为true才通过，不推断完整业务验收 |
| `lib/verification/lease.mjs` | `acquireFileLease`、`validateFileLeaseDeclaration`、`abandonFileLease` | 私有注册目录、具名排他锁、永久used marker；不抢旧锁，不探测/关闭资源 |
| `lib/verification/runner.mjs` | `runVerification`、`inspectVerificationRun` | 新证据根、显式输入/产物/独立检查、租约和只读复核，无自动重试/续跑 |
| `lib/verification/callbacks.mjs` | `assertVerificationCallback`、`settleVerificationCallback` | 拒绝generator/thenable；同步值先捕获，原生Promise实际settle后才判完成 |
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

公共runner在spawn前独占保留三份证据文件；显式env不继承调用者环境，记录envKeys而不记录值。secret只在内存中匹配，跨chunk、重叠及EOF前缀在落盘前脱敏。超时/取消只监督本次创建的直接子进程和原进程组，不认证故意脱离该组的任意后代；预期SIGKILL成功还需已验证callback实际定向发送信号。计时采用单调时钟；新回执的事件ISO时间由启动墙钟加单调偏移构造，不受运行中校时倒退影响，也不冒称结束时系统墙钟读数。清理预算耗尽后撤销pipe写入再关闭描述符。callback必须让出事件循环；未settle的异步callback会被撤销，阻塞后逾期返回也会失败，但无限同步循环不能由同线程timer抢占。

### 独立项目的可选闭环

[随包提供的Catalog示例](../../../scaffold/verification-project/README.md)将业务输入、builder、独立预期/checker与运行配置分开；安装后无需银行checkout，也不复制银行生命周期脚本。

`runVerification`接收新的`directory`、`plan`、`lease`、受信任`action`与具名`verify`函数。plan明确合同id/version、输入文件与目录排除、实现文件、产物全集和`processCount`（默认0）。运行器先持有协作锁，再捕获输入，执行action，将结果与产物交给必选verifier，复核输入/产物，等待自身进程和回调，再归还锁并封存回执。它不自动判断builder或verifier语义，不追踪未声明import；调用者负责列出完整依赖并提供独立oracle。

进程只能通过`runProcess`显式请求，数量须符合plan；实际执行/环境/profile属于调用者选择，进程receipt描述实际调用，不等于编译器或业务测试认证。外部资源不由该串行runner管理。action/checker是受信任的进程内函数，必须settle，不能绕过接口开启无人管理的后台任务。取消不会把未结束工作当已结束；退出不明保留锁文件，`abandonFileLease`仅关闭自身句柄，不恢复、删除或接管锁。

`inspectVerificationRun`必须另外接收调用者的plan和只读verifier，不能从回执选择代码。它检查私有证据根、sealed元数据、输入/目录成员、产物全集、used marker及进程证据，再调用独立只读verifier；不重新执行action、不探测旧PID、不抢锁、不改报告。运行器不会在已经释放租约后自动再调用verifier。发布给读者的摘要只有固定诊断和检查结果，不复制action值、日志或异常消息；原件仍为私有证据。

文件清单默认没有排除目录。银行adapter显式保留sbt三个产物目录例外和手写根无例外规则。银行旧build进程回执仍是原`-f`调用合同，不能套用公共`-p`进程schema或冒称已迁移整个sbt runner。协作锁不是内核资源预留，所有共享图写者仍需协调同一个project key；未参与者不受保护。

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

`tooling`变体对应上述公共机制，`bank-p23`变体对应银行政策与编排。公共协作租约、库存/引用、结果运算与串行验证闭环已实施；完整旧build监督器、工作坊其余阶段、Docker资源适配及现役crash/browser历史政策依赖仍未全部拆分。银行仍P23，完整service的新读库replay失败、人工会话未执行；保留原90秒门槛和失败证据，业务retry/backoff/deadline保持OPEN。本次不升级R2、不增加超时、不改变oracle，也不授予最终模板或业务批准。

- `js:lib/verification/files.mjs` — `captureEvidenceFile`。
- `js:lib/verification/process.mjs` — `runVerifiedProcess`、`inspectProcessEvidence`。
- `js:lib/verification/worker-evidence.mjs` — `validateWorkerLifecycle`。
- `bank:tools/truthsrc-runtime-process.mjs` — `runRuntimeProcess`。
- `bank:tools/truthsrc-worker-evidence.mjs` — `inspectRuntimeWorker`。
- `bank:tools/verify-truthsrc-build.mjs` — `admitCandidate`。
- `bank:tools/bank-workshop-verification.mjs` — `inspectService`。

银行的来源、全部工具职责和构建顺序在其`docs/BUILD-RECIPE.md`与`docs/architecture/TOOLING-OWNERSHIP.json`，不复制成公共金融政策。完整revision、摘要及来源清点处置见[sources.lock.json](../sources.lock.json)；清点不是生产运行认证。

### 类别依赖

`artifact-manifest`、`code-provenance`、`independent-business-oracle`。这些是职责依赖，不代替真实import或执行顺序验证。
