import { network } from "hardhat";
import dotenv from "dotenv";
dotenv.config();

// Function to get deployed contract address for current network
async function getDeployedContractAddress(): Promise<string | null> {
  try {
    const networkName = process.env.HARDHAT_NETWORK || "localhost";
    // Dynamic import to handle the file might not exist yet
    const { deployments } = await import("./deployments.js");
    
    if (deployments[networkName]) {
      return deployments[networkName].contractAddress;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function checkContractDeployment() {
  const { ethers } = await network.connect();
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  
  // Try to get address from deployments file first
  let contractAddress = await getDeployedContractAddress();
  
  if (!contractAddress) {
    // Fallback to manual address if deployments file doesn't exist
    contractAddress = "0xD1F6047B6D0A9C4eDad86404c185e80Eb8Dd172D"; // Replace with the address you want to check
    console.log("⚠  Using fallback address (deployments.ts not found or no deployment for this network)");
  } else {
    console.log("✅ Using address from deployments.ts");
  }
  
  console.log("🔍 Checking contract deployment status...");
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Network: ${networkName}`);

  try {
    // Method 1: Check if there's code at the address
    const code = await ethers.provider.getCode(contractAddress);
    
    if (code === "0x") {
      console.log("❌ No contract found at this address");
      console.log("   - The address might be wrong");
      console.log("   - The contract might not be deployed on this network");
      console.log("   - The contract might have been self-destructed");
      return false;
    }
    
    console.log("✅ Contract code found at address!");
    console.log(`   Code length: ${code.length} characters`);
    
    // Method 2: Try to connect to the contract and call a function
    try {
      const Certificate = await ethers.getContractFactory("Certificate");
      const certificate = Certificate.attach(contractAddress);
      
      // Try to call the owner function
      const owner = await certificate.getFunction("owner")();
      console.log("✅ Contract is functional!");
      console.log(`   Contract owner: ${owner}`);
      
      // Try to get contract name and symbol
      try {
        const name = await certificate.getFunction("name")();
        const symbol = await certificate.getFunction("symbol")();
        console.log(`   Token name: ${name}`);
        console.log(`   Token symbol: ${symbol}`);
      } catch (error) {
        console.log("   Note: Could not retrieve token name/symbol");
      }
      
      return true;
      
    } catch (error) {
      console.log("⚠  Contract exists but may not be the expected type");
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
    
  } catch (error) {
    console.error("❌ Error checking contract:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("🔍 CONTRACT DEPLOYMENT CHECKER");
  console.log("=".repeat(60));
  
  const isDeployed = await checkContractDeployment();
  
  console.log("\n" + "=".repeat(60));
  if (isDeployed) {
    console.log("🎉 RESULT: Contract is successfully deployed and functional!");
  } else {
    console.log("💡 RESULT: Contract is not deployed or not functional");
    console.log("\n📝 To deploy the contract, run:");
    console.log("   yarn hardhat run scripts/deploy.ts --network <network-name>");
  }
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });