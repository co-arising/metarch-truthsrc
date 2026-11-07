# 从信息到产物：构建顺序

这不是过去开发批次的复演表。目标是让新项目明确“先给什么信息、哪一步由公共工具加工、哪里还需人实现”。不同项目只选实际适用的profile，不强制银行样例的所有组件。

## 1. 知识与独立预期先行

人/agent形成业务语言：聚合边界、命令/事件、约束、TCC参与者、流程、角色、读模型、界面与未知状态。业务政策和关键预期由owner确认；编译器检查结构/能力，不凭自然语言猜金融行为。独立oracle不能从待验实现反推。

## 2. 显式选择技术

项目配置与bindings选择包、single/multi布局、运行库/profile、精确类型/codec、存储、外部port、身份和部署引用。版本、实现对象和秘密引用分开；真实秘密不是真源字段。

通用默认/展开规则属于公共工具，业务项目不应复制58份银行mjs。未受支持能力拒绝，不能以脚本私自补canonical或偷偷读取旧快照。

## 3. 编译与知识图

作者文件经宏/微语法确定性展开、validate/roundtrip及严格语义产品编译；保存原作者来源。完整知识快照写入默认本地SQLite图，经领域存储端口导出AST。Codegen真正消费该AST，不另走旧树补规则。

canonical、完整request、编译产品和图是派生表示，不是另外三份作者输入。根旧formal-inputs只是历史运输模板，不是新人必写阶段。

## 4. 按依赖生成代码

1. 领域VO、消息/事件、状态和规则参数。
2. 纯规则、event fold、纯计算/应用port及其签名闭包。
3. 应用Protocol/Behavior/Factory、Repository接口。
4. 选定Saga/Monarch Definition/host/plan和明确技术端口；运行库内核作为依赖，不重复生成。
5. PB/Converters/Serializers/Adapters、Repository实现、投影Schema/Handler/Runner。
6. 服务/Controller/Routes/Loader、根绑定与build/config。
7. 生成测试、provenance/manifest及最终写入与回锚。

这张依赖表不是所有producer的实际固定执行顺序。BC是Scala结构后由JS写最终行为/投影/API/DDL/测试；JS正式producer由产品合同控制依赖。一个文件可被不同阶段写入，最终字节与最后写者必须记入证据。

## 5. 补齐真正开放的实现

业务算法、外部TA/设备协议、认证、DTO/读侧业务组合、页面体验和必要宿主实现，由人/agent依据已生成port和独立预期完成。实现应位于ext/外置源码根，不手改生成区。

若一段内容已可由显式声明确定加工，就应回流公共producer，而不是每个项目手工复制；有算法/真实外部信息缺口则如实列出，不以“有来源mapping”声称可自动重建。

## 6. 组合、回锚、分层验收

root绑定真实实现；公共writer保护MANUAL/领地并核最终源码span，锚回同一知识图。执行源码/编译/固定测试/真实服务/恢复与人工体验分别验收，任一道失败不得拼接历史通过。

后续修改从作者输入或明确手写面开始，先识别过期，再preview/update；不通过手改canonical、ledger、anchors或生成Scala绕过生产链。

当前完整银行服务仍有新读库replay阻断；材料公开渠道与真人上手也未签收。artifact目录补齐不会自动关闭这些门，更不等于银行已消费Monarch R2。
