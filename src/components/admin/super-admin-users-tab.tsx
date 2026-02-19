"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, KeyRound, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { userRoleLabels } from "@/lib/schemas";
import type { User } from "@/lib/schemas";

type UserWithTenant = User & { tenantName: string | null };

export default function SuperAdminUsersTab() {
  const [users, setUsers] = useState<UserWithTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users?all=true");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleResetPassword = async (user: UserWithTenant) => {
    if (!confirm(`Reset password for ${user.fullName}? A temporary password will be generated.`)) return;
    setResettingId(user.id);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetUser(user.fullName);
        setTempPassword(data.tempPassword);
        setCopied(false);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
    } finally {
      setResettingId(null);
    }
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">All Users (Platform)</h3>
          <p className="text-sm text-muted-foreground">
            View and manage users across all companies.
          </p>
        </div>
        <Badge variant="secondary">{users.length} users</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Full Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell className="font-mono text-sm">{user.username}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.tenantName || <span className="italic">Platform</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {userRoleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        user.active
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {user.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleResetPassword(user)}
                      disabled={resettingId === user.id}
                      title="Reset Password"
                    >
                      {resettingId === user.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <KeyRound size={14} />
                      )}
                      Reset
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!tempPassword} onOpenChange={() => setTempPassword(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              Temporary password for <strong>{resetUser}</strong>. Share this with the user — it cannot be recovered after closing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <code className="flex-1 text-lg font-mono font-bold tracking-wider">
              {tempPassword}
            </code>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8">
              {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </Button>
          </div>
          <Button onClick={() => setTempPassword(null)} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
