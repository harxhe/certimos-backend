import express from 'express';
import { CertificateController } from '../controllers/certificateController.js';
import { validateTokenId } from '../middleware/validation.js';

const router = express.Router();

// Verify certificate by token ID
router.get('/:tokenId', validateTokenId, (req, res) => {
  const certificateController = new CertificateController();
  certificateController.verifyCertificate(req, res);
});

export default router;
