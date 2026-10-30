import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { actions } from '@/lib/library/store';
import { runAction } from '@/lib/library/ui-actions';
import type { User } from '@/lib/library/types';
export function ProfileForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [roll, setRoll] = useState(user.rollNumber ?? '');
  const [dept, setDept] = useState(user.department ?? '');
  const [busy, setBusy] = useState(false);
  return <form className="grid max-w-xl gap-4" onSubmit={async e => { e.preventDefault(); setBusy(true); await runAction(() => actions.updateProfile(name.trim(), roll.trim(), dept.trim()), 'Profile saved'); setBusy(false); }}>
    <p className="text-sm text-muted-foreground">{user.email} · {user.role}</p>
    <div className="grid gap-1.5"><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></div>
    <div className="grid gap-1.5"><Label htmlFor="profile-roll">Roll number</Label><Input id="profile-roll" value={roll} onChange={e => setRoll(e.target.value)} required pattern="[A-Za-z0-9]{4,15}" /></div>
    <div className="grid gap-1.5"><Label htmlFor="profile-dept">Department</Label><Input id="profile-dept" value={dept} onChange={e => setDept(e.target.value)} required minLength={2} maxLength={60} /></div>
    <Button type="submit" disabled={busy} className="w-fit">Save profile</Button>
  </form>;
}
