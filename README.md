# sikachain-eulerswap-vault

A modular, gas-efficient smart contract vault system for programmable remittances, built around rate-locking, delayed claims, and future auto-hedging hooks.

## 🎯 Core Goal
Build a non-custodial remittance vault where:
- A sender deposits stablecoins
- An FX rate is locked at time of deposit (via a mock oracle)
- The recipient can claim the funds based on the locked value
- If the recipient does not claim within a time window, the sender can refund
- Simulate future hook integrations for lending or LP yield

## 💡 Why This Matters (Value Proposition)
| Pain Point                   | Our Solution                                                        |
|-----------------------------|---------------------------------------------------------------------|
| Volatile FX rates            | Lock in rate at deposit to avoid value mismatch at claim time        |
| Missed claims / forgotten funds | Refund mechanism ensures sender safety                         |
| Unproductive idle remittance | Simulate yield integrations (EulerSwap hooks, Aave, etc.)           |
| Gas fees for small transfers | Batch-friendly architecture, no rebalancing needed                  |
| Recipient has no Web3 wallet | Can plug into future cross-chain bridges / non-custodial relayers   |

## 🛠 Smart Contract System Architecture

```mermaid
%% Architecture diagram
---
<diagram will be rendered below>
```

## ✅ What is RemittanceVault?
RemittanceVault is a smart contract system designed to securely hold remittance funds, automatically hedge against FX volatility, and release funds to recipients after a specified expiration or upon claim. It aims to make cross-border payments safer and more predictable for both senders and recipients.

## ✅ Why FX-rate locking?
FX-rate locking ensures that the value of remitted funds remains stable despite currency fluctuations. By locking the exchange rate at the time of deposit and using on-chain oracles, RemittanceVault protects recipients from adverse FX movements, providing certainty and fairness in international transfers.

## ✅ EulerSwap potential integration (hook notes)
This prototype is designed with future integration in mind for EulerSwap, leveraging its composable DeFi infrastructure. The `VaultRouterHook.sol` contract demonstrates how hooks can be used to automate actions such as yield optimization, FX hedging, or custom settlement logic when interacting with EulerSwap pools.

## 🔄 Smart Hook Integration & Dynamic Routing
- The vault integrates with `VaultRouterHook` for programmable yield and routing.
- After each deposit, the vault calls `vaultRouterHook.checkAndRouteFunds(token)` to dynamically route excess funds to a yield protocol if the balance exceeds a configurable threshold.
- On claim, the vault calls `vaultRouterHook.onClaimUnwindAndRepay(token)` to unwind yield positions and repay borrows before releasing funds to the recipient.
- Admins can update the hook address and configure thresholds and yield protocol addresses.

### Example Flow
1. **Deposit:**
   - User deposits funds to the vault.
   - Vault records the deposit, locks the FX rate, and deposits funds to Aave via the hook.
   - Vault triggers smart routing via the hook if the balance exceeds the threshold.
2. **Claim:**
   - Recipient claims funds.
   - Vault triggers unwind/repay logic in the hook, withdraws from Aave, and transfers funds to the recipient.
3. **Refund:**
   - Sender can refund if the claim window expires. Funds are withdrawn from Aave and returned to the sender.

### Admin Functions
- `setVaultRouterHook(address newHook)`: Update the hook address (add onlyOwner/onlyAdmin in production).
- `setTokenThreshold(address token, uint256 threshold)`: Set the routing threshold for a token.
- `setYieldProtocolAddress(address addr)`: Set the yield protocol address for routing.

## Configuration & Usage
- Deploy all contracts: Vault, VaultRouterHook, ClaimManager, RateLockOracle, MockWETH, MockMainVault, MockYieldProtocol.
- Set up the hook and vault addresses as needed.
- Configure thresholds and yield protocol addresses via admin functions.
- Use the vault for deposits, claims, and refunds as described above.

## 🔐 Core Smart Contract Behaviors
1. **deposit(address recipient, uint256 amount, address token)**
   - Sender deposits any ERC-20 token (e.g. USDC)
   - Vault:
     - Queries oracle for current rate (e.g., 1 USDC = 13.2 GHS)
     - Stores recipient, amount, token, lockedRate, and timestamp
     - Emits `DepositLocked(address sender, address recipient, address token, uint256 amount, uint256 lockedRate)`
2. **claim(bytes32 depositId)**
   - Recipient calls to claim after sender deposits
   - Checks:
     - Claim window still open (via ClaimManager)
     - Claim not already executed
     - Transfers token amount or FX-equivalent to recipient
     - Emits `ClaimExecuted(...)`
3. **refund(bytes32 depositId)**
   - Sender can refund only if claim window has expired
   - Verifies claim is unclaimed and expired via ClaimManager
   - Emits `RefundIssued(...)`

## ⏳ FX Rate Locking (via Oracle)
**Oracle Design:** `MockRateLockOracle.sol`
- Simple contract with:
  - `setRate(address tokenA, address tokenB, uint256 rate)`
  - `getRate(tokenA, tokenB)` → returns fixed rate (e.g. 1 USDC = 13.2 GHS)
- In production, could be replaced with Chainlink, Pyth, Redstone, or custom TWAP oracles

## 📅 Time-Based Claim Enforcement
**Logic:** `ClaimManager.sol`
- Deposits must be claimed within a fixed window (e.g. 72h)
- Keeps:
  - Mapping of depositId → timestamp
- Functions:
  - `isClaimable(depositId)` → bool
  - `isExpired(depositId)` → bool

## 🪝 Future Yield / Hook Integrations
**Hook Stub:** `VaultRouterHook.sol`
- Demonstrates future yield strategies with EulerSwap v4-style hooks
- Could simulate:
  - Sending to a lending vault (e.g. Euler or Aave)
  - LP auto-rebalancing based on oracle FX delta
- Hook interface: `onSwapStart`, `onSwapEnd`, `onVaultYieldCheckpoint`

## 🔐 Security Considerations
| Attack Vector         | Mitigation                                  |
|----------------------|---------------------------------------------|
| Reentrancy           | Use ReentrancyGuard                         |
| Oracle manipulation  | Use mock now, migrate to Chainlink later    |
| Premature refund     | Enforce claim window in ClaimManager        |
| Double claim/refund  | Track status per depositId                  |
| Invalid tokens       | Whitelist supported stablecoins (USDC, DAI) |

## 🌐 Modularity & Expandability
- 💱 **Token Agnostic:** Works with any ERC-20 (USDC, DAI, etc.)
- 🔐 **Future KYC Layer:** Can layer on progressive identity via Gnosis Safe or WorldID
- 📈 **Hooks Optionality:** Vaults can be yield-passive or yield-active
- 🌍 **Multi-chain Friendly:** Easy to bridge with Axelar, LayerZero, or Wormhole

## 📜 Example Deposit Struct (Solidity)
```solidity
struct Deposit {
    address sender;
    address recipient;
    address token;
    uint256 amount;
    uint256 fxRateLocked;
    uint256 timestamp;
    bool claimed;
    bool refunded;
}
```

## 🧪 Example UX Flow (Happy Path)
- Don sends 500 USDC → deposits to RemittanceVault for Emmanuel
- Vault queries oracle → FX rate = 1 USDC = 13.2 GHS → 6600 GHS locked
- Vault stores:
  - recipient: Emmanuel
  - amount: 500 USDC
  - rate: 13.2
  - expiry: now + 72h
- Emmanuel claims → receives 500 USDC (or converted GHS via stablecoin bridge in future)
- Vault emits: `ClaimExecuted(depositId, 500, recipient)`

## 🔋 Simulation of Auto-Hedging in Future Versions
Imagine this scenario:
- Don sends 1000 USDC to Ghana
- Vault borrows GHS-stablecoin from Euler lending pool
- Swaps on AMM (simulated curve hook) via EulerSwap
- If FX rate moves ±X%, rebalances on-chain via hook-trigger
- Vault maintains delta-neutral remittance exposure

_This is a possible v2 or v3 path — not required for MVP submission._

## ✅ Submission Requirements You Meet
| Requirement              | Your Solution                                 |
|-------------------------|-----------------------------------------------|
| Smart contract only      | ✅ Vault + Oracle + ClaimManager + Hooks       |
| Euler-compatible idea    | ✅ Simulated hook architecture via VaultRouterHook |
| Interesting mechanics    | ✅ Rate lock + timeout + refund                |
| Real DeFi relevance      | ✅ Capital preservation + programmable FX hedging |

## Prerequisites
- Node.js (v16 or later recommended)
- npm (v8 or later recommended)

## Installation
1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repo-url>
   cd sikachain-eulerswap-vault
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
   > **Note:** If you encounter dependency conflicts (especially with `chai`), ensure your `package.json` uses:
   > ```json
   > "chai": "^4.3.7"
   > ```
   > Then, clean your environment:
   > ```bash
   > rm -rf node_modules package-lock.json
   > npm install
   > ```

## Running Tests
To run the test suite:
```bash
npx hardhat test
```

## Troubleshooting
- **Dependency conflicts:**
  - Make sure `chai` is set to `^4.3.7` in your `package.json`.
  - Delete `node_modules` and `package-lock.json`, then run `npm install` again.
- **Vulnerabilities or deprecation warnings:**
  - These are common in the JS ecosystem. You can run `npm audit fix` to address some, but they do not usually block development.

## Project Structure
- `contracts/` – Solidity smart contracts
- `test/` – JavaScript test files
- `scripts/` – Deployment and utility scripts
- `deployments/` – Deployment artifacts

## ✅ Future roadmap
- Vault router for advanced routing and automation
- Dynamic yield strategies for optimizing remittance returns
- Deeper EulerSwap integration and composable DeFi features

## Security & Edge-Case Test Coverage
- Only the vault or owner can call sensitive functions (depositToAave, withdrawFromAave).
- Only the main vault can trigger routing and unwind/repay logic.
- Routing reverts if the yield protocol address is not set.
- Thresholds can be changed after routing, and the hook will respect the new value.
- All critical paths are covered by tests for revert scenarios and correct event emission.

**Best Practices:**
- Always use onlyOwner or onlyAdmin modifiers for admin functions in production.
- Ensure the main vault and yield protocol addresses are set correctly before use.
- Monitor FundsRouted and ClaimUnwindAndRepay events for off-chain automation and auditing.

## Deployment

To deploy all contracts and configure the system locally or on a testnet:

1. Compile contracts:
   ```bash
   npx hardhat compile
   ```
2. Run the deployment script:
   ```bash
   npx hardhat run scripts/deploy.js
   ```
   This will:
   - Deploy MockWETH, ClaimManager, MockRateLockOracle, VaultRouterHook, MockMainVault, MockYieldProtocol, and Vault
   - Configure the hook with the main vault, yield protocol, and token threshold
   - Print all deployed contract addresses for further use

**Sample Output:**
```
Deploying contracts with account: 0x...
MockWETH deployed to: 0x...
ClaimManager deployed to: 0x...
MockRateLockOracle deployed to: 0x...
VaultRouterHook deployed to: 0x...
MockMainVault deployed to: 0x...
MockYieldProtocol deployed to: 0x...
Vault deployed to: 0x...
Set threshold for MockWETH: 100000000000000000
Deployment complete:
MockWETH: 0x...
ClaimManager: 0x...
MockRateLockOracle: 0x...
VaultRouterHook: 0x...
MockMainVault: 0x...
MockYieldProtocol: 0x...
Vault: 0x...
```

You can now use these addresses for further configuration, testing, or integration with frontends and scripts.

## Real Protocol Integration (Aave on Sepolia)

To use real Aave and WETH contracts on Sepolia instead of mocks:

- **Aave V3 Pool Address (Sepolia):**
  - `0x6Ae43d3271ff6888ff21DfE2645Fb769dD61c5FF`
- **WETH Address (Sepolia):**
  - `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`

### How to Switch to Real Protocols
1. Update your deployment script or config to use the real Aave pool and WETH addresses above.
2. Deploy VaultRouterHook with the real Aave pool address and your main vault address.
3. Use the real WETH address for deposits and routing.
4. All other logic remains the same; you can still use the same Vault, ClaimManager, and Oracle contracts.

**Note:**
- You must have Sepolia ETH and WETH in your test account to interact with real protocols.
- Real protocol integration is best tested on a forked Sepolia network for safety and reproducibility.

## Keeper/Automation Integration

To automate fund routing, a keeper bot can periodically call the `keeperRouteAll()` function on the VaultRouterHook contract. This function checks all supported tokens and routes funds as needed based on thresholds.

### Example: Keeper Bot Script (Node.js)

```js
const { ethers } = require("ethers");
const hookAbi = require("./artifacts/contracts/VaultRouterHook.sol/VaultRouterHook.json").abi;
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const hook = new ethers.Contract(process.env.HOOK_ADDRESS, hookAbi, signer);

async function runKeeper() {
  const tx = await hook.keeperRouteAll();
  await tx.wait();
  console.log("keeperRouteAll executed");
}

setInterval(runKeeper, 60 * 60 * 1000); // every hour
```

- Set `RPC_URL`, `PRIVATE_KEY`, and `HOOK_ADDRESS` in your environment.
- Adjust the interval as needed.

**Note:**
- The keeper account must have sufficient ETH for gas.
- You can use any automation service (e.g., Chainlink Keepers, Gelato) to call this function.

## Testing Notes

- When using mock tokens (e.g., MockWETH), you can call the `mint(address to, uint256 amount)` function to mint tokens to any address for testing purposes.
- This is useful for setting up contract balances in your tests or local deployments.

## 🧪 Robust Local Testing with Mocks

For local development and testing, the project uses mock contracts to simulate protocol and oracle behavior:
- **MockAavePool**: Simulates Aave pool functions (`supply`, `withdraw`) for routing/yield tests.
- **MockMainVault**: Simulates the main vault logic and allows dynamic wiring to hooks.
- **MockWETH / MockDAI**: Simple ERC20 mocks with a `mint` function for easy balance setup.
- **MockChainlinkAggregator**: Simulates a Chainlink price feed for deterministic FX/volatility tests.

**Best Practices:**
- Always deploy mocks and use their addresses in your tests. Do not use real protocol addresses unless forking a live network.
- When testing state-changing functions, ensure contract instances are connected to a signer (e.g., `contract.connect(owner)`).
- For negative/revert tests, always provide all required constructor arguments when deploying contracts.

**Troubleshooting Common Test Errors:**
- `TypeError: Cannot read properties of undefined (reading 'transfer')`: Make sure the token address is a deployed mock ERC20.
- `Error: contract runner does not support sending transactions`: Connect contract instances to a signer for write operations.
- `Error: incorrect number of arguments to constructor`: Double-check all contract deployments for required constructor arguments.

## 📡 Event-Based Claiming (Mobile-First)

The vault supports claims via signed message and relayer, enabling mobile-first and USSD/SMS-based remittance flows:
- Recipients can claim funds by providing a valid EIP-712 signature, a 6-digit code, and SIM verification proof.
- A relayer (e.g., SikaChain backend) can submit the claim on behalf of the recipient, so the recipient never needs MetaMask.
- Events are emitted for off-chain/mobile notification and tracking.

**Example:**
- Recipient receives a code and signs a message off-chain (or via USSD/SMS flow).
- Relayer submits `claimWithSignature(depositId, simProof, code, signature)`.
- Vault verifies the signature and processes the claim.

## 🫂 Multi-Recipient Group Claim Pools

Senders can create a group claim pool to split a remittance among multiple recipients:
- Use `createGroupClaimPool(poolId, recipients, splits, token, totalAmount)` to create a pool.
- Each recipient can claim their share with `claimFromGroup(poolId)`.
- Splits must sum to 100 (percentages).
- Events are emitted for pool creation and claims.

**Example:**
- Alice sends 200 USDC, split 30/30/40 between Bob, Carol, and Dave.
- Each can claim their share independently.

## 🧾 Proof of Creditworthiness (Credit SBTs)

Recipients can mint a non-transferable NFT (SBT) as proof of their remittance claim history:
- After claiming from the vault, call `mintCreditSBT()` to mint a soulbound NFT.
- The SBT metadata includes claim count and average vault size.
- Useful for microloan underwriting, DAO reputation, or off-chain credit scoring.

**Example:**
- Bob claims 15 vaults over 90 days, average size $50.
- Bob mints an SBT showing this history, which can be used as proof for credit or reputation.

## 🛠️ Integration Script Examples

### Event-Based Claim (Relayer)
```js
const { ethers } = require("ethers");
const vaultAbi = require("./artifacts/contracts/Vault.sol/Vault.json").abi;
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const relayer = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, provider);
const vault = new ethers.Contract(process.env.VAULT_ADDRESS, vaultAbi, relayer);

async function claimWithSignature(depositId, simProof, code, signature) {
  const tx = await vault.claimWithSignature(depositId, simProof, code, signature);
  await tx.wait();
  console.log("Claimed via relayer!");
}
```

### Group Claim Pool Creation
```js
async function createGroupClaimPool(poolId, recipients, splits, token, totalAmount) {
  const tx = await vault.createGroupClaimPool(poolId, recipients, splits, token, totalAmount);
  await tx.wait();
  console.log("Group claim pool created!");
}
```

### SBT Minting
```js
async function mintCreditSBT() {
  const tx = await vault.mintCreditSBT();
  await tx.wait();
  console.log("SBT minted!");
}
```

## 🚀 Live Test Flow Guidance

1. **Deposit funds** to the Vault using your frontend or a script.
2. **For event-based claim:**
   - Recipient signs the claim message (off-chain or via USSD/SMS).
   - Relayer submits the claim using `claimWithSignature`.
3. **For group pools:**
   - Sender creates a group pool.
   - Each recipient claims their share.
4. **For SBTs:**
   - After a successful claim, recipient calls `mintCreditSBT`.

**Reminders:**
- Use the printed contract addresses from your deployment script for all integrations.
- Check Etherscan for contract verification and to interact with contracts directly if needed.

## Sika₵hain Branding & UI Principles

- **Brand:** Sika₵hain (with the Ghanaian cedi symbol ₵ in all branding and cedi values)
- **Color Palette:**
  - Red-to-white gradient: price impact, risk
  - Blue: current price indicator
  - Green: equilibrium, healthy, NAV midpoint
  - Purple: Net Asset Value (NAV)
  - Red: debt, risk
  - White: neutral/low impact
- **Typography:** Inter (UI), monospace (addresses, code, numbers)
- **Logo/Icon:** Default logo uses ₵; SVG/PNG upload supported for vaults/entities
- **UI Library:** Chakra UI with custom theme
- **Data Visualization:** Recharts for all charts (group splits, NAV, debt, price/risk bars)
- **Guided Flows:** Step-by-step forms for all actions

## Frontend Flows
- **Wallet Connect:** Connect MetaMask to use all features
- **Deposit:** Guided form to deposit to the vault (₵ branding)
- **Event-Based Claim:** Submit a claim with depositId, SIM proof, code, and signature (relayer support)
- **Group Pool:** (Coming soon) Create and claim from group pools with interactive sliders and charts
- **SBT Minting:** (Coming soon) Mint and display SBTs for creditworthiness

## Quickstart: Running the Frontend
```bash
cd frontend
npm install
npm run dev
```

- The app will open at http://localhost:5173
- Connect your wallet and try the deposit and claim flows

## Note on ₵ Symbol
- The Ghanaian cedi symbol (₵) is used in all branding and cedi currency values for Sika₵hain.
- All contract and UI references to cedi use ₵ for clarity and local relevance.

## Project Summary
**Sika₵hain: DeFi-Native Remittance Vault with EulerSwap Hooks**

Sika₵hain is a professional, data-driven remittance vault for Ghana and beyond. It enables secure, programmable remittances, group claim pools, and on-chain credit history, all with a familiar Uniswap-style interface and real-time financial visualizations. Sika₵hain leverages EulerSwap's hook architecture for dynamic yield routing, hedging, and automated risk management.

## How EulerSwap Tech is Used (Technical Implementation)
- **VaultRouterHook.sol**: Implements the EulerSwap "hook" pattern, allowing the vault to route funds dynamically to yield protocols (e.g., Aave, Euler) and to unwind/repay positions on claim. The hook can be extended to integrate with EulerSwap's LP management, auto-hedging, and risk controls.
- **Dynamic Routing & Automation**: The vault uses the hook to check token balances and thresholds, then routes excess funds to yield or lending protocols, simulating EulerSwap's programmable liquidity management. The keeper/automation logic (keeperRouteAll) is inspired by EulerSwap's approach to automated LP management and risk mitigation.
- **FX Volatility Oracle**: Integrates a Chainlink-compatible oracle for FX rate monitoring, with logic to trigger hedging or insurance actions—mirroring EulerSwap's focus on programmable, risk-aware DeFi.
- **Event-Based Claiming & Group Pools**: The smart contracts and frontend are designed to support advanced, composable flows (event-based claim, group pools, SBTs), all of which can be extended with EulerSwap's future hooks and liquidity primitives.
- **Frontend**: The UI is inspired by Uniswap/EulerSwap's Maglev, with real-time data visualizations, interactive controls, and a data-driven color palette for financial metrics and risk.

## Goals After the Hackathon
- Continue building and learning, with the aim to:
  - Integrate deeper with EulerSwap's evolving protocol (e.g., native LP hooks, advanced hedging).
  - Launch a live pilot for remittances in Ghana, expanding to other markets.
  - Add more advanced analytics, credit scoring, and DeFi integrations.
  - Open-source the project and foster a community of builders and users.

## Frontend Flows (Current & Planned)
- **Wallet Connect:** Connect MetaMask to use all features
- **Deposit:** Guided form to deposit to the vault (₵ branding)
- **Event-Based Claim:** Submit a claim with depositId, SIM proof, code, and signature (relayer support)
- **Group Pool:** (Placeholder) Create and claim from group pools with interactive sliders and charts
- **SBT Minting:** (Placeholder) Mint and display SBTs for creditworthiness

## Submission Checklist
- [x] Project code in this repo
- [x] Detailed README with project overview, technical explanation, and demo images
- [x] No video demo due to time constraints
- [x] All flows and branding implemented as described

## Note on ₵ Symbol
- The Ghanaian cedi symbol (₵) is used in all branding and cedi currency values for Sika₵hain.
- All contract and UI references to cedi use ₵ for clarity and local relevance.

## Feedback on EulerSwap (Builder Competition)
Sika₵hain was built to showcase the power and flexibility of EulerSwap's hook architecture. The ability to compose programmable liquidity, risk management, and automation into a single vault system is truly innovative. The documentation and Maglev UI demos were especially helpful for understanding the vision and technical possibilities. For future improvement, more live code examples and deeper documentation on advanced hook patterns (e.g., for hedging, multicall, and custom LP logic) would be valuable for builders. Overall, EulerSwap is pushing the boundaries of DeFi composability and I'm excited to keep building on this foundation.


