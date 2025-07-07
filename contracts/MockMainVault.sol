// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./VaultRouterHook.sol";

contract MockMainVault {
    VaultRouterHook public hook;

    constructor(address _hookAddress) {
        hook = VaultRouterHook(_hookAddress);
    }

    function setHookAddress(address _hookAddress) external {
        hook = VaultRouterHook(_hookAddress);
    }

    function triggerCheckAndRoute(address token) external {
        hook.checkAndRouteFunds(token);
    }

    function triggerUnwindAndRepay(address token) external {
        hook.onClaimUnwindAndRepay(token);
    }
} 