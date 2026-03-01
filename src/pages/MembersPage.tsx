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
import { Users, Plus, Trash2, FileText, Wallet, Shield, Loader2, Eye, EyeOff } from "lucide-react";
import { generateManagedWallet } from "@/services/walletManager";

const MembersPage = () => {
  const { members, documents, addMember, removeMember } = useVault();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("Spouse");
  const [memberPassword, setMemberPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adding, setAdding] = useState(false);

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
      // Generate a blockchain wallet for the member, encrypted with their password.
      // The private key is encrypted client-side (AES-256-GCM + PBKDF2) — never sent to server in plaintext.
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

  const handleRemove = async (id: string, memberName: string) => {
    try {
      await removeMember(id);
      toast({ title: "Member removed", description: `${memberName} has been removed from the vault.` });
    } catch (err: any) {
      toast({ title: "Failed to remove member", description: err?.message || "Something went wrong.", variant: "destructive" });
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

              {/* Member login credentials */}
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

      {members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold">No family members yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add family members to share documents securely.</p>
          </CardContent>
        </Card>
      ) : (
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
      )}
    </div>
  );
};

export default MembersPage;
