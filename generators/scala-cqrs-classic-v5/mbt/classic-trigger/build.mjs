import { FieldDef } from '../../../scala-cqrs-domain/models/domain-entity.mjs';
import { collectDependencies, shouldImport, typeRef } from '../../../../lib/classic-architecture/types.mjs';
import {
  SagaTriggerCommandModel, SagaTriggerProtocolModel, SagaTriggerEntityModel,
  SagaTriggerRootModel, SagaTriggerBehaviorsModel,
} from './models.mjs';

const coordinatorPkg = 'net.imadz.infra.saga';

// The frozen builder uses Set[TypeRef], NOT collectAllDependencies. Reuse the
// central structural collector, then retain only its explicitly supplied roots.
// Recursive parameters remain available to the assembly's file association;
// admitting them into raw imports here would silently repair the Scala source.
function directDependencies(refs, pkg) {
  const roots = new Set(refs.map(ref => JSON.stringify(ref)));
  return collectDependencies(refs)
    .filter(ref => roots.has(JSON.stringify(ref)))
    .filter(ref => shouldImport(ref, pkg));
}

export function buildClassicSagaTriggerProtocol(meta, ctx) {
  const pkg = ctx.layout.application.services.transactor.root;
  // Scala String.replace removes every occurrence, unlike getSagaBaseName.
  const baseName = meta.name.replaceAll('SagaTransactor', '');
  const commands = meta.commandFamily.commands;
  const triggerNames = new Set(commands.map(command => command.name)
    .filter(name => !name.startsWith('Update')));
  const triggers = commands.filter(command => triggerNames.has(command.name))
    .map(command => SagaTriggerCommandModel(
      command.name,
      command.parameters.map(parameter => FieldDef(parameter.name, ctx.typeResolver.resolve(parameter.parameterType))),
      [...command.parameters.map(parameter => parameter.name), 'replyTo'],
    ));
  const confirmation = typeRef(`${baseName}SagaConfirmation`, pkg);
  const statusName = commands.map(command => command.name).find(name => name.startsWith('Update'));
  const statusCmd = typeRef(statusName ?? `Update${baseName}SagaStatus`, pkg);
  const dependencies = directDependencies([
    ...triggers.flatMap(command => command.params.map(parameter => parameter.typeRef)),
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'TransactionResult', packagePath: coordinatorPkg, typeParameters: [] }),
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'TracingStep', packagePath: coordinatorPkg, typeParameters: [] }),
    ctx.knownFrameworkTypes.ActorRef,
    ctx.knownFrameworkTypes.CborSerializable,
  ], pkg);

  // Do not substitute sagaProtocol(meta): its original DSL overload produces
  // <Base>Protocol, not this builder's explicit <Base>SagaTransactorProtocol.
  return SagaTriggerProtocolModel(
    typeRef(`${baseName}SagaTransactorProtocol`, pkg), triggers, confirmation, statusCmd,
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'TransactionResult', packagePath: coordinatorPkg, typeParameters: [] }),
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'TracingStep', packagePath: coordinatorPkg, typeParameters: [] }),
    dependencies,
  );
}

export function buildClassicSagaTriggerEntity(meta, ctx) {
  const pkg = ctx.layout.domain.entities.root;
  const baseName = meta.name.replaceAll('SagaTransactor', '');
  if (meta.args === null) throw new Error(`Saga '${meta.name}' lacks args (v3)`);
  const argsFields = meta.args.fields.map(field => FieldDef(field.name, ctx.typeResolver.resolve(field.fieldType)));
  const stateType = typeRef(`${baseName}TransactionState`, pkg);
  const statusType = typeRef(`${baseName}Status`, pkg);
  const dependencies = directDependencies([
    ...argsFields.map(field => field.typeRef),
    ctx.knownFrameworkTypes.CborSerializable,
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'Id', packagePath: 'net.imadz.common', typeParameters: [] }),
  ], pkg);

  // Package-level stateType is deliberate: the template declares it nested,
  // and Behaviors handles that raw mismatch with its original wildcard import.
  return SagaTriggerEntityModel(
    typeRef(`${baseName}TransactionEntity`, pkg), stateType, argsFields, statusType, dependencies,
  );
}

export function buildClassicSagaTriggerRoot(meta, ctx) {
  const pkg = ctx.layout.application.services.transactor.root;
  const baseName = meta.name.replaceAll('SagaTransactor', '');
  const protocolType = typeRef(`${baseName}SagaTransactorProtocol`, pkg);
  const behaviorsType = typeRef(`${baseName}SagaTransactorBehaviors`, ctx.layout.application.services.transactor.behaviors);
  const contextType = ctx.typeResolver.sagaContext(meta.context === null ? meta.name : meta.context.name);
  const dependencies = directDependencies([protocolType, behaviorsType, contextType], pkg);

  return SagaTriggerRootModel(
    typeRef(meta.name, pkg), `${baseName}Transaction`, baseName.toLowerCase(),
    typeRef(`${baseName}SagaCommand`, pkg),
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'SagaTransactionCoordinator', packagePath: coordinatorPkg, typeParameters: [] }),
    contextType, behaviorsType, dependencies,
  );
}

function moneyFieldExpr(fieldName, parameterName) {
  if (fieldName === 'amount') return `${parameterName}.amount`;
  if (fieldName === 'currency') return `${parameterName}.currency.getCurrencyCode`;
  return null;
}

function matchedArgsFieldExpr(field, parameterType) {
  if (parameterType.name === 'Money') return moneyFieldExpr(field.name, field.name) ?? field.name;
  if (field.typeRef.name === 'String' && parameterType.name === 'Id') return `${field.name}.toString`;
  return field.name;
}

function argsFieldExpr(field, paramByName, moneyParam) {
  const parameterType = paramByName.get(field.name);
  if (parameterType !== undefined) return matchedArgsFieldExpr(field, parameterType);
  if (moneyParam !== null) return moneyFieldExpr(field.name, moneyParam) ?? field.name;
  // Original fallback may be an unbound name. No invented mapping/alias.
  return field.name;
}

// SagaTriggerBuilder.argsCtorExpr: first non-Update command only; duplicate
// parameter names use the last Map entry, while Money discovery uses the first.
function argsCtorExpr(argsFields, triggers) {
  const params = triggers[0]?.params ?? [];
  const paramByName = new Map(params.map(parameter => [parameter.name, parameter.typeRef]));
  const moneyParam = params.find(parameter => parameter.typeRef.name === 'Money')?.name ?? null;
  return argsFields.map(field => argsFieldExpr(field, paramByName, moneyParam)).join(', ');
}

export function buildClassicSagaTriggerBehaviors(meta, ctx) {
  const pkg = ctx.layout.application.services.transactor.behaviors;
  const baseName = meta.name.replaceAll('SagaTransactor', '');
  const rootPkg = ctx.layout.application.services.transactor.root;
  if (meta.args === null) throw new Error(`Saga '${meta.name}' lacks args (v3)`);
  const argsFields = meta.args.fields.map(field => FieldDef(field.name, ctx.typeResolver.resolve(field.fieldType)));
  const protocol = buildClassicSagaTriggerProtocol(meta, ctx);
  const entity = buildClassicSagaTriggerEntity(meta, ctx);
  const contextType = ctx.typeResolver.sagaContext(meta.context === null ? meta.name : meta.context.name);
  const definitionType = typeRef(`${baseName}SagaDefinition`, rootPkg);
  const dependencies = directDependencies([
    typeRef(`${baseName}SagaTransactorProtocol`, rootPkg),
    entity.selfType,
    entity.stateType,
    definitionType,
    protocol.confirmationType,
    contextType,
    protocol.transactionResultType,
    ctx.knownFrameworkTypes.EntityRef,
    ctx.knownFrameworkTypes.ActorRef,
    ...protocol.triggerCommands.flatMap(command => command.params.map(parameter => parameter.typeRef)),
  ], pkg);

  return SagaTriggerBehaviorsModel(
    typeRef(`${baseName}SagaTransactorBehaviors`, pkg), `${baseName}Transaction`,
    entity.stateType, typeRef(`${baseName}TransactionEvent`, ctx.layout.domain.entities.root),
    typeRef(`${baseName}SagaCommand`, rootPkg), definitionType, typeRef(meta.args.name, rootPkg),
    argsFields, protocol.triggerCommands, argsCtorExpr(argsFields, protocol.triggerCommands),
    protocol.confirmationType, protocol.statusCommandType,
    ctx.typeResolver.resolve({ _type: 'CustomType', typeName: 'SagaTransactionCoordinator', packagePath: coordinatorPkg, typeParameters: [] }),
    contextType, protocol.transactionResultType, dependencies,
  );
}
