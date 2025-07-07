// contracts/RateVolatilityOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract RateVolatilityOracle is Ownable {
    AggregatorV3Interface internal priceFeed;
    uint256 public initialRate; // Stored rate at deposit lock / initial check
    uint256 public volatilityThresholdPercentage; // e.g., 5 for 5%

    // Events to signal price movements
    event PriceVolatilityDetected(
        int256 currentRate,
        uint256 initialRate,
        uint256 volatilityThreshold,
        bool movedUp,
        bool movedDown
    );

    constructor(address _priceFeedAddress, uint256 _volatilityThresholdPercentage) Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
        volatilityThresholdPercentage = _volatilityThresholdPercentage;
    }

    // Function to set the initial rate (e.g., when a deposit is locked)
    function setInitialRate() external onlyOwner {
        (, int256 price, , ,) = priceFeed.latestRoundData();
        require(price > 0, "RateVolatilityOracle: Invalid price from feed");
        initialRate = uint256(price);
        // Emitting an event here might be useful
    }

    // Function to manually set the initial rate (for testing or specific scenarios)
    function setInitialRateManual(uint256 _rate) external onlyOwner {
        initialRate = _rate;
    }

    // Function to get the current price from the Chainlink feed
    function getLatestPrice() public view returns (int256) {
        (, int256 price, , ,) = priceFeed.latestRoundData();
        return price;
    }

    // Function to check if the current FX rate has moved beyond the threshold
    function hasRateMovedBeyondThreshold() public view returns (bool, bool, bool) {
        // Returns (hasMoved, movedUp, movedDown)
        if (initialRate == 0) {
            // Cannot check volatility if initial rate is not set
            return (false, false, false);
        }

        int256 currentPrice = getLatestPrice();
        if (currentPrice == 0) {
            // Cannot check volatility if current price is invalid
            return (false, false, false);
        }

        uint256 currentRate = uint256(currentPrice);

        // Calculate upper and lower bounds for the threshold
        // initialRate * (100 + threshold) / 100
        uint256 upperThreshold = initialRate * (100 + volatilityThresholdPercentage) / 100;
        // initialRate * (100 - threshold) / 100
        uint256 lowerThreshold = initialRate * (100 - volatilityThresholdPercentage) / 100;

        bool movedUp = currentRate > upperThreshold;
        bool movedDown = currentRate < lowerThreshold;
        bool hasMoved = movedUp || movedDown;

        return (hasMoved, movedUp, movedDown);
    }

    // Function to set the volatility threshold percentage
    function setVolatilityThresholdPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage > 0 && _percentage <= 100, "Threshold must be between 1 and 100");
        volatilityThresholdPercentage = _percentage;
    }
}