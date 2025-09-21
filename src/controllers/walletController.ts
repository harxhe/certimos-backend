import { Request, Response } from 'express';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

export class WalletController {
  // Get wallet balance
  async getBalance(req: Request, res: Response) {
    try {
      const { address } = req.params;
      
      console.log('🟢 WALLET ROUTE HIT - Address:', address);
      
      // Validate wallet address format
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        console.log('❌ Invalid wallet address format');
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }

      console.log(`✅ Address validation passed - Fetching balance for wallet: ${address}`);
      
      // Direct provider call
      const provider = new ethers.JsonRpcProvider(process.env.APOTHEM_RPC_URL);
      const balance = await provider.getBalance(address);
      const formatted = ethers.formatEther(balance);

      console.log('✅ Balance fetched successfully:', formatted, 'XDC');
      
      res.json({
        success: true,
        address,
        balance: {
          xdc: balance.toString(),
          formatted: parseFloat(formatted).toFixed(4)
        }
      });
    } catch (error) {
      console.error('❌ Error fetching wallet balance:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch wallet balance' 
      });
    }
  }
}
