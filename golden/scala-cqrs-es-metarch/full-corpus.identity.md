# truthsrc 全语料恒等报告（V4-5·切流拍板输入·非拍板本身）

- 日期：2026-10-15；live 参照：`/Users/zhongdj/Workspaces/ingested-app`（新鲜度门：backend-codegen `tools/kn_repo_freshness.mjs` exit 0·锚 8948/元素 2861 全 match）；canonical：`golden/scala-cqrs-es-metarch/full-corpus.canonical.json`（27 聚合）
- 范围：三面 19 kind（skeleton 8－共享 2＋rules 7＋api 6；共享 Behaviors/CommandHelpers 按 live 管线序归 rules 面所有）。storage/persistence/Bootstrap/ExecutableSpec/投影/AggregateStateApi/Auth/conf/routes 等**未移植面不在对表范围**（EP 不搬清单＋顺延批）。

## 头条数字

| 判定 | 件数 |
|---|---|
| identical | 236 |
| owned-by-other | 108 |
| diff | 49 |

**恒等按面**：skeleton 102 · rules 102 · api 32 ｜ **diff 按 kind**：aggregate-root 2 · protocol 1 · entity 3 · command-helpers-rules 10 · rules 7 · rule-params 10 · rules-spec 16

## live 归属普查（按文件首行 stamp·多趟管线真相）

| live stamp（生成器） | 文件数 |
|---|---|
| rules_domain_gen:2026-08-23 | 216 |
| CodegenMain:a0fca3da | 108 |
| gen_api_layer:2026-08-26 | 47 |
| CodegenMain:2026-08-23 | 11 |
| rules_domain_gen:2026-09-05 (S2-44) | 10 |
| CodegenMain:66b5b602 | 1 |

## 逐件明细（393 rows）

| face | kind | aggregate | live path | 状态 | diff@line |
|---|---|---|---|---|---|
| skeleton | aggregate-root | CemEdge | app/net/imadz/metarch/application/aggregates/CemEdgeAggregate.scala | identical | — |
| skeleton | protocol | CemEdge | app/net/imadz/metarch/application/aggregates/CemEdgeProtocol.scala | identical | — |
| skeleton | aggregate-root | Concept | app/net/imadz/metarch/application/aggregates/ConceptAggregate.scala | identical | — |
| skeleton | protocol | Concept | app/net/imadz/metarch/application/aggregates/ConceptProtocol.scala | identical | — |
| skeleton | aggregate-root | Context | app/net/imadz/metarch/application/aggregates/ContextAggregate.scala | identical | — |
| skeleton | protocol | Context | app/net/imadz/metarch/application/aggregates/ContextProtocol.scala | identical | — |
| skeleton | aggregate-root | ContextRelation | app/net/imadz/metarch/application/aggregates/ContextRelationAggregate.scala | identical | — |
| skeleton | protocol | ContextRelation | app/net/imadz/metarch/application/aggregates/ContextRelationProtocol.scala | identical | — |
| skeleton | aggregate-root | DoR | app/net/imadz/metarch/application/aggregates/DoRAggregate.scala | identical | — |
| skeleton | protocol | DoR | app/net/imadz/metarch/application/aggregates/DoRProtocol.scala | identical | — |
| skeleton | aggregate-root | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/FieldModelDefinitionAggregate.scala | identical | — |
| skeleton | protocol | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/FieldModelDefinitionProtocol.scala | identical | — |
| skeleton | aggregate-root | FsmDefinition | app/net/imadz/metarch/application/aggregates/FsmDefinitionAggregate.scala | identical | — |
| skeleton | protocol | FsmDefinition | app/net/imadz/metarch/application/aggregates/FsmDefinitionProtocol.scala | identical | — |
| skeleton | aggregate-root | KnowledgePatch | app/net/imadz/metarch/application/aggregates/KnowledgePatchAggregate.scala | identical | — |
| skeleton | protocol | KnowledgePatch | app/net/imadz/metarch/application/aggregates/KnowledgePatchProtocol.scala | identical | — |
| skeleton | aggregate-root | ModelCatalog | app/net/imadz/metarch/application/aggregates/ModelCatalogAggregate.scala | diff | 21 |
| skeleton | protocol | ModelCatalog | app/net/imadz/metarch/application/aggregates/ModelCatalogProtocol.scala | identical | — |
| skeleton | aggregate-root | Note | app/net/imadz/metarch/application/aggregates/NoteAggregate.scala | identical | — |
| skeleton | protocol | Note | app/net/imadz/metarch/application/aggregates/NoteProtocol.scala | identical | — |
| skeleton | aggregate-root | OrganizationMember | app/net/imadz/metarch/application/aggregates/OrganizationMemberAggregate.scala | identical | — |
| skeleton | protocol | OrganizationMember | app/net/imadz/metarch/application/aggregates/OrganizationMemberProtocol.scala | identical | — |
| skeleton | aggregate-root | Project | app/net/imadz/metarch/application/aggregates/ProjectAggregate.scala | identical | — |
| skeleton | protocol | Project | app/net/imadz/metarch/application/aggregates/ProjectProtocol.scala | identical | — |
| skeleton | aggregate-root | Question | app/net/imadz/metarch/application/aggregates/QuestionAggregate.scala | identical | — |
| skeleton | protocol | Question | app/net/imadz/metarch/application/aggregates/QuestionProtocol.scala | identical | — |
| skeleton | aggregate-root | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/ReadModelDefinitionAggregate.scala | identical | — |
| skeleton | protocol | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/ReadModelDefinitionProtocol.scala | identical | — |
| skeleton | aggregate-root | Relation | app/net/imadz/metarch/application/aggregates/RelationAggregate.scala | identical | — |
| skeleton | protocol | Relation | app/net/imadz/metarch/application/aggregates/RelationProtocol.scala | identical | — |
| skeleton | aggregate-root | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/RoleCommandBindingAggregate.scala | diff | 21 |
| skeleton | protocol | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/RoleCommandBindingProtocol.scala | diff | 47 |
| skeleton | aggregate-root | Session | app/net/imadz/metarch/application/aggregates/SessionAggregate.scala | identical | — |
| skeleton | protocol | Session | app/net/imadz/metarch/application/aggregates/SessionProtocol.scala | identical | — |
| skeleton | aggregate-root | Stage | app/net/imadz/metarch/application/aggregates/StageAggregate.scala | identical | — |
| skeleton | protocol | Stage | app/net/imadz/metarch/application/aggregates/StageProtocol.scala | identical | — |
| skeleton | aggregate-root | Subdomain | app/net/imadz/metarch/application/aggregates/SubdomainAggregate.scala | identical | — |
| skeleton | protocol | Subdomain | app/net/imadz/metarch/application/aggregates/SubdomainProtocol.scala | identical | — |
| skeleton | aggregate-root | Tenant | app/net/imadz/metarch/application/aggregates/TenantAggregate.scala | identical | — |
| skeleton | protocol | Tenant | app/net/imadz/metarch/application/aggregates/TenantProtocol.scala | identical | — |
| skeleton | aggregate-root | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/TruthSourceProvenanceAggregate.scala | identical | — |
| skeleton | protocol | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/TruthSourceProvenanceProtocol.scala | identical | — |
| skeleton | aggregate-root | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/UseCaseDefinitionAggregate.scala | identical | — |
| skeleton | protocol | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/UseCaseDefinitionProtocol.scala | identical | — |
| skeleton | aggregate-root | User | app/net/imadz/metarch/application/aggregates/UserAggregate.scala | identical | — |
| skeleton | protocol | User | app/net/imadz/metarch/application/aggregates/UserProtocol.scala | identical | — |
| skeleton | aggregate-root | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/ValueObjectDefinitionAggregate.scala | identical | — |
| skeleton | protocol | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/ValueObjectDefinitionProtocol.scala | identical | — |
| skeleton | aggregate-root | WorkTicket | app/net/imadz/metarch/application/aggregates/WorkTicketAggregate.scala | identical | — |
| skeleton | protocol | WorkTicket | app/net/imadz/metarch/application/aggregates/WorkTicketProtocol.scala | identical | — |
| skeleton | aggregate-root | Workgroup | app/net/imadz/metarch/application/aggregates/WorkgroupAggregate.scala | identical | — |
| skeleton | protocol | Workgroup | app/net/imadz/metarch/application/aggregates/WorkgroupProtocol.scala | identical | — |
| skeleton | aggregate-root | Workshop | app/net/imadz/metarch/application/aggregates/WorkshopAggregate.scala | identical | — |
| skeleton | protocol | Workshop | app/net/imadz/metarch/application/aggregates/WorkshopProtocol.scala | identical | — |
| skeleton | behaviors | CemEdge | app/net/imadz/metarch/application/aggregates/behaviors/CemEdgeBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | CemEdge | app/net/imadz/metarch/application/aggregates/behaviors/CemEdgeCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Concept | app/net/imadz/metarch/application/aggregates/behaviors/ConceptBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Concept | app/net/imadz/metarch/application/aggregates/behaviors/ConceptCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Context | app/net/imadz/metarch/application/aggregates/behaviors/ContextBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Context | app/net/imadz/metarch/application/aggregates/behaviors/ContextCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | ContextRelation | app/net/imadz/metarch/application/aggregates/behaviors/ContextRelationBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | ContextRelation | app/net/imadz/metarch/application/aggregates/behaviors/ContextRelationCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | DoR | app/net/imadz/metarch/application/aggregates/behaviors/DoRBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | DoR | app/net/imadz/metarch/application/aggregates/behaviors/DoRCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Stage | app/net/imadz/metarch/application/aggregates/behaviors/StageBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Stage | app/net/imadz/metarch/application/aggregates/behaviors/StageCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Subdomain | app/net/imadz/metarch/application/aggregates/behaviors/SubdomainBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Subdomain | app/net/imadz/metarch/application/aggregates/behaviors/SubdomainCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Tenant | app/net/imadz/metarch/application/aggregates/behaviors/TenantBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Tenant | app/net/imadz/metarch/application/aggregates/behaviors/TenantCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/behaviors/TruthSourceProvenanceBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/behaviors/TruthSourceProvenanceCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/behaviors/UseCaseDefinitionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/behaviors/UseCaseDefinitionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | User | app/net/imadz/metarch/application/aggregates/behaviors/UserBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | User | app/net/imadz/metarch/application/aggregates/behaviors/UserCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupCommandHelpers.scala | owned-by-other | — |
| skeleton | behaviors | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopBehaviors.scala | owned-by-other | — |
| skeleton | command-helpers | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopCommandHelpers.scala | owned-by-other | — |
| skeleton | factory | CemEdge | app/net/imadz/metarch/application/aggregates/factories/CemEdgeAggregateFactory.scala | identical | — |
| skeleton | factory | Concept | app/net/imadz/metarch/application/aggregates/factories/ConceptAggregateFactory.scala | identical | — |
| skeleton | factory | Context | app/net/imadz/metarch/application/aggregates/factories/ContextAggregateFactory.scala | identical | — |
| skeleton | factory | ContextRelation | app/net/imadz/metarch/application/aggregates/factories/ContextRelationAggregateFactory.scala | identical | — |
| skeleton | factory | DoR | app/net/imadz/metarch/application/aggregates/factories/DoRAggregateFactory.scala | identical | — |
| skeleton | factory | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/factories/FieldModelDefinitionAggregateFactory.scala | identical | — |
| skeleton | factory | FsmDefinition | app/net/imadz/metarch/application/aggregates/factories/FsmDefinitionAggregateFactory.scala | identical | — |
| skeleton | factory | KnowledgePatch | app/net/imadz/metarch/application/aggregates/factories/KnowledgePatchAggregateFactory.scala | identical | — |
| skeleton | factory | ModelCatalog | app/net/imadz/metarch/application/aggregates/factories/ModelCatalogAggregateFactory.scala | identical | — |
| skeleton | factory | Note | app/net/imadz/metarch/application/aggregates/factories/NoteAggregateFactory.scala | identical | — |
| skeleton | factory | OrganizationMember | app/net/imadz/metarch/application/aggregates/factories/OrganizationMemberAggregateFactory.scala | identical | — |
| skeleton | factory | Project | app/net/imadz/metarch/application/aggregates/factories/ProjectAggregateFactory.scala | identical | — |
| skeleton | factory | Question | app/net/imadz/metarch/application/aggregates/factories/QuestionAggregateFactory.scala | identical | — |
| skeleton | factory | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/factories/ReadModelDefinitionAggregateFactory.scala | identical | — |
| skeleton | factory | Relation | app/net/imadz/metarch/application/aggregates/factories/RelationAggregateFactory.scala | identical | — |
| skeleton | factory | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/factories/RoleCommandBindingAggregateFactory.scala | identical | — |
| skeleton | factory | Session | app/net/imadz/metarch/application/aggregates/factories/SessionAggregateFactory.scala | identical | — |
| skeleton | factory | Stage | app/net/imadz/metarch/application/aggregates/factories/StageAggregateFactory.scala | identical | — |
| skeleton | factory | Subdomain | app/net/imadz/metarch/application/aggregates/factories/SubdomainAggregateFactory.scala | identical | — |
| skeleton | factory | Tenant | app/net/imadz/metarch/application/aggregates/factories/TenantAggregateFactory.scala | identical | — |
| skeleton | factory | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/factories/TruthSourceProvenanceAggregateFactory.scala | identical | — |
| skeleton | factory | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/factories/UseCaseDefinitionAggregateFactory.scala | identical | — |
| skeleton | factory | User | app/net/imadz/metarch/application/aggregates/factories/UserAggregateFactory.scala | identical | — |
| skeleton | factory | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/factories/ValueObjectDefinitionAggregateFactory.scala | identical | — |
| skeleton | factory | WorkTicket | app/net/imadz/metarch/application/aggregates/factories/WorkTicketAggregateFactory.scala | identical | — |
| skeleton | factory | Workgroup | app/net/imadz/metarch/application/aggregates/factories/WorkgroupAggregateFactory.scala | identical | — |
| skeleton | factory | Workshop | app/net/imadz/metarch/application/aggregates/factories/WorkshopAggregateFactory.scala | identical | — |
| skeleton | repository | CemEdge | app/net/imadz/metarch/application/aggregates/repository/CemEdgeRepository.scala | owned-by-other | — |
| skeleton | repository | Concept | app/net/imadz/metarch/application/aggregates/repository/ConceptRepository.scala | owned-by-other | — |
| skeleton | repository | ContextRelation | app/net/imadz/metarch/application/aggregates/repository/ContextRelationRepository.scala | owned-by-other | — |
| skeleton | repository | Context | app/net/imadz/metarch/application/aggregates/repository/ContextRepository.scala | owned-by-other | — |
| skeleton | repository | DoR | app/net/imadz/metarch/application/aggregates/repository/DoRRepository.scala | owned-by-other | — |
| skeleton | repository | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/repository/FieldModelDefinitionRepository.scala | owned-by-other | — |
| skeleton | repository | FsmDefinition | app/net/imadz/metarch/application/aggregates/repository/FsmDefinitionRepository.scala | owned-by-other | — |
| skeleton | repository | KnowledgePatch | app/net/imadz/metarch/application/aggregates/repository/KnowledgePatchRepository.scala | owned-by-other | — |
| skeleton | repository | ModelCatalog | app/net/imadz/metarch/application/aggregates/repository/ModelCatalogRepository.scala | owned-by-other | — |
| skeleton | repository | Note | app/net/imadz/metarch/application/aggregates/repository/NoteRepository.scala | owned-by-other | — |
| skeleton | repository | OrganizationMember | app/net/imadz/metarch/application/aggregates/repository/OrganizationMemberRepository.scala | owned-by-other | — |
| skeleton | repository | Project | app/net/imadz/metarch/application/aggregates/repository/ProjectRepository.scala | owned-by-other | — |
| skeleton | repository | Question | app/net/imadz/metarch/application/aggregates/repository/QuestionRepository.scala | owned-by-other | — |
| skeleton | repository | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/repository/ReadModelDefinitionRepository.scala | owned-by-other | — |
| skeleton | repository | Relation | app/net/imadz/metarch/application/aggregates/repository/RelationRepository.scala | owned-by-other | — |
| skeleton | repository | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/repository/RoleCommandBindingRepository.scala | owned-by-other | — |
| skeleton | repository | Session | app/net/imadz/metarch/application/aggregates/repository/SessionRepository.scala | owned-by-other | — |
| skeleton | repository | Stage | app/net/imadz/metarch/application/aggregates/repository/StageRepository.scala | owned-by-other | — |
| skeleton | repository | Subdomain | app/net/imadz/metarch/application/aggregates/repository/SubdomainRepository.scala | owned-by-other | — |
| skeleton | repository | Tenant | app/net/imadz/metarch/application/aggregates/repository/TenantRepository.scala | owned-by-other | — |
| skeleton | repository | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/repository/TruthSourceProvenanceRepository.scala | owned-by-other | — |
| skeleton | repository | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/repository/UseCaseDefinitionRepository.scala | owned-by-other | — |
| skeleton | repository | User | app/net/imadz/metarch/application/aggregates/repository/UserRepository.scala | owned-by-other | — |
| skeleton | repository | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/repository/ValueObjectDefinitionRepository.scala | owned-by-other | — |
| skeleton | repository | WorkTicket | app/net/imadz/metarch/application/aggregates/repository/WorkTicketRepository.scala | owned-by-other | — |
| skeleton | repository | Workgroup | app/net/imadz/metarch/application/aggregates/repository/WorkgroupRepository.scala | owned-by-other | — |
| skeleton | repository | Workshop | app/net/imadz/metarch/application/aggregates/repository/WorkshopRepository.scala | owned-by-other | — |
| skeleton | entity | CemEdge | app/net/imadz/metarch/domain/entities/CemEdgeEntity.scala | identical | — |
| skeleton | entity | Concept | app/net/imadz/metarch/domain/entities/ConceptEntity.scala | diff | 158 |
| skeleton | entity | Context | app/net/imadz/metarch/domain/entities/ContextEntity.scala | identical | — |
| skeleton | entity | ContextRelation | app/net/imadz/metarch/domain/entities/ContextRelationEntity.scala | identical | — |
| skeleton | entity | DoR | app/net/imadz/metarch/domain/entities/DoREntity.scala | identical | — |
| skeleton | entity | FieldModelDefinition | app/net/imadz/metarch/domain/entities/FieldModelDefinitionEntity.scala | identical | — |
| skeleton | entity | FsmDefinition | app/net/imadz/metarch/domain/entities/FsmDefinitionEntity.scala | identical | — |
| skeleton | entity | KnowledgePatch | app/net/imadz/metarch/domain/entities/KnowledgePatchEntity.scala | diff | 64 |
| skeleton | entity | ModelCatalog | app/net/imadz/metarch/domain/entities/ModelCatalogEntity.scala | identical | — |
| skeleton | entity | Note | app/net/imadz/metarch/domain/entities/NoteEntity.scala | identical | — |
| skeleton | entity | OrganizationMember | app/net/imadz/metarch/domain/entities/OrganizationMemberEntity.scala | identical | — |
| skeleton | entity | Project | app/net/imadz/metarch/domain/entities/ProjectEntity.scala | identical | — |
| skeleton | entity | Question | app/net/imadz/metarch/domain/entities/QuestionEntity.scala | identical | — |
| skeleton | entity | ReadModelDefinition | app/net/imadz/metarch/domain/entities/ReadModelDefinitionEntity.scala | identical | — |
| skeleton | entity | Relation | app/net/imadz/metarch/domain/entities/RelationEntity.scala | identical | — |
| skeleton | entity | RoleCommandBinding | app/net/imadz/metarch/domain/entities/RoleCommandBindingEntity.scala | identical | — |
| skeleton | entity | Session | app/net/imadz/metarch/domain/entities/SessionEntity.scala | identical | — |
| skeleton | entity | Stage | app/net/imadz/metarch/domain/entities/StageEntity.scala | identical | — |
| skeleton | entity | Subdomain | app/net/imadz/metarch/domain/entities/SubdomainEntity.scala | identical | — |
| skeleton | entity | Tenant | app/net/imadz/metarch/domain/entities/TenantEntity.scala | identical | — |
| skeleton | entity | TruthSourceProvenance | app/net/imadz/metarch/domain/entities/TruthSourceProvenanceEntity.scala | identical | — |
| skeleton | entity | UseCaseDefinition | app/net/imadz/metarch/domain/entities/UseCaseDefinitionEntity.scala | identical | — |
| skeleton | entity | User | app/net/imadz/metarch/domain/entities/UserEntity.scala | diff | 18 |
| skeleton | entity | ValueObjectDefinition | app/net/imadz/metarch/domain/entities/ValueObjectDefinitionEntity.scala | identical | — |
| skeleton | entity | WorkTicket | app/net/imadz/metarch/domain/entities/WorkTicketEntity.scala | identical | — |
| skeleton | entity | Workgroup | app/net/imadz/metarch/domain/entities/WorkgroupEntity.scala | identical | — |
| skeleton | entity | Workshop | app/net/imadz/metarch/domain/entities/WorkshopEntity.scala | identical | — |
| skeleton | event-handler | CemEdge | app/net/imadz/metarch/domain/entities/behaviors/CemEdgeEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Concept | app/net/imadz/metarch/domain/entities/behaviors/ConceptEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Context | app/net/imadz/metarch/domain/entities/behaviors/ContextEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | ContextRelation | app/net/imadz/metarch/domain/entities/behaviors/ContextRelationEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | DoR | app/net/imadz/metarch/domain/entities/behaviors/DoREventHandler.scala | owned-by-other | — |
| skeleton | event-handler | FieldModelDefinition | app/net/imadz/metarch/domain/entities/behaviors/FieldModelDefinitionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | FsmDefinition | app/net/imadz/metarch/domain/entities/behaviors/FsmDefinitionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | KnowledgePatch | app/net/imadz/metarch/domain/entities/behaviors/KnowledgePatchEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | ModelCatalog | app/net/imadz/metarch/domain/entities/behaviors/ModelCatalogEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Note | app/net/imadz/metarch/domain/entities/behaviors/NoteEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | OrganizationMember | app/net/imadz/metarch/domain/entities/behaviors/OrganizationMemberEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Project | app/net/imadz/metarch/domain/entities/behaviors/ProjectEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Question | app/net/imadz/metarch/domain/entities/behaviors/QuestionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | ReadModelDefinition | app/net/imadz/metarch/domain/entities/behaviors/ReadModelDefinitionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Relation | app/net/imadz/metarch/domain/entities/behaviors/RelationEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | RoleCommandBinding | app/net/imadz/metarch/domain/entities/behaviors/RoleCommandBindingEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Session | app/net/imadz/metarch/domain/entities/behaviors/SessionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Stage | app/net/imadz/metarch/domain/entities/behaviors/StageEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Subdomain | app/net/imadz/metarch/domain/entities/behaviors/SubdomainEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Tenant | app/net/imadz/metarch/domain/entities/behaviors/TenantEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | TruthSourceProvenance | app/net/imadz/metarch/domain/entities/behaviors/TruthSourceProvenanceEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | UseCaseDefinition | app/net/imadz/metarch/domain/entities/behaviors/UseCaseDefinitionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | User | app/net/imadz/metarch/domain/entities/behaviors/UserEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | ValueObjectDefinition | app/net/imadz/metarch/domain/entities/behaviors/ValueObjectDefinitionEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | WorkTicket | app/net/imadz/metarch/domain/entities/behaviors/WorkTicketEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Workgroup | app/net/imadz/metarch/domain/entities/behaviors/WorkgroupEventHandler.scala | owned-by-other | — |
| skeleton | event-handler | Workshop | app/net/imadz/metarch/domain/entities/behaviors/WorkshopEventHandler.scala | owned-by-other | — |
| rules | behaviors-rules | CemEdge | app/net/imadz/metarch/application/aggregates/behaviors/CemEdgeBehaviors.scala | identical | — |
| rules | command-helpers-rules | CemEdge | app/net/imadz/metarch/application/aggregates/behaviors/CemEdgeCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Concept | app/net/imadz/metarch/application/aggregates/behaviors/ConceptBehaviors.scala | identical | — |
| rules | command-helpers-rules | Concept | app/net/imadz/metarch/application/aggregates/behaviors/ConceptCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Context | app/net/imadz/metarch/application/aggregates/behaviors/ContextBehaviors.scala | identical | — |
| rules | command-helpers-rules | Context | app/net/imadz/metarch/application/aggregates/behaviors/ContextCommandHelpers.scala | identical | — |
| rules | behaviors-rules | ContextRelation | app/net/imadz/metarch/application/aggregates/behaviors/ContextRelationBehaviors.scala | identical | — |
| rules | command-helpers-rules | ContextRelation | app/net/imadz/metarch/application/aggregates/behaviors/ContextRelationCommandHelpers.scala | identical | — |
| rules | behaviors-rules | DoR | app/net/imadz/metarch/application/aggregates/behaviors/DoRBehaviors.scala | identical | — |
| rules | command-helpers-rules | DoR | app/net/imadz/metarch/application/aggregates/behaviors/DoRCommandHelpers.scala | diff | 58 |
| rules | behaviors-rules | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionCommandHelpers.scala | diff | 124 |
| rules | behaviors-rules | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionCommandHelpers.scala | diff | 26 |
| rules | behaviors-rules | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchBehaviors.scala | identical | — |
| rules | command-helpers-rules | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchCommandHelpers.scala | diff | 67 |
| rules | behaviors-rules | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogBehaviors.scala | identical | — |
| rules | command-helpers-rules | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteBehaviors.scala | identical | — |
| rules | command-helpers-rules | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteCommandHelpers.scala | identical | — |
| rules | behaviors-rules | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberBehaviors.scala | identical | — |
| rules | command-helpers-rules | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberCommandHelpers.scala | diff | 30 |
| rules | behaviors-rules | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectBehaviors.scala | identical | — |
| rules | command-helpers-rules | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectCommandHelpers.scala | diff | 67 |
| rules | behaviors-rules | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionBehaviors.scala | identical | — |
| rules | command-helpers-rules | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationBehaviors.scala | identical | — |
| rules | command-helpers-rules | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationCommandHelpers.scala | identical | — |
| rules | behaviors-rules | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingBehaviors.scala | identical | — |
| rules | command-helpers-rules | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionBehaviors.scala | identical | — |
| rules | command-helpers-rules | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionCommandHelpers.scala | diff | 67 |
| rules | behaviors-rules | Stage | app/net/imadz/metarch/application/aggregates/behaviors/StageBehaviors.scala | identical | — |
| rules | command-helpers-rules | Stage | app/net/imadz/metarch/application/aggregates/behaviors/StageCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Subdomain | app/net/imadz/metarch/application/aggregates/behaviors/SubdomainBehaviors.scala | identical | — |
| rules | command-helpers-rules | Subdomain | app/net/imadz/metarch/application/aggregates/behaviors/SubdomainCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Tenant | app/net/imadz/metarch/application/aggregates/behaviors/TenantBehaviors.scala | identical | — |
| rules | command-helpers-rules | Tenant | app/net/imadz/metarch/application/aggregates/behaviors/TenantCommandHelpers.scala | identical | — |
| rules | behaviors-rules | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/behaviors/TruthSourceProvenanceBehaviors.scala | identical | — |
| rules | command-helpers-rules | TruthSourceProvenance | app/net/imadz/metarch/application/aggregates/behaviors/TruthSourceProvenanceCommandHelpers.scala | identical | — |
| rules | behaviors-rules | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/behaviors/UseCaseDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | UseCaseDefinition | app/net/imadz/metarch/application/aggregates/behaviors/UseCaseDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | User | app/net/imadz/metarch/application/aggregates/behaviors/UserBehaviors.scala | identical | — |
| rules | command-helpers-rules | User | app/net/imadz/metarch/application/aggregates/behaviors/UserCommandHelpers.scala | diff | 50 |
| rules | behaviors-rules | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketBehaviors.scala | identical | — |
| rules | command-helpers-rules | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketCommandHelpers.scala | diff | 26 |
| rules | behaviors-rules | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupBehaviors.scala | identical | — |
| rules | command-helpers-rules | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupCommandHelpers.scala | diff | 78 |
| rules | behaviors-rules | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopBehaviors.scala | identical | — |
| rules | command-helpers-rules | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopCommandHelpers.scala | identical | — |
| rules | rules | CemEdge | app/net/imadz/metarch/domain/invariant/CemEdgeRules.scala | identical | — |
| rules | rules | Concept | app/net/imadz/metarch/domain/invariant/ConceptRules.scala | identical | — |
| rules | rules | ContextRelation | app/net/imadz/metarch/domain/invariant/ContextRelationRules.scala | identical | — |
| rules | rules | Context | app/net/imadz/metarch/domain/invariant/ContextRules.scala | identical | — |
| rules | rules | DoR | app/net/imadz/metarch/domain/invariant/DoRRules.scala | diff | 79 |
| rules | rules | FieldModelDefinition | app/net/imadz/metarch/domain/invariant/FieldModelDefinitionRules.scala | diff | 94 |
| rules | rules | FsmDefinition | app/net/imadz/metarch/domain/invariant/FsmDefinitionRules.scala | identical | — |
| rules | rules | KnowledgePatch | app/net/imadz/metarch/domain/invariant/KnowledgePatchRules.scala | identical | — |
| rules | rules | ModelCatalog | app/net/imadz/metarch/domain/invariant/ModelCatalogRules.scala | identical | — |
| rules | rules | Note | app/net/imadz/metarch/domain/invariant/NoteRules.scala | diff | 64 |
| rules | rules | OrganizationMember | app/net/imadz/metarch/domain/invariant/OrganizationMemberRules.scala | diff | 75 |
| rules | rules | Project | app/net/imadz/metarch/domain/invariant/ProjectRules.scala | identical | — |
| rules | rules | Question | app/net/imadz/metarch/domain/invariant/QuestionRules.scala | identical | — |
| rules | rules | ReadModelDefinition | app/net/imadz/metarch/domain/invariant/ReadModelDefinitionRules.scala | identical | — |
| rules | rules | Relation | app/net/imadz/metarch/domain/invariant/RelationRules.scala | identical | — |
| rules | rules | RoleCommandBinding | app/net/imadz/metarch/domain/invariant/RoleCommandBindingRules.scala | identical | — |
| rules | rules | Session | app/net/imadz/metarch/domain/invariant/SessionRules.scala | diff | 103 |
| rules | rules | Stage | app/net/imadz/metarch/domain/invariant/StageRules.scala | identical | — |
| rules | rules | Subdomain | app/net/imadz/metarch/domain/invariant/SubdomainRules.scala | identical | — |
| rules | rules | Tenant | app/net/imadz/metarch/domain/invariant/TenantRules.scala | identical | — |
| rules | rules | TruthSourceProvenance | app/net/imadz/metarch/domain/invariant/TruthSourceProvenanceRules.scala | identical | — |
| rules | rules | UseCaseDefinition | app/net/imadz/metarch/domain/invariant/UseCaseDefinitionRules.scala | identical | — |
| rules | rules | User | app/net/imadz/metarch/domain/invariant/UserRules.scala | diff | 35 |
| rules | rules | ValueObjectDefinition | app/net/imadz/metarch/domain/invariant/ValueObjectDefinitionRules.scala | identical | — |
| rules | rules | WorkTicket | app/net/imadz/metarch/domain/invariant/WorkTicketRules.scala | identical | — |
| rules | rules | Workgroup | app/net/imadz/metarch/domain/invariant/WorkgroupRules.scala | diff | 114 |
| rules | rules | Workshop | app/net/imadz/metarch/domain/invariant/WorkshopRules.scala | identical | — |
| rules | rule-params | CemEdge | app/net/imadz/metarch/domain/invariant/params/CemEdgeRuleParams.scala | identical | — |
| rules | rule-params | Concept | app/net/imadz/metarch/domain/invariant/params/ConceptRuleParams.scala | identical | — |
| rules | rule-params | ContextRelation | app/net/imadz/metarch/domain/invariant/params/ContextRelationRuleParams.scala | identical | — |
| rules | rule-params | Context | app/net/imadz/metarch/domain/invariant/params/ContextRuleParams.scala | identical | — |
| rules | rule-params | DoR | app/net/imadz/metarch/domain/invariant/params/DoRRuleParams.scala | diff | 20 |
| rules | rule-params | FieldModelDefinition | app/net/imadz/metarch/domain/invariant/params/FieldModelDefinitionRuleParams.scala | diff | 26 |
| rules | rule-params | FsmDefinition | app/net/imadz/metarch/domain/invariant/params/FsmDefinitionRuleParams.scala | diff | 5 |
| rules | rule-params | KnowledgePatch | app/net/imadz/metarch/domain/invariant/params/KnowledgePatchRuleParams.scala | diff | 23 |
| rules | rule-params | ModelCatalog | app/net/imadz/metarch/domain/invariant/params/ModelCatalogRuleParams.scala | identical | — |
| rules | rule-params | Note | app/net/imadz/metarch/domain/invariant/params/NoteRuleParams.scala | identical | — |
| rules | rule-params | OrganizationMember | app/net/imadz/metarch/domain/invariant/params/OrganizationMemberRuleParams.scala | diff | 15 |
| rules | rule-params | Project | app/net/imadz/metarch/domain/invariant/params/ProjectRuleParams.scala | diff | 23 |
| rules | rule-params | Question | app/net/imadz/metarch/domain/invariant/params/QuestionRuleParams.scala | identical | — |
| rules | rule-params | ReadModelDefinition | app/net/imadz/metarch/domain/invariant/params/ReadModelDefinitionRuleParams.scala | identical | — |
| rules | rule-params | Relation | app/net/imadz/metarch/domain/invariant/params/RelationRuleParams.scala | identical | — |
| rules | rule-params | RoleCommandBinding | app/net/imadz/metarch/domain/invariant/params/RoleCommandBindingRuleParams.scala | identical | — |
| rules | rule-params | Session | app/net/imadz/metarch/domain/invariant/params/SessionRuleParams.scala | diff | 23 |
| rules | rule-params | Stage | app/net/imadz/metarch/domain/invariant/params/StageRuleParams.scala | identical | — |
| rules | rule-params | Subdomain | app/net/imadz/metarch/domain/invariant/params/SubdomainRuleParams.scala | identical | — |
| rules | rule-params | Tenant | app/net/imadz/metarch/domain/invariant/params/TenantRuleParams.scala | identical | — |
| rules | rule-params | TruthSourceProvenance | app/net/imadz/metarch/domain/invariant/params/TruthSourceProvenanceRuleParams.scala | identical | — |
| rules | rule-params | UseCaseDefinition | app/net/imadz/metarch/domain/invariant/params/UseCaseDefinitionRuleParams.scala | identical | — |
| rules | rule-params | User | app/net/imadz/metarch/domain/invariant/params/UserRuleParams.scala | diff | 20 |
| rules | rule-params | ValueObjectDefinition | app/net/imadz/metarch/domain/invariant/params/ValueObjectDefinitionRuleParams.scala | identical | — |
| rules | rule-params | WorkTicket | app/net/imadz/metarch/domain/invariant/params/WorkTicketRuleParams.scala | diff | 5 |
| rules | rule-params | Workgroup | app/net/imadz/metarch/domain/invariant/params/WorkgroupRuleParams.scala | diff | 26 |
| rules | rule-params | Workshop | app/net/imadz/metarch/domain/invariant/params/WorkshopRuleParams.scala | identical | — |
| rules | policies | Concept | app/net/imadz/metarch/domain/policy/ConceptPolicies.scala | identical | — |
| rules | policies | KnowledgePatch | app/net/imadz/metarch/domain/policy/KnowledgePatchPolicies.scala | identical | — |
| rules | policies | ModelCatalog | app/net/imadz/metarch/domain/policy/ModelCatalogPolicies.scala | identical | — |
| rules | policies | Session | app/net/imadz/metarch/domain/policy/SessionPolicies.scala | identical | — |
| rules | policies | Tenant | app/net/imadz/metarch/domain/policy/TenantPolicies.scala | identical | — |
| rules | rules-spec | CemEdge | test/net/imadz/metarch/domain/invariant/CemEdgeRulesSpec.scala | diff | 6 |
| rules | rules-spec | Concept | test/net/imadz/metarch/domain/invariant/ConceptRulesSpec.scala | identical | — |
| rules | rules-spec | ContextRelation | test/net/imadz/metarch/domain/invariant/ContextRelationRulesSpec.scala | identical | — |
| rules | rules-spec | Context | test/net/imadz/metarch/domain/invariant/ContextRulesSpec.scala | identical | — |
| rules | rules-spec | DoR | test/net/imadz/metarch/domain/invariant/DoRRulesSpec.scala | diff | 433 |
| rules | rules-spec | FieldModelDefinition | test/net/imadz/metarch/domain/invariant/FieldModelDefinitionRulesSpec.scala | diff | 13 |
| rules | rules-spec | FsmDefinition | test/net/imadz/metarch/domain/invariant/FsmDefinitionRulesSpec.scala | diff | 51 |
| rules | rules-spec | KnowledgePatch | test/net/imadz/metarch/domain/invariant/KnowledgePatchRulesSpec.scala | diff | 99 |
| rules | rules-spec | ModelCatalog | test/net/imadz/metarch/domain/invariant/ModelCatalogRulesSpec.scala | identical | — |
| rules | rules-spec | Note | test/net/imadz/metarch/domain/invariant/NoteRulesSpec.scala | identical | — |
| rules | rules-spec | OrganizationMember | test/net/imadz/metarch/domain/invariant/OrganizationMemberRulesSpec.scala | diff | 62 |
| rules | rules-spec | Project | test/net/imadz/metarch/domain/invariant/ProjectRulesSpec.scala | diff | 70 |
| rules | rules-spec | Question | test/net/imadz/metarch/domain/invariant/QuestionRulesSpec.scala | identical | — |
| rules | rules-spec | ReadModelDefinition | test/net/imadz/metarch/domain/invariant/ReadModelDefinitionRulesSpec.scala | diff | 5 |
| rules | rules-spec | Relation | test/net/imadz/metarch/domain/invariant/RelationRulesSpec.scala | identical | — |
| rules | rules-spec | RoleCommandBinding | test/net/imadz/metarch/domain/invariant/RoleCommandBindingRulesSpec.scala | diff | 5 |
| rules | rules-spec | Session | test/net/imadz/metarch/domain/invariant/SessionRulesSpec.scala | diff | 197 |
| rules | rules-spec | Stage | test/net/imadz/metarch/domain/invariant/StageRulesSpec.scala | identical | — |
| rules | rules-spec | Subdomain | test/net/imadz/metarch/domain/invariant/SubdomainRulesSpec.scala | identical | — |
| rules | rules-spec | Tenant | test/net/imadz/metarch/domain/invariant/TenantRulesSpec.scala | identical | — |
| rules | rules-spec | TruthSourceProvenance | test/net/imadz/metarch/domain/invariant/TruthSourceProvenanceRulesSpec.scala | diff | 3 |
| rules | rules-spec | UseCaseDefinition | test/net/imadz/metarch/domain/invariant/UseCaseDefinitionRulesSpec.scala | diff | 5 |
| rules | rules-spec | User | test/net/imadz/metarch/domain/invariant/UserRulesSpec.scala | diff | 33 |
| rules | rules-spec | ValueObjectDefinition | test/net/imadz/metarch/domain/invariant/ValueObjectDefinitionRulesSpec.scala | diff | 5 |
| rules | rules-spec | WorkTicket | test/net/imadz/metarch/domain/invariant/WorkTicketRulesSpec.scala | diff | 55 |
| rules | rules-spec | Workgroup | test/net/imadz/metarch/domain/invariant/WorkgroupRulesSpec.scala | diff | 218 |
| rules | rules-spec | Workshop | test/net/imadz/metarch/domain/invariant/WorkshopRulesSpec.scala | identical | — |
| rules | policies-spec | Concept | test/net/imadz/metarch/domain/policy/ConceptPoliciesSpec.scala | identical | — |
| rules | policies-spec | KnowledgePatch | test/net/imadz/metarch/domain/policy/KnowledgePatchPoliciesSpec.scala | identical | — |
| rules | policies-spec | ModelCatalog | test/net/imadz/metarch/domain/policy/ModelCatalogPoliciesSpec.scala | identical | — |
| rules | policies-spec | Session | test/net/imadz/metarch/domain/policy/SessionPoliciesSpec.scala | identical | — |
| rules | policies-spec | Tenant | test/net/imadz/metarch/domain/policy/TenantPoliciesSpec.scala | identical | — |
| api | controller | CemEdge | app/controllers/CemEdgeApiController.scala | identical | — |
| api | controller | Concept | app/controllers/ConceptApiController.scala | identical | — |
| api | controller | Context | app/controllers/ContextApiController.scala | identical | — |
| api | controller | ContextRelation | app/controllers/ContextRelationApiController.scala | identical | — |
| api | controller | DoR | app/controllers/DoRApiController.scala | identical | — |
| api | controller | FieldModelDefinition | app/controllers/FieldModelDefinitionApiController.scala | identical | — |
| api | controller | FsmDefinition | app/controllers/FsmDefinitionApiController.scala | identical | — |
| api | controller | KnowledgePatch | app/controllers/KnowledgePatchApiController.scala | identical | — |
| api | controller | ModelCatalog | app/controllers/ModelCatalogApiController.scala | identical | — |
| api | controller | Note | app/controllers/NoteApiController.scala | identical | — |
| api | controller | OrganizationMember | app/controllers/OrganizationMemberApiController.scala | identical | — |
| api | controller | Project | app/controllers/ProjectApiController.scala | identical | — |
| api | controller | Question | app/controllers/QuestionApiController.scala | identical | — |
| api | controller | ReadModelDefinition | app/controllers/ReadModelDefinitionApiController.scala | identical | — |
| api | controller | Relation | app/controllers/RelationApiController.scala | identical | — |
| api | controller | RoleCommandBinding | app/controllers/RoleCommandBindingApiController.scala | identical | — |
| api | controller | Session | app/controllers/SessionApiController.scala | identical | — |
| api | controller | Stage | app/controllers/StageApiController.scala | identical | — |
| api | controller | Subdomain | app/controllers/SubdomainApiController.scala | identical | — |
| api | controller | Tenant | app/controllers/TenantApiController.scala | identical | — |
| api | controller | TruthSourceProvenance | app/controllers/TruthSourceProvenanceApiController.scala | identical | — |
| api | controller | UseCaseDefinition | app/controllers/UseCaseDefinitionApiController.scala | identical | — |
| api | controller | User | app/controllers/UserApiController.scala | identical | — |
| api | controller | ValueObjectDefinition | app/controllers/ValueObjectDefinitionApiController.scala | identical | — |
| api | controller | CemEdge | app/controllers/ViewApiController.scala | identical | — |
| api | controller | CemEdge | app/controllers/ViewWrites.scala | identical | — |
| api | controller | WorkTicket | app/controllers/WorkTicketApiController.scala | identical | — |
| api | controller | Workgroup | app/controllers/WorkgroupApiController.scala | identical | — |
| api | controller | Workshop | app/controllers/WorkshopApiController.scala | identical | — |
| api | command-dsl | — | app/net/imadz/metarch/infrastructure/api/CommandDsl.scala | identical | — |
| api | command-role-map | — | app/net/imadz/metarch/infrastructure/auth/CommandRoleMap.scala | identical | — |
| api | view-keys | — | app/net/imadz/metarch/infrastructure/auth/ViewKeys.scala | identical | — |

## 反向覆盖（live 有而 truthsrc 未发·0 rows）

| kind | aggregate | live path |
|---|---|---|

## diff 摘录（每件首差·≤3 行）

### app/net/imadz/metarch/application/aggregates/ModelCatalogAggregate.scala（aggregate-root·首差 @line 21 byte 741）

```scala
--- live（want）
  def commandHandler(adjudicator: net.imadz.metarch.domain.service.ConceptDeltaAdjudicator, fingerprint: net.imadz.metarch.domain.service.ContentFingerprintPort): net.imadz.metarch.application.aggregates.ModelCatalogProtocol.ModelCatalogCommandHandlerFamily = ModelCatalogBehaviors.apply(adjudicator)
+++ truthsrc（got）
  def commandHandler: net.imadz.metarch.application.aggregates.ModelCatalogProtocol.ModelCatalogCommandHandlerFamily = ModelCatalogBehaviors.apply


```

### app/net/imadz/metarch/application/aggregates/RoleCommandBindingAggregate.scala（aggregate-root·首差 @line 21 byte 891）

```scala
--- live（want）
  def commandHandler: net.imadz.metarch.application.aggregates.RoleCommandBindingProtocol.RoleCommandHandlerBindingCommandHandlerFamily = RoleCommandBindingBehaviors.apply


+++ truthsrc（got）
  def commandHandler: net.imadz.metarch.application.aggregates.RoleCommandBindingProtocol.RoleCommandHandlerBindingCommandFamily = RoleCommandBindingBehaviors.apply


```

### app/net/imadz/metarch/application/aggregates/RoleCommandBindingProtocol.scala（protocol·首差 @line 47 byte 2960）

```scala
--- live（want）
  type RoleCommandHandlerBindingCommandHandlerFamily = (RoleCommandBindingState, RoleCommandBindingCommandFamily) => akka.persistence.typed.scaladsl.Effect[RoleCommandBindingEvent, RoleCommandBindingState]


+++ truthsrc（got）
  type RoleCommandHandlerBindingCommandFamily = (RoleCommandBindingState, RoleCommandBindingCommandFamily) => akka.persistence.typed.scaladsl.Effect[RoleCommandBindingEvent, RoleCommandBindingState]


```

### app/net/imadz/metarch/domain/entities/ConceptEntity.scala（entity·首差 @line 158 byte 13878）

```scala
--- live（want）
   * @param conceptId 必填  @knowledge 6a62c1bc-d92d-4c97-af73-59957970204d@420a35b9177b30ce
   * @param lastVersion last known version number  @knowledge a171b0c0-3447-4406-9fab-c01cb3109539@602e04a934f603c1
   * @param newVersion lastVersion + 1  @knowledge f6072170-29a2-4b69-b634-6b558861df13@4e069
+++ truthsrc（got）
   * @param sourceConceptId 必填  @knowledge 7a2eb5b7-2cea-45bc-a610-34cf9c6f2d8f@4db69c9f8c11a4a9
   * @param targetConceptId 必填  @knowledge bea24fea-7651-44ad-8493-27cdcf2ccd78@1e3d661d2096fff2
   * @param lastVersion last known version number  @knowledge 7f4859b4-500d-45ec-aff3-71d680977435@4bb37c5
```

### app/net/imadz/metarch/domain/entities/KnowledgePatchEntity.scala（entity·首差 @line 64 byte 4774）

```scala
--- live（want）
   * @param patchId 补丁编号  @knowledge f0649169-f979-495d-a2fe-eaa1f5d22830@db0a233cc823d8a6
   * @param reason 退回原因  @knowledge 1fc865a8-975f-4c56-8c8e-46e7bb781e17@afae507e4a6e5f32
   * @param triggeredBy  @knowledge fb724154-ffc8-4c67-8da3-f84bd108996e@c8f9ab14ec44e7c0
+++ truthsrc（got）
   * @param patchId 补丁编号  @knowledge 94a47b3e-b545-4d9c-b4e4-c2a9703f06f7@7ef2e79ed337a613
   * @param catalogId 目标目录  @knowledge c81640b9-74f0-41a3-8212-ba1ccb2959eb@2cbaab4394d11818
   * @param triggeredBy 操作人  @knowledge 59904b3e-7512-47c1-82e5-61b3acd47197@49c0e55ee7a37671
```

### app/net/imadz/metarch/domain/entities/UserEntity.scala（entity·首差 @line 18 byte 610）

```scala
--- live（want）
   * @param authMethod password / sso  @knowledge 313c97e5-6c43-4b23-b7c0-6036d6736c50@f2fe5a4deaef39f5
   * @param displayName 界面显示名称  @knowledge 4e2b84ba-daec-47a2-ade9-070502c7d4e5@99b3533ee1fca52d
   * @param registeredAt time when the user registered  @knowledge 2245a005-6114-47f0-90ab-796a3ef5
+++ truthsrc（got）
   * @param passwordSalt 【新增】为哈希增加随机盐  @knowledge 95f2fa3c-616d-41b1-a9d6-d0059f8ddc4d@ea08ff355e29010f
   * @param passwordHash 不可逆加密存储  @knowledge b9396444-68e8-435f-a44c-b874a9df87b6@5475f6b4e5d4c022
   * @param authMethod password / sso  @knowledge 313c97e5-6c43-4b23-b7c0-6036d6736c50@f2fe5a4dea
```

### app/net/imadz/metarch/application/aggregates/behaviors/DoRCommandHelpers.scala（command-helpers-rules·首差 @line 58 byte 3214）

```scala
--- live（want）
      EvaluateDoRParams(command.triggeredBy, command.verdicts, command.dorId)

    override def createFailureReply(param: EvaluateDoRParams)(error: iMadzError): EvaluateDoRReply =
+++ truthsrc（got）
      EvaluateDoRParams(command.triggeredBy, command.verdicts)

    override def createFailureReply(param: EvaluateDoRParams)(error: iMadzError): EvaluateDoRReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionCommandHelpers.scala（command-helpers-rules·首差 @line 124 byte 9138）

```scala
--- live（want）
      DeclareFieldModelParams(command.triggeredBy, command.identifierOrigin, command.description, command.definitionId, command.tenantId, command.tenantScoped, command.identifierDescription, command.aggregateName, command.identifierName, command.entityName, command.identifierType, command.aggregateR
+++ truthsrc（got）
      DeclareFieldModelParams(command.triggeredBy, command.identifierOrigin, command.description, command.definitionId, command.tenantId, command.tenantScoped, command.identifierDescription, command.aggregateName, command.identifierName, command.entityName, command.identifierType)

    override def 
```

### app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionCommandHelpers.scala（command-helpers-rules·首差 @line 26 byte 1690）

```scala
--- live（want）
      EstablishFsmDefinitionParams(command.triggeredBy, command.fsmId, command.confirmedBy)

    override def createFailureReply(param: EstablishFsmDefinitionParams)(error: iMadzError): EstablishFsmDefinitionReply =
+++ truthsrc（got）
      EstablishFsmDefinitionParams(command.triggeredBy)

    override def createFailureReply(param: EstablishFsmDefinitionParams)(error: iMadzError): EstablishFsmDefinitionReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchCommandHelpers.scala（command-helpers-rules·首差 @line 67 byte 4526）

```scala
--- live（want）
      MergeKnowledgePatchParams(command.triggeredBy, command.patchId, command.catalogId)

    override def createFailureReply(param: MergeKnowledgePatchParams)(error: iMadzError): MergeKnowledgePatchReply =
+++ truthsrc（got）
      MergeKnowledgePatchParams(command.triggeredBy)

    override def createFailureReply(param: MergeKnowledgePatchParams)(error: iMadzError): MergeKnowledgePatchReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberCommandHelpers.scala（command-helpers-rules·首差 @line 30 byte 2146）

```scala
--- live（want）
      AcceptTenantInvitationParams(command.triggeredBy, command.tenantId, command.userId)

    override def createFailureReply(param: AcceptTenantInvitationParams)(error: iMadzError): AcceptTenantInvitationReply =
+++ truthsrc（got）
      AcceptTenantInvitationParams(command.triggeredBy)

    override def createFailureReply(param: AcceptTenantInvitationParams)(error: iMadzError): AcceptTenantInvitationReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/ProjectCommandHelpers.scala（command-helpers-rules·首差 @line 67 byte 4195）

```scala
--- live（want）
      InitiateProjectParams(command.tenantId, command.workgroupId, command.name, command.triggeredBy, command.description, command.projectId, command.projectOwnerUserId, command.workshopName, command.catalogId)

    override def createFailureReply(param: InitiateProjectParams)(error: iMadzError): In
+++ truthsrc（got）
      InitiateProjectParams(command.tenantId, command.workgroupId, command.name, command.triggeredBy, command.description, command.projectId, command.projectOwnerUserId, command.workshopName)

    override def createFailureReply(param: InitiateProjectParams)(error: iMadzError): InitiateProjectReply 
```

### app/net/imadz/metarch/application/aggregates/behaviors/SessionCommandHelpers.scala（command-helpers-rules·首差 @line 67 byte 4027）

```scala
--- live（want）
      InviteObserverParams(command.triggeredBy, command.sessionId, command.userId, command.displayName, command.email, command.phoneNumber)

    override def createFailureReply(param: InviteObserverParams)(error: iMadzError): InviteObserverReply =
+++ truthsrc（got）
      InviteObserverParams(command.triggeredBy, command.sessionId, command.userId)

    override def createFailureReply(param: InviteObserverParams)(error: iMadzError): InviteObserverReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/UserCommandHelpers.scala（command-helpers-rules·首差 @line 50 byte 2872）

```scala
--- live（want）
      RegisterUserParams(command.email, command.password, command.triggeredBy, command.displayName, command.authMethod, command.phoneNumber, command.userId)

    override def createFailureReply(param: RegisterUserParams)(error: iMadzError): RegisterUserReply =
+++ truthsrc（got）
      RegisterUserParams(command.email, command.password, command.triggeredBy, command.displayName, command.authMethod, command.phoneNumber)

    override def createFailureReply(param: RegisterUserParams)(error: iMadzError): RegisterUserReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketCommandHelpers.scala（command-helpers-rules·首差 @line 26 byte 1606）

```scala
--- live（want）
      ConcludeWorkTicketParams(command.triggeredBy, command.ticketId, command.approvedBy)

    override def createFailureReply(param: ConcludeWorkTicketParams)(error: iMadzError): ConcludeWorkTicketReply =
+++ truthsrc（got）
      ConcludeWorkTicketParams(command.triggeredBy)

    override def createFailureReply(param: ConcludeWorkTicketParams)(error: iMadzError): ConcludeWorkTicketReply =
```

### app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupCommandHelpers.scala（command-helpers-rules·首差 @line 78 byte 5097）

```scala
--- live（want）
      InviteWorkgroupMemberParams(command.userId, command.triggeredBy, command.workgroupId, command.displayName, command.email, command.phoneNumber)

    override def createFailureReply(param: InviteWorkgroupMemberParams)(error: iMadzError): InviteWorkgroupMemberReply =
+++ truthsrc（got）
      InviteWorkgroupMemberParams(command.userId, command.triggeredBy, command.workgroupId)

    override def createFailureReply(param: InviteWorkgroupMemberParams)(error: iMadzError): InviteWorkgroupMemberReply =
```

### app/net/imadz/metarch/domain/invariant/DoRRules.scala（rules·首差 @line 79 byte 4706）

```scala
--- live（want）
      // ④层 forEach（param.verdicts）：批量发射
      else Right(Nil ::: p.verdicts.map { item => DoRVerdictSubmitted(state.dorId, item, Instant.now(), "", p.triggeredBy, Instant.now(), state.tenantId) })
      }
+++ truthsrc（got）
      else Right(List(DoRVerdictSubmitted(state.dorId, item, Instant.now(), "", p.triggeredBy, Instant.now(), state.tenantId)))
      }
  }
```

### app/net/imadz/metarch/domain/invariant/FieldModelDefinitionRules.scala（rules·首差 @line 94 byte 6270）

```scala
--- live（want）
      Right(List(FieldModelDeclared(p.definitionId, p.aggregateName, p.entityName, p.description.getOrElse(""), p.identifierName, p.identifierType.getOrElse(""), p.identifierOrigin, p.identifierDescription, p.tenantScoped.getOrElse(false), p.triggeredBy, p.tenantId, Instant.now(), p.triggeredBy, Ins
+++ truthsrc（got）
      Right(List(FieldModelDeclared(p.definitionId, p.aggregateName, p.entityName, p.description.getOrElse(""), p.identifierName, p.identifierType.getOrElse(""), p.identifierOrigin, p.identifierDescription, p.tenantScoped.getOrElse(false), p.triggeredBy, p.tenantId, Instant.now(), p.triggeredBy, Ins
```

### app/net/imadz/metarch/domain/invariant/NoteRules.scala（rules·首差 @line 64 byte 4543）

```scala
--- live（want）
      // 幂等（④层 idempotentOn）：载荷与 state 全等 ⇒ 无事件（外部系统重复同步同键同实体）
      else if (Option(state.status).exists(_.nonEmpty) && p.content == state.content && p.name == state.name && p.`type` == state.`type` && p.timeline == state.timeline && p.pivotal == state.pivotal && p.info == state.info && Option(p.li
+++ truthsrc（got）
      // ④层 emitWhen（条件发射·S2-89 WP0）：{"notEmpty":{"var":"CaptureNote.conflictingNoteIds"}}
      else Right(List(NoteCaptured(state.noteId, p.tenantId, p.sessionId, p.externalId.toString, p.boardId.toString, p.content, p.`type`, p.timeline, p.pivotal, p.name, p.links, p.info, p.stage, p.author, p.de
```

### app/net/imadz/metarch/domain/invariant/OrganizationMemberRules.scala（rules·首差 @line 75 byte 5611）

```scala
--- live（want）
      else Right(List(TenantMemberInvited(p.tenantId, p.userId, p.department, p.jobTitle, p.invitedBy, p.expiresAt, Instant.now(), p.triggeredBy, p.displayName, p.email, p.phoneNumber)))
      }
  }
+++ truthsrc（got）
      else Right(List(TenantMemberInvited(p.tenantId, p.userId, p.department, p.jobTitle, p.invitedBy, p.expiresAt, Instant.now(), p.triggeredBy, state.displayName, state.email, state.phoneNumber)))
      }
  }
```

### app/net/imadz/metarch/domain/invariant/SessionRules.scala（rules·首差 @line 103 byte 7356）

```scala
--- live（want）
      else Right(List(ObserverInvited(p.sessionId, state.stageId, p.userId, p.triggeredBy, Instant.now(), state.tenantId, p.displayName, p.email, p.phoneNumber)))
      }
  }
+++ truthsrc（got）
      else Right(List(ObserverInvited(p.sessionId, state.stageId, p.userId, p.triggeredBy, Instant.now(), state.tenantId, None, None, None)))
      }
  }
```

### app/net/imadz/metarch/domain/invariant/UserRules.scala（rules·首差 @line 35 byte 1769）

```scala
--- live（want）
    // ir_agg_User_status_enum
    else if (!(Option(state.status).exists(x => Set("active", "deactivated").contains(x)))) Some(err("USER_STATUS_INVALID", "User.status 必须为 active / deactivated"))
    else None
+++ truthsrc（got）
    // IR-USER-AGG-003
    else if (!(((Option(state.passwordHash).exists(_.nonEmpty)) == (Option(state.passwordSalt).exists(_.nonEmpty))))) Some(err("USER_PASSWORD_INCONSISTENT", "`passwordHash` 与 `passwordSalt` 同时存在或同时为空"))
    // @knowledge 9f016187-0e39-4fa6-bf77-f50f77d2010b@23d227f9fd5a4634
```

### app/net/imadz/metarch/domain/invariant/WorkgroupRules.scala（rules·首差 @line 114 byte 7864）

```scala
--- live（want）
      else Right(List(WorkgroupMemberInvited(p.workgroupId, p.userId, p.triggeredBy, Instant.now(), state.tenantId, p.displayName, p.email, p.phoneNumber)))
      }
  }
+++ truthsrc（got）
      else Right(List(WorkgroupMemberInvited(p.workgroupId, p.userId, p.triggeredBy, Instant.now(), state.tenantId, None, None, None)))
      }
  }
```

### app/net/imadz/metarch/domain/invariant/params/DoRRuleParams.scala（rule-params·首差 @line 20 byte 987）

```scala
--- live（want）
  final case class EvaluateDoRParams(triggeredBy: String, verdicts: List[DoRVerdict] = List.empty, dorId: Id)
  // @knowledge 7373ea54-0a7c-4de2-afd4-c171d6f0d71f@3152e2d43bcc81cc
  /** FixDoRVerdict 规则投影：ir_cmd_FixDoRVerdict_triggered_by */
+++ truthsrc（got）
  final case class EvaluateDoRParams(triggeredBy: String, verdicts: List[DoRVerdict] = List.empty)
  // @knowledge 7373ea54-0a7c-4de2-afd4-c171d6f0d71f@3152e2d43bcc81cc
  /** FixDoRVerdict 规则投影：ir_cmd_FixDoRVerdict_triggered_by */
```

### app/net/imadz/metarch/domain/invariant/params/FieldModelDefinitionRuleParams.scala（rule-params·首差 @line 26 byte 1812）

```scala
--- live（want）
  final case class DeclareFieldModelParams(triggeredBy: String, identifierOrigin: String, description: Option[String], definitionId: Id, tenantId: Id, tenantScoped: Option[Boolean], identifierDescription: String, aggregateName: String, identifierName: String, entityName: String, identifierType: Opti
+++ truthsrc（got）
  final case class DeclareFieldModelParams(triggeredBy: String, identifierOrigin: String, description: Option[String], definitionId: Id, tenantId: Id, tenantScoped: Option[Boolean], identifierDescription: String, aggregateName: String, identifierName: String, entityName: String, identifierType: Opti
```

### app/net/imadz/metarch/domain/invariant/params/FsmDefinitionRuleParams.scala（rule-params·首差 @line 5 byte 124）

```scala
--- live（want）
import net.imadz.common.CommonTypes.Id
import net.imadz.metarch.domain.values._
/**
+++ truthsrc（got）
/**
 * 命令 → 领域规则参数的投影 VO（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * 业务不变性（InvariantRule）是 domain 层资产——规则只依赖领域实体状态、事件与这些投影 VO，
```

### app/net/imadz/metarch/domain/invariant/params/KnowledgePatchRuleParams.scala（rule-params·首差 @line 23 byte 1289）

```scala
--- live（want）
  final case class MergeKnowledgePatchParams(triggeredBy: String, patchId: Id, catalogId: Id)
  // @knowledge 5c0dc4e3-c15a-4029-852a-ad63820f7ebb@ea2a45273782d523
  /** RejectKnowledgePatch 规则投影：IR-KP-CMD-011 / ir_cmd_RejectKnowledgePatch_triggered_by */
+++ truthsrc（got）
  final case class MergeKnowledgePatchParams(triggeredBy: String)
  // @knowledge 5c0dc4e3-c15a-4029-852a-ad63820f7ebb@ea2a45273782d523
  /** RejectKnowledgePatch 规则投影：IR-KP-CMD-011 / ir_cmd_RejectKnowledgePatch_triggered_by */
```

### app/net/imadz/metarch/domain/invariant/params/OrganizationMemberRuleParams.scala（rule-params·首差 @line 15 byte 661）

```scala
--- live（want）
  final case class AcceptTenantInvitationParams(triggeredBy: String, tenantId: Id, userId: Id)
  // @knowledge f8145929-cb3a-4837-8fda-140de01f09dd@a61a044ee0265b01
  /** InviteTenantMember 规则投影：ir_cmd_InviteTenantMember_triggered_by / ir_gen_ref_IR_INV_CMD_001_tenantId / ir_gen_ref_IR_INV_CMD_001_u
+++ truthsrc（got）
  final case class AcceptTenantInvitationParams(triggeredBy: String)
  // @knowledge f8145929-cb3a-4837-8fda-140de01f09dd@a61a044ee0265b01
  /** InviteTenantMember 规则投影：ir_cmd_InviteTenantMember_triggered_by / ir_gen_ref_IR_INV_CMD_001_tenantId / ir_gen_ref_IR_INV_CMD_001_userId / ir_gen_ref_IR_INV_
```

### app/net/imadz/metarch/domain/invariant/params/ProjectRuleParams.scala（rule-params·首差 @line 23 byte 1570）

```scala
--- live（want）
  final case class InitiateProjectParams(tenantId: Id, workgroupId: Id, name: String, triggeredBy: String, description: String, projectId: Id, projectOwnerUserId: Id, workshopName: Option[String], catalogId: Id)
  // @knowledge f80acc40-b875-4091-81a3-e665bc664ca6@3425883218f34eee
  /** PauseProject
+++ truthsrc（got）
  final case class InitiateProjectParams(tenantId: Id, workgroupId: Id, name: String, triggeredBy: String, description: String, projectId: Id, projectOwnerUserId: Id, workshopName: Option[String])
  // @knowledge f80acc40-b875-4091-81a3-e665bc664ca6@3425883218f34eee
  /** PauseProject 规则投影：IR-PRJ-CM
```

### app/net/imadz/metarch/domain/invariant/params/SessionRuleParams.scala（rule-params·首差 @line 23 byte 1376）

```scala
--- live（want）
  final case class InviteObserverParams(triggeredBy: String, sessionId: Id, userId: Id, displayName: Option[String], email: Option[String], phoneNumber: Option[String])
  // @knowledge 6ccdd6ec-32c3-4188-be76-34c92a69a52a@7615c22fe03d0a9d
  /** InviteParticipant 规则投影：IR-SES-CMD-007 / ir_cmd_InvitePa
+++ truthsrc（got）
  final case class InviteObserverParams(triggeredBy: String, sessionId: Id, userId: Id)
  // @knowledge 6ccdd6ec-32c3-4188-be76-34c92a69a52a@7615c22fe03d0a9d
  /** InviteParticipant 规则投影：IR-SES-CMD-007 / ir_cmd_InviteParticipant_triggered_by / ir_gen_ref_IR_SES_CMD_003_userId */
```

### app/net/imadz/metarch/domain/invariant/params/UserRuleParams.scala（rule-params·首差 @line 20 byte 1189）

```scala
--- live（want）
  final case class RegisterUserParams(email: String, password: String, triggeredBy: String, displayName: String, authMethod: String, phoneNumber: Option[String], userId: Id)
  // @knowledge 016f5865-7084-4c8e-9ce3-9f4a0eda71fc@684d46c3d6bfbdd0
  /** UpdateUserProfile 规则投影：IR-USER-CMD-005 / ir_cmd_Up
+++ truthsrc（got）
  final case class RegisterUserParams(email: String, password: String, triggeredBy: String, displayName: String, authMethod: String, phoneNumber: Option[String])
  // @knowledge 016f5865-7084-4c8e-9ce3-9f4a0eda71fc@684d46c3d6bfbdd0
  /** UpdateUserProfile 规则投影：IR-USER-CMD-005 / ir_cmd_UpdateUserProf
```

### app/net/imadz/metarch/domain/invariant/params/WorkTicketRuleParams.scala（rule-params·首差 @line 5 byte 124）

```scala
--- live（want）
import net.imadz.common.CommonTypes.Id
import net.imadz.metarch.domain.values._
/**
+++ truthsrc（got）
/**
 * 命令 → 领域规则参数的投影 VO（方案 A，2026-08-22，rules_domain_gen.mjs 生成）。
 * 业务不变性（InvariantRule）是 domain 层资产——规则只依赖领域实体状态、事件与这些投影 VO，
```

### app/net/imadz/metarch/domain/invariant/params/WorkgroupRuleParams.scala（rule-params·首差 @line 26 byte 1781）

```scala
--- live（want）
  final case class InviteWorkgroupMemberParams(userId: Id, triggeredBy: String, workgroupId: Id, displayName: Option[String], email: Option[String], phoneNumber: Option[String])
  // @knowledge 616fcfa3-4c78-4704-aad7-bc27d4cc834d@163ed5a1c1d95b5e
  /** RemoveWorkgroupMember 规则投影：ir_cmd_RemoveWorkgr
+++ truthsrc（got）
  final case class InviteWorkgroupMemberParams(userId: Id, triggeredBy: String, workgroupId: Id)
  // @knowledge 616fcfa3-4c78-4704-aad7-bc27d4cc834d@163ed5a1c1d95b5e
  /** RemoveWorkgroupMember 规则投影：ir_cmd_RemoveWorkgroupMember_triggered_by / ir_gen_ref_IR_WG_CMD_005_userId */
```

### test/net/imadz/metarch/domain/invariant/CemEdgeRulesSpec.scala（rules-spec·首差 @line 6 byte 277）

```scala
--- live（want）
// @knowledge abdbc772-b260-45c2-88eb-fa2c57e5d403@14ae9a76b36e0e8d
package net.imadz.metarch.domain.invariant

+++ truthsrc（got）
package net.imadz.metarch.domain.invariant

import java.time.Instant
```

### test/net/imadz/metarch/domain/invariant/DoRRulesSpec.scala（rules-spec·首差 @line 433 byte 50068）

```scala
--- live（want）
      val r = DoRRules.EvaluateDoRRule(DoRState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "REQUESTED", Id.of("00000000-0000-0000-0000-000000000001"), Nil, "{}", "{}", Nil, null, "", Nil, Id.of("00000000-0000-0000-0000-000000000001"
+++ truthsrc（got）
      val r = DoRRules.EvaluateDoRRule(DoRState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "REQUESTED", Id.of("00000000-0000-0000-0000-000000000001"), Nil, "{}", "{}", Nil, null, "", Nil, Id.of("00000000-0000-0000-0000-000000000001"
```

### test/net/imadz/metarch/domain/invariant/FieldModelDefinitionRulesSpec.scala（rules-spec·首差 @line 13 byte 769）

```scala
--- live（want）
// @knowledge c13d6293-80c2-4a5f-9a34-2c4afaaacfbe@d6ecfaf7991d4cc4
// @knowledge c14c4126-9200-4236-9734-3209c0cdf672@a37a7987fa1f9e86
// @knowledge c1c35788-2854-4ce5-a005-3d128432b754@9f56fa0e0c782568
+++ truthsrc（got）
// @knowledge c14c4126-9200-4236-9734-3209c0cdf672@a37a7987fa1f9e86
// @knowledge c1c35788-2854-4ce5-a005-3d128432b754@9f56fa0e0c782568
// @knowledge c528fb32-649d-4155-8189-cc215b8466ff@25332fb867d709a5
```

### test/net/imadz/metarch/domain/invariant/FsmDefinitionRulesSpec.scala（rules-spec·首差 @line 51 byte 2496）

```scala
--- live（want）
      val r = FsmDefinitionRules.UpdateFsmElementsRule(FsmDefinitionState(Id.of("00000000-0000-0000-0000-000000000001"), "ESTABLISHED", "DoR", List(FsmStateDef("REQUESTED", "INITIAL", "", "barry", "2026-09-01T00:00:00Z"), FsmStateDef("IN_PROGRESS", "NORMAL", "", "barry", "2026-09-01T00:00:00Z")), Li
+++ truthsrc（got）
      val r = FsmDefinitionRules.UpdateFsmElementsRule(FsmDefinitionState(Id.of("00000000-0000-0000-0000-000000000001"), "ESTABLISHED", "DoR", List(FsmStateDef("REQUESTED", "INITIAL", "", "barry", "2026-09-01T00:00:00Z"), FsmStateDef("IN_PROGRESS", "NORMAL", "", "barry", "2026-09-01T00:00:00Z")), Li
```

### test/net/imadz/metarch/domain/invariant/KnowledgePatchRulesSpec.scala（rules-spec·首差 @line 99 byte 8908）

```scala
--- live（want）
      val r = KnowledgePatchRules.MergeKnowledgePatchRule(KnowledgePatchState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "MERGE_REQUESTED", Nil, Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000
+++ truthsrc（got）
      val r = KnowledgePatchRules.MergeKnowledgePatchRule(KnowledgePatchState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "MERGE_REQUESTED", Nil, Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000
```

### test/net/imadz/metarch/domain/invariant/OrganizationMemberRulesSpec.scala（rules-spec·首差 @line 62 byte 3084）

```scala
--- live（want）
      val r = OrganizationMemberRules.InviteTenantMemberRule(OrganizationMemberState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "PENDING", Id.of("00000000-0000-0000-0000-000000000001"), "", "", "", "", "", null, null), InviteTenantM
+++ truthsrc（got）
      val r = OrganizationMemberRules.InviteTenantMemberRule(OrganizationMemberState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "PENDING", Id.of("00000000-0000-0000-0000-000000000001"), "", "", "", "", "", null, null), InviteTenantM
```

### test/net/imadz/metarch/domain/invariant/ProjectRulesSpec.scala（rules-spec·首差 @line 70 byte 3452）

```scala
--- live（want）
      val r = ProjectRules.InitiateProjectRule(ProjectState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "initiated", Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000001"), "", "", null, "", null
+++ truthsrc（got）
      val r = ProjectRules.InitiateProjectRule(ProjectState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "initiated", Id.of("00000000-0000-0000-0000-000000000001"), Id.of("00000000-0000-0000-0000-000000000001"), "", "", null, "", null
```

### test/net/imadz/metarch/domain/invariant/ReadModelDefinitionRulesSpec.scala（rules-spec·首差 @line 5 byte 223）

```scala
--- live（want）
// @knowledge d3d722c4-31e1-4865-ad1e-670c5621071a@b062b1229777effa
// @knowledge e3dfe4f2-8414-4305-a498-e895dfea0445@59554681f4180b07
package net.imadz.metarch.domain.invariant
+++ truthsrc（got）
// @knowledge e3dfe4f2-8414-4305-a498-e895dfea0445@59554681f4180b07
package net.imadz.metarch.domain.invariant

```

### test/net/imadz/metarch/domain/invariant/RoleCommandBindingRulesSpec.scala（rules-spec·首差 @line 5 byte 209）

```scala
--- live（want）
// @knowledge f80255bd-352e-4d86-b30f-6b2e0c9cb1c6@d8611e665e8215bc
package net.imadz.metarch.domain.invariant

+++ truthsrc（got）
package net.imadz.metarch.domain.invariant

import java.time.Instant
```

### test/net/imadz/metarch/domain/invariant/SessionRulesSpec.scala（rules-spec·首差 @line 197 byte 19571）

```scala
--- live（want）
      val r = SessionRules.InviteParticipantRule(SessionState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "prepared", Id.of("00000000-0000-0000-0000-000000000001"), Nil, Nil, null, null, null, Nil), InviteParticipantParams(Id.of("000
+++ truthsrc（got）
      val r = SessionRules.InviteParticipantRule(SessionState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "prepared", Id.of("00000000-0000-0000-0000-000000000001"), Nil, Nil, null, null, null, Nil), InviteParticipantParams(Id.of("000
```

### test/net/imadz/metarch/domain/invariant/TruthSourceProvenanceRulesSpec.scala（rules-spec·首差 @line 3 byte 87）

```scala
--- live（want）
// @knowledge 1d8059ed-d48f-4eb8-81e2-c12e775e2aa0@cbf8b2f060f6c914
// @knowledge d02fe08c-5bd4-47df-9eed-3ce8dbfae0df@f39ee4284088e02d
package net.imadz.metarch.domain.invariant
+++ truthsrc（got）
// @knowledge d02fe08c-5bd4-47df-9eed-3ce8dbfae0df@f39ee4284088e02d
package net.imadz.metarch.domain.invariant

```

### test/net/imadz/metarch/domain/invariant/UseCaseDefinitionRulesSpec.scala（rules-spec·首差 @line 5 byte 209）

```scala
--- live（want）
// @knowledge f2a7c2cc-814f-441f-9fbf-a45441c7e26a@c623e0e0ccce9dbd
package net.imadz.metarch.domain.invariant

+++ truthsrc（got）
package net.imadz.metarch.domain.invariant

import java.time.Instant
```

### test/net/imadz/metarch/domain/invariant/UserRulesSpec.scala（rules-spec·首差 @line 33 byte 1488）

```scala
--- live（want）
      authMethod: String = "",
      displayName: String = "",
      registeredAt: Instant = null,
+++ truthsrc（got）
      passwordSalt: String = "",
      passwordHash: String = "",
      authMethod: String = "",
```

### test/net/imadz/metarch/domain/invariant/ValueObjectDefinitionRulesSpec.scala（rules-spec·首差 @line 5 byte 209）

```scala
--- live（want）
// @knowledge d161757e-a82e-4352-aa36-898a8038a27c@a572a443a31eabc4
package net.imadz.metarch.domain.invariant

+++ truthsrc（got）
package net.imadz.metarch.domain.invariant

import java.time.Instant
```

### test/net/imadz/metarch/domain/invariant/WorkTicketRulesSpec.scala（rules-spec·首差 @line 55 byte 2420）

```scala
--- live（want）
      val r = WorkTicketRules.UpdateWorkTicketItemsRule(WorkTicketState(Id.of("00000000-0000-0000-0000-000000000001"), "APPROVED", "aggregate", net.imadz.common.Id.of("6252d057-1760-33d2-85e2-e41a2b1e7743"), "06", "FSM", "示例工单", List(ChecklistItem("条目1", "CONFIRMED", "", "ai-inference", "barry", "20
+++ truthsrc（got）
      val r = WorkTicketRules.UpdateWorkTicketItemsRule(WorkTicketState(Id.of("00000000-0000-0000-0000-000000000001"), "APPROVED", "aggregate", net.imadz.common.Id.of("6252d057-1760-33d2-85e2-e41a2b1e7743"), "06", "FSM", "示例工单", List(ChecklistItem("条目1", "CONFIRMED", "", "ai-inference", "barry", "20
```

### test/net/imadz/metarch/domain/invariant/WorkgroupRulesSpec.scala（rules-spec·首差 @line 218 byte 25809）

```scala
--- live（want）
      val r = WorkgroupRules.InviteWorkgroupMemberRule(WorkgroupState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "active", "", net.imadz.common.Id.of("1e4e0961-7a69-31fa-bccc-8cb7e5c58039"), List(net.imadz.common.Id.of("1e4e0961-7a6
+++ truthsrc（got）
      val r = WorkgroupRules.InviteWorkgroupMemberRule(WorkgroupState(Id.of("00000000-0000-0000-0000-000000000001"), net.imadz.common.Id.of("02129bb8-6106-3d1a-852c-592e2dc6b383"), "active", "", net.imadz.common.Id.of("1e4e0961-7a69-31fa-bccc-8cb7e5c58039"), List(net.imadz.common.Id.of("1e4e0961-7a6
```

