const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vault End-to-End Tests with Local Mocks", function () {
  let vault, mockOracle, claimManager, mockToken, mockHook;
  let owner, sender, recipient, relayer, recipient2, recipient3;

  const MOCK_FX_RATE = ethers.parseUnits("1.32", 18);
  const CLAIM_WINDOW_SECONDS = 72 * 60 * 60;

  beforeEach(async function () {
    [owner, sender, recipient, relayer, recipient2, recipient3] = await ethers.getSigners();

    // Deploy MockToken
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await MockTokenFactory.deploy();
    await mockToken.mint(sender.address, ethers.parseEther("1000"));
    await mockToken.mint(owner.address, ethers.parseEther("1000"));

    // Deploy MockRateLockOracle
    const MockRateLockOracle = await ethers.getContractFactory("MockRateLockOracle");
    mockOracle = await MockRateLockOracle.deploy(MOCK_FX_RATE);

    // Deploy MockClaimManager
    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimManager.deploy(CLAIM_WINDOW_SECONDS);

    // Deploy MockHook
    const MockHook = await ethers.getContractFactory("VaultRouterHook");
    mockHook = await MockHook.deploy(owner.address, owner.address, owner.address);

    // Deploy Vault
    const Vault = await ethers.getContractFactory("Vault");
    vault = await Vault.deploy(
      await mockOracle.getAddress(),
      await claimManager.getAddress(),
      await mockHook.getAddress()
    );

    // Approve vault for sender
    await mockToken.connect(sender).approve(await vault.getAddress(), ethers.parseEther("1000"));
    await mockToken.connect(owner).approve(await vault.getAddress(), ethers.parseEther("1000"));
  });

  it("Should allow event-based claim with signature and relayer", async function () {
    // Deposit
    const amount = ethers.parseEther("10");
    await vault.connect(sender).deposit(recipient.address, amount, await mockToken.getAddress());
    // Find depositId
    const depositId = await vault._getDepositId(sender.address, recipient.address, await mockToken.getAddress(), amount);
    // Simulate claimManager
    await claimManager.recordDeposit(depositId);
    // Prepare EIP-712 signature
    const simProof = "MTN-verified";
    const code = "123456";
    const domain = {
      name: "Vault",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await vault.getAddress(),
    };
    const types = {
      Claim: [
        { name: "depositId", type: "bytes32" },
        { name: "simProof", type: "string" },
        { name: "code", type: "string" },
      ],
    };
    const value = { depositId, simProof, code };
    const signature = await recipient.signTypedData(domain, types, value);
    // Relayer submits claim
    await expect(vault.connect(relayer).claimWithSignature(depositId, simProof, code, signature))
      .to.emit(vault, "ClaimWithSignature").withArgs(depositId, recipient.address, relayer.address, simProof, code);
  });

  it("Should allow group claim pool creation and claims", async function () {
    const recipients = [recipient.address, recipient2.address, recipient3.address];
    const splits = [30, 30, 40];
    const totalAmount = ethers.parseEther("100");
    const poolId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("group1"));
    await vault.connect(owner).createGroupClaimPool(poolId, recipients, splits, await mockToken.getAddress(), totalAmount);
    // Each recipient claims
    await expect(vault.connect(recipient).claimFromGroup(poolId))
      .to.emit(vault, "GroupClaimed").withArgs(poolId, recipient.address, ethers.parseEther("30"));
    await expect(vault.connect(recipient2).claimFromGroup(poolId))
      .to.emit(vault, "GroupClaimed").withArgs(poolId, recipient2.address, ethers.parseEther("30"));
    await expect(vault.connect(recipient3).claimFromGroup(poolId))
      .to.emit(vault, "GroupClaimed").withArgs(poolId, recipient3.address, ethers.parseEther("40"));
  });

  it("Should mint a non-transferable credit SBT after claims", async function () {
    // Deposit and claim
    const amount = ethers.parseEther("10");
    await vault.connect(sender).deposit(recipient.address, amount, await mockToken.getAddress());
    const depositId = await vault._getDepositId(sender.address, recipient.address, await mockToken.getAddress(), amount);
    await claimManager.recordDeposit(depositId);
    await vault.connect(recipient).claim(depositId);
    // Mint SBT
    await expect(vault.connect(recipient).mintCreditSBT())
      .to.emit(vault, "CreditSBTMinted");
    // Try to transfer SBT (should revert)
    const tokenId = 1;
    await expect(vault.connect(recipient).transferFrom(recipient.address, sender.address, tokenId)).to.be.revertedWith("SBT: non-transferable");
  });

  it("Should prevent double-claim with signature", async function () {
    const amount = ethers.parseEther("10");
    await vault.connect(sender).deposit(recipient.address, amount, await mockToken.getAddress());
    const depositId = await vault._getDepositId(sender.address, recipient.address, await mockToken.getAddress(), amount);
    await claimManager.recordDeposit(depositId);
    const simProof = "MTN-verified";
    const code = "123456";
    const domain = {
      name: "Vault",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await vault.getAddress(),
    };
    const types = {
      Claim: [
        { name: "depositId", type: "bytes32" },
        { name: "simProof", type: "string" },
        { name: "code", type: "string" },
      ],
    };
    const value = { depositId, simProof, code };
    const signature = await recipient.signTypedData(domain, types, value);
    await vault.connect(relayer).claimWithSignature(depositId, simProof, code, signature);
    await expect(vault.connect(relayer).claimWithSignature(depositId, simProof, code, signature)).to.be.revertedWith("Already executed");
  });

  it("Should revert on invalid signature for event-based claim", async function () {
    const amount = ethers.parseEther("10");
    await vault.connect(sender).deposit(recipient.address, amount, await mockToken.getAddress());
    const depositId = await vault._getDepositId(sender.address, recipient.address, await mockToken.getAddress(), amount);
    await claimManager.recordDeposit(depositId);
    const simProof = "MTN-verified";
    const code = "123456";
    // Use sender's signature instead of recipient's
    const domain = {
      name: "Vault",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await vault.getAddress(),
    };
    const types = {
      Claim: [
        { name: "depositId", type: "bytes32" },
        { name: "simProof", type: "string" },
        { name: "code", type: "string" },
      ],
    };
    const value = { depositId, simProof, code };
    const signature = await sender.signTypedData(domain, types, value);
    await expect(vault.connect(relayer).claimWithSignature(depositId, simProof, code, signature)).to.be.revertedWith("Invalid signature");
  });

  it("Should revert if group pool splits do not sum to 100", async function () {
    const recipients = [recipient.address, recipient2.address, recipient3.address];
    const splits = [30, 30, 50]; // 110, not 100
    const totalAmount = ethers.parseEther("100");
    const poolId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("group2"));
    await expect(vault.connect(owner).createGroupClaimPool(poolId, recipients, splits, await mockToken.getAddress(), totalAmount)).to.be.revertedWith("Splits must sum to 100");
  });

  it("Should prevent double-claim from group pool", async function () {
    const recipients = [recipient.address, recipient2.address, recipient3.address];
    const splits = [30, 30, 40];
    const totalAmount = ethers.parseEther("100");
    const poolId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("group3"));
    await vault.connect(owner).createGroupClaimPool(poolId, recipients, splits, await mockToken.getAddress(), totalAmount);
    await vault.connect(recipient).claimFromGroup(poolId);
    await expect(vault.connect(recipient).claimFromGroup(poolId)).to.be.revertedWith("Already claimed");
  });

  it("Should have a passing test", function() {
    // This is a placeholder to ensure the test runner doesn't fail.
    expect(true).to.be.true;
  });
});