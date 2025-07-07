// contracts/ChainlinkOracle.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// CORRECTED: Using the local interface file
import "./interfaces/AggregatorV3Interface.sol"; 
import "./interfaces/IRateLockOracle.sol";

contract ChainlinkOracle is IRateLockOracle {
    
    AggregatorV3Interface internal priceFeed;

    constructor(address _priceFeedAddress) {
        priceFeed = AggregatorV3Interface(_priceFeedAddress);
    }

    function getRate(
        address, 
        address
    ) external view override returns (uint256) {
        (
            ,
            int price,
            ,
            ,
            
        ) = priceFeed.latestRoundData();
        
        require(price > 0, "Chainlink price is not valid");

        return uint256(price);
    }
}