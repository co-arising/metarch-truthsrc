# 端口绑定与组合根模块

类别：`port-binding-module`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在外层把接口绑定到实际实现，避免kernel接口引用glue/ext类。它是独立artifact职责，不能因只有几行bind而遗漏。

## 输入与人工信息

接口/实现配对、生命周期、eager/fail-fast语义由技术装配决定；缺依赖不能静默选择默认实现。

## 生产与所有权

BC tools/multi_project_repo_bind_patch.mjs是独立补丁写入者：读取已有kernel projection Repository、glue实现及root RepositoryBindingModule，在GraphProjectionRepository绑定锚点处补入view repository绑定。它不创建完整模块，跳过带@ImplementedBy的接口，缺实现或锚点会失败；当前gen_pipeline没有自动调用这一步的已定位链路。

di-poc的BootstrapModule/RepositoryBindingModule是已有维护源码，混合来源应精确到文件区域；不能由补丁存在推断所有接口均自动绑定，延时/配置注释也不证明启动就绪。

各profile只记录已支持的部分装配责任，见[能力矩阵](../../CAPABILITY-MATRIX.md)。这不是完整原生binding-module生成器，也不是本轮运行、编译或最终批准。

## 结构与命名

root BootstrapModule/RepositoryBindingModule，部分现由手写脚本或补丁添加。当前不是BC全部原生生成的完整装配模型。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

目标依赖方向为root依赖kernel/glue/ext，接口不反向@ImplementedBy；raw BC Repository/Connector模板的现存注解债另行保留，不由本补丁自动消除。允许纯同层Bridge的toInstance，外部实现to绑定。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

所有接口都有唯一适用绑定、缺失/重复/错误实现拒绝、启动顺序与关闭行为；补丁幂等不等整套生成完备。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

主要实例：bc-multi的独立补丁与di-poc已有root模块。完整模块生产和自动pipeline集成仍未由当前来源建立，不能以部分bind写入证明整套装配完备。

- `dipoc:app/net/imadz/modules/BootstrapModule.scala` — `bindings`。
- `dipoc:app/net/imadz/modules/RepositoryBindingModule.scala` — `RepositoryBindingModule`。
- `bc:tools/multi_project_repo_bind_patch.mjs` — `MODULE`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

### 装配示例

```scala
bind[ConceptDeltaAdjudicator].to(classOf[ConceptDeltaResolver])
bind[ContentFingerprintPort].toInstance(ContentFingerprintBridge)
```

这是实际root BootstrapModule的绑定形状，省略了FQN。第一项实现位于ext，第二项Bridge是合法纯实现；不能把这两种情形都变成kernel内的静态实现依赖。

### 类别依赖

`extension-implementation`、`port-bridge`。这些是职责依赖，不代替真实Scala import或执行顺序验证。

### 第二批独立模块候选

`scala-cqrs-modular-candidate-v1`新增独立Parcel参考及纯目标合同，属于reference-only，不是现役生成入口。Root constructor composition selects the repository, bridge and flow. 结构、兼容差异及资格见[目标合同](../TARGET-PROFILES.md)；真实编译/行为结果单独记录，不把参考升级为生成器或最终金样。

### 第五批有限module-seams候选

ParcelModule显式构造repository、条件Bridge及flow，公开create(routes)(implicit executionContext): QuoteFlow；不猜资源工厂/全局EC，不把ext实现名写入kernel。 该显式产品链与旧BC/legacy/ref-only变体并存，不互相继承资格。生成源码经唯一writer回锚；外置实现仅独立file级来源，不能认证任意symbol/span。完整说明见[有限多模块接缝](../MODULE-SEAMS.md)。

## 第七批 Strict Saga / Monarch R2 生成入口

新增 `js-saga-monarch-r2-candidate-v1`，由 `scala-cqrs-saga-monarch-v1` 提供。此前“未建立原生生成”的描述保留为原基线，不能覆盖本段明确的新非银行入口。

- `application-root`：Typed construction of captured external providers and Run Leaves/Hosts, caller-owned lifecycle and finite authorized recovery/resume of original batches.

输入来自唯一作者树与显式技术/外置实现 bindings；运行库接口及内核仍由冻结制品提供。implemented 表示生成实现存在；资格仅由匹配实际输入的独立验收决定，旧28回执不改签。范围、两阶段恢复、重试耗尽与安装边界见[本族合同](../../SAGA-MONARCH-R2.md)。不表示银行迁移或架构批准。
