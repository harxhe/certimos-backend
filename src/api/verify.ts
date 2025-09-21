import express from 'express';
import { blockchainService } from '../services/blockchainService.js';
import { ipfsService } from '../services/ipfsService.js';

const router = express.Router();

// Verify certificate by token ID
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    console.log(`Verifying certificate with token ID: ${tokenId}`);
    
    const verification = await blockchainService.verifyCertificate(tokenId);
    
    if (!verification.exists) {
      return res.json({
        valid: false,
        message: 'Certificate not found on blockchain',
        verifiedAt: new Date().toISOString()
      });
    }

    // Fetch metadata for additional details
    let metadata = {};
    try {
      if (verification.certificate) {
        metadata = await ipfsService.getMetadata(verification.certificate.tokenURI);
      }
    } catch (error) {
      console.error('Error fetching metadata for verification:', error);
    }

    res.json({
      valid: true,
      certificate: {
        ...verification.certificate,
        metadata
      },
      owner: verification.owner,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error during verification:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Verification failed' 
    });
  }
});

export default router;