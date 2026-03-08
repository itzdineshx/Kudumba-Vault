import { useState } from "react";
import { useVault } from "@/context/VaultContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, FileText, Wallet, Shield, Loader2, Eye, EyeOff, CheckCircle2, XCircle, Clock, Hash, Copy } from "lucide-react";
import { generateManagedWallet } from "@/services/walletManager";

const MembersPage = () => {
  const { members, documents, pendingMembers, familyId, addMember, removeMember, approveMember, rejectMember } = useVault();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const [memberPassword, setMemberPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvePasswordDialog, setApprovePasswordDialog] = useState<{ id: string; name: string; email: string } | null>(null);
  const [approvePassword, setApprovePassword] = useState("");
  const [approveConfirmPassword, setApproveConfirmPassword] = useState("");
  const [showApprovePassword, setShowApprovePassword] = useState(false);

  const handleAdd = async () => {
    if (!name || !email) return;
    if (!memberPassword || memberPassword.length < 6) {
      toast({ title: "Password required", description: "Member password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (memberPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords match.", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const encryptedWallet = await generateManagedWallet(memberPassword);
      await addMember(name, email, relationship, memberPassword, encryptedWallet);

      toast({
        title: "Member added!",
        description: `${name} has been added with a secure blockchain wallet. Share their login credentials: email & password.`,
      });
      setOpen(false);
      setName("");
      setEmail("");
      setMemberPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Failed to add member", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleApproveStart = (id: string, memberName: string, memberEmail: string) => {
    setApprovePasswordDialog({ id, name: memberName, email: memberEmail });
    setApprovePassword("");
    setApproveConfirmPassword("");
  };

  const handleApproveSubmit = async () => {
    if (!approvePasswordDialog) return;
    if (!approvePassword || approvePassword.length < 6) {
      toast({ title: "Password required", description: "Must be at least 6 characters to generate a blockchain wallet.", variant: "destructive" });
      return;
    }
    if (approvePassword !== approveConfirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }

    setApprovingId(approvePasswordDialog.id);
    try {
      // Generate a blockchain wallet encrypted with the temporary password
      const encryptedWallet = await generateManagedWallet(approvePassword);
      await approveMember(approvePasswordDialog.id, encryptedWallet);

      toast({
        title: "Member approved!",
        description: `${approvePasswordDialog.name} has been approved and added to the blockchain network. Share this temporary wallet password with them so they can access their wallet.`,
      });
      setApprovePasswordDialog(null);
    } catch (err: any) {
      toast({ title: "Failed to approve member", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: string, memberName: string) => {
    setRejectingId(id);
    try {
      await rejectMember(id);
      toast({ title: "Request rejected", description: `${memberName}'s join request has been rejected.` });
    } catch (err: any) {
      toast({ title: "Failed to reject", description: err?.message || "Something went wrong.", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  const handleRemove = async (id: string, memberName: string) => {
    try {
      await removeMember(id);
      toast({ title: "Member removed", description: `${memberName} has been removed from the vault.` });
    } catch (err: any) {
      toast({ title: "Failed to remove member", description: err?.message || "Something went wrong.", variant: "destructive" });
    }
  };

  const copyFamilyId = () => {
    if (familyId) {
      navigator.clipboard.writeText(familyId);
      toast({ title: "Family ID copied!", description: "Share this code with family members so they can join your vault." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Family Members</h1>
          <p className="mt-1 text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""} in your vault</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Family Member</DialogTitle><DialogDescription>Add a new family member to share documents securely. A blockchain wallet will be created automatically for them.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Johnson" /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@family.com" /></div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Spouse", "Son", "Daughter", "Parent", "Sibling", "Other"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Shield className="h-4 w-4" />
                  Member Login Password
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Set a password for this member. They'll use their email + this password to log in. A blockchain wallet is generated and encrypted with this password automatically.
                </p>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={memberPassword}
                      onChange={e => setMemberPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                  />
                </div>
              </div>

              <Button onClick={handleAdd} className="w-full gap-2" disabled={!name || !email || !memberPassword || adding}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {adding ? "Creating Account & Wallet..." : "Add to Family Vault"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Family ID Card */}
      {familyId && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Hash className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Your Family ID</p>
                <p className="text-xs text-muted-foreground">Share this code with family members so they can join your vault</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-background px-4 py-2 font-mono text-lg font-bold tracking-widest">{familyId}</span>
              <Button variant="outline" size="icon" onClick={copyFamilyId}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Join Requests */}
      {pendingMembers.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Join Requests ({pendingMembers.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingMembers.map(p => (
              <Card key={p.id} className="border-amber-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-amber-500/10 text-amber-600 font-semibold">
                        {p.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600">{p.relationship}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      <Clock className="mr-1 h-3 w-3" />
                      {new Date(p.createdAt).toLocaleDateString()}
                    </Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1"
                      onClick={() => handleApproveStart(p.id, p.name, p.email)}
                      disabled={approvingId === p.id}
                    >
                      {approvingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-destructive hover:text-destructive"
                      onClick={() => handleReject(p.id, p.name)}
                      disabled={rejectingId === p.id}
                    >
                      {rejectingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approve Password Dialog */}
      <Dialog open={!!approvePasswordDialog} onOpenChange={(open) => { if (!open) setApprovePasswordDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Create Blockchain Wallet</DialogTitle>
            <DialogDescription>
              Set a temporary wallet password for {approvePasswordDialog?.name}. Share this password with them so they can access their blockchain wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-sm"><strong>{approvePasswordDialog?.name}</strong></p>
              <p className="text-xs text-muted-foreground">{approvePasswordDialog?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Wallet Password</Label>
              <div className="relative">
                <Input
                  type={showApprovePassword ? "text" : "password"}
                  value={approvePassword}
                  onChange={e => setApprovePassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApprovePassword(!showApprovePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApprovePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type={showApprovePassword ? "text" : "password"}
                value={approveConfirmPassword}
                onChange={e => setApproveConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            <Button onClick={handleApproveSubmit} className="w-full gap-2" disabled={!approvePassword || approvingId !== null}>
              {approvingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              {approvingId ? "Approving & Creating Wallet..." : "Approve & Add to Blockchain"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {members.length === 0 && pendingMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No family members yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add family members or share your Family ID so they can request to join.</p>
          </CardContent>
        </Card>
      ) : members.length > 0 ? (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map(m => {
          const accessibleDocs = documents.filter(d => d.sharedWith.some(s => s.memberId === m.id && !s.revoked));
          return (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11"><AvatarFallback className="bg-primary/10 text-primary font-semibold">{m.avatarInitials}</AvatarFallback></Avatar>
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleRemove(m.id, m.name)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{m.relationship}</Badge>
                  <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />{accessibleDocs.length} doc{accessibleDocs.length !== 1 ? "s" : ""}</Badge>
                  {m.walletAddress && (
                    <Badge variant="outline" className="gap-1 font-mono text-[10px]">
                      <Wallet className="h-3 w-3" />
                      {m.walletAddress.slice(0, 6)}…{m.walletAddress.slice(-4)}
                    </Badge>
                  )}
                </div>
                {accessibleDocs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Accessible Documents:</p>
                    {accessibleDocs.map(d => (
                      <p key={d.id} className="text-xs text-muted-foreground">• {d.name}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      ) : null}
    </div>
  );
};

export default MembersPage;
