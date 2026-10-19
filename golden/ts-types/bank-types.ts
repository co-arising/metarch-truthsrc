// Generated from bank truth/inbox
// Generator: generators/ts-types/emit.mjs

/** Order credited event */
export interface OrderCredited {
  customerId: string;
  amount: number;
}

/** Abandon order command */
export interface AbandonOrder {
  customerId: string;
}
