import type { Principal } from "@icp-sdk/core/principal";

/**
 * Extended payment types for manual approval flow.
 * These are not in the auto-generated backend.ts, so we define them here.
 */
export type PaymentStatus =
  | { pending: null }
  | { approved: null }
  | { rejected: null };

export interface PendingPayment {
  propertyId: string;
  transactionId: string;
  customerPrincipal: Principal;
  amount: bigint;
  timestamp: bigint;
  status: PaymentStatus;
}
