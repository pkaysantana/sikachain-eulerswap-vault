// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAavePool {
    event Supplied(address indexed asset, uint256 amount, address indexed onBehalfOf, uint16 referralCode);
    event Withdrawn(address indexed asset, uint256 amount, address indexed to);

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        emit Supplied(asset, amount, onBehalfOf, referralCode);
    }

    function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
        emit Withdrawn(asset, amount, to);
        return amount;
    }
} 