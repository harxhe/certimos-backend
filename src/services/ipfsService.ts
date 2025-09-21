import axios from 'axios';

export class IPFSService {
  private pinataApiKey: string;
  private pinataSecretKey: string;
  private pinataBaseUrl = 'https://api.pinata.cloud';
  private ipfsGateway = 'https://gateway.pinata.cloud/ipfs/';

  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY!;
    this.pinataSecretKey = process.env.PINATA_SECRET_API_KEY!;
  }

  // Fetch metadata from IPFS
  async getMetadata(ipfsHash: string) {
    try {
      // Extract hash from full IPFS URL if needed
      const hash = ipfsHash.replace('ipfs://', '');
      
      const response = await axios.get(`${this.ipfsGateway}${hash}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching IPFS metadata:', error);
      throw new Error('Failed to fetch metadata from IPFS');
    }
  }

  // Test connection to Pinata
  async testConnection() {
    try {
      const response = await axios.get(`${this.pinataBaseUrl}/data/testAuthentication`, {
        headers: {
          'pinata_api_key': this.pinataApiKey,
          'pinata_secret_api_key': this.pinataSecretKey
        }
      });
      
      return response.data.authenticated;
    } catch (error) {
      return false;
    }
  }
}

export const ipfsService = new IPFSService();