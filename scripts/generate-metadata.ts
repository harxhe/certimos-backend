import fs from 'fs';
import path from 'path';

// Create metadata directory if it doesn't exist
const metadataDir = './metadata';
if (!fs.existsSync(metadataDir)) {
  fs.mkdirSync(metadataDir);
}

// Certificate metadata template
interface CertificateMetadata {
  name: string;
  description: string;
  image: string; // URL to certificate image
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
  event_name?: string;
  recipient_name?: string;
  date_issued?: string;
  certificate_id?: string;
}

// *CUSTOMIZE YOUR CERTIFICATES HERE*
const certificates = [
  {
    id: 1,
    name: "DevJams 2024 - Blockchain Workshop Certificate",
    description: "This certificate acknowledges successful completion of the DevJams 2024 Blockchain Workshop. The holder has demonstrated proficiency in smart contract development, Web3 integration, and blockchain fundamentals.",
    image: "https://example.com/certificate-image-1.png", // Replace with actual image URL
    recipient_name: "Alice Smith",
    event_name: "DevJams 2024 Blockchain Workshop",
    date_issued: "2024-09-20",
    skills: ["Smart Contracts", "Solidity", "Web3", "Hardhat"],
    level: "Intermediate"
  },
  {
    id: 2,
    name: "DevJams 2024 - Advanced DeFi Certificate",
    description: "This certificate validates expertise in Decentralized Finance (DeFi) protocols, yield farming strategies, and liquidity provision mechanisms learned during DevJams 2024.",
    image: "https://example.com/certificate-image-2.png", // Replace with actual image URL
    recipient_name: "Bob Johnson",
    event_name: "DevJams 2024 DeFi Masterclass",
    date_issued: "2024-09-20",
    skills: ["DeFi", "Yield Farming", "Liquidity Pools", "AMM"],
    level: "Advanced"
  }
  // Add more certificates here
];

function generateMetadata() {
  console.log("🎨 Generating certificate metadata files...");
  
  certificates.forEach((cert) => {
    const metadata: CertificateMetadata = {
      name: cert.name,
      description: cert.description,
      image: cert.image,
      event_name: cert.event_name,
      recipient_name: cert.recipient_name,
      date_issued: cert.date_issued,
      attributes: [
        {
          trait_type: "Event",
          value: cert.event_name
        },
        {
          trait_type: "Recipient",
          value: cert.recipient_name
        },
        {
          trait_type: "Date Issued",
          value: cert.date_issued
        },
        {
          trait_type: "Level",
          value: cert.level
        },
        {
          trait_type: "Certificate ID",
          value: cert.id.toString()
        }
      ]
    };

    // Add skills as attributes
    cert.skills.forEach((skill, index) => {
      metadata.attributes.push({
        trait_type: `Skill ${index + 1}`,
        value: skill
      });
    });

    // Write metadata to JSON file
    const filename = `certificate-${cert.id}.json`;
    const filepath = path.join(metadataDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Generated: ${filename}`);
  });

  console.log(`\n📁 Metadata files saved in: ${metadataDir}/`);
  console.log("📤 Next step: Upload these files to IPFS using one of these methods:");
  console.log("   1. Pinata (https://pinata.cloud) - Easiest");
  console.log("   2. NFT.Storage (https://nft.storage) - Free");
  console.log("   3. Web3.Storage (https://web3.storage) - Free");
  console.log("   4. IPFS Desktop - Local node");
}

// Generate the metadata files
generateMetadata();