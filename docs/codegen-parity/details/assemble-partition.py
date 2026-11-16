"""Assemble documentation fragments only; never import or execute project code.

Inputs are reviewed parity documents and their explicit correction table.
All outputs must be absent. This is not a generator or runtime acceptance gate.
"""
from pathlib import Path
from copy import deepcopy
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json

D = Path(__file__).resolve().parents[1]
GROUPS = [
    'formal-service', 'formal-domain', 'formal-application',
    'legacy-domain', 'legacy-application', 'legacy-orchestration',
    'family-domain-aggregate', 'family-readside-play', 'family-seams-saga',
    'ordinary-review', 'retired-seven',
]
OUTPUTS = [D / 'js-partition.json', D / 'details/partition-assembly-report.json']


def read_json(path):
    return json.loads(path.read_text())


def pin(path):
    data = path.read_bytes()
    return {'file': str(path.relative_to(D)), 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def unique(values):
    seen, result = set(), []
    for value in values:
        key = json.dumps(value, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            seen.add(key)
            result.append(value)
    return result


for path in OUTPUTS:
    if path.exists():
        raise RuntimeError(f'Output already exists; inspect before replacing: {path}')

catalog_path = D / 'baseline/js/docs/artifacts/catalog.json'
catalog = read_json(catalog_path)
inventory = read_json(D / 'scala-artifacts.json')
corrections = read_json(D / 'details/partition-overrides.json')
review_corrections = read_json(D / 'details/partition-review-overrides.json')
for key in ['patches', 'splitRoles']:
    corrections[key].extend(review_corrections[key])
for resolution in read_json(D / 'details/target-ownership-resolutions.json'):
    for patch in resolution['patches']:
        corrections['patches'].append({
            **patch, 'resolution': resolution['resolutionId'],
            'appendOpenDecisions': patch.get('openDecision', []) + [
                '本项只确定当前构造的唯一所有权；保留当前文件不是批准偏离Scala目标。最终布局/接口仍需对应A diff裁定，未就绪不得实施。'],
            'targetDisposition': 'retain' if resolution['resolutionId'].startswith(('TOR-01', 'TOR-03')) else 'split',
            'targetReadiness': 'ownership-resolved-final-layout-api-blocked',
        })
expected = {(p['id'], o['id']): o for p in catalog['producers'] for o in p['outputs']}
if len(expected) != sum(len(p['outputs']) for p in catalog['producers']):
    raise RuntimeError('Catalog contains repeated producer/output keys; ordinal required')

fragments, roles, coverage, producers, extras, unresolved = [], {}, [], {}, [], []
for group in GROUPS:
    file = D / 'partition' / f'{group}.json'
    text_file = file.with_suffix('.md')
    if not file.is_file() or not text_file.is_file():
        raise RuntimeError(f'Incomplete fragment: {group}')
    fragment = read_json(file)
    for gap in fragment.get('unresolvedCoverage', []):
        unresolved.append({'sourceFragment': group, **gap})
    fragment_roles = fragment['logicalOutputs']
    fragments.append({
        'group': group, 'json': pin(file), 'markdown': pin(text_file),
        'producerIds': fragment['producerIds'],
        'authoredLogicalCount': len(fragment_roles),
        'catalogContractCount': len(fragment['catalogCoverage']),
        'supplementalSources': fragment.get('extraSources', []),
        'sourceReadCoverage': fragment.get('sources', []),
        'originalAssemblyMetadata': {k: fragment[k] for k in
                                    ['physicalAssemblies', 'assemblyPlan', 'targetAssemblies', 'writerBoundary']
                                    if k in fragment},
    })
    for p in fragment['producers']:
        if p['id'] in producers:
            raise RuntimeError(f'Duplicate producer owner: {p["id"]}')
        producers[p['id']] = {**p, 'fragment': group}
    for role in fragment_roles:
        if role['id'] in roles:
            raise RuntimeError(f'Duplicate logical ID: {role["id"]}')
        item = deepcopy(role)
        item['sourceFragment'] = group
        item['sourceLogicalIds'] = [role['id']]
        item['sourceStatus'] = 'located-not-parity'
        roles[item['id']] = item
    coverage.extend({**deepcopy(row), 'sourceFragment': group} for row in fragment['catalogCoverage'])
    extras.extend({'sourceFragment': group, 'record': row} for row in fragment.get('uncataloguedOutputs', []))

if set(producers) != {p['id'] for p in catalog['producers']}:
    raise RuntimeError('Producer coverage does not match catalog exactly')
keys = [(r['producerId'], r['outputId']) for r in coverage]
if set(keys) != set(expected) or len(keys) != len(set(keys)):
    raise RuntimeError('Catalog coverage missing, duplicated, or unexpected')

alias_map = {}
changes = []
for correction in corrections['reclassify']:
    role = roles[correction['id']]
    changes.append({'resolution': correction['resolution'], 'logicalId': role['id'],
                    'before': [role['classification'], role.get('scalaArtifact')],
                    'after': [correction['classification'], correction['scalaArtifact']]})
    for field in ['classification', 'scalaArtifact', 'coverage']:
        role[field] = correction[field]
    role.setdefault('resolutions', []).append(correction['resolution'])

for correction in corrections['mergeDeclarations']:
    target = roles[correction['into']]
    target['variant'] = correction['variant']
    target['current']['conditions'] = correction['conditions']
    for old_id in correction['from']:
        old = roles.pop(old_id)
        alias_map[old_id] = target['id']
        target['sourceLogicalIds'].extend(old['sourceLogicalIds'])
        target['catalogRefs'] = unique(target['catalogRefs'] + old['catalogRefs'])
        target['current']['sources'] = unique(target['current']['sources'] + old['current']['sources'])
        target['current']['constructs'] = unique(target['current']['constructs'] + old['current']['constructs'])
        target['current']['paths'] = unique(target['current']['paths'] + old['current']['paths'])
        target['fixture']['requiredConditions'] = unique(
            target['fixture']['requiredConditions'] + old['fixture']['requiredConditions'])
        changes.append({'resolution': correction['resolution'], 'from': old_id,
                        'into': target['id'], 'action': 'merge-declaration-coverage-not-nominal-types'})
    target.setdefault('openDecisions', []).append(correction['note'])
    target['target']['placementStatus'] = 'existing-declaration-path-preserved-until-boundary-decision'
    target.setdefault('resolutions', []).append(correction['resolution'])

for correction in corrections['renameBootstrapRoles']:
    role = roles.pop(correction['from'])
    alias_map[correction['from']] = correction['into']
    role['id'] = correction['into']
    role['scalaArtifact'] = 'bootstrap'
    role['coverage'] = 'partial-local-bootstrap-without-classic-root'
    role['role'] = '本地持久化Behavior装配：PID、initial、ESB、handlers与adapters；不是ordinary root的key/tags'
    role['current']['constructs'] = [
        '共享generated头/package/object与imports由当前runtime assembler协调，不重复声明协议或命令行为。',
        'apply(persistenceId,initial,hosts[,authority])及guard；PersistenceId.ofUniqueId、EventSourcedBehavior装配。',
        'commandHandler主体归对应behavior；本项拥有EventHandler callback与event/snapshot adapter接线。',
        '不产生ordinary root的handler/key/tags；不自动添加sharding/retention/backoff。',
    ]
    role['target']['paths'] = [correction['target']]
    role['target']['assemblyOwner'] = role['sourceFragment'] + '/runtime-bootstrap-assembly'
    role['target']['constructDisposition'] = [{
        'current': 'PID/initial/ESB与handler、adapter装配；不含命令处理主体或协议声明',
        'target': correction['target'], 'action': 'split',
        'reason': 'R03：按传统Bootstrap实际职责，不按Aggregate物理对象名分类',
    }]
    role.setdefault('resolutions', []).append(correction['resolution'])
    role.setdefault('openDecisions', []).append('ordinary root在该flat profile没有单独发射；key/tags与分片语义不得由此重分类臆造。')
    roles[role['id']] = role
    changes.append({'resolution': correction['resolution'], 'from': correction['from'],
                    'into': role['id'], 'action': 'reclassify-esb-as-bootstrap'})

for correction in corrections['patches']:
    role = roles[correction['id']]
    if 'role' in correction:
        role['role'] = correction['role']
    if 'currentConstructs' in correction:
        role['current']['constructs'] = correction['currentConstructs']
    if 'appendConstructs' in correction:
        role['current']['constructs'].extend(correction['appendConstructs'])
    if 'sharedPhysicalOutput' in correction:
        role['current']['sharedPhysicalOutput'] = correction['sharedPhysicalOutput']
    if 'targetPaths' in correction:
        role['target']['paths'] = correction['targetPaths']
    if 'constructDisposition' in correction:
        role['target']['constructDisposition'] = correction['constructDisposition']
    if 'appendOpenDecisions' in correction:
        role.setdefault('openDecisions', []).extend(correction['appendOpenDecisions'])
    if 'appendFixtureConditions' in correction:
        role['fixture']['requiredConditions'].extend(correction['appendFixtureConditions'])
    if 'targetDisposition' in correction:
        role['target']['disposition'] = correction['targetDisposition']
    if 'targetReadiness' in correction:
        role['target']['readiness'] = correction['targetReadiness']
    role.setdefault('resolutions', []).append(correction['resolution'])
    changes.append({'resolution': correction['resolution'], 'logicalId': role['id'],
                    'action': 'clarify-construct-ownership'})

for correction in corrections['splitRoles']:
    origin = roles[correction['from']]
    role = deepcopy(origin)
    role['id'] = correction['newId']
    role['sourceLogicalIds'] = [correction['from']]
    for field in ['classification', 'scalaArtifact', 'coverage', 'role', 'variant']:
        role[field] = correction[field]
    role['current']['constructs'] = correction['constructs']
    role['current']['sources'] = correction['sources']
    role['target']['paths'] = correction['targetPaths']
    role['target']['assemblyOwner'] = correction['assemblyOwner']
    role['target']['disposition'] = 'split'
    role['target']['constructDisposition'] = [{
        'current': text, 'target': correction['targetPaths'][0], 'action': 'split',
        'reason': 'R05：对应具体strict fixture构造，保留ABI差异和唯一文件组装者',
    } for text in correction['constructs']]
    role['fixture'] = {'id': correction['fixtureId'],
                       'requiredConditions': correction['fixtureConditions'], 'status': 'specified-not-executed'}
    role['openDecisions'] = correction['openDecisions']
    role['resolutions'] = [correction['resolution']]
    roles[role['id']] = role
    matching = {(ref['producerId'], ref['outputId']) for ref in role['catalogRefs']}
    for row in coverage:
        if (row['producerId'], row['outputId']) in matching:
            row['logicalIds'].append(role['id'])
    changes.append({'resolution': correction['resolution'], 'from': origin['id'],
                    'into': role['id'], 'action': 'split-concrete-constructs'})


parameter_split = read_json(D / 'details/pure-parameter-split.json')
for spec in parameter_split['rows']:
    dispatch = roles[spec['from']]
    record = deepcopy(dispatch)
    record['id'] = spec['newId']
    record['classification'] = 'A'
    record['scalaArtifact'] = 'aggregate-rules-formal'
    record['coverage'] = 'parameter-record-declaration-only'
    record['role'] = '具体command参数记录的声明及字段；规则body和sum成员关系分别归属'
    record['current']['constructs'] = parameter_split['recordConstructs']
    record['current']['consumptionBoundary'] = spec['consumption']
    record['current']['sharedPhysicalOutput'] = dispatch['current']['paths'][0]
    record['target']['constructDisposition'] = [{
        'current': '具体command record声明与全部业务参数字段/类型/顺序（不含extends Command）',
        'target': dispatch['target']['paths'][0] + '::parameter-records', 'action': 'adapt',
        'reason': parameter_split['recordTargetPolicy'],
    }]
    record['openDecisions'] = [
        spec['consumption'],
        'raw CmdParams与当前Command record的名字、rule admission/ownership和接口形状未等价；不据此改名/删wrapper/插ActorRef。',
    ]
    record['resolutions'] = ['R04-revised']
    roles[record['id']] = record
    dispatch['classification'] = 'B'
    dispatch['scalaArtifact'] = None
    dispatch['coverage'] = 'sealed-command-dispatch-skeleton'
    dispatch['role'] = 'sealed Command族及extends成员关系；具体参数record字段另归部分A'
    dispatch['current']['constructs'] = parameter_split['dispatchConstructs']
    dispatch['current']['sharedPhysicalOutput'] = dispatch['current']['paths'][0]
    dispatch['target']['constructDisposition'] = [{
        'current': 'sealed Command、case class extends Command成员关系及单文件边界组装',
        'target': dispatch['target']['paths'][0] + '::dispatch-membership', 'action': 'adapt',
        'reason': '参数字段由同assembler接收A贡献；不再整record双计A/B。',
    }]
    dispatch.setdefault('resolutions', []).append('R04-revised')
    matching = {(ref['producerId'], ref['outputId']) for ref in record['catalogRefs']}
    for row in coverage:
        if (row['producerId'], row['outputId']) in matching:
            row['logicalIds'].append(record['id'])
    changes.append({'resolution': 'R04-revised', 'from': dispatch['id'],
                    'into': record['id'], 'action': 'split-parameter-record-from-dispatch'})

for role in read_json(D / 'details/additional-common-output.json')['logicalOutputs']:
    if role['id'] in roles:
        raise RuntimeError('Duplicate additional output: ' + role['id'])
    roles[role['id']] = role
    extras.append({'sourceFragment': 'integrator-addendum', 'record': {
        'logicalId': role['id'], 'paths': role['current']['paths'],
        'scope': 'public project capture, including plan; not producer-specific manifest output',
    }})


def canonical_id(value):
    return alias_map.get(value, value)


valid_artifacts = {a['id'] for a in inventory['artifacts'] + inventory['optionalExtensions']}
for role in roles.values():
    role['dependsOn'] = unique(canonical_id(value) for value in role.get('dependsOn', []))
    if role['classification'] not in ['A', 'B']:
        raise RuntimeError(f'Invalid classification: {role["id"]}')
    if role['classification'] == 'A' and role.get('scalaArtifact') not in valid_artifacts:
        raise RuntimeError(f'Unknown Scala family: {role["id"]}')
    if role['classification'] == 'B' and role.get('scalaArtifact') is not None:
        raise RuntimeError(f'B row has a Scala family: {role["id"]}')
    if not role['target'].get('paths') or not role['target'].get('assemblyOwner'):
        raise RuntimeError(f'Missing target or owner: {role["id"]}')
    if not role.get('fixture') or not role['current'].get('constructs'):
        raise RuntimeError(f'Missing fixture or content: {role["id"]}')

for row in coverage:
    row['logicalIds'] = unique(canonical_id(value) for value in row['logicalIds'])
    if not row['logicalIds'] or any(value not in roles for value in row['logicalIds']):
        raise RuntimeError(f'Broken logical mapping: {row}')
    for logical_id in row['logicalIds']:
        if not any((ref['producerId'], ref['outputId']) == (row['producerId'], row['outputId'])
                   for ref in roles[logical_id]['catalogRefs']):
            raise RuntimeError(f'Missing reverse reference: {logical_id}')
    row['classifications'] = sorted({roles[value]['classification'] for value in row['logicalIds']})
    row['catalogDefinition'] = expected[(row['producerId'], row['outputId'])]

scala_coverage = []
for artifact in inventory['artifacts'] + inventory['optionalExtensions']:
    matches = [r for r in roles.values() if r.get('scalaArtifact') == artifact['id']]
    selected = [r['id'] for r in matches if any(x['producerId'] == 'scala-cqrs-play-service' for x in r['catalogRefs'])]
    scala_coverage.append({
        'artifactId': artifact['id'],
        'family': 'classic' if 'ordinal' in artifact else 'optional-extension',
        'diff': f'diffs/{artifact["id"]}.diff.md',
        'logicalIds': [r['id'] for r in matches],
        'counterpartStatus': 'partial-counterparts-located' if matches else 'missing-counterpart',
        'bankSelectedLogicalIds': selected,
        'bankCounterpartStatus': 'partial-counterparts-located' if selected else 'missing-in-selected-formal-route',
        'implemented': False, 'parityVerified': False,
        'note': '独立diff中的missing-counterpart可能指完整classic形态缺失；中央的部分对应不解除该缺口。',
    })

source_overlaps = defaultdict(set)
for role in roles.values():
    for source in role['current'].get('sources', []):
        file = source.get('file')
        if file and (file.startswith('baseline/js/') or file.startswith('generators/') or file.startswith('lib/')):
            source_overlaps[file].add(role['id'])
shared = [{'source': file, 'logicalIds': sorted(ids), 'sourceEditOwner': 'main-integrator-until-exact-write-set-separated',
           'meaning': '共享源引用索引，不将相邻行号误当重叠写或完整同义实现'}
          for file, ids in sorted(source_overlaps.items()) if len(ids) > 1]

counts = {
    'producerCount': len(producers), 'catalogOutputContracts': len(coverage),
    'logicalOccurrences': len(roles), 'classifications': dict(Counter(r['classification'] for r in roles.values())),
    'traditionalScalaFamilies': len(inventory['artifacts']), 'optionalExtensions': len(inventory['optionalExtensions']),
    'familiesWithPartialCounterparts': sum(bool(r['logicalIds']) for r in scala_coverage),
    'missingCounterpartFamilies': [r['artifactId'] for r in scala_coverage if not r['logicalIds']],
    'additionalWriterObservations': len(extras),
    'unprovidedExternalContentSlots': len(unresolved),
}
result = {
    'schemaVersion': 'codegen-parity.js-partition/v1',
    'assembledAt': datetime.now(timezone.utc).isoformat(),
    'status': 'navigation-complete-with-explicit-content-blockers' if unresolved else 'content-partition-complete-implementation-not-approved',
    'countScope': '逻辑行包含不同producer/profile的出现位置，不是独立文件数或已实现能力数；复合output可映多个A/B角色，catalog覆盖每条一次。',
    'catalog': pin(catalog_path), 'scalaInventory': pin(D / 'scala-artifacts.json'),
    'classificationAuthority': pin(D / 'PARTITION-RESOLUTIONS.md'),
    'explicitOverrides': [pin(D / name) for name in [
        'details/partition-overrides.json', 'details/partition-review-overrides.json',
        'details/pure-parameter-split.json', 'details/additional-common-output.json',
        'details/target-ownership-resolutions.json']],
    'bankSelectionEvidence': {
        'file': 'details/bank-selection-observation.json',
        'meaning': 'bankSelectedLogicalIds指所选producer的可生成角色，不等所有输入条件已触发；实例materialization另核。',
        'knownSuppressedLogicalIds': read_json(D / 'details/bank-selection-observation.json')['knownSuppressedLogicalIds'],
        'materializationNotExhaustivelyEvaluated': True, 'runtimeExecuted': False,
    },
    'counts': counts, 'fragments': fragments,
    'producers': [producers[p['id']] for p in catalog['producers']],
    'logicalOutputs': sorted(roles.values(), key=lambda row: row['id']),
    'catalogCoverage': sorted(coverage, key=lambda row: (row['producerId'], row['outputId'])),
    'logicalIdAliases': alias_map, 'classificationCorrections': changes,
    'scalaCoverage': scala_coverage, 'additionalWriterObservations': extras,
    'sharedSourceOwnership': shared,
    'unresolvedCoverage': unresolved,
    'unresolvedPolicy': '未知任意源码输入不归入通用B桶；这里只给已读具体样本分类，同输入比较必须先捕获实际sidecar/override。仅阻断相关退休入口内容包。',
    'assemblyPolicy': {
        'profileSeparation': '不同profile必须使用各自明确目标；不能把共享相对路径视为可并发写同一outDir。',
        'sharedSourceOwner': 'main-integrator',
        'fragmentOwners': '每条target.assemblyOwner是内容组装责任；共享JS源实际写权由assignment-map统一且优先。',
        'ordinaryRootMissing': 'flat renderActors的ESB重分类为bootstrap；该profile缺ordinary root/key/tags不因重分类消失。',
        'runtimePermission': '无生产修改、运行、依赖发布或银行验收授权。',
    },
    'reviewAddenda': ['CONTENT-REVIEW-CORRECTIONS.md', 'SHARED-SEAMS.md', 'glue-dependencies.md',
                      'FIXTURE-AND-EXPECTED-CONTRACT.md'],
    'generatorModified': False, 'runtimeExecuted': False, 'freshSameInputOutputs': False,
}
report = {
    'schemaVersion': 'codegen-parity.partition-document-check/v1',
    'scope': '文档装配的ID、分类与覆盖关系机械核对；不是代码质量/行为验收',
    'counts': counts, 'catalogKeysExactlyCovered': True, 'logicalReferencesResolve': True,
    'sourceFragmentsPreserved': True, 'classificationChanges': len(changes),
    'externalContentBlockers': unresolved,
    'fullContentPartitionCertified': not unresolved,
    'generatorModified': False, 'runtimeExecuted': False,
}
for path, value in zip(OUTPUTS, [result, report]):
    with path.open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
