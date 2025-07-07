// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRateLockOracle
 * @dev Interface for the mocked FX oracle to fetch the latest exchange rate.
 * It's designed to be flexible, allowing for different token pairs.
 */
interface IRateLockOracle {
    /**
     * @dev Returns the exchange rate between two tokens.
     * @param fromToken The address of the source token (e.g., USDC).
     * @param toToken The address of the destination token (e.g., GHS-stablecoin).
     * @return rate The exchange rate, returned as a fixed-point number.
     */
    function getRate(
        address fromToken,
        address toToken
    ) external view returns (uint256);
}