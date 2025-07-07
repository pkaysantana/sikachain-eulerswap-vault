const { ethers } = require("hardhat");

// ABIs needed to interact with WETH and your Vault
const IWETH_ABI = [
  "function deposit() payable",
  "function approve(address spender, uint256 amount)",
  "function balanceOf(address) view returns (uint)",
];

const IVault_ABI = [
  "function deposit(address recipient, uint256 amount, address token)",
];

async function main() {
  // --- CONFIGURATION ---
  // Paste the Vault address you deployed
  const VAULT_ADDRESS = "0x5868D50f148EE42396CFe651e74ffF5dcdcc2A2a"; 

  const WETH_ADDRESS = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
  const DEPOSIT_AMOUNT = ethers.parseEther("0.01");
  // --- END CONFIGURATION ---

  const [signer] = await ethers.getSigners();
  console.log(`Using account: ${signer.address}`);

  const wethContract = new ethers.Contract(WETH_ADDRESS, IWETH_ABI, signer);
  const vaultContract = new ethers.Contract(VAULT_ADDRESS, IVault_ABI, signer);

  // Step 1: Wrap ETH into WETH
  console.log(`Wrapping ${ethers.formatEther(DEPOSIT_AMOUNT)} ETH into WETH...`);
  const wrapTx = await wethContract.deposit({ value: DEPOSIT_AMOUNT });
  await wrapTx.wait();
  console.log(`Wrap successful! Tx hash: ${wrapTx.hash}`);

  // Step 2: Approve the Vault to spend the WETH
  console.log(`Approving Vault (${VAULT_ADDRESS}) to spend WETH...`);
  const approveTx = await wethContract.approve(VAULT_ADDRESS, DEPOSIT_AMOUNT);
  await approveTx.wait();
  console.log(`Approve successful! Tx hash: ${approveTx.hash}`);

  // Step 3: Deposit the WETH into your Vault
  console.log("Depositing WETH into the Vault...");
  const depositTx = await vaultContract.deposit(signer.address, DEPOSIT_AMOUNT, WETH_ADDRESS);
  await depositTx.wait();
  console.log("Deposit successful! Your vault is now generating yield on Aave.");
  console.log(`Deposit Tx hash: ${depositTx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});