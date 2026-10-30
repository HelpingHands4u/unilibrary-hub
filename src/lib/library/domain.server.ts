// @ts-nocheck -- dynamic Firestore records are validated at runtime by each command.
/* Pure library commands (TypeScript port of the former Python domain). Callers supply a server-verified identity and role. */
type Row = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ServerState = any;

export const COLLECTIONS: Record<string, string> = { books: 'books', copies: 'book_copies', users: 'users', loans: 'loans', reservations: 'reservations', fines: 'fines', wishlists: 'wishlists', notifications: 'notifications', reviews: 'reviews', resources: 'resources', audit: 'audit', recent: 'recent' };
export const DEFAULTS: Record<string, number> = { loanDays: 14, finePerDay: 5, maxLoans: 4, maxRenewals: 2, fineBlockThreshold: 100, reservationHoldDays: 3 };

export class PermissionError extends Error {}
export class ValidationError extends Error {}

const DAY = 86_400_000;
const dayNum = (d: Date) => Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY);
export const late = (due: string, now: Date) => Math.max(0, dayNum(now) - dayNum(new Date(due)));
const plus = (d: Date, n: number) => new Date(d.getTime() + n * DAY).toISOString();
const uid = () => crypto.randomUUID().replace(/-/g, '');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export function apply(s: ServerState, actor: string, role: string, command: string, args: any[], now = new Date()): any {
  const iso = now.toISOString();
  const settings = s.settings;
  const bad = (m: string): never => { throw new ValidationError(m); };
  const user = s.users.find(u => u.id === actor);
  if (!user || !user.active) bad('Account is inactive or missing');
  const staff = role === 'librarian' || role === 'admin';
  const need = (...roles: string[]) => { if (!roles.includes(role)) throw new PermissionError('You do not have permission for this action'); };
  const find = (key: string, id: unknown) => s[key].find((r: Row) => r.id === id) ?? bad('Record not found');
  const own = (row: Row) => { if (row.userId !== actor && !staff) throw new PermissionError('This record belongs to another member'); };
  const add = (key: string, data: Record<string, any>) => { const row = { ...data, id: uid() }; s[key].unshift(row); return row; };
  const notify = (to: string, message: string, type = 'info') => add('notifications', { userId: to, message, type, isRead: false, timestamp: iso });
  const text = (v: unknown, min = 1, max = 500) => (typeof v === 'string' && v.trim().length >= min && v.trim().length <= max ? v.trim() : bad('Invalid text value'));
  const byBarcode = (b: unknown) => typeof b === 'string' ? s.copies.find(c => String(c.barcode).toLowerCase() === b.toLowerCase()) : undefined;
  const promote = (bookId: string, copy: Row) => {
    const q = s.reservations.filter(r => r.bookId === bookId && r.status === 'waiting').sort((a, b) => a.reservedAt.localeCompare(b.reservedAt));
    if (q.length) { Object.assign(q[0], { status: 'ready', copyId: copy.id, expiresAt: plus(now, settings.reservationHoldDays) }); copy.status = 'on_hold'; notify(q[0].userId, 'Your reserved book is ready for pickup', 'reservation'); }
    return q[0];
  };
  let result: any = null;
  switch (command) {
    case 'toggleWishlist': {
      const book = find('books', args[0]); const i = s.wishlists.findIndex(w => w.userId === actor && w.bookId === book.id);
      if (i >= 0) s.wishlists.splice(i, 1); else add('wishlists', { userId: actor, bookId: book.id }); break;
    }
    case 'visit': find('books', args[0]); s.recent = s.recent.filter(r => !(r.userId === actor && r.bookId === args[0])); add('recent', { userId: actor, bookId: args[0], at: iso }); break;
    case 'reserve': {
      const book = find('books', args[0]);
      if (book.format !== 'physical') bad('Only physical books may be reserved');
      if (s.loans.some(l => l.userId === actor && l.bookId === book.id && l.status === 'active')) bad('You already hold this book');
      if (s.reservations.some(r => r.userId === actor && r.bookId === book.id && ['waiting', 'ready'].includes(r.status))) bad('You already reserved this book');
      const copy = s.copies.find(c => c.bookId === book.id && c.status === 'available');
      const status = copy ? 'ready' : 'waiting'; if (copy) copy.status = 'on_hold';
      add('reservations', { userId: actor, bookId: book.id, status, reservedAt: iso, expiresAt: plus(now, copy ? settings.reservationHoldDays : 7), copyId: copy?.id ?? null });
      notify(actor, `Reservation for ${book.title}: ${status}`, 'reservation'); break;
    }
    case 'cancelReservation': {
      const r = find('reservations', args[0]); own(r);
      if (!['waiting', 'ready'].includes(r.status)) bad('Reservation is no longer active');
      r.status = 'cancelled';
      if (r.copyId) { const copy = find('copies', r.copyId); copy.status = 'available'; promote(r.bookId, copy); }
      break;
    }
    case 'renew': {
      const l = find('loans', args[0]);
      if (l.userId !== actor) throw new PermissionError('Only the borrower may renew a loan');
      if (l.status !== 'active' || late(l.dueDate, now) || l.renewals >= settings.maxRenewals) bad('This loan cannot be renewed');
      if (s.reservations.some(r => r.bookId === l.bookId && r.status === 'waiting')) bad('Other students are waiting');
      l.dueDate = plus(new Date(l.dueDate), settings.loanDays); l.renewals += 1; break;
    }
    case 'issue': {
      need('admin', 'librarian'); const [to, barcode, n] = args;
      if (!isInt(n) || n < 1 || n > 60) bad('Loan days must be 1–60');
      const borrower = find('users', to);
      if (!borrower.active) bad('Account is inactive');
      const count = s.loans.filter(l => l.userId === to && l.status === 'active').length;
      if (count >= Math.min(borrower.maxBorrowLimit, settings.maxLoans)) bad('Loan limit reached');
      if (s.fines.filter(f => f.userId === to && f.status === 'unpaid').reduce((a, f) => a + f.amount, 0) > settings.fineBlockThreshold) bad('Unpaid fines exceed the borrowing threshold');
      const copy = byBarcode(barcode) ?? bad('Copy not found');
      const hold = s.reservations.find(r => r.copyId === copy.id && r.status === 'ready');
      if (copy.status === 'on_hold' && (!hold || hold.userId !== to)) bad('Copy is held for another student');
      if (!['available', 'on_hold'].includes(copy.status)) bad('Copy is not available');
      copy.status = 'issued';
      result = add('loans', { userId: to, bookId: copy.bookId, copyId: copy.id, issueDate: iso, dueDate: plus(now, n), status: 'active', renewals: 0, fineAmount: 0 });
      find('books', copy.bookId).borrowCount += 1;
      for (const r of s.reservations) if (r.userId === to && r.bookId === copy.bookId && ['ready', 'waiting'].includes(r.status)) r.status = 'fulfilled';
      notify(to, `Book issued. Due ${result.dueDate}`); break;
    }
    case 'returnCopy': {
      need('admin', 'librarian'); const [barcode, paid] = args;
      if (typeof paid !== 'boolean') bad('Invalid payment flag');
      const copy = byBarcode(barcode) ?? bad('Copy not found');
      const l = s.loans.find(x => x.copyId === copy.id && x.status === 'active') ?? bad('No active loan for this copy');
      const overdue = late(l.dueDate, now); const amount = overdue * settings.finePerDay;
      Object.assign(l, { status: 'returned', returnDate: iso, fineAmount: amount }); copy.status = 'available';
      if (amount) add('fines', { loanId: l.id, userId: l.userId, amount, daysOverdue: overdue, rate: settings.finePerDay, status: paid ? 'paid' : 'unpaid', createdAt: iso });
      const next = promote(copy.bookId, copy);
      result = { late: overdue, amount, heldFor: next?.userId ?? null }; break;
    }
    case 'payFine': case 'waiveFine': need('admin', 'librarian'); find('fines', args[0]).status = command === 'payFine' ? 'paid' : 'waived'; break;
    case 'markRead':
      if (args[0] !== actor) throw new PermissionError('Only your own notifications may be updated');
      for (const n of s.notifications) if (n.userId === actor) n.isRead = true; break;
    case 'addReview': {
      const [bid, rating, review] = args; const b = find('books', bid);
      if (!isInt(rating) || rating < 1 || rating > 5) bad('Rating must be 1–5');
      if (!s.loans.some(l => l.userId === actor && l.bookId === bid)) throw new PermissionError('Only verified borrowers may review');
      if (s.reviews.some(r => r.userId === actor && r.bookId === bid)) bad('You already reviewed this book');
      add('reviews', { bookId: bid, userId: actor, userName: user!.name, rating, text: text(review, 5, 500), verified: true, createdAt: iso });
      const rs = s.reviews.filter(r => r.bookId === bid);
      b.rating = Math.round((rs.reduce((a, r) => a + r.rating, 0) / rs.length) * 10) / 10; b.reviewCount = rs.length; break;
    }
    case 'updateProfile': { const [name, roll, dept] = args; Object.assign(user!, { name: text(name, 2, 100), rollNumber: text(roll, 4, 15), department: text(dept, 2, 60) }); break; }
    case 'updateSettings': {
      need('admin'); const patch = args[0];
      if (!patch || typeof patch !== 'object') bad('Invalid setting');
      for (const [k, v] of Object.entries(patch)) {
        if (!(k in DEFAULTS) || !isInt(v) || v < 0 || v > 10000) bad('Invalid setting');
        if (['loanDays', 'maxLoans', 'reservationHoldDays'].includes(k) && (v as number) < 1) bad('Setting must be positive');
        settings[k] = v as number;
      }
      break;
    }
    case 'setRole': case 'setActive': {
      need('admin'); const [target, value] = args;
      if (target === actor) bad('You cannot change your own access');
      const t = find('users', target);
      if (command === 'setRole') { if (!['student', 'faculty', 'librarian', 'admin'].includes(value)) bad('Invalid role'); result = { roleUserId: target, role: value }; }
      else { if (typeof value !== 'boolean') bad('Invalid active value'); t.active = value; }
      break;
    }
    case 'addBook': {
      need('admin', 'librarian'); const d = args[0] ?? {};
      if (!isInt(d.copies) || d.copies < 1 || d.copies > 50) bad('Copies must be 1–50');
      const isbn = text(d.isbn13, 13, 13); if (!/^\d{13}$/.test(isbn)) bad('ISBN must be 13 digits');
      if (s.books.some(b => b.isbn13 === isbn)) bad('ISBN already exists');
      if (!isInt(d.year) || d.year < 1450 || d.year > now.getUTCFullYear() + 1) bad('Invalid publication year');
      const b = add('books', { title: text(d.title, 1, 150), authors: [text(d.author, 1, 150)], category: text(d.category, 1, 100), subjects: [d.category], publisher: text(d.publisher, 1, 150), year: d.year, isbn13: isbn, isbn10: isbn.slice(3), edition: '1st Edition', language: 'English', format: 'physical', rating: 0, reviewCount: 0, description: d.title, topics: [], coverColor: 'cover-2', shelf: text(d.shelf, 1, 150), borrowCount: 0, addedAt: iso, tags: [] });
      for (let i = 0; i < d.copies; i++) add('copies', { bookId: b.id, barcode: 'UL' + uid().slice(0, 12).toUpperCase(), shelf: b.shelf, status: 'available' });
      result = b.id; break;
    }
    case 'updateBook': {
      need('admin', 'librarian'); const b = find('books', args[0]);
      for (let [k, v] of Object.entries(args[1] ?? {})) {
        if (!['title', 'authors', 'category', 'publisher', 'description', 'shelf', 'year'].includes(k)) bad('Unsupported book field');
        if (k === 'authors') { if (!Array.isArray(v) || !v.length) bad('Authors are required'); v = (v as unknown[]).map(a => text(a, 1, 150)); }
        else if (k === 'year') { if (!isInt(v) || v < 1450 || v > now.getUTCFullYear() + 1) bad('Invalid year'); }
        else v = text(v, 1, 2000);
        b[k] = v;
      }
      break;
    }
    case 'addCopy': { need('admin', 'librarian'); const b = find('books', args[0]); add('copies', { bookId: b.id, barcode: 'UL' + uid().slice(0, 12).toUpperCase(), shelf: b.shelf, status: 'available' }); break; }
    case 'setCopyStatus': {
      need('admin', 'librarian'); const c = find('copies', args[0]);
      if (['issued', 'on_hold'].includes(c.status)) bad('Return or release this copy first');
      if (!['available', 'lost', 'damaged', 'maintenance'].includes(args[1])) bad('Invalid copy status');
      c.status = args[1]; break;
    }
    case 'submitResource': {
      need('faculty', 'admin', 'librarian'); const [title, kind, course, url] = args;
      if (!['Lecture Notes', 'Past Paper', 'Syllabus'].includes(kind)) bad('Invalid resource kind');
      let u: URL | null = null; try { u = new URL(url); } catch { /* invalid */ }
      if (!u || u.protocol !== 'https:' || !u.hostname || u.username) bad('Provide an HTTPS resource link');
      add('resources', { title: text(title, 3, 120), kind, course: text(course, 1, 20), url, approved: role === 'admin', submittedBy: actor }); break;
    }
    case 'approveResource': need('admin'); find('resources', args[0]).approved = true; break;
    default: bad('Unknown command');
  }
  if (!['visit', 'markRead', 'toggleWishlist'].includes(command)) add('audit', { actorId: actor, action: command, detail: command, timestamp: iso });
  return result;
}
