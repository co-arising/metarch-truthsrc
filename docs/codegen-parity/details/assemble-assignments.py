"""Build the documentation-only ownership map from explicit saved diff write sets.

No project module imports, code generation, runtime work, or production writes.
An existing output is refused rather than overwritten.
"""
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re

D = Path(__file__).resolve().parents[1]
J = D.parents[1]
OUTPUT = D / 'assignment-map.json'
if OUTPUT.exists():
    raise RuntimeError('Inspect existing assignment-map.json before changing it')

read_json = lambda path: json.loads(path.read_text())
inventory = read_json(D / 'scala-artifacts.json')
partition = read_json(D / 'js-partition.json')
old = read_json(D / 'details/existing-fifteen-map.json')
if old.get('status') != 'complete':
    raise RuntimeError('Original15 ownership extraction is incomplete')
by_old = {row['artifactId']: row for row in old['artifacts']}
ids = [row['id'] for row in inventory['artifacts'] + inventory['optionalExtensions']]
GROUPS = {
    'domain': ['value-object', 'domain-entity', 'event-handler', 'invariant-rule', 'domain-service'],
    'aggregate': ['aggregate-root', 'application-protocol', 'aggregate-factory', 'aggregate-behavior',
                  'command-helper', 'aggregate-rules-formal', 'aggregate-repository-port', 'aggregate-repository-implementation'],
    'serialization': ['protobuf-schema', 'proto-converter', 'event-adapter', 'snapshot-adapter'],
    'projection-query': ['projection-repository-port', 'projection-repository-implementation',
                         'projection-apply-event', 'projection', 'projection-handler', 'query-service'],
    'service-api': ['external-connector-port', 'connector-implementation', 'application-service',
                    'aggregate-state-controller', 'http-controller', 'command-endpoint-dsl', 'route-definition'],
    'saga': ['saga-participant', 'saga-definition', 'saga-trigger-protocol', 'saga-trigger-entity',
             'saga-trigger-root', 'saga-trigger-behaviors', 'saga-context', 'strict-saga-module',
             'strict-fixture-host', 'composition-invocation-host'],
    'bootstrap': ['bootstrap', 'application-bootstrap'],
}
artifact_group = {artifact: group for group, artifacts in GROUPS.items() for artifact in artifacts}
if set(artifact_group) != set(ids):
    raise RuntimeError('Artifact group coverage differs from 39+3')

shared_fields = [
    'sharedIntegrationWriteSet', 'sharedWriteSet', 'sharedWriteSetConditional', 'sharedOwnerWrites',
    'sharedDependencyPaths', 'integrationOwnedPaths', 'familyOwnedPaths',
]
claims = defaultdict(list)
artifacts = []


def paths(value, note=''):
    if isinstance(value, str):
        for match in re.finditer(r'(?:/Users/zhongdj/Workspaces/mad-polaris/metarch-truthsrc/)?'
                                 r'((?:generators|lib|src|test|docs)/[A-Za-z0-9_./*-]+)', value):
            path = match.group(1).rstrip('.,')
            if '/..' in path:
                raise RuntimeError('Parent path not allowed: ' + path)
            yield path, note or value
    elif isinstance(value, list):
        for item in value:
            yield from paths(item, note)
    elif isinstance(value, dict):
        if 'path' in value:
            yield from paths(value['path'], json.dumps(value, ensure_ascii=False))
        elif 'files' in value:
            yield from paths(value['files'], json.dumps({k: v for k, v in value.items() if k != 'files'}, ensure_ascii=False))


for artifact in ids:
    diff = D / 'diffs' / (artifact + '.diff.md')
    if not diff.is_file():
        artifacts.append({
            'artifactId': artifact, 'group': artifact_group[artifact],
            'status': 'diff-not-yet-saved-blocked',
            'blockingReason': '本次402配额中断遗留的最后缺项；不伪造占位diff，待补写后重跑本装配脚本。',
            'requiredReadSet': ['AUTHORING-CONTRACT.md', 'scala-artifacts.json', 'baseline/index.json'],
        })
        continue
    if artifact in by_old:
        detail = by_old[artifact]
        detail_path = D / 'details/existing-fifteen-map.json'
    else:
        detail_path = D / 'details' / (artifact + '.json')
        if not detail_path.is_file():
            raise RuntimeError('Missing artifact detail: ' + artifact)
        detail = next(row for row in read_json(detail_path)['diffs'] if row['artifactId'] == artifact)
    local, shared = [], []
    for field, is_shared in [('writeSet', False)] + [(name, True) for name in shared_fields]:
        for path, note in paths(detail.get(field, [])):
            if path not in (shared if is_shared else local):
                (shared if is_shared else local).append(path)
            claims[path].append({'artifactId': artifact, 'group': artifact_group[artifact],
                                 'declaredShared': is_shared, 'sourceField': field,
                                 'source': str(detail_path.relative_to(D)), 'rawNote': note})
    declared_dependencies = detail.get('dependsOn', [])
    artifacts.append({
        'artifactId': artifact, 'group': artifact_group[artifact],
        'diff': str(diff.relative_to(D)), 'diffSha256': hashlib.sha256(diff.read_bytes()).hexdigest(),
        'detail': str(detail_path.relative_to(D)),
        'status': 'specification-saved-not-approved-for-implementation',
        'declaredWritePaths': local, 'declaredSharedPaths': shared,
        'interfacePrerequisites': [name for name in declared_dependencies if name not in ids],
        'consumerCoordination': list(dict.fromkeys([name for name in declared_dependencies if name in ids]
                                                  + [name for name in detail.get('consumerCoordination', []) if isinstance(name, str)])),
        'openDecisions': detail.get('openDecisions', []),
        'requiredReadSet': [str(diff.relative_to(D)), 'CONTENT-REVIEW-CORRECTIONS.md',
                            'PARTITION-RESOLUTIONS.md', 'PARTITION-REVIEW-RESOLUTIONS.md',
                            'SHARED-SEAMS.md', 'glue-dependencies.md', 'FIXTURE-AND-EXPECTED-CONTRACT.md'],
    })

assignments = []
for path, occurrences in sorted(claims.items()):
    exists = (J / path).exists()
    groups = sorted({row['group'] for row in occurrences})
    explicit_shared = any(row['declaredShared'] for row in occurrences)
    public_entry = path.startswith(('lib/', 'src/core/')) or path.endswith('generator.json')
    shared = exists or explicit_shared or public_entry or len(groups) > 1
    owner = 'main-integrator' if shared else groups[0]
    assignments.append({
        'path': path, 'pathState': 'existing' if exists else 'proposed', 'writeOwner': owner,
        'kind': 'directory-scope' if path.endswith('/') else 'file',
        'artifactIds': sorted({row['artifactId'] for row in occurrences}),
        'claims': occurrences,
        'assignmentReason': '既有/公共/跨组热点由集成者统一切分和接线；相同源不能并发写' if shared
                            else '仅分配未存在、非公共、同组明确提出的新文件；接口批准后可并发',
        'implementationAuthorized': False,
    })

b_outputs = []
for row in partition['logicalOutputs']:
    if row['classification'] != 'B':
        continue
    b_outputs.append({
        'logicalId': row['id'], 'sourceFragment': row['sourceFragment'],
        'partitionPointer': '/logicalOutputs/' + str(partition['logicalOutputs'].index(row)),
        'outputAssemblyOwner': row['target']['assemblyOwner'],
        'sourceIntegrationOwner': 'main-integrator',
        'targetPaths': row['target']['paths'], 'fixture': row['fixture'],
        'openDecisions': row.get('openDecisions', []),
        'status': 'target-specification-not-implementation-authorized',
        'rule': '这是逻辑输出分配；正式源码writeSet未从source引用擅自推定。修改共享renderer须集成者先切分并明确授权。',
    })

result = {
    'schemaVersion': 'codegen-parity.assignment-map/v1',
    'assembledAt': datetime.now(timezone.utc).isoformat(),
    'status': 'ownership-and-coordination-map-implementation-blocked',
    'scope': '39+3制品及全部B逻辑出现位置的未来文档分工；不批准任何生产代码变更',
    'counts': {'artifacts': len(artifacts), 'distinctWritePaths': len(assignments), 'bLogicalOccurrences': len(b_outputs),
               'integratorPaths': sum(row['writeOwner'] == 'main-integrator' for row in assignments)},
    'concurrencyPolicy': {
        'precondition': '只在相应diff/fixture/实际供给/接口已审定并取得实施授权之后执行',
        'groupOrder': ['interface-contracts', 'shared-hotspot-split', 'independent-new-mbt-files', 'registry-and-caller-integration', 'scoped-cli-and-runtime-observation'],
        'existingSourceWrites': '统一main-integrator；之后可有明确转交，但不靠此文档自动扩权',
        'independentWrites': '组内串行，共享variant同owner；不同组仅不相交的新MBT文件可并发',
        'dependencyMeaning': 'artifact互相引用代表协同接口，不是循环blockedBy；phase prerequisite与consumerCoordination分开',
        'baseline': '原852基线/原15稿/旧验收回执不改；新稿勘误单列',
        'notAllowed': ['worktree', 'stash/reset/clean', 'shared app writes', 'generated/current hand edits',
                       'runtime publication', 'commit/push/release', 'automatic workshop37/38'],
    },
    'groups': [{'id': group, 'artifactIds': values,
                'allowedNewPathsAfterApproval': [row['path'] for row in assignments if row['writeOwner'] == group]}
               for group, values in GROUPS.items()],
    'artifacts': artifacts, 'sourceAssignments': assignments, 'bOutputAssignments': b_outputs,
    'sharedInterfaces': ['shared-layout-types', 'shared-expression-rendering', 'shared-entry-writer',
                         'shared-source-mappings', 'explicit-reply-contract', 'selected-runtime-abi', 'fixture-adapters'],
    'protectedBankBoundary': '作者规则/具名绑定/独立oracle留银行；手写实现/测试不因Agent作者身份成为模板覆盖区。业务设计建议尚未改入作者树。',
    'generatorModified': False, 'runtimeExecuted': False, 'implementationAuthorized': False,
}
with OUTPUT.open('x') as stream:
    json.dump(result, stream, ensure_ascii=False, indent=2)
    stream.write('\n')
print(json.dumps({'file': str(OUTPUT), 'counts': result['counts'], 'status': result['status']}, ensure_ascii=False, indent=2))
