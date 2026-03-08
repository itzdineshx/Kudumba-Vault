/**
 * VerificationGate — reusable dialog for PIN/Biometric verification
 * 
 * Used before allowing document view/download for ALL family members (owner + members).
 * PIN and biometric settings are synced family-wide.
 * Once verified, the session stays unlocked for 15 minutes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Lock, Fingerprint, KeyRound, Loader2, ShieldCheck, AlertCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { hashPin, isSessionVerified, setVerified, refreshVerification, isBiometricAvailable, verifyBiometric } from "@/services/verification";
import { verificationApi } from "@/services/api";

interface VerificationGateProps {
  /** Whether the gate dialog is open */
  open: boolean;
  /** Called when the dialog should close (cancel) */
  onClose: () => void;
  /** Called when verification succeeds */
  onVerified: () => void;
  /** Optional title override */
  title?: string;
}

export default function VerificationGate({ open, onClose, onVerified, title }: VerificationGateProps) {
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ hasPin: boolean; hasBiometric: boolean; biometricDevices: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Fetch setup status when gate opens
  useEffect(() => {
    if (!open) return;
    setError("");
    setPin("");
    setLoading(true);

    // First check session — maybe already verified
    const session = isSessionVerified();
    if (session.verified) {
      refreshVerification();
      onVerified();
      return;
    }

    verificationApi.status()
      .then(s => setStatus(s))
      .catch(() => setStatus({ hasPin: false, hasBiometric: false, biometricDevices: [] }))
      .finally(() => setLoading(false));
  }, [open, onVerified]);

  // Auto-focus PIN input
  useEffect(() => {
    if (!loading && status?.hasPin && pinInputRef.current) {
      setTimeout(() => pinInputRef.current?.focus(), 100);
    }
  }, [loading, status]);

  const handlePinVerify = useCallback(async () => {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setVerifying(true);
    setError("");
    try {
      const hashed = await hashPin(pin);
      const result = await verificationApi.verifyPin(hashed);
      if (result.verified) {
        setVerified("pin");
        toast({ title: "Verified", description: "PIN verification successful." });
        onVerified();
      } else {
        setError("Invalid PIN. Please try again.");
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed");
    } finally {
      setVerifying(false);
      setPin("");
    }
  }, [pin, onVerified]);

  const handleBiometricVerify = useCallback(async () => {
    if (!status?.biometricDevices?.length) return;
    setVerifying(true);
    setError("");
    try {
      const { challenge } = await verificationApi.getBiometricChallenge();
      const credentialIds = status.biometricDevices.map(d => d.credentialId);
      const assertion = await verifyBiometric(challenge, credentialIds);
      const result = await verificationApi.verifyBiometric(assertion.credentialId);
      if (result.verified) {
        setVerified("biometric");
        toast({ title: "Verified", description: "Biometric verification successful." });
        onVerified();
      } else {
        setError("Biometric verification failed.");
      }
    } catch (err: any) {
      if (err?.message?.includes("cancelled")) {
        setError("Biometric verification was cancelled.");
      } else {
        setError(err?.message || "Biometric verification failed");
      }
    } finally {
      setVerifying(false);
    }
  }, [status, onVerified]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handlePinVerify();
  };

  const hasNoSetup = status && !status.hasPin && !status.hasBiometric;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {title || "Verify Your Identity"}
          </DialogTitle>
          <DialogDescription>
            Enter your family PIN or use biometrics to access this document
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Checking setup...</p>
          </div>
        ) : hasNoSetup ? (
          /* Member hasn't set up any verification method */
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                <AlertCircle className="h-6 w-6 text-orange-500" />
              </div>
              <h3 className="font-semibold">Setup Required</h3>
              <p className="text-sm text-muted-foreground">
                Your family vault needs a PIN or biometric set up before anyone can view documents. Go to Settings to set up verification — it will apply to all family members.
              </p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => { onClose(); navigate("/settings"); }}
            >
              <Settings className="h-4 w-4" /> Go to Settings
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* PIN Input */}
            {status?.hasPin && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Enter PIN</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={pin}
                    onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your PIN"
                    className="text-center text-lg tracking-[0.5em] font-mono"
                    disabled={verifying}
                    autoComplete="off"
                  />
                  <Button
                    onClick={handlePinVerify}
                    disabled={pin.length < 4 || verifying}
                    className="shrink-0"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Separator if both methods available */}
            {status?.hasPin && status?.hasBiometric && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>
            )}

            {/* Biometric Button */}
            {status?.hasBiometric && isBiometricAvailable() && (
              <Button
                variant="outline"
                className="w-full gap-2 h-12"
                onClick={handleBiometricVerify}
                disabled={verifying}
              >
                {verifying ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Fingerprint className="h-5 w-5" />
                )}
                {verifying ? "Verifying..." : "Use Fingerprint / Face ID"}
              </Button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            <Button variant="ghost" className="w-full text-xs" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
