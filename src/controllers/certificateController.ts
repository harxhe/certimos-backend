import { Request, Response } from 'express';
import { ethers } from 'ethers';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

interface CertificateData {
  tokenId: string;
  owner: string;
  tokenURI: string;
  name: string;
  description: string;
  image: string | null;
  attributes: any[];
  metadata?: any;
  points: number;
  rarity: string;
  category: string;
}

interface CertificateResponse {
  success: boolean;
  walletAddress: string;
  certificates: CertificateData[];
  count: number;
  balance: string;
  network: string;
  contractAddress: string | undefined;
  totalPoints: number;
  valueBreakdown: {
    totalCertificates: number;
    totalPoints: number;
    averagePoints: number;
    rarityDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
  };
}

dotenv.config();

// Load the contract ABI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find project root by looking for artifacts directory
let projectRoot = __dirname;

while (true) {
  const artifactsPath = path.join(projectRoot, 'artifacts');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  // Check if both artifacts directory and package.json exist
  if (fs.existsSync(artifactsPath) && fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Verify this is our backend package.json with artifacts
      if (packageJson.name === 'certimos-backend') {
        break;
      }
    } catch (error) {
      // Continue searching if package.json is invalid
    }
  }
  
  const parentDir = path.resolve(projectRoot, '..');
  
  if (parentDir === projectRoot) {
    // Reached the root directory without finding artifacts
    throw new Error('Could not find project root with artifacts directory');
  }
  projectRoot = parentDir;
}

const contractArtifactPath = path.join(projectRoot, 'artifacts', 'contracts', 'Certificate.sol', 'Certificate.json');
let contractABI: any;

try {
  const contractArtifact = JSON.parse(fs.readFileSync(contractArtifactPath, 'utf8'));
  contractABI = contractArtifact.abi;
} catch (error) {
  console.error('Error loading contract ABI:', error);
  console.error('Tried path:', contractArtifactPath);
  throw new Error('Contract ABI not found');
}

export class CertificateController {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractWithSigner: ethers.Contract | null = null;
  private currentContractAddress: string | null = null;

  private initializeContract(contractAddress?: string) {
    // Contract address must be provided - no defaults in dynamic system
    if (!contractAddress) {
      throw new Error('Contract address is required for initialization');
    }
    const targetContractAddress = contractAddress;
    
    if (!this.provider || !this.contract || this.currentContractAddress !== targetContractAddress) {
      console.log('Initializing blockchain connection...');
      console.log('Target Contract Address:', targetContractAddress);
      console.log('🌐 APOTHEM_RPC_URL:', process.env.APOTHEM_RPC_URL);
      
      if (!process.env.APOTHEM_RPC_URL) {
        throw new Error('APOTHEM_RPC_URL environment variable is not set');
      }
      
      this.provider = new ethers.JsonRpcProvider(process.env.APOTHEM_RPC_URL);
      this.contract = new ethers.Contract(
        targetContractAddress,
        contractABI,
        this.provider
      );
      
      this.currentContractAddress = targetContractAddress;
      console.log('Blockchain connection initialized successfully');
    }
  }

  private initializeContractWithSigner(contractAddress?: string) {
    const targetContractAddress = contractAddress || this.currentContractAddress;
    if (!targetContractAddress) {
      throw new Error('Contract address is required for transaction initialization');
    }
    
    if (!this.contractWithSigner || !this.wallet || this.currentContractAddress !== targetContractAddress) {
      console.log('Initializing contract with signer for transactions...');
      
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY environment variable is not set');
      }
      
      this.initializeContract(contractAddress); // Ensure provider and contract are initialized with the right address
      
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider!);
      this.contractWithSigner = new ethers.Contract(
        targetContractAddress,
        contractABI,
        this.wallet
      );
      
      console.log('Contract with signer initialized successfully');
      console.log('🔑 Signer address:', this.wallet.address);
    }
  }

  // Certificate valuation logic - Simple rarity-based system
  private calculateCertificateValue(tokenId: number, metadata: any, tokenURI: string, userProvidedRarity?: string): { points: number; rarity: string; category: string } {
    let points = 0;
    let rarity = 'Common';
    let category = 'General';

    // Check if rarity and points are stored in metadata attributes (from new certificates)
    if (metadata && metadata.attributes && Array.isArray(metadata.attributes)) {
      // Look for rarity and points in attributes
      for (const attr of metadata.attributes) {
        if (attr.trait_type === 'Rarity' && attr.value) {
          rarity = attr.value;
        }
        if (attr.trait_type === 'Points' && attr.value) {
          points = parseInt(attr.value) || 0;
        }
        if (attr.trait_type === 'Category' && attr.value) {
          category = attr.value;
        }
      }
    }

    // If no points found in metadata, calculate based on rarity
    if (points === 0) {
      switch (rarity.toLowerCase()) {
        case 'legendary':
          points = 500;
          break;
        case 'epic':
          points = 400;
          break;
        case 'rare':
          points = 300;
          break;
        case 'uncommon':
          points = 200;
          break;
        case 'common':
        default:
          points = 100;
          break;
      }
    }

    // Use user-provided rarity if available (for backward compatibility)
    if (userProvidedRarity) {
      rarity = userProvidedRarity;
      // Recalculate points for user-provided rarity
      switch (userProvidedRarity.toLowerCase()) {
        case 'legendary':
          points = 500;
          break;
        case 'epic':
          points = 400;
          break;
        case 'rare':
          points = 300;
          break;
        case 'uncommon':
          points = 200;
          break;
        case 'common':
        default:
          points = 100;
          break;
      }
    }

    return { points, rarity, category };
  }

  // Get all certificates for a wallet
  async getUserCertificates(req: Request, res: Response) {
  try {
    const { walletAddress } = req.params;
    
    console.log(`Fetching certificates for wallet: ${walletAddress}`);
    
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid wallet address format' 
      });
    }

    this.initializeContract('0x9b40c3c0656434fd89bC50671a29d1814EDA8079'); // Use default contract for backwards compatibility

    // Early exit if no certificates
    const balance = await this.contract!.balanceOf(walletAddress);
    const balanceNum = parseInt(balance.toString());
    
    console.log(`Wallet balance: ${balanceNum} certificates`);
    
    if (balanceNum === 0) {
      return res.json({
        success: true,
        walletAddress,
        certificates: [],
        count: 0,
        balance: '0',
        network: 'XDC Apothem',
        contractAddress: this.currentContractAddress || 'Dynamic - multiple contracts supported',
        totalPoints: 0,
        valueBreakdown: {
          totalCertificates: 0,
          totalPoints: 0,
          averagePoints: 0,
          rarityDistribution: {},
          categoryDistribution: {}
        }
      });
    }

    const certificates: CertificateData[] = [];
    const maxTokensToCheck = Math.min(50, balanceNum * 5); // Reduce from 200 to 50
    const batchSize = 3; // Reduce from 5 to 3
    
    console.log(`🔄 Checking up to ${maxTokensToCheck} tokens in batches of ${batchSize}`);
    
    // Process in parallel batches with better error handling
    for (let i = 0; i < maxTokensToCheck; i += batchSize) {
      const tokenPromises: Promise<CertificateData | null>[] = [];
      
      for (let tokenId = i; tokenId < Math.min(i + batchSize, maxTokensToCheck); tokenId++) {
        tokenPromises.push(this.checkTokenOwnership(tokenId, walletAddress));
      }
      
      try {
        const batchResults = await Promise.allSettled(tokenPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            certificates.push(result.value);
            console.log(`✅ Found certificate: Token ${i + index}`);
          } else if (result.status === 'rejected') {
            console.warn(`⚠️ Failed to check token ${i + index}:`, result.reason);
          }
        });
      } catch (batchError) {
        console.error(`❌ Batch error for tokens ${i}-${i + batchSize - 1}:`, batchError);
        continue; // Continue with next batch
      }

      // Early exit when found all certificates
      if (certificates.length >= balanceNum) {
        console.log(`✅ Found all ${balanceNum} certificates, stopping search`);
        break;
      }
      
      // Add small delay between batches to avoid overwhelming the RPC
      if (i + batchSize < maxTokensToCheck) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculate total points and value breakdown
    const totalPoints = certificates.reduce((sum, cert) => sum + cert.points, 0);
    const averagePoints = certificates.length > 0 ? Math.round(totalPoints / certificates.length) : 0;
    
    // Calculate distributions
    const rarityDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    
    certificates.forEach(cert => {
      rarityDistribution[cert.rarity] = (rarityDistribution[cert.rarity] || 0) + 1;
      categoryDistribution[cert.category] = (categoryDistribution[cert.category] || 0) + 1;
    });

    const result: CertificateResponse = {
      success: true,
      walletAddress,
      certificates,
      count: certificates.length,
      balance: balance.toString(),
      network: 'XDC Apothem',
      contractAddress: this.currentContractAddress || 'Dynamic - multiple contracts supported',
      totalPoints,
      valueBreakdown: {
        totalCertificates: certificates.length,
        totalPoints,
        averagePoints,
        rarityDistribution,
        categoryDistribution
      }
    };

    console.log(`✅ Successfully fetched ${certificates.length} certificates with ${totalPoints} total points`);
    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching certificates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch certificates',
      message: error instanceof Error ? error.message : 'Internal server error'
    });  
  }
}

  // Helper method to fix localhost image URLs
  private fixImageUrl(imageUrl: string | null): string | null {
    if (!imageUrl) return null;
    
    // Fix localhost:3000 URLs to use backend port
    if (imageUrl.includes('localhost:3000/uploads/')) {
      const backendUrl = `http://localhost:${process.env.PORT || 5000}`;
      return imageUrl.replace('http://localhost:3000', backendUrl);
    }
    
    return imageUrl;
  }

  // Check token ownership with a specific contract instance (for multi-contract support)
  async checkTokenOwnershipWithContract(contract: ethers.Contract, tokenId: number, walletAddress: string, contractAddress: string): Promise<CertificateData | null> {
    try {
      const owner = await contract.ownerOf(tokenId);
      
      if (owner.toLowerCase() === walletAddress.toLowerCase()) {
        let tokenURI = '';
        let metadata = null;
        
        try {
          tokenURI = await contract.tokenURI(tokenId);
          
          // Try to fetch metadata with timeout
          if (tokenURI) {
            if (tokenURI.startsWith('http')) {
              try {
                const response = await axios.get(tokenURI, {
                  timeout: 3000,
                  headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Certimos-Backend/1.0'
                  }
                });
                
                metadata = response.data;
              } catch (axiosError) {
                const errorMessage = axiosError instanceof Error ? axiosError.message : 'Unknown error';
                console.warn(`Metadata fetch timeout/error for token ${tokenId}:`, errorMessage);
              }
            } else if (tokenURI.startsWith('ipfs://')) {
              // Handle IPFS URLs with multiple gateway fallbacks
              const ipfsHash = tokenURI.replace('ipfs://', '');
              const ipfsGateways = [
                `https://ipfs.io/ipfs/${ipfsHash}`,
                `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
                `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
              ];
              
              for (const gateway of ipfsGateways) {
                try {
                  const response = await axios.get(gateway, {
                    timeout: 8000,
                    headers: {
                      'Accept': 'application/json',
                      'User-Agent': 'Certimos-Backend/1.0'
                    }
                  });
                  
                  metadata = response.data;
                  console.log(`✅ Successfully fetched IPFS metadata for token ${tokenId} from ${gateway}`);
                  break; // Exit loop on success
                } catch (axiosError) {
                  const errorMessage = axiosError instanceof Error ? axiosError.message : 'Unknown error';
                  console.warn(`IPFS fetch failed from ${gateway} for token ${tokenId}: ${errorMessage}`);
                  // Continue to next gateway
                }
              }
            } else if (tokenURI.startsWith('data:application/json')) {
              const base64Data = tokenURI.split(',')[1];
              const jsonString = Buffer.from(base64Data, 'base64').toString();
              metadata = JSON.parse(jsonString);
            }
          }
        } catch (uriError) {
          const errorMessage = uriError instanceof Error ? uriError.message : 'Unknown error';
          console.warn(`Could not get URI/metadata for token ${tokenId}:`, errorMessage);
        }

        // Calculate certificate value
        const valuation = this.calculateCertificateValue(tokenId, metadata, tokenURI);

        return {
          tokenId: tokenId.toString(),
          owner,
          tokenURI,
          metadata,
          name: metadata?.name || `Certificate #${tokenId}`,
          description: metadata?.description || 'Certificate NFT',
          image: this.fixImageUrl(metadata?.image || null),
          attributes: metadata?.attributes || [],
          points: valuation.points,
          rarity: valuation.rarity,
          category: valuation.category
        };
      }
      
      return null;
    } catch (error) {
      // Token doesn't exist or other error - this is normal
      return null;
    }
  }

  async checkTokenOwnership(tokenId: number, walletAddress: string): Promise<CertificateData | null> {
  try {
    const owner = await this.contract!.ownerOf(tokenId);
    
    if (owner.toLowerCase() === walletAddress.toLowerCase()) {
      let tokenURI = '';
      let metadata = null;
      
      try {
        tokenURI = await this.contract!.tokenURI(tokenId);
        
        // Try to fetch metadata with timeout
        if (tokenURI) {
          if (tokenURI.startsWith('http')) {
            try {
              const response = await axios.get(tokenURI, {
                timeout: 3000,
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Certimos-Backend/1.0'
                }
              });
              
              metadata = response.data;
            } catch (axiosError) {
              const errorMessage = axiosError instanceof Error ? axiosError.message : 'Unknown error';
              console.warn(`Metadata fetch timeout/error for token ${tokenId}:`, errorMessage);
            }
          } else if (tokenURI.startsWith('ipfs://')) {
            // Handle IPFS URLs with multiple gateway fallbacks
            const ipfsHash = tokenURI.replace('ipfs://', '');
            const ipfsGateways = [
              `https://ipfs.io/ipfs/${ipfsHash}`,
              `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
              `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`
            ];
            
            for (const gateway of ipfsGateways) {
              try {
                const response = await axios.get(gateway, {
                  timeout: 8000,
                  headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Certimos-Backend/1.0'
                  }
                });
                
                metadata = response.data;
                console.log(`✅ Successfully fetched IPFS metadata for token ${tokenId} from ${gateway}`);
                break; // Exit loop on success
              } catch (axiosError) {
                const errorMessage = axiosError instanceof Error ? axiosError.message : 'Unknown error';
                console.warn(`IPFS fetch failed from ${gateway} for token ${tokenId}: ${errorMessage}`);
                // Continue to next gateway
              }
            }
          } else if (tokenURI.startsWith('data:application/json')) {
            const base64Data = tokenURI.split(',')[1];
            const jsonString = Buffer.from(base64Data, 'base64').toString();
            metadata = JSON.parse(jsonString);
          }
        }
      } catch (uriError) {
        const errorMessage = uriError instanceof Error ? uriError.message : 'Unknown error';
        console.warn(`Could not get URI/metadata for token ${tokenId}:`, errorMessage);
      }

      // Calculate certificate value
      const valuation = this.calculateCertificateValue(tokenId, metadata, tokenURI);

      return {
        tokenId: tokenId.toString(),
        owner,
        tokenURI,
        metadata,
        name: metadata?.name || `Certificate #${tokenId}`,
        description: metadata?.description || 'Certificate NFT',
        image: this.fixImageUrl(metadata?.image || null),
        attributes: metadata?.attributes || [],
        points: valuation.points,
        rarity: valuation.rarity,
        category: valuation.category
      };
    }
    
    return null;
  } catch (error) {
    // Token doesn't exist or other error - this is normal
    return null;
  }
}

  // Get total supply of certificates for a user
  async getUserCertificateCount(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;
      
      // Validate wallet address format
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }

      this.initializeContract('0x9b40c3c0656434fd89bC50671a29d1814EDA8079'); // Use default contract for backwards compatibility

      // Count certificates owned by the user
      const balance = await this.contract!.balanceOf(walletAddress);
      let certificateCount = 0;
      const maxTokensToCheck = 100;
      
      for (let tokenId = 0; tokenId < maxTokensToCheck; tokenId++) {
        try {
          const owner = await this.contract!.ownerOf(tokenId);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            certificateCount++;
          }
        } catch (tokenError) {
          // Token doesn't exist, continue
        }
      }
      
      // Quick points calculation for count endpoint
      let totalPoints = 0;
      for (let tokenId = 0; tokenId < maxTokensToCheck; tokenId++) {
        try {
          const owner = await this.contract!.ownerOf(tokenId);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            // Quick valuation without metadata fetch (for performance)
            const quickValuation = this.calculateCertificateValue(tokenId, null, '');
            totalPoints += quickValuation.points;
          }
        } catch (tokenError) {
          // Token doesn't exist, continue
        }
      }

      res.json({
        success: true,
        totalSupply: certificateCount,
        totalPoints,
        walletAddress,
        contractAddress: this.currentContractAddress || 'Dynamic - multiple contracts supported'
      });
    } catch (error) {
      console.error('❌ Error getting user certificate count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get certificate count for user'
      });
    }
  }

  // Mint a single certificate
  async mintCertificate(req: Request, res: Response) {
    try {
      const { 
        recipientAddress, 
        name, 
        description, 
        attributes, 
        rarity, 
        category, 
        points, 
        skills, 
        level, 
        eventName, 
        certificateName,
        customAttributes,
        contractAddress // Optional contract address
      } = req.body;

      // Handle uploaded image file
      let imageUrl = null;
      if (req.file) {
        // Use full backend URL since uploads are served by backend
        const backendUrl = `http://localhost:${process.env.PORT || 5000}`;
        imageUrl = `${backendUrl}/uploads/${req.file.filename}`;
      }

      // Parse custom attributes if provided
      let parsedCustomAttributes = [];
      if (customAttributes) {
        try {
          parsedCustomAttributes = JSON.parse(customAttributes);
        } catch (error) {
          console.log('Invalid custom attributes format, using empty array');
        }
      }

      // Parse existing attributes if provided
      let parsedAttributes = [];
      if (attributes) {
        try {
          parsedAttributes = JSON.parse(attributes);
        } catch (error) {
          console.log('Invalid attributes format, using empty array');
        }
      }

      // Combine all attributes
      const allAttributes = [...parsedAttributes, ...parsedCustomAttributes];
      
      // Validate required fields
      if (!recipientAddress || !name) {
        return res.status(400).json({ 
          error: 'Missing required fields: recipientAddress and name are required' 
        });
      }

      // Validate wallet address format
      if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid recipient wallet address format' });
      }

      // Use default contract address if none provided
      const targetContractAddress = contractAddress || '0x9b40c3c0656434fd89bC50671a29d1814EDA8079';

      this.initializeContract(targetContractAddress);
      this.initializeContractWithSigner(targetContractAddress);

      // 🚫 CHECK FOR DUPLICATE CERTIFICATES
      console.log(`🔍 Checking for duplicate certificates for ${recipientAddress}...`);
      const balance = await this.contract!.balanceOf(recipientAddress);
      
      if (balance.toString() !== '0') {
        // Check existing certificates for duplicates
        const maxTokensToCheck = 100;
        for (let tokenId = 0; tokenId < maxTokensToCheck; tokenId++) {
          try {
            const owner = await this.contract!.ownerOf(tokenId);
            if (owner.toLowerCase() === recipientAddress.toLowerCase()) {
              // Get existing certificate metadata
              const existingTokenURI = await this.contract!.tokenURI(tokenId);
              let existingMetadata = null;
              
              if (existingTokenURI.startsWith('data:application/json')) {
                const base64Data = existingTokenURI.split(',')[1];
                const jsonString = Buffer.from(base64Data, 'base64').toString();
                existingMetadata = JSON.parse(jsonString);
              }
              
              // Check if certificate with same name already exists
              if (existingMetadata && existingMetadata.name === name) {
                console.log(`❌ Duplicate certificate detected! "${name}" already exists for ${recipientAddress}`);
                return res.status(409).json({
                  success: false,
                  error: 'Duplicate certificate detected',
                  message: `A certificate with the name "${name}" already exists for this wallet address.`,
                  existingCertificate: {
                    tokenId: tokenId.toString(),
                    name: existingMetadata.name,
                    issuedAt: existingMetadata.issuedAt
                  }
                });
              }
            }
          } catch (error) {
            // Token doesn't exist or error fetching, continue
          }
        }
      }
      
      console.log(`✅ No duplicate certificates found. Proceeding with minting...`);

      // Get next token ID by checking current supply
      let nextTokenId = 0;
      const maxTokensToCheck = 1000;
      
      for (let tokenId = 0; tokenId < maxTokensToCheck; tokenId++) {
        try {
          await this.contract!.ownerOf(tokenId);
          nextTokenId = tokenId + 1;
        } catch (error) {
          // Token doesn't exist, this is our next available ID
          nextTokenId = tokenId;
          break;
        }
      }

      // Create metadata object with enhanced properties
      const metadata = {
        name: name,
        description: description || `Certificate #${nextTokenId}`,
        image: imageUrl,
        attributes: allAttributes,
        tokenId: nextTokenId,
        issuedAt: new Date().toISOString(),
        issuer: "Certimos Platform",
        // Enhanced metadata fields
        category: category || "General",
        rarity: rarity || "Common",
        points: parseInt(points) || 100,
        skills: skills || "",
        level: level || "",
        eventName: eventName || "",
        certificateName: certificateName || name,
        // Additional metadata
        certificateType: "Achievement",
        blockchain: "XDC Network",
        standard: "ERC-721"
      };

      // Create a data URI for metadata
      const metadataString = JSON.stringify(metadata);
      const base64Metadata = Buffer.from(metadataString).toString('base64');
      const tokenURI = `data:application/json;base64,${base64Metadata}`;

      console.log(`🏆 Minting certificate #${nextTokenId} to ${recipientAddress}`);
      console.log(`📄 Metadata:`, metadata);
      console.log(`🔑 Minting from address:`, this.wallet!.address);

      // Actually mint the certificate to the blockchain 
      try {
        console.log('💫 Sending transaction to blockchain...');
        
        // Set explicit gas parameters for XDC network
        const gasLimit = 1000000; // Increased gas limit
        const gasPrice = ethers.parseUnits('25', 'gwei'); // Increased gas price for XDC
        
        const tx = await this.contractWithSigner!.mintCertificate(recipientAddress, tokenURI, {
          gasLimit: gasLimit,
          gasPrice: gasPrice
        });
        console.log('📡 Transaction sent! Hash:', tx.hash);
        
        // Wait for transaction confirmation
        console.log('⏳ Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed! Block:', receipt.blockNumber);

        // Calculate certificate value for response (respecting user-provided rarity)
        const valuation = this.calculateCertificateValue(nextTokenId, metadata, tokenURI, rarity);

        res.json({
          success: true,
          message: 'Certificate successfully minted to blockchain!',
          certificate: {
            tokenId: nextTokenId.toString(),
            recipient: recipientAddress,
            tokenURI: tokenURI,
            metadata: metadata,
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber,
            transactionStatus: 'confirmed',
            points: valuation.points,
            rarity: valuation.rarity,
            category: valuation.category,
            gasUsed: receipt.gasUsed.toString(),
            from: this.wallet!.address,
            contractAddress: targetContractAddress
          }
        });

      } catch (mintError: any) {
        console.error('❌ Error during blockchain minting:', mintError);
        
        // Check if it's a gas or permission error
        if (mintError.message?.includes('insufficient funds')) {
          return res.status(400).json({
            success: false,
            error: 'Insufficient funds for gas fees',
            message: 'The minting wallet does not have enough XDC for gas fees'
          });
        } else if (mintError.message?.includes('execution reverted')) {
          return res.status(400).json({
            success: false,
            error: 'Transaction reverted',
            message: 'The smart contract rejected the transaction. Check if the minting wallet has permission to mint.'
          });
        }
        
        throw mintError;
      }

    } catch (error) {
      console.error('❌ Error minting certificate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mint certificate',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // Verify certificate by token ID
  async verifyCertificate(req: Request, res: Response) {
    try {
      const { tokenId } = req.params;
      
      console.log(`Verifying certificate with token ID: ${tokenId}`);
      
      this.initializeContract('0x9b40c3c0656434fd89bC50671a29d1814EDA8079'); // Use default contract for backwards compatibility
      
      const owner = await this.contract!.ownerOf(tokenId);
      const tokenURI = await this.contract!.tokenURI(tokenId);
      
      let metadata = null;
      if (tokenURI) {
        try {
          if (tokenURI.startsWith('http')) {
            const response = await fetch(tokenURI);
            metadata = await response.json();
          } else if (tokenURI.startsWith('data:application/json')) {
            const base64Data = tokenURI.split(',')[1];
            const jsonString = Buffer.from(base64Data, 'base64').toString();
            metadata = JSON.parse(jsonString);
          }
        } catch (metadataError) {
          console.warn('Could not parse metadata:', metadataError);
        }
      }

      // Calculate certificate value for verification
      const valuation = this.calculateCertificateValue(parseInt(tokenId), metadata, tokenURI);

      const certificate = {
        tokenId,
        owner,
        tokenURI,
        metadata,
        name: metadata?.name || `Certificate #${tokenId}`,
        description: metadata?.description || 'Certificate NFT',
        image: metadata?.image || null,
        attributes: metadata?.attributes || [],
        points: valuation.points,
        rarity: valuation.rarity,
        category: valuation.category
      };
      
      res.json({
        valid: true,
        certificate,
        verifiedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error during verification:', error);
      res.json({
        valid: false,
        message: 'Certificate not found on blockchain',
        verifiedAt: new Date().toISOString()
      });
    }
  }

  // Transfer a certificate to another address
  async transferCertificate(req: Request, res: Response) {
    try {
      const { tokenId, fromAddress, toAddress } = req.body;
      
      // Validate required fields
      if (!tokenId || !fromAddress || !toAddress) {
        return res.status(400).json({ 
          error: 'Missing required fields: tokenId, fromAddress, and toAddress are required' 
        });
      }

      // Validate wallet address formats
      if (!fromAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid fromAddress wallet format' });
      }
      
      if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid toAddress wallet format' });
      }

      this.initializeContract('0x9b40c3c0656434fd89bC50671a29d1814EDA8079'); // Use default contract for backwards compatibility
      this.initializeContractWithSigner('0x9b40c3c0656434fd89bC50671a29d1814EDA8079');

      // Verify the token exists and get current owner
      let currentOwner;
      try {
        currentOwner = await this.contract!.ownerOf(tokenId);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Certificate not found',
          message: `Token ID ${tokenId} does not exist`
        });
      }

      // Verify the fromAddress matches the current owner
      if (currentOwner.toLowerCase() !== fromAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized transfer',
          message: `Token ${tokenId} is owned by ${currentOwner}, not ${fromAddress}`
        });
      }

      // Get certificate metadata before transfer
      const tokenURI = await this.contract!.tokenURI(tokenId);
      let metadata = null;
      
      if (tokenURI.startsWith('data:application/json')) {
        const base64Data = tokenURI.split(',')[1];
        const jsonString = Buffer.from(base64Data, 'base64').toString();
        metadata = JSON.parse(jsonString);
      }

      console.log(`🔄 Transferring certificate #${tokenId} from ${fromAddress} to ${toAddress}`);
      console.log(`📄 Certificate: ${metadata?.name || 'Unknown'}`);

      // Execute the transfer using safeTransferFrom
      try {
        console.log('💫 Sending transfer transaction to blockchain...');
        
        const gasLimit = 500000;
        const gasPrice = ethers.parseUnits('25', 'gwei');
        
        const tx = await this.contractWithSigner!['safeTransferFrom(address,address,uint256)'](
          fromAddress, 
          toAddress, 
          tokenId,
          {
            gasLimit: gasLimit,
            gasPrice: gasPrice
          }
        );
        
        console.log('📡 Transfer transaction sent! Hash:', tx.hash);
        
        // Wait for transaction confirmation
        console.log('⏳ Waiting for transfer confirmation...');
        const receipt = await tx.wait();
        console.log('✅ Transfer confirmed! Block:', receipt.blockNumber);

        res.json({
          success: true,
          message: 'Certificate transferred successfully!',
          transfer: {
            tokenId: tokenId.toString(),
            from: fromAddress,
            to: toAddress,
            certificateName: metadata?.name || `Certificate #${tokenId}`,
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString()
          }
        });

      } catch (transferError: any) {
        console.error('❌ Error during transfer:', transferError);
        
        if (transferError.message?.includes('insufficient funds')) {
          return res.status(400).json({
            success: false,
            error: 'Insufficient funds for gas fees',
            message: 'The wallet does not have enough XDC for gas fees'
          });
        }
        
        throw transferError;
      }

    } catch (error) {
      console.error('❌ Error transferring certificate:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to transfer certificate',
        message: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }

  // New method: Get certificates from multiple contracts
  async getUserCertificatesFromMultipleContracts(req: Request, res: Response) {
    try {
      const { walletAddress } = req.params;
      const { contracts } = req.query; // Comma-separated list of contract addresses
      
      console.log(`🔍 Fetching certificates from multiple contracts for wallet: ${walletAddress}`);
      
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid wallet address format' 
        });
      }

      // Parse contract addresses from query parameter
      let contractAddresses: string[] = [];
      
      if (contracts && typeof contracts === 'string') {
        contractAddresses = contracts.split(',').map(addr => addr.trim());
        console.log(`🎯 Checking specific contracts: ${contractAddresses.join(', ')}`);
      } else {
        // If no contracts specified, get all contracts from deployments
        contractAddresses = await this.getAllDeployedContracts();
        console.log(`🌐 Checking all deployed contracts: ${contractAddresses.length} contracts found`);
      }

      // Validate contract addresses
      const validContracts = contractAddresses.filter(addr => 
        addr.match(/^0x[a-fA-F0-9]{40}$/)
      );

      if (validContracts.length === 0) {
        return res.json({
          success: true,
          walletAddress,
          certificates: [],
          count: 0,
          balance: '0',
          network: 'XDC Apothem',
          contractAddresses: [],
          totalPoints: 0,
          message: 'No valid contracts to check'
        });
      }

      console.log(`✅ Checking ${validContracts.length} valid contract addresses`);

      // Fetch certificates from all contracts in parallel
      const certificatePromises = validContracts.map(contractAddress => 
        this.getCertificatesFromSingleContract(walletAddress, contractAddress)
      );

      const results = await Promise.allSettled(certificatePromises);
      
      // Combine all certificates
      const allCertificates: (CertificateData & { contractAddress: string })[] = [];
      const contractResults: { [address: string]: any } = {};

      results.forEach((result, index) => {
        const contractAddress = validContracts[index];
        
        if (result.status === 'fulfilled' && result.value.success) {
          const certificates = result.value.certificates.map((cert: CertificateData) => ({
            ...cert,
            contractAddress
          }));
          allCertificates.push(...certificates);
          contractResults[contractAddress] = {
            success: true,
            count: certificates.length,
            totalPoints: result.value.totalPoints
          };
          console.log(`✅ Contract ${contractAddress}: Found ${certificates.length} certificates`);
        } else {
          contractResults[contractAddress] = {
            success: false,
            error: result.status === 'rejected' ? result.reason : 'Failed to fetch'
          };
          console.log(`❌ Contract ${contractAddress}: Failed to fetch certificates`);
        }
      });

      // Calculate aggregated stats
      const totalPoints = allCertificates.reduce((sum, cert) => sum + (cert.points || 0), 0);
      const rarityDistribution: Record<string, number> = {};
      const categoryDistribution: Record<string, number> = {};

      allCertificates.forEach(cert => {
        if (cert.rarity) {
          rarityDistribution[cert.rarity] = (rarityDistribution[cert.rarity] || 0) + 1;
        }
        if (cert.category) {
          categoryDistribution[cert.category] = (categoryDistribution[cert.category] || 0) + 1;
        }
      });

      console.log(`🎉 Total certificates found: ${allCertificates.length} across ${validContracts.length} contracts`);

      return res.json({
        success: true,
        walletAddress,
        certificates: allCertificates,
        count: allCertificates.length,
        network: 'XDC Apothem',
        contractAddresses: validContracts,
        contractResults,
        totalPoints,
        valueBreakdown: {
          totalCertificates: allCertificates.length,
          totalPoints,
          averagePoints: allCertificates.length > 0 ? Math.round(totalPoints / allCertificates.length) : 0,
          rarityDistribution,
          categoryDistribution
        }
      });

    } catch (error) {
      console.error('❌ Error fetching certificates from multiple contracts:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch certificates from multiple contracts',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Helper method: Get certificates from a single contract
  private async getCertificatesFromSingleContract(walletAddress: string, contractAddress: string): Promise<any> {
    try {
      console.log(`🔍 Checking contract ${contractAddress} for wallet ${walletAddress}`);
      
      // Create a dedicated contract instance for this check to avoid concurrency issues
      const contractProvider = new ethers.JsonRpcProvider(process.env.APOTHEM_RPC_URL);
      const contract = new ethers.Contract(contractAddress, contractABI, contractProvider);

      // Check balance
      const balance = await contract.balanceOf(walletAddress);
      const balanceNum = parseInt(balance.toString());
      
      if (balanceNum === 0) {
        return {
          success: true,
          certificates: [],
          totalPoints: 0
        };
      }

      const certificates: CertificateData[] = [];
      const maxTokensToCheck = Math.min(50, balanceNum * 5); // Match original logic
      const batchSize = 3; // Match original batch size
      
      // Process in smaller batches for multiple contracts
      for (let i = 0; i < maxTokensToCheck; i += batchSize) {
        const tokenPromises: Promise<CertificateData | null>[] = [];
        
        for (let tokenId = i; tokenId < Math.min(i + batchSize, maxTokensToCheck); tokenId++) {
          tokenPromises.push(this.checkTokenOwnershipWithContract(contract, tokenId, walletAddress, contractAddress));
        }

        const batchResults = await Promise.allSettled(tokenPromises);
        const validCertificates = batchResults
          .filter(result => result.status === 'fulfilled' && result.value !== null)
          .map(result => (result as PromiseFulfilledResult<CertificateData>).value);

        certificates.push(...validCertificates);

        // Stop if we found all certificates
        if (certificates.length >= balanceNum) {
          break;
        }
      }

      const totalPoints = certificates.reduce((sum, cert) => sum + (cert.points || 0), 0);

      return {
        success: true,
        certificates,
        totalPoints
      };

    } catch (error) {
      console.warn(`⚠️ Error checking contract ${contractAddress}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper method: Get all deployed contract addresses from deployments.ts
  private async getAllDeployedContracts(): Promise<string[]> {
    try {
      const deploymentsPath = path.join(process.cwd(), 'scripts', 'deployments.ts');
      
      if (!fs.existsSync(deploymentsPath)) {
        console.log('📂 No deployments.ts file found, using default contracts');
        return [
          '0x9b40c3c0656434fd89bC50671a29d1814EDA8079', // Default contract
          '0xEa23289AA36686d3cB805a75cA14142cebd6dF7f'  // Current contract
        ];
      }

      const deploymentsContent = fs.readFileSync(deploymentsPath, 'utf8');
      const match = deploymentsContent.match(/export const deployments: Record<string, DeploymentConfig> = ({[\s\S]*?});/);
      
      if (!match) {
        console.log('📂 No deployments found in deployments.ts');
        return [];
      }

      const deployments = JSON.parse(match[1]);
      const contractAddresses: string[] = [];

      // Recursive function to extract contract addresses from nested structure
      const extractContracts = (obj: any) => {
        if (typeof obj === 'object' && obj !== null) {
          // If this object has contractAddress, add it
          if (obj.contractAddress && obj.contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            contractAddresses.push(obj.contractAddress);
          }
          
          // Recursively check nested objects
          Object.values(obj).forEach(value => {
            if (typeof value === 'object' && value !== null) {
              extractContracts(value);
            }
          });
        }
      };

      extractContracts(deployments);

      // No default contract needed - system is fully dynamic

      // Add fallback legacy contract if not already included
      const legacyContract = '0x9b40c3c0656434fd89bC50671a29d1814EDA8079';
      if (!contractAddresses.includes(legacyContract)) {
        contractAddresses.push(legacyContract);
        console.log(`📋 Added legacy contract: ${legacyContract}`);
      }

      console.log(`📋 Found ${contractAddresses.length} deployed contracts (including nested ones)`);
      console.log(`📋 Contract addresses: ${contractAddresses.join(', ')}`);
      return [...new Set(contractAddresses)]; // Remove duplicates

    } catch (error) {
      console.warn('⚠️ Error reading deployments:', error);
      return [
        '0x9b40c3c0656434fd89bC50671a29d1814EDA8079', // Default fallback
        '0xEa23289AA36686d3cB805a75cA14142cebd6dF7f'  // Current contract
      ];
    }
  }

  // Test endpoint for debugging IPFS metadata fetching
  async testIpfsMetadata(req: Request, res: Response) {
    try {
      const testHash = 'QmPhTBYmWcPoAdpSd13h66hK1dcmYq5KBYw4w5szcabZA7';
      const ipfsGatewayUrl = `https://gateway.pinata.cloud/ipfs/${testHash}`;
      
      console.log(`🔍 Testing IPFS fetch from: ${ipfsGatewayUrl}`);
      
      try {
        const response = await axios.get(ipfsGatewayUrl, {
          timeout: 15000, // Increase timeout to 15 seconds for IPFS
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Certimos-Backend/1.0'
          }
        });
        
        console.log(`✅ IPFS fetch successful:`, response.data);
        res.json({
          success: true,
          data: response.data,
          url: ipfsGatewayUrl
        });
      } catch (axiosError) {
        console.error(`❌ IPFS fetch failed:`, axiosError);
        res.status(500).json({
          success: false,
          error: axiosError instanceof Error ? axiosError.message : 'Unknown error',
          url: ipfsGatewayUrl
        });
      }
    } catch (error) {
      console.error('❌ Test endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
