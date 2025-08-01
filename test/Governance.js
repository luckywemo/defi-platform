const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Governance System", function () {
  let governanceToken, treasury, timelock, governance;
  let owner, voter1, voter2, voter3;
  
  const VOTING_DELAY = 7200; // 1 day in blocks
  const VOTING_PERIOD = 50400; // 1 week in blocks
  const MIN_DELAY = 60 * 60 * 24; // 1 day in seconds

  beforeEach(async function () {
    [owner, voter1, voter2, voter3] = await ethers.getSigners();

    // Deploy Governance Token
    const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
    governanceToken = await GovernanceToken.deploy();
    await governanceToken.waitForDeployment();

    // Deploy Treasury
    const Treasury = await ethers.getContractFactory("Treasury");
    treasury = await Treasury.deploy();
    await treasury.waitForDeployment();

    // Deploy Timelock
    const TimelockController = await ethers.getContractFactory("TimelockController");
    timelock = await TimelockController.deploy(
      MIN_DELAY,
      [],
      [],
      owner.address
    );
    await timelock.waitForDeployment();

    // Deploy Governance
    const DeFiGovernance = await ethers.getContractFactory("DeFiGovernance");
    governance = await DeFiGovernance.deploy(
      await governanceToken.getAddress(),
      await timelock.getAddress()
    );
    await governance.waitForDeployment();

    // Setup roles
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

    await timelock.grantRole(PROPOSER_ROLE, await governance.getAddress());
    await timelock.grantRole(EXECUTOR_ROLE, await governance.getAddress());
    await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress);

    // Transfer treasury ownership to timelock
    await treasury.transferOwnership(await timelock.getAddress());

    // Distribute tokens and delegate voting power
    const tokenAmount = ethers.parseUnits("1000", 18);
    await governanceToken.transfer(voter1.address, tokenAmount);
    await governanceToken.transfer(voter2.address, tokenAmount);
    await governanceToken.transfer(voter3.address, tokenAmount);

    // Delegate voting power
    await governanceToken.delegate(owner.address);
    await governanceToken.connect(voter1).delegate(voter1.address);
    await governanceToken.connect(voter2).delegate(voter2.address);
    await governanceToken.connect(voter3).delegate(voter3.address);
  });

  describe("Governance Token", function () {
    it("Should have correct initial supply", async function () {
      const expectedSupply = ethers.parseUnits("10000000", 18); // 10 million
      expect(await governanceToken.totalSupply()).to.equal(expectedSupply);
    });

    it("Should allow delegation of voting power", async function () {
      const votes = await governanceToken.getVotes(voter1.address);
      expect(votes).to.equal(ethers.parseUnits("1000", 18));
    });

    it("Should mint tokens when authorized", async function () {
      await governanceToken.addMinter(owner.address);
      const mintAmount = ethers.parseUnits("1000", 18);
      
      await governanceToken.mint(voter1.address, mintAmount);
      
      const balance = await governanceToken.balanceOf(voter1.address);
      expect(balance).to.equal(ethers.parseUnits("2000", 18));
    });

    it("Should not mint beyond max supply", async function () {
      await governanceToken.addMinter(owner.address);
      const maxSupply = await governanceToken.MAX_SUPPLY();
      const currentSupply = await governanceToken.totalSupply();
      const excessAmount = maxSupply - currentSupply + ethers.parseUnits("1", 18);
      
      await expect(
        governanceToken.mint(voter1.address, excessAmount)
      ).to.be.revertedWith("Exceeds maximum supply");
    });
  });

  describe("Treasury", function () {
    it("Should accept ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await expect(
        treasury.depositFunds(ethers.ZeroAddress, depositAmount, { value: depositAmount })
      ).to.emit(treasury, "FundsDeposited")
       .withArgs(ethers.ZeroAddress, depositAmount, owner.address);
      
      expect(await treasury.getBalance(ethers.ZeroAddress)).to.equal(depositAmount);
    });

    it("Should accept ERC20 token deposits", async function () {
      const depositAmount = ethers.parseUnits("100", 18);
      
      await governanceToken.approve(await treasury.getAddress(), depositAmount);
      await treasury.depositFunds(await governanceToken.getAddress(), depositAmount);
      
      expect(await treasury.getBalance(await governanceToken.getAddress())).to.equal(depositAmount);
    });

    it("Should only allow governance to withdraw funds", async function () {
      const depositAmount = ethers.parseEther("1");
      await treasury.depositFunds(ethers.ZeroAddress, depositAmount, { value: depositAmount });
      
      await expect(
        treasury.connect(voter1).withdrawFunds(ethers.ZeroAddress, depositAmount, voter1.address)
      ).to.be.revertedWith("Only governance can call this function");
    });
  });

  describe("Governance Proposals", function () {
    let proposalId;

    beforeEach(async function () {
      // Add some funds to treasury for testing
      const depositAmount = ethers.parseEther("10");
      await treasury.depositFunds(ethers.ZeroAddress, depositAmount, { value: depositAmount });
    });

    it("Should create a proposal", async function () {
      const targets = [await treasury.getAddress()];
      const values = [0];
      const calldatas = [
        treasury.interface.encodeFunctionData("updateDexFee", [30]) // Change fee to 0.30%
      ];
      const description = "Update DEX fee to 0.30%";

      proposalId = await governance.propose(targets, values, calldatas, description);
      
      expect(await governance.state(proposalId)).to.equal(0); // Pending
    });

    it("Should allow voting on proposals", async function () {
      const targets = [await treasury.getAddress()];
      const values = [0];
      const calldatas = [
        treasury.interface.encodeFunctionData("updateDexFee", [30])
      ];
      const description = "Update DEX fee to 0.30%";

      proposalId = await governance.propose(targets, values, calldatas, description);
      
      // Move past voting delay
      await time.increase(VOTING_DELAY * 12 + 1); // Assuming 12 second blocks
      
      // Vote
      await governance.connect(voter1).castVote(proposalId, 1); // For
      await governance.connect(voter2).castVote(proposalId, 1); // For
      await governance.connect(voter3).castVote(proposalId, 0); // Against
      
      const proposalVotes = await governance.proposalVotes(proposalId);
      expect(proposalVotes.forVotes).to.equal(ethers.parseUnits("2000", 18));
      expect(proposalVotes.againstVotes).to.equal(ethers.parseUnits("1000", 18));
    });

    it("Should queue successful proposals", async function () {
      const targets = [await treasury.getAddress()];
      const values = [0];
      const calldatas = [
        treasury.interface.encodeFunctionData("updateDexFee", [30])
      ];
      const description = "Update DEX fee to 0.30%";

      proposalId = await governance.propose(targets, values, calldatas, description);
      
      // Move past voting delay
      await time.increase(VOTING_DELAY * 12 + 1);
      
      // Vote in favor
      await governance.connect(voter1).castVote(proposalId, 1);
      await governance.connect(voter2).castVote(proposalId, 1);
      
      // Move past voting period
      await time.increase(VOTING_PERIOD * 12 + 1);
      
      // Queue proposal
      await governance.queue(targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description)));
      
      expect(await governance.state(proposalId)).to.equal(5); // Queued
    });

    it("Should execute successful proposals after timelock", async function () {
      const targets = [await treasury.getAddress()];
      const values = [0];
      const calldatas = [
        treasury.interface.encodeFunctionData("updateDexFee", [30])
      ];
      const description = "Update DEX fee to 0.30%";

      proposalId = await governance.propose(targets, values, calldatas, description);
      
      // Move past voting delay
      await time.increase(VOTING_DELAY * 12 + 1);
      
      // Vote in favor
      await governance.connect(voter1).castVote(proposalId, 1);
      await governance.connect(voter2).castVote(proposalId, 1);
      
      // Move past voting period
      await time.increase(VOTING_PERIOD * 12 + 1);
      
      // Queue proposal
      await governance.queue(targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description)));
      
      // Move past timelock delay
      await time.increase(MIN_DELAY + 1);
      
      // Execute proposal
      await governance.execute(targets, values, calldatas, ethers.keccak256(ethers.toUtf8Bytes(description)));
      
      // Check that the fee was updated
      expect(await treasury.dexFeePercent()).to.equal(30);
      expect(await governance.state(proposalId)).to.equal(7); // Executed
    });

    it("Should reject proposals that don't meet quorum", async function () {
      const targets = [await treasury.getAddress()];
      const values = [0];
      const calldatas = [
        treasury.interface.encodeFunctionData("updateDexFee", [30])
      ];
      const description = "Update DEX fee to 0.30%";

      proposalId = await governance.propose(targets, values, calldatas, description);
      
      // Move past voting delay
      await time.increase(VOTING_DELAY * 12 + 1);
      
      // Only one small vote (not enough for quorum)
      await governance.connect(voter3).castVote(proposalId, 1);
      
      // Move past voting period
      await time.increase(VOTING_PERIOD * 12 + 1);
      
      expect(await governance.state(proposalId)).to.equal(3); // Defeated
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdrawal by owner", async function () {
      const depositAmount = ethers.parseEther("5");
      await treasury.depositFunds(ethers.ZeroAddress, depositAmount, { value: depositAmount });
      
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      await treasury.emergencyWithdraw(ethers.ZeroAddress, owner.address);
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.be.greaterThan(initialBalance);
      expect(await treasury.getBalance(ethers.ZeroAddress)).to.equal(0);
    });

    it("Should not allow emergency withdrawal by non-owner", async function () {
      const depositAmount = ethers.parseEther("5");
      await treasury.depositFunds(ethers.ZeroAddress, depositAmount, { value: depositAmount });
      
      await expect(
        treasury.connect(voter1).emergencyWithdraw(ethers.ZeroAddress, voter1.address)
      ).to.be.revertedWithCustomError(treasury, "OwnableUnauthorizedAccount");
    });
  });
});
