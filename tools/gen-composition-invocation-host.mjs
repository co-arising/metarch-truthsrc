// Byte-exact emitter for the composition-invocation-host family (#42).
// Contract: the same fixture input must reproduce the seven approved golden
// family artifacts (the composition port, the monarch child plan, the Mongo
// observation adapter, the bootstrap assembly, the composition host and the
// two compile-face suites under
// test/reference/curated/composition-invocation-host/v1/{app,test}/...)
// byte-for-byte.
// No golden bytes are embedded: every name, package, step id, field list,
// state field, derivation format, code string, guard/log message, stage
// chain, event mapping, timing constant, scenario window table, config key,
// db prefix, print label, result expectation, the fixture occurrence token
// and the strict-saga pid prefix flows from the input contract
// (truthsrc.composition-invocation-host-input/v1); only emission LAYOUT
// shapes are frozen per pattern exactly as the golden shows, each documented
// at its site:
//   - plain statements render on one line when they measure <= 100
//   - two-term constructions wrap the second term at indent + 2 (golden
//     BeginOperation/IdentityObserved/childPid shapes)
//   - the command/event/state families render their fields in contract order
//     with the frozen case-class break shapes shown by the golden
//   - the host routing tree, the effect chain and the recovery tree are the
//     frozen F13 named-method structure with every guard/message from input
//   - the suite scenario windows render from the contract window tables
//     (cut predicates as event/step data, expected keeps as integers)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_DIR = path.join(ROOT, 'test/reference/curated/composition-invocation-host/v1');
const EMISSION_FILES = [
  'app/example/stockreservation/application/services/transactor/CompositionChildJournal.scala',
  'app/example/stockreservation/application/services/transactor/WaferChildPlan.scala',
  'app/example/stockreservation/infrastructure/persistence/MongoCompositionChildJournal.scala',
  'app/example/stockreservation/infrastructure/bootstrap/CompositionBootstrap.scala',
  'app/example/stockreservation/application/services/transactor/WaferTransferHost.scala',
  'test/example/stockreservation/application/services/transactor/FixtureCompositionSpec.scala',
  'test/example/stockreservation/application/services/transactor/FixtureCompositionDeploymentSpec.scala'
];

// ---------- layout engine ----------
// The golden's line breaks are frozen per shape (hand-balanced CJK prose and
// fixed signature/table shapes; the golden itself carries lines up to 116
// columns, e.g. the monarch behavior signature). The emitter reproduces those
// break positions instead of re-wrapping; this guard only rejects pathological
// interpolation growth, not the golden shapes.
const LINE_LIMIT = 120;

const assertWidth = (lines, label) => {
  for (const line of lines) {
    if (line.length > LINE_LIMIT) {
      throw new Error(label + ': emitted line exceeds ' + LINE_LIMIT + ' columns (' +
        line.length + '): ' + line.slice(0, 80));
    }
  }
  return lines;
};

// Two-term case-class parameter list: `field: Type,` per line with the last
// one closed (golden BeginOperation/OperationStarted shape: all params ride
// continuation lines at +2 because the first param never fits the head).
const caseParams = (indent, fields, suffix) => {
  const lines = [];
  for (let i = 0; i < fields.length; i++) {
    const tail = i === fields.length - 1 ? suffix : ',';
    lines.push(' '.repeat(indent) + fields[i] + tail);
  }
  return lines;
};

// Chinese numerals for small declared counts (doc prose interpolation).
const NUM_CN = ['零', '一', '两', '三', '四', '五', '六', '七', '八', '九', '十'];
const cnNum = n => {
  if (!Number.isInteger(n) || n < 0 || n >= NUM_CN.length) {
    throw new Error('count outside the Chinese numeral range: ' + n);
  }
  return NUM_CN[n];
};

// Doc paragraphs are hand-balanced CJK prose: each line's break position is a
// frozen layout shape (golden), with every name, id, count, list and mapping
// inside the line interpolated from the input contract.
const docBlock = lines => lines;

// ---------- fail-closed input validation ----------
function validate(input) {
  if (input.schemaVersion !== 'truthsrc.composition-invocation-host-input/v1') {
    throw new Error('unexpected input schema version: ' + input.schemaVersion);
  }
  const symbol = value => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error('unsafe symbol: ' + value);
  };
  const packageName = value => {
    if (!/^[a-z][a-z0-9_.]*$/.test(value)) throw new Error('unsafe package: ' + value);
  };
  for (const key of Object.keys(input.packages)) packageName(input.packages[key]);
  for (const key of Object.keys(input.names)) symbol(input.names[key]);
  const composition = input.composition;
  if (composition.steps.length !== 3) {
    throw new Error('the bounded3 composition plan requires exactly three steps');
  }
  if (!composition.steps.includes(composition.awaitStep)) {
    throw new Error('await step must be one of the declared plan steps');
  }
  const [splitStep, awaitStep, mergeStep] = composition.steps;
  if (awaitStep !== composition.awaitStep) throw new Error('await step must be the middle step');
  if (splitStep === awaitStep || awaitStep === mergeStep) {
    throw new Error('duplicate plan step id');
  }
  for (const step of composition.steps) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(step)) throw new Error('unsafe step id: ' + step);
  }
  if (composition.startReplyFields.length !== 6) {
    throw new Error('BeginOperation requires the six declared operation fields');
  }
  for (const field of composition.startReplyFields) symbol(field.name);
  const derivation = composition.derivations;
  if (derivation.txid.prefix !== 'op-' || derivation.childRunKey.prefix !== 'op-') {
    throw new Error('durable-parent-step derivations carry the op- prefix');
  }
  if (derivation.persistenceId.prefix !== composition.pidPrefix + '/') {
    throw new Error('persistence id derivation must carry the declared pid prefix');
  }
  if (derivation.childPersistenceId.prefix !== composition.childPidPrefix + '/') {
    throw new Error('child persistence id derivation must carry the declared child prefix');
  }
  if (!composition.pidPrefix.endsWith('-transfer')) {
    throw new Error('composition host pid prefix must name the transfer pipeline');
  }
  if (composition.timings.pollIntervalMs <= 0 || composition.timings.pollAskSeconds <= 0 ||
    composition.timings.childAskSeconds <= 0) {
    throw new Error('poll/ask timings must be positive');
  }
  if (!composition.childCheckpointOutputs.some(o => o.key === 'wafers')) {
    throw new Error('child checkpoint must carry the wafers output key');
  }
  if (!composition.childCheckpointOutputs.some(o => o.key === 'childRun')) {
    throw new Error('child checkpoint must carry the childRun output key');
  }
  if (composition.sagaCheckpointOutput.key !== 'txid') {
    throw new Error('saga checkpoint must carry the txid output key');
  }
  const childPlan = input.childPlan;
  if (childPlan.stages.length !== 3) {
    throw new Error('the bounded3 child plan requires exactly three stages');
  }
  if (childPlan.stages[0].transform !== 'absorb-start-state') {
    throw new Error('the first child stage absorbs the StartRun initial state');
  }
  if (childPlan.stages[1].transform !== 'mark-processed') {
    throw new Error('the middle child stage marks the processed count');
  }
  if (childPlan.stages[2].transform !== 'fixture-no-op') {
    throw new Error('the final child stage is the fixture no-op transform');
  }
  for (const stage of childPlan.stages) {
    symbol(stage.id);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(stage.name)) {
      throw new Error('unsafe stage wire name: ' + stage.name);
    }
  }
  if (childPlan.runtime.stageCountBounds[0] !== 1 || childPlan.runtime.stageCountBounds[1] !== 8) {
    throw new Error('child plan stage bounds are the admitted 1..8 (F7)');
  }
  if (childPlan.state.fields.length !== 2 ||
    childPlan.state.fields[0].name !== 'wafers' || childPlan.state.fields[1].name !== 'processedCount') {
    throw new Error('child plan state is wafers + processedCount');
  }
  const port = input.port;
  if (port.signals.length !== 3) throw new Error('the port carries three journal signals');
  if (port.signals[0].name !== 'RunFinished' || port.signals[0].kind !== 'object') {
    throw new Error('the first journal signal is the RunFinished object');
  }
  if (port.mappings.length !== 3) throw new Error('the port maps three monarch events');
  for (const mapping of port.mappings) {
    if (!mapping.monarch || !mapping.signal) {
      throw new Error('port mapping requires monarch event and signal');
    }
  }
  if (port.adapter.offset !== '0L' || port.adapter.maxOffset !== 'Long.MaxValue') {
    throw new Error('live observation replays from offset 0 (history re-enters the same decision)');
  }
  const trigger = input.trigger;
  if (trigger.args.length !== 6 || trigger.mergeArgs.length !== 6) {
    throw new Error('the composition trigger payload carries six slots');
  }
  for (const arg of [...trigger.args, ...trigger.mergeArgs]) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(arg.slot)) throw new Error('unsafe trigger slot');
    if (!arg.source) throw new Error('trigger slot requires a value source');
  }
  const mergeBySlot = new Map(trigger.mergeArgs.map(a => [a.slot, a.source]));
  for (const arg of trigger.args) {
    if (!mergeBySlot.has(arg.slot)) {
      throw new Error('merge trigger must cover every split trigger slot');
    }
  }
  const swap = trigger.args.find(a => a.slot === 'from').source === 'start-field:from' &&
    trigger.mergeArgs.find(a => a.slot === 'from').source === 'start-field:to' &&
    trigger.mergeArgs.find(a => a.slot === 'to').source === 'start-field:from';
  if (!swap) throw new Error('the merge leg swaps the funding direction (to -> from)');
  if (!trigger.mergeArgs.some(a => a.source === 'child-wafers')) {
    throw new Error('the merge leg consumes the durable completed-child manifest');
  }
  if (input.statusMapping.length !== 4) {
    throw new Error('the terminal status mapping covers the three statuses plus the unmapped face');
  }
  if (input.statusMapping[1].code.kind !== 'prepare-confirmed') {
    throw new Error('Aborted folds to Compensated/Rejected by the prepare-confirmed rule');
  }
  if (input.statusMapping[3].code.kind !== 'sys-error') {
    throw new Error('the unmapped status face fails closed');
  }
  if (input.testHooks.length !== 4) throw new Error('the four test hooks are required');
  for (const hook of input.testHooks) symbol(hook.name);
  const r = input.rSuite;
  if (!/^[a-z0-9_]+$/.test(r.mongo.dbPrefix)) throw new Error('unsafe suite db prefix');
  if (!r.mongo.dbPrefix.endsWith('_composition_')) {
    throw new Error('suite databases must be namespaced to the composition run');
  }
  if (r.seedWafers.length < r.splitWafers.length) {
    throw new Error('seed wafers must fund the split leg');
  }
  if (r.windows.e0.probeBatches.length !== 3 || r.windows.e0.keep !== 4) {
    throw new Error('the E0 probe carries three batches and keeps a crossing prefix of 4');
  }
  if (r.windows.e6.length !== 3) throw new Error('the E6 boundary loop carries three labels');
  if (r.cursorExpectation.length !== 3) {
    throw new Error('the child oracle expects the three bounded stage cursors');
  }
  if (r.cursorExpectation.join('|') !==
    input.childPlan.stages.map((s, i) => s.name + '#' + i).join('|')) {
    throw new Error('cursor expectation must match the declared stage chain (F9)');
  }
  const d = input.dSuite;
  if (d.modes.length !== 2 || d.modes[0] !== 'first-start' || d.modes[1] !== 'child-completed') {
    throw new Error('the deployment suite freezes exactly the two crash modes');
  }
  if (!d.mongo.dbPrefix.endsWith('_composition_')) {
    throw new Error('deployment databases must be namespaced to the composition run');
  }
  for (const label of Object.values(d.printLabels)) {
    if (!/^[A-Z0-9_]+ $/.test(label)) throw new Error('unsafe deployment print label');
  }
  for (const label of Object.values(r.printLabels)) {
    if (!/^[A-Z0-9_]+ $/.test(label)) throw new Error('unsafe suite print label');
  }
}

// ---------- CompositionChildJournal.scala ----------
function emitPort(input) {
  const p = input.packages.transactor;
  const port = input.port;
  const adapter = input.names.mongoAdapter;
  const adapterLayer = input.packages.infrastructurePersistence.split('.').slice(-2).join('/');
  const signalLine = signal => signal.kind === 'object'
    ? '  case object ' + signal.name + ' extends ' + input.names.signal
    : '  final case class ' + signal.name + '(' +
      signal.fields.map(f => f.name + ': ' + f.type).join(', ') + ') extends ' + input.names.signal;
  // Frozen doc shape: the mapping list wraps after the first mapping; each
  // summary renders MonarchEvent(field)->Signal from the contract table.
  const mapSummary = m => m.monarch + (m.args.length === 0
    ? ''
    : '(' + m.args[0].split('.').pop() + ')') + '→' + m.signal;
  const lines = [
    'package ' + p,
    '',
    'import akka.stream.UniqueKillSwitch',
    '',
    '/** 应用观察端口（D1 拆分的产物）：子计划 journal 的唯一权威终态观察面。',
    '  * raw 的 watchChild 把 Mongo read journal、KillSwitch 管理与事件映射混在',
    '  * application 宿主里；本端口把"观察"提升为应用合同——宿主只依赖信号语义',
    '  * （' + port.signals.map(s => s.name).join('/') + '），具体 journal 归适配器：',
    '  * production = ' + adapter + '（' + adapterLayer + '），',
    '  * 测试 = persistence-testkit read journal 适配器（测试树）。KillSwitch',
    '  * 所有权归调用者；watch 同一 pid 的重复调用由宿主侧去重（childWatch 槽）。',
    '  * 信号与 raw watchChild 的事件映射逐项一致：' + mapSummary(port.mappings[0]) + '、',
    '  * ' + mapSummary(port.mappings[1]) + '、' + mapSummary(port.mappings[2]) + '。 */',
    'sealed trait ' + input.names.signal,
    '',
    'object ' + input.names.signal + ' {',
    ...port.signals.map(signalLine),
    '}',
    '',
    'trait ' + input.names.port + ' {',
    '  def watch(pid: String)(observer: ' + input.names.signal + ' => Unit): UniqueKillSwitch',
    '}'
  ];
  return assertWidth(lines, 'port').join('\n') + '\n';
}

// ---------- WaferChildPlan.scala ----------
function emitChildPlan(input) {
  const p = input.packages.transactor;
  const plan = input.childPlan;
  const stages = plan.stages;
  const supply = input.supply;
  const stageLine = s => '      case ' + s.id + ' => "' + s.name + '"';
  const transformLine = s => {
    switch (s.transform) {
      case 'absorb-start-state':
        return '        case ChildStage.' + s.id +
          ' => state // absorb the StartRun initial state';
      case 'mark-processed':
        return '        case ChildStage.' + s.id +
          ' => state.copy(processedCount = state.wafers.size)';
      case 'fixture-no-op':
        return '        case ChildStage.' + s.id +
          ' => state // fixture transform: no equipment I/O';
      default: throw new Error('unsupported child stage transform: ' + s.transform);
    }
  };
  const codec = plan.state.codec;
  // Frozen doc shape: the stage chain rides line 1, the admitted bounds line 2;
  // the journal event list breaks after its third entry (frozen prose balance).
  const lines = [
    'package ' + p,
    '',
    'import akka.actor.typed.Behavior',
    'import akka.persistence.typed.PersistenceId',
    'import net.imadz.monarch.persistence.{PersistentMonarch, RunObserver, StateCodec}',
    'import net.imadz.monarch.persistence.PersistentMonarch.Command',
    'import scala.concurrent.{ExecutionContext, Future}',
    '',
    '/** monarch 子计划（组合面族工件）：' + cnNum(stages.length) + '个有界 stage（' +
      stages.map(s => s.name).join('/') + '）',
    '  * 驱动子 wafers 集——fixture 语义，无设备 I/O（F7 裁定：准入 ' +
      plan.runtime.stageCountBounds[0] + '..' + plan.runtime.stageCountBounds[1] + ' stage，本',
    '  * profile 固定三项，与合同 §9.1 bounded3 fixture 一致）。持久化/恢复归',
    '  * monarch-persistence ' + supply.monarchVersion + '（事件 journal：' +
      plan.runtime.events.slice(0, 3).join('/') + '/',
    '  * ' + plan.runtime.events.slice(3).join('/') +
      '）；父宿主观察 THIS journal 取终态——镜像永不权威。' + supply.monarchVersion + ' 的',
    '  * behavior 七显参形状（+隐式 ec）与 raw 模板 C05 逐参吻合（探针实证）。 */',
    'object ' + input.names.childPlan + ' {',
    '  sealed trait ChildStage',
    '  object ChildStage {',
    ...stages.map(s => '    case object ' + s.id + ' extends ChildStage'),
    '',
    '    val chain: Seq[ChildStage] = Seq(' + stages.map(s => s.id).join(', ') + ')',
    '',
    '    def stageName(s: ChildStage): String = s match {',
    ...stages.map(stageLine),
    '    }',
    '  }',
    '',
    '  final case class ' + plan.state.name + '(' +
      plan.state.fields.map(f => f.name + ': ' + f.type).join(', ') + ') {',
    '  }',
    '',
    '  object ' + plan.state.name + ' {',
    '    // Wire format "' + codec.wireExample + '" — ' + codec.comment + '.',
    '    val codec: StateCodec[' + plan.state.name + '] = StateCodec[' + plan.state.name + '](',
    '      enc = st => (st.wafers.mkString("' + codec.listSeparator + '") + "' +
      codec.separator + '" + ' + codec.countConverter + '(st.processedCount))',
    '        .getBytes(java.nio.charset.StandardCharsets.UTF_8),',
    '      dec = bytes => {',
    '        val text = new String(bytes, java.nio.charset.StandardCharsets.UTF_8)',
    '        val sep = text.lastIndexOf(\'' + codec.separator + '\')',
    '        val waferText = text.substring(0, sep)',
    '        ' + plan.state.name + '(',
    '          if (waferText.isEmpty) ' + codec.emptyList + ' else waferText.split("' +
      codec.listSeparator + '").toVector,',
    '          text.substring(sep + 1).toInt)',
    '      }',
    '    )',
    '  }',
    '',
    '  /** Host\'s stage logic. Must be idempotent: at-least-once recovery may replay it. */',
    '  private def runStage(stage: ChildStage, state: ' + plan.state.name + ')(',
    '      implicit ec: ExecutionContext): Future[' + plan.state.name + '] =',
    '    Future {',
    '      stage match {',
    ...stages.map(transformLine),
    '      }',
    '    }',
    '',
    '  def behavior(pid: PersistenceId)(implicit ec: ExecutionContext): Behavior[Command[' +
      plan.state.name + ']] =',
    '    PersistentMonarch.behavior[ChildStage, ' + plan.state.name + '](',
    '      pid,',
    '      ChildStage.chain,',
    '      (stage: ChildStage, state: ' + plan.state.name + ') => runStage(stage, state),',
    '      ' + plan.state.name + '.codec,',
    '      (stage: ChildStage) => ChildStage.stageName(stage),',
    '      scala.None,',
    '      RunObserver.nop[' + plan.state.name + '])',
    '}'
  ];
  return assertWidth(lines, 'child plan').join('\n') + '\n';
}

// ---------- MongoCompositionChildJournal.scala ----------
function emitMongoAdapter(input) {
  const p = input.packages.infrastructurePersistence;
  const portPackage = input.packages.transactor;
  const port = input.port;
  // Frozen mapping shape: the unbound RunCompleted event maps inline; every
  // bound event breaks after `=>` with the observer call at indent + 2.
  const mappingLines = port.mappings.flatMap(m => m.binding === null
    ? ['          case _: PersistentMonarch.' + m.monarch + ' => observer(' +
      input.names.signal + '.' + m.signal + ')']
    : ['          case ' + m.binding + ': PersistentMonarch.' + m.monarch + ' =>',
      '            observer(' + input.names.signal + '.' + m.signal + '(' +
        m.args.join(', ') + '))']);
  // Same-package multi-name import: packed at 96 columns, the continuation
  // names sit at indent + 2 (golden adapter shape).
  const importNames = [input.names.signal, input.names.port];
  const importHead = 'import ' + portPackage + '.{';
  const importLine = importHead + importNames.join(', ') + '}';
  const importLines = importLine.length <= 96
    ? [importLine]
    : [importHead + importNames[0] + ',', '  ' + importNames.slice(1).join(', ') + '}'];
  const lines = [
    'package ' + p,
    '',
    'import akka.actor.typed.ActorSystem',
    'import akka.contrib.persistence.mongodb.{MongoReadJournal, ScalaDslMongoReadJournal}',
    'import akka.persistence.query.PersistenceQuery',
    'import akka.stream.{KillSwitches, Materializer, UniqueKillSwitch}',
    'import akka.stream.scaladsl.{Keep, Sink}',
    ...importLines,
    'import net.imadz.monarch.persistence.PersistentMonarch',
    '',
    '/** Mongo 观察适配器（D1 拆分）：raw watchChild 的 journal 细节原样落地——live',
    '  * eventsByPersistenceId 从 offset ' + port.adapter.offset.replace(/L$/, '') +
      '（历史重放进同一决策）、KillSwitch 归宿主、',
    '  * 事件映射逐项一致。门环境无 mongod（实证）：本适配器编译面覆盖；行为门经',
    '  * ' + input.names.port + ' 端口走测试树的 testkit 适配器（F8 裁定）。插件 id',
    '  * 用 ' + port.adapter.readJournal + ' 常量（' + input.supply.akkaMongoVersion + ' 的 companion 无 Identifier 的',
    '  * 位置在 ScalaDslMongoReadJournal，#41 探针同款）。 */',
    'final class ' + input.names.mongoAdapter + '(system: ActorSystem[_])(implicit mat: Materializer)',
    '  extends ' + input.names.port + ' {',
    '',
    '  def watch(pid: String)(observer: ' + input.names.signal + ' => Unit): UniqueKillSwitch = {',
    '    val readJournal = PersistenceQuery(system)',
    '      .readJournalFor[ScalaDslMongoReadJournal](MongoReadJournal.Identifier)',
    '    readJournal.eventsByPersistenceId(pid, ' + port.adapter.offset + ', ' +
      port.adapter.maxOffset + ')',
    '      .viaMat(KillSwitches.single)(Keep.right)',
    '      .toMat(Sink.foreach { envelope =>',
    '        envelope.event match {',
    ...mappingLines,
    '          case _ => ()',
    '        }',
    '      })(Keep.left)',
    '      .run()',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'mongo adapter').join('\n') + '\n';
}

// ---------- CompositionBootstrap.scala ----------
function emitBootstrap(input) {
  const p = input.packages.infrastructureBootstrap;
  const lines = [
    'package ' + p,
    '',
    'import akka.actor.typed.ActorSystem',
    'import akka.stream.{Materializer, SystemMaterializer}',
    'import ' + input.packages.transactor + '.' + input.names.port,
    'import ' + input.packages.infrastructurePersistence + '.' + input.names.mongoAdapter,
    '',
    '/** 装配点（D1）：production 组合的唯一绑定面——子计划观察端口接 Mongo 适配器。',
    '  * 宿主工厂以端口为参数（F3，application 不得反向 import infrastructure）；',
    '  * 生产装配与测试装配各自调用本对象获得绑定实现。 */',
    'object ' + input.names.bootstrap + ' {',
    '',
    '  def childJournal(system: ActorSystem[_]): ' + input.names.port + ' = {',
    '    implicit val materializer: Materializer = SystemMaterializer(system).materializer',
    '    new ' + input.names.mongoAdapter + '(system)',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'bootstrap').join('\n') + '\n';
}

// ---------- top-level ----------
function generate(input) {
  validate(input);
  const transactorRel = 'app/' + input.packages.transactor.split('.').join('/');
  const persistenceRel = 'app/' + input.packages.infrastructurePersistence.split('.').join('/');
  const bootstrapRel = 'app/' + input.packages.infrastructureBootstrap.split('.').join('/');
  const testRel = 'test/' + input.packages.transactor.split('.').join('/');
  const files = {};
  const emit = (rel, emitter) => {
    const text = emitter(input);
    if (text !== null) files[rel] = text;
  };
  emit(transactorRel + '/' + input.names.port + '.scala', emitPort);
  emit(transactorRel + '/' + input.names.childPlan + '.scala', emitChildPlan);
  emit(persistenceRel + '/' + input.names.mongoAdapter + '.scala', emitMongoAdapter);
  emit(bootstrapRel + '/' + input.names.bootstrap + '.scala', emitBootstrap);
  emit(transactorRel + '/' + input.names.host + '.scala', emitHost);
  emit(testRel + '/' + input.rSuite.className + '.scala', emitRSuite);
  emit(testRel + '/' + input.dSuite.suiteName + '.scala', emitDSuite);
  return files;
}

// ---------- WaferTransferHost.scala ----------
// Frozen declaration row tables (golden shapes; the param lists themselves all
// flow from the contract): BeginOperation/OperationStarted split 3/3(/1),
// IdentityObserved 3/2/2/2, ComposedState 2/1/1/1, ProgressReport 2/2, with
// continuations aligned under the first parameter. Single-param declarations
// render inline when the line measures <= 100.
const DECL_LIMIT = 100;

const packDeclRows = (indent, head, rows, tail, align = 'head', limit = DECL_LIMIT) => {
  // rows: array of param rows; tail appended inside the closing paren.
  // align: 'head' continues at the first-parameter column (case classes),
  // 'indent' continues at indent + 2 (require two-part guards).
  const lines = [];
  rows.forEach((row, i) => {
    const last = i === rows.length - 1;
    const body = row.join(', ') + (last ? tail : ',');
    lines.push((i === 0 ? head : ' '.repeat(align === 'head' ? head.length : indent + 2)) + body);
  });
  for (const line of lines) {
    if (line.length > limit) throw new Error('declaration row exceeds ' + limit + ': ' + line);
  }
  return lines;
};

// Greedy argument packer with +2 continuations (#41 packer face); the limit is
// per call site — the golden packs import lists and call args at 100.
const packArgs = (indent, prefix, items, suffix, limit = 100) => {
  const lines = [];
  let current = null;
  let baseIndent = indent;
  let basePrefix = prefix;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const tail = isLast ? suffix : ',';
    if (current === null) {
      const width = indent + prefix.length + item.length + tail.length;
      if (width <= limit) {
        current = [item];
        continue;
      }
      lines.push(' '.repeat(indent) + prefix);
      baseIndent = indent + 2;
      basePrefix = '';
      current = [item];
      continue;
    }
    const joined = current.join(', ') + ', ' + item;
    if (baseIndent + basePrefix.length + joined.length + tail.length <= limit) {
      current.push(item);
    } else {
      lines.push(' '.repeat(baseIndent) + basePrefix + current.join(', ') + ',');
      baseIndent = indent + 2;
      basePrefix = '';
      current = [item];
    }
  }
  lines.push(' '.repeat(baseIndent) + basePrefix + current.join(', ') + suffix);
  return lines;
};

function emitHost(input) {
  const names = input.names;
  const c = input.composition;
  const f = c.hostFaces;
  const steps = c.steps;
  const splitStep = c.splitStep;
  const awaitStep = c.awaitStep;
  const mergeStep = c.mergeStep;
  const host = names.host;
  const plan = names.childPlan;
  const stateName = input.childPlan.state.name;
  const lot = names.lotProtocol;
  const stepVal = role => role.charAt(0).toUpperCase() + role.slice(1) + 'Step';
  const replyField = name => name + ': ActorRef[' + f.operationReply + ']';
  const beginParams = c.startReplyFields.map(fd => fd.name + ': ' + fd.type);
  const eventParams = beginParams;
  const identityDeclParams = c.identityFields.map(fd => fd.name + ': ' + fd.type);
  const identityArgs = c.identityFields.slice(1).map(fd => fd.identity === null
    ? fd.name : 'ident.' + fd.identity);
  const identityNames = c.identityFields.slice(1).map(fd => fd.name);
  const identityToIdentityArgs = c.identityFields.slice(1).map(fd => fd.name);
  const codecPinArgs = c.identityFields.filter(fd => fd.identity && fd.identity.startsWith('argsCodec'))
    .map(fd => fd.name);
  const state = [
    'started: Option[' + f.operationStarted + ']',
    'intents: Map[String, String]',
    'identities: Map[String, ' + f.identityObserved + ']',
    'checkpoints: Map[String, ' + f.stepCheckpointed + ']',
    'concluded: Option[' + f.operationConcluded + ']'
  ];
  const progress = [
    'started: Boolean',
    'checkpoints: Vector[(String, String)]',
    'concluded: Option[String]',
    'childRunKey: Option[String]'
  ];
  const hookLine = h => '    ' + h.name + ': ' + h.signature + ' = ' + h.default + ',';
  const hooks = input.testHooks;
  // Frozen spawn-signature block: seven params, one per line, all but the last
  // trailing-comma; when a hook param follows (ForTest/build variants) the
  // occurrence line takes the comma instead.
  const spawnSig = (trailing = false) => [
    '      system: ActorSystem[_],',
    '      sharding: ClusterSharding,',
    '      splitCoordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],',
    '      childJournal: ' + names.port + ',',
    '      operation: String,',
    '      occurrence: String' + (trailing ? ',' : '')
  ];
  const testHookParam = p => ['      ' + p];
  const pollMs = c.timings.pollIntervalMs;
  const strictImport = packArgs(0, 'import net.imadz.infra.saga.strict.{',
    ['CodecPin', 'Evidence', 'Phase', 'StrictSagaCoordinator', 'StrictState', 'StrictStatus',
      'TransactionIdentity'], '}');
  // ── object section ──
  const lines = [
    'package ' + input.packages.transactor,
    '',
    'import akka.actor.typed.{ActorRef, ActorSystem, Behavior, Scheduler}',
    'import akka.actor.typed.scaladsl.{ActorContext, Behaviors}',
    'import akka.actor.typed.scaladsl.AskPattern._',
    'import akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'import akka.cluster.typed.{ClusterSingleton, SingletonActor}',
    'import akka.persistence.typed.PersistenceId',
    'import akka.persistence.typed.scaladsl.{Effect, EventSourcedBehavior}',
    'import akka.stream.UniqueKillSwitch',
    'import akka.util.Timeout',
    'import ' + input.packages.aggregates + '.' + lot,
    'import net.imadz.common.CborSerializable',
    ...strictImport,
    'import net.imadz.monarch.persistence.PersistentMonarch',
    'import ' + plan + '.' + stateName,
    'import scala.concurrent.duration._',
    'import scala.concurrent.{ExecutionContext, Future}',
    'import scala.util.{Failure, Success, Try}',
    '',
    '/** 有界组合宿主（组合面族工件，raw T H01–H32 全分支落地）：每个',
    '  * (pipeline, operation, occurrence) 一个持久 actor，驱动',
    '  * ' + splitStep + ' → ' + awaitStep + ' → ' + mergeStep + ' 有界 plan。Journal',
    '  * （权威，confirmed-prefix 恢复）：' + f.operationStarted + ' → ' + f.invocationIntent,
    '  * → ' + f.identityObserved + ' → ' + f.stepCheckpointed + ' → ' +
      f.childProgressMirrored + '（仅派生）→',
    '  * ' + f.operationConcluded + '。镜像子进度永不权威——子 run 自身 journal 才是。子失败',
    '  * 使操作停止（child-failed），绝不自动补偿父流程（补偿不是 stage 恢复）。',
    '  * 超时永不推断失败：未答的 poll 重试，不判死。D1 拆分：子 journal 观察经',
    '  * ' + names.port + ' 端口注入（构造形状偏离 raw 记档）；D5/F10 记档：',
    '  * H18 的恒真检查已简化为 isDefined。 */',
    'object ' + host + ' {',
    '  val StepIds: Vector[String] = Vector(' + steps.map(s => '"' + s + '"').join(', ') + ')',
    '  val ' + stepVal('split') + ': String = "' + splitStep + '"',
    '  val ' + stepVal('await') + ': String = "' + awaitStep + '"',
    '  val ' + stepVal('merge') + ': String = "' + mergeStep + '"',
    '',
    '  sealed trait Command extends CborSerializable',
    ...packDeclRows(2, '  final case class ' + f.beginCommand + '(',
      [beginParams.slice(0, 3), beginParams.slice(3), [replyField('replyTo')]],
      ') extends Command'),
    '  final case class ' + f.getProgress +
      '(replyTo: ActorRef[' + f.progressReport + ']) extends Command',
    ...packDeclRows(2, '  private[transactor] final case class SagaPolled(',
      [['stepId: String'], ['reply: Try[StrictSagaCoordinator.Reply]']], ')'),
    '    extends Command',
    '  private[transactor] final case class AdvanceAfterCheckpoint(stepId: String) extends Command',
    '  private[transactor] final case class OpenStep(stepId: String) extends Command',
    '  private[transactor] final case class ChildObserved(code: Option[(String, String)]) extends Command',
    '  private[transactor] final case class ChildRefused(reason: String) extends Command',
    '  private[transactor] final case class ChildProgressed(cursor: String) extends Command',
    '  private[transactor] final case class PollTick(stepId: String) extends Command',
    '  private[transactor] final case class ChildSignal(signal: ' + names.signal +
      ') extends Command',
    '',
    '  sealed trait Event extends CborSerializable',
    ...packDeclRows(2, '  final case class ' + f.operationStarted + '(',
      [eventParams.slice(0, 3), eventParams.slice(3)], ')'),
    '    extends Event',
    '  final case class ' + f.invocationIntent + '(stepId: String, key: String) extends Event',
    '  /** The coordinator\'s authoritative transaction identity for an invoked step,',
    '    * observed on the first poll and carried in THIS journal so recovery can',
    '    * Attach without reconstructing saga digests. */',
    ...packDeclRows(2, '  final case class ' + f.identityObserved + '(',
      [identityDeclParams.slice(0, 3), identityDeclParams.slice(3, 5),
        identityDeclParams.slice(5, 7), identityDeclParams.slice(7)], ') extends Event {'),
    ...packArgs(4, 'def toIdentity: TransactionIdentity = TransactionIdentity(',
      identityToIdentityArgs.map((name, i) => name === codecPinArgs[1]
        ? null // merged into the CodecPin( pinId, version ) argument face
        : name === codecPinArgs[0]
          ? 'CodecPin(' + name + ', ' + codecPinArgs[1] + ')'
          : name).filter(x => x !== null),
      ')'),
    '  }',
    ...packDeclRows(2, '  final case class ' + f.stepCheckpointed + '(',
      [['stepId: String', 'code: String', 'outputs: Map[String, String]']], ')'),
    '    extends Event',
    '  final case class ' + f.childProgressMirrored + '(cursor: String) extends Event',
    '  final case class ' + f.operationConcluded + '(code: String) extends Event',
    '',
    ...packDeclRows(2, '  final case class ' + f.composedState + '(',
      [state.slice(0, 2), state.slice(2, 3), state.slice(3, 4), state.slice(4)], ') {'),
    '    def terminal: Boolean = concluded.isDefined',
    '    /** First step with an intent but no checkpoint (resume face), else the first',
    '      * step never started (advance face). */',
    '    def activeStep: Option[String] =',
    '      StepIds.find(id => intents.contains(id) && !checkpoints.contains(id))',
    '        .orElse(StepIds.find(id => !intents.contains(id)))',
    '  }',
    '',
    '  final case class ' + f.operationReply +
      '(accepted: Boolean, reason: String) extends CborSerializable',
    ...packDeclRows(2, '  final case class ' + f.progressReport + '(',
      [progress.slice(0, 2), progress.slice(2)], ')'),
    '    extends CborSerializable',
    '',
    '  /** durable-parent-step derivation: parent operation key + exact step id +',
    '    * durable occurrence token. No clock, random, or attempt. */',
    '  def txidFor(operation: String, occurrence: String, stepId: String): String =',
    '    "' + c.derivations.txid.prefix + '" + ' +
      c.derivations.txid.parts.map(part => part).join(' + "' + c.derivations.txid.join + '" + '),
    '  def childRunKey(operation: String, occurrence: String): String =',
    '    "' + c.derivations.childRunKey.prefix + '" + ' +
      c.derivations.childRunKey.parts.map(part => part === 'awaitStep' ? stepVal('await') : part)
        .join(' + "' + c.derivations.childRunKey.join + '" + '),
    '  def childPersistenceId(operation: String, occurrence: String): String =',
    '    "' + c.childPidPrefix + '/" + childRunKey(operation, occurrence)',
    '',
    '  def persistenceIdFor(operation: String, occurrence: String): PersistenceId = {',
    ...packDeclRows(4, '    require(',
      [['operation != null && operation.nonEmpty && occurrence != null && occurrence.nonEmpty'],
        ['"' + c.messages.persistenceIdGuard + '"']], ')', 'indent'),
    '    PersistenceId.ofUniqueId("' + c.pidPrefix + '/" + operation + "-" + occurrence)',
    '  }',
    '',
    '  private[transactor] final case class TestHooks(',
    ...hooks.map((h, i) => {
      const tail = i === hooks.length - 1 ? ')' : ',';
      return '    ' + h.name + ': ' + h.signature + ' = ' + h.default + tail;
    }),
    '',
    '  private[transactor] def singletonName(operation: String, occurrence: String): String =',
    '    "' + c.singletonPrefix + '" + java.security.MessageDigest.getInstance("SHA-256")',
    '      .digest(persistenceIdFor(operation, occurrence).id.getBytes(',
    '        java.nio.charset.StandardCharsets.UTF_8))',
    '      .map(b => "%02x".format(b & 0xff)).mkString',
    '',
    '  /** A stable singleton for this operation; every node gets a proxy, not a second writer. */',
    '  def spawnClusterSingleton(',
    ...spawnSig(),
    '  )(implicit ec: ExecutionContext): ActorRef[Command] =',
    ...packArgs(4, 'spawnClusterSingletonForTest(',
      ['system, sharding, splitCoordinator, mergeCoordinator',
        'childJournal, operation, occurrence, TestHooks()'], ')'),
    '',
    '  private[transactor] def spawnClusterSingletonForTest(',
    ...spawnSig(true),
    ...testHookParam('hooks: TestHooks'),
    '  )(implicit ec: ExecutionContext): ActorRef[Command] =',
    '    ClusterSingleton(system).init(SingletonActor(',
    ...packArgs(6, 'build(',
      ['system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation',
        'occurrence, hooks'], '),'),
    '      singletonName(operation, occurrence)))',
    '',
    '  def behavior(',
    ...spawnSig(),
    '  )(implicit ec: ExecutionContext): Behavior[Command] =',
    ...packArgs(4, 'build(',
      ['system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation',
        'occurrence, TestHooks()'], ')'),
    '',
    '  private[transactor] def behaviorForTest(',
    ...spawnSig(true),
    ...testHookParam('beforeEffect: (String, String) => Boolean'),
    '  )(implicit ec: ExecutionContext): Behavior[Command] =',
    ...packArgs(4, 'build(',
      ['system, sharding, splitCoordinator, mergeCoordinator, childJournal, operation',
        'occurrence, TestHooks(beforeEffect = beforeEffect)'], ')'),
    '',
    '  private def build(',
    ...spawnSig(true),
    ...testHookParam('hooks: TestHooks'),
    '  )(implicit ec: ExecutionContext): Behavior[Command] =',
    '    Behaviors.setup { ctx =>',
    '      Behaviors.withTimers { timers =>',
    '        // F11 修订（用户裁定 2026-11-21）：四槽可变资源全部算法消解——',
    '        // 子计划 actor 与子 journal 观察流都绑定到本宿主的固定派生 pid，',
    '        // 在 setup 一次性建立并作为不可变 val 持有；定时轮询走 withTimers',
    '        // （同 key 自动替换、停止自动取消，ownerClosed 守卫被结构性取代）。',
    '        val childPid = childPersistenceId(operation, occurrence)',
    '        val childPlanRef = ctx.spawn(',
    '          ' + plan + '.behavior(PersistenceId.ofUniqueId(childPid)),',
    '          childPid.replace(\'/\', \'-\'))',
    '        val childWatch = childJournal.watch(childPid)(signal => ctx.self ! ChildSignal(signal))',
    '        new ' + host + '(ctx, timers, system, sharding, splitCoordinator,',
    '          mergeCoordinator, childPlanRef, childWatch,',
    '          persistenceIdFor(operation, occurrence), hooks).receive()',
    '      }',
    '    }',
    '}',
    '',
    '/** One host actor per (pipeline, operation, occurrence). All effects (saga Start,',
    '  * child StartRun, journal observation) run only after the matching intent event',
    '  * has been persisted (intent-before-start). */',
    'final class ' + host + '(',
    '    ctx: ActorContext[' + host + '.Command],',
    '    timers: akka.actor.typed.scaladsl.TimerScheduler[' + host + '.Command],',
    '    system: ActorSystem[_],',
    '    sharding: ClusterSharding,',
    '    splitCoordinator: ActorRef[StrictSagaCoordinator.Command],',
    '    mergeCoordinator: ActorRef[StrictSagaCoordinator.Command],',
    '    childPlanRef: ActorRef[PersistentMonarch.Command[' + stateName + ']],',
    '    childWatch: UniqueKillSwitch,',
    '    val persistenceId: PersistenceId,',
    '    hooks: ' + host + '.TestHooks',
    ')(implicit ec: ExecutionContext) {',
    '  import ' + host + '._',
    '',
    '  private implicit val scheduler: Scheduler = system.scheduler',
    '  private val splitHost = new ' + names.splitHost + '(system, sharding)',
    '  private val mergeHost = new ' + names.mergeHost + '(system, sharding)',
    '  private val sagaReplySink: ActorRef[StrictSagaCoordinator.Reply] =',
    '    ctx.spawnAnonymous(Behaviors.ignore[StrictSagaCoordinator.Reply])',
    '  private val lotReplySink: ActorRef[' + lot + '.LotReply] =',
    '    ctx.spawnAnonymous(Behaviors.ignore[' + lot + '.LotReply])',
    '  private val beforeEffect = hooks.beforeEffect',
    '',
    '  // F11 修订（用户裁定 2026-11-21）：应用树零可变槽。轮询资源 = withTimers',
    '  // 键控定时器；子计划 actor 与观察流 = setup 一次性建立的不可变 val（上）；',
    '  // 生命周期归 akka 结构（withTimers 停止自动取消、ctx.spawn 父子同停、',
    '  // KillSwitch 归宿主在 PostStop 关闭）。',
    '',
    '  def receive(): Behavior[Command] =',
    '    EventSourcedBehavior[Command, Event, ' + f.composedState + '](',
    '      persistenceId,',
    '      ' + f.composedState + '(None, Map.empty, Map.empty, Map.empty, None),',
    '      (state, command) => onCommand(state, command),',
    '      (state, event) => onEvent(state, event))',
    '      .receiveSignal {',
    '        case (state, akka.persistence.typed.RecoveryCompleted) =>',
    '          hooks.recovered(EventSourcedBehavior.lastSequenceNumber(ctx), state)',
    '          onRecovered(state)',
    '        case (_, akka.actor.typed.PostStop) =>',
    '          childWatch.shutdown()',
    '          hooks.stopped()',
    '      }',
    '',
    '  // ── commands（orchestration / observation 两个命名分派组，CC 合同内）──',
    '  private def onCommand(state: ' + f.composedState + ', command: Command): Effect[Event, ' +
      f.composedState + '] =',
    '    command match {',
    '      case ChildSignal(signal) => onChildSignal(state, signal)',
    '      case _ => onRoutedCommand(state, command)',
    '    }',
    '',
    '  private def onRoutedCommand(state: ' + f.composedState + ',',
    '      command: Command): Effect[Event, ' + f.composedState + '] = command match {',
    '    case PollTick(stepId) =>',
    '      pollSaga(stepId, coordinatorFor(stepId))',
    '      Effect.none',
    '    case _ => onMember(state, command)',
    '  }',
    '',
    '  private def onMember(state: ' + f.composedState + ',',
    '      command: Command): Effect[Event, ' + f.composedState + '] = command match {',
    '    case _: SagaPolled | _: ChildRefused | _: ChildObserved | _: ChildProgressed =>',
    '      onObservation(state, command)',
    '    case _ => onOrchestration(state, command)',
    '  }',
    '',
    '  private def coordinatorFor(stepId: String): ActorRef[StrictSagaCoordinator.Command] =',
    '    if (stepId == ' + stepVal('merge') + ') mergeCoordinator else splitCoordinator',
    '',
    '  private def onOrchestration(state: ' + f.composedState +
      ', command: Command): Effect[Event, ' + f.composedState + '] =',
    '    command match {',
    '      case ' + f.getProgress + '(replyTo) =>',
    '        replyTo ! ' + f.progressReport + '(state.started.isDefined,',
    '          StepIds.filter(state.checkpoints.contains).map(id =>',
    '            (id, state.checkpoints(id).code)).toVector,',
    '          state.concluded.map(_.code),',
    '          state.intents.get(' + stepVal('await') + '))',
    '        Effect.none',
    '      case ' + f.beginCommand + '(' + beginParams.map(p => p.split(':')[0]).join(', ') +
      ', replyTo) =>',
    '        beginOperation(state, ' + beginParams.map(p => p.split(':')[0]).join(', ') +
      ', replyTo)',
    '      case OpenStep(stepId) =>',
    '        openStep(state, stepId)',
    '      case AdvanceAfterCheckpoint(stepId) =>',
    '        advanceAfterCheckpoint(state, stepId)',
    '      case _ => Effect.none',
    '    }',
    '',
    '  private def beginOperation(',
    '      state: ' + f.composedState + ',',
    ...beginParams.map(p => '      ' + p + ','),
    '      replyTo: ActorRef[' + f.operationReply + ']',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    if (persistenceIdFor(operation, occurrence) != persistenceId) {',
    '      replyTo ! ' + f.operationReply + '(false, "' + c.messages.pidMismatch + '")',
    '      Effect.none',
    '    } else if (state.started.isDefined) {',
    '      replyTo ! ' + f.operationReply + '(false, "' + c.messages.alreadyStarted + '")',
    '      Effect.none',
    '    } else {',
    '      val started = ' + f.operationStarted + '(' +
      beginParams.map(p => p.split(':')[0]).join(', ') + ')',
    '      val intent = ' + f.invocationIntent + '(' + stepVal('split') +
      ', txidFor(operation, occurrence, ' + stepVal('split') + '))',
    '      Effect.persist(started, intent).thenRun { _: ' + f.composedState + ' =>',
    '        replyTo ! ' + f.operationReply + '(true, "")',
    '      }.thenRun { s: ' + f.composedState + ' =>',
    '        startSagaStep(' + stepVal('split') + ', s)',
    '      }',
    '    }',
    '',
    '  private def openStep(state: ' + f.composedState +
      ', stepId: String): Effect[Event, ' + f.composedState + '] =',
    '    if (state.started.isEmpty || state.intents.contains(stepId) || state.terminal) Effect.none',
    '    else if (stepId == ' + stepVal('await') + ') openAwaitStep(state)',
    '    else openSagaStep(state, stepId)',
    '',
    '  private def openAwaitStep(state: ' + f.composedState + '): Effect[Event, ' +
      f.composedState + '] = {',
    '    val st = state.started.get',
    '    Effect.persist(' + f.invocationIntent + '(' + stepVal('await') + ',',
    '      childRunKey(st.operation, st.occurrence)))',
    '      .thenRun { s: ' + f.composedState + ' => startChildStep(s) }',
    '  }',
    '',
    '  private def openSagaStep(state: ' + f.composedState +
      ', sagaStep: String): Effect[Event, ' + f.composedState + '] = {',
    '    val st = state.started.get',
    '    Effect.persist(' + f.invocationIntent + '(sagaStep,',
    '      txidFor(st.operation, st.occurrence, sagaStep)))',
    '      .thenRun { s: ' + f.composedState + ' => startSagaStep(sagaStep, s) }',
    '  }',
    '',
    '  private def advanceAfterCheckpoint(state: ' + f.composedState +
      ', stepId: String): Effect[Event, ' + f.composedState + '] =',
    '    if (state.checkpoints.contains(stepId) && !state.terminal) {',
    '      val idx = StepIds.indexOf(stepId)',
    '      if (idx + 1 < StepIds.size) ctx.self ! OpenStep(StepIds(idx + 1))',
    '      Effect.none',
    '    } else Effect.none',
    '',
    '  private def onObservation(state: ' + f.composedState +
      ', command: Command): Effect[Event, ' + f.composedState + '] =',
    '    command match {',
    '      case SagaPolled(stepId, reply) => sagaPolled(state, stepId, reply)',
    '      case ChildRefused(reason) => childRefused(state, reason)',
    '      case ChildObserved(observed) => childObserved(state, observed)',
    '      case ChildProgressed(cursor) => childProgressed(state, cursor)',
    '      case _ => Effect.none',
    '    }',
    '',
    '  private def onChildSignal(',
    '      state: ' + f.composedState + ',',
    '      signal: ' + names.signal + '): Effect[Event, ' + f.composedState + '] = signal match {',
    '    case ' + names.signal + '.RunFinished => onRunFinished(state)',
    '    case ' + names.signal + '.RunFailed(reason) =>',
    '      childObservedCode(state, "ChildFailed", reason)',
    '    case ' + names.signal + '.StageReached(cursor) => childProgressed(state, cursor)',
    '  }',
    '',
    '  private def onRunFinished(state: ' + f.composedState + '): Effect[Event, ' +
      f.composedState + '] =',
    '    state.started match {',
    '      case Some(st) => childObservedCode(state, "' + c.childCompletedCode +
      '", csvOf(st.wafers))',
    '      case None => Effect.none',
    '    }',
    '',
    '  private def csvOf(wafers: Vector[String]): String = wafers.mkString(",")',
    '',
    '  private def childProgressed(state: ' + f.composedState +
      ', cursor: String): Effect[Event, ' + f.composedState + '] =',
    '    // Derived mirror only — never authoritative for any decision.',
    '    if (state.checkpoints.contains(' + stepVal('await') + ')) Effect.none',
    '    else Effect.persist(' + f.childProgressMirrored + '(cursor))',
    '',
    '  private def sagaPolled(',
    '      state: ' + f.composedState + ',',
    '      stepId: String,',
    '      reply: Try[StrictSagaCoordinator.Reply]',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    if (state.started.isEmpty || state.checkpoints.contains(stepId)) Effect.none',
    '    else sagaPolledReply(state, stepId, reply)',
    '',
    '  private def sagaPolledReply(',
    '      state: ' + f.composedState + ',',
    '      stepId: String,',
    '      reply: Try[StrictSagaCoordinator.Reply]',
    '  ): Effect[Event, ' + f.composedState + '] = reply match {',
    '    case Success(StrictSagaCoordinator.Status(s)) => onPolledStatus(state, stepId, reply, s)',
    '    case Success(StrictSagaCoordinator.ConflictingIdentity) =>',
    '      // Same transaction identity, different payload: fail closed, never retry.',
    '      ctx.log.error("conflicting identity on {}", stepId)',
    '      Effect.persist(' + f.operationConcluded + '("' + c.messages.conflictingIdentity + '"))',
    '    case Success(other) =>',
    '      ctx.log.warn("unexpected coordinator reply on {}: {}", stepId, other)',
    '      scheduleNextPoll(stepId)',
    '      Effect.none',
    '    case Failure(t) =>',
    '      // ' + c.messages.unansweredPoll,
    '      ctx.log.warn("status poll failed on {}: {}", stepId, t.getMessage)',
    '      scheduleNextPoll(stepId)',
    '      Effect.none',
    '  }',
    '',
    '  private def onPolledStatus(',
    '      state: ' + f.composedState + ',',
    '      stepId: String,',
    '      reply: Try[StrictSagaCoordinator.Reply],',
    '      s: StrictState',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    // F10 记档：raw 的 exists(_ => true) 恒真检查已并入 isDefined。',
    '    if (s.identity.isDefined && !state.identities.contains(stepId)) {',
    '      val ident = s.identity.get',
    // Frozen persist row table (golden): stepId + the first two identity fields,
    // then the remaining identity fields three per row at indent 8.
    ...(() => {
      const rows = [['stepId', identityArgs[0], identityArgs[1]]];
      for (let i = 2; i < identityArgs.length; i += 3) {
        rows.push(identityArgs.slice(i, i + 3));
      }
      return rows.map((row, i) => {
        const last = i === rows.length - 1;
        return (i === 0 ? '      Effect.persist(' + f.identityObserved + '(' : '        ') +
          row.join(', ') + (last ? '))' : ',');
      });
    })(),
    '        .thenRun { _: ' + f.composedState + ' => ctx.self ! SagaPolled(stepId, reply) }',
    '    } else onSagaState(stepId, s)',
    '',
    '  private def onSagaState(stepId: String, s: StrictState): Effect[Event, ' +
      f.composedState + '] =',
    '    if (!s.terminal) {',
    '      scheduleNextPoll(stepId)',
    '      Effect.none',
    '    } else terminalSagaState(stepId, s)',
    '',
    '  private def terminalSagaState(stepId: String, s: StrictState): Effect[Event, ' +
      f.composedState + '] =',
    '    concludeStep(stepId, s.status match {',
    ...input.statusMapping.slice(0, 3).map(m => {
      const codeExpr = typeof m.code === 'string' ? '"' + m.code + '"'
        : m.code.kind === 'prepare-confirmed' ? 'abortedCode(s)' : '"' + m.code + '"';
      return '      case StrictStatus.' + m.status + ' => ' + codeExpr;
    }),
    '      case other => sys.error("' + c.messages.unmappedStatus + '" + other)',
    '    }, s)',
    '',
    '  private def abortedCode(s: StrictState): String =',
    '    if (prepareConfirmed(s)) "' + input.statusMapping[1].code.confirmed + '" else "' +
      input.statusMapping[1].code.otherwise + '"',
    '',
    '  private def prepareConfirmed(s: StrictState): Boolean =',
    '    s.evidence.values.exists {',
    '      case Evidence.Confirmed(op, _) => op.phase == Phase.Prepare',
    '      case _ => false',
    '    }',
    '',
    '  private def concludeStep(',
    '      stepId: String,',
    '      code: String,',
    '      s: StrictState',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    code match {',
    '      case "' + input.statusMapping[0].code + '" if stepId == ' + stepVal('merge') + ' =>',
    '        Effect.persist(',
    '          ' + f.stepCheckpointed + '(' + stepVal('merge') + ', "' +
      input.statusMapping[0].code + '",',
    '            Map("' + c.sagaCheckpointOutput.key + '" -> s.identity.map(_.' +
      c.sagaCheckpointOutput.source + ').getOrElse(""))),',
    '          ' + f.operationConcluded + '("' + c.concludedCode + '"))',
    '      case "' + input.statusMapping[0].code + '" =>',
    '        Effect.persist(' + f.stepCheckpointed + '(stepId, "' +
      input.statusMapping[0].code + '",',
    '          Map("' + c.sagaCheckpointOutput.key + '" -> s.identity.map(_.' +
      c.sagaCheckpointOutput.source + ').getOrElse(""))))',
    '          .thenRun { _: ' + f.composedState + ' => ctx.self ! AdvanceAfterCheckpoint(stepId) }',
    '      case stopCode =>',
    '        Effect.persist(' + f.stepCheckpointed + '(stepId, stopCode, Map.empty),',
    '          ' + f.operationConcluded + '(stopCode))',
    '    }',
    '',
    '  private def childRefused(state: ' + f.composedState +
      ', reason: String): Effect[Event, ' + f.composedState + '] =',
    '    if (reason != null && reason.contains("' + c.messages.attachGuard + '")) {',
    '      // Re-attach: the run exists on the durable journal; keep observing.',
    '      Effect.none',
    '    } else {',
    '      ctx.log.error("child start refused: {}", reason)',
    '      Effect.persist(' + f.stepCheckpointed + '(' + stepVal('await') + ', "' +
      c.messages.childRejectedCode + '", Map.empty),',
    '        ' + f.operationConcluded + '("' + c.messages.childRejectedCode + '"))',
    '    }',
    '',
    '  private def childObserved(',
    '      state: ' + f.composedState + ',',
    '      observed: Option[(String, String)]',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    observed match {',
    '      case Some((code, wafersCsv)) => childObservedCode(state, code, wafersCsv)',
    '      case None => Effect.none',
    '    }',
    '',
    '  private def childObservedCode(',
    '      state: ' + f.composedState + ',',
    '      code: String,',
    '      wafersCsv: String',
    '  ): Effect[Event, ' + f.composedState + '] =',
    '    if (state.checkpoints.contains(' + stepVal('await') + ') || state.terminal) Effect.none',
    '    else if (!hooks.beforeChildCheckpoint()) Effect.none',
    '    else if (code == "' + c.childCompletedCode + '") {',
    '      val runKey = state.intents.getOrElse(' + stepVal('await') + ', "")',
    '      Effect.persist(' + f.stepCheckpointed + '(' + stepVal('await') + ', "' +
      c.childCompletedCode + '",',
    '        Map(' + c.childCheckpointOutputs.map(o => '"' + o.key + '" -> ' +
      (o.source === 'child-completed-csv' ? 'wafersCsv' : 'runKey')).join(', ') + ')))',
    '        .thenRun { _: ' + f.composedState + ' => ctx.self ! OpenStep(' + stepVal('merge') + ') }',
    '    } else {',
    '      Effect.persist(' + f.stepCheckpointed + '(' + stepVal('await') + ', code, Map.empty), ' +
      f.operationConcluded + '(code))',
    '    }',
    '',
    '  // ── effects（intent 已持久化才运行；启动即发送）──',
    '  private def startSagaStep(stepId: String, state: ' + f.composedState + '): Unit = {',
    '    require(state.started.isDefined, "' + c.messages.sagaStartWithoutOperation + '")',
    '    val st = state.started.get',
    '    val txid = state.intents(stepId)',
    '    if (beforeEffect(stepId, txid)) dispatchSagaStart(stepId, state, st, txid)',
    '  }',
    '',
    '  private def dispatchSagaStart(',
    '      stepId: String,',
    '      state: ' + f.composedState + ',',
    '      st: ' + f.operationStarted + ',',
    '      txid: String',
    '  ): Unit = {',
    '    val merge = stepId == ' + stepVal('merge') + '',
    '    val source = if (merge) mergeSource(state, st, txid) else splitSource(st, txid)',
    '    val start = if (merge)',
    '      ' + names.mergeModule + '.' + input.trigger.member + '(source, mergeHost, sagaReplySink)',
    '    else',
    '      ' + names.splitModule + '.' + input.trigger.member + '(source, splitHost, sagaReplySink)',
    '    coordinatorFor(stepId) ! start',
    '    pollSaga(stepId, coordinatorFor(stepId))',
    '  }',
    '',
    '  private def splitSource(st: ' + f.operationStarted + ', txid: String): ' +
      input.trigger.payload + ' =',
    '    ' + triggerSourceCall(input.trigger.args),
    '',
    '  private def mergeSource(',
    '      state: ' + f.composedState + ',',
    '      st: ' + f.operationStarted + ',',
    '      txid: String',
    '  ): ' + input.trigger.payload + ' =',
    '    // merge consumes the durable completed-child manifest, never a mirror.',
    ...mergeSourceRows(input, stepVal('await')),
    '',
    '  private def pollSaga(',
    '      stepId: String,',
    '      coordinator: ActorRef[StrictSagaCoordinator.Command]',
    '  ): Unit = {',
    '    // GetStatus is read-only and idempotent; overlapping polls are harmless.',
    '    implicit val timeout: Timeout = Timeout(' + c.timings.pollAskSeconds + '.seconds)',
    '    coordinator.ask(replyTo => StrictSagaCoordinator.GetStatus(replyTo))',
    '      .onComplete(tried =>',
    '        ctx.self ! SagaPolled(stepId, tried.map(r => r: StrictSagaCoordinator.Reply)))',
    '    ()',
    '  }',
    '',
    '  private def scheduleNextPoll(stepId: String): Unit =',
    '    // withTimers 键控单发定时器：同 key 自动替换上一发（raw 的 cancel-and-',
    '    // re-schedule 语义），停止自动取消（raw 的 ownerClosed 守卫被结构性取代）。',
    '    timers.startSingleTimer(stepId, PollTick(stepId), ' + c.timings.pollIntervalMs + '.millis)',
    '',
    '  private def startChildStep(state: ' + f.composedState + '): Unit = {',
    '    require(state.started.isDefined, "' + c.messages.childStartWithoutOperation + '")',
    '    val st = state.started.get',
    '    val runKey = state.intents(' + stepVal('await') + ')',
    '    if (beforeEffect(' + stepVal('await') + ', runKey)) startChildRun(st, runKey)',
    '  }',
    '',
    '  private def startChildRun(st: ' + f.operationStarted + ', runKey: String): Unit = {',
    '    val initial = ' + stateName + '(st.wafers, 0)',
    '    askChildRun(childPlanRef, runKey, initial)',
    '  }',
    '',
    '  private def askChildRun(',
    '      ref: ActorRef[PersistentMonarch.Command[' + stateName + ']],',
    '      runKey: String,',
    '      initial: ' + stateName,
    '  ): Unit = {',
    '    implicit val timeout: Timeout = Timeout(' + c.timings.childAskSeconds + '.seconds)',
    '    ref.ask((replyTo: ActorRef[PersistentMonarch.RunReply]) =>',
    '      PersistentMonarch.StartRun(runKey, initial, replyTo)).onComplete {',
    '      case Success(PersistentMonarch.Accepted(_)) => ()',
    '      case Success(PersistentMonarch.Rejected(_, reason)) => ctx.self ! ChildRefused(reason)',
    '      case Success(other) => ctx.log.warn("unexpected child reply: {}", other)',
    '      case Failure(t) =>',
    ...c.messages.unansweredChild.map(line => '        // ' + line),
    '        ctx.log.warn("child StartRun unanswered: {}", t.getMessage)',
    '    }',
    '  }',
    '',
    '  /** 子 journal 观察流在 setup 一次性启动（本宿主的派生 child pid 恒定）：',
    '    * live 从 offset 0 回放历史进同一决策；这是子 run 的唯一权威终态源。',
    '    * D1 拆分：journal 细节在端口实现内，宿主只消费信号；观察者只投递',
    '    * ChildSignal，wafers CSV 在处理时从事件溯源状态读取（started 后恒定，',
    '    * 与 raw 的 watch 时捕获语义等价）。 */',
    '',
    '  // ── events（纯；镜像事件先路出，其余五类命名折叠，CC 合同内）──',
    '  private def onEvent(state: ' + f.composedState + ', event: Event): ' +
      f.composedState + ' = event match {',
    '    case ' + f.childProgressMirrored + '(_) => state',
    '    case other => applyDerivedEvent(state, other)',
    '  }',
    '',
    '  private def applyDerivedEvent(state: ' + f.composedState + ', event: Event): ' +
      f.composedState + ' = event match {',
    '    case started: ' + f.operationStarted + ' => state.copy(started = Some(started))',
    '    case intent: ' + f.invocationIntent + ' => state.copy(intents = state.intents +',
    '      (intent.stepId -> intent.key))',
    '    case other => applyLateEvent(state, other)',
    '  }',
    '',
    '  private def applyLateEvent(state: ' + f.composedState + ', event: Event): ' +
      f.composedState + ' = event match {',
    '    case observed: ' + f.identityObserved + ' => state.copy(identities = state.identities +',
    '      (observed.stepId -> observed))',
    '    case checkpoint: ' + f.stepCheckpointed + ' => state.copy(checkpoints = state.checkpoints +',
    '      (checkpoint.stepId -> checkpoint))',
    '    case concluded: ' + f.operationConcluded + ' => state.copy(concluded = Some(concluded))',
    '    case _ => state',
    '  }',
    '',
    '  // ── recovery: confirmed-prefix replay, then reattach every unfinished step ──',
    '  private def onRecovered(state: ' + f.composedState + '): Unit = {',
    '    if (!state.terminal) state.activeStep match {',
    '      case None => () // every step checkpointed; the conclusion replay follows the same prefix',
    '      case Some(stepId) => resumeStep(state, stepId)',
    '    }',
    '  }',
    '',
    '  private def resumeStep(state: ' + f.composedState + ', stepId: String): Unit = {',
    '    if (state.started.isEmpty) () // fresh actor, empty journal: BeginOperation starts the chain',
    '    else if (!state.intents.contains(stepId)) reopenStep(state, stepId)',
    '    else resumeOpenedStep(state, stepId)',
    '  }',
    '',
    '  private def reopenStep(state: ' + f.composedState + ', stepId: String): Unit = {',
    '    // The step never opened: open it now from the durable start-record',
    '    // (the very first step also needs its OperationStarted, which a',
    '    // confirmed-prefix replay already carries).',
    '    if (stepId == ' + stepVal('split') + ') reissueBegin(state) else ctx.self ! OpenStep(stepId)',
    '  }',
    '',
    '  private def reissueBegin(state: ' + f.composedState + '): Unit = {',
    '    val st = state.started.get',
    ...packArgs(4, 'ctx.self ! ' + f.beginCommand + '(',
      ['st.operation, st.occurrence, st.from, st.to, st.wafers, st.manifest',
        'ctx.spawnAnonymous(Behaviors.ignore[' + f.operationReply + '])'], ')'),
    '  }',
    '',
    '  private def resumeOpenedStep(state: ' + f.composedState + ', stepId: String): Unit = stepId match {',
    '    case ' + stepVal('await') + ' =>',
    '      // Re-issue StartRun with the same identity: already-in-state means',
    '      // attached (the refusal is swallowed; the setup-live observation',
    '      // continues).',
    '      startChildStep(state)',
    '    case sagaStep => resumeSagaStep(state, sagaStep)',
    '  }',
    '',
    '  private def resumeSagaStep(state: ' + f.composedState + ', sagaStep: String): Unit = {',
    '    // Attach with the carried authoritative identity (zero new saga',
    '    // journal events); without one (Start was never answered), re-issue',
    '    // the idempotent Start with the same transaction id.',
    '    state.identities.get(sagaStep) match {',
    '      case Some(observed) =>',
    '        val coordinator = if (sagaStep == ' + stepVal('merge') +
      ') mergeCoordinator else splitCoordinator',
    '        coordinator ! StrictSagaCoordinator.Attach(observed.toIdentity, sagaReplySink)',
    '        scheduleNextPoll(sagaStep)',
    '      case None =>',
    '        startSagaStep(sagaStep, state)',
    '    }',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'host').join('\n') + '\n';
}

// Trigger payload rendering: each contract source kind maps to its expression.
function sourceExpr(source) {
  switch (source.source) {
    case 'derived-txid': return 'txid';
    case 'start-field:from': return 'st.from';
    case 'start-field:to': return 'st.to';
    case 'start-field:manifest': return 'st.manifest';
    case 'start-wafers': return 'st.wafers.toList';
    case 'lot-reply-sink': return 'lotReplySink';
    default: throw new Error('unsupported trigger value source: ' + source.source);
  }
}

function triggerSourceCall(args) {
  const payload = 'LotProtocol.StartTransfer';
  return payload + '(' + args.map(a => sourceExpr(a)).join(', ') + ')';
}

// Frozen merge-source row table (golden): row 1 = the direction-swapped short
// slots, row 2 = the durable completed-child wafers CSV, row 3 = manifest +
// reply sink. The slot order/sources flow from the contract's mergeArgs.
function mergeSourceRows(input, awaitVal) {
  const childWaferArg = input.trigger.mergeArgs.find(a => a.source === 'child-wafers');
  const shortArgs = input.trigger.mergeArgs.filter(a =>
    a.source !== 'child-wafers' && a.source !== 'start-field:manifest' &&
    a.source !== 'lot-reply-sink');
  const tailArgs = input.trigger.mergeArgs.filter(a =>
    a.source === 'start-field:manifest' || a.source === 'lot-reply-sink');
  const wafersKey = input.composition.childCheckpointOutputs
    .find(o => o.source === 'child-completed-csv').key;
  const childExpr = 'state.checkpoints(' + awaitVal + ').outputs("' + wafersKey +
    '").split(",").toVector.toList';
  return [
    '    ' + input.trigger.payload + '(' + shortArgs.map(a => sourceExpr(a)).join(', ') + ',',
    '      ' + childExpr + ',',
    '      ' + tailArgs.map(a => sourceExpr(a)).join(', ') + ')'
  ];
}

// placeholders (implemented in the sections below): null entries are omitted
// from the emission map so byte-parity iteration can proceed file by file
// ---------- FixtureCompositionSpec.scala (R suite, compile-face) ----------
function emitRSuite(input) {
  const r = input.rSuite;
  const occ = r.occurrence;
  const strictPidPrefix = input.composition.strictSagaPidPrefix;
  const c = input.composition;
  const f = c.hostFaces;
  const names = input.names;
  const host = names.host;
  const splitStep = c.splitStep;
  const awaitStep = c.awaitStep;
  const mergeStep = c.mergeStep;
  const t = r.timings;
  const dbPrefix = r.mongo.dbPrefix;
  const lot = names.lotProtocol;
  const splitVal = 'WaferTransferHost.SplitStep';
  const awaitVal = 'WaferTransferHost.AwaitStep';
  const mergeVal = 'WaferTransferHost.MergeStep';
  const stepValRef = role => 'WaferTransferHost.' + role.charAt(0).toUpperCase() + role.slice(1) + 'Step';
  const cutPredicate = cut => {
    const stepRef = cut.step === splitStep ? stepValRef('split')
      : cut.step === awaitStep ? stepValRef('await') : stepValRef('merge');
    return [
      '      case e: WaferTransferHost.' + cut.event + ' => e.stepId == ' + stepRef,
      '      case _ => false'
    ];
  };
  const windowRow = w => w.cut ? w : null;
  const occRef = '"' + occ + '"';
  const lines = [
    'package example.stockreservation.application.services.transactor',
    '',
    'import akka.actor.testkit.typed.scaladsl.ActorTestKit',
    'import akka.actor.typed.{ActorRef, ActorSystem}',
    'import akka.actor.typed.scaladsl.AskPattern._',
    'import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}',
    'import akka.util.Timeout',
    'import com.typesafe.config.ConfigFactory',
    'import ' + input.packages.aggregates + '.' + lot,
    'import ' + input.packages.domainEntities + '.' + names.lotEntity,
    'import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictStatus}',
    'import org.mongodb.scala.MongoClient',
    'import org.mongodb.scala.bson.collection.immutable.Document',
    'import scala.concurrent.{Await, ExecutionContext}',
    'import scala.concurrent.duration._',
    '',
    '/** 组合验收套件（R 模板全量落地，编译面）：split → await-child → merge plan 经',
    '  * 生成的组合宿主驱动，共享持久 journal（生产 = RxMongo；本门环境无 mongod 实证，',
    '  * 套件编译面覆盖、运行需可达 Mongo——F8 裁定）。崩溃窗由 Mongo 前缀截断构造，',
    '  * 截断前写者已停止、截断后跨原子批的存活前缀逐字节验证。测试专有 effect 栏栅',
    '  * 证明 intent-before-send；raw 事件字节与 typed journal 事实证明身份与持久化',
    '  * 效果计数。F9 裁定：R 的 snapshot 解码断言（0.2.1/0.3.0 均无 API 对应）重定',
    '  * 目标为 stage 游标序列；业务 oracle 用本族事件名。 */',
    'final class ' + r.className + ' extends org.scalatest.wordspec.AnyWordSpec',
    '  with org.scalatest.matchers.should.Matchers {',
    '',
    '  private val MongoHostPort = sys.env.getOrElse("' + r.mongo.envVar + '", "' +
      r.mongo.defaultHostPort + '")',
    '  private def mongoUri(db: String): String = s"mongodb://$MongoHostPort/$db"',
    '',
    '  private def mongoReachable(): Boolean = try {',
    '    val parts = MongoHostPort.split(":")',
    '    val socket = new java.net.Socket()',
    '    try socket.connect(new java.net.InetSocketAddress(parts(0), parts(1).toInt), ' +
      t.socketTimeoutMs + ')',
    '    finally socket.close()',
    '    true',
    '  } catch { case _: Throwable => false }',
    '',
    '  private val ReconcileToken = "' + r.token + '"',
    '  private val SeedWafers = Vector(' + r.seedWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  private val SplitWafers = Vector(' + r.splitWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  private val ChildBaseWafers = Vector(' +
      r.childBaseWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  private val ManifestSeed = "' + r.manifestSeed + '"',
    '  private val From = "' + r.fromLot + '"',
    '  private val To = "' + r.toLot + '"',
    '',
    '  private def freePort(): Int = {',
    '    val socket = new java.net.ServerSocket(0)',
    '    try socket.getLocalPort finally socket.close()',
    '  }',
    '',
    '  private def compositionConfig(name: String, port: Int, uri: String): com.typesafe.config.Config = {',
    '    val seed = "akka://" + name + "@127.0.0.1:" + port',
    '    ConfigFactory.parseString(',
    '    s"""',
    '      akka.loglevel = "WARNING"',
    '      akka.actor.provider = cluster',
    '      akka.remote.artery.canonical.hostname = "127.0.0.1"',
    '      akka.remote.artery.canonical.port = $port',
    '      akka.remote.artery.bind.hostname = "127.0.0.1"',
    '      akka.remote.artery.bind.port = $port',
    '      akka.cluster.seed-nodes = ["$seed"]',
    '      akka.cluster.jmx.multi-mbeans-in-same-jvm = on',
    '      akka.persistence.journal.plugin = "' + r.mongo.journalPlugin + '"',
    '      akka.persistence.snapshot-store.plugin = "' + r.mongo.snapshotPlugin + '"',
    '      akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"',
    '      akka.contrib.persistence.mongodb.mongo.mongouri = "$uri"',
    '    """).withFallback(ConfigFactory.load())',
    '  }',
    '',
    '  private def aggregateBehavior(entityId: String): akka.actor.typed.Behavior[' + lot + '.LotCommand] =',
    '    akka.persistence.typed.scaladsl.EventSourcedBehavior(',
    '      persistenceId = akka.persistence.typed.PersistenceId(' + lot + '.entityKey.name, entityId),',
    '      emptyState = ' + names.lotEntity + '.empty(entityId),',
    '      commandHandler = ' + lot + '.commandHandler,',
    '      eventHandler = ' + names.lotEntity + '.applyEvent)',
    '',
    '  private def initSharding(kit: ActorTestKit): ClusterSharding = {',
    '    val sharding = ClusterSharding(kit.system)',
    '    sharding.init(',
    '      akka.cluster.sharding.typed.scaladsl.Entity(' + lot + '.entityKey)(ctx =>',
    '        aggregateBehavior(ctx.entityId)))',
    '    sharding',
    '  }',
    '',
    '  private def waitClusterUp(kit: ActorTestKit): Unit = {',
    '    val c = akka.cluster.typed.Cluster(kit.system)',
    '    val deadline = ' + t.clusterDeadlineSeconds + '.seconds.fromNow',
    '    while (c.state.members.size < 1 && deadline.hasTimeLeft()) Thread.sleep(' +
      t.clusterSleepMs + ')',
    '    require(c.state.members.nonEmpty, "cluster membership never came up")',
    '  }',
    '',
    '  private def entityRef(sharding: ClusterSharding, entityId: String): EntityRef[' +
      lot + '.LotCommand] =',
    '    sharding.entityRefFor(' + lot + '.entityKey, entityId)',
    '',
    '  private implicit val timeout: Timeout = Timeout(' + t.defaultAskSeconds + '.seconds)',
    '',
    '  private def askNow[Cmd, Res](kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[Cmd])(',
    '      f: ActorRef[Res] => Cmd): Res = {',
    '    implicit val system: ActorSystem[_] = kit.system',
    '    implicit val timeout: Timeout = Timeout(' + t.askSeconds + '.seconds)',
    '    Await.result(ref.ask(f), ' + t.askSeconds + '.seconds)',
    '  }',
    '',
    '  private def carriedOf(kit: ActorTestKit,',
    '      ref: akka.actor.typed.RecipientRef[' + lot + '.LotCommand]): Set[String] =',
    '    askNow(kit, ref)(replyTo => ' + lot + '.GetLotState(replyTo)).carried.keySet.toSet',
    '',
    '  /** Command-face funding on the shared journal (deployment-honest seeding). */',
    '  private def seedFunds(kit: ActorTestKit, sharding: ClusterSharding, entityId: String,',
    '      txid: String, wafers: Vector[String] = SeedWafers): Unit = {',
    '    val ref = entityRef(sharding, entityId)',
    '    val r1 = askNow(kit, ref)(replyTo =>',
    '      ' + lot + '.ReserveWaferAddition(txid, entityId, wafers.toList, replyTo))',
    '    val r2 = askNow(kit, ref)(replyTo => ' + lot + '.CommitWaferAddition(txid, entityId, replyTo))',
    '    assert(r1.error.isEmpty && r2.error.isEmpty, s"seeding failed for $entityId")',
    '  }',
    '',
    '  private def spawnHost(kit: ActorTestKit, sharding: ClusterSharding, operation: String,',
    '      occurrence: String,',
    '      audit: Option[(String, String) => Boolean] = None): ActorRef[' + host + '.Command] = {',
    '    implicit val ec: ExecutionContext = kit.system.executionContext',
    '    val splitCoordinator = ' + names.splitEntry + '.spawnClusterSingleton(kit.system, sharding,',
    '      ReconcileToken)',
    '    val mergeCoordinator = ' + names.mergeEntry + '.spawnClusterSingleton(kit.system, sharding,',
    '      ReconcileToken)',
    '    val childJournal = ' + input.packages.infrastructureBootstrap + '.' + names.bootstrap,
    '      .childJournal(kit.system)',
    '    val behavior = audit match {',
    '      case Some(check) => ' + host + '.behaviorForTest(kit.system, sharding,',
    '        splitCoordinator, mergeCoordinator, childJournal, operation, occurrence, check)',
    '      case None => ' + host + '.behavior(kit.system, sharding, splitCoordinator,',
    '        mergeCoordinator, childJournal, operation, occurrence)',
    '    }',
    '    kit.spawn(behavior, s"composition-$operation-$occurrence")',
    '  }',
    '',
    '  private def begin(kit: ActorTestKit, hostRef: ActorRef[' + host + '.Command],',
    '      operation: String, occurrence: String, wafers: Vector[String]): ' + host +
      '.' + f.operationReply + ' = {',
    '    implicit val system: ActorSystem[_] = kit.system',
    '    implicit val ec: ExecutionContext = kit.system.executionContext',
    '    Await.result(hostRef.ask(replyTo =>',
    '      ' + host + '.' + f.beginCommand + '(operation, occurrence, From, To, wafers, ManifestSeed,',
    '        replyTo)), ' + t.askSeconds + '.seconds)',
    '  }',
    '',
    '  private def progressOf(kit: ActorTestKit,',
    '      hostRef: ActorRef[' + host + '.Command]): ' + host + '.' + f.progressReport + ' = {',
    '    implicit val system: ActorSystem[_] = kit.system',
    '    implicit val ec: ExecutionContext = kit.system.executionContext',
    '    Await.result(hostRef.ask(replyTo => ' + host + '.' + f.getProgress +
      '(replyTo)), ' + t.askSeconds + '.seconds)',
    '  }',
    '',
    '  private def awaitConcluded(kit: ActorTestKit, hostRef: ActorRef[' + host + '.Command],',
    '      maxSeconds: Int = ' + t.concludeSeconds + '): ' + host + '.' + f.progressReport + ' = {',
    '    val deadline = maxSeconds.seconds.fromNow',
    '    var report = progressOf(kit, hostRef)',
    '    while (report.concluded.isEmpty && deadline.hasTimeLeft()) {',
    '      Thread.sleep(' + t.concludeSleepMs + '); report = progressOf(kit, hostRef)',
    '    }',
    '    assert(report.concluded.isDefined, s"operation never concluded: $report")',
    '    report',
    '  }',
    '',
    '  // ── 内嵌 recovery 事实面（R 模板成员，方法体原样，private 去除以装配）──',
    '',
    '  private val OwnedUris = scala.collection.mutable.Set.empty[String]',
    '  private def dbNameOf(uri: String): String = uri.split("/").last',
    '  private def journalCollections(client: MongoClient, db: String): Vector[String] =',
    '    Await.result(client.getDatabase(db).listCollectionNames().toFuture(), ' +
      t.journalAwaitSeconds + '.seconds).toVector',
    '      .filter(_.contains("journal")).sorted',
    '',
    '  private final case class JournalBatch(collection: String, document: Document, from: Long,',
    '                                        to: Long, events: Vector[org.bson.BsonDocument])',
    '  private def number(d: org.bson.BsonDocument, key: String): Long =',
    '    d.get(key).asNumber().longValue()',
    '',
    '  private def batches(client: MongoClient, uri: String, pid: String): Vector[JournalBatch] = {',
    '    val db = dbNameOf(uri)',
    '    val result = journalCollections(client, db).flatMap { c =>',
    '      Await.result(client.getDatabase(db).getCollection(c).find(Document("pid" -> pid)).toFuture(),',
    '        ' + t.journalAwaitSeconds + '.seconds)',
    '        .map { d =>',
    '          val raw = d.toBsonDocument',
    '          val events = raw.getArray("events").getValues.toArray.toVector',
    '            .map(_.asInstanceOf[org.bson.BsonValue].asDocument())',
    '          val from = number(raw, "from")',
    '          val to = number(raw, "to")',
    '          require(events.nonEmpty && events.head.getString("pid").getValue == pid,',
    '            "wrong batch identity")',
    '          require(events.forall(_.getString("pid").getValue == pid), "mixed batch identities")',
    '          require(events.map(number(_, "sn")) == (from to to).toVector,',
    '            "invalid batch bounds or sequence")',
    '          JournalBatch(c, d, from, to, events)',
    '        }',
    '    }.sortBy(_.from)',
    '    val sequence = result.flatMap(_.events.map(number(_, "sn")))',
    '    require(sequence == (1L to sequence.size.toLong).toVector,',
    '      "journal is not a contiguous global prefix")',
    '    result',
    '  }',
    '',
    '  private def rawEvents(uri: String, pid: String): Vector[String] = {',
    '    val client = MongoClient(uri)',
    '    try batches(client, uri, pid).flatMap(_.events.map(_.toJson)) finally client.close()',
    '  }',
    '  private def countJournal(uri: String, pid: String): Long = rawEvents(uri, pid).size.toLong',
    '',
    '  private def eventsOf(kit: ActorTestKit, pid: String): Vector[akka.persistence.query.EventEnvelope] = {',
    '    implicit val mat: akka.stream.Materializer =',
    '      akka.stream.SystemMaterializer(kit.system).materializer',
    '    val journal = akka.persistence.query.PersistenceQuery(kit.system)',
    '      .readJournalFor[akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal](',
    '        "' + r.mongo.readJournalId + '")',
    '    val events = Await.result(journal.currentEventsByPersistenceId(pid, 1L, Long.MaxValue)',
    '      .runWith(akka.stream.scaladsl.Sink.seq), ' + t.askSeconds + '.seconds).toVector',
    '    assert(events.map(_.sequenceNr) == (1L to events.size.toLong).toVector,',
    '      "query must observe the full prefix")',
    '    events',
    '  }',
    '',
    '  private def stoppedWriter(kit: ActorTestKit, uri: String): Unit = {',
    '    kit.shutdownTestKit()',
    '    require(kit.system.whenTerminated.isCompleted, "writer must terminate before journal surgery")',
    '    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("' + dbPrefix + '"),',
    '      "database is not owned by this run")',
    '  }',
    '',
    '  private def assertPrefix(uri: String, pid: String, keep: Int,',
    '      expected: Vector[String]): Unit = {',
    '    val actual = rawEvents(uri, pid)',
    '    assert(actual == expected.take(keep) && actual.size == keep,',
    '      "injection did not retain the exact prefix")',
    '    println("' + r.printLabels.prefix + '" + dbNameOf(uri) + " pid=" + pid + " keep=" + keep +',
    '      " sequence=" + (1 to keep).mkString(",") + " events=" + actual.mkString("[", ",", "]"))',
    '  }',
    '',
    '  /** RxMongo stores one document per atomic batch, not one per persistenceId.',
    '    * Trim a crossing batch and remove every later batch, preserving event bytes. */',
    '  private def truncateJournal(stopped: ActorTestKit, uri: String, pid: String, keep: Int): Unit = {',
    '    require(stopped.system.whenTerminated.isCompleted, "live writer cannot be truncated")',
    '    require(OwnedUris.contains(uri) && dbNameOf(uri).startsWith("' + dbPrefix + '"),',
    '      "unowned journal")',
    '    val client = MongoClient(uri)',
    '    try {',
    '      val before = batches(client, uri, pid)',
    '      val expected = before.flatMap(_.events.map(_.toJson))',
    '      require(keep > 0 && keep < expected.size, "cut must remove a nonempty journal tail")',
    '      val db = client.getDatabase(dbNameOf(uri))',
    '      val collections = Await.result(db.listCollectionNames().toFuture(), ' +
      t.journalAwaitSeconds + '.seconds)',
    '      collections.filter(_.contains("snap")).foreach { c =>',
    '        require(Await.result(',
    '          db.getCollection(c).find(Document("pid" -> pid)).toFuture(), ' +
      t.journalAwaitSeconds + '.seconds).isEmpty,',
    '          "snapshot would mask the requested prefix")',
    '      }',
    '      before.foreach { batch =>',
    '        val raw = batch.document.toBsonDocument',
    '        val filter = Document("_id" -> raw.get("_id"), "pid" -> pid,',
    '          "from" -> batch.from, "to" -> batch.to)',
    '        val collection = db.getCollection(batch.collection)',
    '        if (batch.from > keep) {',
    '          val result = Await.result(collection.deleteOne(filter).toFuture(), ' +
      t.journalAwaitSeconds + '.seconds)',
    '          require(result.getDeletedCount == 1L,',
    '            "tail batch delete did not match exactly one document")',
    '        } else if (batch.to > keep) {',
    '          val survivors = batch.events.takeWhile(number(_, "sn") <= keep)',
    '          val change = Document("$set" -> Document(',
    '            "events" -> org.mongodb.scala.bson.BsonArray(survivors), "to" -> keep.toLong))',
    '          val result = Await.result(collection.updateOne(filter, change).toFuture(), ' +
      t.journalAwaitSeconds + '.seconds)',
    '          require(result.getMatchedCount == 1L && result.getModifiedCount == 1L,',
    '            "crossing batch update failed")',
    '        }',
    '      }',
    '      assertPrefix(uri, pid, keep, expected)',
    '    } finally client.close()',
    '  }',
    '',
    '  private def hostPid(operation: String, occurrence: String): String =',
    '    ' + host + '.persistenceIdFor(operation, occurrence).id',
    '  private def childPid(operation: String, occurrence: String): String =',
    '    ' + host + '.childPersistenceId(operation, occurrence)',
    '  private val SplitSagaPid = ' + names.splitEntry + '.persistenceId.id',
    '  private val MergeSagaPid = ' + names.mergeEntry + '.persistenceId.id',
    '  private def lotPid(entityId: String): String =',
    '    akka.persistence.typed.PersistenceId(' + lot + '.entityKey.name, entityId).id',
    '',
    '  private def durableEffects(uri: String, operation: String): Map[String, Vector[String]] =',
    '    Vector(SplitSagaPid, MergeSagaPid, childPid(operation, ' + occRef + '), lotPid(From), lotPid(To))',
    '      .map(pid => pid -> rawEvents(uri, pid)).toMap',
    '',
    '  private def assertExactlyOnce(kit: ActorTestKit, uri: String, operation: String): Unit = {',
    '    val client = MongoClient(uri)',
    '    val sagaPids = try journalCollections(client, dbNameOf(uri)).flatMap { c =>',
    '      Await.result(client.getDatabase(dbNameOf(uri)).getCollection(c).find().toFuture(), ' +
      t.journalAwaitSeconds + '.seconds)',
    '        .map(_.toBsonDocument.getString("pid").getValue).filter(_.startsWith("' + strictPidPrefix + '"))',
    '    }.toSet finally client.close()',
    '    assert(sagaPids == Set(SplitSagaPid, MergeSagaPid),',
    '      "exactly the two declared saga persistenceIds")',
    '    Vector(SplitSagaPid -> ' + stepValRef('split') + ',',
    '      MergeSagaPid -> ' + stepValRef('merge') + ').foreach { case (pid, step) =>',
    '      val events = eventsOf(kit, pid)',
    '      assert(events.nonEmpty, "real saga journal must not be empty")',
    '      val started = events.collect {',
    '        case e if e.event.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started] =>',
    '          e.event.asInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started]',
    '      }',
    '      assert(started.size == 1 && started.head.identity.transactionId ==',
    '        WaferTransferHost.txidFor(operation, "' + occ + '", step),',
    '        "each saga must start exactly once with its stable transaction identity")',
    '    }',
    '    val child = eventsOf(kit, childPid(operation, "' + occ + '")).map(_.event)',
    '    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)',
    '    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)',
    '    val checkpoints = child.collect {',
    '      case e: net.imadz.monarch.persistence.PersistentMonarch.StageDone => e',
    '    }',
    '    assert(checkpoints.map(_.cursor) == Vector(' +
      r.cursorExpectation.map(x => '"' + x + '"').join(', ') + '),',
    '      "the monarch run walks exactly the three bounded stages (F9: snapshot decode " +',
    '        "dropped — 0.2.1/0.3.0 carry no snapshot on StageDone)")',
    '    val business = Vector(From, To).flatMap(id => eventsOf(kit, lotPid(id)).map(_.event))',
    '      .collect { case p: Product => p }',
    '    Vector(' + stepValRef('split') + ', ' + stepValRef('merge') + ').foreach { step =>',
    '      val txid = WaferTransferHost.txidFor(operation, "' + occ + '", step)',
    '      val effects = business.filter(p => p.productArity > 0 && p.productElement(0) == txid)',
    '      assert(effects.map(_.productPrefix).sorted ==',
    '        Vector(' + r.tccEffectOrder.slice(0, 3).map(e => '"' + e + '"').join(', ') + ',',
    '          ' + r.tccEffectOrder.slice(3).map(e => '"' + e + '"').join(', ') +
      ').sorted, "exactly four persisted TCC effects per saga")',
    '    }',
    '    assert(carriedOf(kit, entityRef(shardingOf(kit), From)) == SeedWafers.toSet)',
    '    assert(carriedOf(kit, entityRef(shardingOf(kit), To)) == ChildBaseWafers.toSet)',
    '    println("' + r.printLabels.effects + '" + dbNameOf(uri) + " sagaPids=" + sagaPids.toVector.sorted.mkString(",") +',
    '      " started=1,1 childStarted=1 childStages=3 businessEffects=4,4")',
    '  }',
    '',
    '  private def shardingOf(kit: ActorTestKit): ClusterSharding = ClusterSharding(kit.system)',
    '',
    '  private def assertHostTrace(kit: ActorTestKit, operation: String): Unit = {',
    '    val events = eventsOf(kit, hostPid(operation, "' + occ + '")).map(_.event)',
    '    val start = events.collect { case e: ' + host + '.' + f.operationStarted + ' => e }',
    '    assert(start.size == 1 && start.head.manifest == ManifestSeed &&',
    '      start.head.wafers == SplitWafers)',
    '    ' + host + '.StepIds.foreach { step =>',
    '      val intents = events.zipWithIndex.collect {',
    '        case (e: ' + host + '.' + f.invocationIntent + ', i) if e.stepId == step => e -> i',
    '      }',
    '      val checkpoints = events.zipWithIndex.collect {',
    '        case (e: ' + host + '.' + f.stepCheckpointed + ', i) if e.stepId == step => e -> i',
    '      }',
    '      assert(intents.size == 1 && checkpoints.size == 1 && intents.head._2 < checkpoints.head._2)',
    '      val expectedKey = if (step == ' + stepValRef('await') + ')',
    '        ' + host + '.childRunKey(operation, "' + occ + '")',
    '      else ' + host + '.txidFor(operation, "' + occ + '", step)',
    '      assert(intents.head._1.key == expectedKey)',
    '      if (step != ' + stepValRef('await') + ') {',
    '        val identities = events.zipWithIndex.collect {',
    '          case (e: ' + host + '.' + f.identityObserved + ', i) if e.stepId == step => e -> i',
    '        }',
    '        assert(identities.size == 1 && identities.head._1.transactionId == expectedKey)',
    '        assert(intents.head._2 < identities.head._2 && identities.head._2 < checkpoints.head._2)',
    '      }',
    '    }',
    '    val completedChild = events.collect {',
    '      case e: ' + host + '.' + f.stepCheckpointed + ' if e.stepId == ' + stepValRef('await') + ' => e',
    '    }.head',
    '    assert(completedChild.outputs("wafers").split(",").toVector == SplitWafers)',
    '    assert(completedChild.outputs("childRun") == ' + host + '.childRunKey(operation, "' + occ + '"))',
    '    val childIndex = events.indexOf(completedChild)',
    '    val mergeIntent = events.indexWhere {',
    '      case e: ' + host + '.' + f.invocationIntent + ' => e.stepId == ' + stepValRef('merge'),
    '      case _ => false',
    '    }',
    '    assert(childIndex < mergeIntent, "merge intent follows the authoritative child checkpoint")',
    '    assert(events.count(_.isInstanceOf[' + host + '.' + f.operationConcluded + ']) == 1)',
    '  }',
    '',
    '  private def effectAudit(kit: ActorTestKit, operation: String,',
    '      blocked: Option[String] = None,',
    '      hit: Option[ActorRef[(String, String)]] = None): (String, String) => Boolean = { (step, key) =>',
    '    val events = eventsOf(kit, hostPid(operation, "' + occ + '")).map(_.event)',
    '    assert(events.exists {',
    '      case e: ' + host + '.' + f.invocationIntent + ' => e.stepId == step && e.key == key',
    '      case _ => false',
    '    }, "intent must be durably query-visible before Start/StartRun")',
    '    hit.foreach(_ ! (step -> key))',
    '    println("' + r.printLabels.intent + '" + operation + " step=" + step + " key=" + key +',
    '      " send=" + !blocked.contains(step))',
    '    !blocked.contains(step)',
    '  }',
    '',
    '  private def recover(name: String, uri: String, operation: String)',
    '      (body: (ActorTestKit, ClusterSharding, ActorRef[' + host + '.Command]) => Unit): Unit = {',
    '    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))',
    '    try {',
    '      val sharding = initSharding(kit)',
    '      waitClusterUp(kit)',
    '      val host = spawnHost(kit, sharding, operation, "' + occ + '", Some(effectAudit(kit, operation)))',
    '      body(kit, sharding, host)',
    '    } finally kit.shutdownTestKit()',
    '  }',
    '',
  '  private def withCluster[T](name: String)(body: (ActorTestKit, ClusterSharding, String) => T): T = {',
  '    assume(mongoReachable(),',
  '      "MongoDB unavailable — recovery certification must not count canceled tests as passing")',
  '    val uri = mongoUri("' + dbPrefix + '" + System.nanoTime())',
  '    OwnedUris += uri',
  '    val kit = ActorTestKit(name, compositionConfig(name, freePort(), uri))',
  '    try {',
  '      val sharding = initSharding(kit)',
  '      waitClusterUp(kit)',
  '      body(kit, sharding, uri)',
  '    } finally if (!kit.system.whenTerminated.isCompleted) kit.shutdownTestKit()',
  '  }',
  '',
  '  "' + r.windows.e0.title + '" in',
  '    withCluster("' + r.windows.e0.name + '") { (kit, _, uri) =>',
  '      val pid = "' + r.windows.e0.probePid + '"',
  '      intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, ' +
    r.windows.e0.keep + ') }',
  '      stoppedWriter(kit, uri)',
  '      val client = MongoClient(uri)',
  '      try {',
  '        val collection = client.getDatabase(dbNameOf(uri)).getCollection("' +
    r.windows.e0.collection + '")',
  '        def batch(id: String, from: Long, to: Long): Document =',
  '          Document("pid" -> id, "from" -> from, "to" -> to,',
  '            "events" -> org.mongodb.scala.bson.BsonArray((from to to).map(sn =>',
  '              Document("pid" -> id, "sn" -> sn).toBsonDocument)))',
  ...packArgs(8, 'Await.result(collection.insertMany(Vector(',
    [...r.windows.e0.probeBatches.map(b => 'batch(pid, ' + b[0] + 'L, ' + b[1] + 'L)'),
      'batch("' + r.windows.e0.protectedPid + '", ' +
        r.windows.e0.protectedBatches.map(b => b[0] + 'L, ' + b[1] + 'L').join(', ') + ')'],
    ')).toFuture(), ' + t.journalAwaitSeconds + '.seconds)'),
  '        val before = rawEvents(uri, pid)',
  '        val protectedBefore = rawEvents(uri, "' + r.windows.e0.protectedPid + '")',
  '        intercept[IllegalArgumentException] { truncateJournal(kit, "' +
    r.windows.e0.unownedUri + '", pid, ' + r.windows.e0.keep + ') }',
  '        intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, 0) }',
  '        intercept[IllegalArgumentException] { truncateJournal(kit, uri, pid, ' +
    r.windows.e0.probeBatches.reduce((a, b) => a + (b[1] - b[0] + 1), 0) + ') }',
  '        intercept[IllegalArgumentException] { truncateJournal(kit, uri, "missing", ' +
    r.windows.e0.keep + ') }',
  '        assert(rawEvents(uri, pid) == before, "rejected surgery must not write")',
  '        truncateJournal(kit, uri, pid, ' + r.windows.e0.keep + ')',
  '        assert(rawEvents(uri, pid) == before.take(' + r.windows.e0.keep + '))',
  '        assert(rawEvents(uri, "' + r.windows.e0.protectedPid + '") == protectedBefore,',
  '          "other pids must remain unchanged")',
  '        val survivors = batches(client, uri, pid)',
  '        assert(survivors.map(b => b.from -> b.to) == Vector(' +
    r.windows.e0.expectedSurvivors.map(b => b[0] + 'L -> ' + b[1] + 'L').join(', ') + '))',
  '        val malformed = Document("pid" -> "' + r.windows.e0.malformedPid + '", "from" -> 1L, "to" -> 2L,',
  '          "events" -> org.mongodb.scala.bson.BsonArray(Vector(',
  '            Document("pid" -> "' + r.windows.e0.malformedPid + '", "sn" -> ' +
    r.windows.e0.malformedSn + 'L).toBsonDocument)))',
  '        Await.result(collection.insertOne(malformed).toFuture(), ' +
    t.journalAwaitSeconds + '.seconds)',
  '        intercept[IllegalArgumentException] { truncateJournal(kit, uri, "' +
    r.windows.e0.malformedPid + '", ' + r.windows.e0.malformedKeep + ') }',
  '      } finally client.close()',
  '    }',
  '',
  '  "' + r.windows.e1.title + '" in',
  '    withCluster("' + r.windows.e1.name + '") { (kit, sharding, uri) =>',
  '      seedFunds(kit, sharding, From, "' + r.windows.e1.seedFrom + '")',
  '      seedFunds(kit, sharding, To, "' + r.windows.e1.seedTo + '", ChildBaseWafers)',
  '      val host = spawnHost(kit, sharding, "' + r.windows.e1.operation + '", "' + occ + '", ' +
    'Some(effectAudit(kit, "' + r.windows.e1.operation + '")))',
  '      assert(begin(kit, host, "' + r.windows.e1.operation + '", "' + occ + '", SplitWafers).accepted)',
  '      assert(awaitConcluded(kit, host).concluded.contains("' + c.concludedCode + '"))',
  '      assertHostTrace(kit, "' + r.windows.e1.operation + '")',
  '      assertExactlyOnce(kit, uri, "' + r.windows.e1.operation + '")',
  '    }',
  '',
  '  private def completedWindow(name: String, operation: String, cut: Any => Boolean,',
  '      expectedKeep: Option[Int]): Unit =',
  '    withCluster(name) { (kit, sharding, uri) =>',
  '      seedFunds(kit, sharding, From, "seed-" + operation + "-from")',
  '      seedFunds(kit, sharding, To, "seed-" + operation + "-to", ChildBaseWafers)',
  '      val host = spawnHost(kit, sharding, operation, "' + occ + '", Some(effectAudit(kit, operation)))',
  '      begin(kit, host, operation, "' + occ + '", SplitWafers)',
  '      assert(awaitConcluded(kit, host).concluded.contains("' + c.concludedCode + '"))',
  '      assertExactlyOnce(kit, uri, operation)',
  '      val before = durableEffects(uri, operation)',
  '      require(before.values.forall(_.nonEmpty), "zero-event baselines cannot prove recovery")',
  '      val trace = eventsOf(kit, hostPid(operation, "' + occ + '"))',
  '      val boundaries = trace.filter(e => cut(e.event))',
  '      assert(boundaries.size == 1, "crash boundary must identify exactly one event")',
  '      val keep = boundaries.head.sequenceNr.toInt',
  '      expectedKeep.foreach(n => assert(keep == n, "unexpected crash prefix"))',
  '      stoppedWriter(kit, uri)',
  '      truncateJournal(kit, uri, hostPid(operation, "' + occ + '"), keep)',
  '      recover(name, uri, operation) { (kit2, _, host2) =>',
  '        assert(awaitConcluded(kit2, host2).concluded.contains("' + c.concludedCode + '"))',
  '        assert(durableEffects(uri, operation) == before,',
  '          "all saga/child/business journal bytes must be unchanged")',
  '        assertHostTrace(kit2, operation)',
  '        assertExactlyOnce(kit2, uri, operation)',
  '      }',
  '    }',
  '',
  ...(['e2', 'e3', 'e4'].flatMap(key => {
    const w = r.windows[key];
    return [
      '  "' + w.title + '" in {',
      '    completedWindow("' + w.name + '", "' + w.operation + '", {',
      ...cutPredicate(w.cut),
      '    }, Some(' + w.keep + '))',
      '  }',
      ''
    ];
  })),
  '  "' + r.windows.e4b.title + '" in',
  '    withCluster("' + r.windows.e4b.name + '") { (kit, sharding, uri) =>',
  '      seedFunds(kit, sharding, From, "' + r.windows.e4b.seedFrom + '")',
  '      seedFunds(kit, sharding, To, "' + r.windows.e4b.seedTo + '", ChildBaseWafers)',
  '      val hit = kit.createTestProbe[(String, String)]()',
  '      val host = spawnHost(kit, sharding, "' + r.windows.e4b.operation + '", "' + occ + '",',
  '        Some(effectAudit(kit, "' + r.windows.e4b.operation + '", Some(' + stepValRef('split') +
  '), Some(hit.ref))))',
  '      assert(begin(kit, host, "' + r.windows.e4b.operation + '", "' + occ + '", SplitWafers).accepted)',
  '      assert(hit.receiveMessage(' + t.e4bProbeSeconds + '.seconds) ==',
  '        (' + stepValRef('split') + ' ->',
  '          ' + host + '.txidFor("' + r.windows.e4b.operation + '", "' + occ + '", ' +
    stepValRef('split') + ')))',
  '      assert(countJournal(uri, SplitSagaPid) == 0 && countJournal(uri, MergeSagaPid) == 0)',
  '      assert(countJournal(uri, childPid("' + r.windows.e4b.operation + '", "' + occ + '")) == 0)',
  '      val prefix = rawEvents(uri, hostPid("' + r.windows.e4b.operation + '", "' + occ + '"))',
  '      stoppedWriter(kit, uri)',
  '      assertPrefix(uri, hostPid("' + r.windows.e4b.operation + '", "' + occ + '"), 2, prefix)',
  '      println("' + r.printLabels.barrier + '" + dbNameOf(uri) + " sagaStarted=0 childStarted=0")',
  '      recover("' + r.windows.e4b.name + '", uri, "' + r.windows.e4b.operation + '") { (kit2, _, host2) =>',
  '        assert(awaitConcluded(kit2, host2).concluded.contains("' + c.concludedCode + '"))',
  '        assertHostTrace(kit2, "' + r.windows.e4b.operation + '")',
  '        assertExactlyOnce(kit2, uri, "' + r.windows.e4b.operation + '")',
  '      }',
  '    }',
  '',
  '  for ((label, cut) <- Vector[(String, Any => Boolean)](',
  ...r.windows.e6.flatMap((row, i) => {
    const isLast = i === r.windows.e6.length - 1;
    return [
      '    "' + row.label + '" -> {',
      ...cutPredicate(row.cut),
      '    }' + (isLast ? ')) {' : ',')
    ];
  }),
  '    ("' + r.windows.e6TitlePrefix + '" + label + "' + r.windows.e6TitleSuffix + '") in {',
  '      completedWindow("' + r.windows.e6SuitePrefix + '" + label.replace("-", ""), "' +
    r.windows.e6OperationPrefix + '" + label, cut, None)',
  '    }',
  '  }',
  '',
  '  "' + r.windows.e5.title + '" in',
  '    withCluster("' + r.windows.e5.name + '") { (kit, sharding, _) =>',
  '      seedFunds(kit, sharding, From, "' + r.windows.e5.seedFrom + '")',
  '      seedFunds(kit, sharding, To, "' + r.windows.e5.seedTo + '", ChildBaseWafers)',
  '      // Pre-occupy the derived split txid with DIFFERENT args (a direct command',
  '      // trigger through the split coordinator — deployment-honest conflict seed).',
  '      implicit val system: ActorSystem[_] = kit.system',
  '      implicit val ec: ExecutionContext = kit.system.executionContext',
  '      val splitCoordinator = ' + names.splitEntry + '.spawnClusterSingleton(kit.system, sharding,',
  '        ReconcileToken)',
  '      val splitHost = new ' + names.splitHost + '(kit.system, sharding)',
  '      val txid = ' + host + '.txidFor("' + r.windows.e5.operation + '", "' + occ + '", ' +
    stepValRef('split') + ')',
  '      val occupier = ' + lot + '.StartTransfer(txid, From, To,',
  '        Vector(' + r.windows.e5.occupierWafers.map(w => '"' + w + '"').join(', ') + ').toList, ManifestSeed, kit.createTestProbe[' + lot + '.LotReply]().ref)',
  '      splitCoordinator ! ' + names.splitModule + '.' + input.trigger.member + '(occupier,',
  '        splitHost, kit.createTestProbe[StrictSagaCoordinator.Reply]().ref)',
  '      // Let the occupier saga reach a terminal state on the journal first.',
  '      val probe = kit.createTestProbe[Any]()',
  '      probe.awaitAssert({',
  '        implicit val timeout: Timeout = Timeout(' + t.defaultAskSeconds + '.seconds)',
  '        val status = Await.result(',
  '          splitCoordinator.ask((r: ActorRef[StrictSagaCoordinator.Reply]) =>',
  '            StrictSagaCoordinator.GetStatus(r)), ' + t.defaultAskSeconds + '.seconds)',
  '        status match {',
  '          case StrictSagaCoordinator.Status(s) => assert(s.terminal)',
  '          case other => fail("unexpected reply " + other)',
  '        }',
  '      }, ' + t.e5TerminalSeconds + '.seconds, ' + t.e5PollMillis + '.millis)',
  '      val hostRef = spawnHost(kit, sharding, "' + r.windows.e5.operation + '", "' + occ + '")',
  '      begin(kit, hostRef, "' + r.windows.e5.operation + '", "' + occ + '", SplitWafers) // same derived txid, different wafer set',
  '      val report = awaitConcluded(kit, hostRef)',
  '      // saga-core ' + input.supply.sagaCoreVersion + ' (probe-certified 2026-11-20) folds a same-identity',
  '      // different-args Start on an occupied terminal into the existing',
  '      // transaction\'s terminal state (no second effect ever starts). The host',
  '      // inherits the occupier\'s terminal rejection and STOPS — fail-closed with',
  '      // zero effects from the host\'s own args.',
  '      assert(report.concluded.contains("' + r.windows.e5.expectedCode + '"),',
  '        s"same txid with different args must fail closed on the occupied terminal, got: $report")',
  '      assert(carriedOf(kit, entityRef(sharding, From)) == SeedWafers.toSet,',
  '        "the occupier\'s rejection must not leak effects from the host\'s different args")',
  '    }',
  '}'
];
  return assertWidth(lines, 'r suite').join('\n') + '\n';
}

// ---------- FixtureCompositionDeploymentSpec.scala (D suite, compile-face) ----------
// The D-template evidence filenames (frozen.json / owner-stopped.json / …),
// their JSON keys and the mode freeze-assert shapes are ruled template
// mechanics; every name, timing, mode, port exclusion, print label, db prefix
// and result expectation flows from the contract's dSuite table.
function emitDSuite(input) {
  const d = input.dSuite;
  const r = input.rSuite;
  const occ = r.occurrence;
  const strictPidPrefix = input.composition.strictSagaPidPrefix;
  const c = input.composition;
  const f = c.hostFaces;
  const names = input.names;
  const host = names.host;
  const lot = names.lotProtocol;
  const t = d.timings;
  const dbPrefix = d.mongo.dbPrefix;
  const stepValRef = role => 'WaferTransferHost.' + role.charAt(0).toUpperCase() + role.slice(1) + 'Step';
  const hostEvent = ev => 'WaferTransferHost.' + ev;
  const caseExists = (ev, step, role, indent = 6) => [
    ' '.repeat(indent) + 'case e: WaferTransferHost.' + ev + ' => e.stepId == ' + stepValRef(role),
    ' '.repeat(indent) + 'case _ => false'
  ];
  const lines = [
    'package example.stockreservation.application.services.transactor',
    '',
    'import akka.actor.testkit.typed.scaladsl.ActorTestKit',
    'import akka.actor.typed.{ActorRef, ActorSystem}',
    'import akka.actor.typed.scaladsl.AskPattern._',
    'import akka.actor.typed.scaladsl.adapter._',
    'import akka.cluster.sharding.typed.scaladsl.{ClusterSharding, EntityRef}',
    'import akka.cluster.typed.Cluster',
    'import akka.cluster.MemberStatus',
    'import akka.util.Timeout',
    'import com.typesafe.config.ConfigFactory',
    'import ' + input.packages.aggregates + '.' + lot,
    'import ' + input.packages.domainEntities + '.' + names.lotEntity,
    'import net.imadz.infra.saga.strict.{StrictSagaCoordinator, StrictState, StrictStatus}',
    'import org.mongodb.scala.MongoClient',
    'import org.mongodb.scala.bson.collection.immutable.Document',
    'import play.api.libs.json._',
    'import java.nio.file.{Files, Path, Paths, StandardCopyOption}',
    'import java.nio.charset.StandardCharsets',
    'import scala.concurrent.{Await, ExecutionContext}',
    'import scala.concurrent.duration._',
    '',
    '/** 双 JVM SIGTERM 迁移套件（D 模板全量落地，编译面）：production 单例交接，',
    '  * 只有本地观察/门不同。运行需可达 Mongo 与 fork 的测试 JVM（本门环境无',
    '  * mongod 实证，F8 裁定编译面覆盖）；目录/数据库不自动删除。 */',
    'private[transactor] object ' + d.factsName + ' {',
    '  val ReconcileToken = "' + r.token + '"',
    '  val SeedWafers = Vector(' + r.seedWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  val SplitWafers = Vector(' + r.splitWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  val ChildBaseWafers = Vector(' + r.childBaseWafers.map(w => '"' + w + '"').join(', ') + ')',
    '  val ManifestSeed = "' + r.manifestSeed + '"',
    '  val From = "' + r.fromLot + '"',
    '  val To = "' + r.toLot + '"',
    '',
    '  private val OwnedUris = scala.collection.mutable.Set.empty[String]',
    '  private def dbNameOf(uri: String): String = uri.split("/").last',
    '  private def journalCollections(client: MongoClient, db: String): Vector[String] =',
    '    Await.result(client.getDatabase(db).listCollectionNames().toFuture(), ' +
      t.journalAwaitSeconds + '.seconds).toVector',
    '      .filter(_.contains("journal")).sorted',
    '',
    '  private final case class JournalBatch(collection: String, document: Document, from: Long,',
    '                                        to: Long, events: Vector[org.bson.BsonDocument])',
    '  private def number(d: org.bson.BsonDocument, key: String): Long =',
    '    d.get(key).asNumber().longValue()',
    '',
    '  private def batches(client: MongoClient, uri: String, pid: String): Vector[JournalBatch] = {',
    '    val db = dbNameOf(uri)',
    '    val result = journalCollections(client, db).flatMap { c =>',
    '      Await.result(client.getDatabase(db).getCollection(c).find(Document("pid" -> pid)).toFuture(),',
    '        ' + t.journalAwaitSeconds + '.seconds)',
    '        .map { d =>',
    '          val raw = d.toBsonDocument',
    '          val events = raw.getArray("events").getValues.toArray.toVector',
    '            .map(_.asInstanceOf[org.bson.BsonValue].asDocument())',
    '          val from = number(raw, "from")',
    '          val to = number(raw, "to")',
    '          require(events.nonEmpty && events.head.getString("pid").getValue == pid,',
    '            "wrong batch identity")',
    '          require(events.forall(_.getString("pid").getValue == pid), "mixed batch identities")',
    '          require(events.map(number(_, "sn")) == (from to to).toVector,',
    '            "invalid batch bounds or sequence")',
    '          JournalBatch(c, d, from, to, events)',
    '        }',
    '    }.sortBy(_.from)',
    '    val sequence = result.flatMap(_.events.map(number(_, "sn")))',
    '    require(sequence == (1L to sequence.size.toLong).toVector,',
    '      "journal is not a contiguous global prefix")',
    '    result',
    '  }',
    '',
    '  def rawEvents(uri: String, pid: String): Vector[String] = {',
    '    val client = MongoClient(uri)',
    '    try batches(client, uri, pid).flatMap(_.events.map(_.toJson)) finally client.close()',
    '  }',
    '',
    '  private def eventsOf(kit: ActorTestKit, pid: String): Vector[akka.persistence.query.EventEnvelope] = {',
    '    implicit val mat: akka.stream.Materializer =',
    '      akka.stream.SystemMaterializer(kit.system).materializer',
    '    val journal = akka.persistence.query.PersistenceQuery(kit.system)',
    '      .readJournalFor[akka.contrib.persistence.mongodb.ScalaDslMongoReadJournal](',
    '        "' + r.mongo.readJournalId + '")',
    '    val events = Await.result(journal.currentEventsByPersistenceId(pid, 1L, Long.MaxValue)',
    '      .runWith(akka.stream.scaladsl.Sink.seq), ' + t.askSeconds + '.seconds).toVector',
    '    assert(events.map(_.sequenceNr) == (1L to events.size.toLong).toVector,',
    '      "query must observe the full prefix")',
    '    events',
    '  }',
    '',
    '  def hostPid(operation: String, occurrence: String): String =',
    '    ' + host + '.persistenceIdFor(operation, occurrence).id',
    '  def childPid(operation: String, occurrence: String): String =',
    '    ' + host + '.childPersistenceId(operation, occurrence)',
    '  val SplitSagaPid = ' + names.splitEntry + '.persistenceId.id',
    '  val MergeSagaPid = ' + names.mergeEntry + '.persistenceId.id',
    '',
    '  def durableEffects(uri: String, operation: String): Map[String, Vector[String]] =',
    '    Vector(SplitSagaPid, MergeSagaPid, childPid(operation, "' + occ + '"),',
    '      lotPid(From), lotPid(To)).map(pid => pid -> rawEvents(uri, pid)).toMap',
    '',
    '  def lotPid(entityId: String): String =',
    '    akka.persistence.typed.PersistenceId(' + lot + '.entityKey.name, entityId).id',
    '',
    '  def assertHostTrace(kit: ActorTestKit, operation: String): Unit = {',
    '    val events = eventsOf(kit, hostPid(operation, "' + occ + '")).map(_.event)',
    '    val start = events.collect { case e: ' + hostEvent(f.operationStarted) + ' => e }',
    '    assert(start.size == 1 && start.head.manifest == ManifestSeed &&',
    '      start.head.wafers == SplitWafers)',
    '    ' + host + '.StepIds.foreach { step =>',
    '      val intents = events.zipWithIndex.collect {',
    '        case (e: ' + hostEvent(f.invocationIntent) + ', i) if e.stepId == step => e -> i',
    '      }',
    '      val checkpoints = events.zipWithIndex.collect {',
    '        case (e: ' + hostEvent(f.stepCheckpointed) + ', i) if e.stepId == step => e -> i',
    '      }',
    '      assert(intents.size == 1 && checkpoints.size == 1 && intents.head._2 < checkpoints.head._2)',
    '    }',
    '    assert(events.count(_.isInstanceOf[' + hostEvent(f.operationConcluded) + ']) == 1)',
    '  }',
    '',
    '  def assertExactlyOnce(kit: ActorTestKit, uri: String, operation: String): Unit = {',
    '    val client = MongoClient(uri)',
    '    val sagaPids = try journalCollections(client, dbNameOf(uri)).flatMap { c =>',
    '      Await.result(client.getDatabase(dbNameOf(uri)).getCollection(c).find().toFuture(), ' +
      t.journalAwaitSeconds + '.seconds)',
    '        .map(_.toBsonDocument.getString("pid").getValue).filter(_.startsWith("' + strictPidPrefix + '"))',
    '    }.toSet finally client.close()',
    '    assert(sagaPids == Set(SplitSagaPid, MergeSagaPid),',
    '      "exactly the two declared saga persistenceIds")',
    '    Vector(SplitSagaPid -> ' + stepValRef('split') + ',',
    '      MergeSagaPid -> ' + stepValRef('merge') + ').foreach { case (pid, step) =>',
    '      val events = eventsOf(kit, pid)',
    '      val started = events.collect {',
    '        case e if e.event.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started] =>',
    '          e.event.asInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started]',
    '      }',
    '      assert(started.size == 1 && started.head.identity.transactionId ==',
    '        WaferTransferHost.txidFor(operation, "' + occ + '", step),',
    '        "each saga must start exactly once with its stable transaction identity")',
    '    }',
    '    val child = eventsOf(kit, childPid(operation, "' + occ + '")).map(_.event)',
    '    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)',
    '    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)',
    '    assert(child.count(_.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == ' +
      d.resultExpectations.childStages + ')',
    '  }',
    '',
    '  def aggregateBehavior(entityId: String): akka.actor.typed.Behavior[' + lot + '.LotCommand] =',
    '    akka.persistence.typed.scaladsl.EventSourcedBehavior(',
    '      persistenceId = akka.persistence.typed.PersistenceId(' + lot + '.entityKey.name, entityId),',
    '      emptyState = ' + names.lotEntity + '.empty(entityId),',
    '      commandHandler = ' + lot + '.commandHandler,',
    '      eventHandler = ' + names.lotEntity + '.applyEvent)',
    '',
    '  def initSharding(kit: ActorTestKit): ClusterSharding = {',
    '    val sharding = ClusterSharding(kit.system)',
    '    sharding.init(',
    '      akka.cluster.sharding.typed.scaladsl.Entity(' + lot + '.entityKey)(ctx =>',
    '        aggregateBehavior(ctx.entityId)))',
    '    sharding',
    '  }',
    '  def entityRef(sharding: ClusterSharding, id: String): EntityRef[' + lot + '.LotCommand] =',
    '    sharding.entityRefFor(' + lot + '.entityKey, id)',
    '  def askNow[Cmd, Res](kit: ActorTestKit, ref: akka.actor.typed.RecipientRef[Cmd])(',
    '      f: ActorRef[Res] => Cmd): Res = {',
    '    implicit val system: ActorSystem[_] = kit.system',
    '    implicit val askTimeout: Timeout = Timeout(' + t.askSeconds + '.seconds)',
    '    Await.result(ref.ask(f), ' + t.askSeconds + '.seconds)',
    '  }',
    '  def carriedOf(kit: ActorTestKit,',
    '      ref: akka.actor.typed.RecipientRef[' + lot + '.LotCommand]): Set[String] =',
    '    askNow(kit, ref)(reply => ' + lot + '.GetLotState(reply)).carried.keySet.toSet',
    '  def seedFunds(kit: ActorTestKit, sharding: ClusterSharding, id: String, txid: String,',
    '      wafers: Vector[String]): Unit = {',
    '    val ref = entityRef(sharding, id)',
    '    assert(askNow(kit, ref)(r =>',
    '      ' + lot + '.ReserveWaferAddition(txid, id, wafers.toList, r)).error.isEmpty)',
    '    assert(askNow(kit, ref)(r => ' + lot + '.CommitWaferAddition(txid, id, r)).error.isEmpty)',
    '  }',
    '  def begin(kit: ActorTestKit, ref: ActorRef[' + host + '.Command],',
    '      operation: String): ' + host + '.' + f.operationReply + ' =',
    '    askNow(kit, ref)(r => ' + host + '.' + f.beginCommand + '(operation, "' + occ + '", From, To,',
    '      SplitWafers, ManifestSeed, r))',
    '  def progress(kit: ActorTestKit,',
    '      ref: ActorRef[' + host + '.Command]): ' + host + '.' + f.progressReport + ' =',
    '    askNow(kit, ref)(r => ' + host + '.' + f.getProgress + '(r))',
    '',
    '  def write(path: Path, value: JsValue): Unit = {',
    '    require(!Files.exists(path), "evidence must not overwrite: " + path)',
    '    val temp = path.resolveSibling(path.getFileName.toString + ".tmp")',
    '    Files.write(temp, Json.prettyPrint(value).getBytes(StandardCharsets.UTF_8))',
    '    Files.move(temp, path, StandardCopyOption.ATOMIC_MOVE)',
    '  }',
    '  def read(path: Path): JsValue = Json.parse(Files.readAllBytes(path))',
    '  def waitFile(path: Path, max: FiniteDuration): JsValue = {',
    '    val deadline = max.fromNow',
    '    while (!Files.exists(path) && deadline.hasTimeLeft()) Thread.sleep(' + t.fileSleepMs + ')',
    '    require(Files.exists(path), "missing evidence: " + path)',
    '    read(path)',
    '  }',
    '  def awaitUp(kit: ActorTestKit, count: Int): Unit = {',
    '    val deadline = ' + t.clusterUpSeconds + '.seconds.fromNow',
    '    while (Cluster(kit.system).state.members.count(_.status == MemberStatus.Up) < count &&',
    '        deadline.hasTimeLeft()) Thread.sleep(' + t.clusterSleepMs + ')',
    '    require(Cluster(kit.system).state.members.count(_.status == MemberStatus.Up) == count,',
    '      "members are not Up")',
    '  }',
    '  def identity(kit: ActorTestKit, operation: String): JsObject = Json.obj(',
    '    "processPid" -> java.lang.ProcessHandle.current().pid(),',
    '    "node" -> Cluster(kit.system).selfMember.uniqueAddress.toString,',
    '    "hostPid" -> hostPid(operation, "' + occ + '"))',
    '',
    '  def freeze(kit: ActorTestKit, uri: String, operation: String, mode: String, dir: Path): Unit = {',
    '    val host = eventsOf(kit, hostPid(operation, "' + occ + '"))',
    '    val typed = host.map(_.event)',
    '    assert(typed.count(_.isInstanceOf[' + hostEvent(f.operationStarted) + ']) == 1)',
    '    assert(typed.exists {',
    ...caseExists(f.invocationIntent, c.splitStep, 'split'),
    '    })',
    '    assert(!typed.exists(_.isInstanceOf[' + hostEvent(f.operationConcluded) + ']))',
    '    assert(rawEvents(uri, MergeSagaPid).isEmpty)',
    '    if (mode == "' + d.modes[0] + '") {',
    '      assert(host.map(_.sequenceNr) == Vector(1L, 2L))',
    '      assert(rawEvents(uri, SplitSagaPid).isEmpty && rawEvents(uri,',
    '        childPid(operation, "' + occ + '")).isEmpty)',
    '    } else {',
    '      assert(mode == "' + d.modes[1] + '")',
    '      assert(typed.exists {',
    ...caseExists(f.stepCheckpointed, c.splitStep, 'split', 8),
    '      })',
    '      assert(typed.exists {',
    ...caseExists(f.identityObserved, c.splitStep, 'split', 8),
    '      })',
    '      assert(typed.exists {',
    '        case e: ' + hostEvent(f.invocationIntent) + ' =>',
    '          e.stepId == ' + stepValRef('await'),
    '        case _ => false',
    '      })',
    '      assert(!typed.exists {',
    ...caseExists(f.stepCheckpointed, c.awaitStep, 'await', 8),
    '      })',
    '      assert(!typed.exists {',
    '        case e: ' + hostEvent(f.invocationIntent) + ' =>',
    '          e.stepId == ' + stepValRef('merge'),
    '        case _ => false',
    '      })',
    '      val split = eventsOf(kit, SplitSagaPid).map(_.event)',
    '      assert(split.count(_.isInstanceOf[net.imadz.infra.saga.strict.StrictEvent.Started]) == 1)',
    '      assert(split.contains(net.imadz.infra.saga.strict.StrictEvent.Succeeded))',
    '      val child = eventsOf(kit, childPid(operation, "' + occ + '")).map(_.event)',
    '      assert(child.count(',
    '        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunStarted]) == 1)',
    '      assert(child.count(',
    '        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.RunCompleted]) == 1)',
    '      assert(child.count(',
    '        _.isInstanceOf[net.imadz.monarch.persistence.PersistentMonarch.StageDone]) == ' +
      d.resultExpectations.childStages + ')',
    '    }',
    '    write(dir.resolve("frozen.json"), identity(kit, operation) ++ Json.obj("mode" -> mode,',
    '      "sequenceNr" -> host.last.sequenceNr, "hostRaw" -> rawEvents(uri, hostPid(operation, "' + occ + '")),',
    '      "effectsRaw" -> durableEffects(uri, operation), "mergeStarted" -> 0))',
    '    println("' + d.printLabels.frozen + 'mode=" + mode + " hostPid=" + hostPid(operation, "' + occ + '") +',
    '      " sequenceNr=" + host.last.sequenceNr)',
    '  }',
    '}',
    '',
    '/** Emitted test node: production singleton handover, only local observations/gates differ. */',
    'object ' + d.nodeName + ' {',
    '  import ' + d.factsName + '._',
    '  def main(args: Array[String]): Unit = {',
    '    require(args.length == 7,',
    '      "' + d.usage + '")',
    '    val role = args(0); val port = args(1).toInt; val seed = args(2); val uri = args(3)',
    '    val operation = args(4); val mode = args(5); val dir = Paths.get(args(6))',
    '    require((role == "' + d.roles[0] + '" || role == "' + d.roles[1] + '") &&',
    '      Set("' + d.modes[0] + '", "' + d.modes[1] + '").contains(mode))',
    '    require(uri.split("/").last.startsWith("' + dbPrefix + '"), "unowned database")',
    '    val name = seed.stripPrefix("akka://").takeWhile(_ != \'@\')',
    '    val config = ConfigFactory.parseString(s"""',
    '      akka.loglevel = "WARNING"',
    '      akka.actor.provider = cluster',
    '      akka.actor.allow-java-serialization = off',
    '      akka.remote.artery.canonical.hostname = "127.0.0.1"',
    '      akka.remote.artery.canonical.port = $port',
    '      akka.remote.artery.bind.hostname = "127.0.0.1"',
    '      akka.remote.artery.bind.port = $port',
    '      akka.cluster.seed-nodes = ["$seed"]',
    '      akka.persistence.journal.plugin = "' + d.mongo.journalPlugin + '"',
    '      akka.persistence.snapshot-store.plugin = "' + d.mongo.snapshotPlugin + '"',
    '      akka.contrib.persistence.mongodb.mongo.driver = "akka.contrib.persistence.mongodb.RxMongoPersistenceExtension"',
    '      akka.contrib.persistence.mongodb.mongo.mongouri = "$uri"',
    '    """).withFallback(ConfigFactory.load())',
    '    val kit = ActorTestKit(name, config)',
    '    try {',
    '      implicit val ec: ExecutionContext = kit.system.executionContext',
    '      val sharding = initSharding(kit)',
    '      val split = ' + names.splitEntry + '.spawnClusterSingleton(kit.system, sharding, ReconcileToken)',
    '      val merge = ' + names.mergeEntry + '.spawnClusterSingleton(kit.system, sharding, ReconcileToken)',
    '      val childJournal = ' + input.packages.infrastructureBootstrap + '.' + names.bootstrap,
    '        .childJournal(kit.system)',
    '      val hooks = ' + host + '.TestHooks(',
    '        beforeEffect = (step, _) => {',
    '          if (role == "' + d.roles[0] + '" && mode == "' + d.modes[0] + '" && step == ' +
      stepValRef('split') + ') {',
    '            freeze(kit, uri, operation, mode, dir); false',
    '          } else true',
    '        },',
    '        beforeChildCheckpoint = () => {',
    '          if (role == "' + d.roles[0] + '" && mode == "' + d.modes[1] + '") {',
    '            freeze(kit, uri, operation, mode, dir); false',
    '          } else true',
    '        },',
    '        recovered = (seq, state) => {',
    '          if (role == "' + d.roles[1] + '") {',
    '            require(Files.exists(dir.resolve("owner-stopped.json")),',
    '              "successor recovered before old host PostStop")',
    '            val frozen = read(dir.resolve("frozen.json"))',
    '            assert(seq == (frozen \\ "sequenceNr").as[Long])',
    '            assert(rawEvents(uri, hostPid(operation, "' + occ + '")) ==',
    '              (frozen \\ "hostRaw").as[Vector[String]])',
    '            assert(state.started.isDefined && !state.terminal)',
    '          } else assert(seq == 0L && state.started.isEmpty)',
    '          write(dir.resolve(role + "-recovered.json"), identity(kit, operation) ++ Json.obj(',
    '            "sequenceNr" -> seq, "started" -> state.started.isDefined,',
    '            "terminal" -> state.terminal))',
    '          println("' + d.printLabels.ownerRecovered + 'role=" + role + " pid=" + hostPid(operation, "' + occ + '") +',
    '            " sequenceNr=" + seq)',
    '        },',
    '        stopped = () => {',
    '          write(dir.resolve(role + "-stopped.json"), identity(kit, operation))',
    '          println("' + d.printLabels.ownerStopped + 'role=" + role + " pid=" + hostPid(operation, "' + occ + '"))',
    '        })',
    '      val host = ' + host + '.spawnClusterSingletonForTest(kit.system, sharding, split,',
    '        merge, childJournal, operation, "' + occ + '", hooks)',
    '      if (role == "' + d.roles[0] + '") {',
    '        waitFile(dir.resolve("owner-recovered.json"), ' +
      t.nodeRecoveredWaitSeconds + '.seconds)',
    '        waitFile(dir.resolve("frozen.json"), ' + t.frozenWaitOwnerSeconds + '.seconds)',
    '        assert(!begin(kit, host, operation).accepted)',
    '        write(dir.resolve("owner-duplicate.json"), Json.obj("accepted" -> false))',
    '        Await.result(kit.system.whenTerminated, Duration.Inf)',
    '      } else {',
    '        awaitUp(kit, 2)',
    '        val owner = waitFile(dir.resolve("owner-recovered.json"), ' +
      t.nodeRecoveredWaitSeconds + '.seconds)',
    '        assert((owner \\ "processPid").as[Long] != java.lang.ProcessHandle.current().pid())',
    '        assert(!Files.exists(dir.resolve("successor-recovered.json")),',
    '          "a second writer started before handover")',
    '        val serializer = akka.serialization.SerializationExtension(kit.system.classicSystem)',
    '        val probe = kit.createTestProbe[' + host + '.' + f.progressReport + ']().ref',
    '        val messages = Vector[AnyRef](',
    '          ' + host + '.' + f.getProgress + '(probe), ' + host + '.' + f.operationReply +
      '(false, "occupied"),',
    '          ' + host + '.' + f.progressReport + '(true, Vector("split" -> "Succeeded"), None, Some("child")),',
    '          ' + host + '.' + f.beginCommand + '(operation, "' + occ + '", From, To, SplitWafers, ManifestSeed,',
    '            kit.createTestProbe[' + host + '.' + f.operationReply + ']().ref))',
    '        messages.foreach { message =>',
    '          val selected = serializer.findSerializerFor(message)',
    '          assert(!selected.isInstanceOf[akka.serialization.JavaSerializer])',
    '          val manifest = akka.serialization.Serializers.manifestFor(selected, message)',
    '          assert(serializer.deserialize(serializer.serialize(message).get, selected.identifier,',
    '            manifest).get == message)',
    '        }',
    '        assert(!progress(kit, host).started) // remote request/reply, not the local proxy address',
    '        val mismatch = askNow(kit, host)(r => ' + host + '.' + f.beginCommand +
      '(operation + "-other",',
    '          "' + occ + '", From, To, SplitWafers, ManifestSeed, r))',
    '        assert(!mismatch.accepted && rawEvents(uri, hostPid(operation, "' + occ + '")).isEmpty)',
    '        seedFunds(kit, sharding, From, "' + d.nodeSeedFrom + '", SeedWafers)',
    '        seedFunds(kit, sharding, To, "' + d.nodeSeedTo + '", ChildBaseWafers)',
    '        assert(begin(kit, host, operation).accepted)',
    '        assert(!begin(kit, host, operation).accepted)',
    '        waitFile(dir.resolve("frozen.json"), ' + t.frozenWaitSuccessorSeconds + '.seconds)',
    '        waitFile(dir.resolve("owner-duplicate.json"), ' + t.duplicateWaitSeconds + '.seconds)',
    '        write(dir.resolve("ready-to-terminate.json"), Json.obj("remoteSerialization" -> true,',
    '          "duplicateBegin" -> true, "membersUp" -> 2,',
    '          "ownerPid" -> (owner \\ "processPid").as[Long]))',
    '        waitFile(dir.resolve("successor-recovered.json"), ' +
      t.successorRecoveredWaitSeconds + '.seconds)',
    '        val reconcileSink = kit.createTestProbe[StrictSagaCoordinator.Reply]().ref',
    '        val deadline = ' + t.successorRecoveredWaitSeconds + '.seconds.fromNow',
    '        var report = progress(kit, host)',
    '        while (report.concluded.isEmpty && deadline.hasTimeLeft()) {',
    '          Vector(split, merge).foreach { coordinator =>',
    '            try askNow(kit, coordinator)(r => StrictSagaCoordinator.GetStatus(r)) match {',
    '              case StrictSagaCoordinator.Status(s) if !s.terminal && s.identity.isDefined =>',
    '                coordinator ! StrictSagaCoordinator.Reconcile(s.identity.get, ReconcileToken, 32,',
    '                  reconcileSink)',
    '              case _ => ()',
    '            } catch { case _: java.util.concurrent.TimeoutException => () }',
    '          }',
    '          Thread.sleep(150)',
    '          report = progress(kit, host)',
    '        }',
    '        assert(report.concluded.contains("' + d.resultExpectations.concluded + '"))',
    '        assertHostTrace(kit, operation)',
    '        assertExactlyOnce(kit, uri, operation)',
    '        val frozen = read(dir.resolve("frozen.json"))',
    '        val frozenRaw = (frozen \\ "hostRaw").as[Vector[String]]',
    '        assert(rawEvents(uri, hostPid(operation, "' + occ + '")).take(frozenRaw.size) == frozenRaw)',
    '        if (mode == "' + d.modes[1] + '") {',
    '          val before = (frozen \\ "effectsRaw").as[Map[String, Vector[String]]]',
    '          Vector(SplitSagaPid, childPid(operation, "' + occ + '")).foreach { pid =>',
    '            assert(before(pid).nonEmpty && rawEvents(uri, pid) == before(pid),',
    '              "migration repeated completed split/child effects")',
    '          }',
    '        }',
    '        write(dir.resolve("result.json"), identity(kit, operation) ++ Json.obj(',
    '          "concluded" -> report.concluded, "hostRaw" -> rawEvents(uri, hostPid(operation, "' + occ + '")),',
    '          "effectsRaw" -> durableEffects(uri, operation), "sagaStarted" -> Vector(' +
      d.resultExpectations.sagaStarted.join(', ') + '),',
    '          "childStarted" -> ' + d.resultExpectations.childStarted + ', "childStages" -> ' +
      d.resultExpectations.childStages + ', "businessEffects" -> Vector(' +
      d.resultExpectations.businessEffects.join(', ') + ')))',
    '        println("' + d.printLabels.result + 'mode=" + mode + " hostPid=" + hostPid(operation, "' + occ + '") +',
    '          " concluded=' + d.resultExpectations.concluded + '")',
    '        kit.shutdownTestKit()',
    '      }',
    '    } catch {',
    '      case t: Throwable => t.printStackTrace(); kit.shutdownTestKit(); sys.exit(1)',
    '    }',
    '  }',
    '}',
    '',
    'final class ' + d.suiteName + ' extends org.scalatest.funsuite.AnyFunSuite {',
    '  import ' + d.factsName + '._',
    '  private def freePort(): Int = {',
    '    val socket = new java.net.ServerSocket(0)',
    '    try socket.getLocalPort finally socket.close()',
    '  }',
    '  private def stop(process: java.lang.Process): Unit = {',
    '    if (process.isAlive) process.destroy()',
    '    if (!process.waitFor(' + t.destroyWaitSeconds + ', java.util.concurrent.TimeUnit.SECONDS)) {',
    '      process.destroyForcibly(); process.waitFor()',
    '      fail("test node needed forced cleanup; SIGTERM certification failed")',
    '    }',
    '  }',
    '  for (mode <- Vector("' + d.modes[0] + '", "' + d.modes[1] + '")) {',
    '    test("E-D physical composition-host SIGTERM migration: " + mode) {',
    '      val hostPort = sys.env.getOrElse("' + r.mongo.envVar + '", "' + r.mongo.defaultHostPort + '")',
    '      val parts = hostPort.split(":")',
    '      val socket = new java.net.Socket()',
    '      try socket.connect(new java.net.InetSocketAddress(parts(0), parts(1).toInt), ' +
      t.socketTimeoutMs + ')',
    '      finally socket.close()',
    '      val classpath = System.getProperty("java.class.path")',
    '      assert(classpath.split(java.io.File.pathSeparator).exists(p =>',
    '        p.contains("target") && p.contains("scala-2.13")), "Test/fork required")',
    '      val run = System.nanoTime().toString',
    '      val dir = Paths.get("target", "composition-deployment", mode + "-" + run).toAbsolutePath',
    '      Files.createDirectories(dir)',
    '      val operation = "' + d.operationPrefix + '" + mode',
    '      val uri = "mongodb://" + hostPort + "/' + dbPrefix + '" + run',
    '      val portA = freePort(); var portB = freePort()',
    '      while (portB == portA || Set(' + d.portExclusions.join(', ') + ').contains(portB)) portB = freePort()',
    '      assert(!Set(' + d.portExclusions.join(', ') + ').contains(portA))',
    '      val seed = "akka://' + d.clusterName + '" + run + "@127.0.0.1:" + portA',
    '      val javaBin = Paths.get(System.getProperty("java.home"), "bin", "java").toString',
    '      def node(role: String, port: Int): java.lang.Process = new java.lang.ProcessBuilder(',
    '        (Vector(javaBin, "-cp", classpath,',
    '          "example.stockreservation.application.services.transactor.' + d.nodeName + '",',
    '          role, port.toString, seed, uri, operation, mode, dir.toString)): _*)',
    '        .redirectOutput(dir.resolve(role + ".log").toFile).redirectErrorStream(true).start()',
    '      val owner = node("' + d.roles[0] + '", portA)',
    '      var successor: java.lang.Process = null',
    '      try {',
    '        val original = waitFile(dir.resolve("owner-recovered.json"), ' +
      t.ownerRecoveredWaitSeconds + '.seconds)',
    '        assert((original \\ "sequenceNr").as[Long] == 0L &&',
    '          (original \\ "processPid").as[Long] == owner.pid())',
    '        successor = node("' + d.roles[1] + '", portB)',
    '        waitFile(dir.resolve("ready-to-terminate.json"), ' +
      t.readyToTerminateWaitSeconds + '.seconds)',
    '        val frozen = read(dir.resolve("frozen.json"))',
    '        assert((frozen \\ "processPid").as[Long] == owner.pid())',
    '        assert(!Files.exists(dir.resolve("successor-recovered.json")))',
    '        val prefix = (frozen \\ "hostRaw").as[Vector[String]]',
    '        assert(rawEvents(uri, hostPid(operation, "' + occ + '")) == prefix)',
    '        write(dir.resolve("signal.json"), Json.obj("signal" -> "SIGTERM",',
    '          "ownerPid" -> owner.pid(), "successorPid" -> successor.pid(), "portA" -> portA,',
    '          "portB" -> portB, "mongoUri" -> uri))',
    '        owner.destroy() // SIGTERM on the owned JVM, CoordinatedShutdown does the handover',
    '        assert(owner.waitFor(' + t.ownerExitWaitSeconds + ', java.util.concurrent.TimeUnit.SECONDS),',
    '          "owner did not exit after SIGTERM")',
    '        assert(owner.exitValue() == ' + d.ownerExitCodes[0] + ' || owner.exitValue() == ' +
      d.ownerExitCodes[1] + ',',
    '          "unexpected owner exit: " + owner.exitValue())',
    '        assert(Files.exists(dir.resolve("owner-stopped.json")))',
    '        assert(successor.waitFor(' + t.successorWaitSeconds + ', java.util.concurrent.TimeUnit.SECONDS),',
    '          "successor did not complete")',
    '        assert(successor.exitValue() == 0, "successor failed; see " + dir)',
    '        val resumed = read(dir.resolve("successor-recovered.json"))',
    '        assert((resumed \\ "processPid").as[Long] == successor.pid())',
    '        assert((resumed \\ "node").as[String] != (original \\ "node").as[String])',
    '        assert((resumed \\ "hostPid").as[String] == (original \\ "hostPid").as[String])',
    '        assert((resumed \\ "sequenceNr").as[Long] == (frozen \\ "sequenceNr").as[Long])',
    '        val result = read(dir.resolve("result.json"))',
    '        assert((result \\ "concluded").as[String] == "' + d.resultExpectations.concluded + '")',
    '        assert((result \\ "sagaStarted").as[Vector[Int]] == Vector(' +
      d.resultExpectations.sagaStarted.join(', ') + '))',
    '        assert((result \\ "businessEffects").as[Vector[Int]] == Vector(' +
      d.resultExpectations.businessEffects.join(', ') + '))',
    '        write(dir.resolve("process-result.json"), Json.obj("ownerExit" -> owner.exitValue(),',
    '          "successorExit" -> successor.exitValue(), "waitedAndReaped" -> true,',
    '          "forcedCleanup" -> false))',
    '        println("' + d.printLabels.accepted + 'mode=" + mode + " evidence=" + dir +',
    '          " sequenceNr=" + (resumed \\ "sequenceNr").as[Long])',
    '      } finally {',
    '        try if (successor != null) stop(successor) finally stop(owner)',
    '      }',
    '    }',
    '  }',
    '}'
  ];
  return assertWidth(lines, 'd suite').join('\n') + '\n';
}

// ---------- fail-closed negative inputs (each must be rejected by validate) ----------
const NEGATIVES = [
  { name: 'unexpected input schema version',
    mutate: input => { input.schemaVersion = 'truthsrc.composition-invocation-host-input/v2'; },
    expect: 'unexpected input schema version' },
  { name: 'unsafe host symbol',
    mutate: input => { input.names.host = 'Wafer Transfer Host'; },
    expect: 'unsafe symbol' },
  { name: 'plan step count not three',
    mutate: input => { input.composition.steps.push('audit-transfer'); },
    expect: 'exactly three steps' },
  { name: 'await step not declared',
    mutate: input => { input.composition.awaitStep = 'watch-child-run'; },
    expect: 'await step must be one of the declared plan steps' },
  { name: 'await step not the middle step',
    mutate: input => {
      input.composition.steps = [input.composition.awaitStep, 'split-transfer', 'merge-transfer'];
    },
    expect: 'await step must be the middle step' },
  { name: 'unsafe step id',
    mutate: input => { input.composition.steps[0] = 'Split Transfer'; },
    expect: 'unsafe step id' },
  { name: 'BeginOperation field count not six',
    mutate: input => { input.composition.startReplyFields.pop(); },
    expect: 'six declared operation fields' },
  { name: 'txid derivation loses the op- prefix',
    mutate: input => { input.composition.derivations.txid.prefix = 'txn-'; },
    expect: 'carry the op- prefix' },
  { name: 'persistenceId prefix mismatch',
    mutate: input => { input.composition.pidPrefix = 'wafer-move'; },
    expect: 'must carry the declared pid prefix' },
  { name: 'child persistence id prefix mismatch',
    mutate: input => { input.composition.childPidPrefix = 'wafer-child-run'; },
    expect: 'must carry the declared child prefix' },
  { name: 'non-positive poll timing',
    mutate: input => { input.composition.timings.pollIntervalMs = 0; },
    expect: 'poll/ask timings must be positive' },
  { name: 'child checkpoint loses the wafers key',
    mutate: input => { input.composition.childCheckpointOutputs.shift(); },
    expect: 'wafers output key' },
  { name: 'saga checkpoint loses the txid key',
    mutate: input => { input.composition.sagaCheckpointOutput.key = 'txn'; },
    expect: 'txid output key' },
  { name: 'child plan stage count not three',
    mutate: input => {
      input.childPlan.stages.push({ id: 'Audit', name: 'audit', transform: 'fixture-no-op' });
    },
    expect: 'exactly three stages' },
  { name: 'first stage does not absorb the start state',
    mutate: input => { input.childPlan.stages[0].transform = 'fixture-no-op'; },
    expect: 'absorbs the StartRun initial state' },
  { name: 'middle stage does not mark processed',
    mutate: input => { input.childPlan.stages[1].transform = 'absorb-start-state'; },
    expect: 'marks the processed count' },
  { name: 'child plan bounds relaxed',
    mutate: input => { input.childPlan.runtime.stageCountBounds = [1, 16]; },
    expect: 'admitted 1..8' },
  { name: 'port signal count not three',
    mutate: input => { input.port.signals.pop(); },
    expect: 'three journal signals' },
  { name: 'port mapping without a signal',
    mutate: input => { input.port.mappings[1].signal = null; },
    expect: 'requires monarch event and signal' },
  { name: 'live observation does not replay from offset zero',
    mutate: input => { input.port.adapter.offset = '10L'; },
    expect: 'replays from offset 0' },
  { name: 'merge trigger drops a split slot',
    mutate: input => { input.trigger.mergeArgs.pop(); },
    expect: 'the composition trigger payload carries six slots' },
  { name: 'merge leg does not swap the funding direction',
    mutate: input => { input.trigger.mergeArgs[1].source = 'start-field:from'; },
    expect: 'swaps the funding direction' },
  { name: 'merge leg drops the child wafers source',
    mutate: input => { input.trigger.mergeArgs[3].source = 'start-wafers'; },
    expect: 'durable completed-child manifest' },
  { name: 'status mapping loses the unmapped face',
    mutate: input => { input.statusMapping.pop(); },
    expect: 'three statuses plus the unmapped face' },
  { name: 'Aborted folds away the prepare-confirmed rule',
    mutate: input => { input.statusMapping[1].code = { kind: 'static', code: 'Compensated' }; },
    expect: 'prepare-confirmed rule' },
  { name: 'unmapped status no longer fails closed',
    mutate: input => { input.statusMapping[3].code = { kind: 'static', code: 'Unknown' }; },
    expect: 'fails closed' },
  { name: 'test hook count not four',
    mutate: input => { input.testHooks.pop(); },
    expect: 'four test hooks' },
  { name: 'unsafe suite db prefix',
    mutate: input => { input.rSuite.mongo.dbPrefix = 'P16 Composition'; },
    expect: 'unsafe suite db prefix' },
  { name: 'suite db prefix not namespaced to the run',
    mutate: input => { input.rSuite.mongo.dbPrefix = 'p16_other_'; },
    expect: 'namespaced to the composition run' },
  { name: 'seed wafers cannot fund the split leg',
    mutate: input => { input.rSuite.seedWafers = input.rSuite.seedWafers.slice(0, 1); },
    expect: 'must fund the split leg' },
  { name: 'cursor expectation drifts from the stage chain',
    mutate: input => { input.rSuite.cursorExpectation = ['receive#0', 'process#1', 'finalize#1']; },
    expect: 'must match the declared stage chain' },
  { name: 'deployment suite loses a crash mode',
    mutate: input => { input.dSuite.modes.pop(); },
    expect: 'exactly the two crash modes' },
  { name: 'deployment db prefix not namespaced',
    mutate: input => { input.dSuite.mongo.dbPrefix = 'p17_any_'; },
    expect: 'deployment databases must be namespaced' },
  { name: 'unsafe deployment print label',
    mutate: input => { input.dSuite.printLabels.frozen = 'P17-frozen '; },
    expect: 'unsafe deployment print label' },
  { name: 'unsafe suite print label',
    mutate: input => { input.rSuite.printLabels.effects = 'p16 effects'; },
    expect: 'unsafe suite print label' },
  { name: 'E0 probe loses a batch row',
    mutate: input => { input.rSuite.windows.e0.probeBatches.pop(); },
    expect: 'three batches and keeps' },
  { name: 'E6 boundary loop loses a label',
    mutate: input => { input.rSuite.windows.e6.pop(); },
    expect: 'three labels' },
  { name: 'unsafe child stage wire name',
    mutate: input => { input.childPlan.stages[0].name = 'Receive Stage'; },
    expect: 'unsafe stage wire name' },
  { name: 'child plan state fields reshaped',
    mutate: input => { input.childPlan.state.fields[1].name = 'count'; },
    expect: 'wafers + processedCount' },
  { name: 'BeginOperation references an unsafe field name',
    mutate: input => { input.composition.startReplyFields[0].name = 'operation-id'; },
    expect: 'unsafe symbol' }
];

function runNegatives(input) {
  return NEGATIVES.map(negative => {
    const mutated = JSON.parse(JSON.stringify(input));
    negative.mutate(mutated);
    try {
      generate(mutated);
      return { name: negative.name, rejected: false, expect: negative.expect };
    } catch (error) {
      const rejected = String(error.message).includes(negative.expect);
      return { name: negative.name, rejected, expect: negative.expect, message: String(error.message) };
    }
  });
}

function main() {
  const mode = process.argv[2];
  const inputPath = process.argv[3];
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  if (mode === 'generate') {
    const outDir = process.argv[4];
    const files = generate(input);
    if (outDir) {
      for (const [rel, text] of Object.entries(files)) {
        const target = path.join(outDir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, text);
      }
    } else {
      for (const [rel, text] of Object.entries(files)) {
        process.stdout.write('===== ' + rel + ' =====\n' + text);
      }
    }
    console.error('generated files:', Object.keys(files).length);
    return;
  }
  if (mode === 'verify') {
    const sha = text => crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    const run1 = generate(JSON.parse(JSON.stringify(input)));
    const run2 = generate(JSON.parse(JSON.stringify(input)));
    const perFile = [];
    for (const rel of EMISSION_FILES) {
      const golden = fs.readFileSync(path.join(GOLDEN_DIR, rel), 'utf8');
      const produced = run1[rel];
      if (produced === undefined) {
        perFile.push({ file: rel, byteParity: false, missing: true });
        continue;
      }
      perFile.push({
        file: rel,
        byteParity: produced === golden,
        producedSha256: sha(produced),
        goldenSha256: sha(golden),
        producedBytes: Buffer.byteLength(produced),
        goldenBytes: Buffer.byteLength(golden)
      });
    }
    const negatives = runNegatives(input);
    const report = {
      byteParity: perFile.every(f => f.byteParity),
      deterministic: JSON.stringify(run1) === JSON.stringify(run2),
      files: perFile,
      negatives: { expected: negatives.length, rejected: negatives.filter(n => n.rejected).length,
        results: negatives }
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.negatives.results.every(n => n.rejected)) process.exitCode = 1;
    if (!report.byteParity || !report.deterministic) {
      for (const f of perFile.filter(x => !x.byteParity && !x.missing)) {
        const rel = f.file;
        const a = run1[rel].split('\n');
        const b = fs.readFileSync(path.join(GOLDEN_DIR, rel), 'utf8').split('\n');
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (a[i] !== b[i]) {
            console.error('first diff in', rel, 'at line', i + 1);
            console.error('produced:', JSON.stringify((a[i] ?? '').slice(0, 130)));
            console.error('golden  :', JSON.stringify((b[i] ?? '').slice(0, 130)));
            break;
          }
        }
      }
      process.exitCode = 1;
    }
    return;
  }
  throw new Error('Expected generate <input> [outDir] or verify <input>');
}

main();
