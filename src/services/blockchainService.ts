import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load contract ABI and address
const contractArtifact = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'artifacts/contracts/Certificate.sol/Certificate.json'), 'utf8')
);



export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;

  private initialize() {
    if (!this.provider) {
      this.provider = new ethers.JsonRpcProvider(process.env.APOTHEM_RPC_URL);
      this.contract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS!,
        contractArtifact.abi,
        this.provider
      );
    }
  }

  // Get all certificates owned by a wallet address
  async getCertificatesByWallet(walletAddress: string) {
    this.initialize();
    try {
      // Get the total number of tokens owned by the address
      const balance = await this.contract!.balanceOf(walletAddress);
      const certificates = [];

      const filter = this.contract!.filters.Transfer(null, walletAddress);
      const events = await this.contract!.queryFilter(filter);
      
      // Check each token from events to see if still owned by this address
      const tokenIds = new Set<string>();
      for (const event of events) {
        if ('args' in event && event.args && event.args.length > 2) {
          const tokenId = event.args[2];
          if (tokenId) {
            tokenIds.add(tokenId.toString());
          }
        }
      }

      // Verify ownership and get details for each token
      for (const tokenIdStr of tokenIds) {
        try {
          const owner = await this.contract!.ownerOf(tokenIdStr);
          if (owner.toLowerCase() === walletAddress.toLowerCase()) {
            const tokenURI = await this.contract!.tokenURI(tokenIdStr);
            certificates.push({
              tokenId: tokenIdStr,
              tokenURI,
              owner: walletAddress
            });
          }
        } catch (error) {
          // Token might not exist or might have been burned, skip it
          console.log(`Token ${tokenIdStr} not found or not owned by ${walletAddress}`);
        }
      }

      return certificates;
    } catch (error) {
      console.error('Error fetching certificates:', error);
      throw new Error('Failed to fetch certificates from blockchain');
    }
  }

  // Get specific certificate details
  async getCertificateDetails(tokenId: string) {
    this.initialize();
    try {
      // Check if token exists
      const owner = await this.contract!.ownerOf(tokenId);
      const tokenURI = await this.contract!.tokenURI(tokenId);

      return {
        tokenId,
        owner,
        tokenURI,
        exists: true
      };
    } catch (error) {
      return {
        tokenId,
        exists: false
      };
    }
  }

  // Get wallet balance
  async getWalletBalance(address: string) {
    this.initialize();
    try {
      const balance = await this.provider!.getBalance(address);
      const formatted = ethers.formatEther(balance);

      return {
        xdc: balance.toString(),
        formatted: parseFloat(formatted).toFixed(4)
      };
    } catch (error) {
      throw new Error('Failed to fetch wallet balance');
    }
  }

  // Verify certificate exists on blockchain
  async verifyCertificate(tokenId: string) {
    this.initialize();
    try {
      const details = await this.getCertificateDetails(tokenId);
      
      if (!details.exists) {
        return { exists: false };
      }

      return {
        exists: true,
        certificate: details,
        owner: details.owner
      };
    } catch (error) {
      return { exists: false };
    }
  }
}

export const blockchainService = new BlockchainService();