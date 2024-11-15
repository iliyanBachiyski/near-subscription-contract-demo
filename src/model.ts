import { PaymentDuration, SubscriptionStatus } from "./types";

export class Subscription {
  static schema = {
    plan: "number",
    paymentDuration: "bigint",
    paymentAmount: "number",
    paymentToken: "string",
    provider: "string",
    lastPayment: "bigint",
    nextPayment: "bigint",
    status: "number",
  };

  constructor(
    public plan: number, // Basic, Standard, Premium
    public paymentDuration: PaymentDuration, // Monthly, Yearly
    public paymentAmount: number, // Amount in paymentToken
    public paymentToken: string, // NEAR, USDC, DAI
    public provider: string, // Account ID of the provider
    public lastPayment: bigint, // Unix timestamp in nanoseconds
    public nextPayment: bigint, // Unix timestamp in nanoseconds
    public status: SubscriptionStatus // Active, Inactive
  ) {
    this.plan = plan;
    this.paymentDuration = paymentDuration;
    this.paymentAmount = paymentAmount;
    this.paymentToken = paymentToken;
    this.provider = provider;
    this.lastPayment = lastPayment;
    this.nextPayment = nextPayment;
    this.status = status;
  }
}

export type AddSubscriptionRequest = Omit<
  Subscription,
  "lastPayment" | "nextPayment" | "status"
>;
