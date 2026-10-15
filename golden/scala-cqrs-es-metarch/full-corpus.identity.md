# truthsrc 全语料恒等报告（V4-5·切流拍板输入·非拍板本身）

- 日期：2026-10-15；live 参照：`/Users/zhongdj/Workspaces/ingested-app`（新鲜度门：backend-codegen `tools/kn_repo_freshness.mjs` exit 0·锚 8948/元素 2861 全 match）；canonical：`golden/scala-cqrs-es-metarch/full-corpus.canonical.json`（27 聚合）
- 范围：三面 19 kind（skeleton 8－共享 2＋rules 7＋api 6；共享 Behaviors/CommandHelpers 按 live 管线序归 rules 面所有）。storage/persistence/Bootstrap/ExecutableSpec/投影/AggregateStateApi/Auth/conf/routes 等**未移植面不在对表范围**（EP 不搬清单＋顺延批）。

## 头条数字

| 判定 | 件数 |
|---|---|
| identical | 277 |
| owned-by-other | 108 |
| diff | 8 |

**恒等按面**：skeleton 102 · rules 143 · api 32 ｜ **diff 按 kind**：aggregate-root 2 · protocol 1 · entity 3 · rules 1 · rules-spec 1

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
| rules | command-helpers-rules | DoR | app/net/imadz/metarch/application/aggregates/behaviors/DoRCommandHelpers.scala | identical | — |
| rules | behaviors-rules | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | FieldModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FieldModelDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | FsmDefinition | app/net/imadz/metarch/application/aggregates/behaviors/FsmDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchBehaviors.scala | identical | — |
| rules | command-helpers-rules | KnowledgePatch | app/net/imadz/metarch/application/aggregates/behaviors/KnowledgePatchCommandHelpers.scala | identical | — |
| rules | behaviors-rules | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogBehaviors.scala | identical | — |
| rules | command-helpers-rules | ModelCatalog | app/net/imadz/metarch/application/aggregates/behaviors/ModelCatalogCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteBehaviors.scala | identical | — |
| rules | command-helpers-rules | Note | app/net/imadz/metarch/application/aggregates/behaviors/NoteCommandHelpers.scala | identical | — |
| rules | behaviors-rules | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberBehaviors.scala | identical | — |
| rules | command-helpers-rules | OrganizationMember | app/net/imadz/metarch/application/aggregates/behaviors/OrganizationMemberCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectBehaviors.scala | identical | — |
| rules | command-helpers-rules | Project | app/net/imadz/metarch/application/aggregates/behaviors/ProjectCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionBehaviors.scala | identical | — |
| rules | command-helpers-rules | Question | app/net/imadz/metarch/application/aggregates/behaviors/QuestionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | ReadModelDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ReadModelDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationBehaviors.scala | identical | — |
| rules | command-helpers-rules | Relation | app/net/imadz/metarch/application/aggregates/behaviors/RelationCommandHelpers.scala | identical | — |
| rules | behaviors-rules | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingBehaviors.scala | identical | — |
| rules | command-helpers-rules | RoleCommandBinding | app/net/imadz/metarch/application/aggregates/behaviors/RoleCommandBindingCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionBehaviors.scala | identical | — |
| rules | command-helpers-rules | Session | app/net/imadz/metarch/application/aggregates/behaviors/SessionCommandHelpers.scala | identical | — |
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
| rules | command-helpers-rules | User | app/net/imadz/metarch/application/aggregates/behaviors/UserCommandHelpers.scala | identical | — |
| rules | behaviors-rules | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionBehaviors.scala | identical | — |
| rules | command-helpers-rules | ValueObjectDefinition | app/net/imadz/metarch/application/aggregates/behaviors/ValueObjectDefinitionCommandHelpers.scala | identical | — |
| rules | behaviors-rules | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketBehaviors.scala | identical | — |
| rules | command-helpers-rules | WorkTicket | app/net/imadz/metarch/application/aggregates/behaviors/WorkTicketCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupBehaviors.scala | identical | — |
| rules | command-helpers-rules | Workgroup | app/net/imadz/metarch/application/aggregates/behaviors/WorkgroupCommandHelpers.scala | identical | — |
| rules | behaviors-rules | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopBehaviors.scala | identical | — |
| rules | command-helpers-rules | Workshop | app/net/imadz/metarch/application/aggregates/behaviors/WorkshopCommandHelpers.scala | identical | — |
| rules | rules | CemEdge | app/net/imadz/metarch/domain/invariant/CemEdgeRules.scala | identical | — |
| rules | rules | Concept | app/net/imadz/metarch/domain/invariant/ConceptRules.scala | identical | — |
| rules | rules | ContextRelation | app/net/imadz/metarch/domain/invariant/ContextRelationRules.scala | identical | — |
| rules | rules | Context | app/net/imadz/metarch/domain/invariant/ContextRules.scala | identical | — |
| rules | rules | DoR | app/net/imadz/metarch/domain/invariant/DoRRules.scala | identical | — |
| rules | rules | FieldModelDefinition | app/net/imadz/metarch/domain/invariant/FieldModelDefinitionRules.scala | identical | — |
| rules | rules | FsmDefinition | app/net/imadz/metarch/domain/invariant/FsmDefinitionRules.scala | identical | — |
| rules | rules | KnowledgePatch | app/net/imadz/metarch/domain/invariant/KnowledgePatchRules.scala | identical | — |
| rules | rules | ModelCatalog | app/net/imadz/metarch/domain/invariant/ModelCatalogRules.scala | identical | — |
| rules | rules | Note | app/net/imadz/metarch/domain/invariant/NoteRules.scala | identical | — |
| rules | rules | OrganizationMember | app/net/imadz/metarch/domain/invariant/OrganizationMemberRules.scala | identical | — |
| rules | rules | Project | app/net/imadz/metarch/domain/invariant/ProjectRules.scala | identical | — |
| rules | rules | Question | app/net/imadz/metarch/domain/invariant/QuestionRules.scala | identical | — |
| rules | rules | ReadModelDefinition | app/net/imadz/metarch/domain/invariant/ReadModelDefinitionRules.scala | identical | — |
| rules | rules | Relation | app/net/imadz/metarch/domain/invariant/RelationRules.scala | identical | — |
| rules | rules | RoleCommandBinding | app/net/imadz/metarch/domain/invariant/RoleCommandBindingRules.scala | identical | — |
| rules | rules | Session | app/net/imadz/metarch/domain/invariant/SessionRules.scala | identical | — |
| rules | rules | Stage | app/net/imadz/metarch/domain/invariant/StageRules.scala | identical | — |
| rules | rules | Subdomain | app/net/imadz/metarch/domain/invariant/SubdomainRules.scala | identical | — |
| rules | rules | Tenant | app/net/imadz/metarch/domain/invariant/TenantRules.scala | identical | — |
| rules | rules | TruthSourceProvenance | app/net/imadz/metarch/domain/invariant/TruthSourceProvenanceRules.scala | identical | — |
| rules | rules | UseCaseDefinition | app/net/imadz/metarch/domain/invariant/UseCaseDefinitionRules.scala | identical | — |
| rules | rules | User | app/net/imadz/metarch/domain/invariant/UserRules.scala | diff | 35 |
| rules | rules | ValueObjectDefinition | app/net/imadz/metarch/domain/invariant/ValueObjectDefinitionRules.scala | identical | — |
| rules | rules | WorkTicket | app/net/imadz/metarch/domain/invariant/WorkTicketRules.scala | identical | — |
| rules | rules | Workgroup | app/net/imadz/metarch/domain/invariant/WorkgroupRules.scala | identical | — |
| rules | rules | Workshop | app/net/imadz/metarch/domain/invariant/WorkshopRules.scala | identical | — |
| rules | rule-params | CemEdge | app/net/imadz/metarch/domain/invariant/params/CemEdgeRuleParams.scala | identical | — |
| rules | rule-params | Concept | app/net/imadz/metarch/domain/invariant/params/ConceptRuleParams.scala | identical | — |
| rules | rule-params | ContextRelation | app/net/imadz/metarch/domain/invariant/params/ContextRelationRuleParams.scala | identical | — |
| rules | rule-params | Context | app/net/imadz/metarch/domain/invariant/params/ContextRuleParams.scala | identical | — |
| rules | rule-params | DoR | app/net/imadz/metarch/domain/invariant/params/DoRRuleParams.scala | identical | — |
| rules | rule-params | FieldModelDefinition | app/net/imadz/metarch/domain/invariant/params/FieldModelDefinitionRuleParams.scala | identical | — |
| rules | rule-params | FsmDefinition | app/net/imadz/metarch/domain/invariant/params/FsmDefinitionRuleParams.scala | identical | — |
| rules | rule-params | KnowledgePatch | app/net/imadz/metarch/domain/invariant/params/KnowledgePatchRuleParams.scala | identical | — |
| rules | rule-params | ModelCatalog | app/net/imadz/metarch/domain/invariant/params/ModelCatalogRuleParams.scala | identical | — |
| rules | rule-params | Note | app/net/imadz/metarch/domain/invariant/params/NoteRuleParams.scala | identical | — |
| rules | rule-params | OrganizationMember | app/net/imadz/metarch/domain/invariant/params/OrganizationMemberRuleParams.scala | identical | — |
| rules | rule-params | Project | app/net/imadz/metarch/domain/invariant/params/ProjectRuleParams.scala | identical | — |
| rules | rule-params | Question | app/net/imadz/metarch/domain/invariant/params/QuestionRuleParams.scala | identical | — |
| rules | rule-params | ReadModelDefinition | app/net/imadz/metarch/domain/invariant/params/ReadModelDefinitionRuleParams.scala | identical | — |
| rules | rule-params | Relation | app/net/imadz/metarch/domain/invariant/params/RelationRuleParams.scala | identical | — |
| rules | rule-params | RoleCommandBinding | app/net/imadz/metarch/domain/invariant/params/RoleCommandBindingRuleParams.scala | identical | — |
| rules | rule-params | Session | app/net/imadz/metarch/domain/invariant/params/SessionRuleParams.scala | identical | — |
| rules | rule-params | Stage | app/net/imadz/metarch/domain/invariant/params/StageRuleParams.scala | identical | — |
| rules | rule-params | Subdomain | app/net/imadz/metarch/domain/invariant/params/SubdomainRuleParams.scala | identical | — |
| rules | rule-params | Tenant | app/net/imadz/metarch/domain/invariant/params/TenantRuleParams.scala | identical | — |
| rules | rule-params | TruthSourceProvenance | app/net/imadz/metarch/domain/invariant/params/TruthSourceProvenanceRuleParams.scala | identical | — |
| rules | rule-params | UseCaseDefinition | app/net/imadz/metarch/domain/invariant/params/UseCaseDefinitionRuleParams.scala | identical | — |
| rules | rule-params | User | app/net/imadz/metarch/domain/invariant/params/UserRuleParams.scala | identical | — |
| rules | rule-params | ValueObjectDefinition | app/net/imadz/metarch/domain/invariant/params/ValueObjectDefinitionRuleParams.scala | identical | — |
| rules | rule-params | WorkTicket | app/net/imadz/metarch/domain/invariant/params/WorkTicketRuleParams.scala | identical | — |
| rules | rule-params | Workgroup | app/net/imadz/metarch/domain/invariant/params/WorkgroupRuleParams.scala | identical | — |
| rules | rule-params | Workshop | app/net/imadz/metarch/domain/invariant/params/WorkshopRuleParams.scala | identical | — |
| rules | policies | Concept | app/net/imadz/metarch/domain/policy/ConceptPolicies.scala | identical | — |
| rules | policies | KnowledgePatch | app/net/imadz/metarch/domain/policy/KnowledgePatchPolicies.scala | identical | — |
| rules | policies | ModelCatalog | app/net/imadz/metarch/domain/policy/ModelCatalogPolicies.scala | identical | — |
| rules | policies | Session | app/net/imadz/metarch/domain/policy/SessionPolicies.scala | identical | — |
| rules | policies | Tenant | app/net/imadz/metarch/domain/policy/TenantPolicies.scala | identical | — |
| rules | rules-spec | CemEdge | test/net/imadz/metarch/domain/invariant/CemEdgeRulesSpec.scala | identical | — |
| rules | rules-spec | Concept | test/net/imadz/metarch/domain/invariant/ConceptRulesSpec.scala | identical | — |
| rules | rules-spec | ContextRelation | test/net/imadz/metarch/domain/invariant/ContextRelationRulesSpec.scala | identical | — |
| rules | rules-spec | Context | test/net/imadz/metarch/domain/invariant/ContextRulesSpec.scala | identical | — |
| rules | rules-spec | DoR | test/net/imadz/metarch/domain/invariant/DoRRulesSpec.scala | identical | — |
| rules | rules-spec | FieldModelDefinition | test/net/imadz/metarch/domain/invariant/FieldModelDefinitionRulesSpec.scala | identical | — |
| rules | rules-spec | FsmDefinition | test/net/imadz/metarch/domain/invariant/FsmDefinitionRulesSpec.scala | identical | — |
| rules | rules-spec | KnowledgePatch | test/net/imadz/metarch/domain/invariant/KnowledgePatchRulesSpec.scala | identical | — |
| rules | rules-spec | ModelCatalog | test/net/imadz/metarch/domain/invariant/ModelCatalogRulesSpec.scala | identical | — |
| rules | rules-spec | Note | test/net/imadz/metarch/domain/invariant/NoteRulesSpec.scala | identical | — |
| rules | rules-spec | OrganizationMember | test/net/imadz/metarch/domain/invariant/OrganizationMemberRulesSpec.scala | identical | — |
| rules | rules-spec | Project | test/net/imadz/metarch/domain/invariant/ProjectRulesSpec.scala | identical | — |
| rules | rules-spec | Question | test/net/imadz/metarch/domain/invariant/QuestionRulesSpec.scala | identical | — |
| rules | rules-spec | ReadModelDefinition | test/net/imadz/metarch/domain/invariant/ReadModelDefinitionRulesSpec.scala | identical | — |
| rules | rules-spec | Relation | test/net/imadz/metarch/domain/invariant/RelationRulesSpec.scala | identical | — |
| rules | rules-spec | RoleCommandBinding | test/net/imadz/metarch/domain/invariant/RoleCommandBindingRulesSpec.scala | identical | — |
| rules | rules-spec | Session | test/net/imadz/metarch/domain/invariant/SessionRulesSpec.scala | identical | — |
| rules | rules-spec | Stage | test/net/imadz/metarch/domain/invariant/StageRulesSpec.scala | identical | — |
| rules | rules-spec | Subdomain | test/net/imadz/metarch/domain/invariant/SubdomainRulesSpec.scala | identical | — |
| rules | rules-spec | Tenant | test/net/imadz/metarch/domain/invariant/TenantRulesSpec.scala | identical | — |
| rules | rules-spec | TruthSourceProvenance | test/net/imadz/metarch/domain/invariant/TruthSourceProvenanceRulesSpec.scala | identical | — |
| rules | rules-spec | UseCaseDefinition | test/net/imadz/metarch/domain/invariant/UseCaseDefinitionRulesSpec.scala | identical | — |
| rules | rules-spec | User | test/net/imadz/metarch/domain/invariant/UserRulesSpec.scala | diff | 33 |
| rules | rules-spec | ValueObjectDefinition | test/net/imadz/metarch/domain/invariant/ValueObjectDefinitionRulesSpec.scala | identical | — |
| rules | rules-spec | WorkTicket | test/net/imadz/metarch/domain/invariant/WorkTicketRulesSpec.scala | identical | — |
| rules | rules-spec | Workgroup | test/net/imadz/metarch/domain/invariant/WorkgroupRulesSpec.scala | identical | — |
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

