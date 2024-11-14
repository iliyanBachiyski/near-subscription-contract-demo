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

import {
  SubscriptionType,
  PriceType,
  AddSubscriptionRequest,
  Plan,
  PaymentDuration,
  SubscriptionStatus,
  DURATION_MAP,
} from "./types";

@NearBindgen({})
class Subscription {
  static schema = {
    subscriptions: {
      class: LookupMap,
      value: {
        plan: "u8",
        paymentDuration: "bigint",
        lastPayment: "bigint",
        nextPayment: "bigint",
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
    prices: { [key: number]: PriceType };
    supported_tokens: string[];
  }) {
    this.supported_tokens = supported_tokens; // ["NEAR", "USDC", "DAI"]
    Object.keys(prices).forEach((key) => {
      this.prices.set(key, prices[parseInt(key)]);
    });
  }

  @call({ privateFunction: true })
  update_supported_tokens({ value }: { value: string[] }) {
    // TODO: validate params here
    this.supported_tokens = value;
  }

  @call({ privateFunction: true })
  update_prices({ value }: { value: { [key: number]: PriceType } }) {
    Object.keys(value).forEach((key) => {
      this.prices.set(key, value[parseInt(key)]);
    });
  }

  @call({})
  add_subscription({ plan, paymentDuration }: AddSubscriptionRequest) {
    const caller = near.predecessorAccountId();
    // Assert that the caller is not already in the map
    assert(
      !this.subscriptions.containsKey(caller),
      "Subscription already exists"
    );
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
      nextPayment:
        blockTimestamp + BigInt(DURATION_MAP[paymentDuration].toString()),
      status: SubscriptionStatus.active,
    };
    this.subscriptions.set(caller, subscription);
  }

  @call({})
  remove_subscription() {
    const caller = near.predecessorAccountId();
    // Assert that the caller has a subscription
    assert(
      this.subscriptions.containsKey(caller),
      "Subscription does not exists"
    );
    // Assert that the subscription is active
    assert(
      this.subscriptions.get(caller).status === SubscriptionStatus.active,
      "Subscription is not active"
    );
    const subscription: SubscriptionType = {
      ...this.subscriptions.get(caller),
      status: SubscriptionStatus.inactive,
    };
    this.subscriptions.set(caller, subscription);
  }

  @view({})
  get_account_subscription({ account }: { account: string }): SubscriptionType {
    return this.subscriptions.get(account);
  }

  @view({})
  get_price_by_plan({ plan }: { plan: Plan }): PriceType {
    return this.prices.get(plan.toString());
  }

  @view({})
  get_supported_tokens(): string[] {
    return this.supported_tokens;
  }
}
