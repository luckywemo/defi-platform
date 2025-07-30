const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  // First deploy the PlatformToken
  const tokenName = "Platform Token";
  const tokenSymbol = "PLT";
  const initialSupply = ethers.parseUnits("1000000", 18); // 1 million tokens

  const PlatformToken = await ethers.getContractFactory("PlatformToken");
  const platformToken = await PlatformToken.deploy(tokenName, tokenSymbol, initialSupply);
  await platformToken.waitForDeployment();

  const tokenAddress = await platformToken.getAddress();
  console.log("PlatformToken deployed to:", tokenAddress);

  // Then deploy the SimpleDEX
  const SimpleDEX = await ethers.getContractFactory("SimpleDEX");
  const simpleDEX = await SimpleDEX.deploy(tokenAddress);
  await simpleDEX.waitForDeployment();

  const dexAddress = await simpleDEX.getAddress();
  console.log("SimpleDEX deployed to:", dexAddress);

  // Approve the DEX to spend tokens from the deployer's account
  const approveAmount = ethers.parseUnits("100000", 18); // 100k tokens
  await platformToken.approve(dexAddress, approveAmount);
  console.log("Approved DEX to spend", ethers.formatUnits(approveAmount, 18), "tokens");

  // Add initial liquidity to the DEX
  const ethAmount = ethers.parseEther("1"); // 1 ETH
  const tokenAmount = ethers.parseUnits("1000", 18); // 1000 tokens
  
  await simpleDEX.addLiquidity(tokenAmount, { value: ethAmount });
  console.log("Added initial liquidity:", ethers.formatEther(ethAmount), "ETH and", ethers.formatUnits(tokenAmount, 18), "tokens");

  console.log("\nDeployment Summary:");
  console.log("==================");
  console.log("PlatformToken:", tokenAddress);
  console.log("SimpleDEX:", dexAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
