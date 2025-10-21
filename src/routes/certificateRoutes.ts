import express from 'express';
import multer from 'multer';
import path from 'path';
import { CertificateController } from '../controllers/certificateController.js';
import { validateWalletAddress, validateTokenId } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all certificates for a wallet
router.get('/wallet/:walletAddress', validateWalletAddress, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.getUserCertificates(req, res);
});

// Test endpoint for debugging IPFS metadata fetching
router.get('/test-ipfs', (req, res) => {
  const certificateController = new CertificateController();
  certificateController.testIpfsMetadata(req, res);
});

// Get certificates from multiple contracts for a wallet
router.get('/wallet/:walletAddress/multi-contract', validateWalletAddress, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.getUserCertificatesFromMultipleContracts(req, res);
});

// Get total supply of certificates for a user
router.get('/total-supply/:walletAddress', validateWalletAddress, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.getUserCertificateCount(req, res);
});

// Mint a single certificate (with optional image upload)
router.post('/mint', upload.single('image'), (req, res) => {
  const certificateController = new CertificateController();
  certificateController.mintCertificate(req, res);
});

// Transfer a certificate
router.post('/transfer', (req, res) => {
  const certificateController = new CertificateController();
  certificateController.transferCertificate(req, res);
});

export default router;
