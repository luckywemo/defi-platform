const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying governance contracts with the account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Deploy Governance Token
  console.log("\n1. Deploying Governance Token...");
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy();
  await governanceToken.waitForDeployment();
  
  const tokenAddress = await governanceToken.getAddress();
  console.log("GovernanceToken deployed to:", tokenAddress);

  // Deploy Treasury
  console.log("\n2. Deploying Treasury...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy();
  await treasury.waitForDeployment();
  
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury deployed to:", treasuryAddress);

  // Deploy TimelockController
  console.log("\n3. Deploying TimelockController...");
  const minDelay = 60 * 60 * 24; // 1 day
  const proposers = []; // Will be set to governance contract
  const executors = []; // Will be set to governance contract
  const admin = deployer.address; // Temporary admin
  
  const TimelockController = await ethers.getContractFactory("TimelockController");
  const timelock = await TimelockController.deploy(minDelay, proposers, executors, admin);
  await timelock.waitForDeployment();
  
  const timelockAddress = await timelock.getAddress();
  console.log("TimelockController deployed to:", timelockAddress);

  // Deploy Governance Contract
  console.log("\n4. Deploying DeFi Governance...");
  const DeFiGovernance = await ethers.getContractFactory("DeFiGovernance");
  const governance = await DeFiGovernance.deploy(tokenAddress, timelockAddress);
  await governance.waitForDeployment();
  
  const governanceAddress = await governance.getAddress();
  console.log("DeFiGovernance deployed to:", governanceAddress);

  // Configure permissions
  console.log("\n5. Configuring permissions...");
  
  // Grant roles to governance contract
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();

  // Grant proposer and executor roles to governance contract
  await timelock.grantRole(PROPOSER_ROLE, governanceAddress);
  await timelock.grantRole(EXECUTOR_ROLE, governanceAddress);
  
  // Grant executor role to zero address (anyone can execute)
  await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);
  
  console.log("Granted PROPOSER_ROLE to governance contract");
  console.log("Granted EXECUTOR_ROLE to governance contract and public");

  // Transfer treasury ownership to timelock
  await treasury.transferOwnership(timelockAddress);
  console.log("Transferred Treasury ownership to TimelockController");

  // Renounce admin role from deployer (optional - for full decentralization)
  // await timelock.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address);
  // console.log("Revoked admin role from deployer");

  // Distribute some governance tokens for testing
  console.log("\n6. Distributing initial governance tokens...");
  const distributionAmount = ethers.parseUnits("1000", 18); // 1000 tokens each
  
  // You can add more addresses here for testing
  const testAddresses = [deployer.address];
  
  for (const address of testAddresses) {
    await governanceToken.transfer(address, distributionAmount);
    console.log(`Transferred ${ethers.formatUnits(distributionAmount, 18)} DGT to ${address}`);
  }

  // Delegate voting power to self (required for voting)
  await governanceToken.delegate(deployer.address);
  console.log("Delegated voting power to deployer");

  console.log("\n=== Deployment Summary ===");
  console.log("GovernanceToken:", tokenAddress);
  console.log("Treasury:", treasuryAddress);
  console.log("TimelockController:", timelockAddress);
  console.log("DeFiGovernance:", governanceAddress);
  
  console.log("\n=== Next Steps ===");
  console.log("1. Delegate voting power: governanceToken.delegate(yourAddress)");
  console.log("2. Create proposals using the governance contract");
  console.log("3. Vote on proposals");
  console.log("4. Execute successful proposals after timelock delay");

  // Save deployment addresses to a file
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      GovernanceToken: tokenAddress,
      Treasury: treasuryAddress,
      TimelockController: timelockAddress,
      DeFiGovernance: governanceAddress
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    'governance-deployment.json', 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to governance-deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
