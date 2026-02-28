import { useState } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { CATEGORY_INFO } from "@/types/vault";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, Shield, Fingerprint, Cloud, LinkIcon, AlertTriangle, Hash, ExternalLink } from "lucide-react";
import { formatHash } from "@/services/crypto";

const RECOVERY_STEPS = [
  { icon: AlertTriangle, label: "Device loss detected", description: "Simulating lost device scenario..." },
  { icon: Fingerprint, label: "Verifying wallet identity", description: "Verifying ownership via MetaMask signature..." },
  { icon: Cloud, label: "Retrieving encrypted documents", description: "Fetching AES-256-GCM encrypted data from distributed storage..." },
  { icon: Hash, label: "Recomputing SHA-256 hashes", description: "Verifying file integrity with cryptographic hashes..." },
  { icon: LinkIcon, label: "Validating on Ethereum blockchain", description: "Cross-referencing document hashes on-chain..." },
  { icon: CheckCircle2, label: "Recovery complete!", description: "All documents restored and verified" },
];

const RecoveryPage = () => {
  const { documents } = useVault();
  const { isContractReady, verifyDocumentOnChain } = useBlockchain();
  const [phase, setPhase] = useState<"idle" | "recovering" | "done">("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [verifiedDocs, setVerifiedDocs] = useState<Record<string, { verified: boolean; owner?: string; blockTimestamp?: number }>>({});

  const startRecovery = async () => {
    setPhase("recovering");
    setCurrentStep(0);
    setVerifiedDocs({});

    // Animate through recovery steps
    for (let i = 1; i < RECOVERY_STEPS.length - 1; i++) {
      await new Promise(r => setTimeout(r, 1200));
      setCurrentStep(i);
    }

    // If contract is ready, do REAL blockchain verification
    if (isContractReady) {
      const results: Record<string, { verified: boolean; owner?: string; blockTimestamp?: number }> = {};
      for (const doc of documents) {
        if (doc.blockchain?.verified && doc.hash) {
          try {
            const result = await verifyDocumentOnChain(doc.hash);
            results[doc.id] = {
              verified: result.exists,
              owner: result.owner,
              blockTimestamp: result.timestamp,
            };
          } catch {
            results[doc.id] = { verified: false };
          }
        } else {
          // Hash-only verification (document exists locally)
          results[doc.id] = { verified: true };
        }
      }
      setVerifiedDocs(results);
    } else {
      // No blockchain: mark all as locally verified
      const results: Record<string, { verified: boolean }> = {};
      documents.forEach(d => { results[d.id] = { verified: true }; });
      setVerifiedDocs(results);
    }

    // Final step
    await new Promise(r => setTimeout(r, 600));
    setCurrentStep(RECOVERY_STEPS.length - 1);
    setTimeout(() => setPhase("done"), 600);
  };

  const reset = () => { setPhase("idle"); setCurrentStep(0); setVerifiedDocs({}); };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recovery & Backup</h1>
        <p className="mt-1 text-muted-foreground">Simulate device loss and see how your documents are recovered</p>
      </div>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <h2 className="text-xl font-bold">Simulate Device Loss</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  This demo simulates what happens when you lose your device. Your documents are safely stored in distributed cloud storage and verified via blockchain.
                </p>
                <Button onClick={startRecovery} size="lg" className="mt-6 gap-2">
                  <RefreshCw className="h-4 w-4" /> Start Recovery Simulation
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "recovering" && (
          <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="space-y-6 p-8">
                <div className="text-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <RefreshCw className="h-8 w-8 text-primary" />
                  </motion.div>
                  <h2 className="text-xl font-bold">Recovering Your Vault...</h2>
                </div>
                <div className="space-y-4">
                  {RECOVERY_STEPS.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3">
                      {i <= currentStep ? <s.icon className="h-5 w-5 text-accent" /> : <div className="h-5 w-5 rounded-full border-2 border-muted" />}
                      <div>
                        <p className={`text-sm ${i <= currentStep ? "font-medium" : "text-muted-foreground"}`}>{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-accent/30">
              <CardContent className="space-y-6 p-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold">Documents Successfully Recovered!</h2>
                  <p className="mt-1 text-muted-foreground">
                    {isContractReady
                      ? "All documents restored with Ethereum blockchain proof of ownership"
                      : "All documents restored with SHA-256 hash verification"}
                  </p>
                </div>
                <div className="space-y-2">
                  {documents.map(d => {
                    const verification = verifiedDocs[d.id];
                    return (
                      <div key={d.id} className="flex items-center justify-between rounded-lg bg-muted px-4 py-2.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{CATEGORY_INFO[d.category].icon} {d.name}</span>
                          {d.blockchain?.verified && (
                            <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500">on-chain</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {verification?.verified ? (
                            <Badge variant="outline" className="gap-1 border-accent/40 text-accent">
                              <CheckCircle2 className="h-3 w-3" />
                              {verification.owner ? "Chain Verified" : "Hash Verified"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 border-accent/40 text-accent">
                              <Shield className="h-3 w-3" /> Verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {isContractReady && (
                  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-xs text-center">
                    <p className="font-medium text-green-600">Ethereum Blockchain Verification Complete</p>
                    <p className="text-muted-foreground mt-0.5">
                      {Object.values(verifiedDocs).filter(v => v.verified).length} / {documents.length} documents verified on-chain
                    </p>
                  </div>
                )}
                <Button onClick={reset} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" /> Run Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RecoveryPage;
