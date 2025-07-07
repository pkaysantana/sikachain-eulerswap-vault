const { ethers } = require("hardhat");

async function main() {
  // --- PASTE YOUR DEPLOYED ADDRESSES HERE ---
  const claimManagerAddress = "0x8184CC20c19A6380894E25552c684eCFbdc2658C";
  const vaultAddress = "0x5868D50f148EE42396CFe651e74ffF5dcdcc2A2a";
  // -----------------------------------------

  console.log(`Connecting to ClaimManager at ${claimManagerAddress}...`);
  const claimManager = await ethers.getContractAt("ClaimManager", claimManagerAddress);

  console.log(`Setting vault address to ${vaultAddress}...`);
  const tx = await claimManager.setVaultAddress(vaultAddress);
  await tx.wait();

  console.log("Configuration complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});