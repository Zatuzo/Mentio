'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Crown } from 'lucide-react';

type Member = {
  id: string;
  role: string;
  user: { id: string; name: string; email: string; image: string | null };
};

interface Props {
  projectId: string;
  projectName: string;
  initialMembers: Member[];
  currentUserId: string;
  currentUserRole: string;
}

export function TeamManager({ projectId, projectName, initialMembers, currentUserId, currentUserRole }: Props) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUserRole === 'admin';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMembers((prev) => [...prev, data]);
      setEmail('');
      toast.success(`${data.user.name} added to ${projectName}!`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name} from this project?`)) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      toast.success(`${name} removed.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-zinc-800 rounded-lg border border-border overflow-hidden">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                {m.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  {m.user.name}
                  {m.role === 'admin' && (
                    <Crown className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.user.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={m.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                {m.role}
              </Badge>
              {isAdmin && m.user.id !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(m.user.id, m.user.name)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Invite Team Member
          </h4>
          <p className="text-xs text-muted-foreground">
            Enter the email of someone who already has an account on Mentio.
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="sr-only">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Adding...' : 'Add'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
