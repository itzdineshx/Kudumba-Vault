import { useState } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { UserRole } from "@/types/vault";
import { authApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield, Users, Wallet, CheckCircle2, Loader2, UserPlus, AlertCircle, Hash } from "lucide-react";

const LoginPage = () => {
  const { isFirstTime, register, login, loginWithRole } = useVault();
  const { status, wallet, connectWallet, connectWithManagedWallet } = useBlockchain();

  const [mode, setMode] = useState<"login" | "register" | "join">(isFirstTime ? "register" : "login");
  const [role, setRole] = useState<UserRole>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [familyIdInput, setFamilyIdInput] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Please enter your name."); setSubmitting(false); return; }
        if (!email.trim()) { setError("Please enter your email."); setSubmitting(false); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); setSubmitting(false); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setSubmitting(false); return; }
        if (!familyNameInput.trim()) { setError("Please enter a family vault name."); setSubmitting(false); return; }

        await register(name.trim(), email.trim(), password, familyNameInput.trim());
      } else if (mode === "join") {
        if (!name.trim()) { setError("Please enter your name."); setSubmitting(false); return; }
        if (!email.trim()) { setError("Please enter your email."); setSubmitting(false); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); setSubmitting(false); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setSubmitting(false); return; }
        if (!familyIdInput.trim()) { setError("Please enter the Family ID."); setSubmitting(false); return; }

        const result = await authApi.join({
          name: name.trim(),
          email: email.trim(),
          password,
          familyId: familyIdInput.trim().toUpperCase(),
          relationship,
        });
        setSuccessMessage(result.message);
        setSubmitting(false);
        return;
      } else {
        if (!email.trim() || !password) { setError("Please enter your email and password."); setSubmitting(false); return; }
        const result = await login(email.trim(), password);
        if (!result.success) {
          setError("Invalid email or password.");
          setSubmitting(false);
          return;
        }

        if (result.encryptedWallet) {
          try {
            await connectWithManagedWallet(result.encryptedWallet, password);
          } catch {
            console.warn("Managed wallet auto-connect failed — member can still use the vault");
          }
        }

        loginWithRole(role);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletConnect = async () => {
    try {
      setConnecting(true);
      await connectWallet();
    } catch {
      // Error handled in context
    } finally {
      setConnecting(false);
    }
  };

  const cardTitle = mode === "register" ? "Create Your Vault" : mode === "join" ? "Join a Family Vault" : "Welcome Back";
  const cardDesc = mode === "register"
    ? "Set up your family vault with a secure account"
    : mode === "join"
    ? "Enter the Family ID shared by your family head"
    : "Sign in to access your family vault";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="mb-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="mx-auto mb-3">
            <img src="/kudumba-logo.png" alt="Kudumba Vault" className="h-32 w-auto mx-auto object-contain" />
          </motion.div>
          <p className="mt-2 text-muted-foreground">Blockchain-secured document & credential vault</p>
        </div>

        <Card className="border-0 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">{cardTitle}</CardTitle>
            <CardDescription>{cardDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <AnimatePresence mode="wait">
              {mode === "register" ? (
                <motion.div key="reg" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Your Name</Label>
                    <Input id="reg-name" value={name} onChange={e => setName(e.target.value)} placeholder="John Johnson" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input id="reg-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@family.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-family">Family Vault Name</Label>
                    <Input id="reg-family" value={familyNameInput} onChange={e => setFamilyNameInput(e.target.value)} placeholder="Johnson Family" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">Password</Label>
                    <Input id="reg-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <Input id="reg-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                </motion.div>
              ) : mode === "join" ? (
                <motion.div key="join" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <Hash className="h-4 w-4" />
                      Family ID
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Ask your family head for the Family ID. It's shown in their Settings or Dashboard page.
                    </p>
                    <Input
                      className="mt-2 text-center text-lg font-mono tracking-widest uppercase"
                      value={familyIdInput}
                      onChange={e => setFamilyIdInput(e.target.value.toUpperCase())}
                      placeholder="E.g. A1B2C3D4"
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-name">Your Name</Label>
                    <Input id="join-name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Johnson" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-email">Email</Label>
                    <Input id="join-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@family.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship</Label>
                    <Select value={relationship} onValueChange={setRelationship}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Spouse", "Son", "Daughter", "Parent", "Sibling", "Other"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-pass">Password</Label>
                    <Input id="join-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-confirm">Confirm Password</Label>
                    <Input id="join-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                  </div>
                </motion.div>
              ) : (
                <motion.div key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                  <div className="flex gap-2 rounded-lg bg-muted p-1">
                    <button onClick={() => setRole("owner")} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${role === "owner" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      <Lock className="mr-1.5 inline h-3.5 w-3.5" /> Family Owner
                    </button>
                    <button onClick={() => setRole("member")} className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${role === "member" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      <Users className="mr-1.5 inline h-3.5 w-3.5" /> Family Member
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@family.com" autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMessage}
              </div>
            )}

            {!successMessage && (
              <Button onClick={handleSubmit} className="w-full gap-2" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {mode === "register" ? <><UserPlus className="h-4 w-4" /> Create Vault</> : mode === "join" ? <><Users className="h-4 w-4" /> Request to Join</> : <><Lock className="h-4 w-4" /> Sign In</>}
              </Button>
            )}

            <div className="flex flex-col gap-1">
              {mode === "login" && (
                <>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("register"); setError(""); setSuccessMessage(""); }}>
                    New here? Create a vault
                  </Button>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("join"); setError(""); setSuccessMessage(""); }}>
                    <Hash className="mr-1.5 h-3.5 w-3.5" /> Join a family with Family ID
                  </Button>
                </>
              )}
              {mode === "register" && (
                <>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}>
                    Already have an account? Sign in
                  </Button>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("join"); setError(""); setSuccessMessage(""); }}>
                    <Hash className="mr-1.5 h-3.5 w-3.5" /> Join a family with Family ID
                  </Button>
                </>
              )}
              {mode === "join" && (
                <>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}>
                    Already have an account? Sign in
                  </Button>
                  <Button variant="ghost" className="w-full text-sm" onClick={() => { setMode("register"); setError(""); setSuccessMessage(""); }}>
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create your own vault instead
                  </Button>
                </>
              )}
            </div>

            {mode !== "join" && (
              <>
                {/* Wallet Connection — different behavior for owners vs members */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">blockchain wallet</span></div>
                </div>

                {mode === "login" && role === "member" ? (
                  <div className="flex items-center gap-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
                      <Shield className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-600">Auto-Managed Wallet</p>
                      <p className="text-[10px] text-muted-foreground">Your blockchain wallet connects automatically on login — no extensions needed</p>
                    </div>
                  </div>
                ) : status === "connected" && wallet ? (
                  <div className="flex items-center gap-3 rounded-lg bg-green-500/5 border border-green-500/20 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-600">Wallet Connected</p>
                      <p className="text-[10px] font-mono text-muted-foreground truncate">{wallet.address}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-500">
                      {parseFloat(wallet.balance).toFixed(3)} ETH
                    </Badge>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleWalletConnect}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    {connecting ? "Connecting MetaMask..." : "Connect MetaMask Wallet"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">🔒 AES-256 encrypted · 🔗 Ethereum blockchain verified · ☁️ Distributed storage</p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
