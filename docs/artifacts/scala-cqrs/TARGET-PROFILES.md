# Scala目标profile、命名与参考质量合同

版本：`truthsrc.scala-target/v1`。本合同落实[第二批](../STATUS-AND-IMPLEMENTATION-PLAN.md#第二批固定目标profile命名规则和独立参考)，不是新增generator manifest或现役生成开关。实现是公共纯模块`lib/scala-target/`；所有现有生成入口、项目作者schema、银行代码及冻结身份保持原样。调用者必须显式选择合同，不按领域、文件名或银行名字推断。

## 两种目标，不能混为一次迁移

| 合同ID | 用途 | 当前资格 | 自动生成入口 |
|---|---|---|---|
| `scala-cqrs-legacy-compatible-v1` | 描述现有公开载体与完整Scala名字的保护边界 | compatibility-contract；不是推荐新结构 | 无新入口，仍使用原生成器 |
| `scala-cqrs-modular-candidate-v1` | 新项目四模块、纯领域和显式端口的推荐设计候选 | candidate；`approval:null` | `generator:null`，未接入生成器 |

`targetProfile(id)`返回不可变描述。未知/省略ID失败；语义product版本、运行库版本、ArtifactType目录变体与这些目标合同不是同一身份。`buildTargetModel`仅接受modular candidate，不能用它重新解释旧银行结构。当前catalog给新参考登记`reference-only`变体，未增加现役JS应生成分母或最终批准数量。

兼容合同保留domain Actor入口/facade、旧Entity/Protocol载体别名、具体本地Repository及显式完整名字。命名API要求传入既有完整绑定，例如`bank_cash_payment_v1Execution`，不模仿每个旧renderer算法，也不暗中改名。它不是对所有旧代码的架构豁免或迁移器。银行State/Event/Request/Reply、PB字段与号码、PID、serializer ID/manifest、codec pin、操作身份及金融规则继续冻结。

## 名称不是业务身份

`resolveName`要求以下完整输入；返回原身份、原spelling、解析后的`name`和仅适用于Scala的`identifier`，不修改调用方数据：

```js
resolveName({
  profile: MODULAR_CANDIDATE,
  knowledgeId: 'source:parcel#/commands/quote',
  scope: 'example.parcel.application.ports',
  space: 'scala-type',
  spelling: 'HTTP-quote',
  binding: null,
  prefix: [],
  suffix: ['Request']
}); // name: HttpQuoteRequest
```

- **知识ID**是原字符串/原引用元组；不会由Scala名字回推或重新铸造。`space:knowledge`要求spelling与knowledgeId完全一致。
- **类型**使用UpperCamelCase；**成员**使用lowerCamelCase。推荐自动词法只接受ASCII字母起始、字母/数字/空格/下划线/连字符；按大小写边界拆词，缩写统一为普通单词：`HTTPServer → HttpServer/httpServer`，`HTTP2Status → Http2Status/http2Status`。
- **Unicode作者名称**保留原字节，需要显式ASCII目标绑定；不自动音译、不丢字、不把NFC归一化写回知识。包括全角、重音与无大小写文字；无法自动解释的名字明确拒绝。
- **显式binding**是最终完整的未转义目标名，不能再拼prefix/suffix。兼容合同可保留旧下划线和大小写；推荐合同仍检查UpperCamel/lowerCamel的有限ASCII形式。绑定可以表达有意缩写，不强迫改变有意义的业务词。
- **前后缀**先与原词组组合，最后才检查关键字。`type + Protocol → TypeProtocol`，成员`type → \`type\``；禁止先转义再拼成`\`type\`Protocol`。相同技术词缀不静默去掉或重复：`BankService + Service`拒绝，要求明确完整binding。
- **包**来自显式小写分段绑定，不从业务ID/显示名自动slug化。空段、关键字、路径符号和便携文件系统保留名拒绝。不同context不能收敛到同一目标package。
- **SQL、protobuf、wire、persistence、operation、codec**是显式稳定字符串，禁止binding/前后缀或大小写加工，返回`identifier:null`。这里只检查字符串形状和原字节保留，**不认证SQL/Proto语法、后端保留字、编号、迁移或序列化正确性**；相应schema/codec门仍是权威，未声明值不由类名推导。

输入经既有`copyImmutableData`分离、冻结；访问器、Proxy、循环、未知字段等拒绝，访问器不被执行。不更改作者文件的`slug()`、既有`symbol()`或当前renderer。

## 冲突与放置

`resolveNameSet({profile,names,reserved})`对整组解析后名字检查，不按输入顺序加数字后缀：

1. 名称唯一性在显式scope和space内成立；诊断保留两个冲突身份。不同scope允许同名，结构模型另检查context包收敛。
2. 类型/包和最终物理路径按NFC及不区分大小写的便携键检查，原名字不改变。`a-b/a_b`、`URL/Url`及大小写文件别名不能产生两份覆盖对象。
3. Scala成员使用真正区分大小写的符号键；`fooBar`与`foobar`可并存。关键字保留名须传未转义的`name`，不得传反引号`identifier`。
4. 结构模型拒绝继承final JVM成员`wait/notify/notifyAll/getClass`作为方法或值访问器。这个有限profile不支持这些名字的重载例外，显式改用不冲突binding；其它生成API保留名由调用者按scope声明。不是完整Scala语言重载/编译器检查的替代。
5. `resolveArtifactPath`从选定module的源根、显式包及文件stem构造规范相对路径，不读取文件。兼容root为`app/`，新root为`src/main/scala/`，其它模块为`modules/<module>/src/main/scala/`。最终writer的路径、所有权、UTF-8回锚检查仍不可省略。

同一参考文件可以包含多个值类型；`fileStem`必须显式声明，不能拿类别/模型数冒文件数。模型允许显式值组共享同一精确路径；不同大小写路径别名或组件/port共享路径仍拒绝。一个值类型只有一份定义，不复制“kernel版VO”和“glue版VO”。

## 新推荐结构模型的有限语法

`buildTargetModel`输入schema为`truthsrc.scala-target-model/v1`，输出不可变结构数据，不输出Scala方法体/模板文本，也不执行写盘或回锚。输入字段只有`schemaVersion/profile/contexts/values/ports/components/bindings`。

- `values`：正式`{context,kind,owner,id}`类型引用，显式spelling/binding/module/fileStem。record包含具名fields；sum包含具名variants及每个variant的完整fields，不允许用opaque类型掩盖出现在错误结果中的外层依赖。
- 类型沿用正式primitive/nominal/optional/sequence/map引用语法，并在这个目标模型内明确增加`either(left,right)`。不是修改业务schema。primitive string/boolean/integer/decimal在后续目标模板合同对应String/Boolean/Long/BigDecimal；不支持的tuple、函数、任意外部类型、递归名义类型必须拒绝而不是退回Any。
- `ports`：kernel中的computation/flow/repository；methods具有具名parameters和`{effect,valueType}`结果。effect只有pure/future，纯计算port不得声明future。每个参数、结果、record字段、sum分支字段和嵌套容器都参与递归签名闭包，名义引用必须存在且归kernel。
- `components`：显式角色、module、所实现port、具体组件dependencies、注入所需requires端口。拒绝模糊role类型、未知依赖、方向错误、组件/注入循环及缺失实现。这里只验证声明关系，不声称扫描或证明任意手写方法体的纯度。
- `bindings`：每个port恰好一个root选择，目标必须声明实现该port。不能把`implementedBy`藏到kernel声明中；有接口但缺绑定不算完整模型。构造参数/实现签名最终仍需真实Scala编译。

| module | 允许依赖 | 参考职责 |
|---|---|---|
| kernel | 无项目外层依赖 | 值、闭合错误类型、纯计算、port；应用边界允许Scala Future |
| glue | kernel | read-only存储adapter/框架机制；本参考无框架依赖 |
| ext | kernel、glue | 手写可替换应用flow/adapter，只通过接口消费依赖 |
| root | kernel、glue、ext | 唯一具体组合根与生命周期选择 |

pure-implementation和同层bridge在kernel；bridge必须指向一个kernel纯实现，不得焊接ext FQN或消费effectful port。adapter可在glue/ext，extension在ext，composition在root。算法和金融政策仍由作者/业务owner提供，不能从签名推导。已有di-poc具有包保留与框架依赖，不据此宣称它已满足本候选的全部纯度要求。

## 独立参考与设计依据

- 原[Warehouse聚合参考](../../../test/reference/aggregate-layers/)七份源码保持原样，覆盖当前兼容载体及Actor行为；不把重复运行或改目录算新设计。
- 新[Parcel模块接缝参考](../../../test/reference/module-seams/)为独立手写候选。只读路线表、重量/容量计算和报价flow足以区分计算port、Repository port、应用flow、同层Bridge、外置实现及root绑定，不引入新银行业务。它不是另一份可编辑业务canonical，也不替代未来作者树/产品编译消费。
- BC成熟Scala的`NamingConventions`、`PackageLayout`与`TypeResolverDSL`提供集中职责/解析依据；沿用设计分工，不抄其去后缀、Any fallback或未实现方法为新标准。精确来源在source lock的BC结构/Scala producer清单。
- di-poc `build.sbt`、FlowPorts、ConceptDeltaAdjudicator/Resolver与RepositoryBindingModule提供具体依赖倒置依据；它的生成mjs、SQL flow/阻塞机制或kernel框架依赖不是新参考oracle。**BC mjs仍不在用户认可的金样范围。**

新参考包含10份生产Scala源码、3份独立测试源码。结构测试比较明确路径/声明/签名和完整值闭包；它是本参考的窄形状核验，**不是任意Scala AST或行为等价解析器**。真实编译按module独立classpath实施，不把所有源码一次混编来掩盖外层依赖。纯规则及替身flow测试不需要Akka、银行JAR或数据库。

## 最终质量门与本批终点

本批结束条件是合同可执行、新参考独立编译/行为通过、保护与安装成立；不是任何模板已最终“完美”。后续每个category × 目标合同 × producer版本必须分别满足：

1. 输入与所有权、稳定身份和未决业务信息明确，未知能力拒绝。
2. 成熟依据或独立参考有来源；candidate与最终owner批准分别记录。
3. 模型无语法拼接；集中类型/命名、模块依赖、完整port签名和开放手写点成立。
4. 先独立反例/预期，后模板；真实编译、适用纯行为/Actor/codec/投影/恢复测试逐门验收，不拼接不同样例的证据。
5. 完整最终writer、所有权更新、确定性、UTF-8 spans和同图正反查成立，不恢复新增inline `@knowledge`。
6. 安装后的非银行样例和适用的新银行兼容候选消费成立；本批没有后者的新code/service回执。
7. 有真实独立审阅及架构owner裁定。`approval:null`不能通过自动测试、catalog登记或此文档变为approved。

[批次验收](../TARGET-PROFILE-ACCEPTANCE.md)记录实际执行；[能力矩阵](../CAPABILITY-MATRIX.md)继续只统计实际producer证据。新参考的编译/行为不嫁接为现役生成器的compiled或final-approved。完整service replay、R2、retry/backoff/deadline及真人上手保持独立未完成门。
