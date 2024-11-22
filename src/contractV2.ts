// Find all our documentation at https://docs.near.org
import {
  AccountId,
  assert,
  call,
  initialize,
  LookupMap,
  near,
  NearBindgen,
  NearPromise,
  validateAccountId,
  view,
  Vector,
} from "near-sdk-js";

import { Subscription } from "./model";
import { SubscriptionStatus, SubscriptionPlan } from "./types";

// Fee-related constants
const BASIS_POINTS = 10000; // 100.00% = 10000 basis points
const MAX_BPS = 10000; // 100.00%
const MIN_BPS = 1; // 0.01%

// FT-related constants
const FT_STORAGE_DEPOSIT = BigInt("12500000000000000000000"); // 0.0125 NEAR required for FT storage
const FT_TRANSFER_GAS = BigInt("10000000000000"); // 10 TGas for FT transfers
const FT_TRANSFER_DEPOSIT = BigInt("1"); // 1 yoctoNEAR required for FT transfers

/**
 * Subscription contract that allows users to subscribe to a service provider and make payments based on the subscription plan.
 * Every service provider should deploy to manage their subscription users.
 */
@NearBindgen({})
export class SubscriptionContract {
  private plans: LookupMap<SubscriptionPlan>;
  private planIds: Vector<string>;
  private subscriptions: LookupMap<Subscription>;
  private providerAddress: AccountId;
  private fee: number;

  constructor() {
    this.plans = new LookupMap<SubscriptionPlan>("plans_plans");
    this.planIds = new Vector<string>("plans_ids");
    this.subscriptions = new LookupMap<Subscription>("subscriptions");
    this.providerAddress = "";
    this.fee = 0;
  }

  @initialize({ privateFunction: true })
  init({
    providerAddress,
    fee,
    initialPlans,
  }: {
    providerAddress: AccountId;
    fee: number;
    initialPlans: SubscriptionPlan[];
  }) {
    assert(validateAccountId(providerAddress), "Invalid provider address");
    assert(
      fee >= MIN_BPS && fee <= MAX_BPS,
      `Fee must be between ${MIN_BPS} (0.01%) and ${MAX_BPS} (100.00%) basis points`
    );
    assert(initialPlans.length > 0, "At least one plan is required");

    this.providerAddress = providerAddress;
    this.fee = fee;

    // Add initial plans
    for (const plan of initialPlans) {
      this.add_plan(plan);
    }
  }

  // Plan Management - Write Methods
  @call({})
  add_plan(params: SubscriptionPlan) {
    this.assertProviderOrOwner();
    const { id, name, duration, amount, token } = params;

    assert(!this.plans.get(id), "Plan already exists");
    this.validateToken(token);

    const plan = {
      id,
      name,
      duration: BigInt(duration),
      amount: BigInt(amount),
      token,
      isActive: true,
    };

    this.plans.set(id, plan);
    this.planIds.push(id);
  }

  @call({})
  update_plan(params: {
    id: string;
    name?: string;
    duration?: string;
    amount?: string;
    token?: string;
    isActive?: boolean;
  }) {
    this.assertProviderOrOwner();
    const plan = this.plans.get(params.id);
    assert(plan, "Plan does not exist");

    if (params.token) {
      this.validateToken(params.token);
    }

    const updatedPlan = {
      ...plan,
      name: params.name ?? plan.name,
      duration: params.duration ? BigInt(params.duration) : plan.duration,
      amount: params.amount ? BigInt(params.amount) : plan.amount,
      token: params.token ?? plan.token,
      isActive: params.isActive ?? plan.isActive,
    };

    this.plans.set(params.id, updatedPlan);
  }

  @call({})
  remove_plan({ id }: { id: string }) {
    this.assertProviderOrOwner();
    assert(this.plans.get(id), "Plan does not exist");
    this.update_plan({ id, isActive: false });
  }

  // Subscription Management - Write Methods
  @call({ payableFunction: true })
  add_subscription({ planId }: { planId: string }) {
    const caller = near.predecessorAccountId();
    assert(
      !this.subscriptions.containsKey(caller),
      "Subscription already exists"
    );

    const plan = this.validatePlan(planId);
    const blockTimestamp = near.blockTimestamp();

    if (plan.token === "near") {
      // For NEAR payments, verify attached deposit matches payment amount
      assert(
        near.attachedDeposit() === plan.amount,
        "Attached deposit must match plan amount"
      );

      // Calculate fee and provider amount
      const feeAmount = this.calculateFee(plan.amount);
      const amountToTransfer = plan.amount - feeAmount;

      // Create subscription in active state
      const subscription = new Subscription(
        planId,
        plan.duration,
        plan.amount,
        plan.token,
        blockTimestamp,
        blockTimestamp + plan.duration,
        SubscriptionStatus.active
      );

      this.subscriptions.set(caller, subscription);

      // Transfer initial payment to provider
      return NearPromise.new(this.providerAddress).transfer(amountToTransfer);
    } else {
      // For FT payments
      assert(
        near.attachedDeposit() >= BigInt(FT_STORAGE_DEPOSIT),
        "Not enough deposit for FT storage setup"
      );

      // Register contract with FT token
      const storagePromise = NearPromise.new(plan.token).functionCall(
        "storage_deposit",
        JSON.stringify({ account_id: near.currentAccountId() }),
        near.attachedDeposit(),
        FT_TRANSFER_GAS
      );

      // Calculate fee and provider amount
      const feeAmount = this.calculateFee(plan.amount);
      const amountToTransfer = plan.amount - feeAmount;

      // Create subscription in active state
      const subscription = new Subscription(
        planId,
        plan.duration,
        plan.amount,
        plan.token,
        blockTimestamp,
        blockTimestamp + plan.duration,
        SubscriptionStatus.active
      );

      this.subscriptions.set(caller, subscription);

      // Transfer FT tokens to provider
      const transferPromise = NearPromise.new(plan.token).functionCall(
        "ft_transfer_call",
        JSON.stringify({
          receiver_id: this.providerAddress,
          amount: amountToTransfer.toString(),
          msg: "",
        }),
        FT_TRANSFER_DEPOSIT,
        FT_TRANSFER_GAS
      );

      return storagePromise.then(transferPromise);
    }
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

  @call({ payableFunction: true })
  pay_subscription() {
    const caller = near.predecessorAccountId();
    assert(
      this.subscriptions.containsKey(caller),
      "Subscription does not exists"
    );

    const subscription = this.subscriptions.get(caller);
    assert(
      subscription.status === SubscriptionStatus.active,
      "Subscription is not active"
    );

    // Get the plan to verify current amounts and token
    const plan = this.validatePlan(subscription.planId);

    const blockTimestamp = near.blockTimestamp();
    assert(
      blockTimestamp >= subscription.nextPayment,
      "Payment is not due yet"
    );

    if (plan.token === "near") {
      // For NEAR payments
      assert(
        near.attachedDeposit() === plan.amount,
        "Attached deposit must match plan amount"
      );

      // Calculate fee and provider amount
      const feeAmount = this.calculateFee(plan.amount);
      const amountToTransfer = plan.amount - feeAmount;

      // Update subscription next payment date
      this.subscriptions.set(caller, {
        ...subscription,
        lastPayment: blockTimestamp,
        nextPayment: blockTimestamp + plan.duration,
      });

      // Transfer payment to provider
      return NearPromise.new(this.providerAddress).transfer(amountToTransfer);
    } else {
      // For FT payments
      assert(
        near.attachedDeposit() >= BigInt(FT_TRANSFER_DEPOSIT),
        "Requires attached deposit of at least 1 yoctoNEAR"
      );

      // Calculate fee and provider amount
      const feeAmount = this.calculateFee(plan.amount);
      const amountToTransfer = plan.amount - feeAmount;

      // Update subscription next payment date
      this.subscriptions.set(caller, {
        ...subscription,
        lastPayment: blockTimestamp,
        nextPayment: blockTimestamp + plan.duration,
      });

      // Transfer FT tokens to provider
      return NearPromise.new(plan.token).functionCall(
        "ft_transfer_call",
        JSON.stringify({
          receiver_id: this.providerAddress,
          amount: amountToTransfer.toString(),
          msg: "",
        }),
        FT_TRANSFER_DEPOSIT,
        FT_TRANSFER_GAS
      );
    }
  }

  // Subscription Management - View Methods
  @view({})
  get_account_subscription({ address }: { address: string }): Subscription {
    return this.subscriptions.get(address);
  }

  // Contract Information - View Methods
  @view({})
  get_provider_address(): string {
    return this.providerAddress;
  }

  @view({})
  get_fee(): number {
    return this.fee;
  }

  @view({})
  get_storage(): bigint {
    return near.storageUsage();
  }

  // Plan Management - View Methods
  @view({})
  get_plan({ id }: { id: string }): SubscriptionPlan | null {
    return this.plans.get(id);
  }

  @view({})
  get_active_plans(): SubscriptionPlan[] {
    const plans: SubscriptionPlan[] = [];
    const totalPlans = this.planIds.length;
    for (let i = 0; i < totalPlans; i++) {
      const id = this.planIds.get(i);
      const plan = this.plans.get(id);
      if (plan.isActive) {
        plans.push(plan);
      }
    }
    return plans;
  }

  // Private Helper Methods
  private calculateFee(amount: bigint): bigint {
    return (amount * BigInt(this.fee)) / BigInt(BASIS_POINTS);
  }

  private assertProviderOrOwner() {
    const caller = near.predecessorAccountId();
    assert(
      caller === this.providerAddress || caller === near.currentAccountId(),
      "Only contract owner or provider can perform this action"
    );
  }

  private validatePlan(planId: string): SubscriptionPlan {
    const plan = this.get_plan({ id: planId });
    assert(plan !== null, "Plan does not exist");
    assert(plan.isActive, "Plan is not active");
    return plan;
  }

  private validateToken(token: string): void {
    const normalizedToken = token.toLowerCase();
    assert(
      normalizedToken === "near" || validateAccountId(token),
      `Invalid token address: ${token}. Must be 'near' or a valid contract account ID`
    );
  }
}
