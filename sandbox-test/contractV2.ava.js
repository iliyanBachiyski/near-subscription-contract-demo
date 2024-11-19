import anyTest from "ava";
import { setDefaultResultOrder } from "dns";
import { BN, DECIMALS, NEAR, Worker } from "near-workspaces";
setDefaultResultOrder("ipv4first"); // temp fix for node >v17

const CONTRACT_FEE = 0.025;
const PAYMENT_AMOUNT = NEAR.parse("12 N").toString();
const INITIAL_WALLET_BALANCE_AMOUNT = 42;
const INITIAL_WALLET_BALANCE_NEAR = NEAR.parse(
  `${INITIAL_WALLET_BALANCE_AMOUNT} N`
);

/**
 *  @typedef {import('near-workspaces').NearAccount} NearAccount
 *  @type {import('ava').TestFn<{worker: Worker, accounts: Record<string, NearAccount>}>}
 */
const test = anyTest;

test.beforeEach(async (t) => {
  // Init the worker and start a Sandbox server
  const worker = (t.context.worker = await Worker.init());

  const root = worker.rootAccount;

  const contract = await root.createSubAccount("subscription", {
    initialBalance: INITIAL_WALLET_BALANCE_NEAR.toJSON(),
  });

  const provider = await root.createSubAccount("netflix", {
    initialBalance: INITIAL_WALLET_BALANCE_NEAR.toJSON(),
  });

  const bob = await root.createSubAccount("bob", {
    initialBalance: INITIAL_WALLET_BALANCE_NEAR.toJSON(),
  });

  // Deploy the contract.
  console.log("Deploying contract ", process.argv[3]);
  await contract.deploy(process.argv[3]);

  // Initialize beneficiary
  await contract.call(contract, "init", {
    providerAddress: provider.accountId,
    fee: CONTRACT_FEE,
  });

  // Save state for test runs, it is unique for each test
  t.context.accounts = { root, contract, provider, bob };
});

test.afterEach.always(async (t) => {
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("Check contract initialization", async (t) => {
  const { contract, provider } = t.context.accounts;
  const providerAddress = await contract.view("get_provider_address");
  const fee = await contract.view("get_fee");
  t.is(providerAddress, provider.accountId, "Provider address is not set");
  t.is(fee, CONTRACT_FEE, "Provider address is not set");
});

test("Add subscription", async (t) => {
  const { contract, bob } = t.context.accounts;
  // const beforeStorageAmount = await contract.view("get_storage");
  let subscription = await contract.view("get_account_subscription", {
    address: bob.accountId,
  });
  t.is(subscription, null, "Subscription is not null");
  const subscriptionData = {
    plan: 1,
    paymentDuration: "2",
    paymentAmount: PAYMENT_AMOUNT,
    paymentToken: "NEAR",
  };
  await bob.call(contract, "add_subscription", subscriptionData);
  // const afterStorageAmount = await contract.view("get_storage");
  // 10000000000000000000 * diffAmount / 10^24 = 0.00381 NEAR
  // const diffAmount = afterStorageAmount - beforeStorageAmount;
  // console.log("Storage amount diff -> ", diffAmount);
  subscription = await contract.view("get_account_subscription", {
    address: bob.accountId,
  });

  t.is(
    subscription.plan,
    subscriptionData.plan,
    "Subscription plan is not set"
  );
  t.is(
    subscription.paymentDuration,
    subscriptionData.paymentDuration,
    "Subscription duration is not set"
  );
  t.is(
    subscription.paymentAmount,
    subscriptionData.paymentAmount,
    "Subscription amount is not set"
  );
  t.is(
    subscription.paymentToken,
    subscriptionData.paymentToken,
    "Subscription token is not set"
  );
});

test("Pay subscription", async (t) => {
  const { contract, bob, provider } = t.context.accounts;
  const subscriptionData = {
    plan: 1,
    paymentDuration: "2",
    paymentAmount: PAYMENT_AMOUNT,
    paymentToken: "NEAR",
  };
  await bob.call(contract, "add_subscription", subscriptionData);
  let subscription = await contract.view("get_account_subscription", {
    address: bob.accountId,
  });
  const providerBalanceBefore = (await provider.balance()).total;
  t.is(subscription.status, 1, "Subscription is not active");
  t.is(
    subscription.paymentAmount,
    subscriptionData.paymentAmount,
    "Subscription amount is not correct"
  );
  await bob.call(
    contract,
    "pay_subscription",
    {},
    {
      attachedDeposit: subscription.paymentAmount,
    }
  );
  const providerBalanceAfter = (await provider.balance()).total;
  const parsedSubscriptionAmount = new BN(subscription.paymentAmount)
    .div(new BN(10).pow(new BN(DECIMALS)))
    .toNumber();
  const feeAmount = parsedSubscriptionAmount * CONTRACT_FEE;
  const providerAmount = parsedSubscriptionAmount - feeAmount;
  const expectedProviderAfter = NEAR.parse(
    `${INITIAL_WALLET_BALANCE_AMOUNT + providerAmount} N`
  ).toBigInt(); // 30 N initial balance + 3.6 N subscription amount.
  const providerBalanceDiff =
    providerBalanceAfter.toBigInt() - providerBalanceBefore.toBigInt();
  t.is(
    providerBalanceAfter.toBigInt(),
    expectedProviderAfter,
    "Provider balance is not increased correctly"
  );
  t.is(
    providerBalanceDiff,
    NEAR.parse(`${providerAmount} N`).toBigInt(),
    "Expected provider balance diff is not correct"
  );
});
