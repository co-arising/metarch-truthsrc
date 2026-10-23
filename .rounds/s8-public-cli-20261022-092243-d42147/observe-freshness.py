import hashlib
import json
import pathlib
import selectors
import shutil
import subprocess
import time

base = pathlib.Path(__file__).resolve().parent
repo = base.parents[1]
evidence = base / 'observed'
out = evidence / 'output'
assert out.is_dir() and (evidence / 'compiled.json').is_file()
records = []
p = subprocess.Popen([shutil.which('node'), str(repo / 'bin/truthsrc.js'), 'mcp'], cwd=repo,
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
selector = selectors.DefaultSelector()
selector.register(p.stdout, selectors.EVENT_READ)
def call(identifier, method, params):
    message = {'jsonrpc': '2.0', 'id': identifier, 'method': method, 'params': params}
    p.stdin.write(json.dumps(message) + '\n')
    p.stdin.flush()
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if not selector.select(timeout=1):
            continue
        line = p.stdout.readline()
        if not line:
            raise RuntimeError('MCP closed')
        response = json.loads(line)
        records.append({'request': message, 'response': response})
        (evidence / 'freshness-rpc.json').write_text(json.dumps(records, indent=2))
        if response.get('id') == identifier:
            assert 'error' not in response, response
            return response
    raise TimeoutError('MCP response')
try:
    call(1, 'initialize', {'protocolVersion': '2024-11-05', 'capabilities': {},
        'clientInfo': {'name': 's8-freshness-observer', 'version': '1'}})
    query = {'name': 'anchors', 'arguments': {'canonical': str(evidence / 'compiled.json'),
        'kind': 'saga', 'id': 'money-transfer', 'indexFile': str(out / 'anchors.json'),
        'repoRoots': {str(out): str(out)}}}
    def observe(identifier):
        response = call(identifier, 'tools/call', query)
        assert not response['result'].get('isError'), response
        envelope = json.loads(response['result']['content'][0]['text'])
        print(json.dumps(envelope), flush=True)
        return envelope['result']['result']
    before = observe(2)
    assert len(before) == 2
    for location in before:
        assert location['status'] == 'source-verified'
        assert location['verification']['level'] == 'file' and not location['verification']['symbolVerified']
        assert location['fingerprint'] == 'sha256:' + hashlib.sha256((out / location['file']).read_bytes()).hexdigest()
    prior_index = (out / 'anchors.json').read_bytes()
    (out / 'fixture/one.txt').write_text('Human edited the isolated fixture, not runnable Saga source.\n')
    after = observe(3)
    assert next(item for item in after if item['file'] == 'fixture/one.txt')['status'] == 'stale'
    assert next(item for item in after if item['file'] == 'fixture/two.txt')['status'] == 'source-verified'
    assert (out / 'anchors.json').read_bytes() == prior_index
finally:
    selector.close()
    p.stdin.close()
    try:
        p.wait(timeout=5)
    except subprocess.TimeoutExpired:
        p.terminate()
        p.wait(timeout=5)
    (evidence / 'freshness-mcp-stderr.log').write_text(p.stderr.read())
(evidence / 'result.json').write_text(json.dumps({'verdict': 'PASS',
    'scope': 'public generation CLI and MCP fixture file-byte anchors/freshness only',
    'driverCorrection': 'MCP standard envelope contains result.result locations; prior observation retained',
    'notVerified': ['runnable Saga code', 'production symbol parsing', 'Fab runtime', 'cross-JVM receipts'],
    'mcpReaped': p.returncode is not None}, indent=2))
print('PASS public fixture file anchors and source-edit stale probe; no runnable claim', flush=True)
