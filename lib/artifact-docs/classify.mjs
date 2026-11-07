import { basename } from 'node:path';

const c = (categories, disposition, reason) => ({ categories: [...new Set(categories)].sort(), disposition, reason });
const artifact = (...categories) => c(categories, 'artifact-source', 'Concrete source shape and role matched by the catalogue classifier; ownership/profile is documented separately.');
const mechanism = (...categories) => c(categories, 'producer-support', 'Parser, builder, template, validator or writer supporting these documented output responsibilities.');
const modelMap = {
  ValueObject: ['value-object'], DomainEntity: ['domain-entity', 'domain-state'], EntityBehavior: ['event-handler'],
  InvariantRule: ['invariant-rule'], Policy: ['policy-decision'], DomainService: ['domain-service'],
  AggregateRoot: ['aggregate-root'], AggregateBehavior: ['aggregate-behavior'], AggregateRules: ['invariant-rule'],
  AggregateFactory: ['aggregate-factory'], AggregateProtocol: ['application-protocol'], AggregateRepository: ['aggregate-repository-port'],
  CommandHelper: ['command-helper'], CommandHelpers: ['command-helper'], ApplicationService: ['application-service'], QueryService: ['query-service'],
  Connector: ['external-connector-port'], ConnectorImpl: ['connector-implementation'],
  Projection: ['read-model', 'projection-bootstrap'], ProjectionApplyEvent: ['projection-apply-event'], ProjectionHandler: ['projection-handler'],
  ProjectionRepository: ['projection-repository-port'], ProjectionRepositoryImpl: ['projection-repository-implementation'],
  AggregateRepositoryImpl: ['aggregate-repository-implementation'], Adapter: ['event-adapter', 'snapshot-adapter'],
  EventAdapter: ['event-adapter'], SnapshotAdapter: ['snapshot-adapter'], AggregateConverter: ['proto-converter'],
  ProtoFile: ['protobuf-schema'], Proto: ['protobuf-schema'], Controller: ['http-controller'], AggregateStateController: ['http-controller'],
  CommandDsl: ['command-endpoint-dsl'], RoutesFragment: ['route-definition'], Routes: ['route-definition'],
  Bootstrap: ['aggregate-bootstrap', 'projection-bootstrap', 'saga-bootstrap'], ApplicationBootstrap: ['application-bootstrap'],
  SagaContext: ['saga-legacy-context'], SagaDefinition: ['saga-transactor'], SagaParticipant: ['saga-participant'],
  SagaTriggerModels: ['saga-trigger'], SagaTrigger: ['saga-trigger'], SagaTriggerProtocol: ['saga-trigger'], SagaTriggerEntity: ['saga-trigger'],
  SagaTriggerRoot: ['saga-trigger'], SagaTriggerBehaviors: ['saga-trigger'], StrictSagaModule: ['strict-saga-definition'],
  FixtureHost: ['saga-invocation-host', 'generated-test'], InvocationHost: ['saga-invocation-host'],
  ProductApplication: ['saga-invocation-host', 'monarch-execution-plan'], ProductDomain: ['domain-entity', 'invariant-rule'],
  ProductService: ['service-runtime'], ProductDesign: ['design-review-artifact']
};
const generatorMap = {
  '_template': ['teaching-summary'], 'ts-types': ['typescript-types'], 'adapter-dsl': ['event-adapter', 'snapshot-adapter'],
  'aggregate-dsl': ['aggregate-root', 'domain-state', 'domain-entity', 'application-protocol', 'aggregate-behavior', 'aggregate-factory', 'event-handler'], 'api-dsl': ['http-controller', 'http-dto', 'command-endpoint-dsl'],
  'auth-dsl': ['authorization-policy', 'role-and-view-key-map'], 'bootstrap-dsl': ['application-bootstrap', 'aggregate-bootstrap'],
  'command-dsl': ['application-protocol', 'command-helper'], 'connector-dsl': ['external-connector-port', 'connector-implementation'],
  'converter-dsl': ['proto-converter'], 'ddl-dsl': ['projection-schema'], 'event-dsl': ['event-handler', 'domain-protocol'],
  'invariant-dsl': ['invariant-rule', 'rule-parameters'], 'monarch-dsl': ['monarch-execution-plan', 'monarch-checkpoint-host'],
  'policy-dsl': ['policy-decision', 'policy-handler', 'policy-mechanics', 'policy-runner', 'policy-bootstrap', 'projection-runtime-mechanism'],
  'projection-dsl': ['read-model', 'projection-handler', 'projection-repository-port', 'projection-repository-implementation', 'projection-schema'],
  'proto-dsl': ['protobuf-schema'], 'readmodel-dsl': ['read-model'], 'repository-dsl': ['aggregate-repository-port', 'aggregate-repository-implementation'],
  'saga-dsl': ['saga-transactor', 'saga-participant', 'strict-saga-definition', 'saga-invocation-host', 'saga-contract-report'],
  'service-dsl': ['application-service'], 'valueobject-dsl': ['value-object'], 'product-design-review': ['design-review-artifact'],
  'scala-cqrs-domain': ['domain-entity', 'domain-state', 'domain-protocol', 'aggregate-root', 'invariant-rule', 'rule-parameters', 'value-object', 'exact-value-codec', 'event-handler', 'command-helper', 'protobuf-schema', 'proto-converter', 'protobuf-serializer', 'event-adapter', 'snapshot-adapter', 'external-event-bridge', 'project-build', 'generated-test'],
  'scala-cqrs-application': ['saga-transactor', 'saga-phase-port', 'strict-saga-definition', 'saga-invocation-host', 'external-connector-port', 'monarch-execution-plan', 'child-run-host', 'effect-host', 'project-build', 'generated-test'],
  'scala-cqrs-child-application': ['child-run-host', 'saga-invocation-host', 'monarch-execution-plan'],
  'scala-cqrs-effect-application': ['effect-host', 'saga-invocation-host', 'monarch-execution-plan'],
  'scala-cqrs-domain-kernel-v1': ['value-object', 'exact-value-codec', 'domain-protocol', 'domain-state', 'rule-parameters', 'computation-port', 'signature-value-closure', 'protobuf-schema', 'proto-converter', 'project-build', 'generated-test'],
  'scala-cqrs-play-service': ['aggregate-root', 'aggregate-behavior', 'application-protocol', 'aggregate-factory', 'aggregate-repository-port', 'aggregate-repository-implementation', 'aggregate-bootstrap', 'service-runtime', 'service-contract', 'application-configuration', 'page-renderer', 'projection-handler', 'projection-schema', 'projection-repository-implementation', 'projection-apply-event', 'service-test-configuration']
};
const jsRender = {
  'build-state-models.mjs': ['domain-state', 'domain-entity'],
  'aggregate-state.mjs': ['domain-state', 'domain-entity'],
  'build-aggregate-models.mjs': ['aggregate-root', 'application-protocol', 'aggregate-behavior', 'aggregate-factory', 'aggregate-repository-implementation', 'aggregate-bootstrap'],
  'aggregate-names.mjs': ['artifact-generator'],
  'aggregate-protocol.mjs': ['aggregate-root', 'application-protocol'],
  'aggregate-behavior.mjs': ['aggregate-behavior'],
  'aggregate-factory.mjs': ['aggregate-root', 'aggregate-factory'],
  'aggregate-bootstrap.mjs': ['aggregate-bootstrap'],
  'aggregate-repository.mjs': ['aggregate-repository-implementation'],
  'render-aggregate-layers.mjs': ['aggregate-root', 'application-protocol', 'aggregate-behavior', 'aggregate-factory', 'aggregate-repository-port', 'aggregate-repository-implementation', 'aggregate-bootstrap'],
  'render-domain.mjs': generatorMap['scala-cqrs-domain'], 'render-actor.mjs': ['aggregate-root', 'aggregate-behavior'],
  'render-adapters.mjs': ['event-adapter', 'snapshot-adapter'], 'render-values.mjs': ['value-object', 'exact-value-codec'],
  'render-serialization.mjs': ['protobuf-schema', 'proto-converter', 'protobuf-serializer'], 'serialization.mjs': ['protobuf-schema', 'proto-converter'],
  'render-service.mjs': ['service-contract', 'service-runtime', 'http-controller', 'route-definition'],
  'render-service-pages.mjs': ['page-renderer', 'service-runtime'], 'render-configuration.mjs': ['application-configuration', 'service-test-configuration'],
  'render-journal-domain.mjs': ['projection-apply-event'], 'render-journal-readside.mjs': ['projection-handler', 'projection-schema', 'readside-watchdog'],
  'render-journal-repository.mjs': ['projection-repository-implementation', 'projection-schema'],
  'render-technical-ports.mjs': ['external-connector-port'], 'render-build.mjs': ['project-build'],
  'render-host.mjs': ['strict-saga-definition', 'saga-phase-port'], 'render-host-io.mjs': ['saga-invocation-host', 'external-connector-port'],
  'render-host-adapters.mjs': ['saga-invocation-host', 'saga-serializer', 'protobuf-schema'],
  'render-execution.mjs': ['monarch-execution-plan', 'protobuf-schema'], 'render-invocation-execution.mjs': ['monarch-execution-plan', 'protobuf-schema'],
  'render-invocation-host.mjs': ['saga-invocation-host'], 'render-pipeline-invocation.mjs': ['saga-invocation-host'],
  'render-child-hosts.mjs': ['child-run-host'], 'render-child-plans.mjs': ['child-run-host', 'protobuf-schema'],
  'render-effect-hosts.mjs': ['effect-host'], 'render-effect-support.mjs': ['effect-host'],
  'render-test-support.mjs': ['service-test-configuration'], 'scaffold.mjs': ['project-build', 'application-configuration', 'generated-test']
};
const bcTools = {
  'gen_pipeline.mjs': ['artifact-generator', 'artifact-manifest'], 'gen_provenance.mjs': ['code-provenance'],
  'gen_function_specs.mjs': ['function-contract-test'], 'rules_domain_gen.mjs': ['invariant-rule', 'rule-parameters', 'aggregate-behavior', 'command-helper', 'event-handler', 'policy-decision', 'computation-port', 'port-bridge', 'generated-test'],
  'gen_projection_handlers.mjs': ['projection-handler'], 'gen_policy_exec.mjs': ['policy-decision', 'policy-handler', 'policy-mechanics', 'policy-runner', 'policy-bootstrap'],
  'gen_api_layer.mjs': ['http-controller', 'http-dto', 'route-definition', 'command-endpoint-dsl', 'role-and-view-key-map'],
  'gen_api_controllers.mjs': ['http-controller', 'http-dto'], 'gen_projection_ddl.mjs': ['projection-schema', 'vector-projection'],
  'tdd_test_gen.mjs': ['generated-test'], 'gen_repository_specs.mjs': ['generated-test'], 'gen_manifest.mjs': ['artifact-manifest'],
  'apply_manifest.mjs': ['artifact-manifest', 'generation-ledger'], 'ledger_append.mjs': ['generation-ledger'],
  'multi_project_handsewn_bridge.mjs': ['extension-implementation', 'port-bridge'], 'multi_project_repo_bind_patch.mjs': ['port-binding-module'],
  'multi_project_test_arity_patch.mjs': ['generated-test'], 'artifact_conformance_audit.mjs': ['verification-runner'],
  'artifact_registry_check.mjs': ['artifact-generator'], 'territory_lib.mjs': ['artifact-manifest'],
  'gen_ingest_index.mjs': ['code-provenance'], 'kn_push_code_anchors.mjs': ['code-anchor']
};

function code(file, text) {
  const name = basename(file).replace(/\.(scala|proto|mjs|js|ts)$/, '');
  if (/\.(sbt|conf|properties)$/.test(file)) return artifact(file.endsWith('.sbt') || file.endsWith('.properties') ? 'project-build' : 'application-configuration');
  if (/\/test\/|\/src\/test\//.test('/' + file) || /Spec$|Test$|AcceptanceMain$|CrashRecoveryMain$|Fixture$/.test(name)) return artifact('independent-business-oracle', 'generated-test');
  if (file.endsWith('.proto')) return artifact('protobuf-schema');
  if (file.endsWith('.sql')) return artifact('projection-schema');
  if (/\.html$/.test(file) || /BrowserPages|PagesController/.test(name)) return artifact('page-renderer');
  if (/FlowPorts/.test(name)) return artifact('application-flow-port', 'signature-value-closure');
  if (/IdentityStoreApi/.test(name)) return artifact('identity-store-port');
  if (/GraphProjectionRepository$/.test(name)) return artifact('graph-store-port');
  if (/ConceptDeltaAdjudicator/.test(name)) return artifact('computation-port');
  if (/ContentFingerprintPort/.test(name)) return artifact('computation-port', 'port-bridge');
  if (/RepositoryBindingModule|BootstrapModule$/.test(name)) return artifact('port-binding-module', 'application-bootstrap');
  if (/Module$/.test(name)) return artifact('port-binding-module');
  if (/PolicyMachine|ViewMachine|DlqBury|FailureVerdict/.test(name)) return artifact('projection-runtime-mechanism');
  if (/PolicyOn.*Bootstrap/.test(name)) return artifact('policy-bootstrap');
  if (/PolicyOn.*Runner/.test(name)) return artifact('policy-runner');
  if (/PolicyOn.*Handler/.test(name)) return artifact('policy-handler');
  if (/Mechanics$/.test(name)) return artifact('policy-mechanics');
  if (/Policies$|Policy$/.test(name)) return artifact('policy-decision');
  if (/DomainHandler$|ApplyEvent$/.test(name)) return artifact('projection-apply-event');
  if (/\/application\/projection\/handlers\//.test(file)) return artifact('projection-handler');
  if (/ProjectionTailWatchdog/.test(name)) return artifact('readside-watchdog');
  if (/Projection$/.test(name)) return artifact('projection-handler', 'projection-bootstrap');
  if (/ReadsideSchema$|ReadsideRepository$/.test(name)) return artifact('projection-repository-implementation', 'projection-schema');
  if (/ReadsideDomain$/.test(name)) return artifact('projection-apply-event');
  if (/Readside$/.test(name)) return artifact('query-service');
  if (/\/projection\/repository\//.test(file)) return artifact('projection-repository-port');
  if (/\/repositories\/projection\//.test(file)) return artifact('projection-repository-implementation');
  if (/DecisionView$|GraphView$|SemanticView$|ProgressView$|ListView$|Lookup.*View$/.test(name)) return artifact('read-model');
  if (/\/application\/projection\//.test(file)) return artifact('read-model', 'projection-handler');
  if (/\/domain\/values\//.test(file)) return artifact('value-object');
  if (/\/invariant\/params\//.test(file)) return artifact('rule-parameters');
  if (/Rules$|Rule$/.test(name)) return artifact('invariant-rule');
  if (/EventHandler$/.test(name)) return artifact('event-handler');
  if (/Entity$/.test(name)) return artifact('domain-entity');
  if (/State$/.test(name)) return artifact('domain-state');
  if (/CommandHelpers$|Computations$/.test(name)) return artifact('command-helper');
  if (/Behaviors?$/.test(name) && /aggregates/.test(file)) return artifact('aggregate-behavior');
  if (/AggregateFactory$|Factory$/.test(name) && !/Service/.test(name)) return artifact('aggregate-factory');
  if (/Aggregate$/.test(name)) return artifact('aggregate-root');
  if (/Protocol$/.test(name)) return artifact('application-protocol');
  if (/RepositoryImpl$/.test(name)) return artifact(/Graph/.test(name) ? 'graph-projection' : 'aggregate-repository-implementation');
  if (/Repository$/.test(name)) return artifact('aggregate-repository-port');
  if (/Bootstrap$/.test(name)) return artifact(/Application/.test(name) ? 'application-bootstrap' : /Saga/.test(name) ? 'saga-bootstrap' : /View|Projection/.test(name) ? 'projection-bootstrap' : 'aggregate-bootstrap');
  if (/ProtoConverters?|DomainConverters|Converter/.test(name)) return artifact('proto-converter');
  if (/SnapshotAdapter/.test(name)) return artifact('snapshot-adapter');
  if (/EventAdapter/.test(name)) return artifact('event-adapter');
  if (/Adapters$/.test(name)) return artifact('event-adapter', 'snapshot-adapter');
  if (/SerializationExtension|SerializationStrategies/.test(name)) return artifact('serialization-registration');
  if (/Serializer/.test(name)) return artifact('protobuf-serializer');
  if (/EffectHost/.test(name)) return artifact('effect-host');
  if (/Execution$/.test(name)) return artifact('monarch-execution-plan');
  if (/hostDefinition$/.test(name)) return artifact('strict-saga-definition');
  if (/HostIO$|hostHost$/.test(name)) return artifact('saga-invocation-host');
  if (/TechnicalPorts$/.test(name)) return artifact('external-connector-port');
  if (/ServiceService$|ServiceConfiguration$/.test(name)) return artifact('service-contract', 'application-configuration');
  if (/ServiceLoader$|ServiceFactory$/.test(name)) return artifact('service-runtime');
  if (/ServiceJson$|Reqs$|Request$|Response$|Receipt$|Req$/.test(name)) return artifact('http-dto');
  if (/RoleMap|ViewKeys/.test(name)) return artifact('role-and-view-key-map');
  if (/Controller$/.test(name)) return artifact('http-controller');
  if (/Filter$|Health/.test(name)) return artifact('http-observability');
  if (/CommandDsl|CommandQuery|CommandEndpoint|Endpoint/.test(name)) return artifact('command-endpoint-dsl');
  if (/CommandHandlerReplyingBehavior/.test(name)) return artifact('aggregate-behavior');
  if (/\/auth\/|\/security\//.test(file)) return artifact('authorization-policy');
  if (/GraphConnection|GraphMutation|GraphSmoke/.test(name)) return artifact('graph-projection');
  if (/PgVector|Embedding|Vector/.test(name)) return artifact('vector-projection');
  if (/ScalikeJdbc|JdbcDataSource/.test(name)) return artifact('database-driver-adapter');
  if (/KnJournal|KnReason|TruthProjection|TruthCanonical|MetarchRebuild/.test(name)) return artifact('truth-rebuild-adapter');
  if (/FqnBuilder|ContentFingerprint|ConceptDeltaResolver/.test(name)) return artifact('domain-service');
  if (/Enricher$|Flow$/.test(name)) return artifact('extension-implementation', 'application-flow-port');
  if (/FeedAggregator|Query/.test(name)) return artifact('query-service');
  if (/CborSerializable|CommonTypes/.test(name)) return artifact('value-object', 'serialization-registration');
  if (/BankRuntime|BankResourceCleanup/.test(name)) return artifact('runtime-owner');
  if (/BusinessClock|SeedAuthority/.test(name)) return artifact('business-clock-seed');
  if (/BankJournal|BankPersistenceJournal/.test(name)) return artifact('journal-port-adapter');
  if (/BankApplicationPorts/.test(name)) return artifact('application-flow-port');
  if (/MockTAClient|BankTaEffectBindings|BankSipDispatchBindings/.test(name)) return artifact('connector-implementation');
  if (/BankPaymentBindings|BankRefundBindings/.test(name)) return artifact('saga-participant', 'saga-phase-port');
  if (/BankTaBridge|BankSipTerminalBridge/.test(name)) return artifact('external-event-bridge');
  if (/BankRecovery/.test(name)) return artifact('saga-invocation-host', 'runtime-owner');
  if (/BankRequestIdentity|Stable.*Identity/.test(name)) return artifact('domain-service');
  if (/BankCashRequests|BankServiceEndpoints|BankSipApplication|BankTaRefundApplication|BankTrustedAdmission/.test(name)) return artifact('application-service');
  if (/\/infra\/saga\//.test(file)) return artifact('saga-legacy-entity', 'saga-serializer', 'saga-participant');
  return null;
}

function runtime(repo, file) {
  if (repo === 'monarch-core') return mechanism('monarch-stage-engine');
  if (repo === 'saga') {
    if (file.includes('/strict/')) {
      if (/ReceiptContext/.test(file)) return mechanism('saga-receipt-context');
      if (/Definition/.test(file)) return mechanism('strict-saga-definition', 'saga-phase-port');
      if (/Serializer|Converter|Jackson/.test(file)) return mechanism('saga-serializer');
      return mechanism('strict-saga-coordinator');
    }
    if (/\.proto$/.test(file)) return mechanism('saga-wire');
    if (/serialization|persistence/.test(file)) return mechanism('saga-serializer');
    if (/Participant|PhaseAsk/.test(file)) return mechanism('saga-participant');
    if (/Definition|StepBuilder|dsl\/package/.test(file)) return mechanism('saga-transactor');
    if (/Runner/.test(file)) return mechanism('saga-transaction-repository-port', 'saga-transaction-repository-implementation');
    if (/handlers|Resilience/.test(file)) return mechanism('saga-legacy-behavior');
    return mechanism('saga-legacy-entity', 'saga-bootstrap');
  }
  if (/\.proto$|Serializer|Converters|Settings|Limits|reference\.conf$/.test(file)) return mechanism('monarch-wire-settings');
  if (/\/operation\/ExternalOperationPort/.test(file)) return mechanism('external-operation-connector');
  if (/\/operation\//.test(file)) return mechanism('persistent-operation');
  if (/ResourceEvidenceValidator/.test(file)) return mechanism('resource-evidence-policy');
  if (/\/resource\//.test(file)) return mechanism('resource-domain');
  if (/\/delivery\//.test(file)) return mechanism('durable-inbox');
  if (/WorkflowHost/.test(file)) return mechanism('workflow-program', 'workflow-host-bootstrap', 'workflow-query-reconcile');
  if (/\/workflow\//.test(file)) return mechanism('batch-definition', 'resource-evidence-policy');
  if (/\/batch\//.test(file)) return mechanism('batch-coordinator');
  if (/StateCodec/.test(file)) return mechanism('monarch-state-codec');
  if (/ManagedRunScope/.test(file)) return mechanism('managed-operation-wait');
  if (/RunProtocol|RunSubmission/.test(file)) return mechanism('run-definition-submission');
  return mechanism('monarch-checkpoint-host');
}

export function classifySource(repo, file, text, categories) {
  if (['saga', 'monarch', 'monarch-core'].includes(repo)) return runtime(repo, file);
  const name = basename(file), stem = name.replace(/(?:Template|Builder|Model)\.scala$/, '');
  if (/LICENSE|NOTICE/.test(name)) return c(['code-provenance'], 'licence', 'Distribution licence/provenance; retained rather than treated as an application type.');
  if (/\.md$/.test(file) && /knowledge_base\/artifacts\//.test(file)) {
    const ids = categories.filter(category => category.aliases.docs.includes(name)).map(category => category.id);
    return ids.length ? c(ids, 'legacy-document', 'Existing artifact document mapped by its exact historical filename.') : null;
  }
  if (name === 'checkable-rules.json') return mechanism('verification-runner', 'artifact-generator');
  if (name === 'catalog-index.json') return c(['code-provenance', 'artifact-generator'], 'compatibility-index', 'Derived central document dispatch index; not an application business source.');
  if (/\.codegen-ledger\.json$/.test(file)) return artifact('generation-ledger');
  if (repo === 'js') {
    if (/^test\/domain-kernel-(?:entry|generation|literals|model|project|serialization|verifier)\.test\.mjs$/.test(file) || file === 'test/domain-kernel-fixture.mjs')
      return c(['value-object', 'exact-value-codec', 'domain-protocol', 'domain-state', 'rule-parameters', 'computation-port', 'protobuf-schema', 'proto-converter', 'signature-value-closure', 'artifact-generator', 'code-anchor', 'project-build', 'generated-test', 'verification-runner', 'independent-business-oracle'], 'test-support',
        'Explicit finite family1 compilation, rendering, provenance and verifier tests; test source is not execution evidence.');
    if (file === 'package.json') return c(['artifact-generator', 'code-provenance'], 'producer-input',
      'Shipped package registration and distributable tool fingerprint contract.');
    if (file.startsWith('lib/scala-target/')) return c(['artifact-generator', 'multi-module-layout', 'signature-value-closure'], 'target-contract',
      'Explicit target naming and structural contract; candidate design validation, not an active application producer or final approval.');
    if (file.startsWith('test/reference/domain-kernel/')) return c(['value-object', 'exact-value-codec', 'domain-protocol', 'domain-state', 'rule-parameters', 'computation-port', 'protobuf-schema', 'proto-converter', 'independent-business-oracle'], 'reference-candidate',
      'Independent family1 reference, real protobuf value/state/event roundtrip and explicit compiler lane; not bank runtime or architecture-owner approval.');
    if (file === 'test/reference/compiler-tools.mjs') return c(['verification-runner', 'independent-business-oracle'], 'reference-candidate',
      'Test-only offline compiler/toolchain mechanics; no basic CLI JVM dependency or application generator.');
    if (file.startsWith('test/reference/module-seams/')) return c(['multi-module-layout', 'independent-business-oracle'], 'reference-candidate',
      'Independently authored four-module port/implementation/root-binding reference; source presence is not execution or architecture-owner approval.');
    if (file.startsWith('lib/artifact-docs/') || /^tools\/artifact-docs-(?:check|sync)\.mjs$/.test(file)) return c(['artifact-generator', 'code-provenance'], 'catalogue-support',
      'Versioned documentation, producer capability and evidence inspection; not an application generator.');
    if (file === 'bin/truthsrc.js') return mechanism('artifact-generator', 'artifact-manifest', 'code-anchor');
    if (file.startsWith('generators/scaffold-static/')) return code(file, text) ?? c(['project-build'], 'scaffold-input', 'Static source/configuration read by run-all; bytes are locked with the producer, not omitted by extension.');
    if (file === 'generators/run-all.mjs') return mechanism('artifact-generator', 'artifact-manifest', ...new Set(Object.entries(generatorMap).filter(([name]) => name !== 'scala-cqrs-domain-kernel-v1').flatMap(([, categories]) => categories)));
    if (/^generators\/(?:README|MIGRATION|pipeline\.README|run-all\.README)\.md$|^generators\/pipeline\.mjs$/.test(file)) return mechanism('artifact-generator', 'artifact-manifest');
    if (file.startsWith('generators/bindings/')) return c(['artifact-generator'], 'producer-input', 'Legacy per-emitter binding, not the current project author input.');
    if (file.startsWith('generators/_deprecated/')) {
      const old = /^generators\/_deprecated\/(scala-cqrs-es[^/]*)\//.exec(file)?.[1];
      const map = {
        'scala-cqrs-es': [...generatorMap['scala-cqrs-domain'], 'application-bootstrap', 'aggregate-bootstrap', 'projection-bootstrap', 'aggregate-repository-port', 'aggregate-repository-implementation'],
        'scala-cqrs-es-api': ['http-controller', 'http-dto', 'role-and-view-key-map', 'vector-projection', 'command-endpoint-dsl', 'route-definition'],
        'scala-cqrs-es-ddl': ['projection-schema'], 'scala-cqrs-es-function-specs': ['function-contract-test'],
        'scala-cqrs-es-policy-exec': generatorMap['policy-dsl'],
        'scala-cqrs-es-projection': [...generatorMap['projection-dsl'], 'generated-test'],
        'scala-cqrs-es-rules': ['invariant-rule', 'rule-parameters', 'command-helper', 'aggregate-behavior', 'event-handler', 'policy-decision', 'generated-test', 'computation-port', 'port-bridge']
      };
      return old && map[old] ? c(map[old], 'retired-producer', 'Explicitly deprecated generator retained for reference; not a current supported CLI profile.') : file === 'generators/_deprecated/README.md' ? mechanism('artifact-generator') : null;
    }
    const g = /^generators\/([^/]+)\//.exec(file);
    if (g) {
      const base = g[1].replace(/-v2$/, ''), mapped = generatorMap[base];
      if (!mapped) return null;
      if (jsRender[name]) return mechanism(...jsRender[name]);
      if (/verification|spec/i.test(name)) return mechanism('generated-test', ...mapped);
      if (/naming\.mjs$/.test(name)) return mechanism('artifact-generator');
      return c(mapped, /\.json$|\.ya?ml$|\.md$/.test(file) ? 'producer-input' : 'producer-support', 'Explicit generator family ' + g[1] + '; manifest/entry contract and all source branches are inventoried, not only the bank profile.');
    }
    if (file.startsWith('golden/')) {
      const target = code(file, text); return target ?? c(['artifact-generator'], 'golden-evidence', 'Legacy emitter golden output retained as exact verification evidence; source family is independently enumerated.');
    }
    if (file.startsWith('test/reference/aggregate-layers/')) return c(['generated-test', 'independent-business-oracle'], 'reference-candidate', 'Independently authored compatible aggregate reference and focused verification; candidate status is not human golden approval.');
    if (file.startsWith('test/fixtures/')) return c(['generated-test'], 'test-input', 'Shipped generator/compiler fixture, not live application data or an executable business success receipt.');
    if (file.startsWith('scaffold/verification-project/')) return c(['verification-runner', 'independent-business-oracle'], 'verification-example',
      'Shipped non-bank build/oracle/configuration example consuming optional public lifecycle APIs; not generated bank or approved Scala golden code.');
    if (file.startsWith('scaffold/')) return code(file, text) ?? c(['project-build', 'artifact-generator'], 'scaffold-input', 'Shipped starter project source/configuration, not a generated bank-specific implementation.');
    if (file.startsWith('src/core/')) {
      if (/anchors|code-mappings/.test(name)) return mechanism('code-anchor');
      if (/generate|manifest|plan|preflight|concern/.test(name)) return mechanism('artifact-manifest', 'generation-ledger');
      return mechanism('artifact-generator');
    }
    if (file.startsWith('lib/')) {
      if (file.startsWith('lib/verification/')) return c(['verification-runner'], 'verification-support',
        'Optional public evidence/lifecycle or tool-ownership mechanism; caller-owned policies remain outside the basic author CLI.');
      if (file === 'lib/handwritten-provenance.mjs') return mechanism('code-provenance', 'code-anchor', 'verification-runner');
      if (file === 'lib/project/cli.mjs') return mechanism('artifact-generator', 'code-provenance');
      if (/knowledge|graph/.test(name)) return mechanism('knowledge-graph-ast');
      if (/source-index|provenance|capture/.test(name)) return mechanism('code-provenance');
      return mechanism('artifact-generator');
    }
  }
  if (repo === 'bc') {
    if (name === 'CQRSApplicationGenerator.scala') return mechanism('artifact-generator', 'artifact-manifest', ...new Set(Object.values(modelMap).flat()));
    if (modelMap[stem] && !file.includes('/template/products/')) return mechanism(...modelMap[stem]);
    if (file.includes('/template/products/')) {
      if (/Application/.test(stem)) return mechanism('saga-invocation-host', 'monarch-execution-plan', 'effect-host', 'project-build');
      if (/Actor/.test(stem)) return mechanism('aggregate-root', 'aggregate-behavior');
      if (/Adapter/.test(stem)) return mechanism('event-adapter', 'snapshot-adapter');
      if (/Serialization/.test(stem)) return mechanism('protobuf-serializer', 'serialization-registration');
      if (/Design/.test(stem)) return mechanism('design-review-artifact');
      if (/Effect/.test(stem)) return mechanism('effect-host');
      if (/Child/.test(stem)) return mechanism('child-run-host');
      if (/Execution/.test(stem)) return mechanism('monarch-execution-plan');
      if (/HostSupport/.test(stem)) return mechanism('saga-invocation-host', 'saga-serializer', 'protobuf-schema', 'protobuf-serializer', 'external-connector-port');
      if (/Host|Invocation/.test(stem)) return mechanism('saga-invocation-host');
      if (/Service/.test(stem)) return mechanism('service-runtime', 'service-contract', 'application-configuration', 'service-test-configuration');
      if (/Proto|Serializer|Converter/.test(stem)) return mechanism('protobuf-schema', 'proto-converter', 'protobuf-serializer');
      if (/Domain/.test(stem)) return mechanism('domain-entity', 'invariant-rule', 'aggregate-root');
      if (/Build/.test(stem)) return mechanism('project-build', 'generated-test');
      if (/Verification|Unit|Spec|Test/.test(stem)) return mechanism('generated-test');
      return null;
    }
    if (bcTools[name]) return mechanism(...bcTools[name]);
    if (file.includes('/field_template/tools/')) {
      if (file.includes('/gen_api_controllers/')) return mechanism('http-controller', 'http-dto', 'route-definition', 'role-and-view-key-map', 'command-endpoint-dsl');
      if (/^(?:gen_role_map|rolemap_export)/.test(name)) return mechanism('role-and-view-key-map');
      if (/^generate_rules|^parse_rules_md|^expr_evaluator|^emit_when/.test(name)) return c(['invariant-rule', 'rule-parameters'], 'knowledge-transform', 'Rule expression/intermediate-data preparation, not a direct new application runtime type.');
      if (/^generate_readmodels/.test(name)) return c(['read-model'], 'knowledge-transform', 'Read-model intermediate data generator, not the final Scala repository/handler writer.');
      if (/^generate_lineage/.test(name)) return c(['code-provenance'], 'knowledge-transform', 'Field/command-event lineage intermediate data preparation.');
      if (/^(?:land_|backfill_|clean_|fix_|merge_|repair_)/.test(name)) return c(['historical-source-adapter'], 'historical-author-maintenance', 'Reviewed legacy author-data surgery/backfill script; writes knowledge or intermediate data, not an unlisted application artifact. Never executed by this inventory.');
      if (/^(?:export_|viz_)/.test(name)) return c(['design-review-artifact'], 'review-document-producer', 'Produces review workbooks, story/flow exports or visual HTML, separately from executable application generation.');
      if (/manifest|meta_files|patch_core/.test(name)) return mechanism('artifact-manifest', 'generation-ledger');
      if (/test|spec|check|audit|verify|guard|gate|executor|issues|dist|extract|verdict|map_tools/.test(name)) return c(['verification-runner'], 'verification-support', 'Inspected diagnostic/test or acceptance helper; its report/output is not an additional business implementation.');
      if (/truth_source|container_ids|knowledge_release/.test(name)) return mechanism('code-provenance', 'artifact-generator');
      return null;
    }
    if (file.startsWith('scaffold/')) return code(file, text) ?? c(['project-build'], 'scaffold-input', 'Generic application scaffold/configuration copied before model generation; no domain facts are inferred.');
    if (file.startsWith('src/main/')) return mechanism('artifact-generator', 'artifact-manifest');
    if (file === 'mcp/server.js' || file === 'mcp/artifact-docs.mjs') return mechanism('artifact-generator', 'verification-runner');
  }
  if (repo === 'play') {
    if (/\/application\/chain\/|\/application\/routing\/|\/domain\/routing\/|\/repositories\/routing\//.test(file)) return artifact('legacy-flow-orchestration');
    if (/\/application\/(actor|scenario|component|events)\/|\/domain\/events\/|DomainEventEnvelope|FabDemoPublisher/.test(file)) return artifact('simulation-actor');
    if (/\/services\/transactor\//.test(file)) return artifact(/Participant/.test(name) ? 'saga-participant' : /Context/.test(name) ? 'saga-legacy-context' : /Behaviors/.test(name) ? 'saga-legacy-behavior' : 'saga-transactor');
    if (/\/application\/services\//.test(file)) return artifact(/SagaIdGenerator/.test(name) ? 'domain-service' : 'application-service');
    if (/\/application\/queries\//.test(file)) return artifact('query-service');
    if (/\/domain\/invariants\//.test(file)) return artifact('invariant-rule');
    if (/\/domain\/services\//.test(file)) return artifact('domain-service');
    if (/\/infrastructure\/connector\//.test(file)) return artifact(/ConnectorRef/.test(name) ? 'external-connector-port' : 'connector-implementation');
    if (/SuffixCollectionNames/.test(name)) return artifact('journal-port-adapter');
  }
  if (/ViewWrites/.test(name)) return artifact('http-dto', 'role-and-view-key-map');
  if (/OrganizationMemberIds/.test(name)) return artifact('domain-service');
  if (/ExternalEvents\.scala$/.test(file)) return artifact('external-event-bridge');
  if (repo === 'bank' && file.startsWith('tools/')) {
    if (/historical|v1-|^tools\/(?:truth-source|project|artifacts|formal-contract-inputs|cash-contract|validate)/.test(file)) return mechanism('historical-source-adapter', 'verification-runner');
    if (/truthsrc-project/.test(file)) return mechanism('artifact-generator');
    if (/mock-ta/.test(file)) return mechanism('simulator-fixture');
    return mechanism('verification-runner');
  }
  if (repo === 'bank' && file.startsWith('bindings/implementation/')) return c(['artifact-manifest', 'application-configuration'], 'technical-input',
    'Explicit application implementation and runtime choices; source input, not generated code or execution proof.');
  if (repo === 'bank' && file.startsWith('simulator/')) return artifact('simulator-fixture');
  if (file === 'truthsrc.project.json') return c(['artifact-manifest', 'application-configuration'], 'author-configuration', 'Explicit current project/binding selection; not generated application code.');
  if (file.startsWith('tools/')) return mechanism('verification-runner', 'multi-module-layout', 'port-binding-module');
  return code(file, text);
}
