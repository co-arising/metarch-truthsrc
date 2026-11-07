package example.counter.oracle.controls

import example.counter.domain.ports.CounterComputations

// Must fail type-checking: a concrete host omits acceptedRatio entirely.
final class MissingMethod extends CounterComputations
