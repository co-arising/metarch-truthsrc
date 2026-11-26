// SMT-LIB 2 solver bridge (Z3 default, cvc5 compatible) + S-Expression model & unsat-core parser.
import { spawnSync } from 'node:child_process';

function tokenizeSexp(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/u.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === ';') {
      while (i < input.length && input[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let val = '';
      while (j < input.length) {
        if (input[j] === '"' && input[j + 1] === '"') {
          val += '"';
          j += 2;
        } else if (input[j] === '"') {
          break;
        } else {
          val += input[j];
          j += 1;
        }
      }
      tokens.push(val);
      i = j + 1;
      continue;
    }
    if (ch === '|') {
      const end = input.indexOf('|', i + 1);
      tokens.push(end > i ? input.slice(i + 1, end) : input.slice(i + 1));
      i = end > i ? end + 1 : input.length;
      continue;
    }
    let j = i;
    while (j < input.length && !/[\s()]/u.test(input[j])) j += 1;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

function parseSexpList(tokens) {
  let pos = 0;
  function readOne() {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos];
    pos += 1;
    if (tok === '(') {
      const list = [];
      while (pos < tokens.length && tokens[pos] !== ')') {
        list.push(readOne());
      }
      if (tokens[pos] === ')') pos += 1;
      return list;
    }
    return tok;
  }
  const out = [];
  while (pos < tokens.length) {
    out.push(readOne());
  }
  return out;
}

function evalScalarSexp(node) {
  if (typeof node === 'string') {
    if (node === 'true') return true;
    if (node === 'false') return false;
    if (/^\d+$/u.test(node)) return BigInt(node);
    return node;
  }
  if (Array.isArray(node)) {
    if (node.length === 2 && node[0] === '-' && typeof node[1] === 'string' && /^\d+$/u.test(node[1])) {
      return -BigInt(node[1]);
    }
    return JSON.stringify(node);
  }
  return node;
}

export function parseSolverOutput(stdout) {
  const sexps = parseSexpList(tokenizeSexp(stdout));
  let status = 'unknown';
  const model = {};
  let unsatCore = [];

  for (const item of sexps) {
    if (item === 'sat' || item === 'unsat' || item === 'unknown') {
      status = item;
      continue;
    }
    if (Array.isArray(item)) {
      if (item[0] === 'error') continue;
      // Model block: ( (define-fun ...) ... ) or (model (define-fun ...) ...)
      const entries = item[0] === 'model' ? item.slice(1) : item;
      if (entries.length > 0 && Array.isArray(entries[0]) && entries[0][0] === 'define-fun') {
        for (const def of entries) {
          if (Array.isArray(def) && def[0] === 'define-fun' && typeof def[1] === 'string') {
            const params = def[2];
            if (Array.isArray(params) && params.length === 0) {
              model[def[1]] = evalScalarSexp(def[4]);
            }
          }
        }
        continue;
      }
      // Unsat core: (AX_1 RULE_2)
      if (item.every(x => typeof x === 'string')) {
        unsatCore = item;
      }
    }
  }
  return { status, model, unsatCore };
}

export function getSolverInstallGuidance(solver = 'z3') {
  if (solver === 'cvc5') {
    return 'Install cvc5 (macOS: brew install cvc5/cvc5/cvc5; Linux/Windows: https://github.com/cvc5/cvc5/releases) or use default --solver z3.';
  }
  return 'Install Z3 SMT solver (macOS: brew install z3; Ubuntu/Debian: sudo apt-get install -y z3; Windows: winget install Microsoft.Z3 or choco install z3) and ensure `z3` is on PATH.';
}

export function checkSolverAvailable(solver = 'z3') {
  const proc = spawnSync(solver, ['--version'], { encoding: 'utf8', timeout: 5_000 });
  if (proc.error || proc.status !== 0) {
    return {
      available: false,
      solver,
      version: null,
      error: proc.error ? proc.error.message : (proc.stderr || proc.stdout || `exit ${proc.status}`).trim(),
      guidance: getSolverInstallGuidance(solver),
    };
  }
  return {
    available: true,
    solver,
    version: (proc.stdout || proc.stderr || '').trim().split('\n')[0] || 'unknown',
    guidance: null,
  };
}

export function runSmtJob(smt2, { solver = 'z3', timeoutSec = 5 } = {}) {
  const args = solver === 'cvc5'
    ? ['--lang', 'smt2', `--tlimit=${Math.max(1, timeoutSec) * 1000}`]
    : ['-in', '-smt2', `-T:${Math.max(1, timeoutSec)}`];

  const proc = spawnSync(solver, args, {
    input: smt2,
    encoding: 'utf8',
    timeout: (Math.max(1, timeoutSec) + 2) * 1000,
    maxBuffer: 8 * 1024 * 1024,
  });

  if (proc.error) {
    const missing = proc.error.code === 'ENOENT';
    return {
      status: 'error',
      missingBinary: missing,
      error: missing
        ? `${solver} binary not found on PATH. ${getSolverInstallGuidance(solver)}`
        : `${solver} invocation failed: ${proc.error.message}`,
      model: {},
      unsatCore: [],
      rawStdout: proc.stdout ?? '',
      rawStderr: proc.stderr ?? '',
    };
  }

  const parsed = parseSolverOutput(proc.stdout ?? '');
  if (proc.status !== 0 && parsed.status === 'unknown' && /timeout/iu.test(proc.stdout ?? '')) {
    return { ...parsed, status: 'timeout', rawStdout: proc.stdout ?? '', rawStderr: proc.stderr ?? '' };
  }
  return { ...parsed, rawStdout: proc.stdout ?? '', rawStderr: proc.stderr ?? '' };
}
