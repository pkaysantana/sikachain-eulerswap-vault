const { expect } = require("chai");
const { ethers, network } = require("hardhat");

// Define Aave V3 Pool address for Sepolia (verified from Aave documentation/Etherscan)
const AAVE_POOL_ADDRESS_SEPOLIA = "0x6Ae43d3271ff6888ff21DfE2645Fb769dD61c5FF"; // Aave V3 Pool on Sepolia

// WETH address on Sepolia (official contract)
const WETH_ADDRESS_SEPOLIA = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
// aWETH Token Address on Sepolia
const A_WETH_ADDRESS_SEPOLIA = "0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830";

// --- UPDATED: More comprehensive ERC20 ABI ---
const ERC20_FULL_ABI = [
    // Read-only functions
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    // Write functions
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    // WETH specific functions
    "function deposit() payable",
    "function withdraw(uint256 wad)",
    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
];
// --- END UPDATED ABI ---

const ETH_USD_PRICE_DECIMALS = 8; // Chainlink ETH/USD usually has 8 decimals

describe("VaultRouterHook", function () {
    let mockAavePool;
    let mockWeth;
    let mockDai;
    let owner;
    let other;
    let mockChainlinkAggregator;
    let rateVolatilityOracle;
    let mockMainVault;
    let mockYieldProtocol;
    let vaultRouterHook;

    beforeEach(async function () {
        [owner, other] = await ethers.getSigners();
        // 1. Deploy MockWETH and MockDAI
        const MockWETHFactory = await ethers.getContractFactory("MockWETH");
        mockWeth = await MockWETHFactory.connect(owner).deploy();
        await mockWeth.waitForDeployment();
        mockDai = await MockWETHFactory.connect(owner).deploy(); // reuse as mock DAI
        await mockDai.waitForDeployment();
        // Fund owner with tokens
        await mockWeth.connect(owner).mint(owner.address, ethers.parseEther("10"));
        await mockDai.connect(owner).mint(owner.address, ethers.parseEther("10"));
        // 2. Deploy MockAavePool
        const MockAavePoolFactory = await ethers.getContractFactory("MockAavePool");
        mockAavePool = await MockAavePoolFactory.connect(owner).deploy();
        await mockAavePool.waitForDeployment();
        // 3. Deploy MockChainlinkAggregator
        const MockChainlinkAggregatorFactory = await ethers.getContractFactory("MockChainlinkAggregator");
        const initialMockChainlinkPrice = ethers.parseUnits("3000", ETH_USD_PRICE_DECIMALS);
        mockChainlinkAggregator = await MockChainlinkAggregatorFactory.connect(owner).deploy(
            initialMockChainlinkPrice, ETH_USD_PRICE_DECIMALS
        );
        await mockChainlinkAggregator.waitForDeployment();
        // 4. Deploy RateVolatilityOracle
        const RateVolatilityOracleFactory = await ethers.getContractFactory("RateVolatilityOracle");
        rateVolatilityOracle = await RateVolatilityOracleFactory.connect(owner).deploy(
            await mockChainlinkAggregator.getAddress(), 5
        );
        await rateVolatilityOracle.waitForDeployment();
        await rateVolatilityOracle.connect(owner).setInitialRate();
        // 5. Deploy MockMainVault
        const MockMainVaultFactory = await ethers.getContractFactory("MockMainVault");
        mockMainVault = await MockMainVaultFactory.connect(owner).deploy(ethers.ZeroAddress);
        await mockMainVault.waitForDeployment();
        // 6. Deploy MockYieldProtocol
        const MockYieldProtocolFactory = await ethers.getContractFactory("MockYieldProtocol");
        mockYieldProtocol = await MockYieldProtocolFactory.connect(owner).deploy();
        await mockYieldProtocol.waitForDeployment();
        // 7. Deploy VaultRouterHook
        const VaultRouterHookFactory = await ethers.getContractFactory("VaultRouterHook");
        vaultRouterHook = await VaultRouterHookFactory.connect(owner).deploy(
            await mockAavePool.getAddress(),
            await mockMainVault.getAddress(),
            await rateVolatilityOracle.getAddress()
        );
        await vaultRouterHook.waitForDeployment();
        await mockMainVault.connect(owner).setHookAddress(await vaultRouterHook.getAddress());
        await vaultRouterHook.connect(owner).setYieldProtocolAddress(await mockYieldProtocol.getAddress());
    });

    it("Should set token thresholds correctly", async function () {
        const thresholdAmount = ethers.parseEther("0.05");
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), thresholdAmount);
        expect(await vaultRouterHook.tokenThresholds(await mockWeth.getAddress())).to.equal(thresholdAmount);
    });

    it("Should route funds to yield when balance exceeds threshold", async function () {
        const threshold = ethers.parseEther("0.1");
        const initialHookWethBalance = ethers.parseEther("0.2");
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), threshold);
        await mockWeth.transfer(await vaultRouterHook.getAddress(), initialHookWethBalance);
        expect(await mockWeth.balanceOf(await vaultRouterHook.getAddress())).to.equal(initialHookWethBalance);
        // Call checkAndRouteFunds from mockMainVault
        await mockMainVault.connect(owner).triggerCheckAndRoute(await mockWeth.getAddress());
        // After routing, hook should have threshold, yield protocol should have excess
        expect(await mockWeth.balanceOf(await vaultRouterHook.getAddress())).to.equal(threshold);
        expect(await mockWeth.balanceOf(await mockYieldProtocol.getAddress())).to.equal(initialHookWethBalance - threshold);
    });

    it("Should NOT route funds if balance is below or equal to threshold", async function () {
        const threshold = ethers.parseEther("0.1");
        const initialHookWethBalance = ethers.parseEther("0.05");
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), threshold);
        await mockWeth.transfer(await vaultRouterHook.getAddress(), initialHookWethBalance);
        const hookBalanceBefore = await mockWeth.balanceOf(await vaultRouterHook.getAddress());
        const yieldProtocolBalanceBefore = await mockWeth.balanceOf(await mockYieldProtocol.getAddress());
        await mockMainVault.connect(owner).triggerCheckAndRoute(await mockWeth.getAddress());
        expect(await mockWeth.balanceOf(await vaultRouterHook.getAddress())).to.equal(hookBalanceBefore);
        expect(await mockWeth.balanceOf(await mockYieldProtocol.getAddress())).to.equal(yieldProtocolBalanceBefore);
    });

    it("Should trigger unwind and repay on claim", async function () {
        await expect(mockMainVault.connect(owner).triggerUnwindAndRepay(await mockWeth.getAddress()))
            .to.emit(vaultRouterHook, "ClaimUnwindAndRepay")
            .withArgs(await mockWeth.getAddress());
    });

    it("Should revert if non-vault/non-owner calls depositToAave or withdrawFromAave", async function () {
        const threshold = ethers.parseEther("0.1");
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), threshold);
        // Try calling as receiver (not owner or mainVault)
        await expect(
            vaultRouterHook.connect(other).depositToAave(await mockWeth.getAddress(), threshold)
        ).to.be.revertedWith("VaultRouterHook: Only vault or owner can call");
        await expect(
            vaultRouterHook.connect(other).withdrawFromAave(await mockWeth.getAddress(), threshold)
        ).to.be.revertedWith("VaultRouterHook: Only vault or owner can call");
    });

    it("Should revert if non-vault calls checkAndRouteFunds or onClaimUnwindAndRepay", async function () {
        await expect(
            vaultRouterHook.connect(other).checkAndRouteFunds(await mockWeth.getAddress())
        ).to.be.revertedWith("VaultRouterHook: Only main vault can trigger routing");
        await expect(
            vaultRouterHook.connect(other).onClaimUnwindAndRepay(await mockWeth.getAddress())
        ).to.be.revertedWith("VaultRouterHook: Only main vault can trigger unwind/repay");
    });

    it("Should allow threshold to be changed after routing", async function () {
        const threshold1 = ethers.parseEther("0.1");
        const threshold2 = ethers.parseEther("0.05");
        const initialHookWethBalance = ethers.parseEther("0.2");
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), threshold1);
        await mockWeth.transfer(await vaultRouterHook.getAddress(), initialHookWethBalance);
        await mockMainVault.connect(owner).triggerCheckAndRoute(await mockWeth.getAddress());
        // Change threshold and route again
        await vaultRouterHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), threshold2);
        await mockMainVault.connect(owner).triggerCheckAndRoute(await mockWeth.getAddress());
        expect(await mockWeth.balanceOf(await vaultRouterHook.getAddress())).to.equal(threshold2);
    });

    it("Should revert if yield protocol address is not set", async function () {
        // Deploy a new VaultRouterHook with no yield protocol set
        const VaultRouterHookFactory = await ethers.getContractFactory("VaultRouterHook");
        const newHook = await VaultRouterHookFactory.connect(owner).deploy(
            await mockAavePool.getAddress(),
            await mockMainVault.getAddress(),
            await rateVolatilityOracle.getAddress()
        );
        await newHook.waitForDeployment();
        await newHook.connect(owner).setTokenThreshold(await mockWeth.getAddress(), ethers.parseEther("0.01"));
        // Transfer WETH to new hook
        await mockWeth.connect(owner).transfer(await newHook.getAddress(), ethers.parseEther("0.1"));
        // Should revert on routing (call directly as main vault)
        await expect(
            newHook.connect(owner).checkAndRouteFunds(await mockWeth.getAddress())
        ).to.be.revertedWith("VaultRouterHook: Yield protocol not set");
    });

    it("Should set initial rate in the oracle and detect no movement if within threshold", async function () {
        const initialPrice = await rateVolatilityOracle.initialRate();
        expect(initialPrice).to.equal(ethers.parseUnits("3000", ETH_USD_PRICE_DECIMALS));
        const [hasMoved, movedUp, movedDown] = await rateVolatilityOracle.hasRateMovedBeyondThreshold();
        expect(hasMoved).to.be.false;
        expect(movedUp).to.be.false;
        expect(movedDown).to.be.false;
        await expect(vaultRouterHook.connect(owner).checkFXVolatilityAndHedge(await mockWeth.getAddress()))
            .to.not.emit(vaultRouterHook, "HedgingActionTriggered");
    });

    it("Should detect price movement above threshold and trigger hedging action", async function () {
        const initialPrice = await rateVolatilityOracle.initialRate();
        const newPrice = initialPrice * ethers.BigNumber.from(106) / ethers.BigNumber.from(100);
        await mockChainlinkAggregator.connect(owner).setAnswer(newPrice);
        await expect(vaultRouterHook.connect(owner).checkFXVolatilityAndHedge(await mockWeth.getAddress()))
            .to.emit(vaultRouterHook, "HedgingActionTriggered")
            .withArgs(await mockWeth.getAddress(), "RateMovedUp", ethers.BigNumber.from(0));
    });

    it("Should detect price movement below threshold and trigger hedging action", async function () {
        const initialPrice = await rateVolatilityOracle.initialRate();
        const newPrice = initialPrice * ethers.BigNumber.from(94) / ethers.BigNumber.from(100);
        await mockChainlinkAggregator.connect(owner).setAnswer(newPrice);
        await expect(vaultRouterHook.connect(owner).checkFXVolatilityAndHedge(await mockWeth.getAddress()))
            .to.emit(vaultRouterHook, "HedgingActionTriggered")
            .withArgs(await mockWeth.getAddress(), "RateMovedDown", ethers.BigNumber.from(0));
    });

    it("Should NOT trigger hedging action if rate movement is within threshold (re-check)", async function () {
        const initialPrice = await rateVolatilityOracle.initialRate();
        const newPrice = initialPrice * ethers.BigNumber.from(102) / ethers.BigNumber.from(100);
        await mockChainlinkAggregator.connect(owner).setAnswer(newPrice);
        await expect(vaultRouterHook.connect(owner).checkFXVolatilityAndHedge(await mockWeth.getAddress()))
            .to.not.emit(vaultRouterHook, "HedgingActionTriggered");
    });
});

describe("keeperRouteAll", function () {
    it("routes funds for all supported tokens above threshold", async function () {
        const [owner, yieldProtocol, user] = await ethers.getSigners();
        const MockWETH = await ethers.getContractFactory("MockWETH");
        const weth = await MockWETH.deploy();
        await weth.waitForDeployment();
        const MockDAI = await ethers.getContractFactory("MockWETH"); // reuse as mock DAI
        const dai = await MockDAI.deploy();
        await dai.waitForDeployment();
        const VaultRouterHook = await ethers.getContractFactory("VaultRouterHook");
        const hook = await VaultRouterHook.deploy(owner.address, owner.address);
        await hook.waitForDeployment();
        await hook.setYieldProtocolAddress(yieldProtocol.address);
        await hook.setTokenThreshold(await weth.getAddress(), ethers.parseEther("1"));
        await hook.setTokenThreshold(await dai.getAddress(), ethers.parseEther("2"));
        // Fund hook with tokens
        await weth.mint(await hook.getAddress(), ethers.parseEther("5"));
        await dai.mint(await hook.getAddress(), ethers.parseEther("10"));
        // Call keeperRouteAll
        await hook.keeperRouteAll();
        // Check balances
        const wethBalance = await weth.balanceOf(yieldProtocol.address);
        const daiBalance = await dai.balanceOf(yieldProtocol.address);
        expect(wethBalance).to.equal(ethers.parseEther("4")); // 5 - 1
        expect(daiBalance).to.equal(ethers.parseEther("8")); // 10 - 2
    });
});