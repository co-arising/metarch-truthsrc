import { localType } from './values.mjs';

export function computationsTemplate(computations, out) {
  const valuesPackage = computations.package.replace(/\.ports$/, '.values');
  out.append('package ' + computations.package + '\n\nimport ' + valuesPackage + '._\n\n');
  out.append('trait ' + computations.identifier + ' {\n', computations.sources);
  for (const method of computations.methods) {
    out.append('  def ' + method.identifier + '(', method.sources);
    method.parameters.forEach((field, index) => out.append((index ? ', ' : '') + field.identifier + ': ' + localType(field.type, [valuesPackage], [computations.name]), field.sources));
    out.append('): ' + localType(method.outputType, [valuesPackage], [computations.name]) + '\n', method.sources);
  }
  out.append('}\n');
}

export function paramsTemplate(aggregate, out) {
  const params = aggregate.ruleParams;
  const imports = [aggregate.protocol, aggregate.state, aggregate.computations];
  const nested = params.params.map(row => row.name);
  const blocked = imports.filter(row => imports.filter(other => other.name === row.name).length > 1 || row.name === params.name || nested.includes(row.name)).map(row => row.name);
  out.append('package ' + params.package + '\n\n');
  for (const row of imports) if (!blocked.includes(row.name)) out.append('import ' + row.fqn + '\n');
  out.append('\n');
  out.append('object ' + params.identifier + ' {\n', params.sources);
  params.params.forEach((row, index) => {
    out.append((index ? '\n' : '') + '  final case class ' + row.identifier + '(\n', row.sources);
    row.fields.forEach((field, i) => {
      const spelling = field.name === 'command' ? (blocked.includes(aggregate.protocol.name) ? aggregate.protocol.fqn : aggregate.protocol.identifier) + '.' + field.type.identifier :
        blocked.includes(field.type.name) ? field.type.fqn : field.type.identifier;
      out.append('    ' + field.identifier + ': ' + spelling + (i + 1 < row.fields.length ? ',' : '') + '\n', field.sources);
    });
    out.append('  )\n');
  });
  out.append('}\n');
}
