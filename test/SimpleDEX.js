const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleDEX", function () {
  let PlatformToken, platformToken, SimpleDEX, simpleDEX;
  let owner, addr1, addr2;

  beforeEach(async function () {
    // Get the signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy PlatformToken
    PlatformToken = await ethers.getContractFactory("PlatformToken");
    platformToken = await PlatformToken.deploy("Platform Token", "PLT", ethers.parseUnits("1000000", 18));
    await platformToken.waitForDeployment();

    // Deploy SimpleDEX
    SimpleDEX = await ethers.getContractFactory("SimpleDEX");
    simpleDEX = await SimpleDEX.deploy(await platformToken.getAddress());
    await simpleDEX.waitForDeployment();

    // Transfer some tokens to addr1 for testing
    await platformToken.transfer(addr1.address, ethers.parseUnits("10000", 18));
  });

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      expect(await simpleDEX.token()).to.equal(await platformToken.getAddress());
    });

    it("Should set the right owner", async function () {
      expect(await simpleDEX.owner()).to.equal(owner.address);
    });
  });

  describe("Liquidity Management", function () {
    it("Should add liquidity correctly", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");

      // Approve the DEX to spend tokens
      await platformToken.approve(await simpleDEX.getAddress(), tokenAmount);

      // Add liquidity
      await expect(simpleDEX.addLiquidity(tokenAmount, { value: ethAmount }))
        .to.emit(simpleDEX, "LiquidityAdded");

      // Check balances
      expect(await ethers.provider.getBalance(await simpleDEX.getAddress())).to.equal(ethAmount);
      expect(await platformToken.balanceOf(await simpleDEX.getAddress())).to.equal(tokenAmount);
    });

    it("Should fail to add liquidity with zero amounts", async function () {
      await expect(simpleDEX.addLiquidity(0, { value: 0 }))
        .to.be.revertedWith("Amounts must be greater than 0");
    });

    it("Should remove liquidity correctly", async function () {
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");

      // Add liquidity first
      await platformToken.approve(await simpleDEX.getAddress(), tokenAmount);
      await simpleDEX.addLiquidity(tokenAmount, { value: ethAmount });

      // Remove liquidity
      await expect(simpleDEX.removeLiquidity())
        .to.emit(simpleDEX, "LiquidityRemoved");

      // Check balances
      expect(await ethers.provider.getBalance(await simpleDEX.getAddress())).to.equal(0);
      expect(await platformToken.balanceOf(await simpleDEX.getAddress())).to.equal(0);
    });
  });

  describe("Token Swapping", function () {
    beforeEach(async function () {
      // Add initial liquidity
      const tokenAmount = ethers.parseUnits("1000", 18);
      const ethAmount = ethers.parseEther("1");

      await platformToken.approve(await simpleDEX.getAddress(), tokenAmount);
      await simpleDEX.addLiquidity(tokenAmount, { value: ethAmount });
    });

    it("Should swap ETH to tokens correctly", async function () {
      const ethInput = ethers.parseEther("0.1");
      const expectedTokens = await simpleDEX.getSwapEstimate(ethInput);
      const minTokensOut = expectedTokens * BigInt(95) / BigInt(100); // 5% slippage

      await expect(simpleDEX.connect(addr1).swapEthToToken(minTokensOut, { value: ethInput }))
        .to.emit(simpleDEX, "Swapped");

      expect(await platformToken.balanceOf(addr1.address)).to.be.greaterThan(ethers.parseUnits("10000", 18));
    });

    it("Should swap tokens to ETH correctly", async function () {
      const tokenInput = ethers.parseUnits("100", 18);
      const expectedEth = await simpleDEX.getTokenToEthEstimate(tokenInput);
      const minEthOut = expectedEth * BigInt(95) / BigInt(100); // 5% slippage
      
      // Approve tokens
      await platformToken.connect(addr1).approve(await simpleDEX.getAddress(), tokenInput);

      const initialEthBalance = await ethers.provider.getBalance(addr1.address);
      
      await expect(simpleDEX.connect(addr1).swapTokenToEth(tokenInput, minEthOut))
        .to.emit(simpleDEX, "Swapped");

      const finalEthBalance = await ethers.provider.getBalance(addr1.address);
      expect(finalEthBalance).to.be.greaterThan(initialEthBalance - ethers.parseEther("0.01")); // Account for gas
    });

    it("Should calculate swap estimates correctly", async function () {
      const ethInput = ethers.parseEther("0.1");
      const estimate = await simpleDEX.getSwapEstimate(ethInput);
      
      expect(estimate).to.be.greaterThan(0);
    });

    it("Should fail to swap with insufficient liquidity", async function () {
      const largeEthInput = ethers.parseEther("100");
      const minTokensOut = await simpleDEX.getSwapEstimate(largeEthInput);
      
      await expect(simpleDEX.connect(addr1).swapEthToToken(minTokensOut, { value: largeEthInput }))
        .to.be.revertedWith("Insufficient token liquidity");
    });
  });
});
