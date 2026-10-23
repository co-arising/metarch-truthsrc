import hashlib
import json
import pathlib
import selectors
import shutil
import subprocess
import time

repo = pathlib.Path(__file__).resolve().parents[2]
evidence = pathlib.Path(__file__).resolve().parent / 'observed'
evidence.mkdir(exist_ok=False)
node = shutil.which('node')
cli = str(repo / 'bin/truthsrc.js')
captures = []

def run(label, args, expected=0):
    command = [node, cli] + args
    result = subprocess.run(command, cwd=repo, text=True, capture_output=True, timeout=45)
    record = {'label': label, 'command': command, 'exit': result.returncode,
              'stdout': result.stdout, 'stderr': result.stderr}
    captures.append(record)
    (evidence / 'commands.json').write_text(json.dumps(captures, indent=2))
    print(label, 'exit', result.returncode, result.stdout.strip(), result.stderr.strip(), flush=True)
    assert result.returncode == expected, record
    return result

def fingerprint(file):
    return 'sha256:' + hashlib.sha256(file.read_bytes()).hexdigest()

canonical = evidence / 'compiled.json'
run('tree compilation', ['compile', '--tree', str(repo / 'example/saga-money-transfer/tree'), '--out', str(canonical)])
producer = evidence / 'fixture-generator'
producer.mkdir()
(producer / 'generator.json').write_text(json.dumps({
    'name': 's8-public-fixture', 'inputSchema': 'truthsrc/v0.3', 'products': ['template'],
    'artifactKinds': ['fixture'], 'output': {'language': 'fixture-contract-only'}}))
(producer / 'generate.mjs').write_text('''export function generate({canonical, options}) {
  const knowledgeId = `saga:${canonical.sagas[0].id}`;
  const entries = ['one', 'two'].map(name => ({
    path: `fixture/${name}.txt`, kind: 'fixture', families: [], knowledgeId,
    content: `Fixture only, not runnable Saga code: ${knowledgeId} / ${name}\\n`
  }));
  if (options.collision === 'yes') entries.push({...entries[0], path: 'fixture/ONE.txt'});
  return entries;
}
''')
out = evidence / 'output'
args = ['generate', '--in', str(canonical), '--generator', str(producer), '--out', str(out)]
run('plan', args + ['--plan'])
assert not out.exists()
run('first apply', args)
repeat = run('repeat apply', args)
assert '0 written' in repeat.stdout and '2 identical' in repeat.stdout
prior = {str(p.relative_to(out)): p.read_bytes() for p in out.rglob('*') if p.is_file()}
run('case alias probe', args + ['--option', 'collision=yes'], expected=2)
assert {str(p.relative_to(out)): p.read_bytes() for p in out.rglob('*') if p.is_file()} == prior

mcp = subprocess.Popen([node, cli, 'mcp'], cwd=repo, stdin=subprocess.PIPE,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(mcp.stdout, selectors.EVENT_READ)
rpc = []
def request(identifier, method, params):
    message = {'jsonrpc': '2.0', 'id': identifier, 'method': method, 'params': params}
    mcp.stdin.write(json.dumps(message) + '\n')
    mcp.stdin.flush()
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if not selector.select(timeout=1):
            continue
        line = mcp.stdout.readline()
        if not line:
            raise RuntimeError('MCP closed before response')
        response = json.loads(line)
        rpc.append({'request': message, 'response': response})
        (evidence / 'rpc.json').write_text(json.dumps(rpc, indent=2))
        if response.get('id') == identifier:
            assert 'error' not in response, response
            return response
    raise TimeoutError('MCP response')

try:
    request(1, 'initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
                            'clientInfo': {'name': 's8-observer', 'version': '1'}})
    listed = request(2, 'tools/list', {})
    assert any(tool['name'] == 'anchors' for tool in listed['result']['tools'])
    query = {'name': 'anchors', 'arguments': {'canonical': str(canonical), 'kind': 'saga',
        'id': 'money-transfer', 'indexFile': str(out / 'anchors.json'), 'repoRoots': {str(out): str(out)}}}
    first = request(3, 'tools/call', query)
    assert not first['result'].get('isError'), first
    first_text = json.loads(first['result']['content'][0]['text'])
    print('MCP initial anchors', json.dumps(first_text), flush=True)
    locations = first_text['result']
    if isinstance(locations, dict):
        locations = locations.get('locations', locations.get('anchors'))
    assert isinstance(locations, list) and len(locations) == 2, first_text
    assert all(item['status'] == 'source-verified' and item['verification']['fileVerified']
               and not item['verification']['symbolVerified'] for item in locations), locations
    for item in locations:
        assert item['fingerprint'] == fingerprint(out / item['file'])
    changed = out / 'fixture/one.txt'
    changed.write_text('Human changed fixture bytes; not Saga implementation.\n')
    second = request(4, 'tools/call', query)
    assert not second['result'].get('isError'), second
    second_text = json.loads(second['result']['content'][0]['text'])
    print('MCP after source edit', json.dumps(second_text), flush=True)
    locations = second_text['result']
    if isinstance(locations, dict):
        locations = locations.get('locations', locations.get('anchors'))
    assert next(item for item in locations if item['file'] == 'fixture/one.txt')['status'] == 'stale'
    assert next(item for item in locations if item['file'] == 'fixture/two.txt')['status'] == 'source-verified'
finally:
    selector.close()
    if mcp.stdin:
        mcp.stdin.close()
    try:
        mcp.wait(timeout=5)
    except subprocess.TimeoutExpired:
        mcp.terminate()
        mcp.wait(timeout=5)
    (evidence / 'mcp-stderr.log').write_text(mcp.stderr.read())

(evidence / 'result.json').write_text(json.dumps({'verdict': 'PASS', 'scope': 'public CLI/core file-level fixture anchors only',
    'notVerified': ['Saga runnable generation', 'Scala symbols', 'Fab runtime', 'cross-JVM business receipts'],
    'commands': len(captures), 'mcpReaped': mcp.returncode is not None}, indent=2))
print('PASS: public fixture CLI -> multi-file index -> MCP freshness, no runnable claim', flush=True)
