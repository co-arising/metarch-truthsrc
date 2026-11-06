// Presentation only: no filesystem reads, compilation, graph refresh or apply.
export function projectFormatArgs(args) {
  const rest = [];
  let format = 'json', seen = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--format') { rest.push(args[i]); continue; }
    if (seen || !['human', 'json'].includes(args[i + 1]))
      throw new Error('PROJECT_FORMAT: expected one --format human|json (default: json); duplicate, missing or unknown values are not allowed');
    seen = true;
    format = args[++i];
  }
  return { args: rest, format };
}

const text = value => typeof value === 'string' ? value : JSON.stringify(value);
const quote = value => /^[a-zA-Z0-9_./:@=-]+$/.test(value) ? value : `'${String(value).replaceAll("'", "'\\''")}'`;
const flag = (args, name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const countBy = (rows, key) => {
  const counts = new Map();
  for (const row of rows) { const name = row[key] ?? 'unknown'; counts.set(name, (counts.get(name) ?? 0) + 1); }
  return [...counts].map(([name, count]) => `${name}=${count}`).join(', ') || '0';
};
function list(lines, title, rows = [], describe = text, limit = 5) {
  if (!rows.length) return;
  lines.push(`${title} (${rows.length})`);
  for (const row of rows.slice(0, limit)) lines.push(`  ${describe(row)}`);
  if (rows.length > limit) lines.push(`  另有 ${rows.length - limit} 项未展示；用 --format json 查看完整结果。`);
}
function fields(lines, title, value) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'object') { lines.push(`${title}: ${value}`); return; }
  for (const [key, child] of Object.entries(value)) fields(lines, `${title}.${key}`, child);
}
function statusLines(lines, status) {
  lines.push(`来源: ${status.project ?? '未提供'}${status.output ? `\n输出: ${status.output}` : ''}`);
  lines.push(`inputs=${status.inputs?.state ?? 'unknown'} · evidence=${status.evidence?.state ?? 'unknown'} · synchronized=${status.synchronized ?? 'unknown'}`);
  if (status.inputs?.error) lines.push(`输入错误: ${status.inputs.error}`);
  if (status.evidence?.reason) lines.push(`证据: ${status.evidence.reason}`);
  // Errors and invalid/missing-file details are never abbreviated.
  for (const file of status.files ?? []) {
    if (['modified', 'missing'].includes(file.state)) lines.push(`代码 ${file.state}: ${file.file}`);
  }
  list(lines, '来源变化', status.inputs?.differences, row => `${row.state}: ${row.source?.file ?? row.source?.root ?? row.source?.role}`);
}
const originText = origin => `${origin.name ?? origin.identity ?? origin.kind ?? 'source'} → ${origin.file ?? '来源未解析'}#${origin.atomPointer ?? origin.pointer ?? ''} · current=${origin.current?.state ?? 'not-reported'}`;
const hasCurrentSpan = loc => loc.verification?.spanVerified === true && loc.status === 'source-verified' && loc.freshness === 'current-bytes';
function locationText(loc) {
  const precise = hasCurrentSpan(loc);
  return `${loc.file} · precision=${precise ? 'span' : loc.verification?.fileVerified ? 'file' : 'unverified'}`
    + ` · status=${loc.status ?? 'unknown'} · current=${loc.freshness ?? 'unknown'} · truth=${loc.truthFreshness ?? 'unknown'}`
    + (precise ? ` · UTF-8 bytes [${loc.span.start}, ${loc.span.end})（不是行号）` : '');
}

export function renderProjectResult(command, result, args = []) {
  const titles = {
    init: 'Counter 项目已创建', 'compile-project': '真源编译结果', 'generate-project': result.applied ? '代码生成完成' : '生成预览（未写入）',
    'status-project': '项目状态', 'query-project': '知识与代码互查', 'verify-project': '回锚验收', 'view-project': '只读知识图导出',
  };
  const lines = [titles[command] ?? command];
  const project = flag(args, '--project') ?? result.project ?? result.status?.project ?? result.sources?.find(source => source.role === 'project')?.file;
  const out = flag(args, '--out') ?? result.output ?? result.status?.output ?? 'generated';
  const selection = project ? `--project ${quote(project)} --out ${quote(out)}` : '--project truthsrc.project.json --out generated';
  const generate = `truthsrc generate-project ${selection}`;
  let next;

  if (command === 'init') {
    lines.push(`项目: ${result.root}`, `编辑真源: ${result.tree}`, `配置: ${result.project}`);
    lines.push(`validate: ${result.validation?.hard?.length ?? 'unknown'} hard · roundtrip=${result.validation?.roundtrip?.ok ?? 'unknown'}`);
    lines.push('尚未生成代码或建立知识图。');
    next = `truthsrc generate-project --project ${quote(result.project)} --out ${quote(result.root + '/generated')} --plan --format human`;
  } else if (command === 'compile-project' || command === 'generate-project') {
    lines.push(`来源: ${project ?? '未提供'}`);
    list(lines, '作者输入', result.sources?.filter(source => source.role === 'tree'), source => source.file);
    lines.push(`validate: ${result.validation?.hard?.length ?? 'unknown'} hard · roundtrip=${result.validation?.roundtrip?.ok ?? 'unknown'}`);
    if (command === 'compile-project') {
      lines.push(`严格编译产品: ${result.compilation?.result?.products?.length ?? 'unknown'} · applied=false（未写代码）`);
      next = `${generate} --plan --format human`;
    } else if (!result.applied) {
      const entries = result.plan?.entries ?? [];
      lines.push(`计划: ${entries.length} 项 · ${countBy(entries, 'kind')}`);
      list(lines, '计划路径（不展开源码内容）', entries, entry => entry.path);
      if (result.preview) {
        lines.push(`更新动作: ${countBy(result.preview.actions ?? [], 'outcome')}`);
        list(lines, '更新路径', result.preview.actions, action => `${action.outcome}: ${action.path}`);
      }
      lines.push('这是计划，不是文本 diff；不证明旧输出 current，也没有写入项目图或目标。');
      next = `${generate}${args.includes('--update') ? ' --update' : ''} --format human # 确认计划后执行`;
    } else {
      const applied = result.result ?? {};
      lines.push(`输出: ${out}`, `计划=${applied.total ?? 'unknown'} · written=${applied.written ?? 'unknown'} · identical=${applied.identical ?? 'unknown'} · kept=${applied.kept ?? 0}`);
      if (applied.ledger) lines.push(`所有权记录: ${applied.ledger}`);
      if (applied.anchors) lines.push(`回锚索引: ${applied.anchors}`);
      fields(lines, 'graph', result.graph);
      lines.push('这是本次来源捕获与生成结果；用 status-project 检查当前磁盘是否仍一致。');
      next = `truthsrc status-project ${selection} --format human`;
    }
  } else if (command === 'status-project') {
    statusLines(lines, result);
    lines.push(`代码文件: ${countBy(result.files ?? [], 'state')} · precision=${result.precision ?? 'unknown'}（文件字节，不是业务执行）`);
    next = result.synchronized ? `truthsrc verify-project ${selection} --format human`
      : `${generate} --update --plan --format human # 先检查来源/所有权错误，不强制覆盖`;
  } else if (command === 'query-project') {
    statusLines(lines, result.status ?? {});
    lines.push(`查询: state=${result.state} · precision=${result.precision}`);
    if (result.explanation) lines.push(result.explanation);
    if (result.requestedPosition?.line) lines.push(`请求源码行: ${result.requestedPosition.line}`);
    list(lines, '选中的作者声明', result.selection, originText);
    if (!(result.result ?? []).length) list(lines, '当前作者声明（不是生成证据）', result.currentSelection, row => `${row.identity} → ${row.file}#${row.atomPointer ?? row.pointer ?? ''}`);
    const rows = result.result ?? [];
    for (const row of rows.slice(0, 4)) {
      lines.push(`关联: ${row.knowledge} · sourceState=${row.sourceState}`);
      fields(lines, 'snapshot', row.snapshot);
      list(lines, '真实来源', row.origins, originText, 3);
      const locations = [...(row.locations ?? [])].sort((a, b) => Number(hasCurrentSpan(b)) - Number(hasCurrentSpan(a)));
      list(lines, '代码位置（优先已验证 span）', locations, locationText, 3);
    }
    if (rows.length > 4) lines.push(`另有 ${rows.length - 4} 组关联未展示；用 --format json 查看完整结果。`);
    list(lines, '声明引用（并非叙事直接生成代码）', result.linked, originText);
    lines.push('span 是最终字节区间的定位证据；file / candidates-only 不是唯一符号认证。来源 current 与代码 current 分开判断。');
    next = result.status?.synchronized
      ? `truthsrc view-project ${selection} --html counter-map.html --format human # 目标文件须不存在；也可按实际文件和行号反查`
      : `${generate} --update --plan --format human # 先检查过期/缺失原因；查询不会自动刷新`;
  } else if (command === 'verify-project') {
    lines.push(`来源: ${project ?? '未提供'}`, `回锚 passed=${result.passed}（不是代码/服务验收）`);
    fields(lines, 'snapshot', result.snapshot);
    fields(lines, 'graph', result.graph);
    fields(lines, 'codeDigest', result.codeDigest);
    fields(lines, 'counts', result.counts);
    fields(lines, 'coverage', result.coverage);
    // Keep every check, including reasons, rather than shortening failed checks.
    fields(lines, 'checks', result.checks);
    lines.push('精度以各项 span/file 覆盖检查为准；passed 仅适用于捕获的本次来源与代码。');
    next = result.passed ? `truthsrc view-project ${selection} --html counter-map.html --format human`
      : `先修复上述来源/回锚诊断；用 truthsrc status-project ${selection} --format human 定位，不手改证据。`;
  } else if (command === 'view-project') {
    lines.push(`来源: ${project ?? '未提供'}`, `HTML: ${result.file ?? '未返回文件路径'}`);
    fields(lines, 'snapshot', result.snapshot);
    fields(lines, 'freshness', result.freshness);
    const passed = result.verification?.passed ?? result.passed;
    if (passed !== undefined) lines.push(`回锚 passed=${passed}`);
    if (result.nodes !== undefined) lines.push(`视图: ${result.nodes} 节点 · ${result.edges} 边 · ${result.omissions ?? 0} 节点未展示`);
    lines.push('静态快照：仅反映导出时检查结果，不是 live/current 磁盘监控。图中保留 span/file、未映射及未验状态。');
    next = `在浏览器打开 ${quote(result.file ?? '<返回的 HTML 文件>')}；输入变化后重新校验并导出到新文件。`;
  }

  for (const diagnostic of [...(result.validation?.hard ?? []), ...(result.validation?.notices ?? []), ...(result.diagnostics ?? [])])
    lines.push(`诊断: ${text(diagnostic)}`);
  for (const limitation of result.limitations ?? []) lines.push(`边界: ${text(limitation)}`);
  lines.push('运行：未验证（runtimeVerified=false）；本命令不构建或执行 Scala/银行服务。');
  if (next) lines.push(`下一步: ${next}`);
  lines.push('完整机器结果：同一命令选择 --format json（默认）；生成/导出不是只读重放，请保留原回执。');
  return lines.join('\n');
}

export function renderProjectError(command, error) {
  const message = error?.message ?? String(error);
  let next = `运行 truthsrc ${command} --help 检查参数和路径。`;
  if (/already exists|destination|new.*file/i.test(message)) next = '选择不存在的自有目标；保留已有目录/文件，不删除后强行重试。';
  else if (/ownership|conflict|modified|manual|overwrite|unmarked/i.test(message)) next = '保留冲突文件，先将自己的差异保存到新的 patch；判断应改作者输入还是合法手写区，再预览 update。不手改 ledger、不强制覆盖。';
  else if (/graph|snapshot|evidence|anchor|stale/i.test(message)) next = '先用 status-project 查看来源与证据；确认所有权后预览 generate-project --update --plan。查询/验证不会重建图。';
  else if (/artifact|runtime|repository|supply/i.test(message)) next = '核对项目声明的冻结供给与本地路径；缺材料就停在此阶段，不下载或借用旧运行结果。';
  return `${command} 未完成\n[FAIL] ${message}\n下一步: ${next}\n没有成功回执；若写入阶段失败，可能保留部分新文件，请检查后重试。本命令未启动 Scala 或银行服务。`;
}
