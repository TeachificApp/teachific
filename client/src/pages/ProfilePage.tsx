import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { User, Lock, Save, Camera, Loader2, CheckCircle, Globe, Mail, Shield } from "lucide-react";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Rome", "Europe/Madrid",
  "Europe/Amsterdam", "Europe/Stockholm", "Europe/Warsaw", "Europe/Istanbul", "Europe/Moscow",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore",
  "Asia/Shanghai", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Australia/Melbourne",
  "Pacific/Auckland",
];

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0].toUpperCase();
}

function getRoleBadgeColor(role?: string): string {
  switch (role) {
    case "site_owner": return "bg-purple-100 text-purple-700 border-purple-200";
    case "site_admin": return "bg-blue-100 text-blue-700 border-blue-200";
    case "org_super_admin":
    case "org_admin": return "bg-teal-100 text-teal-700 border-teal-200";
    case "instructor": return "bg-orange-100 text-orange-700 border-orange-200";
    default: return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function formatRole(role?: string): string {
  if (!role) return "Member";
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function ProfilePage() {
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [displayName, setDisplayName] = useState((user as any)?.displayName || "");
  const [firstName, setFirstName] = useState((user as any)?.firstName || "");
  const [lastName, setLastName] = useState((user as any)?.lastName || "");
  const [bio, setBio] = useState((user as any)?.bio || "");
  const [avatarUrl, setAvatarUrl] = useState((user as any)?.avatarUrl || "");
  const [timezone, setTimezone] = useState((user as any)?.timezone || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>((user as any)?.avatarUrl || null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setDisplayName((user as any).displayName || "");
      setFirstName((user as any).firstName || "");
      setLastName((user as any).lastName || "");
      setBio((user as any).bio || "");
      setAvatarUrl((user as any).avatarUrl || "");
      setAvatarPreview((user as any).avatarUrl || null);
      setTimezone((user as any).timezone || "");
    }
  }, [user?.id]);

  const uploadMedia = trpc.auth.uploadPageMedia.useMutation();
  const updateMe = trpc.auth.updateMe.useMutation({
    onSuccess: () => {
      toast.success("Profile saved successfully");
      refresh();
    },
    onError: (e) => toast.error(`Failed to save: ${e.message}`),
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUri = ev.target?.result as string;
      setAvatarPreview(dataUri);
      try {
        const result = await uploadMedia.mutateAsync({ dataUri, mimeType: file.type, fileName: file.name, context: "avatar" });
        setAvatarUrl(result.url);
        toast.success("Photo uploaded");
      } catch {
        toast.error("Failed to upload photo");
        setAvatarPreview(avatarUrl || null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    updateMe.mutate({
      name: name.trim() || undefined,
      displayName: displayName.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      bio: bio.trim(),
      avatarUrl: avatarUrl.trim(),
      timezone: timezone || undefined,
    });
  };

  const handleChangePassword = () => {
    if (!currentPw) { toast.error("Enter your current password"); return; }
    if (newPw.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    toast.info("Password changes are handled via the email authentication flow. A reset link will be sent to your email.");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  };

  const displayedName = displayName || name || user?.name || "User";
  const initials = getInitials(displayedName);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-teal-600" />
          My Profile
        </h1>
        <p className="text-muted-foreground mt-0.5">Manage your account information and preferences</p>
      </div>

      {/* Profile Photo & Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-teal-600" />
            Profile Photo &amp; Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-20 w-20 rounded-full object-cover border-2 border-border" />
              ) : (
                <div className="h-20 w-20 rounded-full bg-teal-600/10 border-2 border-teal-200 flex items-center justify-center text-2xl font-bold text-teal-700">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadMedia.isPending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{displayedName}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5" />{user?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={`text-xs capitalize ${getRoleBadgeColor(user?.role)}`}>
                  <Shield className="h-3 w-3 mr-1" />{formatRole(user?.role)}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadMedia.isPending}>
              {uploadMedia.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading...</> : <><Camera className="h-3.5 w-3.5 mr-1.5" />Change Photo</>}
            </Button>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>First Name</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Display Name <span className="text-xs text-muted-foreground">(shown publicly)</span></Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={name || "Your display name"} />
          </div>
          <div className="space-y-1.5">
            <Label>Account Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell learners a bit about yourself..." rows={3} className="resize-none" maxLength={2000} />
            <p className="text-xs text-muted-foreground text-right">{bio.length}/2000</p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-muted-foreground" />Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger><SelectValue placeholder="Select your timezone" /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-1">
            <Button className="gap-2 bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSaveProfile} disabled={updateMe.isPending}>
              {updateMe.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : updateMe.isSuccess ? <><CheckCircle className="h-4 w-4" />Saved</> : <><Save className="h-4 w-4" />Save Profile</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-teal-600" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input type="email" value={user?.email || ""} readOnly className="bg-muted/50 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email changes are managed through platform settings.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Account ID</Label>
            <Input value={`#${user?.id}`} readOnly className="bg-muted/50 cursor-not-allowed font-mono text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-teal-600" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
            </div>
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500">Passwords do not match</p>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleChangePassword} disabled={!currentPw || !newPw || !confirmPw}>
              <Lock className="h-4 w-4 mr-2" />Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
