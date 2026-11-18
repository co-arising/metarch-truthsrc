import { fqn, signature } from '../../../../../lib/classic-architecture/types.mjs';
import { scalaIdentifier } from '../../../../../lib/classic-architecture/naming.mjs';
import { fieldDoc } from '../../../../../lib/classic-architecture/knowledge.mjs';

export function renderProjectionRepositoryFields(fields) {
  return fields.map(field => `${scalaIdentifier(field.name)}: ${signature(field.typeRef)}`).join(', ');
}

/** ProjectionRepositoryTemplate.scala; multiProject is an explicit render option. */
export function renderClassicProjectionRepository(model, multiProject = false) {
  const imports = model.dependencies.map(fqn).sort()
    .filter(value => value !== '' && value !== model.selfType.packageName && !value.startsWith('java.lang'));
  imports.push(...(multiProject ? ['javax.inject.Inject'] : ['com.google.inject.ImplementedBy', 'javax.inject.Inject']));
  const importCode = [...new Set(imports)].sort().map(value => `import ${value}`).join('\n');
  const dtoClass = `case class ${model.dtoModel.name}(${renderProjectionRepositoryFields(model.dtoModel.fields)}) {\n\n}`;
  const companion = `object ${model.dtoModel.companionName} {\n${fieldDoc(model.dtoModel.fields)}${dtoClass}\n}`;
  const methods = model.methods.map(method =>
    `${fieldDoc(method.parameters, '  ')}  def ${method.name}(${renderProjectionRepositoryFields(method.parameters)}): ${signature(method.returnType)}\n  // Logic: ${method.logicIntent}`,
  ).join('\n\n');
  const annotation = multiProject ? '' : `@ImplementedBy(classOf[${model.isImplementedBy.name}])`;
  const trait = `/**
 * ${model.selfType.name}: Projection Layer Repository Interface (Read Side)
 * DTOs are defined in the companion object.
 */

${annotation}
trait ${model.selfType.name} {

  import ${model.dtoModel.companionName}._

${methods}

}
`;
  return `package ${model.selfType.packageName}\n\n${importCode}\n\n${companion}\n\n${trait}\n`;
}
