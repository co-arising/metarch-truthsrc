import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { files, hash, privateOutput, snapshot, jvmCompilerSession, manifestClassPath, within } from '../compiler-tools.mjs';
import { admitGeneration, stageFile } from './inputs.mjs';
import { httpCases, lifecycleCases, failureCases, journalCases, assertCases } from './cases.mjs';
import { classShadow } from '../module-seams-mixed/verify.mjs';
import { acquireFileLease } from '../../../lib/verification/lease.mjs';
import { runVerifiedProcess } from '../../../lib/verification/process.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
export async function verifyReference(supplyFile, output, generatedReceipt, toolRoot) {
  assert(!process.env.NODE_TEST_CONTEXT, 'default test discovery must not execute JVM');
  assert(path.isAbsolute(supplyFile) && path.isAbsolute(output));
  const supply = JSON.parse(fs.readFileSync(supplyFile)); assert(supply.passed);
  const supplyPins = [...supply.files, ...supply.jdk];
  for (const row of supplyPins) assert.equal(hash(row.file), row.sha256, 'supply drift: ' + row.file);
  const admitted = generatedReceipt ? await admitGeneration(generatedReceipt, toolRoot) : null;
  const generated = admitted?.receipt;
  const original = path.join(root, 'test/reference/aggregate-core/project');
  const persistence = path.join(root, 'test/reference/persistence-readside');
  const inputFiles = [...files(here), supplyFile, path.join(root, 'test/reference/compiler-tools.mjs'),
    ...files(path.join(root, 'lib/verification')), ...(generated ? admitted.files : [
      ...files(path.join(original, 'modules')), ...files(path.join(persistence, 'scala')),
      ...files(path.join(persistence, 'protobuf')), ...files(path.join(persistence, 'resources'))])];
  const pins = snapshot([...new Set(inputFiles)]);
  const io = privateOutput(output, [root, supply.out, ...(generated ? [generated.generated, path.dirname(generated.project), toolRoot] : [])]);
  const stage = (destination, file) => stageFile(io, destination, file, pins);
  const oracleReplacements = admitted?.oracleReplacements ?? [];
  for (const [before, after] of oracleReplacements) assert(typeof before === 'string' && before.length && typeof after === 'string' && after.length);
  const adaptOracle = text => {
    const lines = text.split('\n');
    return lines.map(line => line.startsWith('package ') || line.includes('oracle.driver') ? line :
      oracleReplacements.reduce((value, [before, after]) => value.replaceAll(before, after), line)).join('\n');
  };
  const stageOracle = (destination, file) => {
    if (!oracleReplacements.length) return stage(destination, file);
    assert.equal(hash(file), pins.find(p => p.path === file)?.sha256);
    return io.write(destination, adaptOracle(fs.readFileSync(file, 'utf8')));
  };
  if (generated) {
    for (const source of files(generated.generated)) stage(path.relative(generated.generated, source), source);
    for (const source of files(path.join(here, 'oracle'))) stageOracle('src/test/scala/oracle/' + path.basename(source), source);
    stageOracle('src/test/scala/oracle/GeneratedDriver.scala', path.join(here, 'drivers/GeneratedDriver.scala'));
  } else {
    for (const module of ['kernel', 'glue']) for (const source of files(path.join(original, 'modules', module, 'src/main')))
      stage(path.relative(original, source), source);
    for (const source of files(path.join(persistence, 'scala')))
      stage('modules/glue/src/main/scala/' + path.relative(path.join(persistence, 'scala'), source), source);
    stage('modules/glue/src/main/protobuf/warehouse_persistence_frame.proto', path.join(persistence, 'protobuf/warehouse_persistence_frame.proto'));
    stage('modules/glue/src/main/resources/reference.conf', path.join(persistence, 'resources/reference.conf'));
    for (const [module, destination] of [['kernel', 'modules/kernel/src/main/scala'], ['glue', 'modules/glue/src/main/scala'],
      ['ext', 'modules/ext/src/main/scala'], ['root', 'src/main/scala'], ['oracle', 'src/test/scala'], ['views', 'app/views'], ['conf', 'conf']])
      for (const source of files(path.join(here, module))) stage(destination + '/' + path.relative(path.join(here, module), source), source);
    stage('src/test/scala/ReferenceDriver.scala', path.join(here, 'drivers/ReferenceDriver.scala'));
    stage('build.sbt', path.join(here, 'build.sbt'));
    io.write('project/build.properties', 'sbt.version=1.4.9\n');
    io.write('project/plugins.sbt', 'addSbtPlugin("com.typesafe.play" % "sbt-plugin" % "2.8.18")\naddSbtPlugin("com.thesamet" % "sbt-protoc" % "1.0.6")\nlibraryDependencies += "com.thesamet.scalapb" %% "compilerplugin" % "0.11.14"\n');
  }
  const stagedPins = snapshot(files(io.out));
  const home = io.directory('home'), tmp = io.directory('tmp');
  for (const name of ['global', 'ivy', 'coursier', 'logs', 'data']) io.directory(name);
  for (const source of files(supply.boot)) io.write('boot/' + path.relative(supply.boot, source), fs.readFileSync(source));
  const policy = `(version 1)\n(allow default)\n(deny network*)\n`;
  const writes = `(deny file-write* (require-not (subpath ${JSON.stringify(io.out)})))\n` +
    `(deny file-write* (subpath ${JSON.stringify(io.out + '/logs')}) (literal ${JSON.stringify(io.out + '/build-sandbox.sb')}) (literal ${JSON.stringify(io.out + '/http-sandbox.sb')}))\n` +
    `(deny file-write* ${stagedPins.map(p => '(literal ' + JSON.stringify(p.path) + ')').join(' ')})\n` +
    '(allow file-write* (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom"))\n';
  const buildProfile = io.write('build-sandbox.sb', policy + writes);
  const httpProfile = io.write('http-sandbox.sb', policy +
    '(allow network-inbound (local tcp4 "localhost:*"))\n(allow network-outbound (remote tcp4 "localhost:*"))\n(allow network-bind (local tcp4 "localhost:*"))\n' + writes);
  io.json('inputs.json', pins);
  io.json('staged-inputs.json', stagedPins);
  const record = { owner: 'PLAY-APPLICATION-REFERENCE', runId: path.basename(io.out), pid: process.pid, out: io.out, token: randomUUID() };
  const registry = path.join(root, '.rounds/shared-jvm-leases'); assert(!fs.existsSync(path.join(registry, 'jvm-slot')));
  const lease = await acquireFileLease({ registry, lockNames: ['jvm-slot'], record });
  io.json('lease-acquired.json', record);
  const installed = generated?.installed ? toolRoot : null;
  if (installed) assert(!within(installed, root) && !within(root, installed) && generated.installed === installed);
  const result = { out: io.out, passed: false, lane: installed ? 'installed' : generated ? 'generated' : 'reference',
    toolRoot: generated ? toolRoot : null, variant: generated?.variant ?? 'main', oracleReplacements,
    phases: [], leaseReleased: false };
  try {
    const common = ['-Xmx512m', '-XX:ActiveProcessorCount=2', '-XX:-UsePerfData', '-Dfile.encoding=UTF-8', '-Djava.net.preferIPv4Stack=true',
      '-Duser.home=' + home, '-Djava.io.tmpdir=' + tmp, '-XX:ErrorFile=' + tmp + '/hs_err_pid%p.log'];
    const env = { HOME: home, USERPROFILE: home, TMPDIR: tmp, JAVA_HOME: supply.javaHome, PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8',
      COURSIER_CACHE: io.out + '/coursier', COURSIER_REPOSITORIES: 'file://' + supply.repository,
      XDG_CACHE_HOME: home, XDG_CONFIG_HOME: home, XDG_DATA_HOME: home };
    const javaArgs = [...common, '-Dsbt.boot.directory=' + io.out + '/boot', '-Dsbt.global.base=' + io.out + '/global',
      '-Dsbt.ivy.home=' + io.out + '/ivy', '-Dcoursier.cache=' + io.out + '/coursier', '-Dsbt.repository.config=' + supply.repositories,
      '-Dsbt.boot.properties=' + supply.bootProperties, '-Dsbt.override.build.repos=true', '-Dsbt.server.autostart=false',
      '-Dsbt.server.forcestart=true', '-Dsbt.supershell=false', '-Dsbt.log.noformat=true', '-Dsbt.ci=true',
      '-jar', supply.launcher, 'compile', 'Test / compile'];
    result.build = await runVerifiedProcess({ executable: supply.java, args: javaArgs, cwd: io.out, env,
      base: io.out + '/logs/sbt', timeoutMs: 600000,
      sandbox: { executable: '/usr/bin/sandbox-exec', profile: buildProfile, profileSha256: hash(buildProfile) } });
    assert(result.build.passed, 'reference sbt build failed');
    const update = JSON.parse(fs.readFileSync(io.out + '/target/scala-2.13/update/update_cache_2.13/output'));
    const buildText = fs.readFileSync(io.out + '/build.sbt', 'utf8');
    const organization = buildText.match(/ThisBuild \/ organization := "([^"]+)"/)?.[1];
    const version = buildText.match(/ThisBuild \/ version := "([^"]+)"/)?.[1];
    assert(organization && version);
    const projects = ['kernel', 'glue', 'ext'].map(m => organization + ':' + m + '_2.13:' + version);
    const resolved = configuration => modulesFor(update, configuration, supply, projects);
    result.resolved = { runtime: resolved('runtime'), test: resolved('test') };
    const runtimeJars = result.resolved.runtime.flatMap(m => m.jars.map(j => j.file));
    const jars = [...new Set(result.resolved.test.flatMap(m => m.jars.map(j => j.file)))];
    const classes = Object.fromEntries(['kernel', 'glue', 'ext'].map(m => [m, io.out + '/modules/' + m + '/target/scala-2.13/classes']));
    classes.root = io.out + '/target/scala-2.13/classes'; classes.tests = io.out + '/target/scala-2.13/test-classes';
    classShadow(classes);
    const runtime = [...Object.values(classes), ...jars];
    result.runtime = runtime;
    const applicationClass = generated ? admitted.model.names.application.fqn : 'example.inventory.composition.WarehouseApplication';
    const runtimeOrigins = [
      ['play.api.Application', 'com.typesafe.play:play_2.13:2.8.18'],
      ['akka.actor.typed.ActorSystem', 'com.typesafe.akka:akka-actor-typed_2.13:2.6.20'],
      ['akka.persistence.query.journal.leveldb.scaladsl.LeveldbReadJournal', 'com.typesafe.akka:akka-persistence-query_2.13:2.6.20'],
      ['org.h2.jdbcx.JdbcConnectionPool', 'com.h2database:h2:2.2.224'],
      ['scala.Option', 'org.scala-lang:scala-library:2.13.14'],
      ['scalapb.GeneratedMessage', 'com.thesamet.scalapb:scalapb-runtime_2.13:0.11.14'],
      ['org.iq80.leveldb.impl.Iq80DBFactory', 'org.iq80.leveldb:leveldb:0.12'],
    ].map(([className, coordinate]) => {
      const selected = result.resolved.runtime.find(m => m.coordinate === coordinate);
      assert(selected?.jars.length === 1, 'one runtime JAR for loaded class');
      return { className, ...selected.jars[0] };
    });
    runtimeOrigins.push({ className: applicationClass, file: classes.root });
    const originsFile = io.json('runtime-origins.json', runtimeOrigins);
    const origins = await runVerifiedProcess({ executable: supply.java,
      args: [...common, '-cp', runtime.join(':'), 'example.inventory.playreference.oracle.CodeSourceOracle', originsFile],
      cwd: io.out, env, base: io.out + '/logs/codesource', timeoutMs: 120000,
      sandbox: { executable: '/usr/bin/sandbox-exec', profile: buildProfile, profileSha256: hash(buildProfile) } });
    result.phases.push({ phase: 'codesource', process: origins });
    assert(origins.passed, 'runtime loaded source oracle failed');
    assertCases(fs.readFileSync(origins.paths.stdout, 'utf8'), runtimeOrigins.map(r => 'codesource:' + r.className), 'PLAY_CODESOURCE_ORACLE_PASSED');
    result.runtimeOrigins = runtimeOrigins;
    const compiledPins = snapshot(Object.values(classes).flatMap(files));
    const direct = privateOutput(io.out + '/direct', [root, supply.out]);
    const compiler = ['scala-compiler', 'scala-library', 'scala-reflect'].map(name =>
      supply.repository + '/org/scala-lang/' + name + '/2.13.14/' + name + '-2.13.14.jar');
    const session = jvmCompilerSession(direct, { java: supply.java, javaHome: supply.javaHome, sandbox: '/usr/bin/sandbox-exec', compiler });
    const dirs = Object.fromEntries(['kernel', 'glue', 'ext', 'root', 'tests'].map(m => [m, direct.directory('classes/' + m)]));
    const scala = dir => files(dir).filter(f => f.endsWith('.scala'));
    const library = compiler[1];
    const managed = { protobuf: scala(io.out + '/modules/glue/target/scala-2.13/src_managed'),
      routes: files(io.out + '/target/scala-2.13/routes').filter(f => /\.(scala|java)$/.test(f)),
      twirl: scala(io.out + '/target/scala-2.13/twirl') };
    assert(managed.protobuf.length && managed.routes.length && managed.twirl.length, 'real compiler managed outputs required');
    result.managed = snapshot([...managed.protobuf, ...managed.routes, ...managed.twirl]);
    await session.compile('kernel', scala(io.out + '/modules/kernel/src/main/scala'), [library], dirs.kernel);
    await session.compile('glue', [...scala(io.out + '/modules/glue/src/main/scala'), ...managed.protobuf], [dirs.kernel, ...runtimeJars], dirs.glue);
    const external = generated ? admitted.captured.implementations.members.map(m => m.absoluteFile) : scala(io.out + '/modules/ext/src/main/scala');
    await session.compile('ext', external, [dirs.kernel, dirs.glue, ...runtimeJars], dirs.ext);
    await session.compile('root', [...scala(io.out + '/src/main/scala'), ...managed.routes, ...managed.twirl],
      [dirs.kernel, dirs.glue, dirs.ext, ...runtimeJars], dirs.root);
    await session.compile('oracle', scala(io.out + '/src/test/scala'), [dirs.kernel, dirs.glue, dirs.ext, dirs.root, ...jars], dirs.tests);
    classShadow(dirs);
    result.direct = { runs: session.runs, classes: snapshot(Object.values(dirs).flatMap(files)) };
    const lifecycle = await runVerifiedProcess({ executable: supply.java,
      args: [...common, '-cp', [...Object.values(dirs), ...jars].join(':'), 'example.inventory.playreference.oracle.LifecycleOracle'],
      cwd: io.out, env, base: io.out + '/logs/lifecycle', timeoutMs: 120000,
      sandbox: { executable: '/usr/bin/sandbox-exec', profile: buildProfile, profileSha256: hash(buildProfile) } });
    result.phases.push({ phase: 'lifecycle', process: lifecycle });
    assert(lifecycle.passed, 'lifecycle oracle failed');
    assertCases(fs.readFileSync(lifecycle.paths.stdout, 'utf8'), lifecycleCases, 'PLAY_LIFECYCLE_ORACLE_PASSED');
    for (const phase of ['write', 'reopen', 'fresh']) {
      const process = await runVerifiedProcess({ executable: supply.java,
        args: [...common, '-Doracle.driver=example.inventory.playreference.oracle.' + (generated ? 'GeneratedDriver' : 'ReferenceDriver'),
          '-cp', runtime.join(':'), 'example.inventory.playreference.oracle.HttpOracle', phase, io.out + '/data'],
        cwd: io.out, env, base: io.out + '/logs/' + phase, timeoutMs: 120000,
        sandbox: { executable: '/usr/bin/sandbox-exec', profile: httpProfile, profileSha256: hash(httpProfile) } });
      result.phases.push({ phase, process });
      assert(process.passed, 'reference ' + phase + ' failed');
      assertCases(fs.readFileSync(process.paths.stdout, 'utf8'), httpCases[phase], 'PLAY_APPLICATION_ORACLE_PASSED phase=' + phase);
    }
    for (const [mode, cases] of Object.entries(failureCases)) {
      const data = io.directory('fault-data/' + mode);
      const process = await runVerifiedProcess({ executable: supply.java,
        args: [...common, '-Doracle.driver=example.inventory.playreference.oracle.' + (generated ? 'GeneratedDriver' : 'ReferenceDriver'),
          '-cp', runtime.join(':'), 'example.inventory.playreference.oracle.FailureOracle', mode, data],
        cwd: io.out, env, base: io.out + '/logs/fault-' + mode, timeoutMs: 120000,
        sandbox: { executable: '/usr/bin/sandbox-exec', profile: httpProfile, profileSha256: hash(httpProfile) } });
      result.phases.push({ phase: 'fault-' + mode, process });
      assert(process.passed, 'failure oracle ' + mode + ' failed');
      assertCases(fs.readFileSync(process.paths.stdout, 'utf8'), cases, 'PLAY_FAILURE_ORACLE_PASSED mode=' + mode);
    }
    for (const [mode, cases] of Object.entries(journalCases)) {
      const data = io.directory('journal-data/' + mode);
      const process = await runVerifiedProcess({ executable: supply.java,
        args: [...common, '-cp', runtime.join(':'), 'example.inventory.playreference.oracle.JournalOracle', mode, data],
        cwd: io.out, env, base: io.out + '/logs/journal-' + mode, timeoutMs: 120000,
        sandbox: { executable: '/usr/bin/sandbox-exec', profile: buildProfile, profileSha256: hash(buildProfile) } });
      result.phases.push({ phase: 'journal-' + mode, process });
      assert(process.passed, 'journal oracle ' + mode + ' failed');
      assertCases(fs.readFileSync(process.paths.stdout, 'utf8'), cases, 'PLAY_JOURNAL_ORACLE_PASSED mode=' + mode);
    }
    assert.deepEqual(snapshot(pins.map(p => p.path)), pins, 'harness/source inputs changed during execution');
    assert.deepEqual(snapshot(stagedPins.map(p => p.path)), stagedPins, 'staged source inputs changed');
    assert.deepEqual(snapshot(compiledPins.map(p => p.path)), compiledPins, 'compiled outputs changed during execution');
    assert.deepEqual(snapshot(result.direct.classes.map(p => p.path)), result.direct.classes, 'direct outputs changed');
    for (const row of supplyPins) assert.equal(hash(row.file), row.sha256, 'supply changed during execution');
    admitted?.close();
    result.classes = compiledPins;
    result.passed = true;
  } catch (error) { result.error = error.message; result.stack = error.stack; }
  finally { lease.assertHeld(); lease.release(); result.leaseReleased = true; io.json('result.json', result); }
  return result;
}
function modulesFor(update, configuration, supply, projects) {
  const modules = update.configurations.find(c => c.configuration.name === configuration)?.modules.filter(m => !m.evicted);
  assert(modules?.length, 'actual sbt configuration missing');
  const pins = new Map(supply.files.map(p => [p.file, p.sha256]));
  return modules.map(m => {
    const { organization, name, revision } = m.module;
    const coordinate = organization + ':' + name + ':' + revision;
    if (projects.includes(coordinate)) {
      assert.equal(m.artifacts.length, 0, 'local project cannot supply external artifacts');
      return { coordinate, localProject: true, jars: [] };
    }
    assert(!organization.startsWith('net.imadz'), 'unrequested runtime artifact');
    if (organization === 'org.scala-lang') assert.equal(revision, '2.13.14');
    if (organization === 'com.typesafe.play' && !/^(?:play-json|play-functional|twirl-)/.test(name)) assert.equal(revision, '2.8.18');
    if (organization === 'com.typesafe.akka' && !/^akka-(?:http|parsing)/.test(name)) assert.equal(revision, '2.6.20');
    const pom = path.join(supply.repository, organization.replaceAll('.', '/'), name, revision, name + '-' + revision + '.pom');
    assert(pins.has(pom), 'unfixed POM: ' + coordinate);
    assert.equal(hash(pom), pins.get(pom));
    const jars = m.artifacts.map(a => fileURLToPath(a[1])).filter(p => p.endsWith('.jar')).map(file => {
      assert(within(file, supply.repository) && pins.has(file), 'unfixed actual classpath JAR: ' + file);
      assert.equal(hash(file), pins.get(file));
      for (const token of manifestClassPath(file)) {
        assert(/^[A-Za-z0-9_.-]+\.jar$/.test(token));
        const dep = path.join(path.dirname(file), token);
        assert(!fs.existsSync(dep), 'implicit manifest classpath requires explicit admission: ' + dep);
      }
      return { file, sha256: pins.get(file) };
    });
    return { coordinate, pom: { file: pom, sha256: pins.get(pom) }, jars };
  });
}
if (!process.env.NODE_TEST_CONTEXT && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyReference(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
  console.log(JSON.stringify({ out: result.out, passed: result.passed, error: result.error, leaseReleased: result.leaseReleased }));
  if (!result.passed) process.exitCode = 1;
}
