// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/interfaces/IPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./RateVolatilityOracle.sol";

contract VaultRouterHook is Ownable {
    IPool public immutable aavePool;
    mapping(address => uint256) public tokenThresholds;
    address public mainVault;
    address public yieldProtocolAddress;
    address[] public supportedTokens;
    mapping(address => bool) public isSupportedToken;
    RateVolatilityOracle public immutable rateVolatilityOracle;

    event FundsRouted(address indexed token, uint256 amount, address indexed yieldProtocol);
    event ClaimUnwindAndRepay(address indexed token);
    event HedgingActionTriggered(address indexed asset, string actionType, uint256 amount);

    constructor(address _aavePoolAddress, address _mainVaultAddress, address _rateVolatilityOracleAddress) Ownable(msg.sender) {
        aavePool = IPool(_aavePoolAddress);
        mainVault = _mainVaultAddress;
        rateVolatilityOracle = RateVolatilityOracle(_rateVolatilityOracleAddress);
    }

    function setMainVaultAddress(address _mainVault) external onlyOwner {
        mainVault = _mainVault;
    }

    function depositToAave(address asset, uint256 amount) external {
        require(msg.sender == mainVault || msg.sender == owner(), "VaultRouterHook: Only vault or owner can call");
        IERC20(asset).approve(address(aavePool), amount);
        aavePool.supply(asset, amount, address(this), 0);
    }

    function withdrawFromAave(address asset, uint256 amount) external {
        require(msg.sender == mainVault || msg.sender == owner(), "VaultRouterHook: Only vault or owner can call");
        aavePool.withdraw(asset, amount, address(this));
    }

    function setTokenThreshold(address token, uint256 threshold) external onlyOwner {
        tokenThresholds[token] = threshold;
        if (!isSupportedToken[token]) {
            supportedTokens.push(token);
            isSupportedToken[token] = true;
        }
    }

    function setYieldProtocolAddress(address _yieldProtocolAddress) external onlyOwner {
        yieldProtocolAddress = _yieldProtocolAddress;
    }

    function checkAndRouteFunds(address token) external {
        require(msg.sender == mainVault, "VaultRouterHook: Only main vault can trigger routing");
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        uint256 threshold = tokenThresholds[token];
        if (currentBalance > threshold) {
            uint256 amountToRoute = currentBalance - threshold;
            require(yieldProtocolAddress != address(0), "VaultRouterHook: Yield protocol not set");
            IERC20(token).transfer(yieldProtocolAddress, amountToRoute);
            emit FundsRouted(token, amountToRoute, yieldProtocolAddress);
        }
    }

    function onClaimUnwindAndRepay(address token) external {
        require(msg.sender == mainVault, "VaultRouterHook: Only main vault can trigger unwind/repay");
        // Placeholder for unwind/repay logic
        emit ClaimUnwindAndRepay(token);
    }

    /// @notice Called by a keeper bot to route funds for all supported tokens if above threshold
    function keeperRouteAll() external {
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            address token = supportedTokens[i];
            uint256 currentBalance = IERC20(token).balanceOf(address(this));
            uint256 threshold = tokenThresholds[token];
            if (currentBalance > threshold && yieldProtocolAddress != address(0)) {
                uint256 amountToRoute = currentBalance - threshold;
                IERC20(token).transfer(yieldProtocolAddress, amountToRoute);
                emit FundsRouted(token, amountToRoute, yieldProtocolAddress);
            }
        }
    }

    function checkFXVolatilityAndHedge(address volatileAsset) external {
        require(msg.sender == mainVault || msg.sender == owner(), "VaultRouterHook: Unauthorized FX check");
        (bool hasMoved, bool movedUp, bool movedDown) = rateVolatilityOracle.hasRateMovedBeyondThreshold();
        uint256 amountToHedge = 0; // Placeholder, implement logic as needed
        if (hasMoved) {
            if (movedUp) {
                // Placeholder for shorting via Euler
                // _hedgeViaEulerShort(volatileAsset, amountToHedge);
                emit HedgingActionTriggered(volatileAsset, "RateMovedUp", amountToHedge);
            } else if (movedDown) {
                // Placeholder for early payout/insurance
                // _triggerEarlyPayoutOrInsurance();
                emit HedgingActionTriggered(volatileAsset, "RateMovedDown", amountToHedge);
            }
        }
    }

    function _hedgeViaEulerShort(address asset, uint256 amount) internal {
        // Placeholder for Euler integration
    }

    function _triggerEarlyPayoutOrInsurance() internal {
        // Placeholder for payout/insurance logic
    }
}