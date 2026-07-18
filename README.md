# NoCap

NoCap is a social accountability app where friends lock a small refundable commitment, submit proof that they showed up, and settle the pact transparently on Monad.

> Lock in. Show proof. Stay consistent.

## The personal problem

Goals announced in group chats usually disappear after a few days. The promise is social, but the accountability is not. NoCap turns a short challenge into a transparent pact: everyone commits the same amount, submits proof, and successful participants recover their commitment plus a share of forfeited commitments.

## Current vertical slice

- Distinct responsive Expo 56 interface
- Injected EVM wallet connection on web
- Automatic Monad Testnet switching
- Real `createChallenge` contract transaction
- Challenge room and progress state
- Photo-proof selection using Expo ImagePicker
- Solidity escrow with proof review, settlement, and pull-based claims

The web app reads live challenges from the contract and supports the complete transaction loop: create, join, submit proof, approve proof, settle, and claim.

## Submission links

- App: https://nocap-nine.vercel.app
- Mirror: https://mayorken.github.io/Nocap/
- Source: https://github.com/Mayorken/Nocap
- Contract: [`0x992D…88B1`](https://testnet.monadvision.com/address/0x992D51421E5A53c402c09B6d07a0eF7A78fe88B1)
- Demo video: add after recording
- Social post: add after publishing

## Run locally

Requirements: Node 20.19 or newer and an EVM browser wallet.

```bash
npm install
cp .env.example .env
npm run web
```

Add the deployed contract address to `.env`:

```text
EXPO_PUBLIC_CONTRACT_ADDRESS=0x...
```

## Contract

The contract is at `contracts/NoCapChallenge.sol` and is deployed on Monad Testnet (chain ID `10143`) at `0x992D51421E5A53c402c09B6d07a0eF7A78fe88B1`.

The MVP deliberately uses creator-reviewed proofs. A production release should replace this with an explicit squad quorum or independent verifier to remove creator discretion.

### Fast deployment with Remix

1. Open https://remix.ethereum.org and create `NoCapChallenge.sol`.
2. Paste the contents of `contracts/NoCapChallenge.sol` and compile with Solidity 0.8.24.
3. In **Deploy & Run**, select **Injected Provider - MetaMask**.
4. Confirm MetaMask is on Monad Testnet (chain ID `10143`).
5. Deploy `NoCapChallenge` and copy the resulting address.
6. Set `EXPO_PUBLIC_CONTRACT_ADDRESS` in `.env`, rebuild, and redeploy the site.

## Privacy

Photos are not intended to be stored directly on-chain. The contract records a proof URI or content identifier. Users should avoid submitting sensitive personal information.

## Testnet funding

NoCap links new users to Monad's official faucet at https://faucet.monad.xyz. Testnet MON has no cash value and must not be sold. Stripe's current crypto onramp does not support MON and is geographically limited, so NoCap does not accept card payments or custody funds to buy crypto for users. A production mainnet release should integrate an approved, non-custodial provider from Monad's onramp ecosystem after compliance review.
