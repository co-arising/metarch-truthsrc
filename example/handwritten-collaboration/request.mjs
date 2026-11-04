export function requestFor(contract, count) {
  if (
    typeof count !== 'string' ||
    count.trim() !== count ||
    !/^[+-]?[0-9]+$/.test(count)
  ) {
    throw new TypeError('count must be a signed integer string');
  }

  return { command: contract.commandName, count };
}
