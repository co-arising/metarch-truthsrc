// proto.mjs — proto file rendering (V4-16 inc-b), a verbatim mirror of the ProtoTemplate
// s-interpolation: the optional segments (imports/javaPackage/enums) are EMPTY STRINGS when
// absent — the two literal \n\n around each give exactly two blank lines (all-empty files:
// two blanks between package→option and option→first message; an imports line slots between
// its surrounding blanks). Messages join with one blank line; the file ends '}\n'.
import { headerOf } from '../builders/models.mjs';

export function renderProto(file, env) {
  const importsDecl = file.imports.map((i) => `import "${i}";`).join('\n');
  const javaPkgDecl = file.javaPackage ? `option java_package = "${file.javaPackage}";` : '';
  const enumsDecl = (file.enums ?? []).map(renderEnum).join('\n\n');
  const messagesDecl = file.messages.map(renderMessage).join('\n\n');
  return `${headerOf(env)}syntax = "proto3";\n\npackage ${file.packageName ?? 'net.imadz.metarch.infrastructure.proto'};\n\n${importsDecl}\n\noption java_multiple_files = true;\n${javaPkgDecl}\n\n${enumsDecl}\n\n${messagesDecl}\n`;
}

function renderEnum(e) {
  return [`enum ${e.name} {`, ...e.values.map(([n, i]) => `  ${n} = ${i};`), '}'].join('\n');
}

function renderMessage(m) {
  const lines = [`message ${m.name} {`, ...m.fields];
  if (m.oneof) {
    // `$fields\n$oneOfs` with oneOfs prefixed by '\n' — a fieldless union (every <Agg>EventPO)
    // carries TWO blanks before the oneof; a fielded message one.
    lines.push(...(m.fields.length ? [''] : ['', '']));
    lines.push(`  oneof ${m.oneof.name} {`, ...m.oneof.fields, '  }');
  } else {
    lines.push('');
  }
  lines.push('}');
  return lines.join('\n');
}
