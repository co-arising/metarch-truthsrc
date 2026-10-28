// Mechanically copied shipped schemas for the pure product kernel.
// Audited against the source JSON by product-contracts tests; no schema override.
import { copyImmutableData } from '../immutable-data.mjs';

export const sagaSchema = copyImmutableData({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://madpolaris.dev/contracts/saga-ir-v1.schema.json",
  "title": "Saga v1 contract-only IR, business declarations and technical bindings",
  "description": "Only aggregate-owned commands (the public slice projection) and events resolve. Sessions are narrative, not proof of ownership. No runtime certification, code evaluation, implicit joins, dynamic participant expansion, numeric money or literal dataflow in v1. All-none steps are explicitly read-only. Step output refs are phase-qualified durable receipts; compensation may read only its own Prepare outputs. Digest is SHA-256 of stable JSON {schemaVersion,workshop,readiness,sagas}, excluding provenance/anchors.",
  "type": "object",
  "required": [
    "schemaVersion",
    "workshop",
    "readiness",
    "sagas",
    "digest",
    "sourceMap"
  ],
  "properties": {
    "schemaVersion": {
      "const": "truthsrc.saga-ir/v1"
    },
    "workshop": {
      "$ref": "#/$defs/text"
    },
    "readiness": {
      "const": "contract-only"
    },
    "sagas": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/compiledSaga"
      }
    },
    "digest": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}(?![\\s\\S])"
    },
    "sourceMap": {
      "type": "object",
      "propertyNames": {
        "$ref": "#/$defs/pointer"
      },
      "additionalProperties": {
        "$ref": "#/$defs/source"
      }
    }
  },
  "additionalProperties": false,
  "$defs": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 128,
      "pattern": "^[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
    },
    "symbol": {
      "type": "string",
      "minLength": 1,
      "maxLength": 256,
      "pattern": "^[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*(?![\\s\\S])"
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4096,
      "pattern": "\\S"
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 2147483647
    },
    "pointer": {
      "type": "string",
      "pattern": "^(?:/(?:[^~/]|~0|~1)*)*(?![\\s\\S])"
    },
    "slot": {
      "type": "object",
      "required": [
        "slot",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "slots": {
      "type": "array",
      "maxItems": 1024,
      "items": {
        "$ref": "#/$defs/slot"
      }
    },
    "ref": {
      "type": "string",
      "pattern": "^(?:txid|args:[A-Za-z][A-Za-z0-9_-]*|step:[A-Za-z][A-Za-z0-9_-]*:(?:prepare|commit|compensate):[A-Za-z][A-Za-z0-9_-]*)(?![\\s\\S])"
    },
    "typedRef": {
      "type": "object",
      "required": [
        "ref",
        "type"
      ],
      "properties": {
        "ref": {
          "$ref": "#/$defs/ref"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "argRef": {
      "type": "object",
      "required": [
        "ref",
        "type"
      ],
      "properties": {
        "ref": {
          "type": "string",
          "pattern": "^args:[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "mapping": {
      "type": "object",
      "required": [
        "slot",
        "ref",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "$ref": "#/$defs/ref"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "mappings": {
      "type": "array",
      "maxItems": 1024,
      "items": {
        "$ref": "#/$defs/mapping"
      }
    },
    "ownedRef": {
      "type": "object",
      "required": [
        "aggregate",
        "name"
      ],
      "properties": {
        "aggregate": {
          "$ref": "#/$defs/text"
        },
        "name": {
          "$ref": "#/$defs/text"
        }
      },
      "additionalProperties": false
    },
    "none": {
      "type": "object",
      "required": [
        "kind",
        "reason"
      ],
      "properties": {
        "kind": {
          "const": "none"
        },
        "reason": {
          "const": "read-only"
        }
      },
      "additionalProperties": false
    },
    "phase": {
      "description": "v1 resource-typed command bindings must use the step participant's exact resource arg. No guessing address from first field, and no unsupported cross-resource parameter semantics.",
      "oneOf": [
        {
          "$ref": "#/$defs/none"
        },
        {
          "type": "object",
          "required": [
            "kind",
            "commandRef",
            "bindings",
            "outputs"
          ],
          "properties": {
            "kind": {
              "const": "command"
            },
            "commandRef": {
              "$ref": "#/$defs/ownedRef"
            },
            "bindings": {
              "$ref": "#/$defs/mappings"
            },
            "outputs": {
              "$ref": "#/$defs/slots"
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "phases": {
      "type": "object",
      "required": [
        "prepare",
        "commit",
        "compensate"
      ],
      "properties": {
        "prepare": {
          "$ref": "#/$defs/phase"
        },
        "commit": {
          "$ref": "#/$defs/phase"
        },
        "compensate": {
          "$ref": "#/$defs/phase"
        }
      },
      "additionalProperties": false
    },
    "participant": {
      "type": "object",
      "required": [
        "id",
        "aggregate",
        "resourceRef"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "aggregate": {
          "$ref": "#/$defs/text"
        },
        "resourceRef": {
          "$ref": "#/$defs/argRef"
        }
      },
      "additionalProperties": false
    },
    "step": {
      "type": "object",
      "required": [
        "id",
        "participant",
        "group",
        "phases"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "participant": {
          "$ref": "#/$defs/id"
        },
        "group": {
          "$ref": "#/$defs/limit"
        },
        "phases": {
          "$ref": "#/$defs/phases"
        }
      },
      "additionalProperties": false
    },
    "group": {
      "description": "v1 groups are explicit serial numeric barriers: each group depends transitively on the previous numeric group. Steps within one group are concurrent and cannot reuse a participant. No implicit array-order join or dynamic DAG scheduler.",
      "type": "object",
      "required": [
        "id",
        "dependsOn"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/limit"
        },
        "dependsOn": {
          "type": "array",
          "maxItems": 1024,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/limit"
          }
        }
      },
      "additionalProperties": false
    },
    "resultKind": {
      "enum": [
        "succeeded",
        "rejected-before-effects",
        "compensated",
        "recovery-required",
        "outcome-unknown"
      ]
    },
    "resultKinds": {
      "const": [
        "succeeded",
        "rejected-before-effects",
        "compensated",
        "recovery-required",
        "outcome-unknown"
      ]
    },
    "triggerMapping": {
      "type": "object",
      "required": [
        "slot",
        "ref",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "type": "string",
          "pattern": "^source:[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "trigger": {
      "description": "Each trigger is an independent start mapping, not an inferred OR/AND/join. sourceRef resolves the owned command/event; source:<field> refs map every declared arg exactly. The named idempotency mapper derives stable transaction identity under Saga ID/version from durable business operation ID and rejects different args; no clock/random/generation/attempt identity.",
      "type": "object",
      "required": [
        "id",
        "kind",
        "sourceRef",
        "argsMapping",
        "idempotency"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "enum": [
            "event",
            "command"
          ]
        },
        "sourceRef": {
          "$ref": "#/$defs/ownedRef"
        },
        "argsMapping": {
          "type": "array",
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/triggerMapping"
          }
        },
        "idempotency": {
          "type": "object",
          "required": [
            "ref",
            "type",
            "scope",
            "conflict"
          ],
          "properties": {
            "ref": {
              "type": "string",
              "pattern": "^source:[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
            },
            "type": {
              "$ref": "#/$defs/id"
            },
            "scope": {
              "const": "saga-version"
            },
            "conflict": {
              "const": "reject-different-args"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "completion": {
      "type": "object",
      "required": [
        "kind",
        "eventRef",
        "bindings"
      ],
      "properties": {
        "kind": {
          "$ref": "#/$defs/resultKind"
        },
        "eventRef": {
          "$ref": "#/$defs/ownedRef"
        },
        "bindings": {
          "$ref": "#/$defs/mappings"
        }
      },
      "additionalProperties": false
    },
    "resilience": {
      "description": "Bounded retry budgets retain the original operation identity. Retries require idempotency or reconciled nonexecution. totalTimeoutMs covers maxAttempts*(phaseTimeoutMs+queryTimeoutMs)+(maxAttempts-1)*backoffMs; expiry yields controlled recovery/unknown, not business rejection or automatic compensation.",
      "type": "object",
      "required": [
        "maxAttempts",
        "phaseTimeoutMs",
        "queryTimeoutMs",
        "backoffMs",
        "totalTimeoutMs"
      ],
      "properties": {
        "maxAttempts": {
          "$ref": "#/$defs/limit"
        },
        "phaseTimeoutMs": {
          "$ref": "#/$defs/limit"
        },
        "queryTimeoutMs": {
          "$ref": "#/$defs/limit"
        },
        "backoffMs": {
          "type": "integer",
          "minimum": 0,
          "maximum": 2147483647
        },
        "totalTimeoutMs": {
          "$ref": "#/$defs/limit"
        }
      },
      "additionalProperties": false
    },
    "safety": {
      "description": "All Prepare receipts must be confirmed before durably recording CommitDecision; only then Commit. AbortDecision is valid only before CommitDecision; reconcile unknown Prepare before compensating confirmed reservations. After CommitDecision never auto-compensate. Success requires every Commit confirmation. These are required host semantics, not observed runtime facts.",
      "type": "object",
      "required": [
        "commitDecision",
        "abortDecision",
        "afterCommit",
        "unknown",
        "compensation",
        "cancelBeforePrepare",
        "retryIdentity",
        "manualRecovery"
      ],
      "properties": {
        "commitDecision": {
          "const": "durable-before-commit"
        },
        "abortDecision": {
          "const": "durable-before-compensate"
        },
        "afterCommit": {
          "const": "forward-recovery"
        },
        "unknown": {
          "const": "reconcile-before-resume"
        },
        "compensation": {
          "const": "confirmed-reservations"
        },
        "cancelBeforePrepare": {
          "const": "empty-release-and-fence"
        },
        "retryIdentity": {
          "const": "stable-operation"
        },
        "manualRecovery": {
          "const": "authorized-reconciliation-evidence"
        }
      },
      "additionalProperties": false
    },
    "manifest": {
      "oneOf": [
        {
          "type": "object",
          "required": [
            "mode",
            "durable"
          ],
          "properties": {
            "mode": {
              "const": "static"
            },
            "durable": {
              "const": true
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "mode",
            "durable",
            "ref",
            "version",
            "selection"
          ],
          "properties": {
            "mode": {
              "const": "durable-reference"
            },
            "durable": {
              "const": true
            },
            "ref": {
              "$ref": "#/$defs/argRef"
            },
            "version": {
              "$ref": "#/$defs/id"
            },
            "selection": {
              "const": "frozen-before-prepare"
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "admission": {
      "description": "Static logical participant count and each concurrent barrier must fit the declared bounds. maxItemsPerChunk bounds each collection arg including nested collection cardinality; such args require durable-reference manifest. Runtime value conservation, arg inequality and manifest contents require host validation and are never certified here.",
      "type": "object",
      "required": [
        "maxParticipants",
        "maxInFlight",
        "maxItemsPerChunk",
        "manifest"
      ],
      "properties": {
        "maxParticipants": {
          "$ref": "#/$defs/limit"
        },
        "maxInFlight": {
          "$ref": "#/$defs/limit"
        },
        "maxItemsPerChunk": {
          "$ref": "#/$defs/limit"
        },
        "manifest": {
          "$ref": "#/$defs/manifest"
        }
      },
      "additionalProperties": false
    },
    "payload": {
      "type": "object",
      "required": [
        "schemaVersion",
        "purpose",
        "invariants",
        "transactionIdType",
        "args",
        "participants",
        "groups",
        "steps",
        "resilience",
        "safety",
        "admission",
        "triggers",
        "resultKinds",
        "completions"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc.saga/v1"
        },
        "purpose": {
          "$ref": "#/$defs/text"
        },
        "invariants": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/text"
          }
        },
        "transactionIdType": {
          "$ref": "#/$defs/id"
        },
        "args": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/slot"
          }
        },
        "participants": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/participant"
          }
        },
        "groups": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/group"
          }
        },
        "steps": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/step"
          }
        },
        "resilience": {
          "$ref": "#/$defs/resilience"
        },
        "safety": {
          "$ref": "#/$defs/safety"
        },
        "admission": {
          "$ref": "#/$defs/admission"
        },
        "triggers": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/trigger"
          }
        },
        "resultKinds": {
          "$ref": "#/$defs/resultKinds"
        },
        "completions": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/completion"
          }
        }
      },
      "additionalProperties": false
    },
    "saga": {
      "type": "object",
      "required": [
        "id",
        "name",
        "seq",
        "version",
        "payload"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "seq": {
          "type": "integer",
          "minimum": 0,
          "maximum": 2147483647
        },
        "version": {
          "$ref": "#/$defs/id"
        },
        "payload": {
          "$ref": "#/$defs/payload"
        }
      },
      "additionalProperties": false
    },
    "canonical": {
      "type": "object",
      "required": [
        "schemaVersion",
        "workshop"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc/v1"
        },
        "workshop": {
          "$ref": "#/$defs/text"
        },
        "aggregates": {
          "type": "array"
        },
        "sessions": {
          "type": "array"
        },
        "sagas": {
          "type": "array",
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/saga"
          }
        }
      },
      "additionalProperties": true
    },
    "typeBinding": {
      "oneOf": [
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "minLength",
            "maxLength"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "enum": [
                "id",
                "string"
              ]
            },
            "minLength": {
              "$ref": "#/$defs/limit"
            },
            "maxLength": {
              "$ref": "#/$defs/limit"
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "boolean"
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "minimum",
            "maximum"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "integer"
            },
            "minimum": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            },
            "maximum": {
              "type": "integer",
              "minimum": -9007199254740991,
              "maximum": 9007199254740991
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "values"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "enum"
            },
            "values": {
              "type": "array",
              "minItems": 1,
              "maxItems": 1024,
              "uniqueItems": true,
              "items": {
                "$ref": "#/$defs/id"
              }
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "elementType",
            "minItems",
            "maxItems"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "collection"
            },
            "elementType": {
              "$ref": "#/$defs/id"
            },
            "minItems": {
              "type": "integer",
              "minimum": 0,
              "maximum": 2147483647
            },
            "maxItems": {
              "$ref": "#/$defs/limit"
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "fields"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "value-object"
            },
            "fields": {
              "type": "array",
              "minItems": 1,
              "maxItems": 1024,
              "items": {
                "$ref": "#/$defs/slot"
              }
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "currency",
            "amountEncoding",
            "scale",
            "precision",
            "codec"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "money"
            },
            "currency": {
              "const": "ISO-4217"
            },
            "amountEncoding": {
              "enum": [
                "minor-unit-string",
                "decimal-string"
              ]
            },
            "scale": {
              "type": "integer",
              "minimum": 0,
              "maximum": 18
            },
            "precision": {
              "type": "integer",
              "minimum": 1,
              "maximum": 38
            },
            "codec": {
              "$ref": "#/$defs/symbol"
            }
          },
          "additionalProperties": false
        },
        {
          "type": "object",
          "required": [
            "id",
            "canonicalType",
            "implementation",
            "kind",
            "readable",
            "version"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "canonicalType": {
              "$ref": "#/$defs/text"
            },
            "implementation": {
              "$ref": "#/$defs/symbol"
            },
            "kind": {
              "const": "manifest-reference"
            },
            "readable": {
              "const": true
            },
            "version": {
              "$ref": "#/$defs/id"
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "operationIdentity": {
      "const": [
        "txid",
        "definition-version",
        "participant",
        "resource",
        "step",
        "phase"
      ]
    },
    "receiptIdentity": {
      "const": [
        "txid",
        "definition-version",
        "args-digest",
        "participant",
        "resource",
        "step",
        "phase"
      ]
    },
    "receiptMapping": {
      "type": "object",
      "required": [
        "slot",
        "ref",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "type": "string",
          "pattern": "^receipt:[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      },
      "additionalProperties": false
    },
    "phaseBinding": {
      "oneOf": [
        {
          "$ref": "#/$defs/none"
        },
        {
          "type": "object",
          "required": [
            "kind",
            "port",
            "commandMapper",
            "confirmation",
            "query",
            "receipt",
            "idempotency"
          ],
          "properties": {
            "kind": {
              "const": "command"
            },
            "port": {
              "$ref": "#/$defs/symbol"
            },
            "commandMapper": {
              "$ref": "#/$defs/symbol"
            },
            "confirmation": {
              "type": "object",
              "required": [
                "kind",
                "eventRef",
                "mapper",
                "outputs"
              ],
              "properties": {
                "kind": {
                  "const": "durable-receipt"
                },
                "eventRef": {
                  "$ref": "#/$defs/ownedRef"
                },
                "mapper": {
                  "$ref": "#/$defs/symbol"
                },
                "outputs": {
                  "type": "array",
                  "maxItems": 1024,
                  "items": {
                    "$ref": "#/$defs/receiptMapping"
                  }
                }
              },
              "additionalProperties": false
            },
            "query": {
              "type": "object",
              "required": [
                "mapper",
                "mode",
                "identity",
                "resultKinds"
              ],
              "properties": {
                "mapper": {
                  "$ref": "#/$defs/symbol"
                },
                "mode": {
                  "const": "read-only"
                },
                "identity": {
                  "$ref": "#/$defs/receiptIdentity"
                },
                "resultKinds": {
                  "const": [
                    "confirmed",
                    "not-executed",
                    "unknown"
                  ]
                }
              },
              "additionalProperties": false
            },
            "receipt": {
              "type": "object",
              "required": [
                "mapper",
                "version",
                "durable",
                "identity",
                "payloadCompatibility",
                "evidence"
              ],
              "properties": {
                "mapper": {
                  "$ref": "#/$defs/symbol"
                },
                "version": {
                  "$ref": "#/$defs/id"
                },
                "durable": {
                  "const": true
                },
                "identity": {
                  "$ref": "#/$defs/receiptIdentity"
                },
                "payloadCompatibility": {
                  "const": "exact"
                },
                "evidence": {
                  "const": "reservation-decision-effect-reconciliation"
                }
              },
              "additionalProperties": false
            },
            "idempotency": {
              "type": "object",
              "required": [
                "mapper",
                "identity",
                "payloadConflict",
                "attemptIdentity"
              ],
              "properties": {
                "mapper": {
                  "$ref": "#/$defs/symbol"
                },
                "identity": {
                  "$ref": "#/$defs/operationIdentity"
                },
                "payloadConflict": {
                  "const": "reject"
                },
                "attemptIdentity": {
                  "const": "excluded"
                }
              },
              "additionalProperties": false
            }
          },
          "additionalProperties": false
        }
      ]
    },
    "stepBinding": {
      "type": "object",
      "required": [
        "stepId",
        "phases"
      ],
      "properties": {
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "phases": {
          "type": "object",
          "required": [
            "prepare",
            "commit",
            "compensate"
          ],
          "properties": {
            "prepare": {
              "$ref": "#/$defs/phaseBinding"
            },
            "commit": {
              "$ref": "#/$defs/phaseBinding"
            },
            "compensate": {
              "$ref": "#/$defs/phaseBinding"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "participantBinding": {
      "type": "object",
      "required": [
        "participantId",
        "addressing"
      ],
      "properties": {
        "participantId": {
          "$ref": "#/$defs/id"
        },
        "addressing": {
          "type": "object",
          "required": [
            "resolver",
            "aggregate",
            "resourceType",
            "mode"
          ],
          "properties": {
            "resolver": {
              "$ref": "#/$defs/symbol"
            },
            "aggregate": {
              "$ref": "#/$defs/text"
            },
            "resourceType": {
              "$ref": "#/$defs/id"
            },
            "mode": {
              "const": "exact-resource"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    },
    "capabilities": {
      "type": "array",
      "minItems": 10,
      "maxItems": 10,
      "uniqueItems": true,
      "items": {
        "enum": [
          "durable-commit-decision",
          "durable-abort-decision",
          "typed-nonterminal-unknown",
          "safe-status-reattach",
          "receipt-reconciliation",
          "participant-idempotency-query",
          "pinned-definition-codec",
          "manual-evidence-authorization",
          "cancel-before-prepare-fencing",
          "durable-manifest"
        ]
      }
    },
    "sagaBinding": {
      "type": "object",
      "required": [
        "sagaId",
        "version",
        "module",
        "engine",
        "codec",
        "types",
        "participants",
        "steps",
        "triggerMappers",
        "completionMappers"
      ],
      "properties": {
        "sagaId": {
          "$ref": "#/$defs/id"
        },
        "version": {
          "$ref": "#/$defs/id"
        },
        "module": {
          "$ref": "#/$defs/symbol"
        },
        "engine": {
          "type": "object",
          "required": [
            "artifact",
            "apiMode",
            "entrypoint",
            "capabilities"
          ],
          "properties": {
            "artifact": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?![\\s\\S])"
            },
            "apiMode": {
              "const": "strict"
            },
            "entrypoint": {
              "$ref": "#/$defs/symbol"
            },
            "capabilities": {
              "type": "object",
              "required": [
                "required"
              ],
              "properties": {
                "required": {
                  "$ref": "#/$defs/capabilities"
                }
              },
              "additionalProperties": false
            }
          },
          "additionalProperties": false
        },
        "codec": {
          "type": "object",
          "required": [
            "id",
            "version",
            "compatibleVersions",
            "mapper"
          ],
          "properties": {
            "id": {
              "$ref": "#/$defs/id"
            },
            "version": {
              "$ref": "#/$defs/id"
            },
            "compatibleVersions": {
              "type": "array",
              "minItems": 1,
              "maxItems": 1024,
              "uniqueItems": true,
              "items": {
                "$ref": "#/$defs/id"
              }
            },
            "mapper": {
              "$ref": "#/$defs/symbol"
            }
          },
          "additionalProperties": false
        },
        "types": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/typeBinding"
          }
        },
        "participants": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/participantBinding"
          }
        },
        "steps": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/stepBinding"
          }
        },
        "triggerMappers": {
          "type": "array",
          "minItems": 1,
          "maxItems": 1024,
          "items": {
            "type": "object",
            "required": [
              "triggerId",
              "argsMapper",
              "idempotencyMapper"
            ],
            "properties": {
              "triggerId": {
                "$ref": "#/$defs/id"
              },
              "argsMapper": {
                "$ref": "#/$defs/symbol"
              },
              "idempotencyMapper": {
                "$ref": "#/$defs/symbol"
              }
            },
            "additionalProperties": false
          }
        },
        "completionMappers": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "type": "object",
            "required": [
              "kind",
              "mapper"
            ],
            "properties": {
              "kind": {
                "$ref": "#/$defs/resultKind"
              },
              "mapper": {
                "$ref": "#/$defs/symbol"
              }
            },
            "additionalProperties": false
          }
        }
      },
      "additionalProperties": false
    },
    "location": {
      "type": "object",
      "required": [
        "line",
        "column"
      ],
      "properties": {
        "line": {
          "$ref": "#/$defs/limit"
        },
        "column": {
          "$ref": "#/$defs/limit"
        }
      },
      "additionalProperties": false
    },
    "sourceHint": {
      "type": "object",
      "required": [
        "file"
      ],
      "properties": {
        "file": {
          "$ref": "#/$defs/text"
        },
        "atom": {
          "$ref": "#/$defs/text"
        },
        "path": {
          "$ref": "#/$defs/pointer"
        },
        "location": {
          "$ref": "#/$defs/location"
        }
      },
      "additionalProperties": false
    },
    "sourceHints": {
      "type": "object",
      "properties": {
        "canonical": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/pointer"
          },
          "additionalProperties": {
            "$ref": "#/$defs/sourceHint"
          }
        },
        "binding": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/pointer"
          },
          "additionalProperties": {
            "$ref": "#/$defs/sourceHint"
          }
        }
      },
      "additionalProperties": false
    },
    "bindingDocument": {
      "type": "object",
      "required": [
        "schemaVersion",
        "sagas"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc.saga-binding/v1"
        },
        "sagas": {
          "type": "array",
          "maxItems": 1024,
          "items": {
            "$ref": "#/$defs/sagaBinding"
          }
        },
        "sourceMap": {
          "$ref": "#/$defs/sourceHints"
        }
      },
      "additionalProperties": false
    },
    "source": {
      "type": "object",
      "required": [
        "document",
        "pointer",
        "file",
        "atom",
        "path",
        "location"
      ],
      "properties": {
        "document": {
          "enum": [
            "canonical",
            "binding"
          ]
        },
        "pointer": {
          "$ref": "#/$defs/pointer"
        },
        "file": {
          "type": [
            "string",
            "null"
          ]
        },
        "atom": {
          "type": [
            "string",
            "null"
          ]
        },
        "path": {
          "$ref": "#/$defs/pointer"
        },
        "location": {
          "oneOf": [
            {
              "type": "null"
            },
            {
              "$ref": "#/$defs/location"
            }
          ]
        }
      },
      "additionalProperties": false
    },
    "compiledSaga": {
      "type": "object",
      "required": [
        "definition",
        "binding",
        "readiness"
      ],
      "properties": {
        "definition": {
          "$ref": "#/$defs/saga"
        },
        "binding": {
          "$ref": "#/$defs/sagaBinding"
        },
        "readiness": {
          "const": "contract-only"
        }
      },
      "additionalProperties": false
    }
  }
});

export const executionSchema = copyImmutableData({
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://madpolaris.dev/truthsrc/schema/execution-ir-v1.schema.json",
  "title": "Truthsrc execution IR v1",
  "description": "A compiled, contract-only execution model; not proof of runtime support. Input contracts are in $defs.execution, $defs.stepExecution and $defs.bindingDocument. Canonical narrative fields remain outside the execution contract. Reference grammar: input:<id> or step:<step-id>:<write-id>. Types are nominal IDs resolved by binding.types; no language expressions are accepted on the business surface. Optional binding.sagaBindings is an independently strict truthsrc.saga-binding/v1 document, required for invokeSaga; compileSagas validates all canonical.sagas when opted in. IR sagas contains each compiled definition/binding once, while pipeline binding.invocations declares adapters. No dynamic iteration, runtime execution, code generation or artifact certification.",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "workshop",
    "pipelines",
    "documentOnly",
    "sourceMap"
  ],
  "properties": {
    "schemaVersion": {
      "const": "truthsrc.execution/v1"
    },
    "workshop": {
      "type": "string",
      "minLength": 1
    },
    "pipelines": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/pipelineIr"
      }
    },
    "documentOnly": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/documentOnly"
      }
    },
    "sourceMap": {
      "type": "object",
      "propertyNames": {
        "$ref": "#/$defs/pointer"
      },
      "additionalProperties": {
        "$ref": "#/$defs/source"
      }
    },
    "sagas": {
      "type": "array",
      "items": {
        "$ref": "saga-ir-v1.schema.json#/$defs/compiledSaga"
      }
    }
  },
  "$defs": {
    "id": {
      "type": "string",
      "pattern": "^[A-Za-z][A-Za-z0-9._-]*$"
    },
    "text": {
      "type": "string",
      "minLength": 1,
      "pattern": "\\S"
    },
    "pointer": {
      "type": "string",
      "pattern": "^(?:/(?:[^~]|~[01])*)?$"
    },
    "ref": {
      "type": "string",
      "pattern": "^(?:input:[A-Za-z][A-Za-z0-9._-]*|step:[A-Za-z][A-Za-z0-9._-]*:[A-Za-z][A-Za-z0-9._-]*)$"
    },
    "location": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "line",
        "column"
      ],
      "properties": {
        "line": {
          "type": "integer",
          "minimum": 1
        },
        "column": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "sourceHint": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "file"
      ],
      "properties": {
        "file": {
          "$ref": "#/$defs/text"
        },
        "atom": {
          "$ref": "#/$defs/text"
        },
        "path": {
          "$ref": "#/$defs/pointer"
        },
        "location": {
          "$ref": "#/$defs/location"
        }
      }
    },
    "sourceHints": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "canonical": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/pointer"
          },
          "additionalProperties": {
            "$ref": "#/$defs/sourceHint"
          }
        },
        "binding": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/pointer"
          },
          "additionalProperties": {
            "$ref": "#/$defs/sourceHint"
          }
        }
      }
    },
    "source": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "document",
        "pointer",
        "file",
        "atom",
        "path",
        "location"
      ],
      "properties": {
        "document": {
          "enum": [
            "canonical",
            "binding"
          ]
        },
        "pointer": {
          "$ref": "#/$defs/pointer"
        },
        "file": {
          "type": [
            "string",
            "null"
          ]
        },
        "atom": {
          "type": [
            "string",
            "null"
          ]
        },
        "path": {
          "$ref": "#/$defs/pointer"
        },
        "location": {
          "type": [
            "object",
            "null"
          ],
          "additionalProperties": false,
          "required": [
            "line",
            "column"
          ],
          "properties": {
            "line": {
              "type": "integer",
              "minimum": 1
            },
            "column": {
              "type": "integer",
              "minimum": 1
            }
          }
        }
      }
    },
    "input": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "type",
        "durability"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "$ref": "#/$defs/id"
        },
        "durability": {
          "enum": [
            "start-record",
            "durable-reference"
          ]
        }
      }
    },
    "read": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "slot",
        "ref",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "$ref": "#/$defs/ref"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "write": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "slot",
        "type",
        "durability"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "slot": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "$ref": "#/$defs/id"
        },
        "durability": {
          "enum": [
            "checkpoint",
            "durable-reference"
          ]
        }
      }
    },
    "output": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "ref",
        "type"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "$ref": "#/$defs/ref"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "outcomeKind": {
      "enum": [
        "success",
        "business-rejection",
        "resolved",
        "unknown-effect",
        "infrastructure-failure"
      ]
    },
    "portOutcome": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "kind"
      ],
      "properties": {
        "code": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/outcomeKind"
        }
      }
    },
    "outcome": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "code",
        "kind",
        "action"
      ],
      "properties": {
        "code": {
          "$ref": "#/$defs/id"
        },
        "kind": {
          "$ref": "#/$defs/outcomeKind"
        },
        "action": {
          "enum": [
            "continue",
            "stop",
            "manual-recovery"
          ]
        }
      },
      "description": "success/resolved must continue; business-rejection must stop or enter manual recovery; unknown-effect/infrastructure-failure must enter manual recovery. No retry, compensation, implicit default or arbitrary policy evaluation in v1. Writes must be returned on every continuing outcome, including resolved."
    },
    "recovery": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "inputResponsibility",
        "inputs",
        "planVersion",
        "planCompatibility",
        "checkpoint",
        "unknownEffect",
        "ownership"
      ],
      "properties": {
        "inputResponsibility": {
          "const": "host"
        },
        "inputs": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "pattern": "^input:[A-Za-z][A-Za-z0-9._-]*$"
          }
        },
        "planVersion": {
          "$ref": "#/$defs/id"
        },
        "planCompatibility": {
          "const": "exact"
        },
        "checkpoint": {
          "const": "confirmed-prefix"
        },
        "unknownEffect": {
          "const": "reconcile-before-resume"
        },
        "ownership": {
          "const": "single-writer"
        }
      },
      "description": "The host must durably save every initial input before accepting a run. Recovery references must cover all initial inputs, not outputs produced later. Exact plan and codec compatibility are declarations, not a JVM ownership or journal verification."
    },
    "bound": {
      "type": "integer",
      "minimum": 1,
      "maximum": 2147483647
    },
    "admission": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "maxConcurrentRuns",
        "maxInFlightSteps",
        "maxItemsPerChunk",
        "maxInFlightChunks"
      ],
      "properties": {
        "maxConcurrentRuns": {
          "$ref": "#/$defs/bound"
        },
        "maxInFlightSteps": {
          "const": 1
        },
        "maxItemsPerChunk": {
          "$ref": "#/$defs/bound"
        },
        "maxInFlightChunks": {
          "$ref": "#/$defs/bound"
        }
      },
      "description": "Finite host admission/chunk limits; an emitter must wire them or reject generation. The ordered checkpoint window is exactly one. No unbounded streams or durable dynamic insertion in v1."
    },
    "execution": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schemaVersion",
        "inputs",
        "outputs",
        "recovery",
        "admission"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc.execution/v1"
        },
        "inputs": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/input"
          }
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/output"
          }
        },
        "recovery": {
          "$ref": "#/$defs/recovery"
        },
        "admission": {
          "$ref": "#/$defs/admission"
        }
      }
    },
    "stepExecution": {
      "oneOf": [
        {
          "$ref": "#/$defs/portStepExecution"
        },
        {
          "$ref": "#/$defs/sagaStepExecution"
        },
        {
          "$ref": "#/$defs/awaitChildRunStepExecution"
        }
      ],
      "description": "Exactly one discriminator property: port, invokeSaga or awaitChildRun. An invocation is never a pure port, arbitrary expression, or runtime certificate; an awaited child run is never a pure port, implicit success, or dynamic insertion."
    },
    "portStepExecution": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "port",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "port": {
          "$ref": "#/$defs/id"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "sagaRef": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "sagaId",
        "version"
      ],
      "properties": {
        "sagaId": {
          "$ref": "saga-ir-v1.schema.json#/$defs/id"
        },
        "version": {
          "$ref": "saga-ir-v1.schema.json#/$defs/id"
        }
      }
    },
    "identityRef": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ref",
        "type"
      ],
      "properties": {
        "ref": {
          "$ref": "#/$defs/ref"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "transactionIdentity": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "type",
        "derivation",
        "source",
        "stageId",
        "stageOccurrence",
        "scope",
        "conflict"
      ],
      "properties": {
        "type": {
          "$ref": "#/$defs/id"
        },
        "derivation": {
          "const": "durable-source-stage"
        },
        "source": {
          "$ref": "#/$defs/identityRef"
        },
        "stageId": {
          "$ref": "#/$defs/id"
        },
        "stageOccurrence": {
          "$ref": "#/$defs/identityRef"
        },
        "iteration": {
          "$ref": "#/$defs/identityRef"
        },
        "chunk": {
          "$ref": "#/$defs/identityRef"
        },
        "scope": {
          "const": "saga-version"
        },
        "conflict": {
          "const": "reject-different-args"
        }
      },
      "description": "Host derives transaction identity from Saga ID/version, pipeline ID (the enclosing pipeline.id), durable source token, exact stage ID, durable stage occurrence and each declared iteration/chunk token. All tokens must be typed reads of durable initial inputs; source is an ID, other tokens are IDs or bounded nonnegative integers in the Saga binding. No expressions, FQNs, clock, random, attempt or JVM generation. Missing optional tokens mean a single occurrence dimension, not inferred dynamic iteration."
    },
    "sagaResultOutput": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "slot",
        "ref",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "type": "string",
          "pattern": "^result:[A-Za-z][A-Za-z0-9_-]*(?![\\s\\S])"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "sagaResultMapping": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "resultKind",
        "code",
        "outputs"
      ],
      "properties": {
        "resultKind": {
          "$ref": "saga-ir-v1.schema.json#/$defs/resultKind"
        },
        "code": {
          "$ref": "#/$defs/id"
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/sagaResultOutput"
          }
        }
      },
      "description": "Exact coverage of the five Saga results and step outcomes. Only succeeded maps to success/continue; rejected-before-effects and compensated map to business-rejection with stop/manual-recovery. recovery-required maps to infrastructure-failure/manual-recovery; outcome-unknown to unknown-effect/manual-recovery. Only continuing results publish writes, mapped from typed completion event payload fields. v1 has no resolved-policy-ref; compensation is never implicitly success or resolved."
    },
    "invokeSaga": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "ref",
        "args",
        "transactionIdentity",
        "start",
        "completionMode",
        "results"
      ],
      "properties": {
        "ref": {
          "$ref": "#/$defs/sagaRef"
        },
        "args": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "transactionIdentity": {
          "$ref": "#/$defs/transactionIdentity"
        },
        "start": {
          "const": "durable-intent-before-start"
        },
        "completionMode": {
          "const": "await-terminal"
        },
        "results": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/sagaResultMapping"
          }
        }
      },
      "description": "Persist pinned ref, exact args/codec and derived identity as durable intent before requesting Saga start; replay reattaches using the same identity. Await a terminal confirmation before checkpointing success. RecoveryRequired and Unknown are controlled manual outcomes, never successful terminal completion. Contract declaration only."
    },
    "sagaStepExecution": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "invokeSaga",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "invokeSaga": {
          "$ref": "#/$defs/invokeSaga"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "childResultKind": {
      "enum": [
        "succeeded",
        "child-rejected",
        "child-failed",
        "recovery-required",
        "outcome-unknown"
      ]
    },
    "childResultMapping": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "resultKind",
        "code",
        "outputs"
      ],
      "properties": {
        "resultKind": {
          "$ref": "#/$defs/childResultKind"
        },
        "code": {
          "$ref": "#/$defs/id"
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/sagaResultOutput"
          }
        }
      },
      "description": "Exact coverage of the five child-run results. Only succeeded maps to success/continue and publishes writes from the child's durable completed-manifest fields. child-rejected (StartRun refused with a reason other than already-in-state) maps to business-rejection/stop; child-failed (RunFailedEvt) maps to business-rejection/stop. recovery-required maps to infrastructure-failure/manual-recovery; outcome-unknown to unknown-effect/manual-recovery. A rejected re-attach (already in state) is not a result kind — the host treats it as already-attached and keeps observing. Compensation is never stage recovery."
    },
    "childRunIdentity": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "derivation",
        "source",
        "stepId",
        "stageOccurrence",
        "conflict"
      ],
      "properties": {
        "derivation": {
          "const": "durable-parent-step"
        },
        "source": {
          "$ref": "#/$defs/identityRef"
        },
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "stageOccurrence": {
          "$ref": "#/$defs/identityRef"
        },
        "chunk": {
          "$ref": "#/$defs/identityRef"
        },
        "conflict": {
          "const": "reject-different-args"
        }
      },
      "description": "Host derives the child run identity from the parent operation key (a durable source token), the exact await step ID and a durable stage occurrence token, plus an optional chunk token. All tokens must be typed reads of durable initial inputs. No expressions, FQNs, clock, random, attempt or JVM generation. Re-attaching with the same identity is the only legal re-entry; different payload with the same identity is a conflict."
    },
    "awaitChildRun": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "childRun",
        "start",
        "completionMode",
        "results"
      ],
      "properties": {
        "childRun": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "planRef",
            "identity",
            "payload",
            "payloadCompatibility"
          ],
          "properties": {
            "planRef": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "pipelineId"
              ],
              "properties": {
                "pipelineId": {
                  "$ref": "#/$defs/id"
                }
              }
            },
            "identity": {
              "$ref": "#/$defs/childRunIdentity"
            },
            "payload": {
              "type": "array",
              "minItems": 1,
              "items": {
                "$ref": "#/$defs/read"
              }
            },
            "payloadCompatibility": {
              "const": "exact"
            }
          }
        },
        "start": {
          "const": "durable-intent-before-start"
        },
        "completionMode": {
          "const": "await-terminal"
        },
        "results": {
          "type": "array",
          "minItems": 5,
          "maxItems": 5,
          "items": {
            "$ref": "#/$defs/childResultMapping"
          }
        }
      },
      "description": "Persist the derived child identity and exact payload as durable intent before requesting StartRun; replay reattaches using the same identity (a refusal saying the run is already in state means attached, not conflict). Observe the child's terminal state on its durable journal; a mirrored progress record is derived and never authoritative. RunFailedEvt pauses with recovery-required; it never auto-compensates the parent. Contract declaration only."
    },
    "awaitChildRunStepExecution": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "awaitChildRun",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "awaitChildRun": {
          "$ref": "#/$defs/awaitChildRun"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "invocationCodec": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "version",
        "mapper"
      ],
      "properties": {
        "id": {
          "$ref": "saga-ir-v1.schema.json#/$defs/id"
        },
        "version": {
          "$ref": "saga-ir-v1.schema.json#/$defs/id"
        },
        "mapper": {
          "$ref": "saga-ir-v1.schema.json#/$defs/symbol"
        }
      }
    },
    "invocationBinding": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "stepId",
        "ref",
        "adapter",
        "runtime",
        "argsCodec",
        "resultCodec",
        "transactionIdentity"
      ],
      "properties": {
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "ref": {
          "$ref": "#/$defs/sagaRef"
        },
        "adapter": {
          "$ref": "saga-ir-v1.schema.json#/$defs/symbol"
        },
        "runtime": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "artifact",
            "apiMode",
            "entrypoint"
          ],
          "properties": {
            "artifact": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?![\\s\\S])"
            },
            "apiMode": {
              "const": "strict"
            },
            "entrypoint": {
              "$ref": "saga-ir-v1.schema.json#/$defs/symbol"
            }
          }
        },
        "argsCodec": {
          "$ref": "#/$defs/invocationCodec"
        },
        "resultCodec": {
          "$ref": "#/$defs/invocationCodec"
        },
        "transactionIdentity": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "mapper",
            "derivation",
            "payloadCompatibility"
          ],
          "properties": {
            "mapper": {
              "$ref": "saga-ir-v1.schema.json#/$defs/symbol"
            },
            "derivation": {
              "const": "durable-source-stage"
            },
            "payloadCompatibility": {
              "const": "exact"
            }
          }
        }
      },
      "description": "One adapter binding per invoked step; exact ref/runtime and args codec equality with the independently compiled Saga binding. Result codec version equals pinned args codec version. Type implementations agree exactly with Saga bindings; invoked Sagas in one pipeline must agree on shared nominal type contracts including referenced element/field bindings. Participant-resource mappings remain statically non-aliasing after args substitution. Runtime capabilities, participants, phase ports and completion mappers stay in sagaBindings, not duplicated here. Named adapters/mappers are never loaded or certified."
    },
    "slot": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "slot",
        "type"
      ],
      "properties": {
        "slot": {
          "$ref": "#/$defs/id"
        },
        "type": {
          "$ref": "#/$defs/id"
        }
      }
    },
    "childRunBinding": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "stepId",
        "planRef",
        "runtime",
        "journal"
      ],
      "properties": {
        "stepId": {
          "$ref": "#/$defs/id"
        },
        "planRef": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "pipelineId"
          ],
          "properties": {
            "pipelineId": {
              "$ref": "#/$defs/id"
            }
          }
        },
        "runtime": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "artifact",
            "apiMode"
          ],
          "properties": {
            "artifact": {
              "type": "string",
              "pattern": "^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+(?![\\s\\S])"
            },
            "apiMode": {
              "const": "strict"
            }
          }
        },
        "stateCodec": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "mapper"
          ],
          "properties": {
            "mapper": {
              "$ref": "saga-ir-v1.schema.json#/$defs/symbol"
            }
          }
        },
        "journal": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "pidPrefix"
          ],
          "properties": {
            "pidPrefix": {
              "$ref": "#/$defs/text"
            }
          }
        }
      },
      "description": "One child run binding per awaitChildRun step. The child plan is a separately compiled stages pipeline bound to monarch-persistence; the host derives the child persistence id from pidPrefix plus the derived run identity. The child's durable journal is the authoritative terminal-state source. Named mappers are never loaded or certified."
    },
    "typeBinding": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "implementation"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "implementation": {
          "$ref": "#/$defs/text"
        }
      }
    },
    "idempotency": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "mode"
      ],
      "properties": {
        "mode": {
          "enum": [
            "none",
            "keyed"
          ]
        },
        "key": {
          "$ref": "#/$defs/id"
        }
      },
      "description": "key is the name of an input slot (never source code). An external port requires keyed idempotency and a key whose reference is an initial input, stable across replay."
    },
    "port": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "implementation",
        "effect",
        "confirmation",
        "idempotency",
        "inputs",
        "outputs",
        "outcomes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "implementation": {
          "$ref": "#/$defs/text"
        },
        "effect": {
          "enum": [
            "pure",
            "external"
          ]
        },
        "confirmation": {
          "enum": [
            "checkpoint",
            "durable-ack"
          ]
        },
        "idempotency": {
          "$ref": "#/$defs/idempotency"
        },
        "inputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/slot"
          }
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/slot"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/portOutcome"
          }
        }
      },
      "description": "External effects require durable-ack, stable keyed idempotency, and an explicit unknown-effect outcome. Every port must declare success and infrastructure-failure. The compiler checks coverage/equality, not behavior of the implementation."
    },
    "codec": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "version",
        "compatibleVersions"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "version": {
          "$ref": "#/$defs/id"
        },
        "compatibleVersions": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/$defs/id"
          }
        }
      },
      "description": "compatibleVersions must include version. These are host codec declarations; they do not certify byte compatibility."
    },
    "pipelineBinding": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "pipelineId",
        "engine",
        "module",
        "codec",
        "types",
        "ports"
      ],
      "oneOf": [
        {
          "properties": {
            "ports": {
              "minItems": 1
            },
            "invocations": {
              "maxItems": 0
            }
          }
        },
        {
          "required": [
            "invocations"
          ]
        }
      ],
      "properties": {
        "pipelineId": {
          "$ref": "#/$defs/id"
        },
        "engine": {
          "const": "monarch-persistence/0.2.1"
        },
        "module": {
          "$ref": "#/$defs/text"
        },
        "codec": {
          "$ref": "#/$defs/codec"
        },
        "types": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/typeBinding"
          }
        },
        "ports": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/port"
          }
        },
        "invocations": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/invocationBinding"
          }
        },
        "childRuns": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/childRunBinding"
          }
        }
      }
    },
    "bindingDocument": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "schemaVersion",
        "pipelines"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc.execution-binding/v1"
        },
        "pipelines": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/pipelineBinding"
          }
        },
        "sourceMap": {
          "$ref": "#/$defs/sourceHints"
        },
        "sagaBindings": {
          "$ref": "saga-ir-v1.schema.json#/$defs/bindingDocument"
        }
      }
    },
    "canonicalEnvelope": {
      "type": "object",
      "required": [
        "schemaVersion",
        "workshop"
      ],
      "properties": {
        "schemaVersion": {
          "const": "truthsrc/v1"
        },
        "workshop": {
          "$ref": "#/$defs/text"
        },
        "pipelines": {
          "type": "array",
          "items": {
            "type": "object",
            "required": [
              "id",
              "name",
              "steps"
            ],
            "properties": {
              "id": {
                "$ref": "#/$defs/text"
              },
              "name": {
                "$ref": "#/$defs/text"
              },
              "steps": {
                "type": "array",
                "minItems": 1,
                "items": {
                  "type": "object",
                  "required": [
                    "id",
                    "name"
                  ],
                  "properties": {
                    "id": {
                      "$ref": "#/$defs/text"
                    },
                    "name": {
                      "$ref": "#/$defs/text"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "description": "Only the canonical envelope and pipeline identities are checked here. This does not replace validateTree or validate the rest of canonical. An execution property opts in, including a malformed/null declaration. Steps without a pipeline declaration may not carry execution."
    },
    "stepIr": {
      "oneOf": [
        {
          "$ref": "#/$defs/portStepIr"
        },
        {
          "$ref": "#/$defs/sagaStepIr"
        },
        {
          "$ref": "#/$defs/awaitChildRunStepIr"
        }
      ]
    },
    "sagaStepIr": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "ordinal",
        "invokeSaga",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "ordinal": {
          "type": "integer",
          "minimum": 0
        },
        "invokeSaga": {
          "$ref": "#/$defs/invokeSaga"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "portStepIr": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "ordinal",
        "port",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "ordinal": {
          "type": "integer",
          "minimum": 0
        },
        "port": {
          "$ref": "#/$defs/id"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "awaitChildRunStepIr": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "ordinal",
        "awaitChildRun",
        "reads",
        "writes",
        "outcomes"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "ordinal": {
          "type": "integer",
          "minimum": 0
        },
        "awaitChildRun": {
          "$ref": "#/$defs/awaitChildRun"
        },
        "reads": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/read"
          }
        },
        "writes": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/write"
          }
        },
        "outcomes": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/outcome"
          }
        }
      }
    },
    "bindingIr": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "engine",
        "module",
        "codec",
        "types",
        "ports"
      ],
      "oneOf": [
        {
          "properties": {
            "ports": {
              "minItems": 1
            },
            "invocations": {
              "maxItems": 0
            }
          }
        },
        {
          "required": [
            "invocations"
          ]
        }
      ],
      "properties": {
        "engine": {
          "const": "monarch-persistence/0.2.1"
        },
        "module": {
          "$ref": "#/$defs/text"
        },
        "codec": {
          "$ref": "#/$defs/codec"
        },
        "types": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/typeBinding"
          }
        },
        "ports": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/port"
          }
        },
        "invocations": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/invocationBinding"
          }
        },
        "childRuns": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/childRunBinding"
          }
        }
      }
    },
    "pipelineIr": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "readiness",
        "inputs",
        "outputs",
        "steps",
        "recovery",
        "admission",
        "binding"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "readiness": {
          "const": "contract-only"
        },
        "inputs": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/input"
          }
        },
        "outputs": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/output"
          }
        },
        "steps": {
          "type": "array",
          "minItems": 1,
          "items": {
            "$ref": "#/$defs/stepIr"
          }
        },
        "recovery": {
          "$ref": "#/$defs/recovery"
        },
        "admission": {
          "$ref": "#/$defs/admission"
        },
        "binding": {
          "$ref": "#/$defs/bindingIr"
        }
      }
    },
    "documentOnly": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "reason",
        "source"
      ],
      "properties": {
        "id": {
          "$ref": "#/$defs/text"
        },
        "reason": {
          "const": "execution-not-declared"
        },
        "source": {
          "$ref": "#/$defs/source"
        }
      }
    }
  }
});
