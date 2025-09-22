# Certimos Backend API Endpoints

## Base URL
```
http://localhost:3000/api
```

## Health Check
### GET /health
Check if the server is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-09-22T10:30:00.000Z",
  "environment": "development",
  "network": "XDC Apothem"
}
```

---

## Certificate Routes (`/api/certificates`)

### 1. Get User Certificates
**GET** `/api/certificates/wallet/:walletAddress`

Get all certificates owned by a specific wallet address.

**Parameters:**
- `walletAddress` (path parameter): Valid Ethereum wallet address

**Example:**
```bash
GET /api/certificates/wallet/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5
```

**Response:**
```json
{
  "success": true,
  "certificates": [
    {
      "tokenId": "1",
      "owner": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
      "metadata": {
        "name": "DevJams 2024 Certificate",
        "description": "Certificate for completing blockchain workshop",
        "image": "https://gateway.pinata.cloud/ipfs/...",
        "attributes": [...]
      }
    }
  ],
  "count": 1
}
```

### 2. Get Certificate Count
**GET** `/api/certificates/total-supply/:walletAddress`

Get the total number of certificates owned by a wallet.

**Parameters:**
- `walletAddress` (path parameter): Valid Ethereum wallet address

**Example:**
```bash
GET /api/certificates/total-supply/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5
```

**Response:**
```json
{
  "success": true,
  "totalSupply": 5,
  "walletAddress": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5"
}
```

---

## Wallet Routes (`/api/wallet`)

### 1. Get Wallet Balance
**GET** `/api/wallet/:address/balance`

Get the XDC balance of a wallet address.

**Parameters:**
- `address` (path parameter): Valid Ethereum wallet address

**Example:**
```bash
GET /api/wallet/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5/balance
```

**Response:**
```json
{
  "success": true,
  "balance": "1.234567890123456789",
  "address": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
  "currency": "XDC"
}
```

---

## Verification Routes (`/api/verify`)

### 1. Verify Certificate
**GET** `/api/verify/:tokenId`

Verify if a certificate exists and get its details.

**Parameters:**
- `tokenId` (path parameter): Certificate token ID

**Example:**
```bash
GET /api/verify/123
```

**Response:**
```json
{
  "success": true,
  "isValid": true,
  "certificate": {
    "tokenId": "123",
    "owner": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
    "metadata": {
      "name": "DevJams 2024 Certificate",
      "description": "Certificate for completing blockchain workshop",
      "image": "https://gateway.pinata.cloud/ipfs/...",
      "attributes": [...]
    }
  }
}
```

---

## Contract Management Routes (`/api/contracts`)

### 1. Deploy New Contract
**POST** `/api/contracts/deploy`

Deploy a new certificate contract.

**Request Body:**
```json
{
  "ownerWalletId": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
  "networkName": "apothem",
  "contractName": "DevJams 2024 Certificates"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contract deployed successfully via deploy.ts!",
  "deployment": {
    "contractAddress": "0x1234567890abcdef...",
    "network": "apothem",
    "blockNumber": 12345,
    "transactionHash": "0xabcdef...",
    "deployedAt": "2024-09-22T10:30:00.000Z",
    "deployer": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
    "contractName": "DevJams 2024 Certificates",
    "owner": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5"
  }
}
```

### 2. Auto-Mint Certificates with IPFS
**POST** `/api/contracts/auto-mint-with-ipfs`

Automatically mint certificates from CSV data with IPFS/Pinata metadata upload.

**Content-Type:** `multipart/form-data` OR `application/x-www-form-urlencoded`

**Option 1: File Upload**
```bash
curl -X POST \
  -F "csvFile=@recipients.csv" \
  http://localhost:3000/api/contracts/auto-mint-with-ipfs
```

**Option 2: CSV Content as Text**
```json
{
  "csvContent": "name,wallet_address,email,course\nAlice Johnson,0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5,alice@example.com,Blockchain Fundamentals"
}
```

**CSV Format:**
```csv
name,wallet_address,email,course,completion_date
Alice Johnson,0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5,alice@example.com,Blockchain Fundamentals,2024-09-15
Bob Smith,0x8f5F4C5B6F4F4F8f5742d35Cc6635C0532925a3b8D2,bob@example.com,Web3 Development,2024-09-16
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully processed 2 recipients with Pinata upload. 2 certificates minted, 0 failed.",
  "summary": {
    "totalProcessed": 2,
    "successCount": 2,
    "failCount": 0,
    "contractAddress": "0x1234567890abcdef...",
    "pinata_uploads": 2
  },
  "results": [
    {
      "success": true,
      "recipientName": "Alice Johnson",
      "walletAddress": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
      "email": "alice@example.com",
      "course": "Blockchain Fundamentals",
      "certificateType": "completion",
      "transactionHash": "0xabcdef123...",
      "pinataUri": "https://gateway.pinata.cloud/ipfs/QmXXXXXX",
      "error": null
    }
  ]
}
```

### 3. Validate CSV File
**POST** `/api/contracts/validate-csv`

Validate CSV file format before processing.

**Content-Type:** `multipart/form-data` OR `application/x-www-form-urlencoded`

**Request:** Same as auto-mint (file upload or csvContent)

**Response:**
```json
{
  "success": true,
  "message": "CSV file is valid",
  "recipients_count": 2,
  "sample_recipients": [
    {
      "name": "Alice Johnson",
      "walletAddress": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
      "hasEmail": true
    }
  ]
}
```

### 4. Get CSV Template
**GET** `/api/contracts/csv-template`

Get CSV format instructions and examples.

**Response:**
```json
{
  "description": "CSV format for bulk certificate generation",
  "required_columns": ["name", "wallet_address"],
  "optional_columns": ["email", "course", "completion_date"],
  "example": {
    "headers": "name,wallet_address,email,course,completion_date",
    "sample_row": "Alice Johnson,0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5,alice@example.com,Blockchain Fundamentals,2024-09-15"
  },
  "usage_options": {
    "enhanced_auto_mint": {
      "method": "POST",
      "endpoint": "/api/contracts/auto-mint-with-ipfs",
      "content_type": "multipart/form-data",
      "description": "Automatically mint certificates with IPFS/Pinata metadata upload",
      "features": [
        "Uploads metadata to both IPFS and Pinata for redundancy",
        "Creates unique metadata for each certificate",
        "Fallback upload system for reliability",
        "Returns IPFS URIs for each minted certificate"
      ]
    }
  }
}
```

### 5. Validate Deployment Environment
**GET** `/api/contracts/deploy/validate`

Check if the deployment environment is properly configured.

**Response:**
```json
{
  "valid": true,
  "errors": [],
  "checks": {
    "private_key": true,
    "artifacts_exist": true,
    "hardhat_config": true,
    "contract_compiled": true
  },
  "supported_networks": ["localhost", "hardhat", "apothem", "xdc-mainnet"],
  "instructions": []
}
```

### 6. Get Available Networks
**GET** `/api/contracts/networks`

Get list of supported blockchain networks.

**Response:**
```json
{
  "supported_networks": {
    "localhost": {
      "name": "Localhost",
      "chainId": 31337,
      "rpcUrl": "http://127.0.0.1:8545",
      "description": "Local Hardhat network for development"
    },
    "apothem": {
      "name": "XDC Apothem Testnet",
      "chainId": 51,
      "rpcUrl": "https://rpc.apothem.network",
      "description": "XDC Network testnet for development"
    },
    "xdc-mainnet": {
      "name": "XDC Mainnet",
      "chainId": 50,
      "rpcUrl": "https://rpc.xinfin.network",
      "description": "XDC Network mainnet"
    }
  },
  "current_network": "localhost"
}
```

### 7. Get Deployment History
**GET** `/api/contracts/deployments`

Get history of all contract deployments.

**Response:**
```json
{
  "deployments": {
    "apothem": {
      "contractAddress": "0x1234567890abcdef...",
      "network": "apothem",
      "blockNumber": 12345,
      "transactionHash": "0xabcdef...",
      "deployedAt": "2024-09-22T10:30:00.000Z",
      "deployer": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5",
      "contractName": "DevJams 2024 Certificates",
      "owner": "0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5"
    }
  },
  "total_deployments": 1
}
```

### 8. Get Deployment Information
**GET** `/api/contracts/deployment-info`

Get current deployment configuration.

**Response:**
```json
{
  "current_network": "localhost",
  "contract_address": "Not set",
  "supported_networks": ["localhost", "apothem", "xdc"],
  "deployment_scripts": [
    "yarn hardhat run scripts/deploy.ts",
    "yarn hardhat run scripts/deploy.ts --network apothem"
  ]
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

**400 Bad Request:**
```json
{
  "success": false,
  "error": "Invalid input",
  "message": "Wallet address is required"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "error": "Not found",
  "message": "Certificate not found"
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Contract execution failed"
}
```

---

## Common Use Cases

### 1. Deploy and Setup New Certificate System
```bash
# 1. Validate environment
GET /api/contracts/deploy/validate

# 2. Deploy contract
POST /api/contracts/deploy
{
  "ownerWalletId": "0x...",
  "networkName": "apothem",
  "contractName": "My Certificate Program"
}

# 3. Bulk mint certificates
POST /api/contracts/auto-mint-with-ipfs
# Upload CSV file with recipients
```

### 2. Verify Certificate
```bash
# Get certificate details
GET /api/verify/123
```

### 3. Get User's Certificates
```bash
# Get all certificates for a user
GET /api/certificates/wallet/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5

# Get certificate count
GET /api/certificates/total-supply/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5
```

### 4. Check Wallet Balance
```bash
# Get wallet XDC balance
GET /api/wallet/0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5/balance
```

---

## Frontend Integration Notes

1. **Base URL**: Update the base URL in your frontend configuration
2. **CORS**: The backend is configured to accept requests from `http://localhost:5173` (Vite default)
3. **File Uploads**: Use `FormData` for CSV file uploads
4. **Error Handling**: All endpoints return consistent error response format
5. **Authentication**: Currently no authentication is required
6. **Rate Limiting**: No rate limiting is currently implemented

## Environment Variables Required

```env
PRIVATE_KEY=your_wallet_private_key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
HARDHAT_NETWORK=apothem
CONTRACT_ADDRESS=deployed_contract_address
```