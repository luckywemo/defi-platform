// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Treasury is Ownable, ReentrancyGuard {
    event FundsDeposited(address indexed token, uint256 amount, address indexed from);
    event FundsWithdrawn(address indexed token, uint256 amount, address indexed to);
    event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed to);
    event ParameterUpdated(string parameter, uint256 oldValue, uint256 newValue);

    mapping(address => uint256) public tokenBalances;
    address[] public supportedTokens;
    mapping(address => bool) public isTokenSupported;

    // Platform parameters that can be updated via governance
    uint256 public dexFeePercent = 25; // 0.25%
    uint256 public treasuryFeePercent = 10; // 0.10%
    uint256 public maxFeePercent = 100; // 1.00%

    modifier onlyGovernance() {
        require(msg.sender == owner(), "Only governance can call this function");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function depositFunds(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        if (token == address(0)) {
            // ETH deposit
            require(msg.value == amount, "ETH amount mismatch");
            tokenBalances[address(0)] += amount;
        } else {
            // ERC20 token deposit
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            tokenBalances[token] += amount;
            
            if (!isTokenSupported[token]) {
                supportedTokens.push(token);
                isTokenSupported[token] = true;
            }
        }
        
        emit FundsDeposited(token, amount, msg.sender);
    }

    function withdrawFunds(address token, uint256 amount, address to) external onlyGovernance nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(to != address(0), "Invalid recipient");
        require(tokenBalances[token] >= amount, "Insufficient balance");

        tokenBalances[token] -= amount;

        if (token == address(0)) {
            // ETH withdrawal
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            // ERC20 token withdrawal
            IERC20(token).transfer(to, amount);
        }

        emit FundsWithdrawn(token, amount, to);
    }

    function emergencyWithdraw(address token, address to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        
        uint256 balance = tokenBalances[token];
        require(balance > 0, "No funds to withdraw");
        
        tokenBalances[token] = 0;

        if (token == address(0)) {
            // Emergency ETH withdrawal
            (bool success, ) = to.call{value: balance}("");
            require(success, "ETH transfer failed");
        } else {
            // Emergency ERC20 withdrawal
            IERC20(token).transfer(to, balance);
        }

        emit EmergencyWithdrawal(token, balance, to);
    }

    function updateDexFee(uint256 newFeePercent) external onlyGovernance {
        require(newFeePercent <= maxFeePercent, "Fee too high");
        uint256 oldFee = dexFeePercent;
        dexFeePercent = newFeePercent;
        emit ParameterUpdated("dexFeePercent", oldFee, newFeePercent);
    }

    function updateTreasuryFee(uint256 newFeePercent) external onlyGovernance {
        require(newFeePercent <= maxFeePercent, "Fee too high");
        uint256 oldFee = treasuryFeePercent;
        treasuryFeePercent = newFeePercent;
        emit ParameterUpdated("treasuryFeePercent", oldFee, newFeePercent);
    }

    function updateMaxFee(uint256 newMaxFeePercent) external onlyGovernance {
        require(newMaxFeePercent >= 10, "Max fee too low"); // At least 0.1%
        uint256 oldMaxFee = maxFeePercent;
        maxFeePercent = newMaxFeePercent;
        emit ParameterUpdated("maxFeePercent", oldMaxFee, newMaxFeePercent);
    }

    function getBalance(address token) external view returns (uint256) {
        return tokenBalances[token];
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function getTotalBalance() external view returns (uint256 ethBalance, address[] memory tokens, uint256[] memory balances) {
        ethBalance = tokenBalances[address(0)];
        tokens = supportedTokens;
        balances = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = tokenBalances[tokens[i]];
        }
    }

    // Allow contract to receive ETH
    receive() external payable {
        tokenBalances[address(0)] += msg.value;
        emit FundsDeposited(address(0), msg.value, msg.sender);
    }
}
