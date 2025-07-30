import { useState } from 'react';
import { parseEther, formatEther } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import styles from '../styles/Component.module.css';

const LiquidityComponent = () => {
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  
  const { address } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleAddLiquidity = async () => {
    if (!ethAmount || !tokenAmount || !address) return;

    try {
      writeContract({
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // DEX address
        abi: [{
          name: 'addLiquidity',
          type: 'function',
          stateMutability: 'payable',
          inputs: [{ name: 'tokenAmount', type: 'uint256' }],
          outputs: []
        }],
        functionName: 'addLiquidity',
        args: [parseEther(tokenAmount)],
        value: parseEther(ethAmount)
      });
    } catch (error) {
      console.error('Add liquidity failed:', error);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!address) return;

    try {
      writeContract({
        address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // DEX address
        abi: [{
          name: 'removeLiquidity',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [],
          outputs: []
        }],
        functionName: 'removeLiquidity',
      });
    } catch (error) {
      console.error('Remove liquidity failed:', error);
    }
  };

  return (
    <div className={styles.component}>
      <h2>Manage Liquidity</h2>
      
      <div className={styles.inputGroup}>
        <label>ETH Amount</label>
        <input
          type="number"
          placeholder="0.0"
          value={ethAmount}
          onChange={(e) => setEthAmount(e.target.value)}
        />
      </div>
      
      <div className={styles.inputGroup}>
        <label>PLT Amount</label>
        <input
          type="number"
          placeholder="0.0"
          value={tokenAmount}
          onChange={(e) => setTokenAmount(e.target.value)}
        />
      </div>
      
      <div className={styles.buttonGroup}>
        <button 
          className={styles.actionButton}
          onClick={handleAddLiquidity}
          disabled={!ethAmount || !tokenAmount || isPending || isConfirming}
        >
          {isPending || isConfirming ? 'Adding...' : 'Add Liquidity'}
        </button>
        <button 
          className={`${styles.actionButton} ${styles.secondary}`}
          onClick={handleRemoveLiquidity}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? 'Removing...' : 'Remove All Liquidity'}
        </button>
      </div>

      {isConfirmed && (
        <div className={styles.successMessage}>
          Liquidity action completed successfully!
        </div>
      )}
    </div>
  );
};

export default LiquidityComponent;
