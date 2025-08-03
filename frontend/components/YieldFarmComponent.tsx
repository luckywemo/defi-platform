import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import styles from '../styles/Components.module.css';

// Contract ABIs (simplified for this example)
const YIELD_FARM_ABI = [
  {
    "inputs": [{"name": "amount", "type": "uint256"}],
    "name": "stake",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "amount", "type": "uint256"}],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "exit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "getStakeInfo",
    "outputs": [
      {"name": "stakedAmount", "type": "uint256"},
      {"name": "earnedRewards", "type": "uint256"},
      {"name": "rewardRate_", "type": "uint256"},
      {"name": "totalStaked_", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "earned",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balances",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const TOKEN_ABI = [
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Contract addresses (you'll need to update these after deployment)
const YIELD_FARM_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address
const PLATFORM_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address

const YieldFarmComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Contract interactions
  const { writeContract: stakeTokens, data: stakeHash } = useWriteContract();
  const { writeContract: withdrawTokens, data: withdrawHash } = useWriteContract();
  const { writeContract: claimRewards, data: claimHash } = useWriteContract();
  const { writeContract: approveTokens, data: approveHash } = useWriteContract();
  const { writeContract: exitFarm, data: exitHash } = useWriteContract();

  // Wait for transactions
  const { isLoading: isStakeLoading } = useWaitForTransactionReceipt({ hash: stakeHash });
  const { isLoading: isWithdrawLoading } = useWaitForTransactionReceipt({ hash: withdrawHash });
  const { isLoading: isClaimLoading } = useWaitForTransactionReceipt({ hash: claimHash });
  const { isLoading: isApproveLoading } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isExitLoading } = useWaitForTransactionReceipt({ hash: exitHash });

  // Read contract data
  const { data: stakeInfo } = useReadContract({
    address: YIELD_FARM_ADDRESS,
    abi: YIELD_FARM_ABI,
    functionName: 'getStakeInfo',
    args: address ? [address] : undefined,
  });

  const { data: tokenBalance } = useReadContract({
    address: PLATFORM_TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: earnedRewards } = useReadContract({
    address: YIELD_FARM_ADDRESS,
    abi: YIELD_FARM_ABI,
    functionName: 'earned',
    args: address ? [address] : undefined,
  });

  const handleApprove = async () => {
    if (!stakeAmount) return;
    
    setIsLoading(true);
    try {
      await approveTokens({
        address: PLATFORM_TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [YIELD_FARM_ADDRESS, parseEther(stakeAmount)],
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount) return;
    
    setIsLoading(true);
    try {
      await stakeTokens({
        address: YIELD_FARM_ADDRESS,
        abi: YIELD_FARM_ABI,
        functionName: 'stake',
        args: [parseEther(stakeAmount)],
      });
      setStakeAmount('');
    } catch (error) {
      console.error('Staking failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    
    setIsLoading(true);
    try {
      await withdrawTokens({
        address: YIELD_FARM_ADDRESS,
        abi: YIELD_FARM_ABI,
        functionName: 'withdraw',
        args: [parseEther(withdrawAmount)],
      });
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdrawal failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimRewards = async () => {
    setIsLoading(true);
    try {
      await claimRewards({
        address: YIELD_FARM_ADDRESS,
        abi: YIELD_FARM_ABI,
        functionName: 'getReward',
      });
    } catch (error) {
      console.error('Claiming rewards failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExit = async () => {
    setIsLoading(true);
    try {
      await exitFarm({
        address: YIELD_FARM_ADDRESS,
        abi: YIELD_FARM_ABI,
        functionName: 'exit',
      });
    } catch (error) {
      console.error('Exit failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <h2>Yield Farming</h2>
        <p>Please connect your wallet to access yield farming.</p>
      </div>
    );
  }

  const stakedAmount = stakeInfo ? formatEther(stakeInfo[0]) : '0';
  const pendingRewards = earnedRewards ? formatEther(earnedRewards) : '0';
  const rewardRate = stakeInfo ? formatEther(stakeInfo[2]) : '0';
  const totalStaked = stakeInfo ? formatEther(stakeInfo[3]) : '0';
  const userTokenBalance = tokenBalance ? formatEther(tokenBalance) : '0';

  return (
    <div className={styles.container}>
      <h2>🚜 Yield Farming</h2>
      
      {/* Farm Stats */}
      <div className={styles.statsContainer}>
        <div className={styles.stat}>
          <h3>Your Staked Amount</h3>
          <p>{parseFloat(stakedAmount).toFixed(4)} PLT</p>
        </div>
        <div className={styles.stat}>
          <h3>Pending Rewards</h3>
          <p>{parseFloat(pendingRewards).toFixed(4)} PLT</p>
        </div>
        <div className={styles.stat}>
          <h3>Reward Rate</h3>
          <p>{parseFloat(rewardRate).toFixed(4)} PLT/sec</p>
        </div>
        <div className={styles.stat}>
          <h3>Total Staked</h3>
          <p>{parseFloat(totalStaked).toFixed(4)} PLT</p>
        </div>
      </div>

      {/* Stake Section */}
      <div className={styles.section}>
        <h3>Stake Tokens</h3>
        <p>Available Balance: {parseFloat(userTokenBalance).toFixed(4)} PLT</p>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to stake"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className={styles.input}
          />
          <button
            onClick={() => setStakeAmount(userTokenBalance)}
            className={styles.maxButton}
          >
            MAX
          </button>
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={handleApprove}
            disabled={!stakeAmount || isLoading || isApproveLoading}
            className={styles.button}
          >
            {isApproveLoading ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={handleStake}
            disabled={!stakeAmount || isLoading || isStakeLoading}
            className={styles.primaryButton}
          >
            {isStakeLoading ? 'Staking...' : 'Stake'}
          </button>
        </div>
      </div>

      {/* Withdraw Section */}
      <div className={styles.section}>
        <h3>Withdraw Tokens</h3>
        <p>Staked Balance: {parseFloat(stakedAmount).toFixed(4)} PLT</p>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to withdraw"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className={styles.input}
          />
          <button
            onClick={() => setWithdrawAmount(stakedAmount)}
            className={styles.maxButton}
          >
            MAX
          </button>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={!withdrawAmount || isLoading || isWithdrawLoading}
          className={styles.button}
        >
          {isWithdrawLoading ? 'Withdrawing...' : 'Withdraw'}
        </button>
      </div>

      {/* Rewards Section */}
      <div className={styles.section}>
        <h3>Claim Rewards</h3>
        <p>Pending Rewards: {parseFloat(pendingRewards).toFixed(4)} PLT</p>
        
        <div className={styles.buttonGroup}>
          <button
            onClick={handleClaimRewards}
            disabled={parseFloat(pendingRewards) === 0 || isLoading || isClaimLoading}
            className={styles.primaryButton}
          >
            {isClaimLoading ? 'Claiming...' : 'Claim Rewards'}
          </button>
          <button
            onClick={handleExit}
            disabled={parseFloat(stakedAmount) === 0 || isLoading || isExitLoading}
            className={styles.dangerButton}
          >
            {isExitLoading ? 'Exiting...' : 'Exit (Withdraw All + Claim)'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className={styles.infoSection}>
        <h4>ℹ️ How Yield Farming Works</h4>
        <ul>
          <li>Stake your PLT tokens to earn rewards over time</li>
          <li>Rewards are calculated based on your share of the total staked amount</li>
          <li>You can withdraw your tokens at any time</li>
          <li>Claim rewards regularly or use "Exit" to withdraw everything at once</li>
        </ul>
      </div>
    </div>
  );
};

export default YieldFarmComponent;
