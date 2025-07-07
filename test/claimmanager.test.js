const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper function to increase blockchain time in Hardhat Network
async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
}

describe("ClaimManager", function () {
  let claimManager;
  let owner;
  let vault;
  let otherUser;

  // Corrected line: removed .utils from the calls
  const depositId = ethers.keccak256(ethers.toUtf8Bytes("test-deposit-1"));
  const CLAIM_WINDOW_SECONDS = 3 * 60 * 60; // 3 hours

  beforeEach(async function () {
    [owner, vault, otherUser] = await ethers.getSigners();

    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    claimManager = await ClaimManager.deploy(CLAIM_WINDOW_SECONDS);

    await claimManager.setVaultAddress(vault.address);
  });

  it("Should set the correct claim window and vault address", async function () {
    expect(await claimManager.claimWindow()).to.equal(CLAIM_WINDOW_SECONDS);
    expect(await claimManager.vaultAddress()).to.equal(vault.address);
  });

  it("Should allow the vault to record a deposit", async function () {
    await claimManager.connect(vault).recordDeposit(depositId);

    const timestamp = await claimManager.depositTimestamps(depositId);
    expect(timestamp).to.be.gt(0);
  });

  it("Should NOT allow a non-vault address to record a deposit", async function () {
    await expect(
      claimManager.connect(otherUser).recordDeposit(depositId)
    ).to.be.revertedWith("Only vault can call");
  });

  describe("after a deposit is recorded", function () {
    beforeEach(async function () {
      await claimManager.connect(vault).recordDeposit(depositId);
    });

    it("Should be claimable immediately after recording", async function () {
      expect(await claimManager.isClaimable(depositId)).to.be.true;
      expect(await claimManager.isExpired(depositId)).to.be.false;
    });

    it("Should become expired after the claim window passes", async function () {
      await increaseTime(CLAIM_WINDOW_SECONDS + 1);

      expect(await claimManager.isClaimable(depositId)).to.be.false;
      expect(await claimManager.isExpired(depositId)).to.be.true;
    });
  });
});