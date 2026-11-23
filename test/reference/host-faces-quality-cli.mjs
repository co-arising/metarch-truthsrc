// Host-faces sandbox CLI (round 1: compile gate) for the pipeline-invocation
// and effect families of the emitter-unification program.
//
// Deltas from the composition-invocation-host quality CLI (the machinery
// template): (a) SOURCES are the thirteen golden files of the two host faces
// PLUS the bank-wealth generated application tree as staged supply — the
// goldens reference the knowledge-side domain values, protocols, converters
// and proto faces that only the regenerated project tree carries; (b) the
// gate at this round is the compile itself — scalac -deprecation -feature
// -unchecked must accept the joint compilation under the same finite jar
// closure and the seatbelt profile; the per-family quality-properties harness
// (QualityMain suites) is the next round's artifact and is deliberately not
// claimed here. No network, no resolver: every jar comes from the local
// Coursier cache or the staged 0.3.0 runtime, exactly as the template pins.
//
// Usage:
//   node test/reference/host-faces-quality-cli.mjs prepare [roundDir]
//   node test/reference/host-faces-quality-cli.mjs run [roundDir] attempt-0N
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { captureEvidenceFile, fingerprintEvidenceFile } from '../../lib/verification/files.mjs';
import { runVerifiedProcess, processFailureState } from '../../lib/verification/process.mjs';
import { artifactStem, declaredPom } from './compiler-pom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FACE_PIPELINE = path.join(ROOT, 'test/reference/curated/pipeline-invocation-face/v1');
const FACE_EFFECT = path.join(ROOT, 'test/reference/curated/effect-face/v1');
// The staged 0.3.0 runtime jars live in the composition-invocation-host
// candidate (the family that introduced the monarch face supply; receipt
// provenance bank-wealth-demo/.local/truthsrc-runtime-0.3.0/receipt.json).
const STAGED_SUPPLY_ROOT = path.join(ROOT, 'test/reference/curated/composition-invocation-host/v1');
// The bank-wealth application supply references the scalapb-generated PB
// faces (infrastructure.{proto,executionproto,hostproto,effectproto}); the
// .proto sources are ledger artifacts (generated/current/app/protobuf) but
// the PB Scala is a build-time product this sandbox has no sbt for. The
// offline generation chain: cached protoc 3.21.9 binary + a single-file JDK
// plugin launcher driving scalapb compilerplugin 0.11.14 (the same scalapb
// version the jar closure pins), with scalapb/scalapb.proto extracted from
// the runtime jar at prepare time.
const PROTOC = '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/google/protobuf/protoc/3.21.9/protoc-3.21.9-osx-x86_64.exe';
const SCALAPB_RUNTIME_JAR = '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/thesamet/scalapb/scalapb-runtime_2.13/0.11.14/scalapb-runtime_2.13-0.11.14.jar';
// protoc include directories: the well-known google/protobuf/*.proto staged by
// the common-core build (the same dependency family as the jar closure) plus
// the scalapb include extracted from the runtime jar at prepare time.
const WELL_KNOWN_PROTOS = '/Users/zhongdj/Workspaces/mad-polaris/common-core/target/protobuf_external';
const PROTO_DIR = '/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/generated/current/app/protobuf';
// compilerplugin 0.11.14 carries its CodeGen API from protoc-gen/protoc-bridge
// 0.9.6 (the pom-declared pairing); verified empirically offline.
const PLUGIN_CLASSPATH = [
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/thesamet/scalapb/compilerplugin_2.13/0.11.14/compilerplugin_2.13-0.11.14.jar',
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/thesamet/scalapb/protoc-gen_2.13/0.9.6/protoc-gen_2.13-0.9.6.jar',
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/thesamet/scalapb/protoc-bridge_2.13/0.9.6/protoc-bridge_2.13-0.9.6.jar',
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/com/google/protobuf/protobuf-java/3.15.6/protobuf-java-3.15.6.jar',
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/org/scala-lang/scala-library/2.13.14/scala-library-2.13.14.jar',
  '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2/org/scala-lang/modules/scala-collection-compat_2.13/2.7.0/scala-collection-compat_2.13-2.7.0.jar',
].join(':');
const PLUGIN_ENTRY = `package example.bankwealth.sandbox;
import com.google.protobuf.CodedInputStream;
import java.io.IOException;
public final class GenPlugin {
  public static void main(String[] args) throws IOException {
    byte[] request = System.in.readAllBytes();
    byte[] response = scalapb.ScalaPbCodeGenerator.run(CodedInputStream.newInstance(request));
    System.out.write(response);
    System.out.flush();
  }
}
`;
const SUPPLY_APP = process.env.HOST_FACES_SUPPLY_APP
  ? path.resolve(process.env.HOST_FACES_SUPPLY_APP)
  : '/Users/zhongdj/Workspaces/mad-polaris/bank-wealth-demo/generated/current/app';
const DEFAULT_ROUND = path.join(ROOT, '.rounds/host-faces-quality-20261122-01');
const CACHE = '/Users/zhongdj/Library/Caches/Coursier/v1/https/repo1.maven.org/maven2';
const JAVA_HOME = '/Library/Java/JavaVirtualMachines/adoptopenjdk-11.jdk/Contents/Home';
const JAVA = path.join(JAVA_HOME, 'bin/java');
const SCALA = '2.13.14';
const STAGED_SUPPLIES = [
  { coordinate: 'net.imadz:saga-core_2.13:0.3.0',
    dir: 'supply/net/imadz/saga-core_2.13/0.3.0', jar: 'saga-core_2.13-0.3.0.jar' },
  { coordinate: 'net.imadz:monarch-persistence_2.13:0.3.0',
    dir: 'supply/net/imadz/monarch-persistence_2.13/0.3.0',
    jar: 'monarch-persistence_2.13-0.3.0.jar' },
  { coordinate: 'net.imadz:monarch-core_2.13:0.3.0',
    dir: 'supply/net/imadz/monarch-core_2.13/0.3.0', jar: 'monarch-core_2.13-0.3.0.jar' },
];
const SUPPLY_COORDINATE = 'net.imadz:saga-core_2.13:0.3.0';
const SUPPLY_GAP_EXCLUSIONS = [
  {
    key: 'org.apache.geronimo.specs:geronimo-jta_1.1_spec',
    requested: 'org.apache.geronimo.specs:geronimo-jta_1.1_spec:1.1.1',
    chain: 'net.imadz:common-core_2.13:0.2 → org.scalikejdbc:scalikejdbc_2.13:3.5.0 → org.scalikejdbc:scalikejdbc-core_2.13:3.5.0 → org.apache.commons:commons-dbcp2:2.7.0 → geronimo-jta_1.1_spec:1.1.1',
    reason: 'supply-gap-excluded',
  },
  {
    key: 'org.mockito:mockito-core',
    requested: 'org.mockito:mockito-core:2.18.3 (managed by io.netty:netty-parent:4.1.72)',
    chain: 'io.netty:netty-{buffer,transport,resolver,handler}:4.1.72.Final → io.netty:netty-parent:4.1.72 dependencyManagement pins mockito-core 2.18.3 with scope=test',
    reason: 'managed-test-scope',
  },
];
// Verbatim jar closure of the composition-invocation-host family sandbox
// (the strict runtime + monarch 0.3.0 staged supplies + akka 2.6.20 closure
// + jackson + scalapb + the common-core declared block). The host faces ride
// the same runtime supply; nothing new is admitted.
const COORDINATES = [
  `org.scala-lang:scala-compiler:${SCALA}`, `org.scala-lang:scala-library:${SCALA}`,
  `org.scala-lang:scala-reflect:${SCALA}`, 'io.github.java-diff-utils:java-diff-utils:4.12',
  'org.jline:jline:3.25.1', 'net.java.dev.jna:jna:5.14.0',
  'org.scalacheck:scalacheck_2.13:1.16.0', 'org.scala-sbt:test-interface:1.0',
  'org.scalameta:parsers_2.13:4.7.7', 'org.scalameta:trees_2.13:4.7.7',
  'org.scalameta:common_2.13:4.7.7', 'org.scalameta:fastparse-v2_2.13:2.3.1',
  'com.lihaoyi:sourcecode_2.13:0.3.0', 'com.lihaoyi:geny_2.13:0.6.5',
  'org.scala-lang.modules:scala-collection-compat_2.13:2.7.0',
  SUPPLY_COORDINATE,
  'net.imadz:monarch-persistence_2.13:0.3.0', 'net.imadz:monarch-core_2.13:0.3.0',
  'org.scalatest:scalatest_2.13:3.2.11', 'org.scalactic:scalactic_2.13:3.2.11',
  'org.scalatest:scalatest-core_2.13:3.2.11', 'org.scalatest:scalatest-wordspec_2.13:3.2.11',
  'org.scalatest:scalatest-funsuite_2.13:3.2.11', 'org.scalatest:scalatest-matchers-core_2.13:3.2.11',
  'org.scalatest:scalatest-featurespec_2.13:3.2.11', 'org.scalatest:scalatest-flatspec_2.13:3.2.11',
  'org.scalatest:scalatest-freespec_2.13:3.2.11', 'org.scalatest:scalatest-funspec_2.13:3.2.11',
  'org.scalatest:scalatest-propspec_2.13:3.2.11', 'org.scalatest:scalatest-diagrams_2.13:3.2.11',
  'org.scalatest:scalatest-refspec_2.13:3.2.11', 'org.scalatest:scalatest-shouldmatchers_2.13:3.2.11',
  'org.scalatest:scalatest-mustmatchers_2.13:3.2.11', 'org.scalatest:scalatest-compatible:3.2.11',
  'org.scala-lang.modules:scala-xml_2.13:2.0.1',
  'net.imadz:common-core_2.13:0.2',
  'com.thesamet.scalapb:scalapb-runtime_2.13:0.11.14',
  'com.thesamet.scalapb:lenses_2.13:0.11.14',
  'com.google.protobuf:protobuf-java:3.15.6',
  'com.typesafe.play:play-json_2.13:2.9.3', 'com.typesafe.play:play-functional_2.13:2.9.3',
  'javax.inject:javax.inject:1',
  'com.google.inject:guice:5.1.0',
  'com.google.guava:guava:30.1.1-jre', 'com.google.guava:failureaccess:1.0.1',
  'com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava',
  'com.google.code.findbugs:jsr305:3.0.2', 'com.google.errorprone:error_prone_annotations:2.3.4',
  'com.google.j2objc:j2objc-annotations:1.3', 'org.checkerframework:checker-qual:3.12.0',
  'aopalliance:aopalliance:1.0', 'org.ow2.asm:asm:9.2',
  'com.typesafe.akka:akka-actor_2.13:2.6.20', 'com.typesafe.akka:akka-actor-typed_2.13:2.6.20',
  'com.typesafe.akka:akka-cluster-sharding-typed_2.13:2.6.20',
  'com.typesafe.akka:akka-cluster-typed_2.13:2.6.20',
  'com.typesafe.akka:akka-cluster-sharding_2.13:2.6.20',
  'com.typesafe.akka:akka-cluster_2.13:2.6.20', 'com.typesafe.akka:akka-cluster-tools_2.13:2.6.20',
  'com.typesafe.akka:akka-coordination_2.13:2.6.20',
  'com.typesafe.akka:akka-distributed-data_2.13:2.6.20',
  'com.typesafe.akka:akka-persistence_2.13:2.6.20',
  'com.typesafe.akka:akka-persistence-typed_2.13:2.6.20',
  'com.typesafe.akka:akka-pki_2.13:2.6.20',
  'com.typesafe.akka:akka-protobuf-v3_2.13:2.6.20', 'com.typesafe.akka:akka-remote_2.13:2.6.20',
  'com.typesafe.akka:akka-serialization-jackson_2.13:2.6.20',
  'com.typesafe.akka:akka-slf4j_2.13:2.6.20', 'com.typesafe.akka:akka-stream_2.13:2.6.20',
  'com.typesafe.akka:akka-testkit_2.13:2.6.20',
  'com.typesafe.akka:akka-actor-testkit-typed_2.13:2.6.20',
  'com.typesafe.akka:akka-persistence-testkit_2.13:2.6.20',
  'com.typesafe.akka:akka-persistence-query_2.13:2.6.20',
  'com.typesafe.akka:akka-stream-typed_2.13:2.6.20',
  'com.typesafe:config:1.4.2', 'com.typesafe:ssl-config-core_2.13:0.4.3',
  'com.hierynomus:asn-one:0.5.0',
  'org.slf4j:slf4j-api:1.7.36', 'org.slf4j:jul-to-slf4j:1.7.36',
  'org.slf4j:jcl-over-slf4j:1.7.36',
  'com.fasterxml.jackson.core:jackson-core:2.11.4',
  'com.fasterxml.jackson.core:jackson-annotations:2.11.4',
  'com.fasterxml.jackson.core:jackson-databind:2.11.4',
  'com.fasterxml.jackson.datatype:jackson-datatype-jdk8:2.11.4',
  'com.fasterxml.jackson.datatype:jackson-datatype-jsr310:2.11.4',
  'com.fasterxml.jackson.module:jackson-module-scala_2.13:2.11.4',
  'com.fasterxml.jackson.module:jackson-module-parameter-names:2.11.4',
  'com.fasterxml.jackson.module:jackson-module-paranamer:2.11.4',
  'com.fasterxml.jackson.dataformat:jackson-dataformat-cbor:2.11.4',
  'com.thoughtworks.paranamer:paranamer:2.8',
  'com.github.scullxbones:akka-persistence-mongo-common_2.13:3.0.8',
  'nl.grons:metrics4-akka_a25_2.13:4.1.19', 'nl.grons:metrics4-scala_2.13:4.1.19',
  'io.dropwizard.metrics:metrics-core:4.1.19',
  'io.dropwizard.metrics:metrics-healthchecks:4.1.19',
  'com.github.scullxbones:akka-persistence-mongo-scala_2.13:3.0.8',
  'org.mongodb:bson:4.3.4', 'org.mongodb:mongodb-driver-core:4.3.4',
  'org.mongodb:mongodb-driver-reactivestreams:4.3.4',
  'org.mongodb.scala:mongo-scala-driver_2.13:4.3.4',
  'org.mongodb.scala:mongo-scala-bson_2.13:4.3.4',
  'org.reactivestreams:reactive-streams:1.0.3',
  'io.projectreactor:reactor-core:3.4.6',
  'org.reactivemongo:reactivemongo_2.13:1.1.0-noshaded-RC11',
  'org.reactivemongo:reactivemongo-core_2.13:1.1.0-noshaded-RC11',
  'org.reactivemongo:reactivemongo-bson-api_2.13:1.1.0-noshaded-RC11',
  'org.reactivemongo:reactivemongo-alias_2.13:1.1.0-RC11',
  'com.github.luben:zstd-jni:1.5.5-4', 'org.xerial.snappy:snappy-java:1.1.10.1',
  'dnsjava:dnsjava:3.5.2', 'commons-codec:commons-codec:1.16.0',
  'io.netty:netty-buffer:4.1.72.Final', 'io.netty:netty-common:4.1.72.Final',
  'io.netty:netty-transport:4.1.72.Final', 'io.netty:netty-resolver:4.1.72.Final',
  'io.netty:netty-handler:4.1.72.Final', 'io.netty:netty-codec:4.1.72.Final',
  'io.netty:netty-tcnative-classes:2.0.46.Final',
  'com.lightbend.akka:akka-projection-core_2.13:1.2.5',
  'com.lightbend.akka:akka-projection-jdbc_2.13:1.2.5',
  'org.scalikejdbc:scalikejdbc_2.13:3.5.0', 'org.scalikejdbc:scalikejdbc-core_2.13:3.5.0',
  'org.scalikejdbc:scalikejdbc-interpolation_2.13:3.5.0',
  'org.scalikejdbc:scalikejdbc-interpolation-macro_2.13:3.5.0',
  'org.scalikejdbc:scalikejdbc-config_2.13:3.5.0',
  'org.apache.commons:commons-dbcp2:2.7.0', 'org.apache.commons:commons-pool2:2.10.0',
  'commons-logging:commons-logging:1.2',
  'org.scala-lang.modules:scala-parser-combinators_2.13:1.1.2',
  'org.scala-lang.modules:scala-java8-compat_2.13:1.0.2',
  'org.slf4j:slf4j-simple:1.7.36',
  'org.lmdbjava:lmdbjava:0.7.0', 'org.lz4:lz4-java:1.8.0', 'org.agrona:agrona:1.15.1',
  'com.github.jnr:jnr-ffi:2.1.9', 'com.github.jnr:jffi:1.2.18',
  'com.github.jnr:jnr-constants:0.9.12', 'com.github.jnr:jnr-a64asm:1.0.0',
  'com.github.jnr:jnr-x86asm:1.0.2', 'org.ow2.asm:asm-analysis:5.0.3',
  'org.ow2.asm:asm-commons:5.0.3', 'org.ow2.asm:asm-tree:5.0.3', 'org.ow2.asm:asm-util:5.0.3',
  'com.zaxxer:HikariCP:3.4.5',
];
const PARENTS = [
  'io.github.java-diff-utils:java-diff-utils-parent:4.12',
  'org.jline:jline-parent:3.25.1',
  'com.google.guava:guava-parent:30.1.1-jre',
  'com.google.protobuf:protobuf-parent:3.15.6',
  'com.google.protobuf:protobuf-bom:3.15.6',
  'com.fasterxml.jackson:jackson-base:2.11.4',
  'com.google.inject:guice-parent:5.1.0',
  'org.sonatype.oss:oss-parent:7',
  'au.com.acegi:acegi-standard-project:0.2.3',
];
const monotonic = () => Number(process.hrtime.bigint() / 1000000n);
const document = p => captureEvidenceFile(p, { parse: bytes => JSON.parse(bytes.toString('utf8')) });
const write = (p, value) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
};
const pin = p => ({ file: p, ...fingerprintEvidenceFile(p) });
const treeFiles = dir => fs.readdirSync(dir).flatMap(name => {
  const p = path.join(dir, name), s = fs.lstatSync(p);
  assert(!s.isSymbolicLink(), 'Symlink in declared runtime directory');
  return s.isDirectory() ? treeFiles(p) : s.isFile() && !p.endsWith('/src.zip') ? [p] : [];
});

// Golden sources: every .scala under the two curated faces' app trees, with
// their golden-relative paths; supply sources: every .scala of the staged
// bank-wealth application tree, absolute-pinned (the tree is an external,
// byte-pinned input at prepare time — the run phases refuse any drift).
function goldenSources() {
  const rows = [];
  for (const [face, dir] of [['pipeline-invocation-face', FACE_PIPELINE], ['effect-face', FACE_EFFECT]]) {
    const app = path.join(dir, 'app');
    const visit = (current, relative) => {
      for (const name of fs.readdirSync(current)) {
        const child = path.join(current, name);
        const childRelative = relative ? relative + '/' + name : name;
        if (fs.lstatSync(child).isDirectory()) visit(child, childRelative);
        else if (name.endsWith('.scala')) rows.push({ face, relative: `${face}/${childRelative}`, file: child });
      }
    };
    visit(app, 'app');
  }
  return rows.sort((a, b) => a.relative < b.relative ? -1 : 1);
}

// Supply-gap exclusion (the geronimo-jta discipline): the Play service-loader
// face of the generated tree rides the Play framework closure, which is
// outside this sandbox's finite jar supply. The host faces reference nothing
// Play; the four excluded files are the service bootstrap/loader surfaces and
// stay owned by the bank-wealth service build until their own family gate.
const SUPPLY_FILE_EXCLUSIONS = [
  'example/bankwealth/infrastructure/bootstrap/ApplicationBootstrap.scala',
  'example/bankwealth/service/BankServiceConfiguration.scala',
  'example/bankwealth/service/BankServiceLoader.scala',
  'example/bankwealth/service/BankServiceService.scala',
];

function supplySources() {
  assert(fs.existsSync(SUPPLY_APP), 'staged bank-wealth application tree missing: ' + SUPPLY_APP);
  return treeFiles(SUPPLY_APP).filter(p => p.endsWith('.scala')).sort().map(file => ({ supply: true, file }))
    .filter(row => !SUPPLY_FILE_EXCLUSIONS.some(excluded => row.file.endsWith(excluded)));
}

function supply() {
  const seen = new Set();
  const coordinates = COORDINATES.filter(coordinate => {
    const key = coordinate.split(':').slice(0, 2).join(':');
    assert(!seen.has(key), 'Duplicate coordinate: ' + coordinate);
    seen.add(key);
    return true;
  });
  const artifacts = coordinates.map(coordinate => {
    const staged = STAGED_SUPPLIES.find(row => row.coordinate === coordinate);
    const stem = staged
      ? path.join(STAGED_SUPPLY_ROOT, staged.dir, staged.jar.replace(/\.jar$/, ''))
      : artifactStem(CACHE, coordinate);
    const jar = `${stem}.jar`;
    let pom;
    try {
      const original = captureEvidenceFile(stem + '.pom').value.toString();
      pom = declaredPom(original
        .replace(/<name>[\s\S]*?<\/name>/g, '')
        .replace(/<licenses>[\s\S]*?<\/licenses>/g, '')
        .replace(/<properties>[\s\S]*?<\/properties>/g, ''));
    }
    catch (error) { throw new Error(`${coordinate}: ${error.message}`); }
    assert.equal(pom.coordinate, coordinate);
    return { coordinate, jar, pom: stem + '.pom', declared: pom };
  });
  const selected = new Map(artifacts.map(row => [row.coordinate.split(':').slice(0, 2).join(':'), row.coordinate]));
  const edges = [], omitted = [];
  for (const artifact of artifacts) for (const dependency of artifact.declared.dependencies) {
    const requested = [dependency.group, dependency.artifact, dependency.version ?? 'managed-by-parent'].join(':');
    const key = `${dependency.group}:${dependency.artifact}`;
    if (dependency.scope === 'test' || dependency.optional || dependency.scope === 'provided') {
      omitted.push({ from: artifact.coordinate, requested, reason: dependency.scope });
    } else {
      const excluded = SUPPLY_GAP_EXCLUSIONS.find(row => row.key === key);
      if (excluded) {
        omitted.push({ from: artifact.coordinate, requested, reason: excluded.reason, chain: excluded.chain });
      } else {
        const coordinate = selected.get(key);
        assert(coordinate, 'Missing finite dependency: ' + requested);
        edges.push({ from: artifact.coordinate, requested, selected: coordinate });
      }
    }
  }
  const release = captureEvidenceFile(path.join(JAVA_HOME, 'release')).value.toString();
  assert(/^JAVA_VERSION="11\./m.test(release));
  const jdk = [...treeFiles(path.join(JAVA_HOME, 'lib')), ...treeFiles(path.join(JAVA_HOME, 'conf'))];
  const parentFiles = PARENTS.map(coordinate => artifactStem(CACHE, coordinate) + '.pom');
  const paths = [JAVA, path.join(JAVA_HOME, 'release'), ...jdk,
    ...artifacts.flatMap(row => [row.jar, row.pom]), ...parentFiles];
  const pins = [...new Set(paths)].map(pin);
  return { artifacts, edges, omitted, pins, jdk };
}

function unchanged(pins) {
  for (const row of pins) {
    const actual = fingerprintEvidenceFile(row.file, { limit: row.bytes });
    assert.equal(actual.bytes, row.bytes, 'Evidence length changed');
    assert.equal(actual.sha256, row.sha256, 'Evidence bytes changed: ' + row.file);
  }
}

function profile(reads, writes, execSubPaths) {
  const ancestors = new Set(['/']);
  for (const p of reads) for (let d = path.dirname(p); d !== '/'; d = path.dirname(d)) ancestors.add(d);
  return `(version 1)
(allow default)
(deny network*)
(deny file-read*)
(allow file-read* ${[...ancestors].map(p => `(literal ${JSON.stringify(p)})`).join(' ')}
 ${reads.map(p => `(literal ${JSON.stringify(p)})`).join(' ')}
 (subpath "/System/Library") (subpath "/usr/lib") (subpath "/private/var/db/dyld")
 (literal "/dev/null") (literal "/dev/random") (literal "/dev/urandom")
 (literal "/etc/hosts") (literal "/etc/resolv.conf") (literal "/private/var/select/sh"))
(allow file-read* ${writes.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})
(deny file-write*)
(allow file-write* ${writes.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')} (literal "/dev/null"))
(deny process-exec)
(allow process-exec (literal ${JSON.stringify(JAVA)}) (literal ${JSON.stringify(PROTOC)}) (literal "/bin/sh") (literal "/bin/bash") ${execSubPaths.map(p => `(subpath ${JSON.stringify(p)})`).join(' ')})
`;
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') {
    const round = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_ROUND;
    const resources = supply();
    // PB toolchain pins: protoc binary, plugin classpath jars, the extracted
    // scalapb include and the well-known include; plus the nine ledger .proto
    // sources the PB faces generate from.
    const includeDir = path.join(round, 'include');
    fs.mkdirSync(path.join(includeDir, 'scalapb'), { recursive: true });
    const { execFileSync } = await import('node:child_process');
    execFileSync('/usr/bin/unzip', ['-p', SCALAPB_RUNTIME_JAR, 'scalapb/scalapb.proto'],
      { stdio: ['ignore', fs.openSync(path.join(includeDir, 'scalapb/scalapb.proto'), 'w'), 'inherit'] });
    const protoSources = fs.readdirSync(PROTO_DIR).filter(name => name.endsWith('.proto')).sort()
      .map(name => ({ relative: `protobuf/${name}`, file: path.join(PROTO_DIR, name) }));
    const pbToolchain = [PROTOC, SCALAPB_RUNTIME_JAR, ...PLUGIN_CLASSPATH.split(':'), path.join(WELL_KNOWN_PROTOS, 'google/protobuf/descriptor.proto')]
      .map(file => ({ pbToolchain: true, file, ...pin(file) }));
    const sources = [...goldenSources(), ...supplySources(), ...protoSources].map(row => ({ ...row, ...pin(row.file) }));
    const metadata = [path.join(FACE_PIPELINE, 'technical-input.json'), path.join(FACE_EFFECT, 'technical-input.json'),
      path.join(includeDir, 'scalapb/scalapb.proto')].map(pin);
    const controls = ['lib/verification/process.mjs', 'lib/verification/files.mjs', 'lib/immutable-data.mjs',
      'lib/strict-json.mjs', 'lib/verification/callbacks.mjs',
      'test/reference/compiler-pom.mjs', 'test/reference/compiler-tools.mjs'].map(relative => pin(path.join(ROOT, relative)));
    controls.push(pin(fileURLToPath(import.meta.url)));
    const prepared = { resources, sources, metadata, controls, pbToolchain,
      statement: 'Prepared finite source/supply only, no JVM execution, no compile verdict' };
    write(path.join(round, 'prepared.json'), prepared);
    console.log(JSON.stringify({ prepared: pin(path.join(round, 'prepared.json')),
      goldenSources: sources.filter(row => row.face).length, supplySources: sources.filter(row => row.supply).length,
      artifacts: resources.artifacts.length }));
    return;
  }
  assert.equal(mode, 'run');
  const round = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_ROUND;
  const prepared = document(path.join(round, 'prepared.json')).value;
  const attemptId = process.argv[4];
  assert(/^attempt-0[1-3]$/.test(attemptId), 'Fixed attempt ID required');
  const budgetFile = path.join(round, 'budget.json');
  if (!fs.existsSync(budgetFile)) {
    assert.equal(attemptId, 'attempt-01');
    // 30-minute wall: a 200+ file joint scalac round with cold JVM caches.
    write(budgetFile, { started: Date.now(), monotonicStarted: monotonic(), wallMs: 1800000, extended: true });
  }
  const budget = document(budgetFile).value;
  const attempt = path.join(round, attemptId);
  fs.mkdirSync(attempt);
  const home = path.join(attempt, 'home'), tmp = path.join(attempt, 'tmp');
  const outClasses = path.join(attempt, 'classes'), pbOut = path.join(attempt, 'pb-out');
  for (const dir of [home, tmp, outClasses, pbOut, path.join(attempt, 'logs'), path.join(attempt, 'results')]) fs.mkdirSync(dir);
  // The single-file JDK plugin launcher and its protoc wrapper script live in
  // the attempt and are pinned before the sandbox profile is built.
  const pluginJava = path.join(tmp, 'GenPlugin.java'), pluginWrapper = path.join(tmp, 'protoc-gen-scala');
  write(pluginJava, PLUGIN_ENTRY);
  write(pluginWrapper, `#!/bin/sh\nexec ${JAVA} -cp '${PLUGIN_CLASSPATH}:${tmp}' ${pluginJava}\n`);
  fs.chmodSync(pluginWrapper, 0o755);
  // The attempt-local source listing follows the template: pinning it grants
  // the sandbox read access to the attempt directory itself (the JVM's CWD
  // probe needs it) and keeps the fixed-pin discipline over the source set.
  const listing = path.join(attempt, 'sources.tsv');
  write(listing, prepared.sources.map(row => `${row.face ? row.face : (row.pbToolchain ? 'pb-toolchain' : 'supply')}\t${row.file}`).join('\n') + '\n');
  const fixedPins = [...prepared.resources.pins, ...(prepared.pbToolchain ?? []), ...prepared.sources,
    ...prepared.metadata, ...prepared.controls, pin(listing), pin(pluginJava), pin(pluginWrapper)];
  const attemptPins = [pin(listing), pin(pluginJava), pin(pluginWrapper)];
  const sandboxFile = path.join(attempt, 'sandbox.sb');
  write(sandboxFile, profile([...fixedPins.map(row => row.file)], [home, tmp, outClasses, pbOut, path.join(attempt, 'results')], [tmp]));
  const jvmArgs = ['-Xmx2048m', '-XX:ActiveProcessorCount=2', '-XX:-UsePerfData', '-Dfile.encoding=UTF-8',
    '-Dscala.usejavacp=false', `-Duser.home=${home}`, `-Djava.io.tmpdir=${tmp}`,
    `-XX:ErrorFile=${tmp}/hs_err_pid%p.log`, `-XX:HeapDumpPath=${tmp}`];
  const artifacts = prepared.resources.artifacts;
  const compilerCp = artifacts.filter(row => row.coordinate.startsWith('org.scala-lang:')).map(row => row.jar).join(':');
  const familyCp = artifacts.map(row => row.jar);
  const localStart = performance.now();
  const initialRemaining = Math.min(budget.wallMs - (Date.now() - budget.started),
    budget.wallMs - (monotonic() - budget.monotonicStarted));
  const remaining = () => Math.min(budget.wallMs - (Date.now() - budget.started),
    budget.wallMs - (monotonic() - budget.monotonicStarted),
    initialRemaining - (performance.now() - localStart));
  const records = [];
  const launch = async (label, args, cap, executable = JAVA) => {
    assert(remaining() >= cap + 120000 + 20000, 'New quality budget cannot fit next phase');
    unchanged(fixedPins);
    assert(remaining() >= cap + 120000 + 20000, 'Quality admission exhausted phase budget');
    const jvmStyle = executable === JAVA;
    const receipt = await runVerifiedProcess({ executable, args: jvmStyle ? [...jvmArgs, ...args] : args, cwd: attempt,
      env: { HOME: home, TMPDIR: tmp, JAVA_HOME, PATH: '/usr/bin:/bin', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
      base: path.join(attempt, 'logs', label), timeoutMs: cap,
      sandbox: { executable: '/usr/bin/sandbox-exec', profile: sandboxFile, profileSha256: pin(sandboxFile).sha256 } });
    records.push({ label, receipt });
    unchanged(fixedPins);
    assert(remaining() > 0, 'New quality wall budget expired');
    assert(receipt.passed, `${label} failed: ${receipt.paths.stderr}`);
    console.log(`${label}: exit=${receipt.code}`);
  };
  try {
    // PB faces first: the cached protoc drives the scalapb compilerplugin over
    // the nine ledger .proto sources; the generated Scala joins the compile as
    // attempt-produced sources and is pinned into the attempt pin set.
    await launch('pb-generate', [`-I${WELL_KNOWN_PROTOS}`,
      `-I${path.join(path.dirname(prepared.metadata[2].file), '..')}`,
      `-I${PROTO_DIR}`, `--plugin=protoc-gen-scala=${pluginWrapper}`,
      `--scala_out=${pbOut}`, ...prepared.sources.filter(row => row.relative?.startsWith('protobuf/')).map(row => row.file)], 120000, PROTOC);
    const pbSources = treeFiles(pbOut).filter(p => p.endsWith('.scala'));
    assert(pbSources.length > 0, 'PB generation produced no Scala sources');
    const pbListing = path.join(attempt, 'results', 'pb-sources.tsv');
    write(pbListing, pbSources.map(file => `pb-generated\t${file}`).join('\n') + '\n');
    for (const file of [pbListing, ...pbSources]) attemptPins.push(pin(file));
    const scalaSources = [...prepared.sources.filter(row => row.face || row.supply).map(row => row.file), ...pbSources];
    await launch('compile-joint', ['-cp', compilerCp, 'scala.tools.nsc.Main', '-encoding', 'UTF-8',
      '-deprecation', '-feature', '-unchecked', '-classpath', familyCp.join(':'), '-d', outClasses,
      ...scalaSources], 1500000);
    const completion = { status: 'COMPILE_GATE_COMPLETE', records,
      goldenSources: prepared.sources.filter(row => row.face).length,
      supplySources: prepared.sources.filter(row => row.supply).length,
      pbSources: pbSources.length,
      rawAcceptanceChanged: false, all31Closed: false };
    write(path.join(attempt, 'completion.json'), completion);
  } catch (error) {
    write(path.join(attempt, 'failure.json'), { status: 'BLOCKED', message: error.message, records,
      processFailureState: processFailureState(error), rawAcceptanceChanged: false, all31Closed: false });
    throw error;
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 2; });
