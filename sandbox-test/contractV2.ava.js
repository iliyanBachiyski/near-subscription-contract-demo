import anyTest from "ava";
import { Worker, NEAR } from "near-workspaces";
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

  const alice = await root.createSubAccount("alice", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  // Deploy the contract.
  console.log("Deploying contract ", process.argv[3]);
  await alice.deploy(process.argv[3]);

  // Save state for test runs, it is unique for each test
  t.context.accounts = { root, alice };
});

test.afterEach.always(async (t) => {
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("Add subscription", async (t) => {
  const { alice } = t.context.accounts;
  const subscriptionProvider = "netflix.near";
  let subscription = await alice.view("get_account_subscription", {
    provider: subscriptionProvider,
  });
  t.is(subscription, null, "Subscription is not null");
  const subscriptionData = {
    plan: 1,
    paymentDuration: 2,
    paymentAmount: 50,
    paymentToken: "USDC",
    provider: subscriptionProvider,
  };
  await alice.call(alice, "add_subscription", subscriptionData);
  subscription = await alice.view("get_account_subscription", {
    provider: subscriptionProvider,
  });

  t.is(subscription.plan, 1, "Subscription plan is not set");
  t.is(subscription.paymentDuration, 2, "Subscription duration is not set");
  t.is(subscription.paymentAmount, 50, "Subscription amount is not set");
  t.is(subscription.paymentToken, "USDC", "Subscription token is not set");
  t.is(
    subscription.provider,
    subscriptionProvider,
    "Subscription provider is not set"
  );
});
