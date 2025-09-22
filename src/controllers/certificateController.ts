import { Request, Response } from 'express';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
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
}

interface CertificateResponse {
  success: boolean;
  walletAddress: string;
  certificates: CertificateData[];
  count: number;
  balance: string;
  network: string;
  contractAddress: string | undefined;
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

    const result: CertificateResponse = {
      success: true,
      walletAddress,
      certificates,
      count: certificates.length,
      balance: balance.toString(),
      network: 'XDC Apothem',
      contractAddress: process.env.CONTRACT_ADDRESS
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
      try {
        tokenURI = await this.contract!.tokenURI(tokenId);
      } catch (uriError) {
        console.warn(`Could not get URI for token ${tokenId}`);
      }

      return {
        tokenId: tokenId.toString(),
        owner,
        tokenURI,
        name: `Certificate #${tokenId}`,
        description: 'Certificate NFT',
        image: null,
        attributes: []
      } as CertificateData;
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
      
      res.json({
        success: true,
        totalSupply: certificateCount,
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

      const certificate = {
        tokenId,
        owner,
        tokenURI,
        metadata,
        name: metadata?.name || `Certificate #${tokenId}`,
        description: metadata?.description || 'Certificate NFT',
        image: metadata?.image || null,
        attributes: metadata?.attributes || []
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