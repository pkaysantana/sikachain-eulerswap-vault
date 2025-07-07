require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "1".repeat(64); 

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true, // Ensure optimizer is enabled for Chainlink contracts
        runs: 200,
      },
      // If you encounter issues with Chainlink contracts, you may need:
      // evmVersion: "istanbul", // Or another EVM version as needed
      // libraries: {}, // If using libraries
    },
    // If importing Chainlink contracts, ensure node_modules/@chainlink/contracts is accessible
  },
  networks: {
    hardhat: {
      forking: {
        url: SEPOLIA_RPC_URL,
        // Remove fixed block number to use latest
      },
      // ADDED: Increase timeout for long-running fork tests
      timeout: 100000 
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
      gasPrice: "auto",
      gas: "auto",
    },
  },
  // ADDED: Disable caching to prevent stale data on forks
  paths: {
    cache: "./cache_hardhat",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
// For Chainlink usage: If you get 'File not found' errors, check import paths and node_modules.