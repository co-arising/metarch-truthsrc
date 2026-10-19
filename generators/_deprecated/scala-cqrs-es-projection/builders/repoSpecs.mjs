// repoSpecs.mjs — the projection repository behavior-spec face (V4-20), ported verbatim from
// the production gen_repository_specs.mjs (EP_Generated_Patch_Pipeline §九·一): per ③-layer
// gated DecisionView (minus mongo document views — H2 MODE=MySQL can't carry them; minus
// List<VO> views whose Impl is a MANUAL stub) one H2-backed AnyWordSpec exercising the
// roundtrip / null-instant / idempotent-upsert / findBy<Id> filter / identity-absent / findAll
// case set, with deterministic fixture synthesis (md5 v3-ish UUIDs per (tag,view,field),
// fixed instants, tag-carrying strings).
//
// Source: canonical.gatedReadModels (the api augment's gated ③-layer — the same gate
// gen_repository_specs re-runs over KB readmodels) + canonical.mongoViewNames. Determinism
// notes ported: keys sorted localeCompare (AssemblyEngine.keyNames parity), composite-key
// findBy expansion (批6 A 桶 L2), the flt-a/flt-b sentinel override contract (Set(flt-a) 假红
// 判例), the USE-line filter (JS 正则误入 Scala 模板 bug 修复判例).
import { createHash } from 'node:crypto';

const isInstant = (t) => t === 'Instant' || t === 'instant' || t === 'datetime';
const isList = (t) => /^list[<[]/i.test(t);
const isUuid = (t) => /uuid/i.test(t);
const isInt = (t) => ['Integer', 'Int', 'int', 'integer'].includes(t);
const isLong = (t) => ['Long', 'long'].includes(t);
const isBool = (t) => ['Boolean', 'boolean', 'bool'].includes(t);
const isDecimal = (t) => t === 'BigDecimal' || /decimal/i.test(t);

const uuidFor = (seed) => {
  const h = createHash('md5').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

const SCALA_KEYWORDS = new Set(['type', 'class', 'def', 'val', 'var', 'object', 'trait', 'package', 'import', 'case', 'match', 'else', 'then', 'yield', 'while', 'return', 'throw', 'new', 'extends', 'with', 'final', 'sealed', 'abstract', 'lazy', 'override', 'implicit', 'private', 'protected', 'this', 'super', 'try', 'catch', 'finally', 'for', 'do']);
const id = (name) => (SCALA_KEYWORDS.has(name) ? `\`${name}\`` : name);

const valueOf = (view, f, tag) => {
  const t = String(f.dataType || 'String');
  if (isList(t) && /uuid/i.test(t)) return `List(Id.of("${uuidFor(`${tag}:${view}-${f.name}-0`)}"), Id.of("${uuidFor(`${tag}:${view}-${f.name}-1`)}"))`;
  if (isUuid(t)) return `Id.of("${uuidFor(`${tag}:${view}-${f.name}`)}")`;
  if (isInstant(t)) return `Instant.parse("2026-01-02T03:04:05Z") /* ${tag}:${f.name} */`;
  if (isInt(t)) return '7';
  if (isLong(t)) return '7L';
  if (isBool(t)) return 'true';
  if (isDecimal(t)) return 'BigDecimal("12.34")';
  if (isList(t)) return 'List("x", "y")';
  const n = `${tag}-${view.toLowerCase()}-${f.name}`;
  return `"${n}"`;
};

const paramValueOf = (view, f, tag) => {
  const t = String(f.dataType || 'String');
  if (isUuid(t)) return `"${uuidFor(`${tag}:${view}-${f.name}`)}"`;
  return valueOf(view, f, tag);
};

const otherValueOf = (view, f, seed) => {
  const t = String(f.dataType || 'String');
  if (isUuid(t)) return `Id.of("${uuidFor(seed)}")`;
  if (isInstant(t)) return `Instant.parse("2027-02-03T04:05:06Z")`;
  if (isInt(t)) return '8';
  if (isLong(t)) return '8L';
  if (isBool(t)) return 'false';
  if (isDecimal(t)) return 'BigDecimal("99.99")';
  if (isList(t) && /uuid/i.test(t)) return `List(Id.of("${uuidFor(`${seed}-0`)}"), Id.of("${uuidFor(`${seed}-1`)}"))`;
  if (isList(t)) return 'List("z")';
  return `"${view.toLowerCase()}-${f.name}-other"`;
};

export function repoSpecModels(canonical) {
  const mongoViewNames = new Set(canonical.mongoViewNames ?? []);
  const views = (canonical.gatedReadModels ?? []).filter((m) => m.name.endsWith('DecisionView'));
  const out = [];
  for (const v of views) {
    const fields = v.fields ?? [];
    if (mongoViewNames.has(v.name)) continue;
    const voLists = fields.filter((f) => isList(String(f.dataType || '')) && !/^list[<[]\s*string/i.test(String(f.dataType || '')));
    if (voLists.length > 0) continue;

    const dto = v.name;
    const pkg = 'net.imadz.metarch.infrastructure.repositories.projection';
    const keys = fields.filter((f) => f.isKey).sort((a, b) => a.name.localeCompare(b.name));
    const ids = fields.filter((f) => (!f.isKey || keys.length > 1) && f.name.endsWith('Id'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const instants = fields.filter((f) => isInstant(String(f.dataType || '')));
    const hasUuid = fields.some((f) => isUuid(String(f.dataType || '')));

    const rowArgs = (tag, overrides = {}) => fields.map((f) =>
      overrides[f.name] !== undefined
        ? `${id(f.name)} = ${overrides[f.name]}`
        : `${id(f.name)} = ${valueOf(v.name, f, tag)}`
    ).join(',\n        ');

    const cases = [];
    cases.push(`    "roundtrip all fields through upsert + findByIdentity" in {
      val v = ${dto}(
        ${rowArgs('rt')}
      )
      save(v)
      await(repo.findByIdentity(${keys.map((k) => paramValueOf(v.name, k, 'rt')).join(', ')})) shouldBe Some(v)
    }`);

    if (instants.length > 0) {
      cases.push(`    "preserve null instants (unset timestamps survive the roundtrip)" in {
      val v = ${dto}(
        ${rowArgs('nulls', Object.fromEntries(instants.map((f) => [f.name, 'null'])))}
      )
      save(v)
      await(repo.findByIdentity(${keys.map((k) => paramValueOf(v.name, k, 'nulls')).join(', ')})) shouldBe Some(v)
    }`);
    }

    const mutField = fields.find((f) => !f.isKey && !ids.includes(f)) || fields.find((f) => !f.isKey);
    cases.push(`    "overwrite on duplicate key instead of inserting twice (idempotent upsert)" in {
      save(${dto}(
        ${rowArgs('dup')}
      ))
      save(${dto}(
        ${rowArgs('dup', { [mutField.name]: otherValueOf(v.name, mutField, `dup2:${v.name}-${mutField.name}`) })}
      ))
      val reloaded = await(repo.findByIdentity(${keys.map((k) => paramValueOf(v.name, k, 'dup')).join(', ')}))
      reloaded.map(_.${id(mutField.name)}) shouldBe Some(${otherValueOf(v.name, mutField, `dup2:${v.name}-${mutField.name}`)})
    }`);

    const filterRowTags = ids.map((_, i) => (i === 0 ? ['row-a', 'row-b'] : [`row-a${i + 1}`, `row-b${i + 1}`]));
    ids.forEach((idF, i) => {
      const idPascal = idF.name.charAt(0).toUpperCase() + idF.name.slice(1);
      const dtoVal = valueOf(v.name, idF, 'flt-a');
      const paramVal = paramValueOf(v.name, idF, 'flt-a');
      const otherVal = otherValueOf(v.name, idF, `flt-b:${v.name}-${idF.name}`);
      const [tagA, tagB] = filterRowTags[i];
      const assertVal = idF.name === keys[0].name ? dtoVal : valueOf(v.name, keys[0], tagA);
      cases.push(`    "findBy${idPascal} filters rows by ${idF.name}" in {
      save(${dto}(
        ${rowArgs(tagA, { [idF.name]: dtoVal })}
      ))
      save(${dto}(
        ${rowArgs(tagB, { [idF.name]: otherVal })}
      ))
      val rows = await(repo.findBy${idPascal}(${paramVal}))
      rows.map(_.${id(keys[0].name)}).toSet shouldBe Set(${assertVal}) // ${tagB}（不同 ${idF.name}）被排除
    }`);
    });

    cases.push(`    "return None when identity is absent" in {
      await(repo.findByIdentity(${keys.map((k) => paramValueOf(v.name, k, 'absent')).join(', ')})) shouldBe None
    }`);

    const key0ExpectedOf = (tag) => {
      const i = filterRowTags.findIndex(([a, b]) => a === tag || b === tag);
      if (i >= 0 && ids[i].name === keys[0].name) {
        return tag === filterRowTags[i][0]
          ? valueOf(v.name, ids[i], 'flt-a')
          : otherValueOf(v.name, ids[i], `flt-b:${v.name}-${ids[i].name}`);
      }
      return valueOf(v.name, keys[0], tag);
    };
    const insertedTags = ['rt', 'dup', ...filterRowTags.flat(), ...(instants.length > 0 ? ['nulls'] : [])];
    cases.push(`    "findAll returns every row inserted by this spec" in {
      val rows = await(repo.findAll())
      rows.map(_.${id(keys[0].name)}) should contain allOf (${insertedTags.map((t) => key0ExpectedOf(t)).join(', ')})
    }`);

    const src = `// @generated by gen_repository_specs.mjs (EP_Generated_Patch_Pipeline §九·一)
// 投影仓库行为侧 TDD：真源 readmodels.json → conf/sql/2.sql(H2 MODE=MySQL) → Impl MANUAL 实现
package ${pkg}

import java.time.Instant

import scala.concurrent.Await
import scala.concurrent.ExecutionContext.Implicits.global
import scala.concurrent.Future
import scala.concurrent.duration._

import scalikejdbc._
${hasUuid ? 'import net.imadz.common.Id\n' : ''}import net.imadz.metarch.application.projection.repository.${dto}Table.${dto}
import org.scalatest.BeforeAndAfterAll
import org.scalatest.matchers.should.Matchers
import org.scalatest.wordspec.AnyWordSpecLike

class ${dto}RepositorySpec extends AnyWordSpecLike with Matchers with BeforeAndAfterAll {

  private val repo = new ${dto}RepositoryImpl
  private def await[T](f: Future[T]): T = Await.result(f, 10.seconds)
  private def save(view: ${dto}): Unit = repo.upsert(view)

  override def beforeAll(): Unit = {
    Class.forName("org.h2.Driver")
    // 固定共享库名：scalikejdbc ConnectionPool.singleton 是 JVM 级单例，后初始化覆盖前者；
    // 统一 URL 使覆盖无害（表 IF NOT EXISTS 幂等；各行 key 含 view 名前缀，跨 Spec 天然隔离）
    ConnectionPool.singleton(
      "jdbc:h2:mem:projection_repo_specs;MODE=MySQL;DB_CLOSE_DELAY=-1",
      "sa",
      ""
    )
    val ddl = scala.io.Source.fromFile("conf/sql/2.sql", "utf8").mkString
    val statements = ddl.linesIterator
      .map(_.trim)
      // USE 语句剔除（H2 无目标库概念）：JS 正则误入 Scala 模板的生成器 bug 修复
      // （2026-09-06 批2 实证：/^use\\s/i.test(l) 非 Scala——21 个 Spec 全产非法 Scala）。
      .filterNot(l => l.isEmpty || l.startsWith("--") || l.toLowerCase.startsWith("use "))
      .mkString("\\n")
      .split(";")
      .map(_.trim)
      .filter(_.nonEmpty)
    DB.autoCommit { implicit session =>
      statements.foreach(s => SQL(s).execute.apply())
    }
  }

  "${dto}Repository" should {

${cases.join('\n\n')}
  }
}
`;

    out.push({
      path: `test/net/imadz/metarch/infrastructure/repositories/projection/${dto}RepositorySpec.scala`,
      kind: 'repo-spec', schemaCategory: 'projection', schemaNode: `${dto}RepositorySpec`, families: [dto], deps: [`${dto}RepositoryImpl`], noteIds: [],
      content: src,
    });
  }
  return out;
}
