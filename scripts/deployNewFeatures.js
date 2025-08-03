const hre = require("hardhat");

async function main() {
  console.log("Deploying new DeFi platform features...");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy PriceOracle first
  console.log("\n1. Deploying PriceOracle...");
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  console.log("PriceOracle deployed to:", await priceOracle.getAddress());

  // Deploy existing contracts first (if not already deployed)
  console.log("\n2. Deploying PlatformToken...");
  const PlatformToken = await hre.ethers.getContractFactory("PlatformToken");
  const platformToken = await PlatformToken.deploy();
  await platformToken.waitForDeployment();
  console.log("PlatformToken deployed to:", await platformToken.getAddress());

  console.log("\n3. Deploying SimpleDEX...");
  const SimpleDEX = await hre.ethers.getContractFactory("SimpleDEX");
  const simpleDEX = await SimpleDEX.deploy(await platformToken.getAddress());
  await simpleDEX.waitForDeployment();
  console.log("SimpleDEX deployed to:", await simpleDEX.getAddress());

  // Deploy YieldFarm
  console.log("\n4. Deploying YieldFarm...");
  const YieldFarm = await hre.ethers.getContractFactory("YieldFarm");
  // Using platform token as both staking and reward token for simplicity
  const yieldFarm = await YieldFarm.deploy(
    await platformToken.getAddress(), // staking token (LP token placeholder)
    await platformToken.getAddress()  // reward token
  );
  await yieldFarm.waitForDeployment();
  console.log("YieldFarm deployed to:", await yieldFarm.getAddress());

  // Deploy LendingPool
  console.log("\n5. Deploying LendingPool...");
  const LendingPool = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(await priceOracle.getAddress());
  await lendingPool.waitForDeployment();
  console.log("LendingPool deployed to:", await lendingPool.getAddress());

  // Initial setup
  console.log("\n6. Setting up initial configurations...");

  // Add price feed for platform token (using deployer as authorized feed)
  await priceOracle.addPriceFeed(
    await platformToken.getAddress(),
    deployer.address
  );
  console.log("Added price feed for PlatformToken");

  // Set initial price for platform token (1 ETH = 1000 PLT)
  await priceOracle.emergencySetPrice(
    await platformToken.getAddress(),
    hre.ethers.parseEther("0.001") // 1 PLT = 0.001 ETH
  );
  console.log("Set initial price for PlatformToken");

  // Create lending market for platform token
  await lendingPool.createMarket(
    await platformToken.getAddress(),
    7000, // 70% collateral factor
    8000, // 80% liquidation threshold
    1000, // 10% reserve factor
    hre.ethers.parseEther("0.02"), // 2% base interest rate
    hre.ethers.parseEther("0.3")   // 30% multiplier
  );
  console.log("Created lending market for PlatformToken");

  // Mint some tokens for initial liquidity
  const mintAmount = hre.ethers.parseEther("1000000"); // 1M tokens
  await platformToken.mint(deployer.address, mintAmount);
  console.log("Minted initial tokens for deployer");

  // Transfer some tokens to YieldFarm for rewards
  const rewardAmount = hre.ethers.parseEther("100000"); // 100K tokens for rewards
  await platformToken.transfer(await yieldFarm.getAddress(), rewardAmount);
  console.log("Transferred reward tokens to YieldFarm");

  // Set up reward distribution (100 tokens per day)
  const dailyRewards = hre.ethers.parseEther("100");
  await yieldFarm.notifyRewardAmount(dailyRewards);
  console.log("Set up reward distribution");

  console.log("\n✅ All contracts deployed and configured successfully!");
  console.log("\n📋 Contract Addresses:");
  console.log("PriceOracle:", await priceOracle.getAddress());
  console.log("PlatformToken:", await platformToken.getAddress());
  console.log("SimpleDEX:", await simpleDEX.getAddress());
  console.log("YieldFarm:", await yieldFarm.getAddress());
  console.log("LendingPool:", await lendingPool.getAddress());

  // Save addresses to a file for frontend integration
  const deployedAddresses = {
    PriceOracle: await priceOracle.getAddress(),
    PlatformToken: await platformToken.getAddress(),
    SimpleDEX: await simpleDEX.getAddress(),
    YieldFarm: await yieldFarm.getAddress(),
    LendingPool: await lendingPool.getAddress(),
    deployer: deployer.address,
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    './deployedAddresses.json',
    JSON.stringify(deployedAddresses, null, 2)
  );
  console.log("\n📁 Contract addresses saved to deployedAddresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
