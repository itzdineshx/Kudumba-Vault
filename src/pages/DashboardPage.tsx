import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_INFO, DocumentCategory } from "@/types/vault";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Share2, Users, ShieldAlert, Plus, Clock, LinkIcon, Wallet, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { formatHash } from "@/services/crypto";

const DashboardPage = () => {
  const { documents, members, alerts, userRole, familyName, userName } = useVault();
  const { status, wallet, isContractReady, transactions, connectWallet } = useBlockchain();
  const navigate = useNavigate();

  const sharedDocs = documents.filter(d => d.privacy === "shared");
  const onChainDocs = documents.filter(d => d.blockchain?.verified);
  const stats = [
    { label: "Total Documents", value: documents.length, icon: FileText, color: "bg-primary/10 text-primary" },
    { label: "On-Chain Verified", value: onChainDocs.length, icon: LinkIcon, color: "bg-green-500/10 text-green-500" },
    { label: "Family Members", value: members.length, icon: Users, color: "bg-accent/10 text-accent" },
    { label: "Security Alerts", value: alerts.length, icon: ShieldAlert, color: "bg-destructive/10 text-destructive" },
  ];

  const categoryCounts = (Object.keys(CATEGORY_INFO) as DocumentCategory[]).map(cat => ({
    ...CATEGORY_INFO[cat],
    category: cat,
    count: documents.filter(d => d.category === cat).length,
  }));

  const recentActivity = documents.flatMap(d => d.accessLog.map(a => ({ ...a, docName: d.name }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {userName || (userRole === "owner" ? "Owner" : "Member")}</h1>
          <p className="mt-1 text-muted-foreground">{familyName || "Family Vault"} · Secure Vault Dashboard</p>
        </div>
        {userRole === "owner" && (
          <Button onClick={() => navigate("/upload")} size="lg" className="gap-2">
            <Plus className="h-4 w-4" /> Add New Document
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}>
                  <s.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Document Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {categoryCounts.map((cat, i) => (
            <motion.div key={cat.category} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.05 }}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(`/documents?category=${cat.category}`)}>
                <CardContent className="p-5 text-center">
                  <span className="text-3xl">{cat.icon}</span>
                  <p className="mt-2 font-semibold">{cat.label}</p>
                  <Badge variant="secondary" className="mt-2">{cat.count} {cat.count === 1 ? "doc" : "docs"}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className={recentActivity.length > 0 ? "divide-y p-0" : "py-10 text-center"}>
            {recentActivity.length === 0 ? (
              <div>
                <Clock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet. Upload a document to get started.</p>
              </div>
            ) : (
            recentActivity.map(a => (
              <div key={`${a.timestamp}-${a.action}`} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.docName} · {a.userName}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{format(new Date(a.timestamp), "MMM d, HH:mm")}</span>
              </div>
            ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Blockchain Status */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Blockchain Status</h2>
        <Card>
          <CardContent className="p-5">
            {status === "connected" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <Wallet className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Wallet Connected</p>
                      <p className="font-mono text-xs text-muted-foreground">{wallet ? formatHash(wallet.address, 6) : ""}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{wallet ? parseFloat(wallet.balance).toFixed(4) : "0"} ETH</p>
                    <p className="text-xs text-muted-foreground">{wallet?.network}</p>
                  </div>
                </div>

                {isContractReady && (
                  <div className="rounded-lg bg-muted p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Smart Contract Active</span>
                      <Badge variant="outline" className="gap-1 text-[10px] border-green-500/30 text-green-500">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Deployed
                      </Badge>
                    </div>
                  </div>
                )}

                {transactions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Recent Transactions</p>
                    <div className="space-y-1.5">
                      {transactions.slice(-3).reverse().map(tx => (
                        <div key={tx.hash} className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
                          <span className="font-mono">{formatHash(tx.hash, 6)}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={tx.status === "confirmed" ? "default" : "secondary"} className="text-[10px]">
                              {tx.status}
                            </Badge>
                            <span className="text-muted-foreground">Block #{tx.blockNumber}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Connect Wallet</p>
                    <p className="text-xs text-muted-foreground">Link MetaMask for on-chain document security</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={connectWallet} className="gap-2">
                  <Wallet className="h-3.5 w-3.5" /> Connect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
