import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>DeFi Platform</title>
        <meta name="description" content="A simple DeFi Platform" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <ConnectButton />

        <h1 className={styles.title}>
          Welcome to the DeFi Platform!
        </h1>

        <p className={styles.description}>
          Get started by connecting your wallet.
        </p>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h2>Swap</h2>
            <p>Swap your tokens seamlessly.</p>
          </div>

          <div className={styles.card}>
            <h2>Liquidity</h2>
            <p>Provide liquidity and earn rewards.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
