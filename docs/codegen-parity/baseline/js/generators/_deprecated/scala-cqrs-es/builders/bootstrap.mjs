// bootstrap.mjs — the glue bootstrap face (V4-18): per-aggregate <Agg>Bootstrap (27),
// per-projection <View>Bootstrap (43, from the projection face's deriveView — the same
// activeGroups/stream-filter derivation the def face verified), and the ApplicationBootstrap
// composite (71 traits + 43 repo injections + 70 init calls).
//
// 债④ port closure (rules_domain_gen tail section, in-place post-CodegenMain rewrite): the
// aggregate whose foldPorts/ports are non-empty (ModelCatalog) gets its init/apply/factory/
// commandHandler/eventHandler wiring closed over port members — the union face (foldPorts)
// feeds init/apply/eventHandler, the rules face (ports) feeds Behaviors.apply. The port imports
// are INSERTED (not sorted in) right before the <Agg>Aggregate import — the same anchor the
// engine's regex used — so they break the alphabetical import block exactly like live.
import { deriveView } from '../../scala-cqrs-es-projection/builders/views.mjs';

const BOOT_PKG = 'net.imadz.metarch.infrastructure.bootstrap';
const AGG_ROOT = 'net.imadz.metarch.application.aggregates';
const PROJ_ROOT = 'net.imadz.metarch.application.projection';
const decap = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const traitFq = (p) => `${p.fqPkg}.${p.trait}`;
const byTraitFq = (x, y) => (traitFq(x) < traitFq(y) ? -1 : traitFq(x) > traitFq(y) ? 1 : 0);

// union (foldPorts) / rules (ports) port faces, both trait-FQ sorted (the engine's
// [...aggPortTraits].sort() / [...rulesPortTraits].sort() registry order).
const portFacesOf = (a) => ({
  all: (a.foldPorts ?? []).slice().sort(byTraitFq),
  cmd: (a.ports ?? []).slice().sort(byTraitFq),
});
const membersOf = (pbs) => pbs.map((p) => p.member);
const argSigOf = (pbs) => pbs.map((p) => `${p.member}: ${p.trait}`).join(', ');

const AGG_IMPORT_BASE = (a) => [
  'akka.actor.typed.LogOptions',
  'akka.actor.typed.SupervisorStrategy',
  'akka.actor.typed.scaladsl.Behaviors',
  'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
  'akka.cluster.sharding.typed.scaladsl.Entity',
  'akka.cluster.sharding.typed.scaladsl.EntityTypeKey',
  'akka.persistence.typed.PersistenceId',
  'akka.persistence.typed.scaladsl.RetentionCriteria',
  'net.imadz.common.CommonTypes.Id',
  `${AGG_ROOT}.${a.name}Aggregate`,
  `${AGG_ROOT}.${a.name}Protocol`,
  `${AGG_ROOT}.behaviors.${a.name}Behaviors`,
  `net.imadz.metarch.domain.entities.${a.name}Entity`,
  `net.imadz.metarch.domain.entities.${a.name}Entity.${a.name}State`,
  `net.imadz.metarch.domain.entities.behaviors.${a.name}EventHandler`,
  `net.imadz.metarch.infrastructure.persistence.${a.name}EventAdapter`,
  `net.imadz.metarch.infrastructure.persistence.${a.name}SnapshotAdapter`,
  'org.slf4j.LoggerFactory',
  'org.slf4j.event.Level',
];
// the template's extraImports ride the sorted base and ImportDeclaration re-sorts the whole
// list — Entity/PersistenceId land as adjacent duplicates (byte-verified live shape).
const AGG_IMPORT_EXTRA = [
  'akka.actor.typed.Behavior',
  'akka.cluster.sharding.typed.scaladsl.EntityContext',
  'akka.persistence.typed.PersistenceId',
  'akka.persistence.typed.scaladsl.EventSourcedBehavior',
  'akka.cluster.sharding.typed.scaladsl.Entity',
  'scala.concurrent.duration.DurationInt',
  'net.imadz.common.Id',
];

export function aggregateBootstrapModel(a) {
  const faces = portFacesOf(a);
  const all = faces.all;
  const cmdMembers = membersOf(faces.cmd);
  const allMembers = membersOf(all);
  const aggImport = `${AGG_ROOT}.${a.name}Aggregate`;
  const sorted = [...AGG_IMPORT_BASE(a), ...AGG_IMPORT_EXTRA].sort();
  // 债④ 3b: port imports spliced immediately before the <Agg>Aggregate line AFTER the sorted
  // emission (anchor regex `^import net.imadz.metarch.application.aggregates.[A-Za-z]+Aggregate$`)
  const at = sorted.indexOf(aggImport);
  const imports = [...sorted.slice(0, at), ...all.map((p) => `${p.fqPkg}.${p.trait}`), ...sorted.slice(at)];
  return {
    kind: 'aggregate', name: `${a.name}Bootstrap`, pkg: BOOT_PKG, imports,
    aggName: `${a.name}Aggregate`,
    initName: `init${a.name}Aggregate`,
    initSig: `sharding: ClusterSharding${allMembers.length ? ', ' + argSigOf(all) : ''}`,
    factoryCall: `apply(context.entityId, selectedTag${allMembers.length ? ', ' + allMembers.join(', ') : ''})`,
    applySig: `entityId: String, tag: String${allMembers.length ? ', ' + argSigOf(all) : ''}`,
    cmdType: `${a.name}Protocol.${a.name}CommandFamily`,
    behaviorCall: `${a.name}Behaviors.apply${cmdMembers.length ? `(${cmdMembers.join(', ')})` : ''}`,
    eventHandlerCall: `${a.name}EventHandler.apply${allMembers.length ? `(${allMembers.join(', ')})` : ''}`,
    entityName: `${a.name}Entity`,
  };
}

// ProjectionBootstrap — single form when the view has one aggregate link; the multi form
// otherwise, arms over the event-bearing aggregates (primary first, the def-face order the
// projection face byte-verified — OpenSession keeps one arm after the Stage stream retires).
export function projectionBootstrapModel(v, canonical) {
  const m = deriveView(v, canonical);
  const projName = m.name;
  const activeAggs = m.activeGroups.map((g) => g.agg);
  const imports = new Set([
    'akka.actor.typed.ActorSystem',
    'akka.cluster.sharding.typed.ShardedDaemonProcessSettings',
    'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'akka.cluster.sharding.typed.scaladsl.ShardedDaemonProcess',
    'akka.projection.ProjectionBehavior',
    `${AGG_ROOT}.${m.primaryAgg}Aggregate`,
    `${PROJ_ROOT}.${projName}`,
    `${PROJ_ROOT}.repository.${projName}Repository`,
  ]);
  for (const agg of activeAggs) imports.add(`${AGG_ROOT}.${agg}Aggregate`);
  const multi = m.isMultiAgg && activeAggs.length > 0;
  const prefixSums = [];
  let acc = [];
  for (const agg of multi ? activeAggs : []) {
    acc.push(`${agg}Aggregate.tags.size`);
    prefixSums.push(acc.join(' + '));
  }
  return {
    kind: 'projection', name: `${projName}Bootstrap`, pkg: BOOT_PKG, imports: [...imports].sort(),
    projName, repoName: `${projName}Repository`,
    initName: `init${projName}Projection`,
    sourceAgg: `${m.primaryAgg}Aggregate`,
    multi,
    arms: multi ? activeAggs.map((agg, i) => ({
      agg: `${agg}Aggregate`,
      aggBase: agg,
      bound: prefixSums[i],
      localIndex: i === 0 ? 'index' : `index - (${prefixSums[i - 1]})`,
    })) : [],
    total: multi ? prefixSums[prefixSums.length - 1] : null,
  };
}

// ApplicationBootstrap — the composite. Aggregate inits (canonical order = alphabetical) then
// projection inits (43 views sorted); injected fields = classicSystem + sharding + the 43 view
// repositories (sorted by decased name); 债④ appends the union port members after the last
// repository parameter and inserts their imports before the first projection.repository import.
export function applicationBootstrapModel(canonical) {
  const aggregates = canonical.aggregates ?? [];
  const views = (canonical.projectionViews ?? []).slice().sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  const portFaces = aggregates.map((a) => ({ a, faces: portFacesOf(a) })).filter((x) => x.faces.all.length > 0);
  const allPorts = portFaces.flatMap((x) => x.faces.all);

  const initCalls = [
    ...aggregates.map((a) => {
      const members = membersOf(portFacesOf(a).all);
      return `init${a.name}Aggregate(sharding${members.length ? ', ' + members.join(', ') : ''})`;
    }),
    ...views.map((v) => `init${v.name}Projection(system, sharding, ${decap(v.name)}Repository)`),
  ];
  const repoFields = views.map((v) => `${decap(v.name)}Repository: ${v.name}Repository`).sort();
  const injectedFields = ['classicSystem: ActorSystem', 'sharding: ClusterSharding', ...repoFields];
  const injectionsTail = allPorts.length
    ? `${repoFields[repoFields.length - 1]}, ${allPorts.map((p) => `${p.member}: ${p.trait}`).join(', ')}`
    : repoFields[repoFields.length - 1];

  const base = [
    'akka.actor.ExtendedActorSystem',
    'akka.actor.typed.scaladsl.adapter',
    'akka.cluster.sharding.typed.scaladsl.ClusterSharding',
    'javax.inject.Inject',
    'javax.inject.Singleton',
    'scala.concurrent.ExecutionContext',
    ...views.map((v) => `${PROJ_ROOT}.repository.${v.name}Repository`),
  ];
  // the engine emits the sorted-distinct import block; the 债④ insert lands AFTER that, so the
  // port lines are spliced at the first projection.repository line post-sort (breaking the
  // alphabetical order exactly like the live file).
  const sorted = [...new Set([...base,
    'akka.actor.typed.scaladsl.adapter._',
    'akka.actor.ExtendedActorSystem',
    'akka.actor.ActorSystem',
    'akka.actor.typed.{ActorSystem => TypedActorSystem}',
    'javax.inject.{Inject, Singleton}',
  ])].sort();
  const anchor = sorted.findIndex((d) => d.startsWith(`${PROJ_ROOT}.repository.`));
  const finalImports = [...sorted.slice(0, anchor), ...allPorts.map((p) => `${p.fqPkg}.${p.trait}`), ...sorted.slice(anchor)];

  return {
    kind: 'application', name: 'ApplicationBootstrap', pkg: BOOT_PKG,
    imports: finalImports,
    traits: [...aggregates.map((a) => `${a.name}Bootstrap`), ...views.map((v) => `${v.name}Bootstrap`)],
    injectedFields,
    injectionsTail,
    initCalls,
  };
}
