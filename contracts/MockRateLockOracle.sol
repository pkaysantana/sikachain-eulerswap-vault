// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRateLockOracle.sol";

/**
 * @title MockRateLockOracle
 * @dev A mock implementation of the IRateLockOracle for testing purposes.
 * It returns a hardcoded, fixed exchange rate.
 */
contract MockRateLockOracle is IRateLockOracle {
    //
    // ==================
    // STATE VARIABLES
    // ==================
    //

    // The fixed exchange rate. Using 18 decimals for precision.
    // Example: 1.32 would be stored as 1.32 * 10**18 = 1320000000000000000
    uint256 private fixedRate;

    //
    // ==================
    // CONSTRUCTOR
    // ==================
    //

    /**
     * @dev Sets the initial exchange rate when the contract is deployed.
     * @param _initialRate The initial rate to set for the mock oracle.
     */
    constructor(uint256 _initialRate) {
        fixedRate = _initialRate;
    }

    //
    // ==================
    // EXTERNAL FUNCTIONS
    // ==================
    //

    /**
     * @dev Implementation of the interface function to get the rate.
     * It ignores the token addresses and returns the fixed rate.
     * @param fromToken The address of the source token (unused in mock).
     * @param toToken The address of the destination token (unused in mock).
     * @return rate The hardcoded exchange rate.
     */
    function getRate(
        address fromToken,
        address toToken
    ) external view override returns (uint256) {
        // In this mock, we ignore the tokens and always return the same rate.
        return fixedRate;
    }

    /**
     * @dev Allows the contract owner to update the fixed rate for testing.
     * @param _newRate The new exchange rate to set.
     */
    function setRate(uint256 _newRate) external {
        // In a real contract, this would be restricted to an owner/admin.
        // For a mock, keeping it open is fine for easy testing.
        fixedRate = _newRate;
    }
}