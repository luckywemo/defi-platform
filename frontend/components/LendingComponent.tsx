import React, { useState } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import styles from '../styles/Components.module.css';

// Contract ABIs (simplified)
const LENDING_POOL_ABI = [
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "supply",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "borrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "repay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "user", "type": "address" }],
    "name": "getUserAccountData",
    "outputs": [
      { "name": "totalCollateralETH", "type": "uint256" },
      { "name": "totalBorrowETH", "type": "uint256" },
      { "name": "availableBorrowETH", "type": "uint256" },
      { "name": "liquidationThreshold", "type": "uint256" },
      { "name": "healthFactor", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

const TOKEN_ABI = [
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Contract addresses (you'll need to update these after deployment)
const LENDING_POOL_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address
const PLATFORM_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address

const LendingComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [supplyAmount, setSupplyAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Contract interactions
  const { writeContract: supplyTokens, data: supplyHash } = useWriteContract();
  const { writeContract: withdrawTokens, data: withdrawHash } = useWriteContract();
  const { writeContract: borrowTokens, data: borrowHash } = useWriteContract();
  const { writeContract: repayTokens, data: repayHash } = useWriteContract();
  const { writeContract: approveTokens, data: approveHash } = useWriteContract();

  // Wait for transactions
  const { isLoading: isSupplyLoading } = useWaitForTransactionReceipt({ hash: supplyHash });
  const { isLoading: isWithdrawLoading } = useWaitForTransactionReceipt({ hash: withdrawHash });
  const { isLoading: isBorrowLoading } = useWaitForTransactionReceipt({ hash: borrowHash });
  const { isLoading: isRepayLoading } = useWaitForTransactionReceipt({ hash: repayHash });
  const { isLoading: isApproveLoading } = useWaitForTransactionReceipt({ hash: approveHash });

  // Read contract data
  const { data: userAccountData } = useReadContract({
    address: LENDING_POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: 'getUserAccountData',
    args: address ? [address] : undefined,
  });

  const { data: tokenBalance } = useReadContract({
    address: PLATFORM_TOKEN_ADDRESS,
    abi: TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const handleApprove = async () => {
    if (!supplyAmount) return;

    setIsLoading(true);
    try {
      await approveTokens({
        address: PLATFORM_TOKEN_ADDRESS,
        abi: TOKEN_ABI,
        functionName: 'approve',
        args: [LENDING_POOL_ADDRESS, parseEther(supplyAmount)],
      });
    } catch (error) {
      console.error('Approval failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupply = async () => {
    if (!supplyAmount) return;

    setIsLoading(true);
    try {
      await supplyTokens({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'supply',
        args: [PLATFORM_TOKEN_ADDRESS, parseEther(supplyAmount)],
      });
      setSupplyAmount('');
    } catch (error) {
      console.error('Supply failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;

    setIsLoading(true);
    try {
      await withdrawTokens({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'withdraw',
        args: [PLATFORM_TOKEN_ADDRESS, parseEther(withdrawAmount)],
      });
      setWithdrawAmount('');
    } catch (error) {
      console.error('Withdrawal failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount) return;

    setIsLoading(true);
    try {
      await borrowTokens({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'borrow',
        args: [PLATFORM_TOKEN_ADDRESS, parseEther(borrowAmount)],
      });
      setBorrowAmount('');
    } catch (error) {
      console.error('Borrow failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRepay = async () => {
    if (!repayAmount) return;

    setIsLoading(true);
    try {
      await repayTokens({
        address: LENDING_POOL_ADDRESS,
        abi: LENDING_POOL_ABI,
        functionName: 'repay',
        args: [PLATFORM_TOKEN_ADDRESS, parseEther(repayAmount)],
      });
      setRepayAmount('');
    } catch (error) {
      console.error('Repayment failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className={styles.container}>
        <h2>Lending</h2>
        <p>Please connect your wallet to access lending services.</p>
      </div>
    );
  }

  const totalCollateralETH = userAccountData ? formatEther(userAccountData[0]) : '0';
  const totalBorrowETH = userAccountData ? formatEther(userAccountData[1]) : '0';
  const availableBorrowETH = userAccountData ? formatEther(userAccountData[2]) : '0';
  const healthFactor = userAccountData ? formatEther(userAccountData[4]) : '0';
  const userTokenBalance = tokenBalance ? formatEther(tokenBalance) : '0';

  return (
    <div className={styles.container}>
      <h2>🏦 Lending</h2>
      
      {/* Account Data */}
      <div className={styles.statsContainer}>
        <div className={styles.stat}>
          <h3>Total Collateral</h3>
          <p>{parseFloat(totalCollateralETH).toFixed(4)} ETH</p>
        </div>
        <div className={styles.stat}>
          <h3>Total Borrowed</h3>
          <p>{parseFloat(totalBorrowETH).toFixed(4)} ETH</p>
        </div>
        <div className={styles.stat}>
          <h3>Available to Borrow</h3>
          <p>{parseFloat(availableBorrowETH).toFixed(4)} ETH</p>
        </div>
        <div className={styles.stat}>
          <h3>Health Factor</h3>
          <p>{parseFloat(healthFactor).toFixed(4)}</p>
        </div>
      </div>

      {/* Supply Section */}
      <div className={styles.section}>
        <h3>Supply Tokens</h3>
        <p>Available Balance: {parseFloat(userTokenBalance).toFixed(4)} PLT</p>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to supply"
            value={supplyAmount}
            onChange={(e) => setSupplyAmount(e.target.value)}
            className={styles.input}
          />
          <button
            onClick={() => setSupplyAmount(userTokenBalance)}
            className={styles.maxButton}
          >
            MAX
          </button>
        </div>

        <div className={styles.buttonGroup}>
          <button
            onClick={handleApprove}
            disabled={!supplyAmount || isLoading || isApproveLoading}
            className={styles.button}
          >
            {isApproveLoading ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={handleSupply}
            disabled={!supplyAmount || isLoading || isSupplyLoading}
            className={styles.primaryButton}
          >
            {isSupplyLoading ? 'Supplying...' : 'Supply'}
          </button>
        </div>
      </div>

      {/* Withdraw Section */}
      <div className={styles.section}>
        <h3>Withdraw Tokens</h3>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to withdraw"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className={styles.input}
          />
        </div>

        <button
          onClick={handleWithdraw}
          disabled={!withdrawAmount || isLoading || isWithdrawLoading}
          className={styles.button}
        >
          {isWithdrawLoading ? 'Withdrawing...' : 'Withdraw'}
        </button>
      </div>

      {/* Borrow Section */}
      <div className={styles.section}>
        <h3>Borrow Tokens</h3>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to borrow"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            className={styles.input}
          />
        </div>

        <button
          onClick={handleBorrow}
          disabled={!borrowAmount || isLoading || isBorrowLoading}
          className={styles.primaryButton}
        >
          {isBorrowLoading ? 'Borrowing...' : 'Borrow'}
        </button>
      </div>

      {/* Repay Section */}
      <div className={styles.section}>
        <h3>Repay Tokens</h3>
        
        <div className={styles.inputGroup}>
          <input
            type="number"
            placeholder="Amount to repay"
            value={repayAmount}
            onChange={(e) => setRepayAmount(e.target.value)}
            className={styles.input}
          />
        </div>

        <button
          onClick={handleRepay}
          disabled={!repayAmount || isLoading || isRepayLoading}
          className={styles.button}
        >
          {isRepayLoading ? 'Repaying...' : 'Repay'}
        </button>
      </div>

      {/* Info Section */}
      <div className={styles.infoSection}>
        <h4>ℹ️ How Lending Works</h4>
        <ul>
          <li>Supply tokens to earn interest over time</li>
          <li>Borrow tokens against your supplied collateral</li>
          <li>Maintain a healthy collateral factor to avoid liquidation</li>
          <li>Repay borrowed tokens to free up your collateral</li>
        </ul>
      </div>
    </div>
  );
};

export default LendingComponent;

