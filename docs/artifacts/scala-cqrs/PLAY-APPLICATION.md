# 有限 Play CQRS 应用生成合同

入口：`scala-cqrs-play-application-v1`；manifest target：`scala-cqrs-play-application@1`；catalog profile：`js-play-application-candidate-v1`。这是第八批非银行 Warehouse-lite 应用入口，复用 family1/2/4，不是旧 P23 Play service profile 的重命名，也不是任意家族自动组合器。架构最终批准仍为 `approval:null`。

## 唯一作者与十产品

复制已安装工具的 `scaffold/play-application-project/` 到新的自有目录。`truthsrc.project.json` 是入口，`truth/play-application/` 是唯一知识修改面。它包含原 Reserve/Commit 领域事实及 `formal-products/api-contract/warehouse-api.formal.yaml`。禁止手改生成的 canonical、request、Scala、ledger 或 anchors。

产品版本：reference-layout@1、exact-value-types@1、exact-value-codecs@1、domain-decision@4、domain-dependencies@6、domain-folds@6、domain-external-events@2、persistence-readside-contract@1、api-contract@1、application-composition@1。

API atom 明确关联 command parameter、event slot 和已有 Receipt/by_resource 索引。binding 只能由它完整派生，不能用“相同 digest”代替完整比较。单聚合、最多16个命令、每命令一个事件或空成功、一个已有 state-map 查询；string/boolean/canonical Long-string 及兼容 nominal 标量载体。任意 SQL、嵌套 DTO、隐式 command、未知 effect/类型或额外 external producer 均不支持。

`bindings/persistence.json` 固定 wire/store 身份；`bindings/application.json` 固定版本、配置键、资源/PID映射和构造 ABI。两份外置实现是计算端口 ReservationIdentity 与配置 Authority。它们作为独立文件捕获，始终在生成账本之外。Authority 的 synthetic capture ref 仅用于技术关联，source 指向 application binding；它不声称作者声明了同名领域 port。

每次作者编辑必须 validate **AND** roundtrip 双绿。JSON Schema 只描述结构；引用解析、完整覆盖、路径碰撞、UTF-8字节上限和跨字段关系仍由严格 compiler 检查。

## 使用公共链

在复制的项目目录运行：

```sh
truthsrc validate --tree truth/play-application
truthsrc roundtrip --tree truth/play-application
truthsrc compile-project --project truthsrc.project.json
truthsrc generate-project --project truthsrc.project.json --out generated --plan
truthsrc generate-project --project truthsrc.project.json --out generated
truthsrc verify-project --project truthsrc.project.json --out generated
truthsrc query-project --project truthsrc.project.json --out generated --file conf/routes --line 2
```

实际链为 tree → 严格 products → KnowledgeGraph/AST → 完整 plan → 单 writer → 最终字节回锚。raw `generate-products` 不可绕过 live implementation capture。作者、binding、实现分别进入 freshness；变更后先 `--update --plan` 再受控 `--update`。无变化再生为零源码写；跨 owner、非 MANUAL 修改和孤立 MANUAL 块拒绝。

`verify-project` 只证明来源/生成/回锚一致，不执行 JVM，不是运行资格。移址后的绝对外置源码根需要重新 capture/generate，不能搬旧回执冒 fresh。主样例完整 project plan 为64项，其中4项为派生项目证据；账本和 anchors 由 writer 另写。实际数量以新完整 plan 为准。

## HTTP 合同

| 入口 | 行为 | 权限 |
|---|---|---|
| POST `/api/v1/warehouses/:warehouseId/reserve` | ReserveSkuQuantity | operator＋resource＋CSRF |
| POST `/api/v1/warehouses/:warehouseId/commit` | CommitSkuReservation | operator＋resource＋CSRF |
| GET `/api/v1/warehouses/:warehouseId/receipts` | H2完整keyset分页 | reader或operator＋resource |
| GET `/warehouses/:warehouseId/receipts` | 相同查询的Twirl页面 | 相同读权限 |
| GET `/ready` | 无敏感详情的readiness | 无领域访问 |

- body上限65536字节；拒绝重复/未知/缺失/null字段、重复query、多个JSON根、超过64层嵌套、错误媒体类型及非法UTF-8。
- quantity是canonical十进制字符串，不是JSON number；范围为Long。零/负数由原领域guard处理，不凭API另造库存规则。
- 字符串上限按well-formed UTF-8字节检查，合法补充平面字符可接受。path/result字段执行其声明上限，违规实现输出不能作为成功响应返回。
- 200区分`applied`与`no-change`。422领域拒绝；400/401/403/404/413/415分别处理输入、认证、授权、缺失及body限制；503未ready/依赖失败；504为`outcome-unknown`且不自动重发；500为脱敏的实现错误。
- Actor确认没有journal sequence，因此不返回虚构watermark，也不保证返回时读侧已可见。
- 默认20、最大64行。cursor包含version/resource/mapKey/pidKey，canonical base64url编码；拒绝跨resource和非canonical cursor。无OFFSET/join。
- HTML由Twirl转义，包含空状态和下一页链接，无客户端JS。设置no-store等响应头。此证据不认证浏览器布局、交互或可访问性。

领域仅记录reservation identity及commit receipts，Reserve空fold，Commit记录txid，已提交txid可空成功。没有库存余额、完整reservation状态机或跨仓事务；不暗加“Commit前必须Reserve”。

## 模块与供应

kernel仅包含领域/API数据与平台无关端口；glue依赖kernel并拥有actor/query/journal/HTTP codec/Authority；ext可依赖kernel/glue，仅承载捕获实现；root组合三者并包含controller/routes/Twirl/Loader与资源所有权。命令与查询端口分别使用`application-service-port`和`query-service-port`类别。

固定验证供应：JDK11、Scala2.13.14、sbt1.4.9、Play2.8.18、Akka2.6.20、ScalaPB0.11.14、sbt-protoc1.0.6、Twirl1.5.1、H2 2.2.224、纯Java LevelDB0.12、Guava30.1.1-jre、CommonsCodec1.15。Play JSON/Twirl有独立版本，不能按Framework版本强行对齐。构建工具Scala2.12闭包与应用Scala2.13分开。

生成器基本Node流程无需JVM。构建生成应用需要明确的依赖供应；没有隐式下载冻结制品、替换JAR、启动共享服务或容器。生成build真实执行`compile`及`Test / compile`；独立分模块direct compiler是另一项门，不互相冒替。

## 存储与生命周期

真实LeveldbReadJournal读取Frame/PID/sequence；保留实际序号并校验event role、版本、layout与注册serializer。不是从H2事件缓存反读冒journal，也不是从Actor回复自行编号。最多8个显式resource/PID关联，未知PID/毒事件/gap拒绝，不排序补洞或跳过。查询取得的是反序列化Frame重新规范编码的字节，不声称获取LevelDB物理原始记录。

fresh与existing-only显式区分。existing journal要求CURRENT与非空MANIFEST实物；旧H2不能冒新读侧，重建用独立新H2路径。资格覆盖正常关闭后重开及从原journal新建读侧，不覆盖强杀断电、Mongo/MySQL、集群或无限流。

配置和source准入完成、首次发现与追平后才Ready。Closing/Failed不会被迟到回调重新打开。每次取得资源即登记；close拒新请求、排空已接受请求，然后逆序释放runner/source/repository/domain runtime/pool/executor。runner维持5000毫秒drain；应用总关闭预算固定10000毫秒，不逐阶段重置。阻塞释放在独立、有界清理执行器上，不被业务阻塞线程池饱和吞掉；到期明确报告失败。无法强制中断任意外置阻塞代码，未完成清理不能称为drained。Play HTTP runtime与领域runtime分别拥有，初始化失败也清理已取得资源。

运行时必须显式配置`warehouse.journal/readside/namespace/freshJournal/freshReadside/credentials`。credential行包含token/csrf/id/roles/resources；示例认证不是OIDC平台。生成配置没有默认生产密钥，不能直接用于公网部署。

## 验收边界

独立reference、实际generated、离线安装后main及真实名称/包变体使用相同HTTP oracle，只适配模型已核对的ABI。记录真实sbt、独立compiler、实际classpath/JAR/POM/CodeSource、源码/实现/配置/断言清单与process evidence；不信receipt.passed自证。

失败与控制覆盖包括Authority503/500、ask超时后仍落事件且不重发、Unicode分页、资源排空/饱和/迟到Ready、部分初始化、错Frame/serializer/source/sequence、旧库冒新库、角色/resource/CSRF移除、routes/Twirl签名及kernel反向依赖。负控必须是指定失败，不把缺依赖、任意exit1或进程超时算通过。

验收仅使用新独占`127.0.0.1:0`服务及本机client。Darwin Seatbelt的tcp4 localhost策略不等于OS严格限定127.0.0.1；实际绑定还由固定程序和listener核验约束。无共享应用、银行P23、runtime发布或Git提交/推送授权。最终事实与机器证据另见[验收记录](../PLAY-APPLICATION-ACCEPTANCE.md)。
