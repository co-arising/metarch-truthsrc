# 来源、版本与许可

目录说明是对现有架构职责的整理，不复制整个应用或运行库。每页列出的`repo:path`与symbol由`sources.lock.json`关联到基线revision/文件摘要；有工作树改动时记录overlay，不用HEAD冒当前字节。生成源码、旧ledger、业务源与runtime不会为文档一致而改写。

| repo别名 | 仓库 | 基线 |
|---|---|---|
| js | metarch-truthsrc | fb58d31622350bb1b7dd7576062999990b11fd24 |
| bc | backkend-codegen | 13c151b8e5e9a707b23a5e678229b5d8b9219e8c |
| play | playAkkaCQRS | 8ab0fb1eef1c（完整值在来源锁） |
| dipoc | di-poc | 7d6feacda153fdf3bca243e0258cf6873c151c0f |
| bank | bank-wealth-demo | 5d6217f5caf9121ea0043193f5b2896fcfe51386 |
| saga | saga-core | 4352a3173ee4e812762dcaa9c1aad58ff1551417 |
| monarch-core | monarch-core | 376b15282576fb3090cbc4fa0dbc059932e587b7 |
| monarch | monarch-persistence | 985aaa5923a3ed05d27849bb01667c100d949b31 |

BC/Play原artifact说明作为历史输入，在中央目录中重新组织和修正。兼容副本在原路径可离线读取，附中央版本/摘要；本地源码引用不是已经发布的Release/npm URL。

JS仓为MIT许可。BC、Play、Saga、Monarch的源码和旧文档按各自Apache-2.0许可解释，本目录保持来源归属；没有把它们重新授权为MIT应用源码。新编写的说明、索引及工具遵循本仓许可，引用的接口/类型名称及简短签名保留原项目归属。若未来引入完整代码片段或第三方材料，必须同步保留对应LICENSE/NOTICE，而不能因文档集中管理删掉原许可。

`coverage.json`中的scope只覆盖所列版本/根目录与明确关联来源，报告候选/类别/文件/producer数量分别计数。支持状态不从历史测试数字自动继承；本地检查、外部源重验和实际业务验收分别报告。
