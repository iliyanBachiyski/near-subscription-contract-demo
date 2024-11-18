export const FEE_MIN = 0.001; // 0.1%

export enum Plan {
  basic = 1,
  standard = 2,
  premium = 3,
}

export type PriceType = {
  [key: number]: { amount: number; token: string }; // Key is from PaymentDuration enum
};

export enum SubscriptionStatus {
  active = 1,
  inactive = 2,
}

export type AddSubscriptionRequest = {
  plan: Plan;
  paymentDuration: string; // Duration in nanoseconds
};

export type SubscriptionType = {
  plan: Plan;
  paymentDuration: bigint; // Duration in nanoseconds. Indicates when the next payment should be done
  lastPayment: bigint; // Unix timestamp in nanoseconds
  nextPayment: bigint; // Unix timestamp in nanoseconds
  status: SubscriptionStatus;
};
