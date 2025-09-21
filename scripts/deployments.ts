export interface DeploymentInfo {
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

export const deployments: DeploymentConfig = {
  "localhost": {
    "contractAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "network": "localhost",
    "blockNumber": 1,
    "transactionHash": "0x88baca3b51314de48df2e52a48e31a411a41cc02702fd088cdc1628a592a8662",
    "deployedAt": "2025-09-21T05:07:55.341Z",
    "deployer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
};