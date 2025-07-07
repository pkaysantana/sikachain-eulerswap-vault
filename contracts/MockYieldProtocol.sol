// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockYieldProtocol {
    // This contract just needs to be able to receive ERC20 tokens and ETH for testing
    receive() external payable {}
    fallback() external payable {}
} 