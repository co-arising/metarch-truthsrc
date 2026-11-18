# aggregate-rules-formal · Scala curated候选 v1

**状态：候选，尚未获得金样认可。** 本包是独立手写的库存预留／确认规则和真正ScalaCheck性质源码；没有JS生成器修改，没有编译或性质执行。静态审查不等ScalaCheck通过，计划批准不等该版本金样批准。

## 1. 这份代码要说明什么

传统formal规则的稳定边界是：

```scala
State × Params → Either[iMadzError, List[Event]]
```

它不接收Actor command，不负责持久化、回复、发布或恢复。原Builder解析了所有事件却仅保存首个事件，因此本候选明确以两事件成功批次揭示并避免该缺陷。原raw参考及34族限定接受不修改；本包不能补签原八族公开Scala raw oracle。

样例是**新定义的小库存规则**，不是银行金融算法，不是库存完整应用，也不是旧Lot参考的业务移植。技术输入[technical-input.json](technical-input.json)完整登记新政策、错误原文、类型、事件slot序、身份格式、合法域和来源。

## 2. 完整源码阅读顺序

生产源码只需四个文件：

1. [ReservationValues.scala](app/example/stockreservation/domain/values/ReservationValues.scala)：六种名义值，不用type alias合并不同身份；ID验证是构造前提，非法输入不被转换成业务拒绝。note允许Unicode、引号、反斜杠和换行。
2. [StockReservationEntity.scala](app/example/stockreservation/domain/entities/StockReservationEntity.scala)：不可变State、StoredReservation和sealed事件族。这里只提供规则所需领域类型，没有Actor、protobuf或生产EventHandler。
3. [ReservationIdentity.scala](app/example/stockreservation/domain/services/ReservationIdentity.scala)：具名纯计算端口及完整长度前缀实现，没有未完成算法、时间、随机数、I/O或service locator。
4. [StockReservationRules.scala](app/example/stockreservation/domain/invariant/StockReservationRules.scala)：唯一Rules owner，内嵌payload-only Params、六种封闭拒绝、预留class和确认object。

性质与独立参考：

5. [StockReservationCases.scala](test/example/stockreservation/reference/StockReservationCases.scala)：具名联合场景、真实Gen/Shrink、独立前提和严格减小度量。
6. [StockReservationOracle.scala](test/example/stockreservation/reference/StockReservationOracle.scala)：独立code/message记录、完整typed事件期望、计算调用观察和测试专用状态投影。
7. [StockReservationProperties.scala](test/example/stockreservation/reference/StockReservationProperties.scala)：真正Properties、定向分支、完整批次／异常／边界／shrinker性质、十三种具名负对照。
8. [FormalGuardExamples.scala](test/example/stockreservation/reference/FormalGuardExamples.scala)：单列技术例，使用BigInt验证money-positive/money-sufficient，不代表库存政策或银行余额算法，也不冒称raw MoneyOps ABI。

业务根包只有实际需要的domain；不存在的application/infrastructure目录不预造。测试包独立，不为了躲布局创建无package源码。

## 3. 两条规则逐步讲解

### 预留：先决定，再计算，再构造完整事件

`ReserveUnitsParams`仅含requestId、sku、quantity、locations及locationNotes。State另传；纯依赖由构造器注入，不塞进Params。

```scala
final class ReserveUnitsRule(identity: ReservationIdentity)
    extends InvariantRule[StockReservationEvents, StockReservationState, ReserveUnitsParams]
```

检查顺序是业务合同，不排序：

|序|失败条件|结果|
|---:|---|---|
|0|quantity ≤ 0|QuantityNotPositive|
|1|requestId已有预留|RequestAlreadyReserved|
|2|任何location未登记|UnknownLocation|
|3|SKU不存在或可用数量不足|StockUnavailable|

全部通过后，identity仅求一次；它的结果被两个事件共享：

1. `UnitsReserved(requestId, reservationId, sku, quantity, locations, locationNotes)`
2. `ReservationReceiptIssued(requestId, reservationId)`

返回有序List，不能headOption、排序、去重或只比较第一个事件。Params中的嵌套`Option[Map[LocationId, Vector[ReservationNote]]]`不折叠，None和Some(empty)不同。

预留重复是**拒绝**，不是幂等空成功：只凭requestId存在无法证明重试载荷一致。本样例不猜未知请求的补偿／账务策略。

数量只是当前可用库存的比较，不在decision里扣库存。locations是成员覆盖，空向量通过，重复项保留，不当作数量累计。这些取舍由技术输入明确提供，不从现实仓库流程泛推。

### 确认：身份验证必须先于幂等

1. `reservations.get(requestId)`为空：ReservationMissing。
2. 已有记录但reservationId不同：ReservationIdentityMismatch。
3. 身份正确且request已确认：`Right(Nil)`。
4. 否则返回一个ReservationConfirmed。

安全lookup只求一次；没有先用`.apply`访问缺key。错误身份即使request已确认也必须拒绝，不能提前空成功。确认无计算依赖，用object足够。

### 错误模型

`ReservationRejection`是本包封闭ADT，六个错误的code/message逐条来自新技术输入。`iMadzError`本身是final case class，故通过`toError`适配，不继承它，不悄悄换成String。

业务拒绝和技术故障分开：规则没有catch依赖异常。如果纯端口实现违反其合同而抛出异常，该原异常传播；绝不洗成Left、Right(Nil)或假回执。只有测试观察器捕获它以断言对象身份。

## 4. 身份算法为什么不含隐藏副作用

`LengthPrefixedReservationIdentity`按warehouse、request、sku、quantity顺序产生四段，每段为`十进制长度:原值`，带版本前缀：

```text
stock-reservation:v1|2:WH|2:RQ|2:SK|2:17
```

ID域为有限ASCII，数量为规范Long十进制。长度前缀防止`ab/c`与`a/bc`的简单拼接碰撞。完整实现是普通Vector/map/mkString；没有哈希、时钟、随机UUID或读取状态。

这是此样例的新身份格式，不是把旧receipt规范重写。公开端口是纯能力合同；OO构造注入允许测试检查何时及用何参求值，但不表示任何实现天然纯。实际接入需独立审查其实现。

## 5. 性质如何避免“自己证明自己”

测试生成联合场景，不先任意生成再大量过滤。分支标签给出独立预期，前提用set difference、BigInt库存差及状态关联检查，不复制生产if链。code/message独立写成记录，expected不调用生产错误adapter。成功期望使用测试端口独立sentinel，不调用实际identity实现计算expected。

|性质|可发现的缺陷|
|---|---|
|完整结果／事件载荷／顺序／调用实参|丢第二事件、反序、错参数、重复计算、Some-empty→None|
|每个拒绝分支和多失败定向场景|首错顺序改变、缺SKU被默许、某分支一直没生成|
|throwing计算依赖|拒绝时提前求值、异常被吞、异常对象替换|
|正确身份后的确认幂等|已确认的错误身份被空成功掩盖|
|Long和BigInt固定边界|Long极值/精度丢失、>=错成>、恰好足够不通过|
|空／重复／缺首尾location|forall误成exists、错误非空条件、去重损失payload|
|嵌套Option及特殊文本定向性质|None与Some(empty)折叠、文本／空向量被丢|
|identity独立固定向量及解码|字段顺序错误、分段歧义、隐藏非确定性|
|shrinker closure|缩小后变成功或换失败类别、断开关联ID、自身缩小循环|
|十三个typed负对照|证明相同观察断言预期会拒绝代表性错误，而非只检查happy path|

ScalaCheck的Gen/Shrink/Properties是真实规格，不是手写随机for循环。固定边界性质里的有限Vector只登记确定的边界，不伪装随机检查。

`Prop.collect`收集场景分布；每分支／Option／集合类别另有定向性质。统计比例门未实现／未执行，不能据源码存在声称覆盖率。未来建议workers=1、固定seed740001/740002/740003、混合性质至少1000成功样本；这些只是待供给准入时核实的执行合同。

采样不是对整个合法域的穷尽证明：数量用全signed Long区间，身份用合法ASCII字符与1..64长度；备注覆盖0..256长度的代表性字符、固定特殊Unicode文本，历史记录数量取0/1/2/4、备注向量取0..5，金额另取最多512随机输入bit（加一后结果可达513bit）与固定极值。合法域可以更大，未采到的形状不能说已经验证。定向样本包含完全无历史的State、未登记位置作为opaque备注键，以及正数量下“重复请求＋未知位置”的首错交集。

独立静态首审提出上述两个规格缺口，本候选补充了联合生成、定向性质和三个对应负对照；不是生产运行失败，也不把补源码说成已杀死mutant。

### Shrink为什么联合重建

recipe重建整套State/Params，同步改变相关ID。数量失败缩到0；不足联合缩到quantity=1/stock=0；成功保持充足并保留恰好／有余量类别。缺location保留缺失witness；确认保留缺失／不同／已确认类别。None、Some-empty、Some-nested与空／重复／缺首尾集合模式不互相塌缩。

每个候选严格降低BigInt度量，杜绝self-shrink；同时保留opaque备注键类别、历史／向量的0/1/many类别。独立identity性质同样使用具名IdentityCase与显式Shrink，只截取非空ID首字符，不让默认String shrinking缩成非法空ID。closure性质检查前提与类别，但它也尚未运行；没有把静态设计当作缩小器执行证明。

## 6. 负对照与执行事实

十三个test-local typed错误实现：丢第二事件、反序、提前求identity、重复求identity、吞异常、重复检查先于数量、确认先于身份、严格大于库存、exists覆盖、Some-empty折叠、location先于重复、过滤opaque备注键、强加历史预留前提。

它们复用同一完整观察断言，没有源码文本替换、production mutation或通用mutation engine。目前每个killed/survived为**NOT_RUN**。

|证据层|当前事实|
|---|---|
|技术输入／完整手写Scala／ScalaCheck规格|本包提供，可逐源码阅读|
|独立静态审阅|在review-status单列记录，不是编译或性质PASS|
|Scala编译／类型闭包|NOT_RUN|
|ScalaCheck性质／负对照|NOT_RUN|
|每方法CC自动测量|NOT_MEASURED|
|真实Helper／Actor／持久化／回复／codec接线|不属于本包验收，未执行|
|用户对该版本金样认可|PENDING|
|对应JS生成器|NOT_STARTED|

## 7. 外部依赖与D1–D8取舍

CommonTypes是冻结源码签名证据，实际artifact供给没有在本包准入。不复制同包stub、不publishLocal、不升级runtime消除缺口。Scala目标2.13.14；ScalaCheck1.18.1只是候选坐标，JAR/POM/传递依赖/API未准入，未运行。既有共享jvm-toolchain未修改，当前不能直接追加ScalaCheck。

|差异|此候选处理；不是原raw变更|
|---|---|
|D1多事件|完整有序List，显式两事件性质|
|D2递归类型／imports|独立Scala值/嵌套OptionMapVector具名闭包；未来JS必须递归解析，不在这里写resolver|
|D3错误及文本|新技术输入逐条提供message；payload保留特殊文本，不按错误码编旧业务故事|
|D4计算依赖|class构造注入具名纯端口，payload Params不混hosts；成功臂一次|
|D5Helper/规则准入|没有伪造回复/Helper；未来class实例接线需要另验|
|D6真实供给|NOT_ADMITTED，不用源码副本冒称artifact可用|
|D7不安全输入|固定技术合同完整审阅、非法snapshot/ID域明确；不实现metadata validator或静默skip|
|D8路径／共同owner|仅独立单工程app/domain候选；不修原multiProject或抢另一族生成文件|

预留规则的四个guard本身构成短if/else链，确认的lookup分支和三条短臂各有明确职责。没有靠万能分发表藏分支。CC阈值仍须按固定工具逐方法测量，当前不编造数值或用全项目平均替代。

## 8. 版本与下一道门

[manifest.json](manifest.json)列完整payload文件path/bytes/SHA-256、来源身份和bundle算法，包含本讲解。manifest不自哈希；[review-status.json](review-status.json)记录manifest自身hash和bundle绑定的审阅/执行/用户状态，不参与payload摘要。

所有生产源码、性质、技术输入或讲解的改动都会改变bundle；已有认可不能自动延伸到新bytes。**用户认可该具体bundle和manifest身份后，才开始对应JS；计划批准不能替代它。**

本轮只制作与讲解候选，不借已结束verify窗口运行编译／性质，不恢复最后5／57、不改raw34状态、不推进剩余七族。真实质量执行需要另列该族供给、入口、写面与停止预算。
