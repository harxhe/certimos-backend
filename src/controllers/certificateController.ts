import { Request, Response } from 'express';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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
      
      // Validate wallet address format
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }

      this.initializeContract();

      // Get the balance of NFTs owned by this wallet
      const balance = await this.contract!.balanceOf(walletAddress);
      const certificates = [];

      // Since this contract doesn't have ERC721Enumerable, we need to check token IDs manually
      // Check the first 100 possible token IDs (should be sufficient for most cases)
      const maxTokensToCheck = 100;
      
      for (let tokenId = 0; tokenId < maxTokensToCheck; tokenId++) {
        try {
          // Check if this token exists and is owned by the user
          const owner = await this.contract!.ownerOf(tokenId);
          
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            // Get token URI (metadata)
            let tokenURI = '';
            try {
              tokenURI = await this.contract!.tokenURI(tokenId);
            } catch (uriError) {
              console.warn(`Could not get URI for token ${tokenId}`);
            }

            let metadata = null;
            if (tokenURI) {
              try {
                // If tokenURI is a HTTP URL, fetch it
                if (tokenURI.startsWith('http')) {
                  const response = await fetch(tokenURI);
                  metadata = await response.json();
                } else if (tokenURI.startsWith('data:application/json')) {
                  // If it's base64 encoded JSON
                  const base64Data = tokenURI.split(',')[1];
                  const jsonString = Buffer.from(base64Data, 'base64').toString();
                  metadata = JSON.parse(jsonString);
                }
              } catch (metadataError) {
                console.warn(`Could not parse metadata for token ${tokenId}`);
              }
            }

            certificates.push({
              tokenId: tokenId.toString(),
              owner,
              tokenURI,
              metadata,
              name: metadata?.name || `Certificate #${tokenId}`,
              description: metadata?.description || 'Certificate NFT',
              image: metadata?.image || null,
              attributes: metadata?.attributes || []
            });
          }

        } catch (tokenError) {
          // Token doesn't exist or other error - this is expected for non-existent tokens
        }
      }

      const result = {
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
