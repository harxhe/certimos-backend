import express from 'express';
import { CertificateController } from '../controllers/certificateController.js';
import { validateWalletAddress, validateTokenId } from '../middleware/validation.js';

const router = express.Router();

// Get all certificates for a wallet
router.get('/wallet/:walletAddress', validateWalletAddress, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.getUserCertificates(req, res);
});

// Get total supply of certificates for a user
router.get('/total-supply/:walletAddress', validateWalletAddress, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.getUserCertificateCount(req, res);
});

// Mint a single certificate
router.post('/mint', (req, res) => {
  const certificateController = new CertificateController();
  certificateController.mintCertificate(req, res);
});

export default router;
