// tpl_dsl.mjs — 【Template】B5-L 全 DSL 端点渲染：门档位三分（tenant/global/anonymous）＋establish 409 特例＋register Flow 委托。
// tenant 档输出与 B2 逐字节一致（黄金门其余 21 控制器零漂移）；决策已全部由 builder 完成——本文件只做文本组装。

export function renderDslEndpoint(ep, ctx) {
  if (ep.flowDelegate) return renderFlowDelegateEndpoint(ep);
  if (ep.establish409) return renderEstablishEndpoint(ep, ctx);
  return renderStandardEndpoint(ep);
}

/** ask 管线（全档共用）：entityRef.ask → reply.error.fold(OkReceipt | ApiError.badRequest) */
function askBody(ep) {
  const inner = [
    ...(!ep.generatedId ? [] : [
      '        val generatedId = java.util.UUID.randomUUID().toString',
      ...(ep.multiTarget ? ['        // TODO(待裁决): 多目标 List 寻址——当前 entityRef=randomUUID 为工厂语义，操作已有实体需确认主聚合'] : []),
    ]),
    `        repository.entityRef(${ep.entityExprRaw}).ask {`,
    `          (replyTo: akka.actor.typed.ActorRef[${ep.reply}]) => ${ep.cmdName}(${ep.ctorArgsDsl}, replyTo)`,
    `        }.map { reply =>`,
    `          reply.error.fold[Either[net.imadz.common.auth.ApiError, net.imadz.metarch.infrastructure.api.OkReceipt]](`,
    `            Right(net.imadz.metarch.infrastructure.api.OkReceipt(${ep.entityExprRaw}, ${ep.dvExpr}))`,
    `          )(e => Left(net.imadz.common.auth.ApiError.badRequest(e.code, e.message)))`,
    `        }`,
  ];
  // S2-89 WP-A（2026-09-14·洞③）：SYSTEM_QUERIED 参数装配——ask 管线外层包 ParamEnricher flatMap
  //   （enrich<Cmd>(ctx, req) → q.<name>；enricher＝手写应用服务·读模型查询侧）。
  if (ep.enrich) {
    return [
      `        ${ep.enrich.serviceVar}.${ep.enrich.method}(${ep.enrich.ctxVar}, req).flatMap { q =>`,
      ...inner.map((l) => (l.trim() === '' ? l : `  ${l}`)),
      `        }`,
    ];
  }
  return inner;
}

/** guard 链（全档共用）：InstantGuard 外层→IdGuard 内层 */
function guardWrapped(ep, body) {
  let handlerBody = body;
  if (ep.instantGuard) {
    handlerBody = [
      `          InstantGuard.parse(${ep.instantGuard.pairs}) match {`,
      `            case Right(Seq(${ep.instantGuard.names})) =>`,
      ...handlerBody.map((l) => (l.trim() === '' ? l : `  ${l}`)),
      `            case Left(err) => Future.successful(Left(err))`,
      `          }`,
    ];
  }
  if (ep.idGuard) {
    handlerBody = [
      `          IdGuard.parse(${ep.idGuard.pairs}) match {`,
      `            case Right(Seq(${ep.idGuard.cids})) =>`,
      ...handlerBody.map((l) => (l.trim() === '' ? l : `  ${l}`)),
      `            case Left(err) => Future.successful(Left(err))`,
      `          }`,
    ];
  }
  return handlerBody;
}

/** 标准 DSL 端点：tenant 档（api.tenant.write＋CommandRoleMap·B2 逐字节保持）／global 档（api.global.write 空 roles·D1） */
function renderStandardEndpoint(ep) {
  const gate = ep.tier === 'tenant'
    ? {
        comment: 'tenant 档——api.tenant.write + CommandRoleMap 命令粒度角色',
        decl: `api.tenant.write[${ep.reqName}](CommandRoleMap.ofCommand("${ep.cmdName}"): _*)`,
        ctx: '(ts, req)',
      }
    : {
        comment: 'global 档——api.global.write 空 roles＝scope 兜底（D1：已登录、无租户承诺；与 Migration/Enforce 双模式行为等价）',
        decl: `api.global.write[${ep.reqName}]()`,
        ctx: '(gc, req)',
      };
  const handlerBody = guardWrapped(ep, askBody(ep));
  return `  /** B2 DSL：${ep.cmdName}（${gate.comment}） */
  def ${ep.actionName}${ep.sig}: play.api.mvc.Action[play.api.mvc.AnyContent] =
    ${gate.decl}
      .apply[net.imadz.metarch.infrastructure.api.OkReceipt] { ${gate.ctx} =>
${handlerBody.join('\n')}
      }
`;
}

/** establish 409 特例（样例 E）：park-concept 视图唯一性前置查重 → ApiError.conflict typed payload（三键顶层逐字节保持） */
function renderEstablishEndpoint(ep, ctx) {
  const tenantCond = ctx.parkConceptHasTenant ? ' && v.tenantId == ts.tenantId' : '';
  const preCheck = [
    `        parkConceptViewRepository.findAll().flatMap { all =>`,
    `          val conflict = all.find(v => v.contextId == req.contextId && v.name == req.name && v.conceptId.toString != id && v.removedAt.isEmpty${tenantCond})`,
    `          if (conflict.isDefined) {`,
    `            Future.successful(Left(net.imadz.common.auth.ApiError.conflict("CONCEPT_NAME_TAKEN",`,
    `              "(contextId,name) already established", ConceptNameTaken(conflict.get.conceptId.toString))))`,
    `          } else {`,
    ...guardWrapped(ep, askBody(ep)).map((l) => (l.trim() === '' ? l : `  ${l}`)),
    `          }`,
    `        }`,
  ];
  return `  /** B5-L：${ep.cmdName}（tenant 档——409 查重前置＋typed payload·三键顶层逐字节保持） */
  def ${ep.actionName}${ep.sig}: play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.write[${ep.reqName}](CommandRoleMap.ofCommand("${ep.cmdName}"): _*)
      .apply[net.imadz.metarch.infrastructure.api.OkReceipt] { (ts, req) =>
${preCheck.join('\n')}
      }
`;
}

/** Flow 委托（样例 C·D3）：五步编排下沉手写 RegisterUserFlow（应用服务·MANUAL 审计口径）——controller 只剩委托。
 *  serverScoped 变体（批1-B item 7）：tenant 档门保留（api.tenant.write＋CommandRoleMap），body 全空或 bodyFields
 *  声明字段（B3·EP_S2_59_S2_60 拍板#1：RequestDoR 只收 workshopId 单入口），scope/快照由 Flow 从租户 DB 装配。 */
function renderFlowDelegateEndpoint(ep) {
  if (ep.flowScoped) {
    const flowCall = ep.flowArgs ? `${ep.flowService}.${ep.flowMethod}(${ep.flowArgs})` : `${ep.flowService}.${ep.flowMethod}(id, ts)`;
    return `  /** B5-L：${ep.cmdName}（tenant 档——api.tenant.write + CommandRoleMap 命令粒度角色；服务端装配下沉手写 ${ep.flowService}·批1-B item 7） */
  def ${ep.actionName}${ep.sig}: play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.tenant.write[${ep.reqName}](CommandRoleMap.ofCommand("${ep.cmdName}"): _*)
      .apply[net.imadz.metarch.infrastructure.api.OkReceipt] { (ts, req) =>
        ${flowCall}
      }
`;
  }
  return `  /** B5-L：${ep.cmdName}（anonymous 档——api.anonymous 免登录；五步编排下沉手写 ${ep.flowService}·D3） */
  def ${ep.actionName}${ep.sig}: play.api.mvc.Action[play.api.mvc.AnyContent] =
    api.anonymous.write[${ep.reqName}]
      .apply[net.imadz.metarch.infrastructure.api.OkReceipt] { (req, body) =>
        ${ep.flowService}.${ep.flowMethod}(${ep.flowArgs})
      }
`;
}
