import { Request, Response } from "express";
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { network } from 'hardhat';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
 
interface RecipientData {
  name: string;
  walletAddress: string;
  email?: string;
  course?: string;
  completionDate?: string;
}

interface CertificateMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  event_name?: string;
  recipient_name?: string;
  date_issued?: string;
  certificate_id?: string;
}

interface GeneratedCertificate {
  recipient: RecipientData;
  metadata: CertificateMetadata;
  tokenId?: number;
  ipfsUri?: string;
}

interface MintingResult {
  success: boolean;
  recipient: RecipientData;
  transactionHash?: string;
  error?: string;
  certificateType?: string;
  pinataUri?: string;
}

// Function to upload metadata to Pinata using existing script logic
async function uploadToPinata(metadata: CertificateMetadata, filename: string): Promise<string> {
  try {
    const PINATA_API_KEY = process.env.API_Key;
    const PINATA_SECRET_KEY = process.env.API_Secret;
    
    if (!PINATA_API_KEY || !PINATA_SECRET_KEY) {
      throw new Error('Pinata credentials not found in environment variables');
    }

    const metadataContent = JSON.stringify(metadata, null, 2);
    
    const formData = new FormData();
    const blob = new Blob([metadataContent], { type: 'application/json' });
    formData.append('file', blob, filename);
    
    const pinataMetadata = JSON.stringify({
      name: metadata.name || filename,
      keyvalues: {
        type: 'certificate-metadata',
        recipient: metadata.recipient_name || 'unknown',
        event: metadata.event_name || 'Certificate',
        date: metadata.date_issued || new Date().toISOString()
      }
    });
    
    formData.append('pinataMetadata', pinataMetadata);

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json() as { IpfsHash: string };
      const ipfsUri = `ipfs://${result.IpfsHash}`;
      console.log(`✅ Pinata Upload successful: ${ipfsUri}`);
      return ipfsUri;
    } else {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }
  } catch (error) {
    console.error('❌ Pinata upload failed:', error);
    throw new Error(`Pinata upload failed: ${error}`);
  }
}

// Function to get deployed contract address for current network
async function getDeployedContractAddress(): Promise<string | null> {
  try {
    const networkName = process.env.HARDHAT_NETWORK || "apothem";

    console.log("the network is:", networkName);

    const { deployments } = await import('../../scripts/deployments.js');

    const contractAddressFromDeployments = deployments[networkName]?.contractAddress;

    // Try to import deployments
    // const deploymentsPath = path.join(process.cwd(), 'scripts', 'deployments.js');
    if (contractAddressFromDeployments) {
      console.log(`✅ Found deployment for network: ${networkName} at address ${contractAddressFromDeployments}`);
      return contractAddressFromDeployments;
    }
    return null;
  } catch (error) {
    console.log('Error loading deployments:', error);
    return null;
  }
}

// Function to parse CSV file and extract recipient data
export async function parseRecipientsCSV(csvFile: string): Promise<RecipientData[]> {
  return new Promise((resolve, reject) => {
    const recipients: RecipientData[] = [];
    
    if (!fs.existsSync(csvFile)) {
      reject(new Error(`CSV file not found: ${csvFile}`));
      return;
    }

    // Read CSV file manually (simple CSV parsing)
    const csvContent = fs.readFileSync(csvFile, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      reject(new Error('CSV file must have at least a header row and one data row'));
      return;
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Validate required columns
    const nameIndex = headers.findIndex(h => h.includes('name'));
    const addressIndex = headers.findIndex(h => h.includes('address') || h.includes('wallet'));
    
    if (nameIndex === -1 || addressIndex === -1) {
      reject(new Error('CSV must contain "name" and "wallet address" columns'));
      return;
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length < 2) continue; // Skip incomplete rows
      
      const name = values[nameIndex];
      const walletAddress = values[addressIndex];
      
      if (!name || !walletAddress) continue; // Skip rows with missing required data
      
      // Validate wallet address format
      if (!ethers.isAddress(walletAddress)) {
        console.warn(`Invalid wallet address for ${name}: ${walletAddress}`);
        continue;
      }

      recipients.push({
        name,
        walletAddress,
        email: values[headers.findIndex(h => h.includes('email'))] || undefined,
        course: values[headers.findIndex(h => h.includes('course'))] || undefined,
        completionDate: values[headers.findIndex(h => h.includes('date'))] || undefined,
      });
    }

    resolve(recipients);
  });
}

// Function to generate metadata for all recipients
export async function generateCertificatesFromCSV(
  csvFile: string,
  certificateTemplate: {
    name: string;
    description: string;
    image: string;
    eventName: string;
    level: string;
    skills: string[];
  }
): Promise<GeneratedCertificate[]> {
  try {
    console.log('📁 Reading recipients from CSV...');
    const recipients = await parseRecipientsCSV(csvFile);
    
    console.log(`👥 Found ${recipients.length} recipients`);
    
    const certificates: GeneratedCertificate[] = [];
    
    // Create metadata directory if it doesn't exist
    const metadataDir = path.join(process.cwd(), 'metadata');
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
    }

    recipients.forEach((recipient, index) => {
      const metadata: CertificateMetadata = {
        name: `${certificateTemplate.name} - ${recipient.name}`,
        description: certificateTemplate.description,
        image: certificateTemplate.image,
        event_name: certificateTemplate.eventName,
        recipient_name: recipient.name,
        date_issued: recipient.completionDate || new Date().toISOString().split('T')[0],
        certificate_id: `CERT-${Date.now()}-${index + 1}`,
        attributes: [
          {
            trait_type: "Event",
            value: certificateTemplate.eventName
          },
          {
            trait_type: "Recipient",
            value: recipient.name
          },
          {
            trait_type: "Date Issued",
            value: recipient.completionDate || new Date().toISOString().split('T')[0]
          },
          {
            trait_type: "Level",
            value: certificateTemplate.level
          },
          {
            trait_type: "Certificate ID",
            value: `CERT-${Date.now()}-${index + 1}`
          },
          {
            trait_type: "Wallet Address",
            value: recipient.walletAddress
          }
        ]
      };

      // Add skills as attributes
      certificateTemplate.skills.forEach((skill, skillIndex) => {
        metadata.attributes.push({
          trait_type: `Skill ${skillIndex + 1}`,
          value: skill
        });
      });

      // Add optional attributes
      if (recipient.email) {
        metadata.attributes.push({
          trait_type: "Email",
          value: recipient.email
        });
      }

      if (recipient.course) {
        metadata.attributes.push({
          trait_type: "Course",
          value: recipient.course
        });
      }

      // Save metadata to file
      const filename = `certificate-${recipient.name.replace(/\s+/g, '-').toLowerCase()}-${index + 1}.json`;
      const filepath = path.join(metadataDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));
      console.log(`✅ Generated metadata: ${filename}`);

      certificates.push({
        recipient,
        metadata
      });
    });

    console.log(`\n📁 ${certificates.length} metadata files saved in: ${metadataDir}`);
    
    return certificates;
    
  } catch (error) {
    console.error('❌ Error generating certificates from CSV:', error);
    throw error;
  }
}

// Express route handler for generating certificates from CSV
export async function generateCertificatesHandler(req: Request, res: Response) {
  try {
    const { 
      csvFile, 
      certificateName, 
      description, 
      imageUrl, 
      eventName, 
      level, 
      skills 
    } = req.body;

    // Validate required fields
    if (!csvFile || !certificateName || !eventName) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['csvFile', 'certificateName', 'eventName']
      });
    }

    // Create certificate template
    const template = {
      name: certificateName,
      description: description || `Certificate for completing ${eventName}`,
      image: imageUrl || 'https://example.com/certificate-placeholder.png',
      eventName,
      level: level || 'Intermediate',
      skills: skills || []
    };

    const certificates = await generateCertificatesFromCSV(csvFile, template);

    res.json({
      success: true,
      message: `Generated ${certificates.length} certificates`,
      certificates: certificates.map(cert => ({
        recipientName: cert.recipient.name,csvFile,
        walletAddress: cert.recipient.walletAddress,
        certificateId: cert.metadata.certificate_id
      }))
    });

  } catch (error: any) {
    console.error('Error in generateCertificatesHandler:', error);
    res.status(500).json({
      error: 'Failed to generate certificates',
      message: error.message
    });
  }
}

// New function to automatically mint certificates from CSV without confirmation
export async function autoMintCertificatesFromCSV(csvFile: string): Promise<{
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failCount: number;
  results: MintingResult[];
  contractAddress?: string;
  error?: string;
}> {
  try {
    console.log('🎫 Starting automatic CSV certificate minting...');
    
    // 1. Parse CSV file
    const recipients = await parseRecipientsCSV(csvFile);
    console.log(`📊 Loaded ${recipients.length} recipients from CSV`);
    
    if (recipients.length === 0) {
      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failCount: 0,
        results: [],
        error: 'No valid recipients found in CSV file'
      };
    }

    // 2. Get contract address
    let contractAddress = await getDeployedContractAddress();
    
    if (!contractAddress) {
      // Fallback to environment variable or hardcoded address
      throw new Error('Contract address not found in deployments or environment variables');
    } else {
      console.log('✅ Using contract address from deployments');
    }

    console.log(`🔗 Contract Address: ${contractAddress}`);

    // 3. Connect to blockchain network
    const { ethers: ethersHardhat } = await network.connect();
    const [signer] = await ethersHardhat.getSigners();
    console.log(`💳 Minting with account: ${signer.address}`);

    // 4. Load available certificate templates for matching
    let availableCertificates: any[] = [];
    try {
      const metadataPath = path.join(process.cwd(), 'scripts', 'uploaded-metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
        availableCertificates = JSON.parse(metadataContent);
        console.log(`📄 Found ${availableCertificates.length} certificate templates`);
      }
    } catch (error) {
      console.log('⚠️  Could not load certificate templates');
    }

    // 5. Set up contract connection
    const certificateABI = [
      "function mintCertificate(address to, string memory tokenURI) public returns (uint256)",
      "function owner() public view returns (address)",
      "function getAddress() public view returns (address)"
    ];
    
    const certificate = new ethersHardhat.Contract(contractAddress, certificateABI, signer);
    
    // 6. Verify contract connection
    try {
      const actualAddress = await certificate.getAddress();
      const owner = await certificate.owner();
      console.log(`📍 Contract Address: ${actualAddress}`);
      console.log(`👑 Contract Owner: ${owner}`);
    } catch (error) {
      console.log('⚠️  Could not verify contract details');
    }

    // 7. Process each recipient
    const results: MintingResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      console.log(`\n[${i + 1}/${recipients.length}] Processing ${recipient.name}...`);
      
      try {
        // Create certificate metadata
        const metadata: CertificateMetadata = {
          name: `Certificate of Completion - ${recipient.name}`,
          description: `This certificate is awarded to ${recipient.name} for successfully completing the course${recipient.course ? `: ${recipient.course}` : ''}.`,
          image: "https://gateway.pinata.cloud/ipfs/QmYourImageHash", // Replace with actual certificate image
          event_name: recipient.course || "Course Completion",
          recipient_name: recipient.name,
          date_issued: recipient.completionDate || new Date().toISOString().split('T')[0],
          certificate_id: `CERT-${Date.now()}-${i + 1}`,
          attributes: [
            {
              trait_type: "Event",
              value: recipient.course || "Course Completion"
            },
            {
              trait_type: "Recipient",
              value: recipient.name
            },
            {
              trait_type: "Date Issued",
              value: recipient.completionDate || new Date().toISOString().split('T')[0]
            },
            {
              trait_type: "Certificate ID",
              value: `CERT-${Date.now()}-${i + 1}`
            },
            {
              trait_type: "Wallet Address",
              value: recipient.walletAddress
            }
          ]
        };

        // Add optional attributes
        if (recipient.email) {
          metadata.attributes.push({
            trait_type: "Email",
            value: recipient.email
          });
        }

        const filename = `certificate-${recipient.name.replace(/\s+/g, '-').toLowerCase()}-${i + 1}.json`;
        
        // Upload metadata to Pinata
        console.log(`📤 Uploading metadata to Pinata for ${recipient.name}...`);
        const pinataUri = await uploadToPinata(metadata, filename);
        
        console.log(`✅ Metadata uploaded successfully!`);
        console.log(`   Pinata URI: ${pinataUri}`);

        // Mint certificate with uploaded metadata
        console.log(`🎫 Minting certificate for ${recipient.name}...`);
        console.log(`   Address: ${recipient.walletAddress}`);
        console.log(`   Token URI: ${pinataUri}`);
        
        const tx = await certificate.mintCertificate(
          recipient.walletAddress,
          pinataUri
        );
        
        console.log(`📝 Transaction Hash: ${tx.hash}`);
        console.log(`⏳ Waiting for confirmation...`);
        
        await tx.wait();
        
        console.log(`✅ Certificate minted successfully!`);
        
        results.push({
          success: true,
          recipient,
          transactionHash: tx.hash,
          certificateType: recipient.course || "Course Completion",
          pinataUri: pinataUri
        });
        
        successCount++;
        
      } catch (error: any) {
        console.error(`❌ Failed to process certificate for ${recipient.name}:`, error.message);
        
        results.push({
          success: false,
          recipient,
          error: error.message,
          certificateType: recipient.course || "Unknown"
        });
        
        failCount++;
      }
    }

    console.log('\n--- Minting Complete ---');
    console.log(`✅ Successfully minted: ${successCount} certificates`);
    console.log(`❌ Failed to mint: ${failCount} certificates`);
    console.log(`📊 Total processed: ${recipients.length} recipients`);

    return {
      success: true,
      totalProcessed: recipients.length,
      successCount,
      failCount,
      results,
      contractAddress
    };

  } catch (error: any) {
    console.error('Error in autoMintCertificatesFromCSV:', error);
    return {
      success: false,
      totalProcessed: 0,
      successCount: 0,
      failCount: 0,
      results: [],
      error: error.message
    };
  }
}


