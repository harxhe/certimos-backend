// Updated interfaces... 

  interface DeploymentConfig {
    contractAddress: string;
    network: string;
    blockNumber: number;
    transactionHash: string;
    deployedAt: string;
    deployer: string;
    [key: string]: any; // For additional dynamic properties like contractName, owner, etc.
  }


export const deployments: Record<string, DeploymentConfig> = {
  "Hackathon of country": {
    "contractAddress": "0x877cf4f51dd3DFD7eEDCE6498eC9d893DD9db05a",
    "network": "apothem",
    "blockNumber": 0,
    "transactionHash": "0x8c445035bea8d9d561329c483347a1ca6cee20e923a3289ec3707dccf51db58a",
    "deployedAt": "2025-09-22T07:10:34.249Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "Hackathon of country",
    "owner": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385"
  },
  "Marathon": {
    "contractAddress": "0xf6FAB1c38E245C6855bd2292C1175C5a89bF5F89",
    "network": "apothem",
    "blockNumber": 0,
    "transactionHash": "0x465634db0343a9eac1216d6517983f9d6a0ed5b97646870deb19fe5a6eec801d",
    "deployedAt": "2025-09-22T09:59:17.847Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "Marathon",
    "owner": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385"
  },
  "DelhiMarathon": {
    "contractAddress": "0xac38519B12DD55D0Edb8B38F1407171b9d5aA9B7",
    "network": "apothem",
    "blockNumber": 0,
    "transactionHash": "0x560aaa9a899cf2878fcb0420e747611dacfd0538571f35d436155bcea82d70c9",
    "deployedAt": "2025-09-22T11:50:52.719Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "DelhiMarathon",
    "owner": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385"
  },
  "SPORTSEVENT": {
    "contractAddress": "0xeb15f0FE27e25Ab7732b5fa1D5711697D4345b40",
    "network": "apothem",
    "blockNumber": 0,
    "transactionHash": "0x74e4f116d8a301099b752f0adc53992b9bd7f5dc875b360c1fa26ab10e1b6756",
    "deployedAt": "2025-09-22T12:01:25.537Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "SPORTSEVENT",
    "owner": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385"
  },
  "apothem": {
    "contractAddress": "0x0558198a3249fc66f09D631Ca61ed7FBDf4CAb76",
    "network": "apothem",
    "blockNumber": 0,
    "transactionHash": "0x4703cf852770aafa22655cf5628f793bb13c0c7b646cf9976a2b5a3e4fdd729f",
    "deployedAt": "2025-10-11T20:22:04.966Z",
    "deployer": "0x49a67881cCabd2b8cCD71d77400edc8a831fC385",
    "contractName": "VIT HACK",
    "owner": "0xb0feb403dcfbefb1c560bea60ba4a5727a367013",
    "HACKAAA": {
      "contractAddress": "0x0753C14ce096918A458ce0D35516797667071b55",
      "network": "apothem",
      "blockNumber": 0,
      "transactionHash": "0x230cac43a4ee392c1549b311c387d7e979d92e90e71c202917c3a4104b63b447",
      "deployedAt": "2025-10-11T20:36:12.748Z",
      "deployer": "0xaacae99d6e2bf87813233e3d46eb48c9f796016c",
      "contractName": "HACKAAA",
      "owner": "0xaacae99d6e2bf87813233e3d46eb48c9f796016c"
    },
    "VIT HACK": {
      "contractAddress": "0xEa23289AA36686d3cB805a75cA14142cebd6dF7f",
      "network": "apothem",
      "blockNumber": 0,
      "transactionHash": "0x53d7bc6fd4d8d2193fa4f1cb3d449d3f93140468a82e29b2d8fc56831b17871c",
      "deployedAt": "2025-10-20T18:12:35.810Z",
      "deployer": "0xb0feb403dcfbefb1c560bea60ba4a5727a367013",
      "contractName": "VIT HACK",
      "owner": "0xb0feb403dcfbefb1c560bea60ba4a5727a367013"
    },
    "DIWALI": {
      "contractAddress": "0x5dD318a484b39A0622f3dd2bede5df815144eD89",
      "network": "apothem",
      "blockNumber": 0,
      "transactionHash": "0xa793148dae1339f1d4af1e30807bd87ce8f90f9d2c60fe0eb331c921991efea8",
      "deployedAt": "2025-10-21T09:37:26.469Z",
      "deployer": "0xaacae99d6e2bf87813233e3d46eb48c9f796016c",
      "contractName": "DIWALI",
      "owner": "0xaacae99d6e2bf87813233e3d46eb48c9f796016c"
    }
  }
};
