# Subscription NEAR Contract

The smart contract that allow users to create and manage their subscriptions in the NEAR network. Every service provider should upload their own contract: netflix.near, disney.near, storytel.near, etc

# Quickstart

1. Make sure you have installed [node.js](https://nodejs.org/en/download/package-manager/) >= 16.
2. Install the [`NEAR CLI`](https://github.com/near/near-cli#setup)
3. Run `npm install`

<br />

## 1. Build and Test the Contract

You can automatically compile and test the contract by running:

```bash
npm run build
```

<br />

## 2. Create an Account and Deploy the Contract

You can create a new account and deploy the contract by running:

```bash
near create-account <your-account.testnet> --useFaucet
near deploy <your-account.testnet> build/release/hello_near.wasm
```

<br />

## Subscriptions State example:

```js
{
  "iliyan.near": {
    plan: Plan.basic, // This variable will be used for fetching price details
    paymentDuration: PaymentDuration.monthly, // Will be used to calculate the nextPayment
    lastPayment: 1625680394000, // Unix timestamp in milliseconds
    nextPayment: 1640000000000, // Unix timestamp in milliseconds: will be calculated when payment event occurs based on the PaymentDuration
    status: SubscriptionStatus.active, // Maybe we can remove the user from the list if the subscription is inactive
  },
  "bob.near": {
    plan: Plan.standard,
    paymentDuration: PaymentDuration.monthly,
    lastPayment: 1610629000000,
    nextPayment: 1640000000000,
    status: SubscriptionStatus.active,
  },
  "alice.near": {
    plan: Plan.premium,
    paymentDuration: PaymentDuration.yearly,
    lastPayment: 1630000000000,
    nextPayment: 1640000000000,
    status: SubscriptionStatus.active
  },
}
```

<br />

## Prices State example:

```js
{
  [Plan.basic]: {
    [PaymentDuration.monthly]: {
      amount: 0.1,
      token: "NEAR", // NEAR || USDC || DAI || etc. The token should be part of supported_tokens array
    },
    [PaymentDuration.yearly]: {
      amount: 0.5,
      token: "NEAR",
    },
  },
  [Plan.standard]: {
    [PaymentDuration.monthly]: {
      amount: 0.2,
      token: "NEAR",
    },
    [PaymentDuration.yearly]: {
      amount: 1,
      token: "NEAR",
    },
  },
  [Plan.premium]: {
    [PaymentDuration.monthly]: {
      amount: 0.3,
      token: "NEAR",
    },
    [PaymentDuration.yearly]: {
      amount: 1.5,
      token: "NEAR",
    },
  },
}
```
