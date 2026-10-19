-- Generated from bank aggregates

CREATE TABLE customer_order (
  customer_id TEXT PRIMARY KEY,
  chain TEXT,
  terminal_state TEXT,
  amount DECIMAL
);
