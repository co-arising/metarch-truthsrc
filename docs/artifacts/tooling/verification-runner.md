# 验证运行器与证据报告

类别：`verification-runner`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

执行隔离的构建/测试/服务窗口并保存真实输入、进程、退出/停止和结果证据；不是业务compiler。

## 输入与人工信息

候选/供给、固定suite、owner租约/端口/存储与具体场景由调用者提供；不能为消红修改oracle。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`implemented`；所有权：`handwritten`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

银行当前tools中的机制与银行硬编码混合，尚需P1归属拆分；此文档不把58个mjs写成已从truth生成。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

通用机制应归公共可选runner，银行留adapter/场景/供给；基础source CLI不应强制Docker/JDK。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

输入漂移、timeout/取消、子进程回收、脱敏、停止原件和失败回执封存；无法执行明确阻断不伪造pass。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bank-p23 / tooling。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `bank:tools/verify-truthsrc-build.mjs` — `admitCandidate`。
- `bank:tools/truthsrc-runtime-process.mjs` — `runRuntimeProcess`。
- `bank:tools/bank-workshop-verification.mjs` — `inspectService`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`artifact-manifest`、`code-provenance`、`independent-business-oracle`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
