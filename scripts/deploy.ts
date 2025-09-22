import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.connect();

// Define the structure for deployment information
interface DeploymentInfo {
  contractAddress: string;
  network: string;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
  contractName: string;
  owner: string;
}

// NOTE: A full implementation for saving to deployments.ts would go here.
// For now, this is a placeholder to show where it would be called.
async function saveDeploymentInfo(deploymentInfo: DeploymentInfo) {
  console.log("📝 Saving deployment information...");
  
  const deploymentsFilePath = path.join(__dirname, 'deployments.ts');
  
  try {
    let currentDeployments: Record<string, any> = {};
    
    // Read and parse the current deployments file if it exists
    if (fs.existsSync(deploymentsFilePath)) {
      const deploymentsContent = fs.readFileSync(deploymentsFilePath, 'utf8');
      
      // Extract the deployments object from the file using regex
      const deploymentMatch = deploymentsContent.match(/export const deployments: Record<string, DeploymentConfig> = ({[\s\S]*?});/);
      if (deploymentMatch) {
        try {
          // Parse the JSON part
          currentDeployments = JSON.parse(deploymentMatch[1]);
        } catch (parseError) {
          console.warn("Could not parse existing deployments, starting fresh:", parseError);
          currentDeployments = {};
        }
      }
    }
    
    // Create deployment entry
    const deploymentEntry = {
      contractAddress: deploymentInfo.contractAddress,
      network: deploymentInfo.network,
      blockNumber: 0, // You might want to get this from the transaction receipt
      transactionHash: deploymentInfo.transactionHash,
      deployedAt: deploymentInfo.deployedAt,
      deployer: deploymentInfo.deployer,
      contractName: deploymentInfo.contractName,
      owner: deploymentInfo.owner
    };
    
    // Add/update the deployment entry using contractName as the key
    currentDeployments[deploymentInfo.contractName] = deploymentEntry;
    
    // Generate the new file content
    const newContent = `// Updated interfaces... 

  interface DeploymentConfig {
    contractAddress: string;
    network: string;
    blockNumber: number;
    transactionHash: string;
    deployedAt: string;
    deployer: string;
    [key: string]: any; // For additional dynamic properties like contractName, owner, etc.
  }


export const deployments: Record<string, DeploymentConfig> = ${JSON.stringify(currentDeployments, null, 2)};
`;
    
    // Write the updated deployments file
    fs.writeFileSync(deploymentsFilePath, newContent, 'utf8');
    console.log(`✅ Deployment information saved to ${deploymentsFilePath}`);
    console.log(`📍 Contract "${deploymentInfo.contractName}" added to network "${deploymentInfo.network}"`);
    
  } catch (error) {
    console.error("❌ Error saving deployment information:", error);
    throw error;
  }
}

async function main() {
  // Get parameters from environment variables set by the API
  const ownerAddress = process.env.DEPLOY_WALLET_ADDRESS;
  const contractName = process.env.DEPLOY_CONTRACT_NAME;
  const networkName = process.env.DEPLOY_NETWORK_NAME || 'apothem';

  // 2. Validate the inputs
  if (!ownerAddress) {
    throw new Error("Missing wallet address. DEPLOY_WALLET_ADDRESS environment variable not set.");
  }
  if (!contractName) {
    throw new Error("Missing contract name. DEPLOY_CONTRACT_NAME environment variable not set.");
  }

  console.log(`Deploying contract "${contractName}"...`);
  console.log(`Owner will be set to (from .env): ${ownerAddress}`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  console.log("\nGetting contract factory for 'Certificate'...");
  const Certificate = await ethers.getContractFactory("Certificate");

  console.log(`Sending deployment transaction with owner ${ownerAddress}... (This may take a moment)`);
  const certificate = await Certificate.deploy(ownerAddress);

  console.log("Waiting for deployment transaction to be mined...");
  await certificate.waitForDeployment();
  console.log("✅ Deployment transaction mined!");


  const address = await certificate.getAddress();
  const deployTx = certificate.deploymentTransaction();

  console.log(`\n"${contractName}" deployed to address:`, address);
  console.log("Verified contract owner:", await certificate.getFunction("owner")());
    
  const deploymentInfo: DeploymentInfo = {
      contractAddress: address,
      network: networkName,
      transactionHash: deployTx?.hash || '',
      deployedAt: new Date().toISOString(),
      deployer: deployer.address,
      contractName: contractName,
      owner: ownerAddress
  };

 await saveDeploymentInfo(deploymentInfo);
  console.log("\nDeployment successful!");

  // 3. Output the final result as a JSON string for the API to parse
  const result = {
    success: true,
    deploymentInfo
  };
  
  console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    const result = { success: false, error: error.message };
    // Also output a JSON result on failure
    console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
    process.exit(1);
  });

