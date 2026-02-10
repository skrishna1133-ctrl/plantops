"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Pencil } from "lucide-react";
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
import type { User } from "@/lib/schemas";
import { userRoleLabels } from "@/lib/schemas";
import UserDialog from "./user-dialog";

const roleColors: Record<string, string> = {
  worker: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  lab_tech: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  engineer: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  admin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  owner: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleActive = async (user: User) => {
    setTogglingId(user.id);
    try {
      await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      fetchUsers();
    } catch (error) {
      console.error("Error toggling user:", error);
    } finally {
      setTogglingId(null);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{users.length} users</Badge>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" />
          New User
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No users yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead className="text-center">Role</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className={!u.active ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell className="font-medium">{u.fullName}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={roleColors[u.role]}>
                      {userRoleLabels[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleActive(u)}
                      disabled={togglingId === u.id}
                    >
                      {togglingId === u.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : u.active ? (
                        <span className="text-green-400">Active</span>
                      ) : (
                        <span className="text-muted-foreground">Inactive</span>
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(u)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => deleteUser(u.id)}
                        disabled={deletingId === u.id}
                      >
                        {deletingId === u.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={fetchUsers}
        user={editingUser}
      />
    </div>
  );
}
