# RedactedToken - Privacy-Preserving ETH with fhEVM

A Hardhat-based application for privacy-preserving Ethereum transactions using Fully Homomorphic Encryption (FHE) via the fhEVM protocol by Zama. This project features a modern web UI for encrypting, transferring, and decrypting ETH with complete confidentiality.

## ✨ Features

- 🔒 **Encrypt ETH**: Convert your public ETH into encrypted eETH for private holdings
- 🔄 **Private Transfers**: Send encrypted tokens without revealing amounts
- 👁️ **Selective Decryption**: Decrypt and view your encrypted balance anytime
- 💰 **Withdraw**: Convert encrypted balance back to native ETH
- 🎨 **Modern UI**: Beautiful wallet interface with balance visualization
- 🌓 **Dark/Light Mode**: Toggle between themes for comfortable viewing
- 📊 **Balance Breakdown**: Visual indicators for public, claimable, and confidential balances

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 20 or higher ([Download](https://nodejs.org/))
- **npm**: Package manager (comes with Node.js)
- **Git**: Version control ([Download](https://git-scm.com/))
- **Internet Connection**: Required for fhEVM gateway access during encryption operations

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/aquariusluo/hello-fhevm.git
cd hello-fhevm
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Hardhat and plugins
- fhEVM libraries
- TypeScript dependencies
- Web server dependencies

### 3. Set Up Environment Variables (Optional)

For Sepolia testnet deployment:

```bash
# Set your mnemonic phrase (or use the default test one)
npx hardhat vars set MNEMONIC

# Set your Alchemy API key for Sepolia access
npx hardhat vars set ALCHEMY_API_KEY

# Optional: Set Etherscan API key for contract verification
npx hardhat vars set ETHERSCAN_API_KEY
```

**Note**: For local development, you can skip this step as default test values are provided.

## 🏃 Running the Application

### Start Local Development Environment

Follow these steps in order to run the complete application:

#### Step 1: Start the Hardhat Node

Open a terminal and run:

```bash
npm run chain
```

This will:
- Start a local Hardhat node at `http://127.0.0.1:8545`
- Create 20 test accounts each with 10,000 ETH
- Keep running in the background (leave this terminal open)

You should see output like:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/

Accounts
========
Account #0: 0x2B450a1F95774eF7B09C806869e7f8c6333Ff726 (10000 ETH)
Account #1: 0x6CB7DF71539671d9869126721E2703001D6075d4 (10000 ETH)
...
```

#### Step 2: Deploy the Smart Contract

Open a **new terminal** (keep the first one running) and run:

```bash
npm run deploy:localhost
```

This will:
- Compile the RedactedToken contract
- Deploy it to your local network
- Display the deployed contract address

You should see output like:
```
deploying "RedactedToken" (tx: 0x...)
deployed at 0x8699D98F582a7d47f9667895cB0Ac2Ce2BC55692 with 1462517 gas
RedactedToken contract: 0x8699D98F582a7d47f9667895cB0Ac2Ce2BC55692
```

#### Step 3: Start the Web Server

In the same terminal (or another new one), run:

```bash
npm start
```

This will:
- Start the web server at `http://localhost:3000`
- Serve the UI and API endpoints
- Enable interaction with the deployed contract

You should see:
```
Server running at http://localhost:3000
```

#### Step 4: Open the Application

Open your web browser and navigate to:

```
http://localhost:3000
```

The application will:
- Show an animated loading screen
- Connect to the local network
- Load your account balances
- Display the main UI with the wallet panel

## 🎯 Using the Application

### Encrypting ETH

1. **Enter Amount**: Type the amount of ETH you want to encrypt (e.g., `0.1`)
2. **Use Slider**: Or drag the slider to select a percentage of your balance
3. **Click MAX**: For maximum amount
4. **Click ENCRYPT**: Confirms the transaction
5. **Wait for Confirmation**: Transaction processes and balance updates

### Private Transfers

1. **Navigate to Private Transfer**: Scroll down to the "Private Transfer" section
2. **Enter Recipient**: Paste the recipient's Ethereum address
3. **Enter Amount**: Specify the amount in ETH
4. **Click Transfer**: Transaction is encrypted and sent privately
5. **Recipient Balance**: The recipient can decrypt to see their new balance

### Decrypting and Withdrawing

1. **Switch to Decrypt Tab**: Click the "👁️ Decrypt" tab
2. **Enter Amount**: Specify how much eETH to decrypt and withdraw
3. **Click DECRYPT**: First click reveals the decrypt option
4. **Click WITHDRAW**: Converts encrypted balance to native ETH
5. **Check Wallet**: ETH appears in your wallet balance

### Viewing Your Wallet

1. **Click Wallet Icon**: Top-right corner (👛)
2. **View Balances**:
   - **Public**: Regular ETH balance (blue)
   - **Claimable**: Decrypted but not withdrawn (green)
   - **Confidential**: Encrypted balance (gray)
3. **Balance Legend**: Shows what each color represents
4. **Close Wallet**: Click the ✕ or backdrop

## 🛑 Stopping the Services

To properly shut down all services:

### 1. Stop the Web Server

In the terminal running `npm start`, press:
```
Ctrl + C
```

### 2. Stop the Hardhat Node

In the terminal running `npm run chain`, press:
```
Ctrl + C
```

### 3. Verify Shutdown

Check that no processes are still running:
```bash
lsof -i :3000  # Check web server
lsof -i :8545  # Check Hardhat node
```

If any processes remain, kill them:
```bash
kill -9 <PID>
```

## 📁 Project Structure

```
hello-fhevm/
├── contracts/              # Solidity smart contracts
│   └── RedactedToken.sol   # Main privacy token contract
├── deploy/                 # Deployment scripts
│   └── deploy.ts           # RedactedToken deployment
├── tasks/                  # Hardhat custom tasks
│   └── RedactedToken.ts    # CLI tasks for contract interaction
├── test/                   # Contract tests
├── public/                 # Web UI files
│   ├── index.html          # Main UI with wallet interface
│   └── style.css           # Styling with animations
├── server.js               # Express API server
├── hardhat.config.ts       # Hardhat configuration
└── package.json            # Dependencies and scripts
```

## 📜 Available NPM Scripts

| Script                  | Description                                      |
|-------------------------|--------------------------------------------------|
| `npm start`             | Start web server at http://localhost:3000       |
| `npm run chain`         | Start local Hardhat node                         |
| `npm run deploy:localhost` | Deploy contracts to localhost                 |
| `npm run deploy:sepolia`   | Deploy contracts to Sepolia testnet          |
| `npm run compile`       | Compile all smart contracts                      |
| `npm run test`          | Run all tests                                    |
| `npm run test:sepolia`  | Run tests on Sepolia testnet                     |
| `npm run coverage`      | Generate test coverage report                    |
| `npm run lint`          | Run linting checks (Solidity + TypeScript)       |
| `npm run clean`         | Clean build artifacts and cache                  |
| `npm run typechain`     | Generate TypeScript bindings                     |

## 🔧 Configuration

### Network Configuration

The application supports two networks:

- **Localhost** (default): Local Hardhat development network
- **Sepolia**: Ethereum testnet for public testing

Switch networks using the dropdown in the top-right corner of the UI.

### Hardhat Configuration

Edit `hardhat.config.ts` to customize:
- Network settings
- Compiler options
- Gas reporter settings
- Deployment accounts

## 🌐 Network Requirements

**Important**: The fhEVM protocol requires internet access to Zama's gateway service for encryption operations:

- **Gateway URL**: `gateway.zama.ai`
- **Required Ports**: 443 (HTTPS)
- **DNS Resolution**: Must be able to resolve `gateway.zama.ai`

If you encounter connection errors:
1. Check your internet connection
2. Verify DNS settings (try 8.8.8.8 or 1.1.1.1)
3. Disable VPN/proxy if blocking connections
4. Check firewall settings for outbound HTTPS

## 🐛 Troubleshooting

### "Connection timeout" during loading

**Cause**: Unable to connect to local node or fhEVM gateway

**Solution**:
- Ensure Hardhat node is running (`npm run chain`)
- Check internet connection for fhEVM gateway access
- Verify no firewall blocking connections

### "Failed to load balance"

**Cause**: Contract not deployed or wrong network

**Solution**:
- Deploy contract: `npm run deploy:localhost`
- Check network selection in UI (should be "Localhost")
- Restart web server: Stop and run `npm start` again

### "Invalid recipient address" during transfer

**Cause**: Recipient address not in local accounts list

**Solution**:
- Click "Load Accounts" to populate account list
- Select from dropdown or use "Fill Transfer to Account 2"
- Ensure address is a valid Ethereum address (0x...)

### Encryption fails with "fhEVM API unavailable"

**Cause**: Cannot reach Zama's fhEVM gateway service

**Solution**:
- Check internet connectivity: `curl -I https://gateway.zama.ai`
- Try different network if on restricted/corporate WiFi
- Disable VPN temporarily
- Check DNS resolution

### Empty balance after loading

**Cause**: Balance still loading in background

**Solution**:
- Wait a few seconds for balance to populate
- Click refresh button (🔄) next to balance query
- Open wallet panel to see loading state

## 📚 Documentation

- [fhEVM Documentation](https://docs.zama.ai/fhevm)
- [fhEVM Hardhat Setup Guide](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [fhEVM Testing Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat/write_test)
- [Hardhat Documentation](https://hardhat.org/docs)

## 🧪 Testing

### Run Unit Tests

```bash
npm test
```

### Run Tests with Coverage

```bash
npm run coverage
```

### Test on Sepolia Testnet

```bash
npm run test:sepolia
```

## 🚢 Deploying to Sepolia

### 1. Get Sepolia ETH

Get testnet ETH from faucets:
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)

### 2. Set API Keys

```bash
npx hardhat vars set ALCHEMY_API_KEY your_key_here
npx hardhat vars set ETHERSCAN_API_KEY your_key_here
```

### 3. Deploy

```bash
npm run deploy:sepolia
```

### 4. Verify Contract

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### 5. Use Sepolia in UI

Switch network to "Sepolia" in the UI dropdown.

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/aquariusluo/hello-fhevm/issues)
- **Zama Documentation**: [docs.zama.ai](https://docs.zama.ai)
- **Zama Community**: [Discord](https://discord.gg/zama)

## 🙏 Acknowledgments

- **Zama**: For the fhEVM protocol and development tools
- **Hardhat**: For the development environment
- **OpenZeppelin**: For secure contract libraries

---

**Built with ❤️ using fhEVM by Zama**
