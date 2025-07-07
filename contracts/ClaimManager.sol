// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ClaimManager {
    // --- State Variables ---
    uint256 public claimWindow;
    mapping(bytes32 => uint256) public depositTimestamps;
    address public vaultAddress;
    address public owner; // ADDED: To control who can set the vault address

    // --- Modifiers ---
    modifier onlyVault() {
        require(msg.sender == vaultAddress, "Only vault can call");
        _;
    }

    // ADDED: Modifier to restrict functions to the owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    // --- Constructor ---
    constructor(uint256 _claimWindowSeconds) {
        claimWindow = _claimWindowSeconds;
        owner = msg.sender; // The deployer is set as the owner
    }

    // --- External Functions ---

    // UPDATED: Now restricted to only the owner
    function setVaultAddress(address _vaultAddress) external onlyOwner {
        require(vaultAddress == address(0), "Vault address already set");
        require(_vaultAddress != address(0), "Invalid vault address");
        vaultAddress = _vaultAddress;
    }

    function recordDeposit(bytes32 depositId) external onlyVault {
        require(depositTimestamps[depositId] == 0, "Deposit already recorded");
        depositTimestamps[depositId] = block.timestamp;
    }

    function isClaimable(bytes32 depositId) external view returns (bool) {
        uint256 depositTime = depositTimestamps[depositId];
        if (depositTime == 0) {
            return false;
        }
        return block.timestamp <= (depositTime + claimWindow);
    }

    function isExpired(bytes32 depositId) external view returns (bool) {
        uint256 depositTime = depositTimestamps[depositId];
        if (depositTime == 0) {
            return false;
        }
        return block.timestamp > (depositTime + claimWindow);
    }
}