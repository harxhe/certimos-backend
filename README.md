# Certimos Backend

Certimos is a blockchain-based certificate management system that allows organizations to issue, verify, and manage digital certificates as NFTs (Non-Fungible Tokens). This backend provides the API infrastructure and smart contract deployment capabilities for the Certimos platform.

## Features

- **Digital Certificate Issuance**: Issue certificates as ERC-721 NFTs on the blockchain
- **Certificate Verification**: Verify certificate authenticity and ownership
- **IPFS Integration**: Store certificate metadata on IPFS via Pinata
- **Wallet Management**: Handle blockchain wallet interactions
- **Express.js API**: RESTful API for frontend integration
- **Smart Contract Deployment**: Hardhat-based deployment and testing framework

## Project Structure

This project includes:

- **Smart Contracts**: ERC-721 certificate contracts using OpenZeppelin
- **Express.js Backend**: API server with TypeScript support
- **IPFS Integration**: Metadata storage via Pinata
- **Hardhat Framework**: Contract compilation, testing, and deployment
- **TypeScript**: Full TypeScript support for type safety

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/harxhe/certimos-backend.git
   cd certimos-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory and configure the following variables:
   ```env
   PORT=3000
   PINATA_JWT=your_pinata_jwt_token
   PINATA_GATEWAY_URL=your_pinata_gateway_url
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   PRIVATE_KEY=your_wallet_private_key
   RPC_URL=your_blockchain_rpc_url
   ```

## Usage

### Development Server

Start the development server with hot reloading:

```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

### Building the Project

Compile smart contracts and TypeScript:

```bash
npm run build
```

### Production

Start the production server:

```bash
npm start
```

### Smart Contract Testing

Run all tests (both Solidity and TypeScript):

```bash
npm test
```

Run specific test types:

```bash
# Run Solidity tests
npx hardhat test solidity

# Run TypeScript/Mocha tests
npx hardhat test mocha
```

### Smart Contract Deployment

Deploy contracts to different networks:

```bash
# Deploy to local network
npx hardhat ignition deploy ignition/modules/Certificate.ts

# Deploy to testnet (requires proper configuration)
npx hardhat ignition deploy --network sepolia ignition/modules/Certificate.ts
```

## API Endpoints

The backend provides several API endpoints for certificate management:

- **GET** `/api/health` - Health check
- **GET** `/api/certificates/wallet/:walletAddress` - Get user certificates
- **POST** `/api/certificates/issue` - Issue new certificate
- **GET** `/api/certificates/verify/:tokenId` - Verify certificate
- **POST** `/api/wallet/generate` - Generate new wallet
- **GET** `/api/wallet/balance/:address` - Get wallet balance

For detailed API documentation, see [API_ENDPOINTS.md](./API_ENDPOINTS.md).

## Technology Stack

- **Blockchain**: Ethereum-compatible networks
- **Smart Contracts**: Solidity with OpenZeppelin libraries
- **Backend**: Node.js with Express.js
- **Language**: TypeScript
- **Testing**: Hardhat with Mocha and Chai
- **Storage**: IPFS via Pinata
- **Database**: Supabase (PostgreSQL)
- **Development**: Nodemon for hot reloading

## Project Structure

```
certimos-backend/
├── contracts/           # Smart contracts
├── src/
│   ├── controllers/     # API controllers
│   ├── middleware/      # Express middleware
│   ├── routes/         # API routes
│   └── server.ts       # Main server file
├── scripts/            # Deployment and utility scripts
├── test/              # Smart contract tests
├── types/             # TypeScript type definitions
├── artifacts/         # Compiled contracts
└── uploads/           # File upload directory
```

## Configuration

### Hardhat Configuration

The project uses Hardhat 3 Beta with the following features:
- TypeScript support
- Ethers.js integration
- Test coverage
- Gas reporting
- Contract verification

### Network Configuration

Configure networks in `hardhat.config.ts` for deployment to different chains.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and ensure they pass
6. Submit a pull request


## Support

For questions or support, please open an issue on GitHub or contact the development team.


[Frontend Repo](https://github.com/gracymehndiratta/CERTIMOS)
