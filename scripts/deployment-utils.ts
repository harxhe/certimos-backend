import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Utility function to save deployment information (without deployment logic)
export async function saveDeploymentInfo(deploymentInfo: DeploymentInfo) {
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
    
    // Initialize network if it doesn't exist
    if (!currentDeployments[deploymentInfo.network]) {
      currentDeployments[deploymentInfo.network] = deploymentEntry;
    } else {
      // If network exists, add this deployment as a nested object with contractName as key
      currentDeployments[deploymentInfo.network][deploymentInfo.contractName] = deploymentEntry;
    }
    
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
