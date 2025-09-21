import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.connect();


const r1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


export function getReceiverId(): Promise<string> {
  return new Promise((resolve) => {
    r1.question('Enter the receiverId: ', (receiverId) => {
      resolve(receiverId);
    });
  });
}

// Function to save deployment info
async function saveDeploymentInfo(contractAddress: string, deployer: string, deployTx: any, networkName: string) {
  const deploymentInfo = {
    contractAddress,
    network: networkName,
    blockNumber: deployTx.blockNumber || 0,
    transactionHash: deployTx.hash || "",
    deployedAt: new Date().toISOString(),
    deployer
  };

  const deploymentsPath = path.join(__dirname, "deployments.ts");
  
  // Read existing deployments or create new
  let deploymentsContent = `export interface DeploymentInfo {
  contractAddress: string;
  network: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
}

export interface DeploymentConfig {
  [network: string]: DeploymentInfo;
}

export const deployments: DeploymentConfig = {\n`;

  // Try to read existing deployments
  try {
    if (fs.existsSync(deploymentsPath)) {
      const existingContent = fs.readFileSync(deploymentsPath, 'utf8');
      const match = existingContent.match(/export const deployments: DeploymentConfig = ({[\s\S]*?});/);
      if (match) {
        const existingDeployments = eval((`${match[1]}`));
        existingDeployments[networkName] = deploymentInfo;
        
        deploymentsContent = `export interface DeploymentInfo {
  contractAddress: string;
  network: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
}

export interface DeploymentConfig {
  [network: string]: DeploymentInfo;
}

export const deployments: DeploymentConfig = ${JSON.stringify(existingDeployments, null, 2)};`;
      }
    } else {
      deploymentsContent += `  "${networkName}": ${JSON.stringify(deploymentInfo, null, 4)}\n`;
      deploymentsContent += `};`;
    }
  } catch (error) {
    deploymentsContent += `  "${networkName}": ${JSON.stringify(deploymentInfo, null, 4)}\n`;
    deploymentsContent += `};`;
  }

  fs.writeFileSync(deploymentsPath, deploymentsContent);
  console.log("📝 Deployment info saved to deployments.ts");
}

async function main() {

  const receivingID  = await getReceiverId();

  console.log("Deploying Certificate contract...");

  // Get the first signer (deployer) as the initial owner
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get the ContractFactory for Certificate
  const Certificate = await ethers.getContractFactory("Certificate");

  // Deploy the contract with the deployer as the initial owner
  const certificate = await Certificate.deploy(deployer.address);

  // Wait for the deployment to be mined
  await certificate.waitForDeployment();

  // Get the deployed contract address
  const address = await certificate.getAddress();
  
  // Get deployment transaction details
  const deployTx = certificate.deploymentTransaction();

  console.log("Certificate deployed to:", address);
  console.log("Contract owner:", await certificate.getFunction("owner")());
  
  // Save deployment info to file
  const networkName = process.env.HARDHAT_NETWORK || "localhost";
  await saveDeploymentInfo(address, deployer.address, deployTx, networkName);
  
  console.log("Deployment successful!");

  // Example: Mint certificates to recipients
  console.log("\n--- Minting Certificates ---");
  
  // Define recipients and their certificate metadata URIs
  const recipients = [
    {
      address: receivingID, // Example recipient address
      tokenURI: "ipfs://QmYourMetadataHash1" // Replace with actual IPFS URI
    }
    // Add more recipients here as needed
  ];

  // Mint certificates for each recipient
  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    console.log(`Minting certificate ${i + 1} for recipient: ${recipient.address}`);
    
    try {
      const tx = await certificate.getFunction("mintCertificate")(recipient.address, recipient.tokenURI);
      await tx.wait(); // Wait for transaction to be mined
      console.log(`✅ Certificate minted successfully! Transaction: ${tx.hash}`);
    } catch (error) {
      console.error(`❌ Failed to mint certificate for ${recipient.address}:`, error);
    }
  }
  console.log("\n--- Certificate Minting Complete ---");

}
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error deploying contract:", error);
    process.exit(1);
  });