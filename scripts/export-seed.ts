import { buildSeed } from '../src/lib/library/seed';
const seed = buildSeed();
await Bun.write('scripts/catalog-seed.json', JSON.stringify({ books: seed.books, copies: seed.copies.map(c => ({ ...c, status: c.status === 'issued' ? 'available' : c.status })), resources: seed.resources, settings: seed.settings }, null, 2));
console.log('Exported catalog and settings only; no demo member records.');
