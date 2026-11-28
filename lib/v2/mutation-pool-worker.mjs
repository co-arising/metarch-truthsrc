#!/usr/bin/env node
// Asynchronous multi-worker runner for Scala domain mutation testing.
// Invoked synchronously by lib/v2/mutation-gate.mjs via spawnSync so callers keep
// a synchronous API while running scalac + ScalaTest mutants concurrently and
// streaming live progress lines to stderr.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

function spawnAsync(cmd, args, { cwd, timeoutMs = 45_000 } = {}) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let finished = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      if (finished) return;
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!finished) child.kill('SIGKILL');
      }, 1500).unref();
    }, timeoutMs);
    timer.unref();

    child.on('error', err => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status: -1, timedOut, error: err.message });
    });

    child.on('close', code => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ status: timedOut ? -1 : (code ?? 1), timedOut });
    });
  });
}

async function runSingleScalaMutant(task, { workDir, baseClasses, cp }) {
  const startedAt = Date.now();
  const mutRoot = join(workDir, `.mut-worker-${task.index}`);
  const mutClasses = join(mutRoot, 'classes');
  const mutSrcFile = join(mutRoot, 'src', task.rel);
  mkdirSync(mutClasses, { recursive: true });
  mkdirSync(dirname(mutSrcFile), { recursive: true });
  writeFileSync(mutSrcFile, task.mutatedSource, 'utf8');

  try {
    const comp = await spawnAsync(
      'scalac',
      ['-cp', `${baseClasses}${delimiter}${cp}`, '-d', mutClasses, mutSrcFile],
      { cwd: workDir, timeoutMs: 45_000 },
    );
    if (comp.status !== 0) {
      return { killed: true, reason: comp.timedOut ? 'compile-timeout' : 'compile-error', elapsedMs: Date.now() - startedAt };
    }
    const run = await spawnAsync(
      'scala',
      ['-cp', `${mutClasses}${delimiter}${baseClasses}${delimiter}${cp}`, 'org.scalatest.tools.Runner', '-oD', ...task.targetSuites.flatMap(c => ['-s', c])],
      { cwd: workDir, timeoutMs: 45_000 },
    );
    if (run.status !== 0) {
      return { killed: true, reason: run.timedOut ? 'test-timeout' : 'test-failed', elapsedMs: Date.now() - startedAt };
    }
    return {
      killed: false,
      reason: 'survived',
      elapsedMs: Date.now() - startedAt,
      survivor: {
        target: 'scala',
        file: task.rel,
        line: task.line,
        ruleId: task.ruleId,
        kind: task.kind,
        operator: task.operator,
      },
    };
  } finally {
    rmSync(mutRoot, { recursive: true, force: true });
  }
}

async function main() {
  const raw = readFileSync(0, 'utf8');
  const payload = JSON.parse(raw);
  const { workDir, baseClasses, cp, tasks = [], progress = false } = payload;
  const cpuCount = typeof availableParallelism === 'function' ? availableParallelism() : 4;
  const requested = Number.isInteger(payload.concurrency) && payload.concurrency > 0
    ? payload.concurrency
    : Math.min(4, Math.max(1, cpuCount));
  const concurrency = Math.max(1, Math.min(requested, tasks.length || 1));

  let cursor = 0;
  let completed = 0;
  let killed = 0;
  const survived = [];

  const worker = async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= tasks.length) break;
      const task = tasks[idx];
      const res = await runSingleScalaMutant(task, { workDir, baseClasses, cp });
      completed += 1;
      if (res.killed) {
        killed += 1;
      } else if (res.survivor) {
        survived.push(res.survivor);
      }
      if (progress) {
        const secs = (res.elapsedMs / 1000).toFixed(1);
        const verdict = res.killed ? `killed (${res.reason})` : 'SURVIVED';
        process.stderr.write(
          `[mutation-gate] scala ${completed}/${tasks.length} ${verdict} (${secs}s) ${task.rel}:${task.line} [${task.ruleId}]\n`,
        );
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  process.stdout.write(`${JSON.stringify({ killed, survived, concurrency })}\n`);
}

main().catch(err => {
  process.stderr.write(`[mutation-gate] worker error: ${err?.stack || err?.message || String(err)}\n`);
  process.exit(1);
});
