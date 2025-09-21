import { network } from "hardhat";
import { deployments } from "./deployments.js";

const { ethers } = await network.connect();

async function getCertificateInfo() {
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  const deployment = deployments[networkName];
  
  if (!deployment) {
    console.log(`❌ No deployment found for network: ${networkName}`);
    console.log("Available networks:", Object.keys(deployments));
    return;
  }
  
  const contractAddress = deployment.contractAddress;
  
  console.log("🎓 CERTIFICATE CONTRACT INFORMATION");
  console.log("=".repeat(50));
  
  try {
    // Connect to the contract
    const Certificate = await ethers.getContractFactory("Certificate");
    const certificate = Certificate.attach(contractAddress);
    
    // Get basic contract info
    console.log(`📜 Contract Address: ${contractAddress}`);
    console.log(`👑 Contract Owner: ${await certificate.getFunction("owner")()}`);
    console.log(`📛 Token Name: ${await certificate.getFunction("name")()}`);
    console.log(`🏷  Token Symbol: ${await certificate.getFunction("symbol")()}`);

    // Try to get certificate information for different token IDs
    console.log("\n🎯 MINTED CERTIFICATES:");
    console.log("-".repeat(50));
    
    let tokenId = 0;
    let certificatesFound = 0;
    
    // Check first 10 possible token IDs
    while (tokenId < 10) {
      try {
        const owner = await certificate.getFunction("ownerOf")(tokenId);
        const tokenURI = await certificate.getFunction("tokenURI")(tokenId);

        console.log(`\n🏆 Certificate ID: ${tokenId}`);
        console.log(`   Owner: ${owner}`);
        console.log(`   Metadata URI: ${tokenURI}`);
        
        certificatesFound++;
        tokenId++;
      } catch (error) {
        // Token doesn't exist, stop checking
        break;
      }
    }
    
    if (certificatesFound === 0) {
      console.log("   No certificates have been minted yet.");
      console.log("   Run the mint-certificate.ts script to mint certificates.");
    } else {
      console.log(`\n📊 Total Certificates Found: ${certificatesFound}`);
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("📋 METAMASK IMPORT INFORMATION:");
    console.log("=".repeat(50));
    console.log("🌐 Network: XDC Apothem Testnet");
    console.log("🔗 RPC URL: https://rpc.apothem.network/");
    console.log("🆔 Chain ID: 51");
    console.log("💰 Currency: TXDC");
    console.log("🔍 Explorer: https://explorer.apothem.network/");
    console.log(`📜 Contract Address: ${contractAddress}`);
    console.log("🎓 Contract Type: ERC-721 (NFT)");
    
    if (certificatesFound > 0) {
      console.log("\n🎯 Available Token IDs to import:");
      for (let i = 0; i < certificatesFound; i++) {
        console.log(`   Token ID: ${i}`);
      }
    }
    
  } catch (error) {
    console.error("❌ Error getting certificate info:", error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  await getCertificateInfo();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });