import {Router, Request, Response} from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { execSync } from 'child_process';
import { 
  generateCertificatesHandler, 
  autoMintCertificatesFromCSV,
  generateCertificatesFromCSV,
  parseRecipientsCSV
} from '../controllers/generateContractController.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file: any, cb: any) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const router = Router();

// Function to run the deploy.ts script
async function runDeployScript(receiverId: string): Promise<{
  success: boolean;
  contractAddress?: string;
  transactionHash?: string;
  error?: string;
  deploymentInfo?: any;
}> {
  try {
    console.log(`🚀 Running deploy.ts script with receiverId: ${receiverId}`);
    
    // Create a temporary script that automatically provides the receiverId
    const tempScriptContent = `
import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.connect();

// Function to save deployment info
async function saveDeploymentInfo(contractAddress: string, deployer: string, deployTx: any, networkName: string) {
  const deploymentInfo = {
    contractAddress,
    network: networkName,
    blockNumber: deployTx.blockNumber || 0,
    transactionHash: deployTx.hash || "",
    deployedAt: new Date().toISOString(),
    deployer
  };

  const deploymentsPath = path.join(__dirname, "deployments.ts");
  
  let deploymentsContent = \`export interface DeploymentInfo {
  contractAddress: string;
  network: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
}

export interface DeploymentConfig {
  [network: string]: DeploymentInfo;
}

export const deployments: DeploymentConfig = {\\n\`;

  // Try to read existing deployments
  try {
    if (fs.existsSync(deploymentsPath)) {
      const existingContent = fs.readFileSync(deploymentsPath, 'utf8');
      const match = existingContent.match(/export const deployments: DeploymentConfig = ({[\\s\\S]*?});/);
      if (match) {
        const existingDeployments = eval((\`\${match[1]}\`));
        existingDeployments[networkName] = deploymentInfo;
        
        deploymentsContent = \`export interface DeploymentInfo {
  contractAddress: string;
  network: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
}

export interface DeploymentConfig {
  [network: string]: DeploymentInfo;
}

export const deployments: DeploymentConfig = \${JSON.stringify(existingDeployments, null, 2)};\`;
      }
    } else {
      deploymentsContent += \`  "\${networkName}": \${JSON.stringify(deploymentInfo, null, 4)}\\n\`;
      deploymentsContent += \`};\`;
    }
  } catch (error) {
    deploymentsContent += \`  "\${networkName}": \${JSON.stringify(deploymentInfo, null, 4)}\\n\`;
    deploymentsContent += \`};\`;
  }

  fs.writeFileSync(deploymentsPath, deploymentsContent);
  console.log("📝 Deployment info saved to deployments.ts");
  return deploymentInfo;
}

async function main() {
  const receivingID = "${receiverId}";

  console.log("Deploying Certificate contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const Certificate = await ethers.getContractFactory("Certificate");
  const certificate = await Certificate.deploy(deployer.address);
  await certificate.waitForDeployment();

  const address = await certificate.getAddress();
  const deployTx = certificate.deploymentTransaction();

  console.log("Certificate deployed to:", address);
  console.log("Contract owner:", await certificate.getFunction("owner")());
  
  const networkName = process.env.HARDHAT_NETWORK || "apothem";
  const deploymentInfo = await saveDeploymentInfo(address, deployer.address, deployTx, networkName);
  
  console.log("Deployment successful!");

  // Output deployment result as JSON for parsing
  const result = {
    success: true,
    contractAddress: address,
    transactionHash: deployTx?.hash || '',
    deploymentInfo
  };
  
  console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
  
  return result;
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error deploying contract:", error);
    const result = {
      success: false,
      error: error.message
    };
    console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
    process.exit(1);
  });
`;

    // Write temporary script
    const tempScriptPath = path.join(process.cwd(), 'temp-deploy.mjs');
    fs.writeFileSync(tempScriptPath, tempScriptContent);

    // Execute the deployment script
    const output = execSync(`npx hardhat run ${tempScriptPath} --network apothem`, {
      encoding: 'utf8',
      cwd: process.cwd()
    });

    // Parse the result from script output
    const lines = output.split('\n');
    const resultLine = lines.find(line => line.includes('DEPLOYMENT_RESULT:'));
    
    if (resultLine) {
      const resultJson = resultLine.replace('DEPLOYMENT_RESULT:', '').trim();
      const result = JSON.parse(resultJson);
      
      // Clean up temporary script
      fs.unlinkSync(tempScriptPath);
      
      return result;
    } else {
      throw new Error('Could not parse deployment result');
    }

  } catch (error: any) {
    console.error('Deploy script execution failed:', error);
    
    // Clean up temporary script if it exists
    const tempScriptPath = path.join(process.cwd(), 'temp-deploy.mjs');
    if (fs.existsSync(tempScriptPath)) {
      fs.unlinkSync(tempScriptPath);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}


// New route to automatically mint certificates from CSV without confirmation
router.post('/mint-from-csv', upload.single('csvFile'), async (req: any, res: Response) => {
  try {
    let csvFile: string;
    
    // Handle different input scenarios
    if (req.file) {
      // Case 1: CSV file uploaded
      csvFile = req.file.path;
    } else if (req.body.csvContent) {
      // Case 2: CSV content provided directly as text
      const csvContent = req.body.csvContent;
      
      // Save CSV content to temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      csvFile = path.join(tempDir, `temp-${Date.now()}.csv`);
      fs.writeFileSync(csvFile, csvContent);
    } else {
      return res.status(400).json({
        error: 'CSV data must be provided',
        accepted_formats: [
          'csvFile: Upload CSV file',
          'csvContent: CSV content as text'
        ]
      });
    }

    console.log('🚀 Starting automatic certificate minting from CSV...');
    
    // Call the auto-minting function using the imported function
    const result = await autoMintCertificatesFromCSV(csvFile);

    // Clean up temporary files
    if (req.body.csvContent && fs.existsSync(csvFile)) {
      fs.unlinkSync(csvFile); // Remove temp file
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Remove uploaded file after processing
    }

    // Prepare response
    const response = {
      success: result.success,
      message: result.success 
        ? `Successfully processed ${result.totalProcessed} recipients. ${result.successCount} certificates minted, ${result.failCount} failed.`
        : `Failed to mint certificates: ${result.error}`,
      summary: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failCount: result.failCount,
        contractAddress: result.contractAddress
      },
      results: result.results.map(r => ({
        success: r.success,
        recipientName: r.recipient.name,
        walletAddress: r.recipient.walletAddress,
        email: r.recipient.email,
        course: r.recipient.course,
        certificateType: r.certificateType,
        transactionHash: r.transactionHash,
        error: r.error
      }))
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }

  } catch (error: any) {
    console.error('Error in auto-mint route:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to auto-mint certificates',
      message: error.message
    });
  }
});

// Enhanced route to auto-mint certificates with IPFS/Pinata upload
router.post('/auto-mint-with-ipfs', upload.single('csvFile'), async (req: any, res: Response) => {
  try {
    let csvFile: string;
    
    // Handle different input scenarios
    if (req.file) {
      // Case 1: CSV file uploaded
      csvFile = req.file.path;
    } else if (req.body.csvContent) {
      // Case 2: CSV content provided directly as text
      const csvContent = req.body.csvContent;
      
      // Save CSV content to temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      csvFile = path.join(tempDir, `temp-${Date.now()}.csv`);
      fs.writeFileSync(csvFile, csvContent);
    } else {
      return res.status(400).json({
        error: 'CSV data must be provided',
        accepted_formats: [
          'csvFile: Upload CSV file',
          'csvContent: CSV content as text'
        ]
      });
    }

    console.log('🚀 Starting enhanced automatic certificate minting with IPFS/Pinata upload...');
    
    // Call the auto-minting function with IPFS integration
    const result = await autoMintCertificatesFromCSV(csvFile);

    // Clean up temporary files
    if (req.body.csvContent && fs.existsSync(csvFile)) {
      fs.unlinkSync(csvFile); // Remove temp file
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Remove uploaded file after processing
    }

    // Prepare enhanced response with Pinata information
    const response = {
      success: result.success,
      message: result.success 
        ? `Successfully processed ${result.totalProcessed} recipients with Pinata upload. ${result.successCount} certificates minted, ${result.failCount} failed.`
        : `Failed to mint certificates: ${result.error}`,
      summary: {
        totalProcessed: result.totalProcessed,
        successCount: result.successCount,
        failCount: result.failCount,
        contractAddress: result.contractAddress,
        pinata_uploads: result.results.filter(r => r.success && r.pinataUri).length
      },
      results: result.results.map(r => ({
        success: r.success,
        recipientName: r.recipient.name,
        walletAddress: r.recipient.walletAddress,
        email: r.recipient.email,
        course: r.recipient.course,
        certificateType: r.certificateType,
        transactionHash: r.transactionHash,
        pinataUri: r.pinataUri,
        error: r.error
      }))
    };

    if (result.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }

  } catch (error: any) {
    console.error('Error in enhanced auto-mint route:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to auto-mint certificates with Pinata',
      message: error.message
    });
  }
});

// Route to get CSV template/example
router.get('/csv-template', (req: Request, res: Response) => {
  const template = {
    description: "CSV format for bulk certificate generation",
    required_columns: ["name", "wallet_address"],
    optional_columns: ["email", "course", "completion_date"],
    example: {
      headers: "name,wallet_address,email,course,completion_date",
      sample_row: "Alice Johnson,0x742d35Cc6635C0532925a3b8D2f4C5B6F4F4F8f5,alice@example.com,Blockchain Fundamentals,2024-09-15"
    },
    instructions: [
      "1. Create a CSV file with recipient data",
      "2. Ensure 'name' and 'wallet_address' columns are present", 
      "3. Wallet addresses must be valid Ethereum addresses",
      "4. Use the /generate-from-csv endpoint to create certificates"
    ],
    usage_options: {
      file_upload: {
        method: "POST",
        endpoint: "/api/contracts/generate-from-csv",
        content_type: "multipart/form-data",
        fields: {
          csvFile: "Upload CSV file",
          certificateName: "DevJams 2024 Certificate",
          eventName: "DevJams 2024 Blockchain Workshop",
          description: "Certificate description (optional)",
          imageUrl: "https://example.com/image.png (optional)",
          level: "Beginner|Intermediate|Advanced (optional)",
          skills: "Blockchain,Smart Contracts,Web3 (optional)"
        }
      },
      text_content: {
        method: "POST",
        endpoint: "/api/contracts/generate-from-csv",
        content_type: "application/x-www-form-urlencoded",
        fields: {
          csvContent: "name,wallet_address,email\\nAlice,0x123...,alice@example.com",
          certificateName: "DevJams 2024 Certificate",
          eventName: "DevJams 2024 Blockchain Workshop"
        }
      },
      auto_mint: {
        method: "POST",
        endpoint: "/api/contracts/auto-mint-from-csv",
        content_type: "multipart/form-data",
        description: "Automatically mint certificates without confirmation",
        fields: {
          csvFile: "Upload CSV file with recipients"
        }
      },
      enhanced_auto_mint: {
        method: "POST",
        endpoint: "/api/contracts/auto-mint-with-ipfs",
        content_type: "multipart/form-data",
        description: "Automatically mint certificates with IPFS/Pinata metadata upload",
        features: [
          "Uploads metadata to both IPFS and Pinata for redundancy",
          "Creates unique metadata for each certificate",
          "Fallback upload system for reliability",
          "Returns IPFS URIs for each minted certificate"
        ],
        fields: {
          csvFile: "Upload CSV file with recipients"
        }
      }
    }
  };
  
  res.json(template);
});

// Route to validate CSV file format (File Upload + Form Data)
router.post('/validate-csv', upload.single('csvFile'), async (req: any, res: Response) => {
  try {
    let csvFile: string;
    
    // Handle different input scenarios
    if (req.file) {
      // Case 1: CSV file uploaded
      csvFile = req.file.path;
    } else if (req.body.csvContent) {
      // Case 2: CSV content provided directly
      const csvContent = req.body.csvContent;
      
      // Save CSV content to temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      csvFile = path.join(tempDir, `validate-${Date.now()}.csv`);
      fs.writeFileSync(csvFile, csvContent);
    } else {
      return res.status(400).json({
        error: 'CSV data must be provided',
        accepted_formats: [
          'csvFile: Upload CSV file',
          'csvContent: CSV content as text'
        ]
      });
    }

    // Use the imported parseRecipientsCSV function
    const recipients = await parseRecipientsCSV(csvFile);
    
    // Clean up temporary files
    if (req.body.csvContent && fs.existsSync(csvFile)) {
      fs.unlinkSync(csvFile); // Remove temp file
    }
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Remove uploaded file after processing
    }
    
    res.json({
      success: true,
      message: `CSV file is valid`,
      recipients_count: recipients.length,
      sample_recipients: recipients.slice(0, 3).map(r => ({
        name: r.name,
        walletAddress: r.walletAddress,
        hasEmail: !!r.email
      }))
    });

  } catch (error: any) {
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(400).json({
      success: false,
      error: 'Invalid CSV file',
      message: error.message
    });
  }
});

// Route to deploy a new contract using deploy.ts script
router.post('/deploy', async (req: Request, res: Response) => {
  try {
    const {
      receiverId
    } = req.body;

    // Validate required fields
    if (!receiverId) {
      return res.status(400).json({
        error: 'Missing required field: receiverId',
        required: ['receiverId'],
        description: 'receiverId is the wallet address that will receive the initial test certificate'
      });
    }

    console.log(`🚀 Deploying Certificate contract using deploy.ts script...`);
    console.log(`📧 Receiver ID: ${receiverId}`);

    // Run the deploy.ts script
    const result = await runDeployScript(receiverId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Contract deployed successfully using deploy.ts script',
        deployment: {
          contractAddress: result.contractAddress,
          transactionHash: result.transactionHash,
          network: result.deploymentInfo?.network || 'apothem',
          deployer: result.deploymentInfo?.deployer,
          deployedAt: result.deploymentInfo?.deployedAt
        },
        deploymentInfo: result.deploymentInfo
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Deployment failed',
        message: result.error
      });
    }

  } catch (error: any) {
    console.error('Error in deployment handler:', error);
    res.status(500).json({
      error: 'Deployment failed',
      message: error.message
    });
  }
});

// Route to validate deployment environment
router.get('/deploy/validate', (req: Request, res: Response) => {
  try {
    // Basic deployment environment checks
    const checks = {
      private_key: !!process.env.PRIVATE_KEY,
      artifacts_exist: fs.existsSync(path.join(process.cwd(), 'artifacts', 'contracts')),
      hardhat_config: fs.existsSync(path.join(process.cwd(), 'hardhat.config.ts')),
      contract_compiled: fs.existsSync(path.join(process.cwd(), 'artifacts', 'contracts', 'Certificate.sol'))
    };

    const valid = Object.values(checks).every(check => check);
    const errors = [];
    
    if (!checks.private_key) errors.push('PRIVATE_KEY environment variable not set');
    if (!checks.artifacts_exist) errors.push('Contract artifacts not found');
    if (!checks.hardhat_config) errors.push('Hardhat config not found');
    if (!checks.contract_compiled) errors.push('Certificate contract not compiled');

    const response = {
      valid,
      errors,
      checks,
      supported_networks: ['localhost', 'hardhat', 'apothem', 'xdc-mainnet'],
      instructions: valid ? [] : [
        'Set PRIVATE_KEY in your .env file',
        'Run "npx hardhat compile" to compile contracts',
        'Ensure hardhat.config.ts is properly configured'
      ]
    };

    res.json(response);
  } catch (error: any) {
    res.status(500).json({
      error: 'Environment validation failed',
      message: error.message
    });
  }
});

// Route to get available networks
router.get('/networks', (req: Request, res: Response) => {
  const networks = {
    localhost: {
      name: 'Localhost',
      chainId: 31337,
      rpcUrl: 'http://127.0.0.1:8545',
      description: 'Local Hardhat network for development'
    },
    hardhat: {
      name: 'Hardhat',
      chainId: 31337,
      rpcUrl: 'http://127.0.0.1:8545',
      description: 'Hardhat local network'
    },
    apothem: {
      name: 'XDC Apothem Testnet',
      chainId: 51,
      rpcUrl: 'https://rpc.apothem.network',
      description: 'XDC Network testnet for development'
    },
    'xdc-mainnet': {
      name: 'XDC Mainnet',
      chainId: 50,
      rpcUrl: 'https://rpc.xinfin.network',
      description: 'XDC Network mainnet'
    }
  };

  res.json({
    supported_networks: networks,
    current_network: process.env.HARDHAT_NETWORK || 'localhost'
  });
});

// Route to get deployment history
router.get('/deployments', (req: Request, res: Response) => {
  try {
    const deploymentsPath = path.join(process.cwd(), 'scripts', 'deployments.ts');
    
    if (!fs.existsSync(deploymentsPath)) {
      return res.json({
        deployments: {},
        message: 'No deployments found'
      });
    }

    const deploymentsContent = fs.readFileSync(deploymentsPath, 'utf8');
    const match = deploymentsContent.match(/export const deployments: DeploymentConfig = ({[\s\S]*?});/);
    
    if (match) {
      const deployments = eval(`(${match[1]})`);
      res.json({
        deployments,
        total_deployments: Object.keys(deployments).length
      });
    } else {
      res.json({
        deployments: {},
        message: 'Could not parse deployments file'
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Failed to read deployments',
      message: error.message
    });
  }
});

// Route to serve the deployment dashboard
router.get('/deploy/dashboard', (req: Request, res: Response) => {
  const htmlPath = path.join(process.cwd(), 'public', 'deploy-dashboard.html');
  
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).json({ error: 'Deployment dashboard not found' });
  }
});

// Route to serve the bulk generator form
router.get('/bulk-generator', (req: Request, res: Response) => {
  const htmlPath = path.join(process.cwd(), 'public', 'bulk-generator.html');
  
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).json({ error: 'Bulk generator form not found' });
  }
});

// Route to get deployment information
router.get('/deployment-info', (req: Request, res: Response) => {
  const deploymentInfo = {
    current_network: process.env.HARDHAT_NETWORK || "localhost",
    contract_address: process.env.CONTRACT_ADDRESS || "Not set",
    supported_networks: ["localhost", "apothem", "xdc"],
    deployment_scripts: [
      "yarn hardhat run scripts/deploy.ts",
      "yarn hardhat run scripts/deploy.ts --network apothem"
    ]
  };
  
  res.json(deploymentInfo);
});

export default router;