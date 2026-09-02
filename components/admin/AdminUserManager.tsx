'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, Plus, UserPlus } from "lucide-react";
import { getAdminUsers, createAdminUser, deleteAdminUser } from "@/lib/actions/auth";
import { getAdminTheme } from "@/lib/adminTheme";

export function AdminUserManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  
  const activeTheme = getAdminTheme('mountain'); // Per defecte

  async function loadUsers() {
    setIsLoading(true);
    const res = await getAdminUsers();
    if (res.success && res.users) {
      setUsers(res.users);
    } else {
      alert("Error carregant gestors: " + (res.error || "Desconegut"));
    }
    setIsLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newEmail || !newPass) return;
    setIsCreating(true);
    const res = await createAdminUser(newName, newEmail, newPass);
    if (res.success) {
      setNewName('');
      setNewEmail('');
      setNewPass('');
      await loadUsers();
    } else {
      alert("Error creant usuari: " + res.error);
    }
    setIsCreating(false);
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`N'estàs segur que vols eliminar l'accés de ${email}?`)) return;
    setIsDeleting(id);
    const res = await deleteAdminUser(id);
    if (res.success) {
      await loadUsers();
    } else {
      alert("Error esborrant usuari: " + res.error);
    }
    setIsDeleting(null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 sm:p-6">
        <h3 className="font-serif font-bold text-lg text-stone-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-stone-500" />
          Afegeix un nou gestor
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="adminName">Nom</Label>
            <Input id="adminName" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Maria" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminEmail">Correu</Label>
            <Input id="adminEmail" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="maria@ajuntament.cat" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adminPass">Contrasenya (Capa 1)</Label>
            <Input id="adminPass" type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="••••••••" />
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" disabled={isCreating || !newName || !newEmail || !newPass} className={`${activeTheme.primary} ${activeTheme.hover} text-white`}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Afegir Gestor
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left text-stone-500">
          <thead className="text-xs text-stone-700 uppercase bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="px-6 py-4">Nom</th>
              <th className="px-6 py-4">Correu Electrònic</th>
              <th className="px-6 py-4">Alta</th>
              <th className="px-6 py-4 text-right">Accions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-stone-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-stone-400 font-medium">
                  No hi ha gestors addicionals creats.
                </td>
              </tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50">
                  <td className="px-6 py-4 font-medium text-stone-900">{u.username}</td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(u.id, u.email)}
                      disabled={isDeleting === u.id || u.email === 'mistic_master' || u.role === 'SUPER_ADMIN'}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      {isDeleting === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
