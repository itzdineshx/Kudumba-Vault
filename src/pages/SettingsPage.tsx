/**
 * Settings Page — PIN & Biometric setup for document verification
 * 
 * All family members (owner + members) can:
 * - Set / change / remove a numeric PIN (4-8 digits) — shared across the family
 * - Register / remove biometric credentials (fingerprint / face ID) — synced family-wide
 * 
 * These are required before viewing or downloading any documents.
 */

import { useState, useEffect, useCallback } from "react";
import { useVault } from "@/context/VaultContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  KeyRound, Fingerprint, Shield, Loader2, CheckCircle2,
  Trash2, Plus, AlertCircle, Eye, EyeOff, Smartphone, Lock, Hash, Copy
} from "lucide-react";
import { verificationApi, VerificationStatusResponse } from "@/services/api";
import {
  hashPin, isBiometricAvailable, isPlatformAuthenticatorAvailable,
  registerBiometric, clearVerification
} from "@/services/verification";

const SettingsPage = () => {
  const { userId, userName, userRole, familyId } = useVault();

  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // PIN state
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);
  const [removingPin, setRemovingPin] = useState(false);

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [registeringBiometric, setRegisteringBiometric] = useState(false);
  const [removingBiometric, setRemovingBiometric] = useState<string | null>(null);

  // Load verification status
  const loadStatus = useCallback(async () => {
    try {
      const s = await verificationApi.status();
      setStatus(s);
    } catch {
      setStatus({ hasPin: false, hasBiometric: false, biometricDevices: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    isPlatformAuthenticatorAvailable().then(setBiometricSupported);
  }, [loadStatus]);

  // ─── PIN Setup ────────────────────────────────────────────────────────────

  const handleSetupPin = async () => {
    if (pin.length < 4 || pin.length > 8) {
      toast({ title: "Invalid PIN", description: "PIN must be 4-8 digits.", variant: "destructive" });
      return;
    }
    if (pin !== confirmPin) {
      toast({ title: "PINs don't match", description: "Please make sure both PINs match.", variant: "destructive" });
      return;
    }

    setSavingPin(true);
    try {
      const hashed = await hashPin(pin);
      await verificationApi.setupPin(hashed);
      toast({ title: "PIN set up!", description: "You can now use this PIN to verify your identity when viewing documents." });
      setPin("");
      setConfirmPin("");
      setShowPinSetup(false);
      clearVerification(); // Force re-verification with new PIN
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Failed to set PIN", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    setRemovingPin(true);
    try {
      await verificationApi.removePin();
      toast({ title: "PIN removed", description: "PIN verification has been disabled." });
      clearVerification();
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Failed to remove PIN", description: err?.message, variant: "destructive" });
    } finally {
      setRemovingPin(false);
    }
  };

  // ─── Biometric Setup ─────────────────────────────────────────────────────

  const handleRegisterBiometric = async () => {
    setRegisteringBiometric(true);
    try {
      const { challenge } = await verificationApi.getBiometricChallenge();
      const credential = await registerBiometric(userId, userName, challenge);
      
      // Detect device name
      const ua = navigator.userAgent.toLowerCase();
      let deviceName = "Biometric Device";
      if (ua.includes("iphone") || ua.includes("ipad")) deviceName = "Apple Face ID / Touch ID";
      else if (ua.includes("android")) deviceName = "Android Biometric";
      else if (ua.includes("mac")) deviceName = "Mac Touch ID";
      else if (ua.includes("windows")) deviceName = "Windows Hello";

      await verificationApi.registerBiometric({
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        deviceName,
      });

      toast({ title: "Biometric registered!", description: `${deviceName} has been set up for verification.` });
      clearVerification();
      await loadStatus();
    } catch (err: any) {
      if (err?.message?.includes("cancelled")) {
        toast({ title: "Cancelled", description: "Biometric registration was cancelled.", variant: "destructive" });
      } else {
        toast({ title: "Registration failed", description: err?.message || "Could not register biometric.", variant: "destructive" });
      }
    } finally {
      setRegisteringBiometric(false);
    }
  };

  const handleRemoveBiometric = async (credentialId: string) => {
    setRemovingBiometric(credentialId);
    try {
      await verificationApi.removeBiometric(credentialId);
      toast({ title: "Biometric removed" });
      clearVerification();
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err?.message, variant: "destructive" });
    } finally {
      setRemovingBiometric(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Set up PIN &amp; biometric verification for your family vault. Settings are shared across all family members.
        </p>
      </div>

      {/* Security Overview */}
      {userRole === "owner" && familyId && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <Hash className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Your Family ID</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Share this code with family members so they can join your vault from the login page.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-lg bg-background px-4 py-2 font-mono text-lg font-bold tracking-widest">{familyId}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(familyId);
                      toast({ title: "Family ID copied!" });
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Overview - Document Verification */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Document Verification</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Before anyone in your family can view or download documents, they must verify their identity using a PIN or biometric (fingerprint / face ID).
                These settings are synced across all accounts in your family.
              </p>
              <div className="mt-3 flex gap-2">
                {status?.hasPin ? (
                  <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> PIN Active</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground"><KeyRound className="h-3 w-3" /> No PIN</Badge>
                )}
                {status?.hasBiometric ? (
                  <Badge className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Biometric Active</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 text-muted-foreground"><Fingerprint className="h-3 w-3" /> No Biometric</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PIN Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="h-5 w-5" /> PIN Verification
          </CardTitle>
          <CardDescription>
            Set a 4-8 digit PIN shared across all family members to verify identity before accessing documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.hasPin && !showPinSetup ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-green-500/5 border border-green-500/20 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-600">PIN is active</p>
                  <p className="text-xs text-muted-foreground">Your PIN is securely stored (hashed + encrypted)</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowPinSetup(true)}>
                  <KeyRound className="h-3.5 w-3.5" /> Change PIN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-destructive hover:text-destructive"
                  onClick={handleRemovePin}
                  disabled={removingPin}
                >
                  {removingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Remove PIN
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {!showPinSetup && !status?.hasPin ? (
                <Button onClick={() => setShowPinSetup(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Set Up PIN
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Enter a 4-8 digit PIN</Label>
                    <div className="relative max-w-xs">
                      <Input
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={8}
                        value={pin}
                        onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••"
                        className="text-center text-lg tracking-[0.5em] font-mono pr-10"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm PIN</Label>
                    <Input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                      className="text-center text-lg tracking-[0.5em] font-mono max-w-xs"
                      autoComplete="off"
                    />
                  </div>
                  {pin.length >= 4 && confirmPin.length >= 4 && pin !== confirmPin && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> PINs don't match
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSetupPin}
                      disabled={pin.length < 4 || pin !== confirmPin || savingPin}
                      className="gap-1"
                    >
                      {savingPin ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {status?.hasPin ? "Update PIN" : "Save PIN"}
                    </Button>
                    <Button variant="ghost" onClick={() => { setShowPinSetup(false); setPin(""); setConfirmPin(""); }}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Biometric Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Fingerprint className="h-5 w-5" /> Biometric Verification
          </CardTitle>
          <CardDescription>
            Use fingerprint or face ID for quick verification — each family member can register their own device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!biometricSupported || !isBiometricAvailable() ? (
            <div className="flex items-center gap-3 rounded-lg bg-muted p-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Not available on this device</p>
                <p className="text-xs text-muted-foreground">
                  Biometric verification requires a device with fingerprint sensor or face recognition (smartphone, laptop with Windows Hello, Mac with Touch ID).
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Registered devices */}
              {status?.biometricDevices && status.biometricDevices.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Registered devices</p>
                  {status.biometricDevices.map(device => (
                    <div key={device.credentialId} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10">
                          <Smartphone className="h-4 w-4 text-green-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{device.deviceName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Registered {new Date(device.registeredAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveBiometric(device.credentialId)}
                        disabled={removingBiometric === device.credentialId}
                      >
                        {removingBiometric === device.credentialId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRegisterBiometric}
                disabled={registeringBiometric}
              >
                {registeringBiometric ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {registeringBiometric ? "Registering..." : "Add Biometric"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">How it works</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>PIN and biometric settings are synced across all family accounts</li>
                <li>The same PIN works for the family head and every approved member</li>
                <li>Each family member can register their own biometric (fingerprint / face ID) from their device</li>
                <li>Your PIN is hashed (SHA-256) before leaving your device — the server never sees your actual PIN</li>
                <li>Biometric data never leaves your device — only a cryptographic proof is shared</li>
                <li>After successful verification, your session stays unlocked for 15 minutes</li>
                <li>Closing the browser tab automatically locks the session</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
