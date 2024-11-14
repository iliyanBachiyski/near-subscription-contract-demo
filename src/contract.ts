// Find all our documentation at https://docs.near.org
import {
  NearBindgen,
  LookupMap,
  call,
  initialize,
  view,
  assert,
  near,
} from "near-sdk-js";

enum PaymentDuration {
  monthly = 30 * 24 * 60 * 60 * 1000 * 1000 * 1000, // 30 days in nanoseconds
  yearly = 365 * 24 * 60 * 60 * 1000 * 1000 * 1000, // 365 days in nanoseconds
}

enum Plan {
  basic = 1,
  standard = 2,
  premium = 3,
}

interface PriceType {
  [key: number]: { amount: number; token: string }; // Validate key and token - key should mach one of the Plan values and token should be one of the supported tokens
}

enum SubscriptionStatus {
  active = 1,
  inactive = 2,
}

type AddSubscriptionRequest = {
  plan: Plan;
  paymentDuration: PaymentDuration;
};

type SubscriptionType = {
  plan: Plan;
  paymentDuration: PaymentDuration;
  lastPayment: bigint; // Unix timestamp in nanoseconds
  nextPayment: bigint; // Unix timestamp in nanoseconds
  status: SubscriptionStatus;
};

@NearBindgen({})
class Subscription {
  static schema = {
    subscriptions: {
      class: LookupMap,
      value: {
        plan: "u8",
        paymentDuration: BigInt,
        lastPayment: BigInt,
        nextPayment: BigInt,
        status: "u8",
      },
    },
    supported_tokens: "string[]",
    prices: {
      class: LookupMap,
      value: {
        amount: "u64",
        token: "string",
      },
    },
  };

  subscriptions: LookupMap<SubscriptionType> = new LookupMap<SubscriptionType>(
    "uid-1"
  );
  prices: LookupMap<PriceType> = new LookupMap<PriceType>("uid-2");
  supported_tokens: string[] = [];

  @initialize({ privateFunction: true })
  init({
    prices,
    supported_tokens,
  }: {
    prices: LookupMap<PriceType>;
    supported_tokens: string[];
  }) {
    this.supported_tokens = supported_tokens; // ["NEAR", "USDC", "DAI"]
    this.prices = prices;
  }

  @call({ privateFunction: true })
  update_supported_tokens({ value }: { value: string[] }) {
    // TODO: validate params here
    this.supported_tokens = value;
  }

  @call({ privateFunction: true })
  update_prices({ value }: { value: LookupMap<PriceType> }) {
    // TODO: validate params here
    this.prices = value;
  }

  @call({})
  add_subscription({
    key,
    value,
  }: {
    key: string;
    value: AddSubscriptionRequest;
  }) {
    const caller = near.predecessorAccountId();
    // Assert that the caller is the same as the key
    assert(caller === key, "Can not add subscription for another account");
    // Assert that the caller is not already in the map
    assert(
      !this.subscriptions.containsKey(caller),
      "Subscription already exists"
    );
    const { plan, paymentDuration } = value;
    // Assert that the plan is valid
    assert(Object.values(Plan).includes(plan), "Invalid plan");
    // Assert that the paymentDuration is valid
    assert(
      Object.values(PaymentDuration).includes(paymentDuration),
      "Invalid payment duration"
    );
    // Assert that the plan is supported
    assert(this.prices.containsKey(plan.toString()), "Plan not supported");
    // TODO: Probably initial payment should be done here
    const blockTimestamp = near.blockTimestamp();
    const subscription: SubscriptionType = {
      plan,
      paymentDuration,
      lastPayment: blockTimestamp,
      nextPayment: blockTimestamp + BigInt(paymentDuration.toString()),
      status: SubscriptionStatus.active,
    };
    this.subscriptions.set(key, subscription);
  }

  @call({})
  remove_subscription({ account }: { account: string }) {
    // TODO: validate the account here - it should match the sender and should exist in the map
    this.subscriptions.remove(account);
  }

  @view({})
  get_account_subscription({ account }: { account: string }): SubscriptionType {
    return this.subscriptions.get(account);
  }
}
