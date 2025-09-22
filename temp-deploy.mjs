
import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { ethers } = await network.connect();

// CHANGED: Updated function to save the new deployment info structure
async function saveDeploymentInfo(contractAddress, deployer, deployTx, networkName, contractName, owner) {
  const deploymentInfo = {
    contractAddress,
    network: networkName,
    blockNumber: deployTx.blockNumber || 0,
    transactionHash: deployTx.hash || "",
    deployedAt: new Date().toISOString(),
    deployer,
    contractName, // ADDED
    owner,        // ADDED
  };

  const deploymentsPath = path.join(__dirname, "../scripts/deployments.ts");

  // Type definitions for the deployments file
  const fileHeader = `export interface DeploymentInfo {
  contractAddress: string;
  network: string;
  blockNumber: number;
  transactionHash: string;
  deployedAt: string;
  deployer: string;
  contractName: string;
  owner: string;
}

export interface DeploymentConfig {
  [network: string]: DeploymentInfo;
}

export const deployments: DeploymentConfig = `;

  let deployments = {};
  // Try to read existing deployments
  if (fs.existsSync(deploymentsPath)) {
    try {
      // A safer way to extract the object without eval
      const existingContent = fs.readFileSync(deploymentsPath, 'utf8');
      const jsonString = existingContent.substring(existingContent.indexOf('{'));
      deployments = JSON.parse(jsonString.replace(/;\s*$/, ''));
    } catch (e) {
      console.error("Could not parse existing deployments.ts file, will overwrite.", e);
      deployments = {};
    }
  }

  deployments[networkName] = deploymentInfo;
  
  const deploymentsContent = fileHeader + JSON.stringify(deployments, null, 2) + ';';

  fs.writeFileSync(deploymentsPath, deploymentsContent);
  console.log("📝 Deployment info saved to deployments.ts");
  return deploymentInfo;
}

async function main() {
  // REMOVED: No longer need receiverId or test minting
  const ownerAddress = "0x49a67881cCabd2b8cCD71d77400edc8a831fC385";
  const contractName = "Certificate";
  const networkName = "apothem";

  console.log(`Deploying ${contractName} contract...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const Certificate = await ethers.getContractFactory("Certificate");
  // CHANGED: Pass the owner's address to the constructor
  const certificate = await Certificate.deploy(ownerAddress);
  await certificate.waitForDeployment();

  const address = await certificate.getAddress();
  const deployTx = certificate.deploymentTransaction();

  console.log(`${contractName} deployed to:`, address);
  console.log("Contract owner set to:", await certificate.getFunction("owner")());

  // CHANGED: Save extended deployment info
  const deploymentInfo = await saveDeploymentInfo(address, deployer.address, deployTx, networkName, contractName, ownerAddress);

  console.log("Deployment successful!");

  const result = {
    success: true,
    contractAddress: address,
    transactionHash: deployTx?.hash || '',
    deploymentInfo
  };
  
  console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error deploying contract:", error);
    const result = { success: false, error: error.message };
    console.log("DEPLOYMENT_RESULT:", JSON.stringify(result));
    process.exit(1);
  });
