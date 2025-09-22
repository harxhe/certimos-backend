import {Router, Request, Response} from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import {spawn} from 'child_process';
import { 
  autoMintCertificatesFromCSV,
  parseRecipientsCSV
} from '../controllers/generateContractController.js';

import { fetchcontract } from '../../scripts/deployment-utils.js';


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
// (Multer configuration and other routes remain unchanged...)

// Enhanced route to auto-mint certificates with IPFS/Pinata upload
router.post('/auto-mint-with-ipfs', upload.single('csvFile'), async (req: any, res: Response) => {
  try {
    let csvFile: string;
    let imageFile: string;



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

    const contractName = req.body.contractName;
    const eventName = req.body.eventName;
    const certificateName = req.body.certificateName;
    
    if (!contractName) {
      return res.status(400).json({
        error: 'Contract name is required',
        message: 'Please provide a valid contract name in the request body'
      });
    }

    console.log('Contract Name:', contractName);
    let contractAddress;
    try {
      contractAddress = await fetchcontract(contractName);
    } catch (error: any) {
      return res.status(404).json({
        error: 'Contract not found',
        message: error.message
      });
    }

    console.log('🚀 Starting enhanced automatic certificate minting with IPFS/Pinata upload...');
    
    // Call the auto-minting function with IPFS integration
    const result = await autoMintCertificatesFromCSV(csvFile, contractAddress, eventName, certificateName);

  
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
        contractAddress: contractAddress,
        pinata_uploads: result.results.filter(r => r.success && r.pinataUri).length
      },
      results: result.results.map(r => ({
        success: r.success,
        recipientName: r.recipient.name,
        walletAddress: req.session.walletAddress,
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
  console.log("\n[DEBUG] /deploy route hit at:", new Date().toISOString());

  const { networkName, contractName, walletAddress } = req.body;
  console.log(`[DEBUG] Request Body:`, { networkName, contractName, walletAddress });
  if (!contractName || !walletAddress) {
    console.error("[DEBUG] Validation failed: Missing contractName or walletAddress.");
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['contractName', 'walletAddress'],
    });
  }

  console.log(`[DEBUG] 🚀 Spawning deployment process...`);

  const runDeployment = () => new Promise<string>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'deploy.ts');
    const command = `yarn hardhat run ${scriptPath}`;
    console.log(`[DEBUG] Running command: ${command}`);
    const child = spawn(command, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEPLOY_WALLET_ADDRESS: walletAddress,
        DEPLOY_CONTRACT_NAME: contractName,
        DEPLOY_NETWORK_NAME: networkName || 'apothem'
      },
      shell: true,
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      console.log('[STDOUT]', data.toString().trim()); // Log script output line by line
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error('[STDERR]', data.toString().trim()); // Log script errors line by line
      stderrData += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`[DEBUG] Child process exited with code ${code}`);
      if (code !== 0) {
        const error = new Error(`Script exited with error code ${code}`);
        (error as any).stdout = stdoutData;
        (error as any).stderr = stderrData;
        return reject(error);
      }
      resolve(stdoutData);
    });

    child.on('error', (err) => {
      console.error("[DEBUG] Failed to start child process.", err);
      reject(err);
    });
  });

  try {
    const fullOutput = await runDeployment();
    console.log("[DEBUG] Searching for DEPLOYMENT_RESULT in script output...");
    
    const resultLine = fullOutput.split('\n').find(line => line.includes('DEPLOYMENT_RESULT:'));

    if (resultLine) {
      console.log("[DEBUG] Found DEPLOYMENT_RESULT. Parsing JSON...");
      const result = JSON.parse(resultLine.replace('DEPLOYMENT_RESULT:', '').trim());
      
      if (result.success) {
        console.log("[DEBUG] Deployment success. Sending 200 OK response.");
        res.json({
          success: true,
          message: 'Contract deployed successfully!',
          deployment: result.deploymentInfo,
        });
      } else {
        console.error("[DEBUG] Script reported a failure. Sending 500 response.");
        res.status(500).json({ success: false, ...result });
      }
    } else {
      console.error("[DEBUG] DEPLOYMENT_RESULT not found in script output.");
      throw new Error('Could not parse deployment result from script output.');
    }
  } catch (error: any) {
    console.error('[DEBUG] Caught an error in the deployment handler:', error.message);
    res.status(500).json({
      error: 'Deployment execution failed',
      message: error.message,
      stdout: error.stdout, // Include captured output for debugging
      stderr: error.stderr,
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
        contracts: [],
        total_deployments: 0,
        message: 'No deployments found'
      });
    }

    const deploymentsContent = fs.readFileSync(deploymentsPath, 'utf8');
    
    // Updated regex to match the correct export pattern
    const match = deploymentsContent.match(/export const deployments: Record<string, DeploymentConfig> = ({[\s\S]*?});/);
    
    if (match) {
      try {
        // Parse the JSON structure safely
        const deployments = JSON.parse(match[1]);
        
        // Extract all contracts from the nested structure
        const contracts: any[] = [];
        let totalDeployments = 0;
        
        Object.keys(deployments).forEach(network => {
          const networkData = deployments[network];
          
          // Check if this is a direct deployment (has contractAddress at top level)
          if (networkData.contractAddress) {
            // Create a clean contract object without nested contracts
            const cleanContract = {
              contractAddress: networkData.contractAddress,
              network: networkData.network || network,
              blockNumber: networkData.blockNumber || 0,
              transactionHash: networkData.transactionHash || '',
              deployedAt: networkData.deployedAt || '',
              deployer: networkData.deployer || '',
              contractName: networkData.contractName || 'Main Contract',
              owner: networkData.owner || networkData.deployer || '',
              deploymentId: `${network}-main`
            };
            contracts.push(cleanContract);
            totalDeployments++;
          }
          
          // Check for nested contract deployments
          Object.keys(networkData).forEach(key => {
            const item = networkData[key];
            // If the item is an object with contractAddress, it's a nested deployment
            if (typeof item === 'object' && item && item.contractAddress && key !== 'contractAddress') {
              contracts.push({
                contractAddress: item.contractAddress,
                network: item.network || network,
                blockNumber: item.blockNumber || 0,
                transactionHash: item.transactionHash || '',
                deployedAt: item.deployedAt || '',
                deployer: item.deployer || '',
                contractName: item.contractName || key,
                owner: item.owner || item.deployer || '',
                deploymentId: `${network}-${key}`
              });
              totalDeployments++;
            }
          });
        });
        
        res.json({
          success: true,
          deployments: deployments,
          contracts: contracts,
          total_deployments: totalDeployments,
          networks: Object.keys(deployments),
          summary: {
            networks_with_deployments: Object.keys(deployments).length,
            total_contracts: contracts.length,
            latest_deployment: contracts.length > 0 ? 
              contracts.reduce((latest, current) => 
                new Date(current.deployedAt) > new Date(latest.deployedAt) ? current : latest
              ) : null
          }
        });
      } catch (parseError) {
        console.error('Error parsing deployments JSON:', parseError);
        res.status(500).json({
          success: false,
          error: 'Failed to parse deployments file',
          message: 'The deployments file contains invalid JSON structure'
        });
      }
    } else {
      res.json({
        deployments: {},
        contracts: [],
        total_deployments: 0,
        message: 'Could not parse deployments file - no valid export found'
      });
    }
  } catch (error: any) {
    console.error('Error reading deployments:', error);
    res.status(500).json({
      success: false,
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
    current_network: process.env.HARDHAT_NETWORK || "apothem",
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