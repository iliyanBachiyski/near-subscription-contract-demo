import { SubscriptionStatus } from "./types";

export class Subscription {
  constructor(
    public planId: string, // Changed from number to string to match planId
    public duration: bigint, // Renamed from paymentDuration for consistency
    public amount: bigint, // Renamed from paymentAmount for consistency
    public token: string, // Renamed from paymentToken for consistency
    public lastPayment: bigint, // Unix timestamp in nanoseconds
    public nextPayment: bigint, // Unix timestamp in nanoseconds
    public status: SubscriptionStatus // Active, Inactive
  ) {}
}
