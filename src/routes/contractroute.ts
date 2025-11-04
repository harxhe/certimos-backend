import {Router, Request, Response} from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import util from 'util';
import { exec, spawn} from 'child_process';
import { 
  generateCertificatesHandler, 
  autoMintCertificatesFromCSV,
  generateCertificatesFromCSV,
  parseRecipientsCSV
} from '../controllers/generateContractController.js';

// import { fetchcontract } from '../../scripts/deployments.js';
import { eventNames } from 'process';

const execAsync = util.promisify(exec);

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

// Separate multer configuration for image uploads (for single certificate minting)
const imageFileFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/') || 
      file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const imageUpload = multer({ 
  storage: storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Optional upload middleware - allows requests with or without files
const optionalImageUpload = multer({ 
  storage: storage,
  fileFilter: (req: any, file: any, cb: any) => {
    // Allow images or accept any file type (we'll handle it)
    if (file.mimetype.startsWith('image/') || 
        file.originalname.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const router = Router();

// Function to run the deploy.ts script
// (Multer configuration and other routes remain unchanged...)


// NEW: Prepare single certificate for frontend minting (with optional image upload)
router.post('/prepare-single-certificate', optionalImageUpload.single('certificateImage'), async (req: any, res: Response) => {
  try {
    console.log('Starting single certificate minting...');
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.get('content-type'));
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'No body');
    console.log('Raw body available:', !!req.rawBody);
    console.log('Multer processing complete');

    // Check if req.body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: 'Request body is missing. Please send form data or JSON data.',
        received_content_type: req.headers['content-type'],
        help: 'Use multipart/form-data for file uploads or application/json for JSON data'
      });
    }

    const {
      contractAddress,
      eventName,
      certificateName,
      recipientName,
      recipientWallet,
      description,
      category,
      rarity,
      points,
      skills,
      customAttributes
    } = req.body;

    console.log('Extracted fields:', {
      contractAddress,
      eventName,
      certificateName,
      recipientName,
      recipientWallet
    });

    // Validate required fields
    if (!contractAddress || !eventName || !certificateName || !recipientName || !recipientWallet) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['contractAddress', 'eventName', 'certificateName', 'recipientName', 'recipientWallet'],
        received: {
          contractAddress: !!contractAddress,
          eventName: !!eventName,
          certificateName: !!certificateName,
          recipientName: !!recipientName,
          recipientWallet: !!recipientWallet
        }
      });
    }

    // Handle certificate image (uploaded file or direct URL)
    let imageUrl = '';
    const directImageUrl = req.body.imageUrl;
    
    if (req.file) {
      console.log('Certificate image uploaded:', req.file.filename);
      // Use backend URL since uploads are served by backend
      const backendUrl = `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${backendUrl}/uploads/${req.file.filename}`;
    } else if (directImageUrl && directImageUrl.trim()) {
      console.log('Direct image URL provided:', directImageUrl);
      imageUrl = directImageUrl.trim();
    }

    // Create initial metadata for calculation
    const initialMetadata = {
      name: certificateName,
      description: description || `Certificate of achievement for ${recipientName}`,
      image: imageUrl || undefined,
      attributes: [
        { trait_type: "Event", value: eventName },
        { trait_type: "Recipient", value: recipientName },
        { trait_type: "Skills", value: skills || "" },
        { trait_type: "Issue Date", value: new Date().toISOString() }
      ]
    };

    // Simple points based on user-selected rarity
    let calculatedPoints = 0;
    let selectedRarity = rarity || 'Common'; // Use user-selected rarity
    let calculatedCategory = category || 'General';

    // Points based purely on rarity selection
    switch (selectedRarity.toLowerCase()) {
      case 'legendary':
        calculatedPoints = 500;
        break;
      case 'epic':
        calculatedPoints = 400;
        break;
      case 'rare':
        calculatedPoints = 300;
        break;
      case 'uncommon':
        calculatedPoints = 200;
        break;
      case 'common':
      default:
        calculatedPoints = 100;
        break;
    }

    // Prepare final certificate metadata with calculated values
    const certificateMetadata = {
      name: certificateName,
      description: description || `Certificate of achievement for ${recipientName}`,
      image: imageUrl || undefined,
      attributes: [
        { trait_type: "Event", value: eventName },
        { trait_type: "Recipient", value: recipientName },
        { trait_type: "Category", value: calculatedCategory },
        { trait_type: "Rarity", value: selectedRarity },
        { trait_type: "Points", value: calculatedPoints },
        { trait_type: "Skills", value: skills || "" },
        { trait_type: "Issue Date", value: new Date().toISOString() }
      ]
    };

    // Add custom attributes if provided
    if (customAttributes && customAttributes.trim()) {
      try {
        const customAttrs = JSON.parse(customAttributes);
        if (Array.isArray(customAttrs)) {
          certificateMetadata.attributes.push(...customAttrs);
        }
      } catch (e) {
        console.warn('Failed to parse custom attributes:', e);
      }
    }

    console.log('Uploading metadata to Pinata for frontend minting...');
    
    // Upload metadata to Pinata using inline function
    try {
      const pinataApiKey = process.env.API_Key;
      const pinataJWT = process.env.JWT;
      
      if (!pinataJWT) {
        throw new Error('Pinata JWT not configured');
      }

      // Upload JSON metadata to Pinata
      const formData = new FormData();
      const metadataBlob = new Blob([JSON.stringify(certificateMetadata, null, 2)], {
        type: 'application/json'
      });
      
      formData.append('file', metadataBlob, `${recipientName}-certificate.json`);
      formData.append('pinataMetadata', JSON.stringify({
        name: `${recipientName}-certificate.json`,
        keyvalues: {
          event: eventName,
          recipient: recipientName,
          type: 'certificate-metadata'
        }
      }));

      const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pinataJWT}`
        },
        body: formData
      });

      if (!pinataResponse.ok) {
        throw new Error(`Pinata upload failed: ${pinataResponse.statusText}`);
      }

      const pinataResult = await pinataResponse.json() as { IpfsHash: string };
      const pinataUri = `ipfs://${pinataResult.IpfsHash}`;
      
      console.log('Pinata Upload successful:', pinataUri);
      
      // Return data needed for frontend minting
      res.status(200).json({
        success: true,
        message: `Certificate metadata prepared successfully for ${recipientName}!`,
        certificateData: {
          recipientAddress: recipientWallet,
          tokenURI: pinataUri,
          metadata: certificateMetadata,
          contractAddress: contractAddress
        },
        uploadedImage: req.file ? {
          filename: req.file.filename,
          url: imageUrl,
          size: req.file.size
        } : null,
        pinataUri: pinataUri
      });
      
    } catch (pinataError) {
      console.error('Pinata upload failed:', pinataError);
      res.status(500).json({
        error: 'Failed to upload certificate metadata',
        details: pinataError instanceof Error ? pinataError.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('Error in single certificate minting:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Internal server error during certificate minting',
      details: error instanceof Error ? error.message : 'Unknown error',
      body_debug: req.body ? 'Body exists' : 'Body is undefined',
      headers_debug: req.headers['content-type']
    });
  }
});

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

    const contactName = req.body.contractName;
    const eventName = req.body.eventName;
    const certificateName = req.body.certificateName;
    const contractAddress = req.body.contractAddress;

    if (!contractAddress) {
      return res.status(400).json({
        error: 'Contract address is required. Please provide contractAddress.'
      });
    }

    console.log('Starting enhanced automatic certificate minting with IPFS/Pinata upload...');
    
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
        walletAddress: process.env.WALLET_ADDRESS,
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
  const { networkName, contractName, walletAddress } = req.body;
  console.log(`Deploying contract: ${contractName} on ${networkName}`);
  if (!networkName || !contractName || !walletAddress) {
    console.error("Validation failed: Missing required fields");
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['networkName', 'contractName', 'walletAddress'],
    });
  }

  process.env.WALLET_ADDRESS = walletAddress;



  const runDeployment = () => new Promise<string>((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'deploy.ts');
    const command = 'yarn';
    const args = ['hardhat', 'run', scriptPath, '--network', networkName];
    


    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONTRACT_NAME: contractName,
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
      console.log(`Deployment process completed with code ${code}`);
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

    
    const resultLine = fullOutput.split('\n').find(line => line.includes('DEPLOYMENT_RESULT:'));

    if (resultLine) {

      const result = JSON.parse(resultLine.replace('DEPLOYMENT_RESULT:', '').trim());
      
      if (result.success) {
        console.log("Contract deployed successfully");
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
    const { walletAddress } = req.query;

    
    const deploymentsPath = path.join(process.cwd(), 'scripts', 'deployments.ts');
    
    if (!fs.existsSync(deploymentsPath)) {
      return res.json({
        success: true,
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
            
            // Filter by wallet address if provided
            if (!walletAddress || (cleanContract.deployer && cleanContract.deployer.toLowerCase() === walletAddress.toString().toLowerCase())) {
              contracts.push(cleanContract);
              totalDeployments++;
            }
          }
          
          // Check for nested contract deployments
          Object.keys(networkData).forEach(key => {
            const item = networkData[key];
            // If the item is an object with contractAddress, it's a nested deployment
            if (typeof item === 'object' && item && item.contractAddress && key !== 'contractAddress') {
              const contract = {
                contractAddress: item.contractAddress,
                network: item.network || network,
                blockNumber: item.blockNumber || 0,
                transactionHash: item.transactionHash || '',
                deployedAt: item.deployedAt || '',
                deployer: item.deployer || '',
                contractName: item.contractName || key,
                owner: item.owner || item.deployer || '',
                deploymentId: `${network}-${key}`
              };
              
              // Filter by wallet address if provided
              if (!walletAddress || (contract.deployer && contract.deployer.toLowerCase() === walletAddress.toString().toLowerCase())) {
                contracts.push(contract);
                totalDeployments++;
              }
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

// Route to save deployment information from frontend
router.post('/save-deployment', async (req: Request, res: Response) => {
  const { contractAddress, network, transactionHash, deployedAt, deployer, contractName, owner } = req.body;
  console.log(`💾 Saving deployment: ${contractName} at ${contractAddress}`);  if (!contractAddress || !network || !deployer || !contractName) {
    console.error("[DEBUG] Validation failed: Missing required fields.");
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['contractAddress', 'network', 'deployer', 'contractName'],
    });
  }

  try {
    // Save deployment info using the utility function
    const { saveDeploymentInfo } = await import('../../scripts/deployment-utils.js');
    
    const deploymentInfo = {
      contractAddress,
      network,
      transactionHash: transactionHash || '',
      deployedAt: deployedAt || new Date().toISOString(),
      deployer,
      contractName,
      owner: owner || deployer
    };

    await saveDeploymentInfo(deploymentInfo);
    
    console.log("Deployment info saved successfully");
    res.json({
      success: true,
      message: 'Deployment information saved successfully!',
      deployment: deploymentInfo,
    });

  } catch (error: any) {
    console.error('[DEBUG] Error saving deployment info:', error.message);
    res.status(500).json({
      error: 'Failed to save deployment information',
      message: error.message,
    });
  }
});

// OLD: Backend minting route (kept for backward compatibility)
router.post('/mint-single-certificate', optionalImageUpload.single('certificateImage'), async (req: any, res: Response) => {
  try {
    console.log('Using deprecated backend minting. Consider using /prepare-single-certificate instead.');
    console.log('Starting single certificate minting...');
    console.log('Request headers:', req.headers);
    console.log('Content-Type:', req.get('content-type'));
    console.log('Request body:', req.body);
    console.log('Uploaded file:', req.file);
    console.log('Request body type:', typeof req.body);
    console.log('Request body keys:', req.body ? Object.keys(req.body) : 'No body');
    console.log('Raw body available:', !!req.rawBody);
    console.log('Multer processing complete');

    // Check if req.body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        error: 'Request body is missing. Please send form data or JSON data.',
        received_content_type: req.headers['content-type'],
        help: 'Use multipart/form-data for file uploads or application/json for JSON data'
      });
    }

    const {
      contractAddress,
      eventName,
      certificateName,
      recipientName,
      recipientWallet,
      description,
      category,
      rarity,
      points,
      skills,
      customAttributes
    } = req.body;

    console.log('Extracted fields:', {
      contractAddress,
      eventName,
      certificateName,
      recipientName,
      recipientWallet
    });

    // Validate required fields
    if (!contractAddress || !eventName || !certificateName || !recipientName || !recipientWallet) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['contractAddress', 'eventName', 'certificateName', 'recipientName', 'recipientWallet'],
        received: {
          contractAddress: !!contractAddress,
          eventName: !!eventName,
          certificateName: !!certificateName,
          recipientName: !!recipientName,
          recipientWallet: !!recipientWallet
        }
      });
    }

    // Handle certificate image (uploaded file or direct URL)
    let imageUrl = '';
    const directImageUrl = req.body.imageUrl;
    
    if (req.file) {
      // Image was uploaded - you can process it here
      console.log('Certificate image uploaded:', req.file.filename);
      // Use full backend URL since uploads are served by backend
      const backendUrl = `http://localhost:${process.env.PORT || 5000}`;
      imageUrl = `${backendUrl}/uploads/${req.file.filename}`;
    } else if (directImageUrl && directImageUrl.trim()) {
      console.log('Direct image URL provided:', directImageUrl);
      imageUrl = directImageUrl.trim();
    }

    // Create temporary CSV for single recipient
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const csvContent = `participant_name,wallet_address\n${recipientName},${recipientWallet}`;
    const csvFile = path.join(tempDir, `single-recipient-${Date.now()}.csv`);
    fs.writeFileSync(csvFile, csvContent);

    // Call the auto-minting function with the temporary CSV
    const result = await autoMintCertificatesFromCSV(
      csvFile, 
      contractAddress, 
      eventName, 
      certificateName
    );

    // Clean up temporary CSV
    if (fs.existsSync(csvFile)) {
      fs.unlinkSync(csvFile);
    }

    if (result.success) {
      res.status(200).json({
        message: `Certificate minted successfully for ${recipientName}!`,
        result: result.results && result.results.length > 0 ? result.results[0] : null,
        uploadedImage: req.file ? {
          filename: req.file.filename,
          url: imageUrl,
          size: req.file.size
        } : null
      });
    } else {
      res.status(500).json({
        error: result.error || 'Failed to mint certificate'
      });
    }

  } catch (error) {
    console.error('Single certificate minting error:', error);
    
    // Clean up uploaded file if there was an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      error: 'Something went wrong!',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get contract ABI for frontend minting
router.get('/contract-abi', (req: Request, res: Response) => {
  // Certificate contract ABI for frontend minting
  const contractABI = [
    {
      "inputs": [
        { "internalType": "address", "name": "initialOwner", "type": "address" }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [
        { "internalType": "address", "name": "recipient", "type": "address" },
        { "internalType": "string", "name": "tokenURI_", "type": "string" }
      ],
      "name": "mintCertificate",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
      ],
      "name": "tokenURI",
      "outputs": [
        { "internalType": "string", "name": "", "type": "string" }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        { "internalType": "address", "name": "", "type": "address" }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];

  res.json({
    success: true,
    contractABI: contractABI,
    functions: {
      mint: "mintCertificate(address recipient, string tokenURI_)",
      owner: "owner()",
      tokenURI: "tokenURI(uint256 tokenId)"
    },
    usage: "Use this ABI with ethers.js to interact with certificate contracts from the frontend"
  });
});

export default router;
