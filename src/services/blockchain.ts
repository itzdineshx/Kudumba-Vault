/**
 * Blockchain Service for Kudumba Vault
 * Real Ethereum blockchain integration using ethers.js v6
 * Supports: Sepolia Testnet, Local Hardhat, and any EVM-compatible network
 */

import { ethers, BrowserProvider, Contract, JsonRpcSigner, TransactionReceipt } from "ethers";
import KudumbaVaultArtifact from "@/contracts/KudumbaVault.json";
import { toBytes32 } from "./crypto";

// ─── Network Configuration ─────────────────────────────────────────────────────

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  contractAddress: string;
  currency: { name: string; symbol: string; decimals: number };
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  sepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia Testnet",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    contractAddress: "", // Set after deployment
    currency: { name: "Sepolia ETH", symbol: "SEP", decimals: 18 },
  },
  localhost: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "",
    contractAddress: "",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface BlockchainDocRecord {
  exists: boolean;
  owner: string;
  name: string;
  category: string;
  timestamp: number;
}

export interface BlockchainTx {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  status: "confirmed" | "pending" | "failed";
  gasUsed: string;
  explorerUrl?: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
  network: string;
  chainId: number;
}

// ─── Blockchain Service Class ───────────────────────────────────────────────────

class BlockchainService {
  private provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private contract: Contract | null = null;
  private _currentNetwork: NetworkConfig | null = null;
  private _contractAddress: string = "";
  private _transactions: BlockchainTx[] = [];

  /**
   * Check if MetaMask (or any EIP-1193 provider) is available
   */
  isWalletAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
  }

  /**
   * Connect to MetaMask wallet
   */
  async connectWallet(): Promise<WalletInfo> {
    if (!this.isWalletAvailable()) {
      throw new Error("MetaMask or a compatible wallet is required. Please install MetaMask.");
    }

    this.provider = new BrowserProvider(window.ethereum);
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();

    const address = await this.signer.getAddress();
    const balance = ethers.formatEther(await this.provider.getBalance(address));
    const network = await this.provider.getNetwork();

    this._currentNetwork = Object.values(SUPPORTED_NETWORKS).find(
      n => BigInt(n.chainId) === network.chainId
    ) || null;

    return {
      address,
      balance,
      network: this._currentNetwork?.name || `Chain ${network.chainId}`,
      chainId: Number(network.chainId),
    };
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this._currentNetwork = null;
  }

  /**
   * Get current wallet info
   */
  async getWalletInfo(): Promise<WalletInfo | null> {
    if (!this.signer || !this.provider) return null;
    try {
      const address = await this.signer.getAddress();
      const balance = ethers.formatEther(await this.provider.getBalance(address));
      const network = await this.provider.getNetwork();
      return {
        address,
        balance,
        network: this._currentNetwork?.name || `Chain ${network.chainId}`,
        chainId: Number(network.chainId),
      };
    } catch {
      return null;
    }
  }

  /**
   * Switch to a supported network in MetaMask
   */
  async switchNetwork(networkKey: string): Promise<void> {
    const config = SUPPORTED_NETWORKS[networkKey];
    if (!config) throw new Error(`Unsupported network: ${networkKey}`);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${config.chainId.toString(16)}` }],
      });
    } catch (switchError: unknown) {
      // Chain not added to MetaMask, try adding it
      if ((switchError as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${config.chainId.toString(16)}`,
            chainName: config.name,
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : undefined,
            nativeCurrency: config.currency,
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Deploy the KudumbaVault contract to the current network
   */
  async deployContract(): Promise<string> {
    if (!this.signer) throw new Error("Wallet not connected");

    const factory = new ethers.ContractFactory(
      KudumbaVaultArtifact.abi,
      KudumbaVaultArtifact.bytecode,
      this.signer
    );

    const contract = await factory.deploy();
    await contract.waitForDeployment();
    const address = await contract.getAddress();

    this._contractAddress = address;
    this.contract = new Contract(address, KudumbaVaultArtifact.abi, this.signer);

    return address;
  }

  /**
   * Connect to an already-deployed contract
   */
  async connectToContract(address: string): Promise<void> {
    if (!this.signer) throw new Error("Wallet not connected");
    this._contractAddress = address;
    this.contract = new Contract(address, KudumbaVaultArtifact.abi, this.signer);
  }

  /**
   * Get the contract address
   */
  get contractAddress(): string {
    return this._contractAddress;
  }

  /**
   * Get the current network config
   */
  get currentNetwork(): NetworkConfig | null {
    return this._currentNetwork;
  }

  /**
   * Get all recorded transactions
   */
  get transactions(): BlockchainTx[] {
    return [...this._transactions];
  }

  // ─── Contract Interaction Methods ───────────────────────────────────────────

  /**
   * Register a document hash on the blockchain
   */
  async registerDocument(
    docHash: string,
    name: string,
    category: string
  ): Promise<BlockchainTx> {
    if (!this.contract || !this.signer) throw new Error("Contract not connected");

    const bytes32Hash = toBytes32(docHash);
    const tx = await this.contract.registerDocument(bytes32Hash, name, category);
    const receipt: TransactionReceipt = await tx.wait();

    const blockchainTx = await this._buildTxRecord(receipt);
    this._transactions.push(blockchainTx);
    return blockchainTx;
  }

  /**
   * Verify a document hash against the blockchain
   */
  async verifyDocument(docHash: string): Promise<BlockchainDocRecord> {
    if (!this.contract) throw new Error("Contract not connected");

    const bytes32Hash = toBytes32(docHash);
    const result = await this.contract.verifyDocument(bytes32Hash);

    return {
      exists: result[0],
      owner: result[1],
      name: result[2],
      category: result[3],
      timestamp: Number(result[4]),
    };
  }

  /**
   * Grant document access to a member address on-chain
   */
  async grantAccess(
    docHash: string,
    memberAddress: string,
    expiresAt: number = 0
  ): Promise<BlockchainTx> {
    if (!this.contract || !this.signer) throw new Error("Contract not connected");

    const bytes32Hash = toBytes32(docHash);
    const tx = await this.contract.grantAccess(bytes32Hash, memberAddress, expiresAt);
    const receipt: TransactionReceipt = await tx.wait();

    const blockchainTx = await this._buildTxRecord(receipt);
    this._transactions.push(blockchainTx);
    return blockchainTx;
  }

  /**
   * Revoke document access from a member address on-chain
   */
  async revokeAccess(
    docHash: string,
    memberAddress: string
  ): Promise<BlockchainTx> {
    if (!this.contract || !this.signer) throw new Error("Contract not connected");

    const bytes32Hash = toBytes32(docHash);
    const tx = await this.contract.revokeAccess(bytes32Hash, memberAddress);
    const receipt: TransactionReceipt = await tx.wait();

    const blockchainTx = await this._buildTxRecord(receipt);
    this._transactions.push(blockchainTx);
    return blockchainTx;
  }

  /**
   * Check if an address has access to a document
   */
  async checkAccess(docHash: string, memberAddress: string): Promise<boolean> {
    if (!this.contract) throw new Error("Contract not connected");

    const bytes32Hash = toBytes32(docHash);
    return this.contract.hasAccess(bytes32Hash, memberAddress);
  }

  /**
   * Get document count for an address
   */
  async getDocumentCount(ownerAddress?: string): Promise<number> {
    if (!this.contract || !this.signer) throw new Error("Contract not connected");

    const address = ownerAddress || await this.signer.getAddress();
    const count = await this.contract.getDocumentCount(address);
    return Number(count);
  }

  /**
   * Get the explorer URL for a transaction
   */
  getExplorerUrl(txHash: string): string {
    if (!this._currentNetwork?.explorerUrl) return "";
    return `${this._currentNetwork.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Listen for blockchain events
   */
  onDocumentRegistered(callback: (docHash: string, owner: string, name: string, category: string, timestamp: number) => void): void {
    if (!this.contract) return;
    this.contract.on("DocumentRegistered", (docHash, owner, name, category, timestamp) => {
      callback(docHash, owner, name, category, Number(timestamp));
    });
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    if (this.contract) {
      this.contract.removeAllListeners();
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async _buildTxRecord(receipt: TransactionReceipt): Promise<BlockchainTx> {
    const block = await receipt.provider.getBlock(receipt.blockNumber);
    return {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: block?.timestamp || Math.floor(Date.now() / 1000),
      from: receipt.from,
      to: receipt.to || "",
      status: receipt.status === 1 ? "confirmed" : "failed",
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: this.getExplorerUrl(receipt.hash),
    };
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();

// ─── Global type declarations for MetaMask ──────────────────────────────────────

declare global {
  interface Window {
    ethereum: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
