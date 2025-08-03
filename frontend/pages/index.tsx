import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import { useAccount, useBalance } from 'wagmi';
import styles from '../styles/Home.module.css';
import SwapComponent from '../components/SwapComponent';
import LiquidityComponent from '../components/LiquidityComponent';
import YieldFarmComponent from '../components/YieldFarmComponent';
import LendingComponent from '../components/LendingComponent';

const Home: NextPage = () => {
  const [activeTab, setActiveTab] = useState<'swap' | 'liquidity' | 'yieldfarm' | 'lending'>('swap');
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  return (
    <div className={styles.container}>
      <Head>
        <title>DeFi Platform</title>
        <meta name="description" content="A comprehensive DeFi Platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>DeFi Platform</h1>
          <ConnectButton />
        </div>

        {isConnected && (
          <div className={styles.walletInfo}>
            <p>Address: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
            <p>Balance: {balance?.formatted.slice(0, 6)} {balance?.symbol}</p>
          </div>
        )}

        <div className={styles.tabContainer}>
          <button 
            className={`${styles.tab} ${activeTab === 'swap' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('swap')}
          >
            Swap
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'liquidity' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('liquidity')}
          >
            Liquidity
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'yieldfarm' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('yieldfarm')}
          >
            Yield Farming
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'lending' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('lending')}
          >
            Lending
          </button>
        </div>

        <div className={styles.content}>
          {!isConnected ? (
            <div className={styles.connectPrompt}>
              <h2>Connect Your Wallet</h2>
              <p>Connect your wallet to start trading and providing liquidity</p>
            </div>
          ) : (
            <>
              {activeTab === 'swap' && <SwapComponent />}
              {activeTab === 'liquidity' && <LiquidityComponent />}
              {activeTab === 'yieldfarm' && <YieldFarmComponent />}
              {activeTab === 'lending' && <LendingComponent />}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Home;
