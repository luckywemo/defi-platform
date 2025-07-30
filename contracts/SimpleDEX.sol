// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleDEX is Ownable, ReentrancyGuard {
    IERC20 public token;
    uint256 public constant FEE_PERCENT = 25; // 0.25% fee
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    
    mapping(address => uint256) public liquidityShares;
    uint256 public totalLiquidityShares;
    uint256 public feeReserveEth;
    uint256 public feeReserveToken;

    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 sharesIssued);
    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokenAmount, uint256 sharesBurned);
    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee);

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
    }

    function addLiquidity(uint256 tokenAmount) public payable nonReentrant {
        require(msg.value > 0 && tokenAmount > 0, "Amounts must be greater than 0");

        uint256 ethReserve = address(this).balance - msg.value;
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 sharesToMint;

        if (totalLiquidityShares == 0) {
            sharesToMint = 100 * (10**18); // Initial shares
            require(msg.value >= MINIMUM_LIQUIDITY, "Initial ETH liquidity is too low");
        } else {
            sharesToMint = ((msg.value * totalLiquidityShares) / ethReserve);
            require(sharesToMint > 0, "Insufficient liquidity minted");
        }

        token.transferFrom(msg.sender, address(this), tokenAmount);
        liquidityShares[msg.sender] += sharesToMint;
        totalLiquidityShares += sharesToMint;

        emit LiquidityAdded(msg.sender, msg.value, tokenAmount, sharesToMint);
    }

    function removeLiquidity() public nonReentrant {
        uint256 userShares = liquidityShares[msg.sender];
        require(userShares > 0, "No liquidity to remove");

        uint256 ethAmount = (address(this).balance * userShares) / totalLiquidityShares;
        uint256 tokenAmount = (token.balanceOf(address(this)) * userShares) / totalLiquidityShares;
        
        liquidityShares[msg.sender] = 0;
        totalLiquidityShares -= userShares;

        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        token.transfer(msg.sender, tokenAmount);

        emit LiquidityRemoved(msg.sender, ethAmount, tokenAmount, userShares);
    }

    function swapEthToToken(uint256 minTokensOut) public payable nonReentrant {
        require(msg.value > 0, "Must send ETH to swap");
        
        uint256 ethReserve = address(this).balance - msg.value;
        uint256 tokenReserve = token.balanceOf(address(this));
        
        uint256 amountInWithFee = msg.value * (10000 - FEE_PERCENT) / 10000;
        uint256 fee = msg.value - amountInWithFee;
        
        uint256 tokenOutput = (amountInWithFee * tokenReserve) / (ethReserve + amountInWithFee);
        require(tokenOutput >= minTokensOut, "Slippage tolerance exceeded");
        require(token.balanceOf(address(this)) >= tokenOutput, "Insufficient token liquidity");
        
        feeReserveEth += fee;
        token.transfer(msg.sender, tokenOutput);
        emit Swapped(msg.sender, address(0), address(token), msg.value, tokenOutput, fee);
    }

    function swapTokenToEth(uint256 tokenInput, uint256 minEthOut) public nonReentrant {
        require(tokenInput > 0, "Must send tokens to swap");
        
        uint256 tokenReserve = token.balanceOf(address(this));
        uint256 ethReserve = address(this).balance;
        
        uint256 amountInWithFee = tokenInput * (10000 - FEE_PERCENT) / 10000;
        uint256 fee = tokenInput - amountInWithFee;

        uint256 ethOutput = (amountInWithFee * ethReserve) / (tokenReserve + amountInWithFee);
        require(ethOutput >= minEthOut, "Slippage tolerance exceeded");
        require(address(this).balance >= ethOutput, "Insufficient ETH liquidity");
        
        feeReserveToken += fee;
        token.transferFrom(msg.sender, address(this), tokenInput);
        (bool success, ) = msg.sender.call{value: ethOutput}("");
        require(success, "ETH transfer failed");

        emit Swapped(msg.sender, address(token), address(0), tokenInput, ethOutput, fee);
    }

    function withdrawFees() public onlyOwner {
        require(feeReserveEth > 0 || feeReserveToken > 0, "No fees to withdraw");
        
        if (feeReserveEth > 0) {
            (bool success, ) = owner().call{value: feeReserveEth}("");
            require(success, "ETH fee transfer failed");
            feeReserveEth = 0;
        }
        
        if (feeReserveToken > 0) {
            token.transfer(owner(), feeReserveToken);
            feeReserveToken = 0;
        }
    }

    // Read-only functions
    function getReserves() public view returns (uint256, uint256) {
        return (address(this).balance, token.balanceOf(address(this)));
    }

    function getUserLiquidity(address user) public view returns (uint256) {
        return liquidityShares[user];
    }
}


