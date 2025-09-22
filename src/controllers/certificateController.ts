import { Request, Response } from 'express';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

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
const contractArtifactPath = path.join(process.cwd(), 'artifacts', 'contracts', 'Certificate.sol', 'Certificate.json');
let contractABI: any;

try {
  const contractArtifact = JSON.parse(fs.readFileSync(contractArtifactPath, 'utf8'));
  contractABI = contractArtifact.abi;
} catch (error) {
  console.error('Error loading contract ABI:', error);
  throw new Error('Contract ABI not found');
}

export class CertificateController {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractWithSigner: ethers.Contract | null = null;

  private initializeContract() {
    if (!this.provider || !this.contract) {
      console.log('🔧 Initializing blockchain connection...');
      console.log('📍 CONTRACT_ADDRESS:', process.env.CONTRACT_ADDRESS);
      console.log('🌐 APOTHEM_RPC_URL:', process.env.APOTHEM_RPC_URL);
      
      if (!process.env.CONTRACT_ADDRESS) {
        throw new Error('CONTRACT_ADDRESS environment variable is not set');
      }
      
      if (!process.env.APOTHEM_RPC_URL) {
        throw new Error('APOTHEM_RPC_URL environment variable is not set');
      }
      
      this.provider = new ethers.JsonRpcProvider(process.env.APOTHEM_RPC_URL);
      this.contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS!,
        contractABI,
        this.provider
      );
      
      console.log('✅ Blockchain connection initialized successfully');
    }
  }

  private initializeContractWithSigner() {
    if (!this.contractWithSigner || !this.wallet) {
      console.log('🔧 Initializing contract with signer for transactions...');
      
      if (!process.env.PRIVATE_KEY) {
        throw new Error('PRIVATE_KEY environment variable is not set');
      }
      
      this.initializeContract(); // Ensure provider and contract are initialized
      
      this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider!);
      this.contractWithSigner = new ethers.Contract(
        process.env.CONTRACT_ADDRESS!,
        contractABI,
        this.wallet
      );
      
      console.log('✅ Contract with signer initialized successfully');
      console.log('🔑 Signer address:', this.wallet.address);
    }
  }

  // Certificate valuation logic
  private calculateCertificateValue(tokenId: number, metadata: any, tokenURI: string): { points: number; rarity: string; category: string } {
    let points = 0;
    let rarity = 'Common';
    let category = 'General';

    // Base points for having a certificate
    points += 100;

    // Points based on token ID (earlier certificates are rarer)
    if (tokenId < 10) {
      points += 500;
      rarity = 'Legendary';
    } else if (tokenId < 50) {
      points += 200;
      rarity = 'Rare';
    } else if (tokenId < 100) {
      points += 50;
      rarity = 'Uncommon';
    }

    // Points based on metadata (if available)
    if (metadata) {
      // Points for having rich metadata
      points += 50;
      
      // Category-based points
      const name = (metadata.name || '').toLowerCase();
      const description = (metadata.description || '').toLowerCase();
      
      if (name.includes('achievement') || description.includes('achievement')) {
        category = 'Achievement';
        points += 150;
      } else if (name.includes('completion') || description.includes('completion')) {
        category = 'Completion';
        points += 200;
      } else if (name.includes('excellence') || description.includes('excellence')) {
        category = 'Excellence';
        points += 300;
      } else if (name.includes('mastery') || description.includes('mastery')) {
        category = 'Mastery';
        points += 400;
      }

      // Points for attributes
      if (metadata.attributes && Array.isArray(metadata.attributes)) {
        points += metadata.attributes.length * 25;
        
        // Bonus for special attributes
        for (const attr of metadata.attributes) {
          if (attr.trait_type && attr.value) {
            const traitType = attr.trait_type.toLowerCase();
            if (traitType.includes('grade') || traitType.includes('score')) {
              if (typeof attr.value === 'string' && attr.value.toLowerCase().includes('a')) {
                points += 100;
              }
            }
          }
        }
      }

      // Points for having an image
      if (metadata.image) {
        points += 75;
      }
    }

    // IPFS bonus (indicates proper metadata storage)
    if (tokenURI.includes('ipfs://')) {
      points += 100;
    }

    // Rarity adjustment based on final points
    if (points >= 800) {
      rarity = 'Legendary';
    } else if (points >= 600) {
      rarity = 'Epic';
    } else if (points >= 400) {
      rarity = 'Rare';
    } else if (points >= 250) {
      rarity = 'Uncommon';
    }

    return { points, rarity, category };
  }

  // Get all certificates for a wallet
  async getUserCertificates(req: Request, res: Response) {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    this.initializeContract();

    // Early exit if no certificates
    const balance = await this.contract!.balanceOf(walletAddress);
    if (balance.toString() === '0') {
      return res.json({
        success: true,
        walletAddress,
        certificates: [],
        count: 0,
        balance: '0',
        network: 'XDC Apothem',
        contractAddress: process.env.CONTRACT_ADDRESS
      });
    }

    const certificates: CertificateData[] = [];
    const maxTokensToCheck = 100;
    const batchSize = 10;
    
    // Process in parallel batches
    for (let i = 0; i < maxTokensToCheck; i += batchSize) {
      const tokenPromises: Promise<CertificateData | null>[] = [];
      
      for (let tokenId = i; tokenId < Math.min(i + batchSize, maxTokensToCheck); tokenId++) {
        tokenPromises.push(this.checkTokenOwnership(tokenId, walletAddress));
      }
      
      const batchResults = await Promise.allSettled(tokenPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          certificates.push(result.value);
        }
      });

      // Early exit when found all certificates
      if (certificates.length === parseInt(balance.toString())) {
        break;
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
      contractAddress: process.env.CONTRACT_ADDRESS,
      totalPoints,
      valueBreakdown: {
        totalCertificates: certificates.length,
        totalPoints,
        averagePoints,
        rarityDistribution,
        categoryDistribution
      }
    };

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

async checkTokenOwnership(tokenId: number, walletAddress: string): Promise<CertificateData | null> {
  try {
    const owner = await this.contract!.ownerOf(tokenId);
    
    if (owner.toLowerCase() === walletAddress.toLowerCase()) {
      let tokenURI = '';
      let metadata = null;
      
      try {
        tokenURI = await this.contract!.tokenURI(tokenId);
        
        // Try to fetch metadata
        if (tokenURI) {
          if (tokenURI.startsWith('http')) {
            const response = await fetch(tokenURI);
            metadata = await response.json();
          } else if (tokenURI.startsWith('data:application/json')) {
            const base64Data = tokenURI.split(',')[1];
            const jsonString = Buffer.from(base64Data, 'base64').toString();
            metadata = JSON.parse(jsonString);
          }
        }
      } catch (error) {
        console.warn(`Could not get URI/metadata for token ${tokenId}`);
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
        image: metadata?.image || null,
        attributes: metadata?.attributes || [],
        points: valuation.points,
        rarity: valuation.rarity,
        category: valuation.category
      };
    }
    
    return null;
  } catch (error) {
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

      this.initializeContract();

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
        contractAddress: process.env.CONTRACT_ADDRESS
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
      const { recipientAddress, name, description, image, attributes } = req.body;
      
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

      this.initializeContract();
      this.initializeContractWithSigner();

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

      // Create metadata object
      const metadata = {
        name: name,
        description: description || `Certificate #${nextTokenId}`,
        image: image || null,
        attributes: attributes || [],
        tokenId: nextTokenId,
        issuedAt: new Date().toISOString(),
        issuer: "Certimos Platform"
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

        // Calculate certificate value for response
        const valuation = this.calculateCertificateValue(nextTokenId, metadata, tokenURI);

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
            from: this.wallet!.address
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
      
      this.initializeContract();
      
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
}