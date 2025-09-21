import { Request, Response, NextFunction } from 'express';

// Wallet address validation middleware
export const validateWalletAddress = (req: Request, res: Response, next: NextFunction) => {
  const { address, walletAddress } = req.params;
  const addressToValidate = address || walletAddress;

  if (!addressToValidate) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  if (!addressToValidate.match(/^0x[a-fA-F0-9]{40}$/)) {
    return res.status(400).json({ error: 'Invalid wallet address format' });
  }

  next();
};

// Token ID validation middleware
export const validateTokenId = (req: Request, res: Response, next: NextFunction) => {
  const { tokenId } = req.params;

  if (!tokenId) {
    return res.status(400).json({ error: 'Token ID is required' });
  }

  if (!/^\d+$/.test(tokenId)) {
    return res.status(400).json({ error: 'Token ID must be a valid number' });
  }

  next();
};
