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

Proof storage and the remaining contract writes are the next integration milestone; the UI labels unfinished behavior rather than presenting a fake transaction.

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

The contract is at `contracts/NoCapChallenge.sol`. Compile and deploy it with Foundry, Hardhat, or Remix using Solidity 0.8.24. The target network is Monad Testnet (chain ID `10143`).

The MVP deliberately uses creator-reviewed proofs. A production release should replace this with an explicit squad quorum or independent verifier to remove creator discretion.

## Privacy

Photos are not intended to be stored directly on-chain. The contract records a proof URI or content identifier. Users should avoid submitting sensitive personal information.
