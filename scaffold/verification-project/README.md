# A verification run without bank scripts

This optional example builds a small JavaScript catalog from explicit input, checks it against a separately maintained expected result, and records a read-only verifiable run. It uses no bank checkout, JVM, Docker or network service. It is not a domain compiler or Scala acceptance test.

The four engineering inputs are intentionally separate:

- `input.json`: example data.
- `build.mjs`: the transformation chosen by the developer.
- `expected.json` and `check.mjs`: independent expectations and their verifier.
- `verification.mjs`: explicit file/tree, artifact, check and cooperative resource declarations.

After installing a local package tarball, copy this directory out of `node_modules` into your own source directory. Keep a separate, existing parent directory for runs. For example, from a project whose package dependencies include `@madpolaris/truthsrc`:

```js
import { resolve } from 'node:path';
import { runVerification, inspectVerificationRun }
  from '@madpolaris/truthsrc/lib/verification/runner.mjs';
import { catalogVerification } from './catalog-source/verification.mjs';

const options = catalogVerification(resolve('catalog-runs/first'));
const result = await runVerification(options);
if (!result.passed) throw new Error('Verification failed; retain the run.');

const checked = await inspectVerificationRun({
  directory: options.directory,
  plan: options.plan,
  verify: options.verify,
});
console.log(checked);
```

The parent `catalog-runs/` must exist. `first` must not exist; every attempt uses a new directory and a permanently consumed marker. The implementation creates a private registry with an exclusive resource lock, captures declared inputs, builds into `first/artifacts/`, checks the exact output set, runs the independent verifier, rechecks inputs and artifacts, releases its own lock, and seals its receipts. It neither resumes nor overwrites a prior attempt. Failure preserves evidence and data.

Changing input, adding a file under the declared source tree, changing the builder/verifier, or modifying the built module invalidates later inspection. Inspection calls only the explicitly supplied read-only verifiers; it does not rebuild, acquire locks, start processes, probe PIDs, repair files or refresh stored reports. Application code is trusted in-process code: this example's verifier imports the generated module because that module is part of the trusted example. It is not an untrusted-plugin sandbox.

Only participants using the same registry/resource names coordinate. These locks are not operating-system resource reservations and there is no automatic stale-lock takeover. Different output locations do not imply different project ownership: generators sharing a project graph must use the same project resource key and coordinate every writer.

Process work is opt-in through the runner's `runProcess` capability and a nonzero `plan.processCount`. It uses the existing bounded Darwin Seatbelt supervisor with an explicit executable, argv, environment and profile. The caller must protect evidence and input files in that profile. No unsandboxed fallback is available. Ordinary source and in-process example checks do not require that backend.

Success certifies this explicit example contract only. It does not certify bank finance, external services, complete runtime recovery, published material delivery or human usability.
