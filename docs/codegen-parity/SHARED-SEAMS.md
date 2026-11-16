# 公共接缝合同：命名、类型、模型、writer 与回锚

最后更新：2026-11-16。状态：**第一阶段接口规格草案，供各制品diff统一依赖；未实现、未运行、未批准所有profile迁移。**

这不是另起一个通用编译框架。复用当前公开工具与已存在的命名/计划/写入机制；仅把逐制品并发所需的共享合同定清。每项变更仍需对应内容规格审定；不修改原始Scala参考或公共业务表达schema。

## 1. 已存在接口与不能直接复用的地方

| 接缝 | 固定实现 | 已有能力 | 本次尚缺/需保留的区别 |
|---|---|---|---|
| Scala TypeRef | [TypeSystem.scala L4–85](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/TypeSystem.scala#L4) | `name/packageName/typeParams`；`fqn`、短`signature`、递归`collectAllDependencies`、`shouldImport`；FieldDef完整槽 | 并未实现通用冲突alias管理；原型中nested owner有历史差异，不能照名字猜物理嵌套 |
| Scala Model基类 | [ArtifactModel.scala](baseline/bc/src/main/scala/net/imadz/codegen/scaffolding/cqrs/ArtifactModel.scala) | selfType/dependencies/registerTo/morphisms/noteIds | 不是只有字符串content；各族仍有自己的字段和源码槽例外 |
| Scala命名 | [NamingConventions.scala](baseline/bc/src/main/scala/net/imadz/codegen/structure/NamingConventions.scala) | 按制品角色派生名、有限后缀剥离、关键字转义 | strictSymbol仍hyphen→underscore；getBaseName是固定列表顺序非通用词法；不能假称传统链全都满足最新命名目标 |
| Scala布局 | [PackageLayout.scala](baseline/bc/src/main/scala/net/imadz/codegen/structure/PackageLayout.scala) | domain/application/infrastructure及其职责子包；controllers框架根 | 原`$base.modules`与用户三层要求冲突，需要显式覆盖，不改raw副本 |
| JS名称解析 | [naming.mjs L77–118](baseline/js/lib/scala-target/naming.mjs#L77) | resolveName/resolveNameSet/resolveArtifactPath、稳定身份、作用域/便携冲突检查 | 冗余suffix会**拒绝**，不是自动去重；显式binding被认为完整名字，不再拼affix |
| JS profile | [profiles.mjs](baseline/js/lib/scala-target/profiles.mjs) | legacy-compatible与modular-candidate；sourceRoot、模块依赖及stableIdentities | 两个现有profile都不能直接当新经典内容合同：legacy保留domain Actor facade；candidate根module为src/main/scala且approval=null |
| JS结构模型 | [model.mjs](baseline/js/lib/scala-target/model.mjs) | values/ports/components/bindings、依赖图、纯计算限制、结构命名与文件碰撞 | rolePackages含`.domain.ports`/`.application.ports`/`.composition`；不能原样称符合BC细目录或三层约束 |
| JS产品计划 | [product-plan.mjs](baseline/js/src/core/product-plan.mjs) | 精确products/producer版本、两次计划一致、deps完整、禁止路径别名和`???` | 不可为复制Scala raw stub关闭这些守卫；需外置实现/不支持诊断或单独仅用于raw比对的资产，不假成功 |
| JS唯一apply | [generate.mjs L134–268](baseline/js/src/core/generate.mjs#L134) | capture/preflight、MANUAL策略、ownership、final bytes、ledger、anchors | recheck不是锁/事务/回滚；旧路径RETAINED不自动删除；重布局不能指望apply静默清旧文件 |

## 2. `shared-layout-types`：名字与真实类型所有权

### 2.1 复用的命名调用合同

```text
resolveName({
  profile,
  knowledgeId,
  scope,
  space,
  spelling,
  binding,         // null 或完整的目标名
  prefix: [],
  suffix: []
})
  → {...输入, profile, name, identifier}

resolveNameSet({profile, names: [...上述去掉profile], reserved: [...]})
  → 已解析名称数组，顺序对应输入；碰撞/保留名显式拒绝

resolveArtifactPath({profile, module, packageName, typeName})
  → module.sourceRoot + '/' + packageName路径 + '/' + typeName + '.scala'
```

这是当前API签名，不是本轮新增函数。各Builder向单一集成者提供spelling与角色要求，不能自己replaceAll/拼后缀。

- knowledge/sql/protobuf/wire/persistence/operation/codec空间是明确稳定身份；禁止binding/prefix/suffix改变它们。
- 以`BankService`加`Service`会触发冗余affix拒绝。集成者应按已定业务名/角色确定完整`BankService`binding，或从真正的base name派生；不能在每个template加不同的去重正则。
- 类型与文件名用PascalCase，成员用lowerCamelCase，保留关键字必要的反引号。自动词法不支持的名字需要显式绑定，不猜音译或默默重命名稳定ID。
- raw Scala的特定值名/strict旧名与目标不同，逐diff记录有限覆盖；不宣称字节全等。

### 2.2 类型记录的最小内容合同（拟定，不是现有API）

各JS族Model应能表达与Scala `TypeRef`相同的`name`、真实owner/package、类型参数，以及字段的name/type/default/comment/note/description。以下是**语义要求**，不是允许agent各造一套同名库：

1. 名义身份与源码拼写分离；成员嵌套owner精确到实际输出容器，例如`CreditBalanceEntity.CreditBalanceState`。
2. `fqn`用于登记与身份，`signature`用于源码；必须保留泛型/tuple/Option/Map等递归结构。
3. 文件级依赖先收集完整引用，再生成imports；不先删同包依赖导致拓扑/回锚信息丢失。
4. 同名冲突在完整文件作用域内处理；正常类型使用简名，有限alias或FQN只为消歧。不能全局通配import绕过声明缺口。
5. 类型只在真实定义处注册一次。Event的实际owner是Entity直接成员时，不能注册到不存在的`EventFamily` companion。
6. Model里的default/body字符串只允许raw Scala明确拥有且已逐字段登记的槽；不得将整文件装进content冒充结构化Model。
7. 无法从作者/技术绑定取得类型、回复或默认值时拒绝该工作包的执行；不落Any、null或猜测金融默认。

接口函数名、扩展记录编码与profile id在完整diff依赖收口后由**一个集成者**决定。此文不添加公共业务表达字段，不修改另一工作区的唯一公共设计。

### 2.3 布局矩阵

所有A使用其diff指定子目录；B逐logicalOutput指定目标。共同规则：

- 应用Actor协议/root → `application.aggregates`；Helper/Behavior → `application.aggregates.behaviors`；Factory → `.factories`；Repository port → `.repository`。
- State/Events → `domain.entities`；纯事件应用 → `.entities.behaviors`；纯规则 → `.invariant`；领域服务 → `.services`。
- 具体Repository/adapters/converters/connector → `infrastructure`的对应BC子包；DI/Play Loader/生命周期装配不能放进纯application service。
- 框架顶层`controllers`在业务根包外保留；业务根下不造`.service`/`.web`/`.integration`/`.composition`第四层。
- 单/多工程物理sourceRoot分别对账；不为了复用MODULAR_CANDIDATE就把原single输入变成multi，然后称路径一致。

## 3. `shared-expression-rendering`：表达式的内容与求值合同

这不是创建万能业务解释器。保留现有领域产品的类型化表达式与事实来源，模板只负责相应Scala语法：

| 必须支持的变化 | 保护条件 |
|---|---|
| `!(!p)`还原正向Boolean条件 | p的类型与求值次数明确；不跨越有副作用/抛错的未知节点，不用最终源码regex |
| 运算符必要括号 | 使用结构化优先级/结合性，短路`&&/||`与比较/成员访问不改变含义 |
| Long常量可读输出 | 从准确十进制/类型记录渲染，不经过JS Number；边界值与负号正确 |
| State.copy直接具名赋值 | 所有field RHS仍按原事件应用合同读取旧state；需要单次求值/跨字段依赖保留具名局部值 |
| 抽取具名纯决定 | 不把CommandHelper、ActorRef、I/O或时间偷放领域；独立oracle不得复用被测决定实现 |
| 业务分组降低复杂度 | 不用String/Any表、反射、helper1/helper2碎片或删校验刷CC |

优先复用当前AST与有限renderer。任何新的source expression节点属于工具链接口变更，需回到公共owner，不在银行文档里暗造schema。

## 4. `shared-entry-writer`：完整文件计划到真实字节

### 4.1 当前entry字段（源码事实）

`product-plan.mjs:8–58`验证以下entry：

```text
path, content, kind, deps, knowledgeIds, productFootprint, merge
optional: codeMappings
```

- `path`是canonical相对路径，不能指向`truthsrc.ledger.json`/`anchors.json`；路径按NFC+lowercase检查碰撞。
- `kind`属于当前producer声明；deps要在同一个完整plan中实际生成。
- knowledgeIds非空且唯一；productFootprint等于完整声明输入版本序列；当前产品入口要求merge=null。
- `content`不能含`???`；两次独立detached计划必须一致。

**下游要求**：Builder输出结构 → 文件assembler/template一次组装全部成员 → 命名/import/排版完成 → 返回final content与精确映射 → 原有plan验证 → 原有apply。不能由每个A分片单独调用writer写同一个文件。

### 4.2 共享物理文件的迁移

1. A/B分区记录每个construct及其目标owner，包括imports、初始化、生命周期和B辅助成员。
2. 集成者持有旧→新路径/FQN/成员清单；各域agent只交回明确的新模型/模板，不同时修改`render-domain.mjs`等热点。
3. 先在完整plan中消除未迁移deps与重名；不先删旧协议导致正式银行仍指旧domain carrier。
4. apply对旧owned路径只报告RETAINED，不负责自动退役：迁移策略须显式核调用方、所有权与旧文件用途，不能用rm或手改ledger清理。
5. 新生成候选放明确新target；旧银行current、冻结37候选、shared apps及手写实现保持不动。
6. 预览和apply的文件capture/recheck不构成跨进程独占承诺。Zcode/peer漂移只阻断受影响工作包，告知用户，不覆盖。

## 5. `shared-source-mappings`：格式与回锚顺序

[src/core/code-mappings.mjs](supplemental/js/src/core/code-mappings.mjs)是本轮补读的28行当前源码，原852快照未含该文件；已另存准确字节并记录在[补充source索引](supplemental/index.json)，不改变原基线。当前规则为UTF-8 **byte** span，不是JS字符下标：

- `validateCodeMappings(entry)`：mapping字段只允许knowledgeKey/span/scope；knowledgeKey必须在entry.knowledgeIds；span和scope均有start/end/text，精确匹配生成字节，span在scope内部；重复knowledgeKey/start/end拒绝。
- `finalMappingSpan(mapping, generated, finalBytes)`：相同字节直接返回span；MANUAL合并后仅当scope文本在finalBytes唯一且相对span精确匹配时重定位，否则返回null。
- `generate.mjs:91–104`：有精确span才产位置；无span退为文件级位置。**文件级fallback不能冒充用户需要的成员级回锚已通过。**

因此：

1. 不对已经计算span/fingerprint的输出再次格式化。
2. 无意义别名/壳删除会改变construct owner，必须显式搬移多对一/一对多的知识映射，不丢原作者身份。
3. MANUAL区不唯一或被编辑造成span失配时诚实报告降级/阻断，不拿旧offset继续指向新文件。
4. 两次同输入稳定生成、一次字段/规则局部变更的公开query→代码定位都是未来实际接口验收；本轮源码阅读不代替它们。
5. 不新增`@knowledge`作者字段，现有mapping按既定作者树/编译派生来源维护。

## 6. 并发门与真正未决项

| 接缝 | 主owner | 何时可让下游并发 |
|---|---|---|
| 命名/profile/package/TypeRef/import | 集成者 | 新profile与字段合同、冲突诊断、raw→target覆盖表已定 |
| 共用表达式/状态渲染 | 集成者；领域组给需求 | purity、求值顺序、常量和映射合同已定，共享写集合已切开 |
| registry/manifest/project入口 | 集成者 | 所有消费者入口已登记，依赖版本与输出kind不漂 |
| final byte assembler/writer/ledger/anchors | 集成者 | 完整路径迁移、MANUAL/retained处理与知识映射方案明确 |
| 单制品Model/Builder/Template | 分组owner | 自己的diff已审定，引用上述已定接口，不跨组改热点 |
| 手写行为实现/独立BDD/oracle | 业务实施owner | 用例与port合同明确；不归模板覆盖所有权 |

仍需明确的内容，而非由文档存在即视为完成：

- 新经典single/multi profile如何与两个现有profile并存，哪些旧接口保留为明确兼容入口。
- 原Scala裸signature/nested owner缺陷的有限修正与raw资产分离。
- 各A需要的行为实现槽如何接入公开工具链，而不是关闭产品计划的`???`拒绝门。
- public source mappings面对MANUAL合并的成员级降级如何报告和验收。
- 重布局对持久化源码名/serializer类名的影响与非自动退役策略。
- 圈复杂度度量工具/版本/口径尚未固定，本轮只能记录目标与内容观察，不能报告虚构CC。

以上为可审定接口规格，不批准新运行库发布、不改公共业务表达schema，也不运行银行会话38或旧workshop。
