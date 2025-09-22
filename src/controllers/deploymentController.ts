import { deployments } from "../../scripts/deployments.js";


export function fetchcontract(contractname: string) {
  console.log('Fetching contract for:', contractname);
  const deployment = deployments[contractname];
  if (!deployment) {
    throw new Error(`Contract "${contractname}" not found in deployments`);
  }
  console.log('Contract Address:', deployment);
  return deployment.contractAddress;
}

export function fetchviaowner(owneraddress: string) {
  const results = [];
  for (const key in deployments) {
    if (deployments[key].owner.toLowerCase() === owneraddress.toLowerCase()) {
      results.push({
        contractName: key,
        contractAddress: deployments[key].contractAddress,
        network: deployments[key].network,
        deployedAt: deployments[key].deployedAt
      });
    }
  }
  return results;
}