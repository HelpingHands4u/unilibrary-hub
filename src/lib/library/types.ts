export type Role = "student" | "librarian" | "admin" | "faculty";
export type CopyStatus = "available" | "issued" | "reference" | "maintenance" | "lost" | "damaged" | "on_hold";
export type Format = "physical" | "digital" | "reference";

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  category: string;
  subjects: string[];
  publisher: string;
  edition: string;
  year: number;
  isbn10: string;
  isbn13: string;
  language: string;
  format: Format;
  rating: number;
  reviewCount: number;
  description: string;
  topics: string[];
  coverColor: string; // css var name for generated cover
  shelf: string;
  borrowCount: number;
  addedAt: string;
  tags: ("textbook" | "handbook")[];
}

export interface BookCopy {
  id: string;
  bookId: string;
  barcode: string;
  shelf: string;
  status: CopyStatus;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  rollNumber?: string;
  department?: string;
  maxBorrowLimit: number;
  active: boolean;
}

export interface Loan {
  id: string;
  userId: string;
  bookId: string;
  copyId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: "active" | "returned";
  renewals: number;
  fineAmount: number;
}

export interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  status: "waiting" | "ready" | "cancelled" | "fulfilled";
  reservedAt: string;
  expiresAt: string;
}

export interface Fine {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  daysOverdue: number;
  rate: number;
  status: "unpaid" | "paid" | "waived";
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: "info" | "due" | "reservation" | "fine";
  isRead: boolean;
  timestamp: string;
}

export interface Review {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  verified: boolean;
  createdAt: string;
}

export interface Resource {
  id: string;
  title: string;
  kind: "Lecture Notes" | "Past Paper" | "Syllabus";
  course: string;
  url?: string;
  approved: boolean;
  submittedBy: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface Settings {
  loanDays: number;
  finePerDay: number;
  maxLoans: number;
  maxRenewals: number;
  fineBlockThreshold: number;
  reservationHoldDays: number;
}

export interface LibraryState {
  books: Book[];
  copies: BookCopy[];
  users: User[];
  loans: Loan[];
  reservations: Reservation[];
  fines: Fine[];
  wishlists: { userId: string; bookId: string }[];
  notifications: Notification[];
  reviews: Review[];
  resources: Resource[];
  audit: AuditLog[];
  recent: { userId: string; bookId: string; at: string }[];
  settings: Settings;
}
