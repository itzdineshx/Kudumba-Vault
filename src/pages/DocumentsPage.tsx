import { useState, useCallback } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { CATEGORY_INFO, DocumentCategory, VaultDocument } from "@/types/vault";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FileText, Shield, Hash, Cloud, Clock, Share2, Download, CheckCircle2, Server, ExternalLink, Loader2, LinkIcon, AlertCircle, Trash2, Upload, Lock, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { formatHash, importKey, decryptFile } from "@/services/crypto";
import { toast } from "@/hooks/use-toast";
import { documentsApi } from "@/services/api";
import VerificationGate from "@/components/VerificationGate";
import { isSessionVerified, refreshVerification } from "@/services/verification";

const DocumentsPage = () => {
  const { documents, userRole, deleteDocument } = useVault();
  const { isContractReady, verifyDocumentOnChain } = useBlockchain();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<string>(searchParams.get("category") || "all");
  const [selected, setSelected] = useState<VaultDocument | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ exists: boolean; owner: string; timestamp: number } | null>(null);

  // Verification gate state
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<VaultDocument | null>(null);
  const [pendingAction, setPendingAction] = useState<"view" | "download" | null>(null);

  // In-browser document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerDoc, setViewerDoc] = useState<VaultDocument | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);

  const visibleDocs = documents;
  const filtered = filter === "all" ? visibleDocs : visibleDocs.filter(d => d.category === filter);

  /**
   * Check PIN/biometric verification before allowing document view/download.
   * If already verified within 15 min, proceed. Otherwise show the gate.
   */
  const requireVerification = useCallback((doc: VaultDocument, action: "view" | "download") => {
    const session = isSessionVerified();
    if (session.verified) {
      refreshVerification();
      if (action === "view") setSelected(doc);
      return true;
    }

    // Need verification — show the gate
    setPendingDoc(doc);
    setPendingAction(action);
    setGateOpen(true);
    return false;
  }, []);

  const handleGateVerified = useCallback(() => {
    setGateOpen(false);
    if (pendingAction === "view" && pendingDoc) {
      setSelected(pendingDoc);
    } else if (pendingAction === "download" && pendingDoc) {
      // Trigger download after verification — set selected so user can click download
      setSelected(pendingDoc);
    }
    setPendingDoc(null);
    setPendingAction(null);
  }, [pendingDoc, pendingAction]);

  const handleVerify = useCallback(async (doc: VaultDocument) => {
    if (!isContractReady || !doc.hash) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await verifyDocumentOnChain(doc.hash);
      setVerifyResult({ exists: result.exists, owner: result.owner, timestamp: result.timestamp });
    } catch (err) {
      console.error("Verification failed:", err);
      setVerifyResult(null);
    } finally {
      setVerifying(false);
    }
  }, [isContractReady, verifyDocumentOnChain]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="mt-1 text-muted-foreground">{filtered.length} document{filtered.length !== 1 ? "s" : ""} stored securely</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.keys(CATEGORY_INFO) as DocumentCategory[]).map(c => (
              <SelectItem key={c} value={c}>{CATEGORY_INFO[c].icon} {CATEGORY_INFO[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              {filter !== "all" ? "No documents in this category." : "Upload your first document to get started."}
            </p>
            {userRole === "owner" && (
              <Button onClick={() => navigate("/upload")} className="mt-4 gap-2">
                <Upload className="h-4 w-4" /> Upload Document
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((doc, i) => (
          <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => requireVerification(doc, "view")}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-2xl">{CATEGORY_INFO[doc.category].icon}</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge
                        variant="outline"
                        className={`gap-1 ${doc.blockchain?.verified ? "border-green-500/40 text-green-500" : "border-accent/40 text-accent"}`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {doc.blockchain?.verified ? "On-Chain" : "Verified"}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {doc.blockchain?.txHash
                        ? `Blockchain tx: ${formatHash(doc.blockchain.txHash, 6)}`
                        : "SHA-256 integrity verified"}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <h3 className="font-semibold">{doc.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{CATEGORY_INFO[doc.category].label} · {doc.fileType}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant={doc.privacy === "shared" ? "default" : "secondary"} className="text-[11px]">{doc.privacy === "shared" ? "👨‍👩‍👧‍👦 Shared" : "🔒 Private"}</Badge>
                  <span className="text-[11px] text-muted-foreground">{format(new Date(doc.timestamp), "MMM d, yyyy")}</span>
                  <Badge variant="outline" className="gap-1 text-[10px] ml-auto border-orange-500/30 text-orange-500">
                    <Lock className="h-2.5 w-2.5" /> PIN
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">{CATEGORY_INFO[selected.category].icon}</span>
                {selected.name}
              </DialogTitle>
              <DialogDescription>Document details, security information, and actions</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={selected.privacy === "shared" ? "default" : "secondary"}>{selected.privacy === "shared" ? "👨‍👩‍👧‍👦 Family Shared" : "🔒 Private"}</Badge>
                {selected.blockchain?.verified ? (
                  <Badge className="gap-1 bg-green-600 text-white">
                    <CheckCircle2 className="h-3 w-3" /> On-Chain Verified
                  </Badge>
                ) : (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge className="gap-1 bg-accent text-accent-foreground"><Shield className="h-3 w-3" /> Tamper-Proof Storage</Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">Any change to this document will be detected. The hash is permanently recorded on the blockchain.</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="space-y-3 rounded-lg bg-muted p-4 text-sm">
                <div className="flex items-start gap-2">
                  <Hash className="mt-0.5 h-4 w-4 text-primary" />
                  <div><p className="font-medium">SHA-256 Hash</p><p className="break-all font-mono text-[11px] text-muted-foreground">{selected.hash}</p></div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 text-primary" />
                  <div><p className="font-medium">Stored</p><p className="text-xs text-muted-foreground">{format(new Date(selected.timestamp), "PPpp")}</p></div>
                </div>
              </div>

              {/* Blockchain Record */}
              {selected.blockchain && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-green-500" /> Blockchain Record
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tx Hash:</span>
                      <span className="font-mono text-[11px]">{formatHash(selected.blockchain.txHash, 8)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Block:</span>
                      <span>#{selected.blockchain.blockNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gas Used:</span>
                      <span>{selected.blockchain.gasUsed}</span>
                    </div>
                    {selected.blockchain.onChainOwner && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Owner:</span>
                        <span className="font-mono text-[11px]">{formatHash(selected.blockchain.onChainOwner, 6)}</span>
                      </div>
                    )}
                  </div>
                  {selected.blockchain.explorerUrl && (
                    <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs gap-1">
                      <a href={selected.blockchain.explorerUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" /> View on Etherscan
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {/* Live Verification */}
              {isContractReady && selected.blockchain?.verified && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">🔍 Live Blockchain Verification</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(selected)}
                      disabled={verifying}
                      className="h-7 text-xs gap-1"
                    >
                      {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                      {verifying ? "Verifying..." : "Verify Now"}
                    </Button>
                  </div>
                  {verifyResult && (
                    <div className={`rounded-md p-2.5 text-xs ${verifyResult.exists ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
                      {verifyResult.exists ? (
                        <div className="space-y-1">
                          <p className="font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Integrity Confirmed</p>
                          <p>Owner: {formatHash(verifyResult.owner, 6)}</p>
                          <p>Registered: {new Date(verifyResult.timestamp * 1000).toLocaleString()}</p>
                        </div>
                      ) : (
                        <p className="font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Not found on-chain</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Distributed storage visual */}
              <div className="rounded-lg border p-4">
                <p className="mb-3 text-sm font-medium">☁️ Distributed Storage</p>
                <div className="flex items-center justify-between gap-2">
                  {["Node A (US-East)", "Node B (EU-West)", "Node C (AP-South)"].map((node, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center rounded-lg bg-muted p-3">
                      <Server className="mb-1 h-5 w-5 text-primary" />
                      <span className="text-[10px] text-muted-foreground text-center">{node}</span>
                      <Badge variant="outline" className="mt-1 text-[10px]">Active</Badge>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Your document is safe even if your device is lost.</p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {userRole === "owner" && (
                  <Button variant="outline" className="flex-1 gap-1" onClick={() => { setSelected(null); navigate("/sharing"); }}>
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                )}
                {/* View in browser — for PDFs, images, etc. */}
                {selected.encryptionKey && isViewableType(selected.mimeType) && (
                  <Button
                    variant="outline"
                    className="flex-1 gap-1"
                    disabled={viewerLoading}
                    onClick={async () => {
                      const session = isSessionVerified();
                      if (!session.verified) {
                        setPendingDoc(selected);
                        setPendingAction("view");
                        setGateOpen(true);
                        setSelected(null);
                        return;
                      }
                      refreshVerification();
                      setViewerLoading(true);
                      try {
                        const encryptedBuf = await documentsApi.downloadFile(selected.id);
                        const key = await importKey(selected.encryptionKey!);
                        const decrypted = await decryptFile(encryptedBuf, key);
                        const blob = new Blob([decrypted], { type: selected.mimeType || "application/octet-stream" });
                        const url = URL.createObjectURL(blob);
                        setViewerDoc(selected);
                        setViewerUrl(url);
                        setViewerOpen(true);
                      } catch (err) {
                        toast({ title: "View failed", description: String(err), variant: "destructive" });
                      } finally {
                        setViewerLoading(false);
                      }
                    }}
                  >
                    {viewerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    {viewerLoading ? "Loading..." : "View"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  disabled={downloading}
                  onClick={async () => {
                    const session = isSessionVerified();
                    if (!session.verified) {
                      setPendingDoc(selected);
                      setPendingAction("download");
                      setGateOpen(true);
                      setSelected(null);
                      return;
                    }
                    refreshVerification();
                    setDownloading(true);
                    try {
                      if (selected.encryptionKey) {
                        const encryptedBuf = await documentsApi.downloadFile(selected.id);
                        const key = await importKey(selected.encryptionKey);
                        const decrypted = await decryptFile(encryptedBuf, key);
                        const blob = new Blob([decrypted], { type: selected.mimeType || "application/octet-stream" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = selected.originalName || selected.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast({ title: "Downloaded", description: `${selected.name} decrypted and downloaded.` });
                      } else {
                        const metadata = {
                          name: selected.name, category: selected.category,
                          fileType: selected.fileType, hash: selected.hash,
                          timestamp: selected.timestamp, privacy: selected.privacy,
                          blockchain: selected.blockchain ?? null,
                        };
                        const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selected.name.replace(/\s+/g, "_")}_metadata.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast({ title: "Downloaded", description: "No file data found — metadata exported." });
                      }
                    } catch (err) {
                      toast({ title: "Download failed", description: String(err), variant: "destructive" });
                    } finally {
                      setDownloading(false);
                    }
                  }}
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? "Decrypting..." : "Download"}
                </Button>
                {userRole === "owner" && (
                  <Button
                    variant="outline"
                    className="gap-1 text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await deleteDocument(selected.id);
                        setSelected(null);
                        toast({ title: "Deleted", description: "Document permanently removed." });
                      } catch (err) {
                        toast({ title: "Delete failed", description: String(err), variant: "destructive" });
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {selected.accessLog.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Access Log</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto">
                    {selected.accessLog.map(l => (
                      <div key={`${selected.id}-${l.id}`} className="flex justify-between text-xs text-muted-foreground">
                        <span>{l.userName}: {l.action}</span>
                        <span>{format(new Date(l.timestamp), "MMM d, HH:mm")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Verification Gate for all users */}
      <VerificationGate
        open={gateOpen}
        onClose={() => { setGateOpen(false); setPendingDoc(null); setPendingAction(null); }}
        onVerified={handleGateVerified}
        title="Verify to Access Document"
      />

      {/* In-browser Document Viewer */}
      {viewerOpen && viewerUrl && viewerDoc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">{CATEGORY_INFO[viewerDoc.category].icon}</span>
              <div>
                <h3 className="font-semibold">{viewerDoc.name}</h3>
                <p className="text-xs text-muted-foreground">{viewerDoc.originalName || viewerDoc.fileType}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = viewerUrl;
                  a.download = viewerDoc.originalName || viewerDoc.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  toast({ title: "Downloaded", description: `${viewerDoc.name} downloaded.` });
                }}
              >
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setViewerOpen(false);
                  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
                  setViewerUrl(null);
                  setViewerDoc(null);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {viewerDoc.mimeType?.startsWith("image/") ? (
              <div className="flex h-full items-center justify-center">
                <img src={viewerUrl} alt={viewerDoc.name} className="max-h-full max-w-full object-contain rounded-lg" />
              </div>
            ) : (
              <iframe
                src={viewerUrl}
                title={viewerDoc.name}
                className="h-full w-full rounded-lg border"
                style={{ minHeight: "calc(100vh - 100px)" }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/** Check if a MIME type can be viewed in the browser */
function isViewableType(mimeType?: string): boolean {
  if (!mimeType) return false;
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("text/")
  );
}

export default DocumentsPage;
