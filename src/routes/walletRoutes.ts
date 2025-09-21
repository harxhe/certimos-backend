import express from 'express';
import { WalletController } from '../controllers/walletController.js';
import { validateWalletAddress } from '../middleware/validation.js';

const router = express.Router();
const walletController = new WalletController();

// Get wallet balance
router.get('/:address/balance', validateWalletAddress, (req, res) => {
  walletController.getBalance(req, res);
});

export default router;
