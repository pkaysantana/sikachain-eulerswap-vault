const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Use real protocol addresses if provided, otherwise deploy mocks
  const REAL_AAVE_POOL = process.env.AAVE_POOL_ADDRESS;
  const REAL_WETH = process.env.WETH_ADDRESS;
  const REAL_CHAINLINK_ORACLE = process.env.CHAINLINK_ORACLE_ADDRESS;
  const REAL_TOKEN = process.env.TOKEN_ADDRESS;

  let token, tokenAddress;
  if (REAL_TOKEN) {
    tokenAddress = REAL_TOKEN;
    console.log("Using real token address:", REAL_TOKEN);
  } else {
    const MockToken = await ethers.getContractFactory("MockWETH");
    token = await MockToken.deploy();
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    console.log("MockToken deployed to:", tokenAddress);
  }

  let oracle, oracleAddress;
  if (REAL_CHAINLINK_ORACLE) {
    oracleAddress = REAL_CHAINLINK_ORACLE;
    console.log("Using real Chainlink oracle address:", REAL_CHAINLINK_ORACLE);
  } else {
    const MockRateLockOracle = await ethers.getContractFactory("MockRateLockOracle");
    oracle = await MockRateLockOracle.deploy();
    await oracle.waitForDeployment();
    oracleAddress = await oracle.getAddress();
    console.log("MockRateLockOracle deployed to:", oracleAddress);
  }

  // 2. Deploy ClaimManager
  const CLAIM_WINDOW_SECONDS = 72 * 60 * 60; // 72 hours
  const ClaimManager = await ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(CLAIM_WINDOW_SECONDS);
  await claimManager.waitForDeployment();
  console.log("ClaimManager deployed to:", await claimManager.getAddress());

  // 3. Deploy VaultRouterHook (real or dummy Aave pool)
  const aavePoolAddress = REAL_AAVE_POOL || deployer.address;
  const dummyMainVault = deployer.address;
  const VaultRouterHook = await ethers.getContractFactory("VaultRouterHook");
  const hook = await VaultRouterHook.deploy(aavePoolAddress, dummyMainVault, oracleAddress);
  await hook.waitForDeployment();
  console.log("VaultRouterHook deployed to:", await hook.getAddress());

  // 4. Deploy Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(
    oracleAddress,
    await claimManager.getAddress(),
    await hook.getAddress()
  );
  await vault.waitForDeployment();
  console.log("Vault deployed to:", await vault.getAddress());

  // Print summary
  console.log("\nDeployment complete:");
  console.log("Token:", tokenAddress);
  console.log("Oracle:", oracleAddress);
  console.log("ClaimManager:", await claimManager.getAddress());
  console.log("VaultRouterHook:", await hook.getAddress());
  console.log("Vault:", await vault.getAddress());

  // Etherscan verification
  if (hre.network.name !== "hardhat") {
    await verifyContract(await claimManager.getAddress(), [CLAIM_WINDOW_SECONDS]);
    if (!REAL_CHAINLINK_ORACLE) {
      await verifyContract(oracleAddress, []);
    }
    await verifyContract(await hook.getAddress(), [aavePoolAddress, dummyMainVault, oracleAddress]);
    await verifyContract(await vault.getAddress(), [oracleAddress, await claimManager.getAddress(), await hook.getAddress()]);
    if (!REAL_TOKEN) {
      await verifyContract(tokenAddress, []);
    }
  }

  // Integration guidance
  console.log("\nShare these addresses with your frontend/relayer team:");
  console.log(`VAULT_ADDRESS=${await vault.getAddress()}`);
  console.log(`VAULT_ROUTER_HOOK_ADDRESS=${await hook.getAddress()}`);
  console.log(`CLAIM_MANAGER_ADDRESS=${await claimManager.getAddress()}`);
  console.log(`ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`TOKEN_ADDRESS=${tokenAddress}`);
  console.log("\nUse these addresses in your frontend or relayer scripts for live flows (event-based claim, group pools, SBT minting).");

  if (!REAL_AAVE_POOL || !REAL_WETH || !REAL_CHAINLINK_ORACLE || !REAL_TOKEN) {
    console.log("[Warning] Using mock contracts for some components. Set AAVE_POOL_ADDRESS, WETH_ADDRESS, CHAINLINK_ORACLE_ADDRESS, and TOKEN_ADDRESS in your .env to use real protocols.");
  }
}

async function verifyContract(address, constructorArgs) {
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`Etherscan verification successful: ${address}`);
  } catch (e) {
    console.log(`Etherscan verification failed for ${address}:`, e.message);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});