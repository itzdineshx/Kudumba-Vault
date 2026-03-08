import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ShieldAlert, ShieldX, ShieldCheck, AlertTriangle,
  LinkIcon, Wallet, ExternalLink, CheckCircle2, Loader2, FileCheck
} from "lucide-react";
import { formatHash } from "@/services/crypto";
import { useState } from "react";

const AlertsPage = () => {
  const { alerts, addAlert, documents } = useVault();
  const {
    isContractReady,
    wallet,
    transactions,
    status: bcStatus,
    connectWallet,
    verifyDocumentOnChain,
    getExplorerUrl,
  } = useBlockchain();

  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResults, setAuditResults] = useState<
    { docName: string; hash: string; verified: boolean; owner?: string }[]
  >([]);

  // Run a full blockchain audit — verify every on-chain document against the contract
  const runBlockchainAudit = async () => {
    const chainDocs = documents.filter(d => d.blockchain && d.hash);
    if (chainDocs.length === 0) {
      toast({ title: "No on-chain documents", description: "Upload documents with blockchain registration first." });
      return;
    }

    setAuditRunning(true);
    setAuditResults([]);
    const results: typeof auditResults = [];

    for (const doc of chainDocs) {
      try {
        const rec = await verifyDocumentOnChain(doc.hash!);
        results.push({
          docName: doc.name,
          hash: doc.hash!,
          verified: rec.exists,
          owner: rec.owner,
        });
      } catch {
        results.push({ docName: doc.name, hash: doc.hash!, verified: false });
      }
    }

    setAuditResults(results);
    setAuditRunning(false);

    const passed = results.filter(r => r.verified).length;
    const failed = results.length - passed;

    if (failed > 0) {
      await addAlert({
        type: "Blockchain Audit Warning",
        description: `${failed} document(s) could not be verified on-chain.`,
        timestamp: new Date().toISOString(),
        status: "warning",
        ip: wallet?.address ?? "N/A",
        details: `Audit complete: ${passed} passed, ${failed} failed verification against the smart contract.`,
      });
      toast({ title: "Audit Complete", description: `${failed} document(s) failed verification.`, variant: "destructive" });
    } else {
      await addAlert({
        type: "Blockchain Audit Passed",
        description: `All ${passed} on-chain document(s) verified successfully.`,
        timestamp: new Date().toISOString(),
        status: "resolved",
        ip: wallet?.address ?? "N/A",
        details: "Full integrity check passed — all document hashes match the smart contract records.",
      });
      toast({ title: "Audit Passed", description: `All ${passed} documents verified on-chain.` });
    }
  };

  const statusConfig = {
    blocked: { icon: ShieldX, color: "bg-destructive/10 text-destructive", badge: "destructive" as const },
    warning: { icon: AlertTriangle, color: "bg-[hsl(var(--vault-warning))]/10 text-[hsl(var(--vault-warning))]", badge: "secondary" as const },
    resolved: { icon: ShieldCheck, color: "bg-accent/10 text-accent", badge: "default" as const },
  };

  const allLogs = documents.flatMap(d => d.accessLog.map(l => ({ ...l, docName: d.name }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  const onChainDocCount = documents.filter(d => d.blockchain).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Alerts</h1>
          <p className="mt-1 text-muted-foreground">Monitor vault security, blockchain integrity & access activity</p>
        </div>
        <div className="flex gap-2">
          {isContractReady && (
            <Button onClick={runBlockchainAudit} disabled={auditRunning} variant="outline" className="gap-2">
              {auditRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Auditing...</>
              ) : (
                <><FileCheck className="h-4 w-4" /> Blockchain Audit</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Blockchain Security Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LinkIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onChainDocCount}</p>
                <p className="text-xs text-muted-foreground">On-Chain Documents</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{transactions.length}</p>
                <p className="text-xs text-muted-foreground">Blockchain Transactions</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                bcStatus === "connected" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              }`}>
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                {wallet ? (
                  <>
                    <p className="text-sm font-mono font-bold">{formatHash(wallet.address, 6)}</p>
                    <p className="text-xs text-muted-foreground">{wallet.balance} ETH · {wallet.network}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-amber-500">Disconnected</p>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => connectWallet()}>
                      Connect Wallet
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Blockchain Audit Results */}
      {auditResults.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" /> Blockchain Audit Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Hash</TableHead>
                    <TableHead>On-Chain Status</TableHead>
                    <TableHead>Owner</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.docName}</TableCell>
                      <TableCell className="font-mono text-xs">{formatHash(r.hash, 8)}</TableCell>
                      <TableCell>
                        {r.verified ? (
                          <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldX className="h-3 w-3" /> NOT FOUND
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.owner ? formatHash(r.owner, 6) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Security Alerts */}
      {alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No security alerts</h3>
            <p className="mt-1 text-sm text-muted-foreground">Your vault is secure. Alerts will appear here when security events are detected.</p>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {alerts.map((alert, i) => {
          const cfg = statusConfig[alert.status];
          return (
            <motion.div key={alert.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${cfg.color}`}>
                      <cfg.icon className="h-5 w-5" />
                    </div>
                    <Badge variant={cfg.badge}>{alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}</Badge>
                  </div>
                  <h3 className="font-semibold">{alert.type}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>IP: {alert.ip}</p>
                    <p>{format(new Date(alert.timestamp), "PPpp")}</p>
                  </div>
                  <p className="mt-3 rounded bg-muted p-2 text-xs text-muted-foreground">{alert.details}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      )}

      {/* Recent Blockchain Transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" /> Recent Blockchain Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tx Hash</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Gas Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.slice(-10).reverse().map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{formatHash(tx.hash, 10)}</TableCell>
                    <TableCell>#{tx.blockNumber}</TableCell>
                    <TableCell className="text-xs">{tx.gasUsed}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tx.explorerUrl && (
                        <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="h-3 w-3" /> Explorer
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Complete Access Log */}
      {allLogs.length > 0 && (
      <Card>
        <CardHeader><CardTitle>Complete Access Log</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLogs.map((l, i) => (
                <TableRow key={`${l.id}-${l.docName}-${i}`}>
                  <TableCell className="font-medium">{l.userName}</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>{l.docName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(l.timestamp), "MMM d, HH:mm")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </div>
  );
};

export default AlertsPage;
