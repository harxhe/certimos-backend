import express from 'express';
import { blockchainService } from '../services/blockchainService.js';
import { ipfsService } from '../services/ipfsService.js';

const router = express.Router();

// Get all certificates for a wallet address
router.get('/wallet/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // Validate wallet address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    console.log(`Fetching certificates for wallet: ${walletAddress}`);
    
    // Get certificates from blockchain
    const certificates = await blockchainService.getCertificatesByWallet(walletAddress);
    
    // Fetch metadata for each certificate
    const certificatesWithMetadata = await Promise.all(
      certificates.map(async (cert: any) => {
        try {
          const metadata = await ipfsService.getMetadata(cert.tokenURI);
          return {
            ...cert,
            metadata
          };
        } catch (error) {
          console.error(`Error fetching metadata for token ${cert.tokenId}:`, error);
          return {
            ...cert,
            metadata: {
              name: 'Certificate',
              description: 'Certificate metadata unavailable'
            }
          };
        }
      })
    );

    res.json({ 
      success: true,
      count: certificatesWithMetadata.length,
      certificates: certificatesWithMetadata 
    });
  } catch (error) {
    console.error('Error in /wallet/:walletAddress route:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch certificates' 
    });
  }
});

// Get specific certificate details
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    console.log(`Fetching details for token ID: ${tokenId}`);
    
    const certificate = await blockchainService.getCertificateDetails(tokenId);
    
    if (!certificate.exists) {
      return res.status(404).json({ 
        success: false,
        error: 'Certificate not found' 
      });
    }

    // Fetch metadata from IPFS
    let metadata = {};
    try {
      metadata = await ipfsService.getMetadata(certificate.tokenURI);
    } catch (error) {
      console.error('Error fetching metadata:', error);
    }

    res.json({ 
      success: true,
      certificate: {
        ...certificate,
        metadata
      }
    });
  } catch (error) {
    console.error('Error in /:tokenId route:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch certificate details' 
    });
  }
});

// Get certificate metadata only
router.get('/:tokenId/metadata', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const certificate = await blockchainService.getCertificateDetails(tokenId);
    
    if (!certificate.exists) {
      return res.status(404).json({ 
        success: false,
        error: 'Certificate not found' 
      });
    }

    const metadata = await ipfsService.getMetadata(certificate.tokenURI);
    
    res.json({ 
      success: true,
      metadata 
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch certificate metadata' 
    });
  }
});

export default router;