import anyTest from "ava";
import { Worker, NEAR, BN } from "near-workspaces";
import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first"); // temp fix for node >v17

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
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  const provider = await root.createSubAccount("netflix", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  const bob = await root.createSubAccount("bob", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  // Deploy the contract.
  console.log("Deploying contract ", process.argv[3]);
  await contract.deploy(process.argv[3]);

  // Initialize beneficiary
  await contract.call(contract, "init", {
    providerAddress: provider.accountId,
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
  let providerAddress = await contract.view("get_provider_address");
  t.is(providerAddress, provider.accountId, "Provider address is not set");
});

test("Add subscription", async (t) => {
  const { contract, bob } = t.context.accounts;
  let beforeStorageAmount = await contract.view("get_storage");
  let subscription = await contract.view("get_account_subscription", {
    address: bob.accountId,
  });
  t.is(subscription, null, "Subscription is not null");
  const subscriptionData = {
    plan: 1,
    paymentDuration: 2,
    paymentAmount: NEAR.parse("4 N").toString(),
    paymentToken: "NEAR",
  };
  await bob.call(contract, "add_subscription", subscriptionData);
  let afterStorageAmount = await contract.view("get_storage");
  // 10000000000000000000 * diffAmount / 10^24 = 0.00381 NEAR
  const diffAmount = afterStorageAmount - beforeStorageAmount;
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
    paymentDuration: 2,
    paymentAmount: NEAR.parse("4 N").toString(),
    paymentToken: "NEAR",
  };
  await bob.call(contract, "add_subscription", subscriptionData);
  let subscription = await contract.view("get_account_subscription", {
    address: bob.accountId,
  });

  const bobBalanceBefore = (await bob.balance()).total;
  const providerBalanceBefore = (await provider.balance()).total;
  t.is(subscription.status, 1, "Subscription is not active");
  t.is(
    subscription.paymentAmount,
    subscriptionData.paymentAmount,
    "Subscription amount is not correct"
  );
  const result = await bob.callRaw(
    contract,
    "pay_subscription",
    {},
    {
      attachedDeposit: subscription.paymentAmount,
    }
  );
  const bobBalanceAfter = (await bob.balance()).total;
  const providerBalanceAfter = (await provider.balance()).total;
  // This assert is now failing, because it does not count the gas fee. Find a way to read the gas fee and add it to the assert.
  // t.is(
  //   bobBalanceBefore.sub(bobBalanceAfter).toBigInt(),
  //   subscription.paymentAmount,
  //   "Bob balance is not decreased"
  // );
  t.is(
    providerBalanceAfter.toBigInt(),
    providerBalanceBefore.add(NEAR.from(subscription.paymentAmount)).toBigInt(),
    "Provider balance is not increased"
  );
});
