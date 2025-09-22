import {Router, Request, Response} from 'express';
const router = Router();

router.get('/set-wallet', (req: Request, res: Response) => {
  const walletAddress = process.env.WALLET_ADDRESS;

  if (walletAddress) {
    res.json({
      success: true,
      walletAddress: walletAddress,
      isSet: true
    });
  } else {
    res.json({
      success: true,
      walletAddress: null,
      isSet: false,
      message: 'No wallet address set'
    });
  }
});


export default router;