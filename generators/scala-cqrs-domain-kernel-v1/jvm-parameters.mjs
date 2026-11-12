import { fail } from '../../lib/products/request.mjs';

// This family lowers semantic integer to primitive Long, decimal to BigDecimal,
// and all nominal/container types to references (never recursively flattened).
export function kernelParameterSlots(type, source) {
  if (type.form === 'primitive') {
    if (type.name === 'integer') return 2;
    if (['string', 'boolean', 'decimal'].includes(type.name)) return 1;
  } else if (['nominal', 'optional', 'sequence', 'map'].includes(type.form)) return 1;
  fail('KERNEL_MODEL', 'unsupported JVM parameter type', source);
}

// JVMS 4.3.3 counts the receiver too. Kernel constructors, copy and companion
// apply have identical explicit slots; object-nested case classes have no outer
// instance parameter. Abstract host methods also consume one receiver slot.
export function checkJvmParameters(signature, path, source, declaredSlots, synthetic = []) {
  const slots = declaredSlots + synthetic.length + 1;
  if (slots > 255) fail('KERNEL_JVM_SLOTS',
    `${signature} requires ${slots} JVM parameter slots (${declaredSlots} declared + ${synthetic.length} synthetic${synthetic.length ? ' [' + synthetic.join(', ') + ']' : ''} + 1 receiver); maximum is 255; target ${path}`,
    source);
}
