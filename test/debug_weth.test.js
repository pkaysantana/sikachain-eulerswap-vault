// test/debug_weth.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

const WETH_ADDRESS_SEPOLIA = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";

// Using the same comprehensive ABI for consistency
const ERC20_FULL_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function deposit() payable",
    "function withdraw(uint256 wad)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

describe("WETH Balance Debug", function () {
    let owner;
    let weth;

    before(async function () { // Use 'before' to run once
        await network.provider.send("hardhat_reset"); // Ensure clean state
        [owner] = await ethers.getSigners();

        weth = new ethers.Contract(WETH_ADDRESS_SEPOLIA, ERC20_FULL_ABI, owner);

        console.log("Debug: Connected to WETH at:", await weth.getAddress());
        console.log("Debug: Owner address:", owner.address);

        // Try to get balance of a known contract (e.g., the WETH contract itself, or a random address)
        // This is to see if any balanceOf call fails, or only for accounts with 0 balance.
        try {
            const wethContractBalance = await weth.balanceOf(await weth.getAddress());
            console.log(`Debug: WETH Contract balance of WETH: ${ethers.formatEther(wethContractBalance)}`);
        } catch (error) {
            console.error("Debug: Error calling balanceOf on WETH contract itself:", error.message);
        }

        try {
            const ownerEthBalance = await ethers.provider.getBalance(owner.address);
            console.log(`Debug: Owner ETH balance (Hardhat default): ${ethers.formatEther(ownerEthBalance)}`);

            // Attempt a small WETH deposit
            const testDepositAmount = ethers.parseEther("0.001");
            console.log(`Debug: Attempting to wrap ${ethers.formatEther(testDepositAmount)} ETH to WETH...`);
            await weth.connect(owner).deposit({ value: testDepositAmount });
            console.log("Debug: WETH deposit successful.");

        } catch (error) {
            console.error("Debug: Error during WETH deposit test:", error.message);
            // If deposit fails, we have bigger problems.
        }
    });

    it("Should be able to read owner's WETH balance after wrapping", async function () {
        // This is the line that's failing in your main test
        const ownerWethBalance = await weth.balanceOf(owner.address);
        console.log(`Debug: Owner's WETH balance after wrapping (direct check): ${ethers.formatEther(ownerWethBalance)} WETH`);
        expect(ownerWethBalance).to.be.gt(0); // Expect more than 0 after deposit
    });
});

describe("MockWETH Standalone", function () {
    it("Should correctly manage MockWETH balances", async function () {
        const [owner, receiver] = await ethers.getSigners();

        // Deploy MockWETH
        const MockWETHFactory = await ethers.getContractFactory("MockWETH");
        const mockWeth = await MockWETHFactory.deploy();
        await mockWeth.waitForDeployment();

        // Connect to owner signer for write operations
        const mockWethWithSigner = mockWeth.connect(owner);

        // Deposit some ETH to get WETH
        const depositAmount = ethers.parseEther("1.0");
        await mockWethWithSigner.deposit({ value: depositAmount });
        const initialOwnerMockWethBalance = await mockWeth.balanceOf(owner.address);
        expect(initialOwnerMockWethBalance).to.be.gt(0, "Owner should have WETH after deposit");

        // Try a simple transfer within MockWETH
        const transferAmount = ethers.parseEther("0.01");
        await mockWethWithSigner.transfer(receiver.address, transferAmount);
        const ownerBalanceAfterTransfer = await mockWeth.balanceOf(owner.address);
        const receiverBalanceAfterTransfer = await mockWeth.balanceOf(receiver.address);
        expect(ownerBalanceAfterTransfer).to.equal(initialOwnerMockWethBalance - transferAmount);
        expect(receiverBalanceAfterTransfer).to.equal(transferAmount);

        // Try depositing more ETH into MockWETH
        const additionalDeposit = ethers.parseEther("0.002");
        await mockWethWithSigner.deposit({ value: additionalDeposit });
        const ownerBalanceAfterAdditionalDeposit = await mockWeth.balanceOf(owner.address);
        expect(ownerBalanceAfterAdditionalDeposit).to.equal(ownerBalanceAfterTransfer + additionalDeposit);
    });
});