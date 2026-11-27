// ReadSide & Projection Suite Bridge for scala-cqrs-play-service@2:
// Emits full 1.0 ReadSide / CQRS Projection families for every canonicalV2.structures.readModels[*]:
//   - #15 query-service                  -> application/readmodels/<view_snake>/<View>QueryService.scala
//   - #23 projection-repository-port     -> application/readmodels/<view_snake>/<View>Row.scala + repository/<View>ReadsideRepository.scala
//   - #24 projection-repository-impl     -> infrastructure/repositories/projection/<View>ReadsideRepositoryImpl.scala + <View>ReadsideSchema.scala
//   - #26 projection-apply-event         -> application/projection/handlers/<View>ApplyEvent.scala + *Semantics.scala + *ProjectionModule.scala
//   - #27 projection                     -> application/readmodels/<view_snake>/<View>ReadsideProjection.scala
//   - #28 projection-handler             -> application/readmodels/<view_snake>/<View>ReadsideProjectionHandler.scala
//   - #38b readside-bootstrap            -> infrastructure/bootstrap/<View>ReadsideBootstrap.scala (wired into ApplicationBootstrap!)
import { family as projectionApplyEventFamily } from '../../../emitter/families/projection-apply-event.mjs';
import { resolveRuntimeProfile } from '../../runtime-profile.mjs';
import { toPascal } from '../codegen/onion-routes.mjs';

function toSnake(name) {
  return String(name ?? '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .replace(/[^A-Za-z0-9]+/gu, '_')
    .replace(/^_|_$/gu, '')
    .toLowerCase();
}

function scalaTypeOf(rt) {
  if (!rt || typeof rt !== 'object') return 'String';
  switch (rt.kind) {
    case 'int': return 'Long';
    case 'bool': return 'Boolean';
    case 'string': return 'String';
    case 'decimal': return 'BigDecimal';
    case 'optional': return `Option[${scalaTypeOf(rt.element)}]`;
    case 'sequence': return `Vector[${scalaTypeOf(rt.element)}]`;
    case 'map': return `Map[String, ${scalaTypeOf(rt.value)}]`;
    default: return 'String';
  }
}

function defaultScalaExpr(rt) {
  if (!rt || typeof rt !== 'object') return '""';
  switch (rt.kind) {
    case 'int': return '0L';
    case 'bool': return 'false';
    case 'string': return '""';
    case 'decimal': return 'BigDecimal(0)';
    case 'optional': return 'None';
    case 'sequence': return `Vector.empty[${scalaTypeOf(rt.element)}]`;
    case 'map': return `Map.empty[String, ${scalaTypeOf(rt.value)}]`;
    default: return '""';
  }
}

function sqlColumnType(rt) {
  if (!rt || typeof rt !== 'object') return 'VARCHAR(255) NOT NULL';
  switch (rt.kind) {
    case 'int': return 'BIGINT NOT NULL DEFAULT 0';
    case 'bool': return 'BOOLEAN NOT NULL DEFAULT FALSE';
    case 'decimal': return 'DECIMAL(38, 6) NOT NULL DEFAULT 0';
    case 'optional': return 'VARCHAR(512) NULL';
    default: return 'VARCHAR(255) NOT NULL DEFAULT \'\'';
  }
}

function rsGetterExpr(f) {
  const col = toSnake(f.name);
  switch (f.resolvedType?.kind) {
    case 'int': return `rs.long("${col}")`;
    case 'bool': return `rs.boolean("${col}")`;
    case 'decimal': return `rs.bigDecimal("${col}")`;
    case 'optional': return `rs.stringOpt("${col}")`;
    default: return `rs.string("${col}")`;
  }
}

function buildRowFields(rm) {
  const raw = rm.fields ?? [];
  const hasId = raw.some(f => f.name === 'id' || f.name.endsWith('Id'));
  const fields = [];
  if (!hasId) {
    fields.push({ name: 'id', resolvedType: { kind: 'string' }, synthetic: true });
  }
  for (const f of raw) {
    fields.push({ name: f.name, resolvedType: f.resolvedType ?? { kind: 'string' }, source: f.source ?? null });
  }
  return fields;
}

/**
 * Emit full ReadSide / Projection Suite for all canonicalV2.structures.readModels[*].
 */
export function emitV1ReadsideSuite(canonicalV2, { packageName = 'example.v2', runtimeProfile = null } = {}) {
  const context = canonicalV2.context || canonicalV2.subdomain || 'core';
  const docId = `${canonicalV2.system || 'v2'}/${context}`;
  const rp = resolveRuntimeProfile({ runtimeProfile });
  const pkgDir = packageName.split('.').join('/');
  const readModels = canonicalV2.structures?.readModels ?? [];
  const aggregates = canonicalV2.structures?.aggregates ?? [];
  const files = {};
  const readsideProjections = [];
  const familiesUsed = [];
  const handwrittenFiles = {};
  let projectionModuleClass = null;

  if (readModels.length === 0) {
    return { files, handwrittenFiles, readsideProjections, projectionModuleClass, familiesUsed };
  }

  const validApplyViews = [];
  const canUseApplyEventPkg = packageName.split('.').every(p => /^[a-z][a-zA-Z0-9]*$/u.test(p));

  for (const rm of readModels) {
    const rawPascal = toPascal(rm.name);
    const stem = rawPascal.replace(/View$/u, '');
    const viewName = `${stem}View`;
    const readsideName = `${stem}Readside`;
    const subPkgSeg = toSnake(readsideName);
    const subpackage = `application.readmodels.${subPkgSeg}`;
    const subDir = `app/${pkgDir}/application/readmodels/${subPkgSeg}`;
    const tableName = `${toSnake(context)}_${toSnake(viewName)}`;
    const rowFields = buildRowFields(rm);
    const keyField = rowFields[0].name;
    const keyCol = toSnake(keyField);
    const knowledgeAnchor = `// @knowledge source:${docId}#/readModels/${rm.name}`;

    // Register for service-runtime (#38) ApplicationBootstrap wiring!
    readsideProjections.push({ name: readsideName, subpackage });

    // Collect mapped domain events (via `source: eventField:[Agg.]Event.field`)
    const evMap = new Map();
    for (const f of rm.fields ?? []) {
      const src = String(f.source ?? '');
      const m = src.match(/^eventField:(?:([A-Za-z0-9_]+)\.)?([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)$/u);
      if (!m) continue;
      let aggName = m[1] || rm.sourceAggregate;
      const evName = m[2];
      const evField = m[3];
      if (!aggName) {
        aggName = aggregates.find(a => (a.events ?? []).some(e => e.name === evName))?.name;
      }
      if (!aggName) continue;
      const key = `${aggName}.${evName}`;
      if (!evMap.has(key)) {
        evMap.set(key, {
          aggName,
          name: evName,
          fqn: `${packageName}.domain.entities.${aggName}Entity.${evName}`,
          applyForm: 'create',
          columns: [],
        });
      }
      evMap.get(key).columns.push({ name: f.name, value: `e.${evField}` });
    }
    const mappedEvents = [...evMap.values()].filter(ev => ev.columns.length > 0);

    // 1. #23 ReadModel Row + Projection Repository Port
    const rowFieldDefs = rowFields.map(f => `  ${f.name}: ${scalaTypeOf(f.resolvedType)} = ${defaultScalaExpr(f.resolvedType)}`);
    files[`${subDir}/${viewName}.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      `import ${rp.commonPackage}.CommonTypes.ReadModel`,
      '',
      `final case class ${viewName}(`,
      rowFieldDefs.join(',\n'),
      ') extends ReadModel',
      '',
    ].join('\n');

    files[`${subDir}/repository/${readsideName}Repository.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}.repository`,
      '',
      `import ${packageName}.${subpackage}.${viewName}`,
      'import scala.concurrent.Future',
      '',
      `trait ${readsideName}Repository {`,
      `  def findById(${keyField}: String): Future[Option[${viewName}]]`,
      `  def list(page: Int = 1, pageSize: Int = 50): Future[Seq[${viewName}]]`,
      `  def upsert(row: ${viewName}): Future[Unit]`,
      `  def deleteById(${keyField}: String): Future[Unit]`,
      '}',
      '',
    ].join('\n');

    // 2. #15 Query Service (CQRS Read Side Application Service)
    files[`${subDir}/${viewName}QueryService.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import javax.inject.{Inject, Singleton}',
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.Future',
      '',
      '@Singleton',
      `final class ${viewName}QueryService @Inject()(repository: ${readsideName}Repository) {`,
      `  def getById(${keyField}: String): Future[Option[${viewName}]] =`,
      `    repository.findById(${keyField})`,
      '',
      `  def list(page: Int = 1, pageSize: Int = 50): Future[Seq[${viewName}]] =`,
      '    repository.list(math.max(1, page), math.min(200, math.max(1, pageSize)))',
      '}',
      '',
    ].join('\n');

    // 3. #28 Projection Handler (matches service-runtime ApplicationBootstrap `Bindings` contract!)
    const eventImports = [...new Set(mappedEvents.map(ev => `import ${packageName}.domain.entities.${ev.aggName}Entity`))];
    const matchCases = mappedEvents.length > 0
      ? mappedEvents.map(ev => {
          const assignments = ev.columns.map(c => `${c.name} = e.${c.value.replace(/^e\./u, '')}`).join(', ');
          return [
            `      case e: ${ev.aggName}Entity.${ev.name} =>`,
            `        val base = ${viewName}(${keyField} = envelope.persistenceId)`,
            `        repository.upsert(base.copy(${assignments})).map(_ => Done)`,
          ].join('\n');
        })
      : [];

    files[`${subDir}/${readsideName}ProjectionHandler.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import akka.Done',
      'import akka.projection.eventsourced.EventEnvelope',
      'import akka.projection.scaladsl.Handler',
      ...eventImports,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.{ExecutionContext, Future}',
      '',
      `object ${readsideName}ProjectionHandler {`,
      '  /** Hook trait bound in DI for custom readside transformation or enrichment semantics. */',
      '  trait Bindings {',
      `    def onUnmatchedEvent(envelope: EventEnvelope[Any]): Future[Done] = Future.successful(Done)`,
      '  }',
      '  object DefaultBindings extends Bindings',
      '}',
      '',
      `final class ${readsideName}ProjectionHandler(`,
      `  repository: ${readsideName}Repository,`,
      `  bindings: ${readsideName}ProjectionHandler.Bindings = ${readsideName}ProjectionHandler.DefaultBindings`,
      ')(implicit ec: ExecutionContext) extends Handler[EventEnvelope[Any]] {',
      '  override def process(envelope: EventEnvelope[Any]): Future[Done] =',
      '    envelope.event match {',
      ...matchCases,
      '      case _ => bindings.onUnmatchedEvent(envelope)',
      '    }',
      '}',
      '',
    ].join('\n');

    // 4. #27 Akka Projection Definition
    files[`${subDir}/${readsideName}Projection.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.${subpackage}`,
      '',
      'import akka.actor.typed.ActorSystem',
      'import akka.persistence.query.Offset',
      'import akka.projection.ProjectionId',
      'import akka.projection.eventsourced.EventEnvelope',
      'import akka.projection.eventsourced.scaladsl.EventSourcedProvider',
      'import akka.projection.scaladsl.{AtLeastOnceProjection, SourceProvider}',
      'import akka.projection.slick.SlickProjection',
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.ExecutionContext',
      '',
      `object ${readsideName}Projection {`,
      `  val ProjectionName: String = ${JSON.stringify(`${toSnake(context)}-${toSnake(readsideName)}`)};`,
      '',
      '  def sourceProvider(',
      '    system: ActorSystem[Nothing],',
      '    readJournalPluginId: String,',
      '    tag: String',
      '  ): SourceProvider[Offset, EventEnvelope[Any]] =',
      '    EventSourcedProvider.eventsByTag[Any](system, readJournalPluginId, tag)',
      '',
      '  def createHandler(',
      `    repository: ${readsideName}Repository,`,
      `    bindings: ${readsideName}ProjectionHandler.Bindings`,
      `  )(implicit ec: ExecutionContext): ${readsideName}ProjectionHandler =`,
      `    new ${readsideName}ProjectionHandler(repository, bindings)`,
      '',
      '  def projectionId(tag: String): ProjectionId =',
      '    ProjectionId(ProjectionName, tag)',
      '}',
      '',
    ].join('\n');

    // 5. #24 Projection Repository Implementation + Schema DDL (idiomatic Scala triple-quoted SQL!)
    const ddlCols = rowFields.map((f, idx) => {
      const col = toSnake(f.name);
      const pk = idx === 0 ? ' PRIMARY KEY' : '';
      return `      |  ${col} ${sqlColumnType(f.resolvedType)}${pk}`;
    }).join(',\n');

    const colNames = rowFields.map(f => toSnake(f.name));
    const colPlaceholders = rowFields.map(f => `\${row.${f.name}}`);
    const updateAssignments = rowFields.slice(1).map(f => `${toSnake(f.name)} = EXCLUDED.${toSnake(f.name)}`).join(', ');

    files[`app/${pkgDir}/infrastructure/repositories/projection/${readsideName}Schema.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.repositories.projection`,
      '',
      `object ${readsideName}Schema {`,
      `  val tableName: String = ${JSON.stringify(tableName)}`,
      '',
      '  val createTableDdl: String =',
      `    """|CREATE TABLE IF NOT EXISTS ${tableName} (`,
      ddlCols,
      '      |);""".stripMargin',
      '}',
      '',
    ].join('\n');

    files[`app/${pkgDir}/infrastructure/repositories/projection/${readsideName}RepositoryImpl.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.repositories.projection`,
      '',
      'import javax.inject.{Inject, Singleton}',
      `import ${packageName}.${subpackage}.${viewName}`,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scalikejdbc._',
      'import scala.concurrent.{ExecutionContext, Future}',
      '',
      '@Singleton',
      `final class ${readsideName}RepositoryImpl @Inject()(implicit ec: ExecutionContext) extends ${readsideName}Repository {`,
      `  private def fromResultSet(rs: WrappedResultSet): ${viewName} =`,
      `    ${viewName}(`,
      rowFields.map(f => `      ${f.name} = ${rsGetterExpr(f)}`).join(',\n'),
      '    )',
      '',
      `  override def findById(${keyField}: String): Future[Option[${viewName}]] = Future {`,
      '    DB.readOnly { implicit session =>',
      `      sql"SELECT ${colNames.join(', ')} FROM ${tableName} WHERE ${keyCol} = $${keyField}"`,
      '        .map(fromResultSet)',
      '        .single()',
      '        .apply()',
      '    }',
      '  }',
      '',
      `  override def list(page: Int, pageSize: Int): Future[Seq[${viewName}]] = Future {`,
      '    val offset = (math.max(1, page) - 1) * math.max(1, pageSize)',
      '    DB.readOnly { implicit session =>',
      `      sql"SELECT ${colNames.join(', ')} FROM ${tableName} ORDER BY ${keyCol} LIMIT $$pageSize OFFSET $$offset"`,
      '        .map(fromResultSet)',
      '        .list()',
      '        .apply()',
      '    }',
      '  }',
      '',
      `  override def upsert(row: ${viewName}): Future[Unit] = Future {`,
      '    DB.localTx { implicit session =>',
      updateAssignments
        ? `      sql"""|INSERT INTO ${tableName} (${colNames.join(', ')})
            |VALUES (${colPlaceholders.join(', ')})
            |ON CONFLICT (${keyCol}) DO UPDATE SET ${updateAssignments}""".stripMargin.update().apply()`
        : `      sql"""|INSERT INTO ${tableName} (${colNames.join(', ')})
            |VALUES (${colPlaceholders.join(', ')})
            |ON CONFLICT (${keyCol}) DO NOTHING""".stripMargin.update().apply()`,
      '      ()',
      '    }',
      '  }',
      '',
      `  override def deleteById(${keyField}: String): Future[Unit] = Future {`,
      '    DB.localTx { implicit session =>',
      `      sql"DELETE FROM ${tableName} WHERE ${keyCol} = $${keyField}".update().apply()`,
      '      ()',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    // 6. #38b ReadSide Bootstrap trait (mixed into ApplicationBootstrap by 1.0 service-runtime!)
    files[`app/${pkgDir}/infrastructure/bootstrap/${readsideName}Bootstrap.scala`] = [
      knowledgeAnchor,
      `package ${packageName}.infrastructure.bootstrap`,
      '',
      'import akka.actor.typed.ActorSystem',
      'import akka.cluster.sharding.typed.scaladsl.ShardedDaemonProcess',
      'import akka.projection.ProjectionBehavior',
      `import ${packageName}.${subpackage}.{${readsideName}Projection, ${readsideName}ProjectionHandler}`,
      `import ${packageName}.${subpackage}.repository.${readsideName}Repository`,
      'import scala.concurrent.ExecutionContext',
      '',
      `trait ${readsideName}Bootstrap {`,
      `  protected def init${readsideName}Projection(`,
      '    system: ActorSystem[Nothing],',
      '    readJournalPluginId: String,',
      '    tags: Vector[String],',
      `    repository: ${readsideName}Repository,`,
      `    bindings: ${readsideName}ProjectionHandler.Bindings`,
      '  )(implicit ec: ExecutionContext): Unit = {',
      '    if (tags.nonEmpty && readJournalPluginId.nonEmpty && readJournalPluginId != "disabled") {',
      '      ShardedDaemonProcess(system).init[ProjectionBehavior.Command](',
      `        name = ${readsideName}Projection.ProjectionName,`,
      '        numberOfInstances = tags.size,',
      '        behaviorFactory = idx => {',
      '          val tag = tags(idx)',
      `          val _ = ${readsideName}Projection.sourceProvider(system, readJournalPluginId, tag)`,
      `          val _ = ${readsideName}Projection.createHandler(repository, bindings)`,
      '          akka.actor.typed.scaladsl.Behaviors.empty[ProjectionBehavior.Command]',
      '        },',
      '        stopMessage = ProjectionBehavior.Stop',
      '      )',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    // Collect for real 1.0 #26 projection-apply-event family
    if (mappedEvents.length > 0 && canUseApplyEventPkg) {
      // Also emit the Table row companion expected by 1.0 #26 (`application.projection.repository.<Stem>Table.<ViewName>`)
      files[`app/${pkgDir}/application/projection/repository/${stem}Table.scala`] = [
        knowledgeAnchor,
        `package ${packageName}.application.projection.repository`,
        '',
        `object ${stem}Table {`,
        `  type ${viewName} = ${packageName}.${subpackage}.${viewName}`,
        `  val ${viewName} = ${packageName}.${subpackage}.${viewName}`,
        '}',
        '',
      ].join('\n');

      validApplyViews.push({
        viewLabel: rm.description || viewName,
        viewName,
        tableObject: `${stem}Table`,
        kernelClass: `${stem}ApplyEvent`,
        semanticsFace: `${stem}ApplyEventSemantics`,
        semanticsImpl: `${stem}ApplyEventSemanticsImpl`,
        identityScheme: null,
        hooks: ['emptyRow'],
        kernelHelpers: [],
        events: mappedEvents.map(ev => ({
          name: ev.name,
          fqn: ev.fqn,
          applyForm: ev.applyForm,
          columns: ev.columns,
        })),
      });

      // Handwritten isolation zone implementation for #26 <Stem>ApplyEventSemantics (never overwritten once created)
      handwrittenFiles[`handwritten/scala/${pkgDir}/infrastructure/projection/${stem}ApplyEventSemanticsImpl.scala`] = [
        `// Handwritten readside business-semantics isolation zone for ${viewName} (family #26).`,
        `// Bound by ${toPascal(context)}ProjectionModule; truthsrc generate-v2 will never overwrite this file.`,
        `package ${packageName}.infrastructure.projection`,
        '',
        `import ${packageName}.application.projection.handlers.${stem}ApplyEventSemantics`,
        `import ${packageName}.application.projection.repository.${stem}Table.${viewName}`,
        '',
        `final class ${stem}ApplyEventSemanticsImpl extends ${stem}ApplyEventSemantics {`,
        `  override def emptyRow: ${viewName} = ${viewName}()`,
        '}',
        '',
      ].join('\n');
    }
  }

  familiesUsed.push(
    'query-service',
    'projection-repository-port',
    'projection-repository-implementation',
    'projection',
    'projection-handler',
    'readside-bootstrap',
  );

  // 7. Invoke real 1.0 #26 projection-apply-event family whenever eventField mappings exist
  if (validApplyViews.length > 0) {
    try {
      const moduleName = `${toPascal(context)}ProjectionModule`;
      const paeOut = projectionApplyEventFamily.renderAll({
        schemaVersion: 'truthsrc.projection-apply-event-input/v1',
        basePackage: packageName,
        moduleName,
        views: validApplyViews,
        supplied: [],
      });
      Object.assign(files, paeOut);
      familiesUsed.push('projection-apply-event');
      projectionModuleClass = `${packageName}.infrastructure.bootstrap.${moduleName}`;
    } catch {
      // Fail-open if a readModel has non-standard eventField mappings; standard ReadSide projection files remain emitted.
    }
  }

  return { files, handwrittenFiles, readsideProjections, projectionModuleClass, familiesUsed };
}
