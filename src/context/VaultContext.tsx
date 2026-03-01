import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { VaultDocument, FamilyMember, SecurityAlert, UserRole, DocumentCategory, PrivacyLevel, BlockchainRecord } from "@/types/vault";
import { authApi, documentsApi, membersApi, alertsApi } from "@/services/api";

interface VaultContextType {
  isLoggedIn: boolean;
  userRole: UserRole;
  userId: string;
  userName: string;
  userEmail: string;
  familyName: string;
  documents: VaultDocument[];
  members: FamilyMember[];
  alerts: SecurityAlert[];
  isFirstTime: boolean;
  loading: boolean;
  register: (name: string, email: string, password: string, familyName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; encryptedWallet?: any }>;
  loginWithRole: (role: UserRole) => void;
  logout: () => void;
  addDocument: (name: string, category: DocumentCategory, privacy: PrivacyLevel, fileType: string, size: string, hash: string, blockchain?: BlockchainRecord, encryptionKey?: string, fileData?: string, originalName?: string, mimeType?: string) => Promise<VaultDocument>;
  deleteDocument: (docId: string) => Promise<void>;
  updateDocumentBlockchain: (docId: string, blockchain: BlockchainRecord) => Promise<void>;
  shareDocument: (docId: string, memberId: string, permission: "view-only" | "time-limited", expiresAt?: string) => Promise<void>;
  revokeAccess: (docId: string, memberId: string) => Promise<void>;
  addMember: (name: string, email: string, relationship: string, password: string, encryptedWallet?: any) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  addAlert: (alert: Omit<SecurityAlert, "id">) => Promise<void>;
  resetData: () => void;
  refreshData: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => authApi.hasToken());
  const [userRole, setUserRole] = useState<UserRole>("owner");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Check first-time status on mount ─────────────────────────────────────

  useEffect(() => {
    authApi.check()
      .then(res => setIsFirstTime(!res.hasUsers))
      .catch(() => setIsFirstTime(true))
      .finally(() => {
        if (!authApi.hasToken()) setLoading(false);
      });
  }, []);

  // ─── Restore session from JWT token on mount ──────────────────────────────

  useEffect(() => {
    if (!authApi.hasToken()) return;
    authApi.me()
      .then(user => {
        setUserId(user.id);
        setUserName(user.name);
        setUserEmail(user.email);
        setFamilyName(user.familyName);
        setUserRole(user.role as UserRole);
        setIsLoggedIn(true);
      })
      .catch(() => {
        authApi.clearToken();
        setIsLoggedIn(false);
      })
      .finally(() => setLoading(false));
  }, []);

  // ─── Load data when logged in ────────────────────────────────────────────

  const refreshData = useCallback(async () => {
    if (!authApi.hasToken()) return;
    try {
      const [docs, mems, alts] = await Promise.all([
        documentsApi.list(),
        membersApi.list(),
        alertsApi.list(),
      ]);
      setDocuments(docs as VaultDocument[]);
      setMembers(mems as FamilyMember[]);
      setAlerts(alts as SecurityAlert[]);
    } catch (err) {
      console.error("Failed to refresh data:", err);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) refreshData();
  }, [isLoggedIn, refreshData]);

  // ─── Auth Actions ─────────────────────────────────────────────────────────

  const register = useCallback(async (name: string, email: string, password: string, family: string) => {
    const res = await authApi.register({ name, email, password, familyName: family });
    authApi.saveToken(res.token);
    setUserId(res.user.id);
    setUserName(res.user.name);
    setUserEmail(res.user.email);
    setFamilyName(res.user.familyName);
    setUserRole(res.user.role as UserRole);
    setIsFirstTime(false);
    setIsLoggedIn(true);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; encryptedWallet?: any }> => {
    try {
      const res = await authApi.login({ email, password });
      authApi.saveToken(res.token);
      setUserId(res.user.id);
      setUserName(res.user.name);
      setUserEmail(res.user.email);
      setFamilyName(res.user.familyName);
      setUserRole(res.user.role as UserRole);
      setIsLoggedIn(true);
      return { success: true, encryptedWallet: res.encryptedWallet };
    } catch {
      return { success: false };
    }
  }, []);

  const loginWithRole = useCallback((role: UserRole) => {
    setUserRole(role);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    authApi.clearToken();
    setIsLoggedIn(false);
    setDocuments([]);
    setMembers([]);
    setAlerts([]);
    setUserId("");
    setUserName("");
    setUserEmail("");
    setFamilyName("");
  }, []);

  // ─── Document Actions (API-backed) ────────────────────────────────────────

  const addDocument = useCallback(async (
    name: string, category: DocumentCategory, privacy: PrivacyLevel,
    fileType: string, size: string, hash: string,
    blockchain?: BlockchainRecord, encryptionKey?: string,
    fileData?: string, originalName?: string, mimeType?: string
  ): Promise<VaultDocument> => {
    const doc = await documentsApi.create({
      name, category, privacy, hash, fileType, size, encryptionKey,
      blockchain, userName: userName || "Owner",
      fileData, originalName, mimeType,
    });
    setDocuments(prev => [doc as VaultDocument, ...prev]);
    return doc as VaultDocument;
  }, [userName]);

  const deleteDocument = useCallback(async (docId: string) => {
    await documentsApi.delete(docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));
  }, []);

  const updateDocumentBlockchain = useCallback(async (docId: string, blockchain: BlockchainRecord) => {
    const updated = await documentsApi.update(docId, { blockchain });
    setDocuments(prev => prev.map(d => d.id === docId ? (updated as VaultDocument) : d));
  }, []);

  const shareDocument = useCallback(async (docId: string, memberId: string, permission: "view-only" | "time-limited", expiresAt?: string) => {
    const member = members.find(m => m.id === memberId);
    const updated = await documentsApi.share(docId, {
      memberId, permission, expiresAt,
      memberName: member?.name, userName: userName || "Owner",
    });
    setDocuments(prev => prev.map(d => d.id === docId ? (updated as VaultDocument) : d));
  }, [members, userName]);

  const revokeAccess = useCallback(async (docId: string, memberId: string) => {
    const updated = await documentsApi.revoke(docId, memberId);
    setDocuments(prev => prev.map(d => d.id === docId ? (updated as VaultDocument) : d));
  }, []);

  // ─── Member Actions (API-backed) ─────────────────────────────────────────

  const addMember = useCallback(async (name: string, email: string, relationship: string, password: string, encryptedWallet?: any) => {
    const member = await membersApi.create({ name, email, relationship, password, encryptedWallet });
    setMembers(prev => [...prev, member as FamilyMember]);
  }, []);

  const removeMember = useCallback(async (id: string) => {
    await membersApi.delete(id);
    setMembers(prev => prev.filter(m => m.id !== id));
  }, []);

  // ─── Alert Actions (API-backed) ──────────────────────────────────────────

  const addAlert = useCallback(async (alert: Omit<SecurityAlert, "id">) => {
    const created = await alertsApi.create(alert);
    setAlerts(prev => [created as SecurityAlert, ...prev]);
  }, []);

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetData = useCallback(() => {
    authApi.clearToken();
    setDocuments([]);
    setMembers([]);
    setAlerts([]);
    setIsLoggedIn(false);
    setUserRole("owner");
    setUserName("");
    setUserEmail("");
    setFamilyName("");
  }, []);

  return (
    <VaultContext.Provider value={{
      isLoggedIn, userRole, userId, userName, userEmail, familyName, documents, members, alerts, isFirstTime, loading,
      register, login, loginWithRole, logout,
      addDocument, deleteDocument, updateDocumentBlockchain, shareDocument, revokeAccess,
      addMember, removeMember, addAlert, resetData, refreshData,
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
