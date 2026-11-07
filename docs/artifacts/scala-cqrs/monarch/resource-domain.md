# 资源域准入与占位协调

类别：`resource-domain`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

管理一个静态独占资源域的bundle、grant、释放与占位转移。Queued不是Granted，不承诺跨独立资源系统原子事务。

## 输入与人工信息

容量、reservation/owner身份、不可变需求、有限上限和证据validator由宿主配置。

## 生产与所有权

`monarch-r2`消费运行库的ResourceCoordinator/Admission机制，责任为`consume-library`。容量、owner/reservation身份和释放/转移证明是应用数据与实现，不由协调器自动决定。

本类别未建立JS/BC原生R2业务producer；银行仍为P23，不能由资源域库源码存在推断已生成或采用R2银行资源政策。

逐profile与证据级别见[CAPABILITY-MATRIX.md](../../CAPABILITY-MATRIX.md)。应用证明需独立验收，默认安全拒绝不是业务完成认证。

## 结构与命名

ResourceCoordinator/Protocol/State/Settings与AdmissionPort是库构件；Reserve/Release/Transfer各自持久提交。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

释放/转移校验token、owner与证据，timeout/Unknown不释放资源；Transfer必须收到新的Granted，不能把旧Released当成功。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

全获批或全不占用、同ID异请求、重复release/transfer、shared holder与容量满域反例。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

ResourceCoordinator属于R2扩展，不属于R1或当前P23采用面。测试源码不等资源行为验证；应用证据政策单独验收，本页不授予最终批准。

- `monarch:src/main/scala/net/imadz/monarch/persistence/resource/ResourceCoordinator.scala` — `ResourceCoordinator`。
- `monarch:src/main/scala/net/imadz/monarch/persistence/resource/ResourceAdmissionPort.scala` — `ResourceAdmissionPort`。

来源revision、摘要及处置见[sources.lock.json](../../sources.lock.json)；银行仍冻结P23、未采用R2。

### 类别依赖

`resource-evidence-policy`、`monarch-wire-settings`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
