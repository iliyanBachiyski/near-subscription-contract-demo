// Find all our documentation at https://docs.near.org
import { LookupMap, NearBindgen, assert, call, near, view } from "near-sdk-js";

import {
  DURATION_MAP,
  PaymentDuration,
  Plan,
  SubscriptionStatus,
} from "./types";
import { AddSubscriptionRequest, Subscription } from "./model";

/**
 * Subscription contract that allows users to subscribe to a service provider and make payments based on the subscription plan.
 * Every user should deploy this contract to their account to manage their subscriptions.
 * The contract is maintained by the user and the service provider.
 */
@NearBindgen({})
class SubscriptionContract {
  static schema = {
    subscriptions: {
      class: LookupMap,
      value: {
        plan: "number",
        paymentDuration: "bigint",
        paymentAmount: "number",
        paymentToken: "string",
        provider: "string",
        lastPayment: "bigint",
        nextPayment: "bigint",
        status: "number",
      },
    },
  };

  subscriptions: LookupMap<Subscription> = new LookupMap<Subscription>("uid-1");

  @call({ privateFunction: true })
  add_subscription({
    plan,
    paymentDuration,
    paymentAmount,
    paymentToken,
    provider,
  }: AddSubscriptionRequest) {
    // Assert that subscription does not exist
    assert(
      !this.subscriptions.containsKey(provider),
      "Subscription already exists"
    );
    // Assert that the plan is valid
    assert(Object.values(Plan).includes(plan), "Invalid plan");
    // Assert that the paymentDuration is valid
    assert(
      Object.values(PaymentDuration).includes(paymentDuration),
      "Invalid payment duration"
    );
    assert(paymentAmount > 0, "Payment amount should be greater than 0");
    // Assert that the provider is valid account ID
    // TODO: Find more robust way to validate account ID
    assert(
      provider.length > 0 &&
        (provider.endsWith(".near") || provider.length === 64),
      "Invalid provider account ID"
    );
    // TODO: probably need to validate payment token somehow
    // TODO: Probably initial payment should be done here
    const blockTimestamp = near.blockTimestamp();
    const subscription = new Subscription(
      plan,
      paymentDuration,
      paymentAmount,
      paymentToken,
      provider,
      blockTimestamp,
      blockTimestamp + BigInt(DURATION_MAP[paymentDuration].toString()),
      SubscriptionStatus.active
    );
    this.subscriptions.set(provider, subscription);
  }

  @call({ privateFunction: true })
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
    this.subscriptions.get(caller).status = SubscriptionStatus.inactive;
  }

  @view({})
  get_account_subscription({ provider }: { provider: string }): Subscription {
    return this.subscriptions.get(provider);
  }
}
