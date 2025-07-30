const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const tokenName = "Platform Token";
  const tokenSymbol = "PLT";
  const initialSupply = ethers.parseUnits("1000000", 18); // 1 million tokens

  const PlatformToken = await ethers.getContractFactory("PlatformToken");
  const platformToken = await PlatformToken.deploy(tokenName, tokenSymbol, initialSupply);

  await platformToken.waitForDeployment();

  console.log("PlatformToken deployed to:", await platformToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
