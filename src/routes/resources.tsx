import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/lib/bits';
import { actions, useLibrary } from '@/lib/library/store';
import { runAction } from '@/lib/library/ui-actions';
import type { Resource } from '@/lib/library/types';
export const Route = createFileRoute('/resources')({
  head: () => ({ meta: [
    { title: 'Digital Resources — UniLibrary' },
    { name: 'description', content: 'Approved lecture notes, past exam papers and syllabus resources.' },
    { property: 'og:title', content: 'Digital Resources — UniLibrary' },
    { property: 'og:description', content: 'University learning materials and faculty submissions.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Resources,
});
function Resources() {
  const { state, user } = useLibrary();
  const [title, setTitle] = useState(''); const [course, setCourse] = useState(''); const [url, setUrl] = useState('');
  const [kind, setKind] = useState<Resource['kind']>('Lecture Notes'); const [filter, setFilter] = useState(''); const [busy, setBusy] = useState(false);
  const staff = user && user.role !== 'student';
  const list = state.resources.filter(r => (r.approved || user?.role === 'admin' || r.submittedBy === user?.id) && `${r.title} ${r.course} ${r.kind}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="mx-auto grid max-w-5xl gap-5">
    <h1 className="text-2xl font-extrabold text-navy">Digital Learning Resources</h1>
    <Input aria-label="Search resources" placeholder="Search by title, course or material type" value={filter} onChange={e => setFilter(e.target.value)} className="max-w-lg" />
    <div className="grid gap-3 sm:grid-cols-2">{list.map(r => <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-card">
      <FileText className="size-8 shrink-0 text-teal" /><div className="min-w-0 flex-1"><p className="font-semibold">{r.title}</p><p className="text-xs text-muted-foreground">{r.kind} · {r.course}</p></div>
      {r.approved ? <StatusBadge tone="success">Approved</StatusBadge> : <StatusBadge tone="warning">Pending</StatusBadge>}
      <div className="flex w-full justify-end gap-2">{!r.approved && user?.role === 'admin' && <Button size="sm" onClick={() => void runAction(() => actions.approveResource(r.id), 'Approved')}>Approve</Button>}
        {r.url?.startsWith('https://') ? <Button asChild size="sm" variant="outline"><a href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" /> Open material</a></Button> : <span className="text-xs text-muted-foreground">Sample record · file not supplied</span>}
      </div>
    </div>)}</div>
    {!list.length && <p className="text-sm text-muted-foreground">No resources found.</p>}
    {staff && <form className="grid gap-3 border-t pt-5 sm:grid-cols-2" onSubmit={async e => { e.preventDefault(); setBusy(true); await runAction(() => actions.submitResource(title.trim(), kind, course.trim(), url.trim()), 'Material submitted'); setBusy(false); }}>
      <h2 className="font-bold sm:col-span-2">Submit learning material</h2>
      <div className="grid gap-1"><Label htmlFor="resource-title">Title</Label><Input id="resource-title" value={title} onChange={e => setTitle(e.target.value)} required minLength={3} maxLength={120} /></div>
      <div className="grid gap-1"><Label htmlFor="resource-course">Course</Label><Input id="resource-course" value={course} onChange={e => setCourse(e.target.value)} required maxLength={20} /></div>
      <div className="grid gap-1"><Label>Material type</Label><Select value={kind} onValueChange={v => { if (v === 'Lecture Notes' || v === 'Past Paper' || v === 'Syllabus') setKind(v); }}><SelectTrigger aria-label="Material type"><SelectValue /></SelectTrigger><SelectContent>{['Lecture Notes','Past Paper','Syllabus'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="grid gap-1"><Label htmlFor="resource-url">Material link</Label><Input id="resource-url" type="url" pattern="https://.*" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} required /></div>
      <Button type="submit" disabled={busy} className="w-fit">Submit material</Button>
    </form>}
  </div>;
}
