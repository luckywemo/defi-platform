import { useState } from 'react';
import { parseEther, formatEther } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import styles from '../styles/Component.module.css';

const SwapComponent = () => {
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [isEthToToken, setIsEthToToken] = useState(true);
  const [slippage, setSlippage] = useState('1'); // 1% default slippage
  
  const { address } = useAccount();
  const { data: hash, writeContract, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleSwap = async () => {
    if (!inputAmount || !address) return;

    try {
      const minOutputAmount = calculateMinOutput(outputAmount, slippage);
      
      if (isEthToToken) {
        // Swap ETH to Token
        writeContract({
          address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // DEX address
          abi: [{
            name: 'swapEthToToken',
            type: 'function',
            stateMutability: 'payable',
            inputs: [{ name: 'minTokensOut', type: 'uint256' }],
            outputs: []
          }],
          functionName: 'swapEthToToken',
          args: [parseEther(minOutputAmount)],
          value: parseEther(inputAmount)
        });
      } else {
        // Swap Token to ETH
        writeContract({
          address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // DEX address
          abi: [{
            name: 'swapTokenToEth',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'tokenInput', type: 'uint256' },
              { name: 'minEthOut', type: 'uint256' }
            ],
            outputs: []
          }],
          functionName: 'swapTokenToEth',
          args: [parseEther(inputAmount), parseEther(minOutputAmount)]
        });
      }
    } catch (error) {
      console.error('Swap failed:', error);
    }
  };

  const calculateMinOutput = (outputAmt: string, slippagePercent: string): string => {
    if (!outputAmt || !slippagePercent) return '0';
    const output = parseFloat(outputAmt);
    const slippageMultiplier = (100 - parseFloat(slippagePercent)) / 100;
    return (output * slippageMultiplier).toString();
  };

  const switchTokens = () => {
    setIsEthToToken(!isEthToToken);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
  };

  const estimateOutput = (input: string) => {
    // Simplified estimation - in real app, this would call the contract
    if (!input || parseFloat(input) === 0) {
      setOutputAmount('');
      return;
    }
    
    // Mock 1:1000 ratio for demonstration
    const ratio = isEthToToken ? 1000 : 0.001;
    const estimated = (parseFloat(input) * ratio).toString();
    setOutputAmount(estimated);
  };

  return (
    <div className={styles.component}>
      <h2>Swap Tokens</h2>
      
      <div className={styles.swapContainer}>
        <div className={styles.inputGroup}>
          <label>From</label>
          <div className={styles.tokenInput}>
            <input
              type="number"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => {
                setInputAmount(e.target.value);
                estimateOutput(e.target.value);
              }}
            />
            <span className={styles.tokenSymbol}>
              {isEthToToken ? 'ETH' : 'PLT'}
            </span>
          </div>
        </div>

        <button className={styles.switchButton} onClick={switchTokens}>
          ↕️
        </button>

        <div className={styles.inputGroup}>
          <label>To (estimated)</label>
          <div className={styles.tokenInput}>
            <input
              type="number"
              placeholder="0.0"
              value={outputAmount}
              readOnly
            />
            <span className={styles.tokenSymbol}>
              {isEthToToken ? 'PLT' : 'ETH'}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.slippageContainer}>
        <label>Slippage Tolerance</label>
        <div className={styles.slippageOptions}>
          {['0.5', '1', '2'].map((option) => (
            <button
              key={option}
              className={`${styles.slippageOption} ${slippage === option ? styles.active : ''}`}
              onClick={() => setSlippage(option)}
            >
              {option}%
            </button>
          ))}
          <input
            type="number"
            value={slippage}
            onChange={(e) => setSlippage(e.target.value)}
            className={styles.customSlippage}
            step="0.1"
            min="0.1"
            max="50"
          />
        </div>
      </div>

      <button 
        className={styles.actionButton}
        onClick={handleSwap}
        disabled={!inputAmount || isPending || isConfirming}
      >
        {isPending || isConfirming ? 'Swapping...' : 'Swap'}
      </button>

      {isConfirmed && (
        <div className={styles.successMessage}>
          Swap completed successfully!
        </div>
      )}
    </div>
  );
};

export default SwapComponent;
