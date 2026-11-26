import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileSagas } from '../lib/saga/compile.mjs';
import { compileExecution } from '../lib/execution/compile.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_SAGA_CAPABILITIES = [
  'durable-commit-decision',
  'durable-abort-decision',
  'typed-nonterminal-unknown',
  'safe-status-reattach',
  'receipt-reconciliation',
  'participant-idempotency-query',
  'pinned-definition-codec',
  'manual-evidence-authorization',
  'cancel-before-prepare-fencing',
  'durable-manifest',
];

const RECEIPT_IDENTITY = [
  'txid',
  'definition-version',
  'args-digest',
  'participant',
  'resource',
  'step',
  'phase',
];

const OPERATION_IDENTITY = [
  'txid',
  'definition-version',
  'participant',
  'resource',
  'step',
  'phase',
];

function makePhaseBinding(port, commandName, eventName, outputs = []) {
  return {
    kind: 'command',
    port,
    commandMapper: `wallet.mappers.${commandName}`,
    confirmation: {
      kind: 'durable-receipt',
      eventRef: { aggregate: 'Wallet', name: eventName },
      mapper: `wallet.mappers.${eventName}`,
      outputs,
    },
    query: {
      mapper: `wallet.queries.${commandName}`,
      mode: 'read-only',
      identity: RECEIPT_IDENTITY,
      resultKinds: ['confirmed', 'not-executed', 'unknown'],
    },
    receipt: {
      mapper: `wallet.receipts.${commandName}`,
      version: 'r1',
      durable: true,
      identity: RECEIPT_IDENTITY,
      payloadCompatibility: 'exact',
      evidence: 'reservation-decision-effect-reconciliation',
    },
    idempotency: {
      mapper: `wallet.idempotency.${commandName}`,
      identity: OPERATION_IDENTITY,
      payloadConflict: 'reject',
      attemptIdentity: 'excluded',
    },
  };
}

function buildCanonicalForExamples(sagaDef, pipelines) {
  return {
    schemaVersion: 'truthsrc/v1',
    workshop: 'wallet-skill-verification',
    valueObjects: [
      {
        name: 'Money',
        fields: [
          { name: 'amount', dataType: 'String' },
          { name: 'currency', dataType: 'String' },
        ],
      },
    ],
    aggregates: [
      {
        name: 'Wallet',
        identifier: { name: 'walletId', dataType: 'WalletId' },
        commands: [
          {
            name: 'PrepareDebit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'txId', dataType: 'TxId' },
              { name: 'amount', dataType: 'Money' },
            ],
            produces: ['DebitPrepared'],
          },
          {
            name: 'CommitDebit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'holdId', dataType: 'HoldId' },
            ],
            produces: ['DebitCommitted'],
          },
          {
            name: 'ReleaseDebit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'holdId', dataType: 'HoldId' },
            ],
            produces: ['DebitReleased'],
          },
          {
            name: 'PrepareCredit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'txId', dataType: 'TxId' },
              { name: 'amount', dataType: 'Money' },
            ],
            produces: ['CreditPrepared'],
          },
          {
            name: 'CommitCredit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'holdId', dataType: 'HoldId' },
            ],
            produces: ['CreditCommitted'],
          },
          {
            name: 'ReleaseCredit',
            parameters: [
              { name: 'walletId', dataType: 'WalletId' },
              { name: 'holdId', dataType: 'HoldId' },
            ],
            produces: ['CreditReleased'],
          },
        ],
        events: [
          { name: 'DebitPrepared', payloads: [{ name: 'holdId', dataType: 'HoldId' }] },
          { name: 'DebitCommitted', payloads: [] },
          { name: 'DebitReleased', payloads: [] },
          { name: 'CreditPrepared', payloads: [{ name: 'holdId', dataType: 'HoldId' }] },
          { name: 'CreditCommitted', payloads: [] },
          { name: 'CreditReleased', payloads: [] },
        ],
      },
      {
        name: 'TransferOrder',
        identifier: { name: 'transferOrderId', dataType: 'OperationId' },
        commands: [
          {
            name: 'InitiateTransfer',
            parameters: [
              { name: 'operationId', dataType: 'OperationId', origin: 'BUSINESS_INPUT' },
              { name: 'fromWalletId', dataType: 'WalletId', origin: 'BUSINESS_INPUT' },
              { name: 'toWalletId', dataType: 'WalletId', origin: 'BUSINESS_INPUT' },
              { name: 'amount', dataType: 'Money', origin: 'BUSINESS_INPUT' },
            ],
            produces: [],
          },
        ],
        events: [
          { name: 'TransferSucceeded', payloads: [{ name: 'txid', dataType: 'TxId' }] },
          { name: 'TransferRejected', payloads: [{ name: 'txid', dataType: 'TxId' }] },
          { name: 'TransferCompensated', payloads: [{ name: 'txid', dataType: 'TxId' }] },
          { name: 'TransferRecoveryRequired', payloads: [{ name: 'txid', dataType: 'TxId' }] },
          { name: 'TransferOutcomeUnknown', payloads: [{ name: 'txid', dataType: 'TxId' }] },
        ],
      },
    ],
    sagas: [sagaDef],
    pipelines,
  };
}

function buildSagaBinding() {
  return {
    schemaVersion: 'truthsrc.saga-binding/v1',
    sagas: [
      {
        sagaId: 'wallet-transfer-v1',
        version: 'v1',
        module: 'wallet.saga.WalletTransferSaga',
        engine: {
          artifact: 'net.imadz:saga-core_2.13:0.2.1',
          apiMode: 'strict',
          entrypoint: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
          capabilities: { required: REQUIRED_SAGA_CAPABILITIES },
        },
        codec: {
          id: 'wallet-transfer-codec',
          version: 'c1',
          compatibleVersions: ['c1'],
          mapper: 'wallet.codecs.WalletTransferCodec',
        },
        types: [
          { id: 'TxId', canonicalType: 'TxId', implementation: 'wallet.model.TxId', kind: 'id', minLength: 1, maxLength: 128 },
          { id: 'OperationId', canonicalType: 'OperationId', implementation: 'wallet.model.OperationId', kind: 'id', minLength: 1, maxLength: 128 },
          { id: 'WalletId', canonicalType: 'WalletId', implementation: 'wallet.model.WalletId', kind: 'id', minLength: 1, maxLength: 128 },
          { id: 'HoldId', canonicalType: 'HoldId', implementation: 'wallet.model.HoldId', kind: 'id', minLength: 1, maxLength: 128 },
          {
            id: 'Money',
            canonicalType: 'Money',
            implementation: 'wallet.model.Money',
            kind: 'money',
            currency: 'ISO-4217',
            amountEncoding: 'decimal-string',
            scale: 2,
            precision: 18,
            codec: 'wallet.codecs.MoneyCodec',
          },
        ],
        participants: [
          {
            participantId: 'source-wallet',
            addressing: {
              resolver: 'wallet.addressing.WalletResolver',
              aggregate: 'Wallet',
              resourceType: 'WalletId',
              mode: 'exact-resource',
            },
          },
          {
            participantId: 'target-wallet',
            addressing: {
              resolver: 'wallet.addressing.WalletResolver',
              aggregate: 'Wallet',
              resourceType: 'WalletId',
              mode: 'exact-resource',
            },
          },
        ],
        steps: [
          {
            stepId: 'debit-source',
            phases: {
              prepare: makePhaseBinding('wallet.ports.WalletParticipant', 'PrepareDebit', 'DebitPrepared', [
                { slot: 'holdId', ref: 'receipt:holdId', type: 'HoldId' },
              ]),
              commit: makePhaseBinding('wallet.ports.WalletParticipant', 'CommitDebit', 'DebitCommitted'),
              compensate: makePhaseBinding('wallet.ports.WalletParticipant', 'ReleaseDebit', 'DebitReleased'),
            },
          },
          {
            stepId: 'credit-target',
            phases: {
              prepare: makePhaseBinding('wallet.ports.WalletParticipant', 'PrepareCredit', 'CreditPrepared', [
                { slot: 'holdId', ref: 'receipt:holdId', type: 'HoldId' },
              ]),
              commit: makePhaseBinding('wallet.ports.WalletParticipant', 'CommitCredit', 'CreditCommitted'),
              compensate: makePhaseBinding('wallet.ports.WalletParticipant', 'ReleaseCredit', 'CreditReleased'),
            },
          },
        ],
        triggerMappers: [
          {
            triggerId: 'start-transfer',
            argsMapper: 'wallet.triggers.InitiateTransferArgs',
            idempotencyMapper: 'wallet.triggers.InitiateTransferIdempotency',
          },
        ],
        completionMappers: [
          { kind: 'succeeded', mapper: 'wallet.completions.TransferSucceeded' },
          { kind: 'rejected-before-effects', mapper: 'wallet.completions.TransferRejected' },
          { kind: 'compensated', mapper: 'wallet.completions.TransferCompensated' },
          { kind: 'recovery-required', mapper: 'wallet.completions.TransferRecoveryRequired' },
          { kind: 'outcome-unknown', mapper: 'wallet.completions.TransferOutcomeUnknown' },
        ],
      },
    ],
  };
}

function buildExecutionBinding(sagaBindings) {
  return {
    schemaVersion: 'truthsrc.execution-binding/v1',
    sagaBindings,
    pipelines: [
      {
        pipelineId: 'wallet-transfer-run',
        engine: 'monarch-persistence/0.2.1',
        module: 'wallet.execution.WalletTransferRun',
        codec: { id: 'wallet-run-codec', version: 'c1', compatibleVersions: ['c1'] },
        types: [
          { id: 'TxId', implementation: 'wallet.model.TxId' },
          { id: 'OperationId', implementation: 'wallet.model.OperationId' },
          { id: 'WalletId', implementation: 'wallet.model.WalletId' },
          { id: 'Money', implementation: 'wallet.model.Money' },
        ],
        ports: [],
        invocations: [
          {
            stepId: 'run-transfer',
            ref: { sagaId: 'wallet-transfer-v1', version: 'v1' },
            adapter: 'wallet.execution.WalletTransferSagaAdapter',
            runtime: {
              artifact: 'net.imadz:saga-core_2.13:0.2.1',
              apiMode: 'strict',
              entrypoint: 'net.imadz.infra.saga.strict.StrictSagaCoordinator',
            },
            argsCodec: {
              id: 'wallet-transfer-codec',
              version: 'c1',
              mapper: 'wallet.codecs.WalletTransferCodec',
            },
            resultCodec: {
              id: 'wallet-transfer-result-codec',
              version: 'c1',
              mapper: 'wallet.codecs.WalletTransferResultCodec',
            },
            transactionIdentity: {
              mapper: 'wallet.execution.WalletTransferIdentityMapper',
              derivation: 'durable-source-stage',
              payloadCompatibility: 'exact',
            },
          },
        ],
      },
      {
        pipelineId: 'external-dispatch-run',
        engine: 'monarch-persistence/0.2.1',
        module: 'wallet.execution.ExternalDispatchRun',
        codec: { id: 'external-dispatch-codec', version: 'c1', compatibleVersions: ['c1'] },
        types: [
          { id: 'OperationId', implementation: 'wallet.model.OperationId' },
          { id: 'PayloadId', implementation: 'wallet.model.PayloadId' },
          { id: 'ReceiptId', implementation: 'wallet.model.ReceiptId' },
        ],
        ports: [
          {
            id: 'SubmitExternalRequest',
            implementation: 'wallet.ports.ExternalGatewayPort',
            effect: 'external',
            confirmation: 'durable-ack',
            idempotency: { mode: 'keyed', key: 'operationId' },
            inputs: [
              { slot: 'operationId', type: 'OperationId' },
              { slot: 'payloadRef', type: 'PayloadId' },
            ],
            outputs: [
              { slot: 'receiptId', type: 'ReceiptId' },
            ],
            outcomes: [
              { code: 'Accepted', kind: 'success' },
              { code: 'Refused', kind: 'business-rejection' },
              { code: 'Unavailable', kind: 'infrastructure-failure' },
              { code: 'Unknown', kind: 'unknown-effect' },
            ],
          },
        ],
      },
    ],
  };
}

test('coarising_saga_monarch skill and bundled references compile cleanly under real compileSagas & compileExecution', () => {
  const skillPath = join(REPO_ROOT, 'skills/coarising_saga_monarch/SKILL.md');
  const sagaRefPath = join(REPO_ROOT, 'skills/coarising_saga_monarch/references/saga_schema.md');
  const monarchRefPath = join(REPO_ROOT, 'skills/coarising_saga_monarch/references/monarch_execution_schema.md');

  for (const p of [skillPath, sagaRefPath, monarchRefPath]) {
    assert.ok(existsSync(p), `missing ${p}`);
  }

  const skillText = readFileSync(skillPath, 'utf8');
  const sagaRefText = readFileSync(sagaRefPath, 'utf8');
  const monarchRefText = readFileSync(monarchRefPath, 'utf8');

  assert.ok(skillText.startsWith('---\nname: coarising-saga-monarch\n'));
  assert.ok(skillText.includes('references/saga_schema.md'));
  assert.ok(skillText.includes('references/monarch_execution_schema.md'));
  assert.ok(skillText.includes('forward-recovery') && skillText.includes('reconcile-before-resume'));

  // Extract JSON examples directly from the bundled markdown reference files
  const sagaJsonBlocks = [...sagaRefText.matchAll(/```json\n([\s\S]*?)```/gu)].map((m) => JSON.parse(m[1]));
  const sagaDef = sagaJsonBlocks.find((obj) => obj.id === 'wallet-transfer-v1');
  assert.ok(sagaDef, 'expected bundled wallet-transfer-v1 Saga JSON example in saga_schema.md');

  const execJsonBlocks = [...monarchRefText.matchAll(/```json\n([\s\S]*?)```/gu)].map((m) => JSON.parse(m[1]));
  const sagaPipeline = execJsonBlocks.find((obj) => obj.id === 'wallet-transfer-run');
  const portPipeline = execJsonBlocks.find((obj) => obj.id === 'external-dispatch-run');
  assert.ok(sagaPipeline && portPipeline, 'expected both bundled Monarch pipeline JSON examples in monarch_execution_schema.md');

  const canonical = buildCanonicalForExamples(sagaDef, [sagaPipeline, portPipeline]);
  const sagaBinding = buildSagaBinding();
  const execBinding = buildExecutionBinding(sagaBinding);

  // 1. Real compileSagas verification
  const sagaResult = compileSagas(canonical, sagaBinding);
  assert.deepEqual(sagaResult.diagnostics, [], `compileSagas failed: ${JSON.stringify(sagaResult.diagnostics, null, 2)}`);
  assert.equal(sagaResult.ir.schemaVersion, 'truthsrc.saga-ir/v1');
  assert.equal(sagaResult.ir.sagas.length, 1);

  // 2. Real compileExecution verification (covers invokeSaga + nested sagaBindings + external port)
  const execResult = compileExecution(canonical, execBinding);
  assert.deepEqual(execResult.diagnostics, [], `compileExecution failed: ${JSON.stringify(execResult.diagnostics, null, 2)}`);
  assert.equal(execResult.ir.schemaVersion, 'truthsrc.execution/v1');
  assert.equal(execResult.ir.pipelines.length, 2);
  assert.equal(execResult.ir.sagas.length, 1);

  // 3. Negative financial safety guardrail checks
  const brokenCompensate = structuredClone(canonical);
  brokenCompensate.sagas[0].payload.steps[1].phases.compensate.bindings[1].ref = 'step:debit-source:prepare:holdId';
  const brokenCompRes = compileSagas(brokenCompensate, sagaBinding);
  assert.ok(
    brokenCompRes.diagnostics.some((d) => d.code === 'SAGA_REF_UNAVAILABLE'),
    'compensate reading another step prepare receipt must fail with SAGA_REF_UNAVAILABLE',
  );

  const brokenUnknown = structuredClone(canonical);
  const unknownOutcome = brokenUnknown.pipelines[1].steps[0].execution.outcomes.find((o) => o.kind === 'unknown-effect');
  unknownOutcome.action = 'stop';
  const brokenUnknownRes = compileExecution(brokenUnknown, execBinding);
  assert.ok(
    brokenUnknownRes.diagnostics.some((d) => d.code === 'EXEC_OUTCOME_ACTION'),
    'unknown-effect mapped to stop instead of manual-recovery must fail with EXEC_OUTCOME_ACTION',
  );
});
