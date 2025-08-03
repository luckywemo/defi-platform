// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PriceOracle is Ownable, ReentrancyGuard {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
        bool isValid;
    }
    
    mapping(address => PriceData) public tokenPrices;
    mapping(address => bool) public priceFeeds;
    
    uint256 public constant PRICE_VALIDITY_PERIOD = 3600; // 1 hour
    uint256 public constant MAX_PRICE_DEVIATION = 1000; // 10% in basis points
    
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event PriceFeedAdded(address indexed token, address indexed feed);
    event PriceFeedRemoved(address indexed token);
    
    modifier onlyValidPriceFeed(address token) {
        require(priceFeeds[token], "Price feed not authorized");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    function updatePrice(address token, uint256 price) external onlyValidPriceFeed(token) nonReentrant {
        require(price > 0, "Price must be greater than 0");
        
        PriceData storage currentPrice = tokenPrices[token];
        
        // Check for excessive price deviation
        if (currentPrice.isValid && currentPrice.timestamp > block.timestamp - PRICE_VALIDITY_PERIOD) {
            uint256 deviation = price > currentPrice.price 
                ? ((price - currentPrice.price) * 10000) / currentPrice.price
                : ((currentPrice.price - price) * 10000) / currentPrice.price;
            
            require(deviation <= MAX_PRICE_DEVIATION, "Price deviation too high");
        }
        
        tokenPrices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            isValid: true
        });
        
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    function getPrice(address token) external view returns (uint256 price, uint256 timestamp, bool isValid) {
        PriceData memory data = tokenPrices[token];
        bool valid = data.isValid && (block.timestamp - data.timestamp <= PRICE_VALIDITY_PERIOD);
        
        return (data.price, data.timestamp, valid);
    }
    
    function getLatestPrice(address token) external view returns (uint256) {
        PriceData memory data = tokenPrices[token];
        require(data.isValid, "Price not available");
        require(block.timestamp - data.timestamp <= PRICE_VALIDITY_PERIOD, "Price too old");
        
        return data.price;
    }
    
    function addPriceFeed(address token, address feed) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(feed != address(0), "Invalid feed address");
        
        priceFeeds[feed] = true;
        emit PriceFeedAdded(token, feed);
    }
    
    function removePriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[feed] = false;
        emit PriceFeedRemoved(token);
    }
    
    function isPriceValid(address token) external view returns (bool) {
        PriceData memory data = tokenPrices[token];
        return data.isValid && (block.timestamp - data.timestamp <= PRICE_VALIDITY_PERIOD);
    }
    
    function getMultiplePrices(address[] calldata tokens) external view returns (
        uint256[] memory prices,
        uint256[] memory timestamps,
        bool[] memory validities
    ) {
        uint256 length = tokens.length;
        prices = new uint256[](length);
        timestamps = new uint256[](length);
        validities = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            PriceData memory data = tokenPrices[tokens[i]];
            prices[i] = data.price;
            timestamps[i] = data.timestamp;
            validities[i] = data.isValid && (block.timestamp - data.timestamp <= PRICE_VALIDITY_PERIOD);
        }
    }
    
    // Emergency function to manually set price (use with caution)
    function emergencySetPrice(address token, uint256 price) external onlyOwner {
        tokenPrices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            isValid: true
        });
        
        emit PriceUpdated(token, price, block.timestamp);
    }
}
