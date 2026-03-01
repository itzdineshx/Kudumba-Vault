import { useState } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { CATEGORY_INFO } from "@/types/vault";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Share2, Eye, Clock, XCircle, Shield, LinkIcon, Loader2, CheckCircle2, ExternalLink, Wallet, AlertTriangle } from "lucide-react";
import { formatHash } from "@/services/crypto";

const SharingPage = () => {
  const { documents, members, shareDocument, revokeAccess } = useVault();
  const {
    isContractReady,
    status: bcStatus,
    wallet,
    connectWallet,
    grantAccessOnChain,
    revokeAccessOnChain,
    checkAccessOnChain,
    getExplorerUrl,
  } = useBlockchain();

  const [selectedDoc, setSelectedDoc] = useState("");
  const [selectedMember, setSelectedMember] = useState("");
  const [permission, setPermission] = useState<"view-only" | "time-limited">("view-only");
  const [memberWallet, setMemberWallet] = useState("");
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<Record<string, boolean | null>>({});

  const handleShare = async () => {
    if (!selectedDoc || !selectedMember) return;
    const doc = documents.find(d => d.id === selectedDoc);
    const expires = permission === "time-limited" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined;

    // Record in vault state (now API-backed)
    await shareDocument(selectedDoc, selectedMember, permission, expires);

    // If blockchain is connected and doc has a hash, record on-chain
    if (isContractReady && doc?.hash && memberWallet.startsWith("0x")) {
      setSharing(true);
      try {
        const expiresEpoch = permission === "time-limited"
          ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
          : 0;
        const tx = await grantAccessOnChain(doc.hash, memberWallet, expiresEpoch);
        setLastTxHash(tx.hash);
        toast({
          title: "On-Chain Access Granted",
          description: `Tx: ${formatHash(tx.hash)}  ·  Block #${tx.blockNumber}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Blockchain tx failed";
        toast({ title: "On-chain grant failed", description: msg, variant: "destructive" });
      } finally {
        setSharing(false);
      }
    } else {
      toast({ title: "Document shared!", description: "Family member can now access this document." });
    }

    setSelectedDoc("");
    setSelectedMember("");
    setMemberWallet("");
  };

  const handleRevoke = async (docId: string, memberId: string) => {
    const doc = documents.find(d => d.id === docId);
    await revokeAccess(docId, memberId);

    // Revoke on-chain if possible
    if (isContractReady && doc?.hash && memberWallet) {
      const key = `${docId}-${memberId}`;
      setRevoking(key);
      try {
        const tx = await revokeAccessOnChain(doc.hash, memberWallet);
        toast({
          title: "On-Chain Access Revoked",
          description: `Tx: ${formatHash(tx.hash)}  ·  Block #${tx.blockNumber}`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Blockchain revoke failed";
        toast({ title: "On-chain revoke failed", description: msg, variant: "destructive" });
      } finally {
        setRevoking(null);
      }
    } else {
      toast({ title: "Access revoked", description: "Family member can no longer access this document." });
    }
  };

  const handleVerifyAccess = async (docHash: string, address: string, key: string) => {
    try {
      const has = await checkAccessOnChain(docHash, address);
      setVerifyResult(prev => ({ ...prev, [key]: has }));
    } catch {
      setVerifyResult(prev => ({ ...prev, [key]: false }));
    }
  };

  const sharedDocs = documents.filter(d => d.sharedWith.some(s => !s.revoked));
  const onChainDocs = documents.filter(d => d.blockchain);
  const allLogs = documents.flatMap(d => d.accessLog.map(l => ({ ...l, docName: d.name }))).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Family Sharing</h1>
        <p className="mt-1 text-muted-foreground">Share documents securely with on-chain access control</p>
      </div>

      {/* Blockchain status banner */}
      {bcStatus !== "connected" && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Wallet className="h-5 w-5 text-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Wallet not connected</p>
                <p className="text-xs text-muted-foreground">
                  Connect MetaMask to grant and revoke access directly on the Ethereum blockchain.
                </p>
              </div>
              <Button size="sm" onClick={() => connectWallet()}>Connect Wallet</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {isContractReady && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Shield className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-600">On-Chain Access Control Active</p>
                <p className="text-xs text-muted-foreground">
                  Sharing will be recorded on the Ethereum blockchain for immutable access control.
                  {wallet && <span className="ml-1">Wallet: {formatHash(wallet.address, 6)}</span>}
                </p>
              </div>
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">
                <LinkIcon className="mr-1 h-3 w-3" /> On-Chain
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Last tx hash feedback */}
      {lastTxHash && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex items-center gap-3 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-mono">{formatHash(lastTxHash, 10)}</span>
              <a
                href={getExplorerUrl(lastTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> View on Explorer
              </a>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Share form */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Share2 className="h-5 w-5" /> Share a Document</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select value={selectedDoc} onValueChange={setSelectedDoc}>
              <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
              <SelectContent>
                {documents.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {CATEGORY_INFO[d.category].icon} {d.name}
                    {d.blockchain && " ⛓️"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name} ({m.relationship})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={permission} onValueChange={v => setPermission(v as "view-only" | "time-limited")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="view-only"><Eye className="mr-1 inline h-3 w-3" /> View-only</SelectItem>
                <SelectItem value="time-limited"><Clock className="mr-1 inline h-3 w-3" /> Time-limited (30 days)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Member wallet address for on-chain sharing */}
          {isContractReady && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                Recipient wallet address (for on-chain access grant)
              </label>
              <Input
                placeholder="0x..."
                value={memberWallet}
                onChange={e => setMemberWallet(e.target.value)}
                className="font-mono text-sm"
              />
              {memberWallet && !memberWallet.match(/^0x[a-fA-F0-9]{40}$/) && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" /> Invalid Ethereum address
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleShare}
            disabled={!selectedDoc || !selectedMember || sharing}
            className="gap-2"
          >
            {sharing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Recording on-chain...</>
            ) : (
              <><Share2 className="h-4 w-4" /> {isContractReady ? "Share & Record On-Chain" : "Share Document"}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Currently shared documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Currently Shared Documents
            {onChainDocs.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{onChainDocs.length} on-chain</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sharedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents are currently shared.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Shared With</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Granted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sharedDocs.flatMap(d => d.sharedWith.filter(s => !s.revoked).map(s => {
                  const member = members.find(m => m.id === s.memberId);
                  const rowKey = `${d.id}-${s.memberId}`;
                  return (
                    <TableRow key={rowKey}>
                      <TableCell className="font-medium">
                        {CATEGORY_INFO[d.category].icon} {d.name}
                      </TableCell>
                      <TableCell>{member?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          {s.permission === "view-only" ? <><Eye className="h-3 w-3" /> View-only</> : <><Clock className="h-3 w-3" /> Time-limited</>}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.blockchain ? (
                          <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600">
                            <LinkIcon className="h-3 w-3" /> On-Chain
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <Shield className="h-3 w-3" /> Local
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(s.grantedAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {/* Verify on-chain access */}
                        {isContractReady && d.hash && memberWallet.match(/^0x[a-fA-F0-9]{40}$/) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => handleVerifyAccess(d.hash!, memberWallet, rowKey)}
                          >
                            {verifyResult[rowKey] === true ? (
                              <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Verified</>
                            ) : verifyResult[rowKey] === false ? (
                              <><XCircle className="h-3 w-3 text-destructive" /> No access</>
                            ) : (
                              <><Shield className="h-3 w-3" /> Check</>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(d.id, s.memberId)}
                          disabled={revoking === rowKey}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          {revoking === rowKey ? (
                            <><Loader2 className="h-3 w-3 animate-spin" /> Revoking...</>
                          ) : (
                            <><XCircle className="h-3 w-3" /> Revoke</>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Access Log */}
      <Card>
        <CardHeader><CardTitle>Access Log</CardTitle></CardHeader>
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
              {allLogs.map(l => (
                <TableRow key={`${l.timestamp}-${l.action}`}>
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
    </div>
  );
};

export default SharingPage;
