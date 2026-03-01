import { useState, useCallback } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { DocumentCategory, CATEGORY_INFO } from "@/types/vault";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileUp, CheckCircle2, Lock, Hash, Cloud, LinkIcon,
  Wallet, AlertCircle, ExternalLink, Loader2,
  CreditCard, ShieldCheck, Home, KeyRound, IdCard,
  Eye, EyeOff, Copy, Globe
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatHash, generateEncryptionKey, encryptFile, exportKey, hashFile, hashData } from "@/services/crypto";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { label: "Encrypting document with AES-256-GCM...", key: "encrypt" },
  { label: "Computing SHA-256 hash...", key: "hash" },
  { label: "Storing in distributed cloud...", key: "cloud" },
  { label: "Recording hash on Ethereum blockchain...", key: "blockchain" },
  { label: "Waiting for block confirmation...", key: "confirm" },
];

/* ── Category-specific configuration ─────────────────────────────────────── */

interface CategoryField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "password" | "url" | "textarea";
  required?: boolean;
  half?: boolean; // render at half width
}

interface CategoryConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;        // tailwind gradient classes for the drop zone
  border: string;          // border accent color
  acceptTypes: string;
  namePlaceholder: string;
  fields: CategoryField[];
  tips: string[];
  requiresFile: boolean;   // false = passwords (no file)
}

const CATEGORY_CONFIG: Record<DocumentCategory, CategoryConfig> = {
  ids: {
    title: "Identity Documents",
    description: "Passports, driver's licenses, national IDs, birth certificates",
    icon: <IdCard className="h-5 w-5" />,
    gradient: "from-blue-500/10 to-cyan-500/5",
    border: "border-blue-500/30",
    acceptTypes: ".pdf,.jpg,.jpeg,.png",
    namePlaceholder: "e.g., Passport - John Smith",
    fields: [
      { key: "idNumber", label: "ID / Document Number", placeholder: "e.g., AB1234567", type: "text", half: true },
      { key: "issuedBy", label: "Issuing Authority", placeholder: "e.g., Dept. of State", type: "text", half: true },
      { key: "issueDate", label: "Issue Date", placeholder: "", type: "date", half: true },
      { key: "expiryDate", label: "Expiry Date", placeholder: "", type: "date", half: true },
    ],
    tips: [
      "Upload a clear, high-resolution scan or photo",
      "Include both front and back if applicable",
      "Ensure all text is readable and not cut off",
    ],
    requiresFile: true,
  },
  banking: {
    title: "Banking & Finance",
    description: "Bank statements, cheque books, tax returns, investment records",
    icon: <CreditCard className="h-5 w-5" />,
    gradient: "from-emerald-500/10 to-green-500/5",
    border: "border-emerald-500/30",
    acceptTypes: ".pdf,.jpg,.jpeg,.png,.csv,.xlsx",
    namePlaceholder: "e.g., HDFC Savings Statement - Q1 2026",
    fields: [
      { key: "bankName", label: "Bank / Institution", placeholder: "e.g., HDFC Bank", type: "text", half: true },
      { key: "accountNumber", label: "Account Number (last 4)", placeholder: "e.g., ••••4532", type: "text", half: true },
      { key: "statementPeriod", label: "Statement Period / Date", placeholder: "e.g., Jan - Mar 2026", type: "text", half: true },
      { key: "accountType", label: "Account Type", placeholder: "e.g., Savings, Current, FD", type: "text", half: true },
    ],
    tips: [
      "Mask sensitive account numbers in the scan",
      "Include the full statement period for easy reference",
      "Tax documents should include the assessment year",
    ],
    requiresFile: true,
  },
  insurance: {
    title: "Insurance Policies",
    description: "Health, life, auto, home, and travel insurance policies",
    icon: <ShieldCheck className="h-5 w-5" />,
    gradient: "from-orange-500/10 to-amber-500/5",
    border: "border-orange-500/30",
    acceptTypes: ".pdf,.jpg,.jpeg,.png",
    namePlaceholder: "e.g., LIC Term Plan - Policy #12345",
    fields: [
      { key: "policyNumber", label: "Policy Number", placeholder: "e.g., POL-2026-78901", type: "text", half: true },
      { key: "provider", label: "Insurance Provider", placeholder: "e.g., LIC, Star Health", type: "text", half: true },
      { key: "coverageType", label: "Coverage Type", placeholder: "e.g., Term Life, Health", type: "text", half: true },
      { key: "expiryDate", label: "Policy Expiry", placeholder: "", type: "date", half: true },
      { key: "premiumAmount", label: "Premium Amount", placeholder: "e.g., ₹12,000/year", type: "text", half: true },
      { key: "sumAssured", label: "Sum Assured", placeholder: "e.g., ₹50,00,000", type: "text", half: true },
    ],
    tips: [
      "Upload the full policy document, not just the cover page",
      "Include rider/add-on details if applicable",
      "Set a reminder before the renewal date",
    ],
    requiresFile: true,
  },
  property: {
    title: "Property & Assets",
    description: "Property deeds, registration papers, vehicle documents, valuables",
    icon: <Home className="h-5 w-5" />,
    gradient: "from-violet-500/10 to-purple-500/5",
    border: "border-violet-500/30",
    acceptTypes: ".pdf,.jpg,.jpeg,.png",
    namePlaceholder: "e.g., Flat Registration - Whitefield, Bangalore",
    fields: [
      { key: "registrationNumber", label: "Registration / Survey No.", placeholder: "e.g., SRO-BLR-2024-56789", type: "text", half: true },
      { key: "propertyType", label: "Asset Type", placeholder: "e.g., Flat, Land, Vehicle", type: "text", half: true },
      { key: "location", label: "Location / Address", placeholder: "e.g., 12/A, MG Road, Bangalore", type: "text" },
      { key: "purchaseDate", label: "Purchase / Registration Date", placeholder: "", type: "date", half: true },
      { key: "value", label: "Market Value", placeholder: "e.g., ₹85,00,000", type: "text", half: true },
    ],
    tips: [
      "Include all pages of the registration document",
      "Upload encumbrance certificate if available",
      "For vehicles, include RC and insurance together",
    ],
    requiresFile: true,
  },
  passwords: {
    title: "Passwords & Credentials",
    description: "Website logins, app credentials, WiFi passwords, PINs",
    icon: <KeyRound className="h-5 w-5" />,
    gradient: "from-red-500/10 to-rose-500/5",
    border: "border-red-500/30",
    acceptTypes: "",
    namePlaceholder: "e.g., Gmail - john@example.com",
    fields: [
      { key: "website", label: "Website / Service URL", placeholder: "e.g., https://accounts.google.com", type: "url" },
      { key: "username", label: "Username / Email", placeholder: "e.g., john@example.com", type: "text" },
      { key: "credential", label: "Password / PIN", placeholder: "Enter password or PIN", type: "password" },
      { key: "notes", label: "Notes (recovery email, security questions, etc.)", placeholder: "Any additional information...", type: "textarea" },
    ],
    tips: [
      "Credentials are AES-256-GCM encrypted before storage",
      "Consider using unique passwords for each service",
      "Store recovery codes and backup emails here too",
    ],
    requiresFile: false,
  },
};

const CATEGORY_TAB_ICONS: Record<DocumentCategory, React.ReactNode> = {
  ids: <IdCard className="h-4 w-4" />,
  banking: <CreditCard className="h-4 w-4" />,
  insurance: <ShieldCheck className="h-4 w-4" />,
  property: <Home className="h-4 w-4" />,
  passwords: <KeyRound className="h-4 w-4" />,
};

const UploadPage = () => {
  const { addDocument } = useVault();
  const { status, isContractReady, connectWallet, deployContract, registerDocumentOnChain } = useBlockchain();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("ids");
  const [isShared, setIsShared] = useState(false);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
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

  const cfg = CATEGORY_CONFIG[category];

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFileName(e.target.files[0].name);
      setFile(e.target.files[0]);
    }
  }, []);

  const handleCategoryChange = useCallback((c: DocumentCategory) => {
    setCategory(c);
    setExtraFields({});
    setShowPassword(false);
    setName("");
    setFile(null);
    setFileName("");
  }, []);

  const setField = useCallback((key: string, value: string) => {
    setExtraFields(prev => ({ ...prev, [key]: value }));
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Value copied to clipboard" });
  };

  const handleSubmit = async () => {
    if (!name) return;
    // For passwords, require at least username or credential
    if (category === "passwords" && !extraFields.username && !extraFields.credential) {
      setUploadError("Please enter at least a username or password");
      setPhase("error");
      return;
    }

    setPhase("processing");
    setCurrentStep(0);
    setUploadError("");

    try {
      // For passwords category, build a JSON blob as the "file data"
      let encryptedData: ArrayBuffer | null = null;
      let encKeyHex: string | undefined;
      let fileDataBase64: string | undefined;
      let effectiveFileName = fileName || "Text";
      let effectiveMimeType = file?.type || "application/octet-stream";

      if (category === "passwords") {
        // Encrypt credential data as JSON
        const credentialBlob = JSON.stringify({
          website: extraFields.website || "",
          username: extraFields.username || "",
          credential: extraFields.credential || "",
          notes: extraFields.notes || "",
        });
        const encoder = new TextEncoder();
        const credentialBuffer = encoder.encode(credentialBlob);
        const credentialFile = new File([credentialBuffer], "credentials.json", { type: "application/json" });
        const key = await generateEncryptionKey();
        encryptedData = await encryptFile(credentialFile, key);
        encKeyHex = await exportKey(key);
        effectiveFileName = "credentials.json";
        effectiveMimeType = "application/json";
      } else if (file) {
        const key = await generateEncryptionKey();
        encryptedData = await encryptFile(file, key);
        encKeyHex = await exportKey(key);
      }
      setCurrentStep(1);

      // Step 1: Compute real SHA-256 hash
      let docHash: string;
      if (file && category !== "passwords") {
        docHash = await hashFile(file);
      } else {
        docHash = await hashData(name + "_" + category + "_" + Date.now().toString());
      }
      setCurrentStep(2);

      // Step 2: Prepare encrypted file as base64 for API upload
      if (encryptedData) {
        const bytes = new Uint8Array(encryptedData);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        fileDataBase64 = btoa(binary);
      }
      setCurrentStep(3);

      // Step 3 & 4: Blockchain recording (real transaction if wallet connected)
      const fileSize = file ? formatFileSize(file.size) : category === "passwords" ? "< 1 KB" : "0 B";

      if (isContractReady) {
        const { tx } = await registerDocumentOnChain(file, name, category);
        setCurrentStep(4);
        await new Promise(r => setTimeout(r, 400));

        const doc = await addDocument(
          name, category,
          isShared ? "shared" : "private",
          effectiveFileName,
          fileSize,
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
          category === "passwords" ? "credentials.json" : file?.name,
          effectiveMimeType
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
          effectiveFileName,
          fileSize,
          docHash,
          undefined,
          encKeyHex,
          fileDataBase64,
          category === "passwords" ? "credentials.json" : file?.name,
          effectiveMimeType
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
            {/* ── Category Tabs ──────────────────────────────────────────── */}
            <Tabs value={category} onValueChange={v => handleCategoryChange(v as DocumentCategory)} className="mb-4">
              <TabsList className="grid w-full grid-cols-5">
                {(Object.keys(CATEGORY_CONFIG) as DocumentCategory[]).map(c => (
                  <TabsTrigger key={c} value={c} className="gap-1.5 text-xs px-2">
                    {CATEGORY_TAB_ICONS[c]}
                    <span className="hidden sm:inline">{CATEGORY_INFO[c].label.split(" ")[0]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Card className={`${cfg.border} transition-colors duration-300`}>
              <CardContent className="space-y-5 p-6">
                {/* ── Category Header ──────────────────────────────────── */}
                <motion.div
                  key={category + "-header"}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 rounded-lg bg-gradient-to-r ${cfg.gradient} p-3`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background shadow-sm">
                    <span className="text-xl">{CATEGORY_INFO[category].icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{cfg.title}</p>
                    <p className="text-xs text-muted-foreground">{cfg.description}</p>
                  </div>
                </motion.div>

                {/* ── File Upload Zone (only for non-password categories) ─ */}
                {cfg.requiresFile && (
                  <motion.div
                    key={category + "-upload"}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border-2 border-dashed ${cfg.border} bg-gradient-to-b ${cfg.gradient} p-8 text-center transition-colors`}
                  >
                    <Upload className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="mb-1 text-sm font-medium">
                      {category === "ids" && "Upload your ID scan or photo"}
                      {category === "banking" && "Upload bank statement or financial document"}
                      {category === "insurance" && "Upload insurance policy document"}
                      {category === "property" && "Upload property deed or registration"}
                    </p>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Accepted: {cfg.acceptTypes.split(",").join(", ")}
                    </p>
                    <Input
                      type="file"
                      className="mx-auto max-w-xs"
                      onChange={handleFileChange}
                      accept={cfg.acceptTypes}
                    />
                    {fileName && (
                      <Badge variant="secondary" className="mt-3">
                        <FileUp className="mr-1 h-3 w-3" />{fileName}
                      </Badge>
                    )}
                  </motion.div>
                )}

                {/* ── Passwords: Visual lock zone instead of file upload ── */}
                {!cfg.requiresFile && (
                  <motion.div
                    key="passwords-zone"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border-2 border-dashed ${cfg.border} bg-gradient-to-b ${cfg.gradient} p-6 text-center`}
                  >
                    <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm">
                      <KeyRound className="h-7 w-7 text-red-500" />
                    </div>
                    <p className="text-sm font-medium">Secure Credential Storage</p>
                    <p className="text-xs text-muted-foreground">Your credentials will be AES-256-GCM encrypted before storage</p>
                  </motion.div>
                )}

                {/* ── Document Name ────────────────────────────────────── */}
                <motion.div
                  key={category + "-name"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-2"
                >
                  <Label>{category === "passwords" ? "Service / App Name" : "Document Name"}</Label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={cfg.namePlaceholder}
                  />
                </motion.div>

                {/* ── Category-specific Fields ─────────────────────────── */}
                <motion.div
                  key={category + "-fields"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {cfg.icon}
                    <span>{cfg.title} Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cfg.fields.map(field => {
                      const isFullWidth = !field.half;
                      const wrapperClass = isFullWidth ? "sm:col-span-2" : "";

                      if (field.type === "textarea") {
                        return (
                          <div key={field.key} className={`space-y-1.5 ${wrapperClass}`}>
                            <Label className="text-xs">{field.label}</Label>
                            <Textarea
                              value={extraFields[field.key] || ""}
                              onChange={e => setField(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="min-h-[70px] text-sm"
                            />
                          </div>
                        );
                      }

                      if (field.type === "password") {
                        return (
                          <div key={field.key} className={`space-y-1.5 ${wrapperClass}`}>
                            <Label className="text-xs">{field.label}</Label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                value={extraFields[field.key] || ""}
                                onChange={e => setField(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="pr-16"
                              />
                              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setShowPassword(!showPassword)}
                                >
                                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                                {extraFields[field.key] && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => copyToClipboard(extraFields[field.key])}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (field.type === "url") {
                        return (
                          <div key={field.key} className={`space-y-1.5 ${wrapperClass}`}>
                            <Label className="text-xs">{field.label}</Label>
                            <div className="relative">
                              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                type="url"
                                value={extraFields[field.key] || ""}
                                onChange={e => setField(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="pl-8"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={field.key} className={`space-y-1.5 ${wrapperClass}`}>
                          <Label className="text-xs">{field.label}</Label>
                          <Input
                            type={field.type}
                            value={extraFields[field.key] || ""}
                            onChange={e => setField(field.key, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* ── Tips ─────────────────────────────────────────────── */}
                <motion.div
                  key={category + "-tips"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className={`rounded-lg ${cfg.border} bg-gradient-to-r ${cfg.gradient} p-3`}
                >
                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                    {cfg.icon}
                    Tips for {cfg.title}
                  </p>
                  <ul className="space-y-1">
                    {cfg.tips.map((tip, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <span className="mt-0.5 text-[10px]">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* ── Share Toggle ─────────────────────────────────────── */}
                <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                  <div>
                    <p className="text-sm font-medium">Share with Family</p>
                    <p className="text-xs text-muted-foreground">Make visible to family members</p>
                  </div>
                  <Switch checked={isShared} onCheckedChange={setIsShared} />
                </div>

                {/* ── Security Pipeline ────────────────────────────────── */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1.5">🔐 Security Pipeline</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                    <span>✓ AES-256-GCM Encryption</span>
                    <span>✓ SHA-256 File Hashing</span>
                    <span>✓ Distributed Cloud Storage</span>
                    <span>{isContractReady ? "✓ Ethereum On-Chain Record" : "○ Connect wallet for on-chain"}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  size="lg"
                  className="w-full gap-2"
                  disabled={!name || (cfg.requiresFile && !file)}
                >
                  <Lock className="h-4 w-4" />
                  {category === "passwords" ? "Encrypt & Store Credential" : "Encrypt & Store Securely"}
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
                  <Button variant="outline" className="flex-1" onClick={() => { setPhase("form"); setName(""); setFileName(""); setFile(null); setCurrentStep(0); setExtraFields({}); setShowPassword(false); }}>Upload Another</Button>
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
