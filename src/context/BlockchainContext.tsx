/**
 * Blockchain React Context for Kudumba Vault
 * Manages wallet connection, contract state, and blockchain operations
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { blockchainService, WalletInfo, BlockchainTx, BlockchainDocRecord } from "@/services/blockchain";
import { hashFile, hashData, encryptFile, generateEncryptionKey, exportKey } from "@/services/crypto";

// ─── Types ──────────────────────────────────────────────────────────────────────

export type BlockchainStatus = "disconnected" | "connecting" | "connected" | "deploying" | "error";

interface BlockchainContextType {
  // Connection state
  status: BlockchainStatus;
  wallet: WalletInfo | null;
  error: string | null;
  contractAddress: string;
  transactions: BlockchainTx[];

  // Connection actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  deployContract: () => Promise<string>;
  connectToContract: (address: string) => Promise<void>;

  // Document operations
  registerDocumentOnChain: (file: File | null, name: string, category: string) => Promise<{
    hash: string;
    tx: BlockchainTx;
    encryptionKey?: string;
  }>;
  verifyDocumentOnChain: (hash: string) => Promise<BlockchainDocRecord>;
  grantAccessOnChain: (docHash: string, memberAddress: string, expiresAt?: number) => Promise<BlockchainTx>;
  revokeAccessOnChain: (docHash: string, memberAddress: string) => Promise<BlockchainTx>;
  checkAccessOnChain: (docHash: string, memberAddress: string) => Promise<boolean>;
  getOnChainDocCount: () => Promise<number>;

  // Crypto utilities
  hashFileLocally: (file: File) => Promise<string>;
  hashDataLocally: (data: string) => Promise<string>;

  // Helpers
  isContractReady: boolean;
  getExplorerUrl: (txHash: string) => string;
}

const BlockchainContext = createContext<BlockchainContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────────

export function BlockchainProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BlockchainStatus>("disconnected");
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contractAddr, setContractAddr] = useState<string>("");
  const [transactions, setTransactions] = useState<BlockchainTx[]>([]);
  const listenersAttached = useRef(false);

  // ─── MetaMask event listeners ──────────────────────────────────────────────

  useEffect(() => {
    if (!blockchainService.isWalletAvailable() || listenersAttached.current) return;
    listenersAttached.current = true;

    const handleAccountsChanged = async (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts.length === 0) {
        setStatus("disconnected");
        setWallet(null);
        setContractAddr("");
        blockchainService.disconnect();
      } else {
        const info = await blockchainService.getWalletInfo();
        if (info) setWallet(info);
      }
    };

    const handleChainChanged = () => {
      // Reload on chain change as recommended by MetaMask
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
      listenersAttached.current = false;
    };
  }, []);

  // ─── Connection Actions ────────────────────────────────────────────────────

  const connectWallet = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);
      const info = await blockchainService.connectWallet();
      setWallet(info);
      setStatus("connected");

      // Check for stored contract address
      const savedAddr = localStorage.getItem("kudumba_contract_address");
      if (savedAddr) {
        try {
          await blockchainService.connectToContract(savedAddr);
          setContractAddr(savedAddr);
        } catch {
          localStorage.removeItem("kudumba_contract_address");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
      setStatus("error");
      throw err;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    blockchainService.disconnect();
    blockchainService.removeAllListeners();
    setStatus("disconnected");
    setWallet(null);
    setContractAddr("");
    setError(null);
  }, []);

  const deployContract = useCallback(async () => {
    try {
      setStatus("deploying");
      setError(null);
      const address = await blockchainService.deployContract();
      setContractAddr(address);
      localStorage.setItem("kudumba_contract_address", address);
      setStatus("connected");
      return address;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to deploy contract";
      setError(msg);
      setStatus("error");
      throw err;
    }
  }, []);

  const connectToContract = useCallback(async (address: string) => {
    try {
      await blockchainService.connectToContract(address);
      setContractAddr(address);
      localStorage.setItem("kudumba_contract_address", address);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect to contract";
      setError(msg);
      throw err;
    }
  }, []);

  // ─── Document Operations ───────────────────────────────────────────────────

  const registerDocumentOnChain = useCallback(async (
    file: File | null,
    name: string,
    category: string
  ) => {
    let docHash: string;
    let encryptionKeyHex: string | undefined;

    if (file) {
      // Real file: compute SHA-256 hash and encrypt
      docHash = await hashFile(file);
      const key = await generateEncryptionKey();
      await encryptFile(file, key);
      encryptionKeyHex = await exportKey(key);
    } else {
      // Text-based credential: hash the name as data
      docHash = await hashData(name + "_" + Date.now().toString());
    }

    // Register on blockchain
    const tx = await blockchainService.registerDocument(docHash, name, category);
    setTransactions(prev => [...prev, tx]);

    return { hash: docHash, tx, encryptionKey: encryptionKeyHex };
  }, []);

  const verifyDocumentOnChain = useCallback(async (hash: string) => {
    return blockchainService.verifyDocument(hash);
  }, []);

  const grantAccessOnChain = useCallback(async (
    docHash: string,
    memberAddress: string,
    expiresAt = 0
  ) => {
    const tx = await blockchainService.grantAccess(docHash, memberAddress, expiresAt);
    setTransactions(prev => [...prev, tx]);
    return tx;
  }, []);

  const revokeAccessOnChain = useCallback(async (
    docHash: string,
    memberAddress: string
  ) => {
    const tx = await blockchainService.revokeAccess(docHash, memberAddress);
    setTransactions(prev => [...prev, tx]);
    return tx;
  }, []);

  const checkAccessOnChain = useCallback(async (
    docHash: string,
    memberAddress: string
  ) => {
    return blockchainService.checkAccess(docHash, memberAddress);
  }, []);

  const getOnChainDocCount = useCallback(async () => {
    return blockchainService.getDocumentCount();
  }, []);

  // ─── Crypto Utilities ──────────────────────────────────────────────────────

  const hashFileLocally = useCallback(async (file: File) => {
    return hashFile(file);
  }, []);

  const hashDataLocally = useCallback(async (data: string) => {
    return hashData(data);
  }, []);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const isContractReady = status === "connected" && contractAddr !== "";

  const getExplorerUrl = useCallback((txHash: string) => {
    return blockchainService.getExplorerUrl(txHash);
  }, []);

  return (
    <BlockchainContext.Provider
      value={{
        status,
        wallet,
        error,
        contractAddress: contractAddr,
        transactions,
        connectWallet,
        disconnectWallet,
        deployContract,
        connectToContract,
        registerDocumentOnChain,
        verifyDocumentOnChain,
        grantAccessOnChain,
        revokeAccessOnChain,
        checkAccessOnChain,
        getOnChainDocCount,
        hashFileLocally,
        hashDataLocally,
        isContractReady,
        getExplorerUrl,
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

export function useBlockchain() {
  const ctx = useContext(BlockchainContext);
  if (!ctx) throw new Error("useBlockchain must be used within BlockchainProvider");
  return ctx;
}
