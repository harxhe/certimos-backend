import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import session from 'express-session';


// Import routes
import certificateRoutes from './routes/certificateRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import verifyRoutes from './routes/verifyRoutes.js';
import bulkRoutes from './routes/contractroute.js';


// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'development' }
}));

declare module 'express-session' {
  interface SessionData {
    walletAddress?: string;
  }
}


app.get('/api/set-wallet', (req, res) => {
  const walletAddress = req.session.walletAddress;

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
      message: 'No wallet address found in session'
    });
  }
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    network: 'XDC Apothem'
  });
});

// API Routes
app.use('/api/certificates', certificateRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/contracts',bulkRoutes);


// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use(notFoundHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});
