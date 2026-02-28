// ─── Frontend API Service ─────────────────────────────────────────────────
// Replaces localStorage/IndexedDB with real backend API calls to MongoDB

const API_BASE = "/api";

function getToken(): string | null {
  return localStorage.getItem("kv_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string; familyName: string; role: string };
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  familyName: string;
  role: string;
}

export const authApi = {
  register(data: { name: string; email: string; password: string; familyName: string }): Promise<AuthResponse> {
    return request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  login(data: { email: string; password: string }): Promise<AuthResponse> {
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  me(): Promise<UserProfile> {
    return request("/auth/me");
  },

  check(): Promise<{ hasUsers: boolean }> {
    return request("/auth/check");
  },

  saveToken(token: string) {
    localStorage.setItem("kv_token", token);
  },

  clearToken() {
    localStorage.removeItem("kv_token");
  },

  hasToken(): boolean {
    return !!localStorage.getItem("kv_token");
  },
};

// ─── Documents ──────────────────────────────────────────────────────────────

export const documentsApi = {
  list(): Promise<any[]> {
    return request("/documents");
  },

  get(id: string): Promise<any> {
    return request(`/documents/${id}`);
  },

  create(data: {
    name: string;
    category: string;
    privacy: string;
    hash: string;
    fileType: string;
    size: string;
    encryptionKey?: string;
    blockchain?: any;
    userName?: string;
    fileData?: string; // base64 encoded encrypted data
    originalName?: string;
    mimeType?: string;
  }): Promise<any> {
    return request("/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  async downloadFile(id: string): Promise<ArrayBuffer> {
    const res = await fetch(`${API_BASE}/documents/${id}/file`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("File download failed");
    return res.arrayBuffer();
  },

  update(id: string, data: any): Promise<any> {
    return request(`/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  share(id: string, data: { memberId: string; permission: string; expiresAt?: string; memberName?: string; userName?: string }): Promise<any> {
    return request(`/documents/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  revoke(id: string, memberId: string): Promise<any> {
    return request(`/documents/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
  },

  delete(id: string): Promise<any> {
    return request(`/documents/${id}`, { method: "DELETE" });
  },
};

// ─── Members ────────────────────────────────────────────────────────────────

export const membersApi = {
  list(): Promise<any[]> {
    return request("/members");
  },

  create(data: { name: string; email: string; relationship: string; walletAddress?: string }): Promise<any> {
    return request("/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<any> {
    return request(`/members/${id}`, { method: "DELETE" });
  },
};

// ─── Alerts ─────────────────────────────────────────────────────────────────

export const alertsApi = {
  list(): Promise<any[]> {
    return request("/alerts");
  },

  create(data: { type: string; description: string; status?: string; ip?: string; details?: string }): Promise<any> {
    return request("/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
};
