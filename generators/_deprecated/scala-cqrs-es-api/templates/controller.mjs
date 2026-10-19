// controller.mjs — 【Template】controller-face rendering, ported verbatim from the production
// gen_api_controllers templates: tpl_controller.mjs (file assembly) + tpl_dsl.mjs (endpoint
// rendering: tenant/global/anonymous tiers + establish 409 + Flow delegates). All decisions are
// already made by the builder — this file only assembles text. Whitespace is load-bearing.
import { renderDslEndpoint } from './tpl_dsl.mjs';

/** 组装单控制器文件全文（tenant 档 21 控制器与 B2 逐字节一致；4 特例控制器＝L3 黄金门预期形变） */
export function renderControllerFile(model, ctx) {
  const { agg, ctrlName, actions, reqVos, skippedCmds, flags, valuesImports } = model;
  const extraInjection = [flags.needsParkRepo
    ? `, parkConceptViewRepository: net.imadz.metarch.application.projection.repository.ParkConceptDecisionViewRepository`
    : '', flags.needsRegisterFlow ? `, registerUserFlow: net.imadz.metarch.application.RegisterUserFlow` : '',
    flags.needsDoRFlow ? `, requestDoRFlow: net.imadz.metarch.application.RequestDoRFlow` : '',
    // S2-89 WP-A（2026-09-14·洞③）：SYSTEM_QUERIED 参数装配——手写 <Agg>ParamEnricher 注入
    flags.needsParamEnricher ? `, ${agg.charAt(0).toLowerCase()}${agg.slice(1)}ParamEnricher: net.imadz.metarch.application.${agg}ParamEnricher` : ''].join('');
  const dslInjection = flags.aggHasDsl ? `api: net.imadz.common.auth.Endpoint, ` : '';
  const controllerImports = [
    'import javax.inject.{Inject, Singleton}',
    `import net.imadz.metarch.application.aggregates.${agg}Protocol._`,
    `import net.imadz.metarch.application.aggregates.repository.${agg}Repository`,
    ...(valuesImports && valuesImports.length ? [`import net.imadz.metarch.domain.values.{${valuesImports.join(', ')}}`] : []),
    'import net.imadz.common.auth.ApiError',
    'import net.imadz.metarch.infrastructure.auth.CommandRoleMap',
    'import net.imadz.metarch.infrastructure.api.{IdGuard, InstantGuard, OkReceipt}',
    'import play.api.libs.json.{JsValue, Json}',
    'import play.api.mvc._',
    '',
    'import scala.concurrent.ExecutionContext',
    'import scala.concurrent.Future',
    'import scala.concurrent.duration._',
  ].join('\n');
  // S7 #1b（EP_GenerationTime_Code_Anchors）：控制器是**服务多命令的派生容器·无自身便签**——
  // 知识身份＝`ep.cmdNoteId`（控制器**服务的那条命令**），逐端点锚在方法上（每个 def 一行）。
  const actionTexts = actions.map((ep) => `${ep.cmdNoteId ? ctx.noteAnchor(ep.cmdNoteId, '  ') : ''}${renderDslEndpoint(ep, ctx)}`).join('\n');
  const controller = `${ctx.fp}
package controllers

${controllerImports}

/** ${ctrlName}: ${agg} 命令 API（gen_api_layer 直出·B2 DSL 形态） */
@Singleton
class ${ctrlName} @Inject() (${dslInjection}repository: ${agg}Repository${extraInjection}, val cc: ControllerComponents)(implicit ec: ExecutionContext) extends BaseController {

  override def controllerComponents: ControllerComponents = cc
  private implicit val timeout: akka.util.Timeout = akka.util.Timeout(5.seconds)${flags.aggHasEmptyBody ? `
  /** 空 body 命令通道（write[JsObject]）：任意合法 JSON 体即过——与旧 parse.json 行为等价（body 必须是合法 JSON） */
  private implicit val emptyBodyReads: play.api.libs.json.Reads[play.api.libs.json.JsObject] =
    play.api.libs.json.Reads(_ => play.api.libs.json.JsSuccess(play.api.libs.json.Json.obj()))` : ''}

${actionTexts}
}
${reqVos.length ? '\n' + reqVos.map((r) => {
  // S7 #1b：文件尾 Req/payload VO 行同样锚其承载命令（与端点锚同号——「一个知识元素多落点」由 KnCodePoint 承载）。
  const voAnchor = r.cmdNoteId ? ctx.noteAnchor(r.cmdNoteId) : '';
  return voAnchor + (r.voKind === 'format' ? `/** B5-L（样例 B·VO 归属裁定）：409 typed payload——companion＋Json.format（OFormat 写侧对称），与命令 M2 Req 相邻。 */
final case class ${r.reqName}(${r.reqFields})
object ${r.reqName} {
  implicit val format: play.api.libs.json.OFormat[${r.reqName}] = play.api.libs.json.Json.format
}` : `/** M2（EP_S2_9c 余量并入 B2）：命令载荷 VO——typed Reads 派生，缺键/类型错 → 400 PARAM_INVALID（含字段明细）。 */
final case class ${r.reqName}(${r.reqFields})
object ${r.reqName} {
  // S2-82-B3（2026-09-11）：D3 companion 嵌套 VO Reads 退役——VO 自带 companion jsonFormat
  //（ValueObjectTemplate 发射）全域自动发现。原按字母序的 8 隐式存在初始化序险：嵌套 List<VO>
  // 的 traversal 在内层 VO Reads 初始化前捕获 null（declare-command 非空 parameters NPE 实证）。
  implicit val reads: play.api.libs.json.Reads[${r.reqName}] = play.api.libs.json.Json.reads
}`);
}).join('\n\n') : ''}
`;
  return { fileName: `${ctrlName}.scala`, source: controller, skippedNote: skippedCmds.length ? `[skip ${agg}] VO-List 命令端点: ${skippedCmds.join(', ')}` : null };
}
