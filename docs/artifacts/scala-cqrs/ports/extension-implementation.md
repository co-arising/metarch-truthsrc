# 手写扩展实现

类别：`extension-implementation`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

承载公共工具无法仅凭既有声明确定的业务算法、外部适配和用例实现。Agent编写不等于可由真源确定性再生。

## 输入与人工信息

人/agent补充的算法、外部协议或业务选择需要来源与独立预期；可机械化部分应后续回流公共工具。

## 生产与所有权

di-poc以ext中的ConceptDeltaResolver、RegisterUserFlow为维护实现；bank-p23则以handwritten/scala中的BankSipApplication、MockTAClient为外置手写实现。两者各有业务合同与依赖，不能把di-poc路径作为银行profile的来源，也不能将银行单项目结构说成已采用ext模块。

生成器可生成所需端口或载体，不拥有这些算法/适配体；独立手写文件不是生成文件的可编辑副本。各profile的手写责任与参考/当前生命周期见[能力矩阵](../../CAPABILITY-MATRIX.md)。源码关联不表示本轮业务测试、目标编译或最终批准。

## 结构与命名

di-poc的ext实现kernel port，可消费glue机制，root仅注入；银行当前以外置handwritten/scala维护实现，不假定同名ext模块。文件包名可保持旧值，不以物理迁移强制改公开FQN。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

多模块目标只允许ext依赖kernel/glue，不形成glue到ext循环；银行外置源码则按实际依赖与组合根核对。各profile的手写与生成写入领地都须严格隔离。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

实现合同/替身/独立业务oracle与组合验收，来源map仅证明显式关联。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：di-poc参考实现与bank-p23当前外置手写实现。两者的来源和物理模块分别解释，不以POC的ext位置推定银行已采用同样布局。

- `dipoc:modules/ext/src/main/scala/net/imadz/metarch/domain/service/ConceptDeltaResolver.scala` — `ConceptDeltaResolver`。
- `dipoc:modules/ext/src/main/scala/net/imadz/metarch/application/RegisterUserFlow.scala` — `RegisterUserFlow`。
- `bank:handwritten/scala/example/bankwealth/sip/BankSipApplication.scala` — `BankSipApplication`。
- `bank:handwritten/scala/example/bankwealth/bindings/MockTAClient.scala` — `MockTAClient`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 类别依赖

`computation-port`、`application-flow-port`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Handwritten application implementation using injected route repository and capacity policy. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。

### 第五批有限module-seams候选

DefaultQuoteFlow在外置ext源码，由root明确注入repository、capacity及EC；不解析任意方法体，不计作JS生成算法。 该显式产品链与旧BC/legacy/ref-only变体并存，不互相继承资格。生成源码经唯一writer回锚；外置实现仅独立file级来源，不能认证任意symbol/span。完整说明见[有限多模块接缝](../MODULE-SEAMS.md)。
