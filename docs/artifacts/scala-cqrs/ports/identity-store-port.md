# 身份存储端口

类别：`identity-store-port`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

把身份存储操作从认证controller/流程中隔离，不把凭据、数据库driver或默认放行藏在接口层。

## 输入与人工信息

身份查找/建立的参数、权限边界、错误与秘密处理合同由安全设计提供。

## 生产与所有权

本页已定位的是di-poc的维护接口IdentityStoreApi及同文件UserDoc，物理位置为kernel，root实现/绑定另行提供。它是参考profile的手写接口能力，不是BC或JS由作者树自动生成身份存储实现的证据；接口存在也不表示存储、安全或完整签名闭包已验收。

按profile解释接口、实现、放置和生命周期，见[能力矩阵](../../CAPABILITY-MATRIX.md)。当前实例遵守手写维护边界，不能经生成副本覆盖；本轮仅校准文档，不声明编译、认证流程运行或最终批准。

## 结构与命名

IdentityStoreApi虽保留infrastructure包名，但物理在kernel；包名不自动决定模块所有权，当前实现旁挂root。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

root通过BootstrapModule把接口绑定IdentityStore，签名不能反向依赖实现类。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

重复身份/冲突/不可用/错误凭据与数据隔离，配置引用与真实秘密分离。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：di-poc的手写参考接口。kernel是此实例的实际物理位置，不表示所有profile自动具有身份存储端口或递归类型闭包。

- `dipoc:modules/kernel/src/main/scala/net/imadz/metarch/infrastructure/auth/IdentityStoreApi.scala` — `IdentityStoreApi`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。
