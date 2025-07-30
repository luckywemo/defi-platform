// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleDEX is Ownable {
    IERC20 public token;

    event LiquidityAdded(address indexed provider, uint256 ethAmount, uint256 tokenAmount);
    event LiquidityRemoved(address indexed provider, uint256 ethAmount, uint256 tokenAmount);
    event Swapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address tokenAddress) Ownable(msg.sender) {
        token = IERC20(tokenAddress);
    }

    function addLiquidity(uint256 tokenAmount) public payable {
        require(msg.value > 0 && tokenAmount > 0, "Amounts must be greater than 0");
        token.transferFrom(msg.sender, address(this), tokenAmount);
        emit LiquidityAdded(msg.sender, msg.value, tokenAmount);
    }

    function removeLiquidity() public {
        uint256 ethAmount = address(this).balance;
        uint256 tokenAmount = token.balanceOf(address(this));
        require(ethAmount > 0 && tokenAmount > 0, "No liquidity to remove");

        (bool success, ) = msg.sender.call{value: ethAmount}("");
        require(success, "ETH transfer failed");
        token.transfer(msg.sender, tokenAmount);
        
        emit LiquidityRemoved(msg.sender, ethAmount, tokenAmount);
    }

    function swapEthToToken() public payable {
        require(msg.value > 0, "Must send ETH to swap");
        uint256 tokenOutput = getSwapEstimate(msg.value);
        require(token.balanceOf(address(this)) >= tokenOutput, "Insufficient token liquidity");
        
        token.transfer(msg.sender, tokenOutput);
        emit Swapped(msg.sender, address(0), address(token), msg.value, tokenOutput);
    }

    function swapTokenToEth(uint256 tokenInput) public {
        require(tokenInput > 0, "Must send tokens to swap");
        uint256 ethOutput = getEthEstimate(tokenInput);
        require(address(this).balance >= ethOutput, "Insufficient ETH liquidity");
        
        token.transferFrom(msg.sender, address(this), tokenInput);
        (bool success, ) = msg.sender.call{value: ethOutput}("");
        require(success, "ETH transfer failed");

        emit Swapped(msg.sender, address(token), address(0), tokenInput, ethOutput);
    }

    function getSwapEstimate(uint256 ethInput) public view returns (uint256) {
        uint256 ethReserve = address(this).balance - ethInput;
        uint256 tokenReserve = token.balanceOf(address(this));
        return (ethInput * tokenReserve) / ethReserve;
    }

    function getEthEstimate(uint256 tokenInput) public view returns (uint256) {
        uint256 tokenReserve = token.balanceOf(address(this)) - tokenInput;
        uint256 ethReserve = address(this).balance;
        return (tokenInput * ethReserve) / tokenReserve;
    }
}

