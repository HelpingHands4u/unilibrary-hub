import { useState } from 'react';
import { Download, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { actions, useLibrary } from '@/lib/library/store';
import { exportCSV, runAction } from '@/lib/library/ui-actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Book } from '@/lib/library/types';
function EditBook({ book }: { book: Book }) {
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.authors.join(', '));
  const [shelf, setShelf] = useState(book.shelf);
  const [category, setCategory] = useState(book.category);
  return <form className="my-3 grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void runAction(() => actions.updateBook(book.id, { title, authors: author.split(',').map(a => a.trim()).filter(Boolean), shelf, category }), 'Book updated'); }}>
    {([['Title', title, setTitle], ['Authors', author, setAuthor], ['Shelf', shelf, setShelf], ['Category', category, setCategory]] as const).map(([label,value,set]) => <div key={label} className="grid gap-1"><Label>{label}<Input aria-label={label} value={value} onChange={e => set(e.target.value)} required maxLength={150} /></Label></div>)}
    <Button type="submit" className="w-fit"><Save className="size-4" /> Save details</Button>
  </form>;
}
export function Inventory() {
  const { state } = useLibrary();
  const [query, setQuery] = useState('');
  const books = state.books.filter(b => `${b.title} ${b.isbn13}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Book inventory</h2><Button variant="outline" size="sm" onClick={() => exportCSV('inventory', state.copies.map(c => ({ ...c, title: state.books.find(b => b.id === c.bookId)?.title })))}><Download className="size-4" /> Export inventory</Button></div>
    <Input aria-label="Search inventory" placeholder="Search title or ISBN" value={query} onChange={e => setQuery(e.target.value)} className="my-3 max-w-md" />
    <div className="grid gap-2">{books.map(b => <details key={b.id} className="rounded-lg border bg-card px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">{b.title} · {state.copies.filter(c => c.bookId === b.id).length} copies</summary>
      <EditBook book={b} />
      <div className="grid gap-2">{state.copies.filter(c => c.bookId === b.id).map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span className="font-mono text-xs">{c.barcode} · {c.shelf}</span><Select value={c.status} disabled={['issued','on_hold','reference'].includes(c.status)} onValueChange={v => { if (v === 'available' || v === 'lost' || v === 'damaged' || v === 'maintenance') void runAction(() => actions.setCopyStatus(c.id,v),'Copy updated'); }}><SelectTrigger className="w-40" aria-label={`Status of ${c.barcode}`}><SelectValue /></SelectTrigger><SelectContent>{['available','issued','on_hold','reference','lost','damaged','maintenance'].map(v => <SelectItem value={v} key={v}>{v.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>)}</div>
      <Button variant="outline" size="sm" className="mt-3" disabled={b.format !== 'physical'} onClick={() => void runAction(() => actions.addCopy(b.id),'Copy added')}><Plus className="size-4" /> Add copy</Button>
    </details>)}</div>
  </section>;
}
