// Find all our documentation at https://docs.near.org
import { NearBindgen, UnorderedMap, call, initialize, view } from "near-sdk-js";

enum PaymentDuration {
  monthly = 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
  yearly = 365 * 24 * 60 * 60 * 1000, // 365 days in milliseconds
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

type SubscriptionType = {
  plan: Plan;
  paymentDuration: PaymentDuration;
  lastPayment: "u64"; // Unix timestamp in milliseconds
  nextPayment: "u64"; // Unix timestamp in milliseconds
  status: SubscriptionStatus;
};

@NearBindgen({})
class Subscription {
  static schema = {
    subscriptions: {
      class: UnorderedMap,
      value: {
        plan: "u8",
        paymentDuration: "u64",
        lastPayment: "u64",
        nextPayment: "u64",
        status: "u8",
      },
    },
    supported_tokens: "string[]",
    prices: {
      class: UnorderedMap,
      value: {
        [Plan.basic]: {
          amount: "u64",
          token: "string",
        },
        [Plan.standard]: { amount: "u64", token: "string" },
        [Plan.premium]: { amount: "u64", token: "string" },
      },
    },
  };

  subscriptions: UnorderedMap<SubscriptionType> =
    new UnorderedMap<SubscriptionType>("uid-1");
  prices: UnorderedMap<PriceType> = new UnorderedMap<PriceType>("uid-2");
  supported_tokens: string[] = [];

  @initialize({ privateFunction: true })
  init({
    prices,
    supported_tokens,
  }: {
    prices: UnorderedMap<PriceType>;
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
  update_prices({ value }: { value: UnorderedMap<PriceType> }) {
    // TODO: validate params here
    this.prices = value;
  }

  @call({})
  add_subscription({ key, value }: { key: string; value: SubscriptionType }) {
    // TODO: validate params here
    this.subscriptions.set(key, value);
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

  @view({})
  get_subscriptions({
    from_index,
    limit,
  }: {
    from_index: number;
    limit: number;
  }) {
    return this.subscriptions.toArray().slice(from_index, limit);
  }
}
