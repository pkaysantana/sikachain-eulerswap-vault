// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVault
 * @dev Interface for the main RemittanceVault contract.
 * Defines the core functions for depositing, claiming, and refunding funds.
 */
interface IVault {
    /**
     * @dev Creates a new remittance deposit.
     * @param recipient The address that is authorized to claim the funds.
     * @param amount The amount of the token being deposited.
     * @param token The ERC20 token address.
     */
    function deposit(
        address recipient,
        uint256 amount,
        address token
    ) external;

    /**
     * @dev Allows the recipient to claim a deposit.
     * @param depositId The unique ID of the deposit.
     */
    function claim(bytes32 depositId) external;

    /**
     * @dev Allows the original sender to refund an expired deposit.
     * @param depositId The unique ID of the deposit.
     */
    function refund(bytes32 depositId) external;

    /**
     * @dev Retrieves the locked FX rate for a specific deposit.
     * @param depositId The unique ID of the deposit.
     * @return The locked exchange rate.
     */
    function getLockedRate(bytes32 depositId) external view returns (uint256);
}