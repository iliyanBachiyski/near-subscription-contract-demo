// Find all our documentation at https://docs.near.org
import {
  LookupMap,
  NearBindgen,
  assert,
  call,
  near,
  view,
  initialize,
  NearPromise,
} from "near-sdk-js";

import {
  DURATION_MAP,
  PaymentDuration,
  Plan,
  SubscriptionStatus,
} from "./types";
import { AddSubscriptionRequest, Subscription } from "./model";

/**
 * Subscription contract that allows users to subscribe to a service provider and make payments based on the subscription plan.
 * Every service provider should deploy to manage their subscription users.
 */
@NearBindgen({})
class SubscriptionContract {
  static schema = {
    providerAddress: "string",
    subscriptions: {
      class: LookupMap,
      value: {
        plan: "number",
        paymentDuration: "bigint",
        paymentAmount: "bigint",
        paymentToken: "string",
        lastPayment: "bigint",
        nextPayment: "bigint",
        status: "number",
      },
    },
  };

  subscriptions: LookupMap<Subscription> = new LookupMap<Subscription>("uid-1");
  providerAddress: string = "";

  @initialize({ privateFunction: true })
  init({ providerAddress }: { providerAddress: string }) {
    // TODO: Validate provider address
    this.providerAddress = providerAddress;
  }

  @call({ payableFunction: true })
  pay_subscription() {
    const caller = near.predecessorAccountId();
    // Assert that the caller has a subscription
    assert(
      this.subscriptions.containsKey(caller),
      "Subscription does not exists"
    );
    const subscription = this.subscriptions.get(caller);
    const { status, nextPayment, paymentDuration, paymentAmount } =
      subscription;
    // Assert that the subscription is active
    assert(status === SubscriptionStatus.active, "Subscription is not active");
    const blockTimestamp = near.blockTimestamp();
    // Assert that the next payment is due
    assert(blockTimestamp >= nextPayment, "Payment is not due yet");
    const amount = near.attachedDeposit();
    // Assert that the payment amount is correct
    assert(amount.toString() === paymentAmount.toString(), "Incorrect amount");
    // Update the last payment and next payment
    this.subscriptions.set(caller, {
      ...subscription,
      lastPayment: blockTimestamp,
      nextPayment:
        blockTimestamp + BigInt(DURATION_MAP[paymentDuration].toString()),
    });
    return NearPromise.new(this.providerAddress).transfer(amount);
  }

  @call({})
  add_subscription({
    plan,
    paymentDuration,
    paymentAmount,
    paymentToken,
  }: AddSubscriptionRequest) {
    const caller = near.predecessorAccountId();
    // Assert that subscription does not exist
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
    assert(
      BigInt(paymentAmount) > 0,
      "Payment amount should be greater than 0"
    );
    // TODO: probably need to validate payment token somehow
    // TODO: Probably initial payment should be done here
    const blockTimestamp = near.blockTimestamp();
    const subscription = new Subscription(
      plan,
      paymentDuration,
      paymentAmount,
      paymentToken,
      blockTimestamp,
      blockTimestamp + BigInt(DURATION_MAP[paymentDuration].toString()),
      SubscriptionStatus.active
    );
    this.subscriptions.set(caller, subscription);
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
  get_account_subscription({ address }: { address: string }): Subscription {
    return this.subscriptions.get(address);
  }

  @view({})
  get_storage(): bigint {
    return near.storageUsage();
  }

  @view({})
  get_provider_address(): string {
    return this.providerAddress;
  }
}
