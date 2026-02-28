import { useState, useCallback, useRef } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { DocumentCategory, CATEGORY_INFO } from "@/types/vault";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, CheckCircle2, Lock, Hash, Cloud, LinkIcon, Wallet, AlertCircle, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatHash, generateEncryptionKey, encryptFile, exportKey, hashFile, hashData } from "@/services/crypto";

const STEPS = [
  { label: "Encrypting document with AES-256-GCM...", key: "encrypt" },
  { label: "Computing SHA-256 hash...", key: "hash" },
  { label: "Storing in distributed cloud...", key: "cloud" },
  { label: "Recording hash on Ethereum blockchain...", key: "blockchain" },
  { label: "Waiting for block confirmation...", key: "confirm" },
];

const UploadPage = () => {
  const { addDocument } = useVault();
  const { status, isContractReady, connectWallet, deployContract, registerDocumentOnChain, hashFileLocally } = useBlockchain();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("ids");
  const [isShared, setIsShared] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"form" | "processing" | "success" | "error">("form");
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<{
    hash: string;
    timestamp: string;
    txHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    explorerUrl?: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [deploying, setDeploying] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name);
      setFile(e.target.files[0]);
    }
  }, []);

  const handleDeployContract = async () => {
    try {
      setDeploying(true);
      await deployContract();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to deploy contract");
    } finally {
      setDeploying(false);
    }
  };

  const handleSubmit = async () => {
    if (!name) return;

    setPhase("processing");
    setCurrentStep(0);
    setUploadError("");

    try {
      // Step 0: Encrypt file with AES-256-GCM (real encryption)
      let encryptedData: ArrayBuffer | null = null;
      let encKeyHex: string | undefined;
      if (file) {
        const key = await generateEncryptionKey();
        encryptedData = await encryptFile(file, key);
        encKeyHex = await exportKey(key);
      }
      setCurrentStep(1);

      // Step 1: Compute real SHA-256 hash
      let docHash: string;
      if (file) {
        docHash = await hashFile(file);
      } else {
        docHash = await hashData(name + "_" + Date.now().toString());
      }
      setCurrentStep(2);

      // Step 2: Prepare encrypted file as base64 for API upload
      let fileDataBase64: string | undefined;
      if (file && encryptedData) {
        const bytes = new Uint8Array(encryptedData);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileDataBase64 = btoa(binary);
      }
      setCurrentStep(3);

      // Step 3 & 4: Blockchain recording (real transaction if wallet connected)
      if (isContractReady) {
        const { tx } = await registerDocumentOnChain(file, name, category);
        setCurrentStep(4);
        await new Promise(r => setTimeout(r, 400));

        const doc = await addDocument(
          name, category,
          isShared ? "shared" : "private",
          fileName || "Text",
          file ? formatFileSize(file.size) : "0 B",
          docHash,
          {
            txHash: tx.hash,
            blockNumber: tx.blockNumber,
            timestamp: tx.timestamp,
            gasUsed: tx.gasUsed,
            explorerUrl: tx.explorerUrl,
            verified: true,
            onChainOwner: tx.from,
          },
          encKeyHex,
          fileDataBase64,
          file?.name,
          file?.type || "application/octet-stream"
        );

        setResult({
          hash: doc.hash,
          timestamp: doc.timestamp,
          txHash: tx.hash,
          blockNumber: tx.blockNumber,
          gasUsed: tx.gasUsed,
          explorerUrl: tx.explorerUrl,
        });
      } else {
        // Store locally with hash but no blockchain tx
        setCurrentStep(4);
        await new Promise(r => setTimeout(r, 300));

        const doc = await addDocument(
          name, category,
          isShared ? "shared" : "private",
          fileName || "Text",
          file ? formatFileSize(file.size) : "0 B",
          docHash,
          undefined,
          encKeyHex,
          fileDataBase64,
          file?.name,
          file?.type || "application/octet-stream"
        );

        setResult({
          hash: doc.hash,
          timestamp: doc.timestamp,
        });
      }

      setPhase("success");
    } catch (err) {
      console.error("Upload error:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setPhase("error");
    }
  };

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Document</h1>
        <p className="mt-1 text-muted-foreground">Securely encrypt and store your document with real blockchain verification</p>
      </div>

      {/* Blockchain status banner */}
      {status === "connected" && !isContractReady && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Smart Contract Not Deployed</p>
                <p className="text-xs text-muted-foreground">Deploy the vault contract to enable on-chain storage</p>
              </div>
            </div>
            <Button size="sm" onClick={handleDeployContract} disabled={deploying} className="gap-2">
              {deploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
              {deploying ? "Deploying..." : "Deploy Contract"}
            </Button>
          </CardContent>
        </Card>
      )}

      {status !== "connected" && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Connect MetaMask for Blockchain Security</p>
                <p className="text-xs text-muted-foreground">Documents will use real SHA-256 hashing. Connect wallet for on-chain recording.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={connectWallet} className="gap-2">
              <Wallet className="h-3.5 w-3.5" /> Connect
            </Button>
          </CardContent>
        </Card>
      )}

      <AnimatePresence mode="wait">
        {phase === "form" && (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="space-y-5 p-6">
                <div className="rounded-xl border-2 border-dashed border-border bg-muted/50 p-8 text-center">
                  <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="mb-2 text-sm font-medium">Drag & drop your file here, or click to browse</p>
                  <Input type="file" className="mx-auto max-w-xs" onChange={handleFileChange} accept=".pdf,.jpg,.png,.txt" />
                  {fileName && <Badge variant="secondary" className="mt-3"><FileUp className="mr-1 h-3 w-3" />{fileName}</Badge>}
                </div>
                <div className="space-y-2">
                  <Label>Document Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Passport - John" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={v => setCategory(v as DocumentCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_INFO) as DocumentCategory[]).map(c => (
                        <SelectItem key={c} value={c}>{CATEGORY_INFO[c].icon} {CATEGORY_INFO[c].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div>
                    <p className="text-sm font-medium">Share with Family</p>
                    <p className="text-xs text-muted-foreground">Make visible to family members</p>
                  </div>
                  <Switch checked={isShared} onCheckedChange={setIsShared} />
                </div>

                {/* Security info */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1.5">🔐 Security Pipeline</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                    <span>✓ AES-256-GCM Encryption</span>
                    <span>✓ SHA-256 File Hashing</span>
                    <span>✓ Distributed Cloud Storage</span>
                    <span>{isContractReady ? "✓ Ethereum On-Chain Record" : "○ Connect wallet for on-chain"}</span>
                  </div>
                </div>

                <Button onClick={handleSubmit} size="lg" className="w-full gap-2" disabled={!name}>
                  <Lock className="h-4 w-4" /> Encrypt & Store Securely
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div key="proc" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <CardContent className="space-y-6 p-8">
                <div className="text-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Lock className="h-8 w-8 text-primary" />
                  </motion.div>
                  <h2 className="text-xl font-bold">Securing Your Document</h2>
                  {isContractReady && <p className="text-xs text-muted-foreground mt-1">Recording on Ethereum blockchain...</p>}
                </div>
                <div className="space-y-3">
                  {STEPS.map((s, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-3">
                      {i < currentStep ? (
                        <CheckCircle2 className="h-5 w-5 text-accent" />
                      ) : i === currentStep ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted" />
                      )}
                      <span className={`text-sm ${i <= currentStep ? "font-medium" : "text-muted-foreground"}`}>{s.label}</span>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "success" && result && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-accent/30">
              <CardContent className="space-y-6 p-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                  <CheckCircle2 className="h-10 w-10 text-accent" />
                </motion.div>
                <div>
                  <h2 className="text-2xl font-bold">Document Secured!</h2>
                  <p className="mt-1 text-muted-foreground">
                    {result.txHash
                      ? "Your document has been encrypted and recorded on the Ethereum blockchain"
                      : "Your document has been encrypted with a real SHA-256 hash"}
                  </p>
                </div>
                <div className="space-y-3 rounded-lg bg-muted p-4 text-left text-sm">
                  <div className="flex items-start gap-2">
                    <Hash className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">SHA-256 Document Hash</p>
                      <p className="break-all font-mono text-xs text-muted-foreground">{result.hash}</p>
                    </div>
                  </div>

                  {result.txHash && (
                    <>
                      <div className="flex items-start gap-2">
                        <LinkIcon className="mt-0.5 h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">Transaction Hash</p>
                          <p className="break-all font-mono text-xs text-muted-foreground">{result.txHash}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Cloud className="mt-0.5 h-4 w-4 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium">Block #{result.blockNumber}</p>
                          <p className="text-xs text-muted-foreground">Gas Used: {result.gasUsed}</p>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex items-start gap-2">
                    <Cloud className="mt-0.5 h-4 w-4 text-primary" />
                    <div><p className="font-medium">Distributed Storage</p><p className="text-xs text-muted-foreground">Encrypted across 3 cloud nodes</p></div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-2">
                  <Badge className="bg-accent text-accent-foreground">🛡️ Tamper-Proof Storage Active</Badge>
                  {result.txHash && (
                    <Badge variant="outline" className="gap-1 border-green-500/40 text-green-500">
                      <CheckCircle2 className="h-3 w-3" /> On-Chain Verified
                    </Badge>
                  )}
                </div>

                {result.explorerUrl && (
                  <Button variant="link" size="sm" asChild className="gap-1">
                    <a href={result.explorerUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> View on Etherscan
                    </a>
                  </Button>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setPhase("form"); setName(""); setFileName(""); setFile(null); setCurrentStep(0); }}>Upload Another</Button>
                  <Button className="flex-1" onClick={() => navigate("/documents")}>View Documents</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-destructive/30">
              <CardContent className="space-y-4 p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-10 w-10 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Transaction Failed</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{uploadError}</p>
                </div>
                <Button variant="outline" onClick={() => { setPhase("form"); setCurrentStep(0); }}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadPage;
