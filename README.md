# ⚖ The Iron Ledger
### Autonomous Arbitration & Escrow Protocol — On-Chain

> Trustless commodity escrow with live countdown enforcement and automatic slashing. No middlemen. No banks. Just code.

**Live Demo:** [the-iron-ledger-r1jzaz5xi-shrirammasalges-projects.vercel.app](https://the-iron-ledger-r1jzaz5xi-shrirammasalges-projects.vercel.app)  
**Contract:** [`0xa8a37959d63C2A51e3eeF254a694cFDa7A67f1Aa`](https://sepolia.etherscan.io/address/0xa8a37959d63C2A51e3eeF254a694cFDa7A67f1Aa) on Sepolia Testnet

---

## What It Does

The Iron Ledger is a decentralized escrow and arbitration protocol built on Ethereum. A buyer locks ETH into a smart contract. The seller must deliver before a deadline. If they do — payment is released. If they don't — the buyer can slash the seller and seize their penalty deposit.

No judge. No intermediary. The contract enforces everything automatically.

---

## Trade Lifecycle

```
Created → Funded → InTransit → Delivered → Completed
                                         ↘ Slashed (if deadline missed)
```

| State | Who Acts | What Happens |
|---|---|---|
| Created | Buyer | Trade parameters set on-chain |
| Funded | Buyer | ETH locked into escrow |
| InTransit | Seller | Seller marks goods shipped |
| Delivered | Seller | Seller confirms delivery |
| Completed | Buyer | Payment released to seller |
| Slashed | Buyer | Deadline missed — penalty seized |
| Cancelled | Buyer/Seller | Trade cancelled, ETH returned |

---

## Security — 15 Attack Tests

All 15 security tests pass in under 1 second:

```
✔ 01 — deploys with zero trades
✔ 02 — full lifecycle: Created → Funded → InTransit → Delivered → Completed
✔ 03 — slashing seizes penalty from seller when deadline passes
✔ 04 — ATTACK: random attacker cannot slash seller
✔ 05 — ATTACK: buyer cannot slash before deadline expires
✔ 06 — ATTACK: cannot fund an already-funded trade
✔ 07 — ATTACK: seller cannot mark InTransit on unfunded trade
✔ 08 — ATTACK: random wallet cannot complete a trade
✔ 09 — ATTACK: seller cannot cancel after buyer funds
✔ 10 — ATTACK: attacker cannot cancel a trade they have no role in
✔ 11 — ATTACK: funding with wrong ETH amount is rejected
✔ 12 — ATTACK: cannot create trade with past deadline
✔ 13 — ATTACK: cannot double-slash the same trade
✔ 14 — cancel on Created state returns ETH to buyer
✔ 15 — two simultaneous trades are fully independent

15 passing (1s)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.20 |
| Testing | Hardhat + Chai |
| Frontend | Next.js 14, TypeScript |
| Blockchain Interaction | ethers.js v5 |
| Wallet | MetaMask |
| Network | Ethereum Sepolia Testnet |
| Deployment | Vercel |

---

## Features

- **Live Countdown Ring** — SVG timer drains in real time, turns red when overdue
- **Automatic Slash Button** — appears and pulses the moment a deadline is missed
- **Demo Mode** — deadlines in seconds instead of days for live presentations
- **Privacy Mode** — blurs ETH amounts for screen sharing
- **Guided Onboarding Tour** — 7-step coach mark walkthrough on first connect
- **Sepolia Testnet** — real public blockchain, real transactions, zero real money

---

## Running Locally

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- Sepolia ETH (free from [sepoliafaucet.com](https://sepoliafaucet.com))

### Smart Contract
```bash
cd iron-ledger
npm install
npx hardhat compile
npx hardhat test test/IronLedger.test.cjs   # Run all 15 tests
```

### Frontend
```bash
cd iron-ledger-frontend
npm install
npm run dev
# Open http://localhost:3000
```

Connect MetaMask to **Sepolia Testnet** and click **Connect Wallet**.

---

## Demo Workflow (30 seconds)

1. Open the live URL
2. Connect MetaMask (Sepolia)
3. Set deadline to **30 seconds**
4. Click **Create Trade** → confirm in MetaMask
5. Click **Fund Escrow** → confirm in MetaMask
6. Watch the countdown ring drain to zero
7. **⚡ Slash button activates automatically** — click to seize penalty

---

## Contract Address

```
Sepolia Testnet: 0xa8a37959d63C2A51e3eeF254a694cFDa7A67f1Aa
```

Verify on [Sepolia Etherscan](https://sepolia.etherscan.io/address/0xa8a37959d63C2A51e3eeF254a694cFDa7A67f1Aa)

---

## Project Structure

```
The Iron Ledger/
├── iron-ledger/                  # Hardhat project
│   ├── contracts/
│   │   └── IronLedger.sol        # Core escrow contract
│   ├── scripts/
│   │   └── deploy.js             # Deployment script
│   └── test/
│       └── IronLedger.test.cjs   # 15 security tests
│
└── iron-ledger-frontend/         # Next.js app
    └── src/
        ├── app/
        │   └── page.tsx          # Main UI
        ├── components/
        │   └── IronLedgerTour.tsx # Onboarding tour
        └── constants/
            └── index.ts          # Contract address & ABI
```

---

## Author

**Shriram Masalge**  


---

*The Iron Ledger — Where every trade is written in iron.*