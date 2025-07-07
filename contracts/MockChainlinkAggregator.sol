// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockChainlinkAggregator is AggregatorV3Interface, Ownable {
    int256 public answer;
    uint8 public decimalsValue;

    constructor(int256 _initialAnswer, uint8 _decimals) Ownable(msg.sender) {
        answer = _initialAnswer;
        decimalsValue = _decimals;
    }

    function setAnswer(int256 _newAnswer) public onlyOwner {
        answer = _newAnswer;
    }

    function decimals() external view override returns (uint8) {
        return decimalsValue;
    }

    function description() external pure override returns (string memory) {
        return "Mock ETH / USD Price Feed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId) external view override returns (
        uint80 roundId,
        int256 answer_,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        roundId = _roundId;
        answer_ = answer;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = _roundId;
    }

    function latestRoundData() external view override returns (
        uint80 roundId,
        int256 answer_,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        roundId = 1;
        answer_ = answer;
        startedAt = block.timestamp;
        updatedAt = block.timestamp;
        answeredInRound = 1;
    }
} 