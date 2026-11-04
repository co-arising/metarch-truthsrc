export function presentCounter(contract, state) {
  if (typeof contract?.commandName !== 'string') {
    throw new TypeError('contract.commandName must be a string');
  }
  if (typeof state?.count !== 'string') {
    throw new TypeError('state.count must be a string');
  }

  return `${contract.commandName}:count=${state.count}`;
}
