# 全部八批生成器主线整合

2026-11-11：将完整execution-compiler-v1历史与main独有的按聚合端口配置整合；不是只cherry-pick第八批。

保留main的aggPorts映射与端口并集，保留现役strictEntries、单例协调器和journal事件源启动接线。三项定向bootstrap测试及原run-all/Fab/money回归13/13通过。

生产delta只含bootstrap-dsl/emit.mjs和run-all.mjs。原第八批36观察及旧catalog/source lock按字节[历史化](evidence/capability-mainline-prior36-history.json)，新mainline观察由公共生成器实际再生12纯样例、4Saga样例与2Play样例，逐项对账同语义输入及完整非build源码，并核原进程/oracle/依赖/已记录classes。观察数、类别与能力层级不扩张；新复制build只有generated。

没有重签旧回执或重跑未变JVM。原第八批4345项全量及安装修复的真实状态仍见[第八批验收](PLAY-APPLICATION-ACCEPTANCE.md)；本次主线合并不是新增全量/JVM资格。approval:null，银行迁移与运行库发布不在本次操作内。
