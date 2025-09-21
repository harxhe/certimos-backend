import dotenv from 'dotenv';
import { blockchainService } from './services/blockchainService.js';
import { ipfsService } from './services/ipfsService.js';

// Load environment variables
dotenv.config();

async function testServices() {
  console.log('🧪 Testing Blockchain and IPFS Services...\n');

  try {
    // Test 1: Check wallet balance
    console.log('1️⃣ Testing wallet balance...');
    const testWallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    const balance = await blockchainService.getWalletBalance(testWallet);
    console.log(`✅ Balance for ${testWallet}:`, balance);
    console.log();

    // Test 2: Check certificates for wallet
    console.log('2️⃣ Testing certificate retrieval...');
    const certificates = await blockchainService.getCertificatesByWallet(testWallet);
    console.log(`✅ Found ${certificates.length} certificates for ${testWallet}`);
    certificates.forEach((cert, index) => {
      console.log(`   Certificate ${index + 1}:`, {
        tokenId: cert.tokenId,
        tokenURI: cert.tokenURI,
        owner: cert.owner
      });
    });
    console.log();

    // Test 3: Test certificate verification
    if (certificates.length > 0) {
      console.log('3️⃣ Testing certificate verification...');
      const firstCert = certificates[0];
      const verification = await blockchainService.verifyCertificate(firstCert.tokenId);
      console.log(`✅ Verification for token ${firstCert.tokenId}:`, verification);
      console.log();
    }

    // Test 4: Test IPFS connection (if credentials are provided)
    console.log('4️⃣ Testing IPFS connection...');
    if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY) {
      const ipfsConnected = await ipfsService.testConnection();
      console.log(`${ipfsConnected ? '✅' : '❌'} IPFS/Pinata connection:`, ipfsConnected);
    } else {
      console.log('⚠️ IPFS credentials not provided, skipping test');
    }
    console.log();

    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testServices();
