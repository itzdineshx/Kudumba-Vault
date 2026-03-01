export type UserRole = "owner" | "member";

export type DocumentCategory = "ids" | "banking" | "insurance" | "property" | "passwords";

export type PrivacyLevel = "private" | "shared";

export type Permission = "view-only" | "time-limited";

export interface BlockchainRecord {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  gasUsed: string;
  explorerUrl?: string;
  verified: boolean;
  onChainOwner?: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  privacy: PrivacyLevel;
  hash: string;
  timestamp: string;
  fileType: string;
  size: string;
  sharedWith: SharedAccess[];
  accessLog: AccessLogEntry[];
  blockchain?: BlockchainRecord;
  encryptionKey?: string;
}

export interface SharedAccess {
  memberId: string;
  permission: Permission;
  grantedAt: string;
  expiresAt?: string;
  revoked: boolean;
}

export interface AccessLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  ip?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  role: UserRole;
  avatarInitials: string;
  addedAt: string;
  walletAddress?: string;
  /** Whether this member has a managed (auto-generated) wallet */
  hasWallet?: boolean;
}

export interface SecurityAlert {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: "blocked" | "resolved" | "warning";
  ip: string;
  details: string;
}

export const CATEGORY_INFO: Record<DocumentCategory, { label: string; icon: string; color: string }> = {
  ids: { label: "IDs & Identity", icon: "🪪", color: "hsl(210, 80%, 55%)" },
  banking: { label: "Banking & Finance", icon: "🏦", color: "hsl(150, 60%, 45%)" },
  insurance: { label: "Insurance", icon: "🛡️", color: "hsl(30, 80%, 55%)" },
  property: { label: "Property & Assets", icon: "🏠", color: "hsl(270, 60%, 55%)" },
  passwords: { label: "Passwords & Credentials", icon: "🔑", color: "hsl(0, 70%, 55%)" },
};
