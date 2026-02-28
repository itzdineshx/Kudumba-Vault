import { useState } from "react";
import { useVault } from "@/context/VaultContext";
import { useBlockchain } from "@/context/BlockchainContext";
import { UserRole } from "@/types/vault";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Shield, Users, Wallet, CheckCircle2, Loader2, UserPlus, AlertCircle } from "lucide-react";

const LoginPage = () => {
  const { isFirstTime, register, login, loginWithRole } = useVault();
  const { status, wallet, connectWallet } = useBlockchain();

  const [mode, setMode] = useState<"login" | "register">(isFirstTime ? "register" : "login");
  const [role, setRole] = useState<UserRole>("owner");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [familyNameInput, setFamilyNameInput] = useState("");
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    try {
      if (mode === "register") {
        if (!name.trim()) { setError("Please enter your name."); setSubmitting(false); return; }
        if (!email.trim()) { setError("Please enter your email."); setSubmitting(false); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); setSubmitting(false); return; }
        if (password !== confirmPassword) { setError("Passwords do not match."); setSubmitting(false); return; }
        if (!familyNameInput.trim()) { setError("Please enter a family vault name."); setSubmitting(false); return; }

        await register(name.trim(), email.trim(), password, familyNameInput.trim());
      } else {
        if (!email.trim() || !password) { setError("Please enter your email and password."); setSubmitting(false); return; }
        const ok = await login(email.trim(), password);
        if (!ok) {
          setError("Invalid email or password.");
          setSubmitting(false);
          return;
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

  const cardTitle = mode === "register" ? "Create Your Vault" : "Welcome Back";
  const cardDesc = mode === "register"
    ? "Set up your family vault with a secure account"
    : "Sign in to access your family vault";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
        <div className="mb-8 text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Shield className="h-8 w-8" />
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground">Kudumba Vault</h1>
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

            <Button onClick={handleSubmit} className="w-full gap-2" size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === "register" ? <><UserPlus className="h-4 w-4" /> Create Vault</> : <><Lock className="h-4 w-4" /> Sign In</>}
            </Button>

            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}
            >
              {mode === "register" ? "Already have an account? Sign in" : "New here? Create a vault"}
            </Button>

            {/* Wallet Connection */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">blockchain wallet</span></div>
            </div>

            {status === "connected" && wallet ? (
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
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">🔒 AES-256 encrypted · 🔗 Ethereum blockchain verified · ☁️ Distributed storage</p>
      </motion.div>
    </div>
  );
};

export default LoginPage;
