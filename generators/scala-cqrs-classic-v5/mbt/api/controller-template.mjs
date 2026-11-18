import { ProductError } from '../../../../lib/products/request.mjs';
import { fqn, signature, shouldImport, collectDependencies } from '../../../../lib/classic-architecture/types.mjs';
import { firstLower, classicApiScalaId } from '../../../../lib/classic-architecture/naming.mjs';
import { GateKind, Addressing } from './models.mjs';
import { viewHelperFragments, viewCall, viewFormNote } from './view-template.mjs';

// classicApiScalaId is a required Main-owned shared naming addition; do not
// replace it with a private keyword table or NamingConventions' different set.
function fail(message) { throw new ProductError('CLASSIC_API_TEMPLATE', message); }
const imports = values => [...values].sort().map(value => `import ${value}`).join('\n');
const indent = lines => lines.map(line => /^[\x00-\x20]*$/u.test(line) ? line : '  ' + line);
const activeEndpoints = model => model.endpoints.filter(e => e.skip === null);
function distinctBy(values, key) {
  const seen = new Set();
  return values.filter(value => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}
function stub(e) {
  const params = e.parameters.map(p => `${p.name}: ${p.typeRef.name}`).join(', ');
  return `  /**
   * ${e.method} ${e.path}
   */
  def ${e.actionName}(${params}): Action[AnyContent] = Action.async { implicit request =>
    // TODO: Implement business logic calling ${e.serviceMethod}
    // ${e.serviceMethod}(...)
    Future.successful(Ok(Json.obj("message" -> "Not implemented yet")))
  }`;
}
function legacyController(model) {
  // Mapping a Scala Set[TypeRef] to Set[String] collapses equal FQNs before
  // the template appends its fixed imports; that later sequence stays non-distinct.
  const list = [...new Set(model.dependencies.map(ref => `${ref.packageName}.${ref.name}`))].sort().concat([
    'javax.inject._', 'play.api.mvc._', 'play.api.libs.json._', 'scala.concurrent.ExecutionContext']);
  const injected = model.injectedServices.map(s => `${s.name}: ${s.typeRef.name}`).join(',\n    ');
  return `package ${model.selfType.packageName}

${imports(list)}

/**
 * ${model.selfType.name}: API Controller for ${model.selfType.name.replaceAll('Controller', '')}
 */
class ${model.selfType.name} @Inject() (${injected}, val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc

${model.endpoints.map(stub).join('\n\n')}

}
`;
}
function groupImport(pkg, members) {
  const names = members.filter(([, enabled]) => enabled).map(([name]) => name);
  if (!names.length) return pkg.startsWith('net.imadz') ? '' : `${pkg}.`;
  return names.length === 1 ? `${pkg}.${names[0]}` : `${pkg}.{${names.join(', ')}}`;
}
function readImportFacts(reads) {
  return {
    hasRead: reads.length > 0,
    hasList: reads.some(r => r.form === 'ListView'),
    hasItem: reads.some(r => r.form === 'ItemView' && r.singleKey),
    hasComposite: reads.some(r => r.form === 'ItemView' && !r.singleKey),
  };
}
function dslImports(model) {
  const active = activeEndpoints(model), current = model.selfType.packageName;
  const reads = active.flatMap(e => e.readModel === null ? [] : [e.readModel]);
  const facts = readImportFacts(reads);
  const hasCommand = active.some(e => e.serves?.kind === 'Command');
  const hasFlow = active.some(e => e.serves?.kind === 'UseCase');
  const hasTenantRole = active.some(e => e.gateKind === GateKind.Tenant && e.serves?.kind === 'Command') ||
    active.some(e => e.readModel !== null && e.gateKind === GateKind.Tenant);
  const protocol = model.dependencies.filter(ref => ref.name.endsWith('Protocol')).map(ref => `${fqn(ref)}._`);
  const services = model.injectedServices.map(s => s.typeRef).filter(ref => shouldImport(ref, current)).map(fqn);
  const rows = [...new Set(reads.map(r => r.rowType.packageName))].filter(pkg => pkg !== current);
  const stubs = model.endpoints.filter(e => e.gate === null && e.skip === null)
    .flatMap(e => [...e.parameters.map(p => p.typeRef), e.returnType]);
  const stubImports = collectDependencies(stubs).filter(ref => shouldImport(ref, current)).map(fqn);
  const moduleAuth = `${model.modulePkg ?? 'net.imadz'}.infrastructure.auth`;
  const list = ['javax.inject.{Inject, Singleton}', ...protocol, ...services, ...rows, ...stubImports,
    groupImport('net.imadz.common.auth', [['ApiError', hasCommand || facts.hasRead], ['CommandRoleMap', false], ['Endpoint', true], ['ViewKeys', false]]),
    groupImport(moduleAuth, [['ApiError', false], ['CommandRoleMap', hasTenantRole], ['Endpoint', false], ['ViewKeys', facts.hasRead]]),
    groupImport('net.imadz.infrastructure.api', [
      ['IdGuard', active.some(e => e.idGuard !== null)], ['InstantGuard', active.some(e => e.instantGuard !== null)],
      ['OkReceipt', hasCommand || hasFlow], ['ViewListDto', facts.hasList], ['ViewItem', facts.hasItem],
    ]),
    facts.hasComposite ? 'play.api.libs.json.{JsObject, JsValue, Json, OWrites}' : 'play.api.libs.json.{JsValue, Json}',
    'play.api.mvc._', 'scala.concurrent.ExecutionContext', 'scala.concurrent.Future', 'scala.concurrent.duration._'];
  // The frozen imports helper sorts, but DOES NOT remove the empty group string.
  return [...new Set(list)];
}
function sig(e) {
  return e.parameters.length ? '(' + e.parameters.map(p => `${p.name}: ${signature(p.typeRef)}`).join(', ') + ')' : '';
}
function entityExpression(e) {
  return e.addressing === Addressing.Path ? e.parameters[0]?.name ?? 'id' : 'generatedId';
}
function sessionUser(arg) {
  if (arg.gateKind === GateKind.Tenant) return 'ts.userId';
  if (arg.gateKind === GateKind.Global) return 'gc.userId';
  fail(`ctor parameter [${arg.paramName}] has no anonymous session identity source`);
}
function ctorExpression(arg) {
  switch (arg.kind) {
    case 'FromPathId': case 'FromGuard': case 'FromInstantGuard': return arg.bindName;
    case 'FromSessionUser': return sessionUser(arg);
    case 'FromSessionTenant': return 'net.imadz.common.Id.of(ts.tenantId)';
    case 'FromGeneratedId': return 'net.imadz.common.Id.of(generatedId)';
    case 'FromBody': return `req.${classicApiScalaId(arg.paramName)}`;
    case 'FromBodyOptional': return `req.${classicApiScalaId(arg.paramName)}.getOrElse("")`;
    default: fail(`unsupported CtorArgRef ${arg.kind}`);
  }
}
function askBody(e, command, entity) {
  const ctor = e.ctorArgs.map(ctorExpression).join(', ');
  const generated = e.addressing === Addressing.Factory ? ['        val generatedId = java.util.UUID.randomUUID().toString'] : [];
  return [...generated,
    `        repository.entityRef(${entity}).ask {`,
    `          (replyTo: akka.actor.typed.ActorRef[${command}Reply]) => ${command}(${ctor}, replyTo)`,
    '        }.map { reply =>',
    '          reply.error.fold[Either[ApiError, OkReceipt]](',
    `            Right(OkReceipt(${entity}, play.api.libs.json.JsNull))`,
    '          )(e => Left(ApiError.badRequest(e.code, e.message)))',
    '        }'];
}
function guardWrapped(guard, type, body) {
  if (guard === null) return body;
  const pairs = guard.pairs.map(([name, value]) => `"${name}" -> ${value}`).join(', ');
  return [`          ${type}.parse(${pairs}) match {`,
    `            case Right(Seq(${guard.binds.join(', ')})) =>`, ...indent(body),
    '            case Left(err) => Future.successful(Left(err))', '          }'];
}
function conflictPredicate(e, kind, entity) {
  const fields = e.reqVo.reqFields.filter(f => !(f.typeRef.name === 'Option' && f.typeRef.packageName === ''));
  if (!fields.length) fail(`Endpoint('${e.actionName}') 409 precheck has no required conflict-key fields`);
  const comparisons = fields.map(f => `v.${classicApiScalaId(f.name)} == req.${classicApiScalaId(f.name)}`);
  const self = e.ctorArgs.find(arg => arg.kind === 'FromPathId');
  if (self) comparisons.push(`v.${self.paramName}.toString != ${entity}`);
  if (kind === GateKind.Tenant) comparisons.push('v.tenantId == ts.tenantId');
  return comparisons.join(' && ');
}
function dedupWrapped(e, kind, entity, body, repo) {
  if (repo === null) fail(`Endpoint('${e.actionName}') errorPayloads requires a projection repository injection`);
  const payload = e.errorPayloads[0]; // Preserve first-payload precheck, not an invented multi-error policy.
  const predicate = conflictPredicate(e, kind, entity);
  const message = payload.conflictMessage ?? payload.errorCode;
  const args = payload.payloadFields.map(([, value]) => value).join(', ');
  return [`        ${repo}.findAll().flatMap { all =>`,
    `          val conflict = all.find(v => ${predicate})`,
    '          if (conflict.isDefined) {',
    `            Future.successful(Left(ApiError.conflict("${payload.errorCode}",`,
    `              "${message}", ${payload.payloadName}(${args}))))`,
    '          } else {', ...indent(body), '          }', '        }'];
}
function writeDeclaration(kind, command, req, dedup) {
  const note = dedup ? '＋409 查重前置 typed payload' : '';
  if (kind === GateKind.Tenant) return {
    comment: `${command}（tenant 档——api.tenant.write + CommandRoleMap 命令粒度角色${note}）`,
    declaration: `    api.tenant.write[${req}](CommandRoleMap.ofCommand("${command}"): _*)`, params: '(ts, req)',
  };
  if (kind === GateKind.Global) return {
    comment: `${command}（global 档——api.global.write 空 roles＝scope 兜底（D1：已登录、无租户承诺）${note}）`,
    declaration: `    api.global.write[${req}]()`, params: '(gc, req)',
  };
  fail('anonymous command writes are outside the frozen emission set');
}
function commandEndpoint(e, repo) {
  const command = e.serves.command;
  if (e.reqVo === null) fail(`Endpoint('${e.actionName}') command write requires Req VO`);
  const entity = entityExpression(e);
  // Id outermost, then Instant, then ask. Precheck wraps the whole guard chain.
  const guarded = guardWrapped(e.idGuard, 'IdGuard', guardWrapped(e.instantGuard, 'InstantGuard', askBody(e, command, entity)));
  const dedup = e.errorPayloads.length > 0;
  const body = dedup ? dedupWrapped(e, e.gateKind, entity, guarded, repo) : guarded;
  const write = writeDeclaration(e.gateKind, command, e.reqVo.reqName, dedup);
  return [`  /** ${write.comment} */`,
    `  def ${e.actionName}${sig(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] =`, write.declaration,
    `      .apply[OkReceipt] { ${write.params} =>`, ...body, '      }'].join('\n');
}
function flowEndpoint(e) {
  const { useCase, flowMethod, flowArgs } = e.serves;
  if (e.reqVo === null) fail(`Endpoint('${useCase}') anonymous UseCase requires requestBody`);
  const service = `${firstLower(useCase)}Flow`;
  const declared = flowArgs.map(a => `body.${classicApiScalaId(a)}`).join(', ');
  const derived = e.reqVo.reqFields.map(f => `body.${f.name}`).join(', ');
  const args = declared || derived || 'body';
  return [`  /** ${useCase}（anonymous 档——api.anonymous 免登录；编排下沉手写 ${service}·D3） */`,
    `  def ${e.actionName}${sig(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] =`,
    `    api.anonymous.write[${e.reqVo.reqName}]`, '      .apply[OkReceipt] { (req, body) =>',
    `        ${service}.${flowMethod ?? 'register'}(${args})`, '      }'].join('\n');
}
function viewEndpoint(e) {
  const read = e.readModel;
  if (read === null) fail(`Endpoint('${e.actionName}') ServesView requires readModel`);
  if (e.gateKind === GateKind.Anonymous) fail('ServesView anonymous is outside the frozen emission set');
  const scope = e.gateKind === GateKind.Tenant
    ? 'tenant 档——api.tenant.read + CommandRoleMap.of(vk) 视图角色' : 'global 档——api.global.read 空 roles＝scope 兜底';
  return [`  /** ${e.actionName}（读侧端点——ServesView(${read.viewKey})：${scope}；${viewFormNote(read)}） */`,
    `  def ${e.actionName}${sig(e)}: play.api.mvc.Action[play.api.mvc.AnyContent] = ${viewCall(read, e.gateKind)}`].join('\n');
}
function dslEndpoint(e, repo) {
  if (e.gateKind === null) return stub(e);
  if (e.gateKind === GateKind.Anonymous && e.serves?.kind === 'UseCase') return flowEndpoint(e);
  if (e.serves?.kind === 'Command') return commandEndpoint(e, repo);
  if (e.serves?.kind === 'View') return viewEndpoint(e);
  fail(`Endpoint('${e.actionName}') gate/serves combination is outside the frozen emission set`);
}
function reqDeclarations(model) {
  const vos = activeEndpoints(model).flatMap(e => e.reqVo === null ? [] : [e.reqVo])
    .filter(vo => !vo.explicit && !vo.hasEmptyBody);
  return distinctBy(vos, vo => vo.reqName).map(vo => {
    const fields = vo.reqFields.map(f => `${f.name}: ${signature(f.typeRef)}`).join(', ');
    return `/** 命令载荷 VO——typed Reads 派生，缺键/类型错 → 400 PARAM_INVALID（含字段明细）。 */
final case class ${vo.reqName}(${fields})
object ${vo.reqName} {
  implicit val reads: play.api.libs.json.Reads[${vo.reqName}] = play.api.libs.json.Json.reads
}`;
  });
}
function payloadDeclarations(model) {
  const payloads = activeEndpoints(model).flatMap(e => e.errorPayloads);
  return distinctBy(payloads, p => p.payloadName).map(p => {
    const fields = p.payloadFields.map(([name]) => `${name}: String`).join(', ');
    return `/** 409 typed payload——conflict 工厂载荷（OFormat 写侧对称·与命令 Req 相邻）。 */
final case class ${p.payloadName}(${fields})
object ${p.payloadName} {
  implicit val format: play.api.libs.json.OFormat[${p.payloadName}] = play.api.libs.json.Json.format
}`;
  });
}
function emptyReads(flag) {
  return flag ? [
    '  /** 空 body 命令通道（write[JsObject]）：任意合法 JSON 体即过——与旧 parse.json 行为等价（body 必须是合法 JSON） */',
    '  private implicit val emptyBodyReads: play.api.libs.json.Reads[play.api.libs.json.JsObject] =',
    '    play.api.libs.json.Reads(_ => play.api.libs.json.JsSuccess(play.api.libs.json.Json.obj()))',
  ] : [];
}
function dslController(model) {
  const repo = model.injectedServices.find(s => s.typeRef.packageName.endsWith('application.projection.repository'))?.name ?? null;
  const endpoints = activeEndpoints(model).map(e => dslEndpoint(e, repo)).join('\n\n');
  const helpers = viewHelperFragments(model);
  const injections = ['api: Endpoint', ...model.injectedServices.map(s => `${s.name}: ${s.typeRef.name}`), 'val cc: ControllerComponents'].join(', ');
  const header = ['  override def controllerComponents: ControllerComponents = cc',
    '  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)', ...emptyReads(model.dslFlags.aggHasEmptyBody)];
  const body = [`package ${model.selfType.packageName}`, '', imports(dslImports(model)), '', '/**',
    ` * ${model.selfType.name}: API Controller for ${model.selfType.name.replaceAll('Controller', '')}`, ' */', '@Singleton',
    `class ${model.selfType.name} @Inject() (${injections})(implicit ec: ExecutionContext) extends BaseController {`,
    '', header.join('\n'), '',
    ...(helpers.length ? [helpers.join('\n\n'), '', endpoints] : [endpoints]), '}'].join('\n');
  const vos = [...reqDeclarations(model), ...payloadDeclarations(model)];
  return body + (vos.length ? '\n\n' + vos.join('\n\n') : '') + '\n';
}
export function renderClassicController(model) {
  return model.dslFlags.aggHasDsl ? dslController(model) : legacyController(model);
}
