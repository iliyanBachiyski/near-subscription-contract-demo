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

import { Plan, SubscriptionStatus } from "./types";
import { AddSubscriptionRequest, Subscription } from "./model";

const MAX_PERCENTAGE = 100;
const MIN_PERCENTAGE = 0.01;
const PERCENTAGE_BASE = 10000; // Represents 100%

/**
 * Subscription contract that allows users to subscribe to a service provider and make payments based on the subscription plan.
 * Every service provider should deploy to manage their subscription users.
 */
@NearBindgen({})
class SubscriptionContract {
  static schema = {
    providerAddress: "string",
    fee: "number",
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
  fee: number = 0;

  @initialize({ privateFunction: true })
  init({ providerAddress, fee }: { providerAddress: string; fee: number }) {
    // TODO: Validate provider address
    this.providerAddress = providerAddress;
    // Assert that the fee is within the range
    assert(fee >= MIN_PERCENTAGE && fee <= MAX_PERCENTAGE, "Invalid fee");
    this.fee = fee;
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
    assert(amount == paymentAmount, "Incorrect amount");
    // Update the last payment and next payment
    this.subscriptions.set(caller, {
      ...subscription,
      lastPayment: blockTimestamp,
      nextPayment: blockTimestamp + paymentDuration,
    });
    // Calculate the amount to transfer to the provider
    const feeAmount =
      (amount * BigInt(this.fee * PERCENTAGE_BASE)) / BigInt(PERCENTAGE_BASE); // Parse fee to BigInt to avoid decimal issues
    const amountToTransfer = amount - feeAmount;
    // Transfer the payment to the provider
    return NearPromise.new(this.providerAddress).transfer(amountToTransfer);
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
    const parsedPaymentDuration = BigInt(paymentDuration);
    // Assert that the paymentDuration is valid
    assert(parsedPaymentDuration > 0, "Invalid payment duration");
    assert(
      BigInt(paymentAmount) > 0,
      "Payment amount should be greater than 0"
    );
    // TODO: probably need to validate payment token somehow
    // TODO: Probably initial payment should be done here
    const blockTimestamp = near.blockTimestamp();
    const subscription = new Subscription(
      plan,
      parsedPaymentDuration,
      paymentAmount,
      paymentToken,
      blockTimestamp,
      blockTimestamp + parsedPaymentDuration,
      SubscriptionStatus.active
    );
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

  @view({})
  get_fee(): number {
    return this.fee;
  }
}
