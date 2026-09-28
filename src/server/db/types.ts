// Type helpers so functions can accept either the database or an open transaction.

import type { Database } from "./index";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;
