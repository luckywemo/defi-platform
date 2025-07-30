# Base DeFi Platform

A comprehensive DeFi platform built on Base blockchain featuring token swapping, liquidity provision, and yield farming capabilities.

## Features

- **PlatformToken (PLT)**: ERC20 token with mint/burn functionality
- **SimpleDEX**: Decentralized exchange for ETH/PLT trading
- **Liquidity Management**: Add/remove liquidity with automatic pricing
- **Token Swapping**: Swap between ETH and PLT tokens
- **Gas Optimized**: Built with efficiency in mind for Base network

## Smart Contracts

### PlatformToken.sol
- ERC20 token implementation
- Ownable with mint/burn capabilities
- Initial supply: 1,000,000 PLT tokens

### SimpleDEX.sol
- Automated Market Maker (AMM) functionality
- Constant product formula for pricing
- Liquidity provision rewards
- Slippage protection

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/luckywemo/defi-platform.git
cd defi-platform

# Install dependencies
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Add your private key and API keys:

```bash
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

### Development

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Start local Hardhat network
npm run node

# Deploy to local network
npm run deploy:local

# Deploy to Base Sepolia testnet
npm run deploy:base-sepolia
```

### Testing

Run the comprehensive test suite:

```bash
# Run all tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run specific test file
npx hardhat test test/SimpleDEX.js
```

## Network Configuration

- **Local**: Hardhat network (chainId: 31337)
- **Base Mainnet**: chainId 8453
- **Base Sepolia**: chainId 84532 (testnet)

## Usage Examples

### Adding Liquidity
```javascript
// Approve tokens first
await platformToken.approve(dexAddress, tokenAmount);

// Add liquidity
await simpleDEX.addLiquidity(tokenAmount, { value: ethAmount });
```

### Swapping Tokens
```javascript
// Swap ETH to PLT
await simpleDEX.swapEthToToken({ value: ethAmount });

// Swap PLT to ETH
await platformToken.approve(dexAddress, tokenAmount);
await simpleDEX.swapTokenToEth(tokenAmount);
```

## Security

- All contracts use OpenZeppelin's battle-tested implementations
- Comprehensive test coverage
- Slippage protection on swaps
- Reentrancy guards where applicable

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Roadmap

- [ ] Yield farming contracts
- [ ] Governance token implementation
- [ ] Multi-token DEX support
- [ ] Frontend interface
- [ ] Mobile app integration
- [ ] Advanced trading features
