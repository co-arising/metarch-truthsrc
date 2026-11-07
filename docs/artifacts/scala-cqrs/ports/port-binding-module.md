# 端口绑定与组合根模块

类别：`port-binding-module`。本页属于版本化产物说明目录；源码名称、包位置和运行保证按下面的适用变体解释。

## 职责

在外层把接口绑定到实际实现，避免kernel接口引用glue/ext类。它是独立artifact职责，不能因只有几行bind而遗漏。

## 输入与人工信息

接口/实现配对、生命周期、eager/fail-fast语义由技术装配决定；缺依赖不能静默选择默认实现。

## 生产与所有权

由列出的生产者/实现提供。BC的Scala结构与JS最终写入者必须一起判断；同文件后续JS覆写时，最终台账行归最后写入者。当前银行兼容profile只按实际已有产物标识，不由旧文档推定能力。

目录状态：`partial`；所有权：`mixed`。生成文件通过公共生成/更新通道维护；独立手写实现不是生成结果的可编辑副本。

## 结构与命名

root BootstrapModule/RepositoryBindingModule，部分现由手写脚本或补丁添加。当前不是BC全部原生生成的完整装配模型。

类型使用UpperCamelCase，成员使用lowerCamelCase；数据库、protobuf和稳定业务ID分别遵循各自合同。描述目标命名不授权改写现有wire名称、PID或冻结载体。

## 依赖与装配

root依赖kernel/glue/ext；生成接口不含反向@ImplementedBy。允许纯同层Bridge的toInstance，外部实现to绑定。

## 回锚与更新

有业务知识输入的产物关联相应展开节点与最终源码位置；共享机制只关联其技术合同，不伪造业务来源。BC历史inline注释和JS外置同图映射分开解释；本批不恢复JS新增inline @knowledge。手写映射只是显式实现关系，不自动证明语义或精确span。

## 验证

所有接口都有唯一适用绑定、缺失/重复/错误实现拒绝、启动顺序与关闭行为；补丁幂等不等整套生成完备。 文档覆盖、代码编译与业务运行是不同证据；只有实际执行对应检查才可以报告通过。

## 版本与实例

机器目录按各适用变体分别记录可用性/所有权，不能把一个变体的implemented传播到其他profile。

适用：bc-multi / di-poc。单模块和多模块是放置/装配变体，不是两套业务事实。BANK P23兼容层与BC目标模板可能保留具名差异；没有把R2运行库能力写成当前银行生成支持。

- `dipoc:app/net/imadz/modules/BootstrapModule.scala` — `bindings`。
- `dipoc:app/net/imadz/modules/RepositoryBindingModule.scala` — `RepositoryBindingModule`。
- `bc:tools/multi_project_repo_bind_patch.mjs` — `MODULE`。

来源的完整revision、文件摘要及清点处置在根目录的`sources.lock.json`；本页摘录不是生产认证。

## 装配示例

```scala
bind[ConceptDeltaAdjudicator].to(classOf[ConceptDeltaResolver])
bind[ContentFingerprintPort].toInstance(ContentFingerprintBridge)
```

这是实际root BootstrapModule的绑定形状，省略了FQN。第一项实现位于ext，第二项Bridge是合法纯实现；不能把这两种情形都变成kernel内的静态实现依赖。

### 类别依赖

`extension-implementation`、`port-bridge`。这些是职责依赖，不代替真实Scala import或执行顺序验证。
