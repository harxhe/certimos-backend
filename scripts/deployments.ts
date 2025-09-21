export interface DeploymentInfo {
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

export const deployments: DeploymentConfig = {
  "apothem": {
    "contractAddress": "0xBe285C5749061Bea804E509ee4eae309B0Fc4949",
    "network": "apothem",
    "blockNumber": 73848370,
    "transactionHash": "0x34ddf51d4169cadc7a41a7e49e9f6278de5808696ccba24c9fac6038b4adef87",
    "deployedAt": "2025-09-21T17:57:17.033Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "Certificate",
    "owner": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385"
  }
};