import express from 'express';
import { blockchainService } from '../services/blockchainService.js';

const router = express.Router();

// Get wallet balance
router.get('/:address/balance', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Validate wallet address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    console.log(`Fetching balance for wallet: ${address}`);
    
    const balance = await blockchainService.getWalletBalance(address);
    
    res.json({
      success: true,
      address,
      balance
    });
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch wallet balance' 
    });
  }
});

export default router;