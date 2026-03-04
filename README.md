# BankLend — Simplified Lending Pool on BSC

A transparent lending protocol with **bank mode**: admin can withdraw pool funds for external use, while the BankRunGauge shows real-time utilization risk to depositors.

## Architecture

```
BankLend/
  contracts/                    ← Hardhat + Solidity 0.8.20
    BankLendingPool.sol         ← Main contract (ERC4626-inspired)
    interfaces/
      IStorage.sol              ← onout.org Storage interface
      AggregatorV3Interface.sol ← Chainlink
    mocks/                      ← For testing
  scripts/deploy.ts             ← BSC testnet/mainnet deploy
  test/BankLendingPool.test.ts  ← 33 passing tests

  frontend/                     ← Vite + React 18 + wagmi v2 + Tailwind
    src/
      constants/                ← Addresses, config, formatters
      hooks/                    ← usePoolState, useDeposit, useBorrow, useAdmin, useStorage
      pages/                    ← Markets, Dashboard, AdminPanel
      components/               ← BankRunGauge, Layout, Navbar, ConnectWallet
```

## Smart Contract Features

- **Deposits**: ERC4626-inspired shares, yield accrues as borrowers pay interest
- **Borrows**: Overcollateralized (BNB/ETH collateral, Chainlink oracles)
- **Bank Mode**: Admin can withdraw pool liquidity for external use (`adminWithdraw`/`adminDeposit`)
- **Auth**: Admin verified via `onout.org Storage` at `0xa7472f384339D37EfE505a1A71619212495A973A`
- **Liquidation**: Health factor < 1.0 → 5% bonus for liquidators

## Utilization Risk Gauge

```
utilizationRate = (adminWithdrawn + totalBorrowed) / totalDeposited * 100

< 70%  → Green  (Safe)
70-85% → Orange (⚠ Caution)
> 85%  → Red    (🚨 Bank Run Risk)
```

## Quick Start

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test

# Deploy to testnet
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network bscTestnet

# Deploy to mainnet
DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network bsc
```

### Frontend

```bash
cd frontend
npm install

# Dev server
VITE_WALLETCONNECT_PROJECT_ID=your-id npm run dev

# Production build
npm run build
```

## BSC Addresses

### Production (BSC Mainnet)
| Contract | Address |
|----------|---------|
| onout.org Storage | `0xa7472f384339D37EfE505a1A71619212495A973A` |
| USDT (BSC-USD) | `0x55d398326f99059fF775485246999027B3197955` |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| BNB/USD Feed | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` |
| ETH/USD Feed | `0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2E` |

## Admin Setup

1. Deploy `BankLendingPool.sol`
2. Go to Admin Panel → set pool contract address in Storage
3. Pool auth: the domain owner in `onout.org Storage` is the admin
4. Set collateral tokens via `setCollateral(token, feed, ltv)`

## Security Notes

- ⚠️ **Bank Mode is transparent**: BankRunGauge shows exact utilization to all users
- Max LTV: 90%, liquidation threshold: 80%
- No upgradeable proxy — contract is immutable
- Interest accrues per-block on both global and per-borrower basis
