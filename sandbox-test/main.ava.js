import anyTest from "ava";
import { setDefaultResultOrder } from "dns";
import { NEAR, Worker } from "near-workspaces";
setDefaultResultOrder("ipv4first"); // temp fix for node >v17

// Initialize beneficiary
const validPrices = {
  1: {
    1: {
      amount: 0.1,
      token: "NEAR", // NEAR || USDC || DAI || etc. The token should be part of supported_tokens array
    },
    2: {
      amount: 0.5,
      token: "NEAR",
    },
  },
  2: {
    1: {
      amount: 0.2,
      token: "NEAR",
    },
    2: {
      amount: 1,
      token: "NEAR",
    },
  },
  3: {
    1: {
      amount: 0.3,
      token: "NEAR",
    },
    2: {
      amount: 1.5,
      token: "NEAR",
    },
  },
};
const supported_tokens = ["NEAR"];

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

  const contract = await root.createSubAccount("contract", {
    initialBalance: NEAR.parse("30 N").toJSON(),
  });

  // Deploy the contract.
  await contract.deploy(process.argv[2]);

  // Initialize beneficiary
  await contract.call(contract, "init", {
    prices: validPrices,
    supported_tokens,
  });

  // Save state for test runs, it is unique for each test
  t.context.accounts = { root, contract, alice };
});

test.afterEach.always(async (t) => {
  await t.context.worker.tearDown().catch((error) => {
    console.log("Failed to stop the Sandbox:", error);
  });
});

test("Read prices by plan", async (t) => {
  const { contract } = t.context.accounts;
  const prices = await contract.view("get_price_by_plan", { plan: 1 });
  t.is(Object.values(prices).length, 2, "Prices are not correctly initialized");
  const firstPrice = prices["1"];
  const secondPrice = prices["2"];
  t.is(
    firstPrice.amount,
    prices[1].amount,
    "First price is not correctly initialized"
  );
  t.is(firstPrice.token, "NEAR", "First price is not correctly initialized");
  t.is(
    secondPrice.amount,
    prices[2].amount,
    "First price is not correctly initialized"
  );
  t.is(secondPrice.token, "NEAR", "Second price is not correctly initialized");
});

test("Read supported tokens", async (t) => {
  const { contract } = t.context.accounts;
  const tokens = await contract.view("get_supported_tokens", {});
  t.is(Object.values(tokens).length, 1, "Tokens are not correctly initialized");
  const token = tokens[0];
  t.is(token, supported_tokens[0], "First token is not correctly initialized");
});

test("Add subscription", async (t) => {
  const { alice, contract } = t.context.accounts;
  const subscriptionData = {
    plan: 3,
    paymentDuration: "2"
  }
  await alice.call(contract, "add_subscription", subscriptionData);
  const subscription = await contract.view("get_account_subscription", {
    account: alice.accountId,
  });
  t.is(subscription.status, 1);
  t.is(subscription.plan, 3);
  t.is(subscription.paymentDuration, subscriptionData.paymentDuration);
  t.is(BigInt(subscription.nextPayment) - BigInt(subscription.lastPayment), BigInt(subscriptionData.paymentDuration));
});

test("Remove subscription", async (t) => {
  const { alice, contract } = t.context.accounts;
  const subscriptionData = {
    plan: 3,
    paymentDuration: "2"
  }
  await alice.call(contract, "add_subscription", subscriptionData);
  let subscription = await contract.view("get_account_subscription", {
    account: alice.accountId,
  });
  t.is(subscription.status, 1);
  await alice.call(contract, "remove_subscription", {});
  const updatedSubscription = await contract.view("get_account_subscription", {
    account: alice.accountId,
  });
  t.is(updatedSubscription.status, 2);
});
