const MONTH_DURATION = 30 * 24 * 60 * 60 * 1000 * 1000 * 1000; // 30 days in nanoseconds
const YEAR_DURATION = 365 * 24 * 60 * 60 * 1000 * 1000 * 1000; // 365 days in nanoseconds

export enum PaymentDuration {
  month = 1,
  year = 2,
}

export const DURATION_MAP = {
  [PaymentDuration.month]: MONTH_DURATION,
  [PaymentDuration.year]: YEAR_DURATION,
};

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
  paymentDuration: PaymentDuration;
};

export type SubscriptionType = {
  plan: Plan;
  paymentDuration: PaymentDuration;
  lastPayment: bigint; // Unix timestamp in nanoseconds
  nextPayment: bigint; // Unix timestamp in nanoseconds
  status: SubscriptionStatus;
};
