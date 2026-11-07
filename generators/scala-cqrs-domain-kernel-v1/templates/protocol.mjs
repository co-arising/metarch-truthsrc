import { localType } from './values.mjs';

export function protocolTemplate(protocol, out) {
  const valuesPackage = protocol.package + '.values';
  const blocked = [protocol.name, 'Command', 'Event', ...protocol.commands.map(row => row.name), ...protocol.events.map(row => row.name)];
  out.append('package ' + protocol.package + '\n\nimport ' + valuesPackage + '._\n\n');
  out.append('object ' + protocol.identifier + ' {\n  sealed trait Command\n  sealed trait Event\n', protocol.sources);
  for (const row of [...protocol.commands, ...protocol.events]) {
    out.append('\n  final case class ' + row.identifier + '(', row.sources);
    row.fields.forEach((field, index) => out.append((index ? ', ' : '') + field.identifier + ': ' + localType(field.type, [valuesPackage], blocked), field.sources));
    out.append(') extends ' + (row.role === 'command' ? 'Command' : 'Event') + '\n');
  }
  out.append('}\n');
}
