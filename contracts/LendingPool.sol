// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PriceOracle.sol";

contract LendingPool is Ownable, ReentrancyGuard {
    struct MarketData {
        bool isActive;
        uint256 totalSupply;
        uint256 totalBorrow;
        uint256 reserveFactor; // Percentage in basis points
        uint256 collateralFactor; // Percentage in basis points (max 75%)
        uint256 liquidationThreshold; // Percentage in basis points
        uint256 baseInterestRate;
        uint256 multiplier;
        uint256 lastUpdateTimestamp;
    }
    
    struct UserData {
        uint256 supplied;
        uint256 borrowed;
        uint256 lastInterestIndex;
        uint256 collateralShares;
    }
    
    mapping(address => MarketData) public markets;
    mapping(address => mapping(address => UserData)) public userData; // user => token => data
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;
    
    PriceOracle public priceOracle;
    
    uint256 public constant LIQUIDATION_INCENTIVE = 1050; // 5% bonus for liquidators
    uint256 public constant MAX_COLLATERAL_FACTOR = 7500; // 75%
    uint256 public constant SECONDS_PER_YEAR = 31536000;
    
    event Supply(address indexed user, address indexed token, uint256 amount);
    event Withdraw(address indexed user, address indexed token, uint256 amount);
    event Borrow(address indexed user, address indexed token, uint256 amount);
    event Repay(address indexed user, address indexed token, uint256 amount);
    event Liquidation(address indexed liquidator, address indexed borrower, address indexed collateralToken, uint256 amount);
    
    constructor(address _priceOracle) Ownable(msg.sender) {
        priceOracle = PriceOracle(_priceOracle);
    }
    
    modifier updateInterest(address token) {
        _updateInterest(token);
        _;
    }
    
    modifier marketExists(address token) {
        require(supportedTokens[token], "Market does not exist");
        _;
    }
    
    function createMarket(
        address token,
        uint256 collateralFactor,
        uint256 liquidationThreshold,
        uint256 reserveFactor,
        uint256 baseInterestRate,
        uint256 multiplier
    ) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedTokens[token], "Market already exists");
        require(collateralFactor <= MAX_COLLATERAL_FACTOR, "Collateral factor too high");
        require(liquidationThreshold > collateralFactor, "Invalid liquidation threshold");
        
        markets[token] = MarketData({
            isActive: true,
            totalSupply: 0,
            totalBorrow: 0,
            reserveFactor: reserveFactor,
            collateralFactor: collateralFactor,
            liquidationThreshold: liquidationThreshold,
            baseInterestRate: baseInterestRate,
            multiplier: multiplier,
            lastUpdateTimestamp: block.timestamp
        });
        
        supportedTokens[token] = true;
        tokenList.push(token);
    }
    
    function supply(address token, uint256 amount) external marketExists(token) updateInterest(token) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(markets[token].isActive, "Market is not active");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        userData[msg.sender][token].supplied += amount;
        markets[token].totalSupply += amount;
        
        emit Supply(msg.sender, token, amount);
    }
    
    function withdraw(address token, uint256 amount) external marketExists(token) updateInterest(token) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(userData[msg.sender][token].supplied >= amount, "Insufficient supply balance");
        
        // Check if withdrawal maintains safe collateral ratio
        require(_checkHealthFactor(msg.sender, token, amount, 0), "Withdrawal would make position unhealthy");
        
        userData[msg.sender][token].supplied -= amount;
        markets[token].totalSupply -= amount;
        
        IERC20(token).transfer(msg.sender, amount);
        emit Withdraw(msg.sender, token, amount);
    }
    
    function borrow(address token, uint256 amount) external marketExists(token) updateInterest(token) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(markets[token].isActive, "Market is not active");
        require(amount <= _getMaxBorrowAmount(msg.sender, token), "Insufficient collateral");
        
        userData[msg.sender][token].borrowed += amount;
        markets[token].totalBorrow += amount;
        
        IERC20(token).transfer(msg.sender, amount);
        emit Borrow(msg.sender, token, amount);
    }
    
    function repay(address token, uint256 amount) external marketExists(token) updateInterest(token) nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        uint256 borrowBalance = userData[msg.sender][token].borrowed;
        uint256 repayAmount = amount > borrowBalance ? borrowBalance : amount;
        
        IERC20(token).transferFrom(msg.sender, address(this), repayAmount);
        
        userData[msg.sender][token].borrowed -= repayAmount;
        markets[token].totalBorrow -= repayAmount;
        
        emit Repay(msg.sender, token, repayAmount);
    }
    
    function liquidate(
        address borrower,
        address collateralToken,
        address borrowToken,
        uint256 repayAmount
    ) external marketExists(collateralToken) marketExists(borrowToken) nonReentrant {
        require(_isLiquidatable(borrower), "Position is healthy");
        
        uint256 borrowBalance = userData[borrower][borrowToken].borrowed;
        require(repayAmount <= borrowBalance / 2, "Cannot liquidate more than 50%");
        
        // Calculate collateral to seize
        uint256 collateralPrice = priceOracle.getLatestPrice(collateralToken);
        uint256 borrowPrice = priceOracle.getLatestPrice(borrowToken);
        
        uint256 collateralSeized = (repayAmount * borrowPrice * LIQUIDATION_INCENTIVE) / (collateralPrice * 1000);
        
        require(userData[borrower][collateralToken].supplied >= collateralSeized, "Insufficient collateral");
        
        // Transfer repay amount from liquidator
        IERC20(borrowToken).transferFrom(msg.sender, address(this), repayAmount);
        
        // Transfer collateral to liquidator
        IERC20(collateralToken).transfer(msg.sender, collateralSeized);
        
        // Update borrower's positions
        userData[borrower][borrowToken].borrowed -= repayAmount;
        userData[borrower][collateralToken].supplied -= collateralSeized;
        markets[borrowToken].totalBorrow -= repayAmount;
        markets[collateralToken].totalSupply -= collateralSeized;
        
        emit Liquidation(msg.sender, borrower, collateralToken, collateralSeized);
    }
    
    function _updateInterest(address token) internal {
        MarketData storage market = markets[token];
        if (block.timestamp <= market.lastUpdateTimestamp) return;
        
        uint256 timeElapsed = block.timestamp - market.lastUpdateTimestamp;
        uint256 utilizationRate = market.totalSupply > 0 ? (market.totalBorrow * 1e18) / market.totalSupply : 0;
        
        uint256 borrowRate = market.baseInterestRate + (utilizationRate * market.multiplier) / 1e18;
        uint256 interestAccrued = (market.totalBorrow * borrowRate * timeElapsed) / (SECONDS_PER_YEAR * 1e18);
        
        market.totalBorrow += interestAccrued;
        market.lastUpdateTimestamp = block.timestamp;
    }
    
    function _getMaxBorrowAmount(address user, address borrowToken) internal view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            address token = tokenList[i];
            UserData memory userTokenData = userData[user][token];
            
            if (userTokenData.supplied > 0) {
                uint256 price = priceOracle.getLatestPrice(token);
                uint256 collateralValue = (userTokenData.supplied * price * markets[token].collateralFactor) / 10000;
                totalCollateralValue += collateralValue;
            }
            
            if (userTokenData.borrowed > 0) {
                uint256 price = priceOracle.getLatestPrice(token);
                totalBorrowValue += userTokenData.borrowed * price;
            }
        }
        
        if (totalCollateralValue <= totalBorrowValue) return 0;
        
        uint256 borrowPrice = priceOracle.getLatestPrice(borrowToken);
        return (totalCollateralValue - totalBorrowValue) / borrowPrice;
    }
    
    function _checkHealthFactor(address user, address token, uint256 withdrawAmount, uint256 borrowAmount) internal view returns (bool) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;
        
        for (uint256 i = 0; i < tokenList.length; i++) {
            address currentToken = tokenList[i];
            UserData memory userTokenData = userData[user][currentToken];
            
            uint256 supplied = userTokenData.supplied;
            uint256 borrowed = userTokenData.borrowed;
            
            // Adjust for potential withdrawal
            if (currentToken == token) {
                supplied = supplied >= withdrawAmount ? supplied - withdrawAmount : 0;
                borrowed += borrowAmount;
            }
            
            if (supplied > 0) {
                uint256 price = priceOracle.getLatestPrice(currentToken);
                uint256 collateralValue = (supplied * price * markets[currentToken].liquidationThreshold) / 10000;
                totalCollateralValue += collateralValue;
            }
            
            if (borrowed > 0) {
                uint256 price = priceOracle.getLatestPrice(currentToken);
                totalBorrowValue += borrowed * price;
            }
        }
        
        return totalCollateralValue >= totalBorrowValue;
    }
    
    function _isLiquidatable(address user) internal view returns (bool) {
        return !_checkHealthFactor(user, address(0), 0, 0);
    }
    
    // View functions
    function getUserAccountData(address user) external view returns (
        uint256 totalCollateralETH,
        uint256 totalBorrowETH,
        uint256 availableBorrowETH,
        uint256 liquidationThreshold,
        uint256 healthFactor
    ) {
        for (uint256 i = 0; i < tokenList.length; i++) {
            address token = tokenList[i];
            UserData memory userTokenData = userData[user][token];
            
            if (userTokenData.supplied > 0 || userTokenData.borrowed > 0) {
                uint256 price = priceOracle.getLatestPrice(token);
                
                if (userTokenData.supplied > 0) {
                    totalCollateralETH += userTokenData.supplied * price;
                    availableBorrowETH += (userTokenData.supplied * price * markets[token].collateralFactor) / 10000;
                }
                
                if (userTokenData.borrowed > 0) {
                    totalBorrowETH += userTokenData.borrowed * price;
                }
            }
        }
        
        availableBorrowETH = availableBorrowETH > totalBorrowETH ? availableBorrowETH - totalBorrowETH : 0;
        healthFactor = totalBorrowETH > 0 ? (totalCollateralETH * 1e18) / totalBorrowETH : type(uint256).max;
        liquidationThreshold = 8000; // 80% average
    }
    
    function getMarketData(address token) external view returns (MarketData memory) {
        return markets[token];
    }
    
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }
}
