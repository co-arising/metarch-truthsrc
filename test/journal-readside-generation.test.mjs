import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileProductSet } from '../lib/products/compile.mjs';
import { readProductRequest } from '../lib/products/cli.mjs';
import { generate as generateDomain } from '../generators/scala-cqrs-domain-v2/generate.mjs';
import { renderJournalReadside } from '../generators/scala-cqrs-play-service/render-journal-readside.mjs';
import { journalStatements } from '../generators/scala-cqrs-play-service/render-journal-repository.mjs';

const root = new URL('./fixtures/tickets-domain-v4-products/', import.meta.url);
const compilation = compileProductSet(readProductRequest(new URL('files.json', root).pathname));
assert.deepEqual(compilation.diagnostics, []);
const footprint = [
  { id: 'reference-layout', version: '1' }, { id: 'artifact-contract', version: '3' },
  { id: 'exact-value-types', version: '1' }, { id: 'exact-value-codecs', version: '1' }
];
const ref = (kind, id, owner = []) => ({ context: 'tickets', kind, owner, id });
const column = (name, type, nullable = false, size = null) => ({ name, type, size, nullable });
function fixture() {
  const products = Object.fromEntries(compilation.result.products.map(p => [p.id, structuredClone(p.payload)]));
  const options = JSON.parse(readFileSync(new URL('options.json', root), 'utf8'));
  options.service = { artifact: 'ticket-service', externalSourceRoots: [] };
  const store = {
    schemaVersion: 'truthsrc.journal-readside/v1', id: 'TicketReadside', version: 'ticket-query-v1',
    tablePrefix: 'ticket_view', pollIntervalMillis: 1730, closeTimeoutMillis: 23456,
    streams: [{ kind: 'booking', aggregate: ref('aggregate', 'Booking'), identity: ref('state-field', 'type', ['Booking']),
      allowEmptyIdentity: false, eventIdentities: [
        { event: ref('event', 'Reserved', ['Booking']), field: ref('event-slot', 'type', ['Booking', 'Reserved']) },
        { event: ref('event', 'Imported', ['Booking']), field: ref('event-slot', 'type', ['Booking', 'Imported']) }
      ] }],
    technicalKinds: ['audit-run'],
    indexes: [{ id: 'WorkItem', table: 'work_item', columns: [
      column('item_key', 'digest'), column('segment', 'text', false, 32), column('item_label', 'text', true, 128),
      column('rank_no', 'long'), column('active_flag', 'boolean'), column('detail_bytes', 'bytes'),
      column('optional_rank', 'long', true), column('optional_flag', 'boolean', true),
      column('optional_digest', 'digest', true), column('optional_bytes', 'bytes', true)
    ], key: ['segment', 'item_key'], queries: [
      { id: 'allitems', where: [], orderBy: ['rank_no', 'segment', 'item_key'] },
      { id: 'bylabel', where: ['item_label', 'active_flag'], orderBy: ['segment', 'item_key'] },
      { id: 'byrank', where: ['optional_rank', 'optional_flag'], orderBy: ['segment', 'item_key'] }
    ] }]
  };
  products['artifact-contract'] = { artifacts: [{ id: 'ticket-service', artifact: ref('artifact', 'TicketService'),
    status: 'selected', source: { document: 'domain', pointer: '/artifactContracts/0' },
    deployment: { service: { projectionStore: store } } }] };
  return { products, options, store };
}
const generate = input => renderJournalReadside(input, footprint);
const file = (entries, suffix) => entries.find(e => e.path.endsWith(suffix));
const section = (content, begin, end) => {
  assert.ok(content.includes(begin), begin);
  assert.ok(content.includes(end), end);
  return content.slice(content.indexOf(begin), content.indexOf(end, content.indexOf(begin) + begin.length));
};

test('deterministic optional producer emits exactly five complete entries without changing input', () => {
  const input = fixture(), original = structuredClone(input), first = generate(input);
  assert.deepEqual(first, generate(input));
  assert.deepEqual(input, original);
  assert.deepEqual(first.map(e => e.path), [
    ...['Schema', 'Repository', 'Projection', 'Domain'].map(s => `app/example/tickets/infrastructure/projection/TicketReadside${s}.scala`),
    'conf/sql/TicketReadside.sql'
  ]);
  for (const entry of first) {
    assert.deepEqual(entry.productFootprint, footprint);
    assert.equal(entry.merge, null);
    assert.ok(entry.content.length && entry.knowledgeIds.length && entry.codeMappings.length);
    assert.ok(['service-runtime', 'service-config'].includes(entry.kind));
    assert.equal(new Set(entry.deps).size, entry.deps.length);
  }
});

test('absent projectionStore produces no output and does not access domain products', () => {
  const input = fixture();
  delete input.products['artifact-contract'].artifacts[0].deployment.service.projectionStore;
  delete input.products['reference-layout'];
  assert.deepEqual(generate(input), []);
});

test('selection uses the explicitly selected artifact, not artifact order or serviceSelection', () => {
  const input = fixture();
  input.products['artifact-contract'].artifacts.unshift({ ...structuredClone(input.products['artifact-contract'].artifacts[0]), id: 'unrelated' });
  assert.equal(generate(input).length, 5);
  input.options.service.artifact = 'absent';
  assert.throws(() => generate(input), /one selected service artifact required/);
  const renderer = readFileSync(new URL('../generators/scala-cqrs-play-service/render-journal-readside.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /from ['"]\.\/render-service/);
});

test('schema preserves core column types, implicit namespace and exact declared index layout', () => {
  const input = fixture(), entries = generate(input), sql = file(entries, '.sql').content;
  assert.ok(sql.startsWith('-- @generated'));
  for (const value of ['namespace VARCHAR(64)', 'schema_version VARCHAR(64)', 'pid_key CHAR(64)',
    'persistence_id VARCHAR(2048)', 'kind VARCHAR(32)', 'resource_id VARCHAR(2048)',
    'owner_account VARCHAR(1024)', 'owner_principal VARCHAR(256)', 'last_sequence BIGINT',
    'observed_sequence BIGINT', 'state_payload LONGBLOB', 'sequence_nr BIGINT',
    'payload_type VARCHAR(512)', 'payload_manifest VARCHAR(1024)', 'payload LONGBLOB',
    'item_key CHAR(64) NOT NULL', 'item_label VARCHAR(128),', 'optional_rank BIGINT,',
    'optional_flag BOOLEAN,', 'optional_bytes LONGBLOB,', 'PRIMARY KEY (namespace, segment, item_key)']) assert.ok(sql.includes(value), value);
  const statements = journalStatements(input.store);
  assert.equal(statements.length, 4);
  for (const statement of statements) {
    assert.match(statement, /^CREATE TABLE IF NOT EXISTS ticket_view_\w+ \(\n  namespace VARCHAR\(64\) NOT NULL/);
    assert.ok(file(entries, 'Schema.scala').content.includes(JSON.stringify(statement)));
    assert.ok(sql.includes(statement + ';'));
  }
});

test('repository public API uses the exact row/payload/state/owner and ordered typed index records', () => {
  const content = file(generate(fixture()), 'Repository.scala').content;
  for (const text of [
    'final case class Row(pid: String, kind: String, resource: String, account: Option[String], principal: Option[String], last: Long, observed: Option[Long], payload: Option[Array[Byte]])',
    'final case class Payload(kind: String, manifest: String, bytes: Array[Byte])',
    'final case class State(payload: Option[Array[Byte]], account: Option[String], principal: Option[String])',
    'final case class Owner(pid: String, account: Option[String], principal: Option[String])',
    'final class TicketReadsideRepository(namespace: String, dataSource: DataSource)',
    'def initialize(): Unit', 'def read[A](f: Session => A): A', 'def write[A](f: Session => A): A',
    'def row(pid: String): Option[Row]', 'def owners(pid: String): Option[Owner]',
    'def ensureRow(pid: String, kind: String, resource: String): Row',
    'def event(pid: String, sequence: Long): Option[Payload]',
    'def append(row: Row, sequence: Long, payload: Payload, state: State): Row',
    'def observe(pid: String, high: Long): Unit', 'def invalidate(pid: String): Unit', 'def invalidateAll(): Unit',
    'def streamPage(kind: String, account: String, principal: String, limit: Long, after: Long): Vector[Row]',
    'def hash(value: String): String', 'f"${b & 0xff}%02x"',
    'final case class WorkItem(item_key: String, segment: String, item_label: Option[String], rank_no: Long, active_flag: Boolean, detail_bytes: Array[Byte], optional_rank: Option[Long], optional_flag: Option[Boolean], optional_digest: Option[String], optional_bytes: Option[Array[Byte]])',
    'def putWorkItem(record: TicketReadsideRepository.WorkItem): Unit', 'def deleteWorkItem(segment: String, item_key: String): Unit',
    'def queryWorkItemallitems(limit: Long, after: Long): Vector[TicketReadsideRepository.WorkItem]',
    'def queryWorkItembylabel(item_label: Option[String], active_flag: Boolean, limit: Long, after: Long): Vector[TicketReadsideRepository.WorkItem]'
  ]) assert.ok(content.includes(text), text);
  assert.match(content, /if \(result.wasNull\(\)\) None else Some\(value\)/);
  assert.match(content, /Option\(result.getBytes\("optional_bytes"\)\)/);
  assert.match(content, /Option\(result.getString\("optional_digest"\)\)/);
});

test('every mutation and typed index operation stays on the write-locked transaction connection', () => {
  const content = file(generate(fixture()), 'Repository.scala').content;
  const transaction = section(content, 'private def transaction', 'final class Session');
  for (const text of ['Connection.TRANSACTION_REPEATABLE_READ', 'connection.setAutoCommit(false)',
    'WHERE namespace=? FOR UPDATE', 'new Session(connection, writable)', 'val result = f(session)',
    'connection.commit()', 'connection.rollback()', 'error.addSuppressed(rollback)',
    'finally session.finish()', 'finally connection.close()']) assert.ok(transaction.includes(text), text);
  assert.ok(transaction.indexOf('FOR UPDATE') < transaction.indexOf('f(session)'));
  const session = content.slice(content.indexOf('final class Session'));
  assert.doesNotMatch(session, /getConnection|dataSource|\.commit\(|\.rollback\(|new Session/);
  assert.match(session, /require\(writable, "write transaction required"\)/);
  assert.match(session, /require\(active, "transaction session is closed"\)/);
  assert.match(session, /execute\(connection, sql, values\)/);
  assert.match(session, /query\(connection, sql, values\)\(decode\)/);
  for (const method of ['ensureRow', 'append', 'observe', 'invalidate', 'invalidateAll', 'putWorkItem', 'deleteWorkItem']) {
    assert.match(session, new RegExp(`def ${method}\\([^\\n]*\\): [^\\n]* = \\{\\n      requireWrite\\(\\)`));
  }
  const put = section(content, 'def putWorkItem', 'def deleteWorkItem');
  assert.ok(put.indexOf('deleteWorkItem(record.segment, record.item_key)') < put.indexOf('INSERT INTO ticket_view_work_item(namespace,'));
  assert.match(content, /finally statement.close\(\)/);
  assert.match(content, /finally result.close\(\)/);
});

test('queries scope namespace and preserve declared ordering with null-safe equality parameters', () => {
  const content = file(generate(fixture()), 'Repository.scala').content;
  assert.match(content, /WHERE namespace=\? AND kind=\? AND owner_account=\? AND \(owner_principal IS NULL OR owner_principal=\?\) ORDER BY resource_id,pid_key LIMIT \? OFFSET \?/);
  assert.match(content, /Seq\(namespace, kind, account, principal, limit, after\)/);
  assert.match(content, /WHERE namespace=\? AND \(item_label=\? OR \(item_label IS NULL AND \? IS NULL\)\) AND active_flag=\? ORDER BY segment,item_key LIMIT \? OFFSET \?/);
  assert.match(content, /Seq\(namespace, item_label, item_label, active_flag, limit, after\)/);
  assert.match(content, /Seq\(namespace, optional_rank, optional_rank, optional_flag, optional_flag, limit, after\)/);
  assert.match(content, /WHERE namespace=\? ORDER BY rank_no,segment,item_key LIMIT \? OFFSET \?/);
  assert.match(content, /WHERE namespace=\? AND segment=\? AND item_key=\?/);
  const owners = section(content, 'def owners', 'def ensureRow');
  assert.doesNotMatch(owners, /state_payload|last_sequence|SELECT \*/);
  assert.match(owners, /PID digest collision/);
});

test('projection exposes the agreed path-dependent port signatures with a stable repository', () => {
  const content = file(generate(fixture()), 'Projection.scala').content;
  for (const text of ['final case class Envelope(pid: String, sequenceNr: Long, event: Any)',
    'def namespace: String', 'def persistenceIds(): Source[String, NotUsed]',
    'def currentEvents(pid: String, after: Long): Future[Vector[Envelope]]',
    'def events(pid: String, after: Long): Source[Envelope, NotUsed]',
    'def identity(pid: String): (String, String)',
    'def fold(row: TicketReadsideRepository.Row, event: Any): TicketReadsideRepository.State',
    'def indexes(session: TicketReadsideRepository#Session, row: TicketReadsideRepository.Row): Unit',
    '(implicit system: ActorSystem[_], ec: ExecutionContext) extends AutoCloseable',
    'private val repository = new TicketReadsideRepository(namespace, dataSource)',
    'def initialize(): Future[Unit]', 'def project(envelope: Envelope): Future[Unit]',
    'def catchUp(pid: String): Future[Unit]', 'def start(): Future[Unit]',
    'def shutdown(): Future[Unit]', 'def close(): Unit',
    'def read[A](f: TicketReadsideRepository#Session => A): Future[A]',
    'repository.read(session => f(session))']) assert.ok(content.includes(text), text);
  assert.match(content, /pid != null && pid.nonEmpty && sequenceNr > 0L && event != null/);
});

test('projection rejects foreign identity before SQL and compares exact body before duplicate success', () => {
  const content = file(generate(fixture()), 'Projection.scala').content;
  assert.match(content, /allowedKinds: Set\[String\] = Set\("booking", "audit-run"\)/);
  assert.match(content, /require\(allowedKinds.contains\(kind\)/);
  const project = section(content, 'def project(envelope', 'def read[A]');
  assert.ok(project.indexOf('identity(envelope.pid)') < project.indexOf('initialize()'));
  assert.ok(project.indexOf('payload(envelope.event)') < project.indexOf('case Some(existing)'));
  assert.match(project, /existing.kind == serialized.kind && existing.manifest == serialized.manifest/);
  assert.match(project, /java.util.Arrays.equals\(existing.bytes, serialized.bytes\)/);
  const duplicate = section(project, 'case Some(existing)', 'case None');
  assert.doesNotMatch(duplicate, /bindings.fold|append\(|indexes\(/);
  assert.ok(project.indexOf('Math.addExact(row.last, 1L)') < project.indexOf('bindings.fold'));
  assert.ok(project.indexOf('bindings.fold') < project.indexOf('session.append'));
  assert.ok(project.indexOf('session.append') < project.indexOf('bindings.indexes(session, next)'));
  assert.equal((project.match(/repository.write/g) ?? []).length, 1);
  assert.match(content, /message.toByteArray/);
  assert.match(content, /serialization.findSerializerFor\(ref\)/);
  assert.match(content, /Serializers.manifestFor\(serializer, ref\), serializer.toBinary\(ref\)/);
  assert.doesNotMatch(content, /event.toString|ref.toString|ObjectOutputStream/);
});

test('queries stay read-only and existing look-ahead paging and asynchronous catch-up errors are preserved', () => {
  const entries = generate(fixture()), projection = file(entries, 'Projection.scala').content;
  const read = section(projection, 'def read[A]', 'def catchUp');
  assert.ok(read.includes('tracked()'));
  assert.ok(read.includes('Future(repository.read(session => f(session)))'));
  assert.ok(!read.includes('initialize()') && !read.includes('repository.write'));
  const catchUp = section(projection, 'def catchUp', 'private def invalidate');
  assert.ok(catchUp.startsWith('def catchUp(pid: String): Future[Unit] = tracked() {'));
  assert.ok(catchUp.indexOf('identity(pid)') < catchUp.indexOf('initialize()'));
  const repository = file(entries, 'Repository.scala').content;
  assert.ok(repository.includes('after <= Int.MaxValue.toLong, "bounded page required"'));
  assert.ok(!repository.includes('after <= Int.MaxValue.toLong - limit'));
});

test('frontiers remain per-PID and shutdown drains tracked subscriptions, reads and initialization', () => {
  const entries = generate(fixture()), projection = file(entries, 'Projection.scala').content, repository = file(entries, 'Repository.scala').content;
  assert.match(projection, /events.forall\(_\.pid == pid\)/);
  assert.match(projection, /val high = events.lastOption.map\(_\.sequenceNr\).getOrElse\(after\)/);
  assert.match(repository, /high >= 0L && high <= current.last/);
  assert.match(repository, /if \(current.last == high\) Some\(high\) else None/);
  assert.match(repository, /last_sequence=\?,observed_sequence=NULL/);
  assert.match(projection, /\.transformWith\(_ => invalidate\(pid\).map\(_ => Done\)\)/);
  assert.match(projection, /if \(!closed && discovery.isEmpty\)/);
  assert.match(projection, /poll.foreach\(_\.cancel\(\)\)/);
  assert.match(projection, /stop.shutdown\(\)/);
  assert.match(projection, /val result = drained.future.flatMap/);
  assert.match(projection, /ready.flatMap\(_ => Future\(repository.write\(_\.invalidateAll\(\)\)\)\)/);
  assert.match(projection, /pendingWork \+= 1/);
  assert.match(projection, /pendingWork -= 1/);
  assert.match(projection, /closed && pendingWork == 0/);
  assert.match(projection, /tracked\(\) \{ Future\(repository.initialize\(\)\) \}/);
  assert.match(projection, /def read\[A\][^\n]* = tracked\(\)/);
  assert.match(projection, /scheduleWithFixedDelay\(Duration.Zero, 1730.millis\)/);
  assert.match(projection, /Await.result\(shutdown\(\), 23456.millis\)/);
  assert.doesNotMatch(projection, /journal.close|dataSource.close|system.terminate|globalOffset/);
});

test('domain reuses exact original nominal carriers, PB, converters and event fold without owner rules', () => {
  const content = file(generate(fixture()), 'Domain.scala').content;
  for (const text of ['def bookingState(row: Row): example.tickets.domain.BookingState',
    'DomainConverters.decodeBookingStatePB(example.tickets.infrastructure.proto.BookingStatePB.parseFrom(bytes))',
    'BookingState.empty.copy(`type` = example.tickets.domain.values.TicketId(row.resource))',
    'def booking(row: Row, next: example.tickets.domain.BookingState): (Option[String], Option[String])',
    'BookingEventAdapter', '.fromJournal(message, message.getClass.getSimpleName)',
    '.events.foldLeft(bookingState(row))', 'case value: example.tickets.domain.BookingProtocol.Reserved',
    'case value: example.tickets.domain.BookingProtocol.Imported', 'require(value.`type`.value == row.resource',
    'example.tickets.domain.BookingEventHandler(state, event)',
    'require(next.`type`.value == row.resource', 'ownership.booking(row, next)',
    'DomainConverters.encodeBookingStatePB(next).toByteArray',
    'case "audit-run" => State(None, None, None)',
    'case _ => throw new IllegalArgumentException("unrecognized persistence kind")']) assert.ok(content.includes(text), text);
  assert.doesNotMatch(content, /next\.`type`\.value\.isEmpty|row.account|row.principal|Rules|CommandHelpers|toString/);
  assert.ok(content.indexOf('require(value.`type`.value') < content.indexOf('BookingEventHandler(state, event)'));
});

test('primitive identity, nested nominal text and empty-identity flag are driven only by declarations', () => {
  const primitive = fixture(), declarations = primitive.products['reference-layout'].declarations;
  for (const d of declarations.filter(d => d.ref.id === 'type' && ['state-field', 'event-slot'].includes(d.ref.kind)))
    d.valueType = { form: 'primitive', name: 'string' };
  primitive.store.streams[0].allowEmptyIdentity = true;
  primitive.store.streams[0].kind = 'ticket-booking';
  const first = file(generate(primitive), 'Domain.scala').content;
  assert.match(first, /def `ticket-bookingState`/);
  assert.match(first, /def `ticket-booking`\(row/);
  assert.match(first, /empty.copy\(`type` = row.resource\)/);
  assert.match(first, /require\(value\.`type` == row.resource/);
  assert.match(first, /require\(next\.`type`\.isEmpty \|\| next\.`type` == row.resource/);
  assert.doesNotMatch(first, /`type`\.value/);
  const nested = fixture(), rows = nested.products['reference-layout'].declarations;
  rows.find(d => d.ref.kind === 'type' && d.ref.id === 'TicketId').valueType = { form: 'nominal', ref: ref('type', 'TextId') };
  rows.push({ ref: ref('type', 'TextId'), valueType: { form: 'primitive', name: 'string' }, source: { document: 'domain', pointer: '/valueObjects/9' }, dependencies: [] });
  const second = file(generate(nested), 'Domain.scala').content;
  assert.match(second, /TicketId\(example.tickets.domain.values.TextId\(row.resource\)\)/);
  assert.match(second, /value\.`type`\.value\.value == row.resource/);
});

test('no indexes or event identities means no invented index or event policy', () => {
  const input = fixture();
  input.store.indexes = [];
  input.store.streams[0].eventIdentities = [];
  input.store.technicalKinds = [];
  const entries = generate(input);
  assert.equal(journalStatements(input.store).length, 3);
  assert.doesNotMatch(file(entries, 'Repository.scala').content, /def put|def delete|def queryWorkItem/);
  const domain = file(entries, 'Domain.scala').content;
  assert.doesNotMatch(domain, /case value:|event identity mismatch|State\(None, None, None\)/);
  assert.match(domain, /unrecognized persistence kind/);
});

test('all dependency paths name actual generated files and all code mappings have exact UTF-8 spans', () => {
  const input = fixture();
  input.store.version = 'ticket-query-v1-λ';
  const entries = generate(input);
  const manifest = JSON.parse(readFileSync(new URL('../generators/scala-cqrs-domain-v2/generator.json', import.meta.url), 'utf8'));
  const { service: ignored, ...domainOptions } = input.options;
  const domain = generateDomain({ compilation, manifest, options: domainOptions });
  assert.deepEqual(domain.diagnostics, []);
  const paths = new Set([...entries, ...domain.plan.entries].map(e => e.path));
  for (const entry of entries) {
    for (const dependency of entry.deps) assert.ok(paths.has(dependency), dependency);
    const bytes = Buffer.from(entry.content);
    for (const mapping of entry.codeMappings) {
      for (const span of [mapping.span, mapping.scope]) {
        assert.equal(bytes.subarray(span.start, span.end).toString(), span.text);
        assert.ok(span.end > span.start && span.end <= bytes.length);
      }
      assert.ok(mapping.scope.start <= mapping.span.start && mapping.scope.end >= mapping.span.end);
      assert.ok(entry.knowledgeIds.includes(mapping.knowledgeKey));
    }
    assert.ok(entry.codeMappings.some(m => m.knowledgeKey.endsWith('/deployment/service/projectionStore')));
  }
  const domainEntry = file(entries, 'Domain.scala');
  for (const ref of [input.store.streams[0].aggregate, ...input.store.streams[0].eventIdentities.map(m => m.event)]) {
    const d = input.products['reference-layout'].declarations.find(d => JSON.stringify(d.ref) === JSON.stringify(ref));
    assert.ok(domainEntry.codeMappings.some(m => m.knowledgeKey === `source:${d.source.document}#${d.source.pointer}`));
  }
});

test('profile literals and package/table/stream/index names are not business-name branches', () => {
  const input = fixture();
  input.store.id = 'ArchiveStore'; input.store.version = 'archive-v7'; input.store.tablePrefix = 'archive';
  input.options.packages[0].package = 'example.archive';
  input.store.pollIntervalMillis = 11; input.store.closeTimeoutMillis = 987;
  const entries = generate(input), all = entries.map(e => e.content).join('\n');
  assert.match(all, /object ArchiveStoreSchema/);
  assert.match(all, /version: String = "archive-v7"/);
  assert.match(all, /package example.archive.infrastructure.projection/);
  assert.match(all, /CREATE TABLE IF NOT EXISTS archive_work_item/);
  assert.match(all, /Duration.Zero, 11.millis/);
  assert.match(all, /shutdown\(\), 987.millis/);
  assert.doesNotMatch(all, /Bank|bank_|CreditBalance|FundOrder|SipPlan|TrustedAdmission|payment|refund|taStatus/);
});

test('index records cannot shadow repository helpers or query argument values', () => {
  const input = fixture();
  input.store.indexes[0].id = 'item_label';
  const content = file(generate(input), 'Repository.scala').content;
  assert.match(content, /import TicketReadsideRepository\.\{Row, Payload, State, Owner, hash\}/);
  assert.doesNotMatch(content, /import TicketReadsideRepository\._/);
  assert.match(content, /Vector\[TicketReadsideRepository.item_label\]/);
  assert.match(content, /TicketReadsideRepository.item_label\(result.getString/);
});

test('invalid stores fail finitely rather than accepting injected source or unknown profiles', () => {
  for (const mutate of [
    s => { s.schemaVersion = 'truthsrc.journal-readside/v2'; },
    s => { s.tablePrefix = 'unsafe; DROP TABLE stream'; },
    s => { s.pollIntervalMillis = 0; },
    s => { s.closeTimeoutMillis = Infinity; },
    s => { s.sql = 'SELECT 1'; },
    s => { s.streams[0].identity.id = 'absent'; },
    s => { s.streams[0].kind = 'x'.repeat(33); },
    s => { s.indexes[0].id = 'Owner'; },
    s => { s.indexes[0].id = 'hash'; },
    s => { s.indexes[0].id = 'String'; },
    s => {
      s.indexes[0].columns.push(column('after', 'long'));
      s.indexes[0].queries[0].where = ['after'];
    }
  ]) {
    const input = fixture(); mutate(input.store);
    assert.throws(() => generate(input));
  }
});
