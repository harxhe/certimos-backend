import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PINATA_API_KEY = process.env.PINATA_API_KEY || 'YOUR_PINATA_API_KEY';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || 'YOUR_PINATA_SECRET_KEY';

async function uploadToPinata() {
  console.log("🍍 Starting Pinata upload process...");
  
  if (PINATA_API_KEY === 'YOUR_PINATA_API_KEY' || PINATA_SECRET_KEY === 'YOUR_PINATA_SECRET_KEY') {
    console.log("Please set your Pinata credentials!");
    console.log("1. Get free account at: https://pinata.cloud");
    console.log("2. Add to .env file:");
    console.log("   PINATA_API_KEY=your_api_key");
    console.log("   PINATA_SECRET_KEY=your_secret_key");
    return;
  }

  const metadataDir = path.join(__dirname, '../metadata');
  const files = fs.readdirSync(metadataDir).filter(file => file.endsWith('.json'));

  console.log(`Found ${files.length} metadata files to upload`);

  const uploadedMetadata = [];

  for (const filename of files) {
    const filepath = path.join(metadataDir, filename);
    const metadataContent = fs.readFileSync(filepath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    console.log(`\nUploading ${filename} to Pinata...`);
    
    try {
      const formData = new FormData();
      const blob = new Blob([metadataContent], { type: 'application/json' });
      formData.append('file', blob, filename);
      
      const pinataMetadata = JSON.stringify({
        name: metadata.name || filename,
        keyvalues: {
          type: 'certificate-metadata',
          recipient: metadata.recipient_name || 'unknown'
        }
      });
      formData.append('pinataMetadata', pinataMetadata);

      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
          'pinata_api_key': PINATA_API_KEY,
          'pinata_secret_api_key': PINATA_SECRET_KEY,
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json() as { IpfsHash: string };
        const ipfsUri = `ipfs://${result.IpfsHash}`;
        
        console.log(`Uploaded successfully!`);
        console.log(`  File: ${filename}`);
        console.log(`   IPFS Hash: ${result.IpfsHash}`);
        console.log(`   IPFS URI: ${ipfsUri}`);

        uploadedMetadata.push({
          filename,
          certificateName: metadata.name || filename,
          cid: result.IpfsHash,
          ipfsUri,
          metadata
        });
      } else {
        const error = await response.text();
        console.log(`Failed to upload ${filename}: ${error}`);
      }
      
    } catch (error) {
      console.error(`Failed to upload ${filename}:`, error);
    }
  }

  // Save results
  const resultsPath = path.join(__dirname, 'uploaded-metadata.json');
  fs.writeFileSync(resultsPath, JSON.stringify(uploadedMetadata, null, 2));

  console.log(`\nUpload completed!`);
  console.log(`Results: ${uploadedMetadata.length} files uploaded successfully`);

  if (uploadedMetadata.length > 0) {
    console.log(`\n🔗 Your IPFS URIs:`);
    uploadedMetadata.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.certificateName}`);
      console.log(`      IPFS URI: ${item.ipfsUri}`);
    });
  }
}

uploadToPinata();
