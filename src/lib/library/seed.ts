import type { Book, BookCopy, LibraryState, Loan, User } from "./types";
import { addDays } from "./rules";

export const CATEGORIES = [
  "Computer Science",
  "Cybersecurity",
  "Artificial Intelligence",
  "Data Science",
  "Engineering",
  "Mathematics",
  "Physics",
  "Electronics",
  "Business and Management",
  "Humanities",
] as const;

type Raw = [string, string, string, number, number, string, string?];
// title, author, category, year, rating, publisher, tag
const RAW: Raw[] = [
  ["Clean Code", "Robert C. Martin", "Computer Science", 2008, 4.7, "Prentice Hall", "textbook"],
  ["Introduction to Algorithms", "Thomas H. Cormen", "Computer Science", 2022, 4.8, "MIT Press", "textbook"],
  ["Operating System Concepts", "Abraham Silberschatz", "Computer Science", 2018, 4.5, "Wiley", "textbook"],
  ["Database System Concepts", "Henry F. Korth", "Computer Science", 2019, 4.4, "McGraw Hill", "textbook"],
  ["Computer Networks", "Andrew S. Tanenbaum", "Computer Science", 2021, 4.6, "Pearson", "textbook"],
  ["Python Programming", "Guido van Rossum", "Computer Science", 2023, 4.5, "O'Reilly", "handbook"],
  ["The Pragmatic Programmer", "David Thomas", "Computer Science", 2019, 4.7, "Addison-Wesley"],
  ["Design Patterns", "Erich Gamma", "Computer Science", 1994, 4.5, "Addison-Wesley"],
  ["Hacking: The Art of Exploitation", "Jon Erickson", "Cybersecurity", 2008, 4.4, "No Starch Press"],
  ["Cryptography and Network Security", "William Stallings", "Cybersecurity", 2020, 4.3, "Pearson", "textbook"],
  ["The Web Application Hacker's Handbook", "Dafydd Stuttard", "Cybersecurity", 2011, 4.5, "Wiley", "handbook"],
  ["Artificial Intelligence: A Modern Approach", "Stuart Russell", "Artificial Intelligence", 2021, 4.8, "Pearson", "textbook"],
  ["Deep Learning", "Ian Goodfellow", "Artificial Intelligence", 2016, 4.6, "MIT Press"],
  ["Hands-On Machine Learning", "Aurélien Géron", "Artificial Intelligence", 2023, 4.8, "O'Reilly"],
  ["Pattern Recognition and Machine Learning", "Christopher Bishop", "Artificial Intelligence", 2006, 4.5, "Springer"],
  ["Python for Data Analysis", "Wes McKinney", "Data Science", 2022, 4.6, "O'Reilly", "handbook"],
  ["The Elements of Statistical Learning", "Trevor Hastie", "Data Science", 2017, 4.7, "Springer"],
  ["Storytelling with Data", "Cole Nussbaumer Knaflic", "Data Science", 2015, 4.4, "Wiley"],
  ["Engineering Mechanics", "R. C. Hibbeler", "Engineering", 2016, 4.2, "Pearson", "textbook"],
  ["Fundamentals of Thermodynamics", "Claus Borgnakke", "Engineering", 2019, 4.1, "Wiley"],
  ["Engineering Drawing", "N. D. Bhatt", "Engineering", 2014, 4.3, "Charotar", "handbook"],
  ["Discrete Mathematics and Its Applications", "Kenneth Rosen", "Mathematics", 2018, 4.5, "McGraw Hill", "textbook"],
  ["Linear Algebra Done Right", "Sheldon Axler", "Mathematics", 2023, 4.7, "Springer"],
  ["Higher Engineering Mathematics", "B. S. Grewal", "Mathematics", 2020, 4.4, "Khanna", "textbook"],
  ["Concepts of Physics", "H. C. Verma", "Physics", 2017, 4.8, "Bharati Bhawan", "textbook"],
  ["The Feynman Lectures on Physics", "Richard Feynman", "Physics", 2011, 4.9, "Basic Books"],
  ["Microelectronic Circuits", "Adel S. Sedra", "Electronics", 2019, 4.4, "Oxford", "textbook"],
  ["The Art of Electronics", "Paul Horowitz", "Electronics", 2015, 4.8, "Cambridge", "handbook"],
  ["Digital Design", "M. Morris Mano", "Electronics", 2017, 4.3, "Pearson", "textbook"],
  ["Principles of Management", "Harold Koontz", "Business and Management", 2015, 4.0, "McGraw Hill"],
  ["Zero to One", "Peter Thiel", "Business and Management", 2014, 4.3, "Crown"],
  ["Atomic Habits", "James Clear", "Humanities", 2018, 4.6, "Avery"],
  ["Sapiens", "Yuval Noah Harari", "Humanities", 2015, 4.5, "Harper"],
  ["Professional Ethics and Human Values", "R. S. Naagarazan", "Humanities", 2006, 4.0, "New Age", "textbook"],
];

const COVERS = ["cover-1", "cover-2", "cover-3", "cover-4", "cover-5", "cover-6"];

function isbn(i: number) {
  const base = String(9780000000000 + i * 7919).slice(0, 13);
  return { isbn13: base, isbn10: base.slice(3, 13) };
}

export function buildSeed(now = new Date()): LibraryState {
  const books: Book[] = RAW.map(([title, author, category, year, rating, publisher, tag], i) => ({
    id: `b${i + 1}`,
    title,
    authors: [author],
    category,
    subjects: [category, i % 2 ? "Undergraduate" : "Reference"],
    publisher,
    edition: `${(i % 4) + 1}${["st", "nd", "rd", "th"][i % 4]} Edition`,
    year,
    ...isbn(i + 1),
    language: i % 9 === 0 ? "Hindi" : "English",
    format: i % 11 === 5 ? "digital" : i % 13 === 7 ? "reference" : "physical",
    rating,
    reviewCount: 20 + ((i * 37) % 180),
    description: `${title} by ${author} is a widely used ${category.toLowerCase()} resource in university curricula. It builds strong fundamentals with worked examples, end-of-chapter exercises and real-world case studies, making it suitable for both coursework and self-study. Students preparing for semester exams and competitive tests will find the structured progression especially helpful.`,
    topics: ["Foundations", "Core concepts", "Worked examples", "Applications", "Exercises & review"],
    coverColor: COVERS[i % COVERS.length] ?? "cover-1",
    shelf: `Floor ${(i % 3) + 1}, Shelf ${String.fromCharCode(65 + (i % 6))}-${10 + i}`,
    borrowCount: 15 + ((i * 53) % 140),
    addedAt: addDays(now, -((i * 11) % 120)),
    tags: tag ? [tag as "textbook" | "handbook"] : [],
  }));

  const copies: BookCopy[] = [];
  books.forEach((b, i) => {
    const n = b.format === "digital" ? 0 : 2 + (i % 4);
    for (let c = 0; c < n; c++) {
      copies.push({
        id: `${b.id}-c${c + 1}`,
        bookId: b.id,
        barcode: `UL${String(1000 + i * 10 + c)}`,
        shelf: b.shelf,
        status: b.format === "reference" ? "reference" : c === n - 1 && i % 7 === 0 ? "maintenance" : "available",
      });
    }
  });

  const users: User[] = [
    { id: "u-student", name: "Arjun Sharma", email: "student@unilibrary.edu", role: "student", rollNumber: "CSE21B045", department: "Computer Science", maxBorrowLimit: 4, active: true },
    { id: "u-student2", name: "Priya Nair", email: "priya@unilibrary.edu", role: "student", rollNumber: "CSE21B012", department: "Computer Science", maxBorrowLimit: 4, active: true },
    { id: "u-student3", name: "Rahul Verma", email: "rahul@unilibrary.edu", role: "student", rollNumber: "ECE21B033", department: "Electronics", maxBorrowLimit: 4, active: true },
    { id: "u-librarian", name: "Meera Iyer", email: "librarian@unilibrary.edu", role: "librarian", maxBorrowLimit: 10, active: true },
    { id: "u-admin", name: "Dr. Suresh Rao", email: "admin@unilibrary.edu", role: "admin", maxBorrowLimit: 10, active: true },
    { id: "u-faculty", name: "Prof. Anita Das", email: "faculty@unilibrary.edu", role: "faculty", department: "Computer Science", maxBorrowLimit: 8, active: true },
  ];

  const loans: Loan[] = [];
  const mkLoan = (userId: string, bookIdx: number, issuedAgo: number, returnedAgo?: number) => {
    const book = books[bookIdx];
    if (!book) return;
    const copy = copies.find((c) => c.bookId === book.id && c.status === "available");
    if (!copy) return;
    const issue = addDays(now, -issuedAgo);
    const due = addDays(new Date(issue), 14);
    const loan: Loan = {
      id: `l${loans.length + 1}`,
      userId,
      bookId: book.id,
      copyId: copy.id,
      issueDate: issue,
      dueDate: due,
      ...(returnedAgo !== undefined ? { returnDate: addDays(now, -returnedAgo) } : {}),
      status: returnedAgo !== undefined ? "returned" : "active",
      renewals: 0,
      fineAmount: 0,
    };
    if (loan.status === "active") copy.status = "issued";
    loans.push(loan);
  };
  mkLoan("u-student", 0, 5);
  mkLoan("u-student", 5, 12);
  mkLoan("u-student", 3, 18);
  mkLoan("u-student", 1, 60, 45);
  mkLoan("u-student", 11, 40, 28);
  mkLoan("u-student", 15, 30, 14);
  mkLoan("u-student2", 0, 3);
  mkLoan("u-student2", 13, 20);
  mkLoan("u-student3", 26, 8);
  mkLoan("u-student3", 0, 9);
  for (let i = 0; i < 12; i++) mkLoan(i % 2 ? "u-student2" : "u-student3", (i * 5) % books.length, 90 - i * 6, 80 - i * 6);

  return {
    books,
    copies,
    users,
    loans,
    reservations: [
      { id: "r1", userId: "u-student", bookId: "b13", status: "waiting", reservedAt: addDays(now, -2), expiresAt: addDays(now, 5) },
      { id: "r2", userId: "u-student2", bookId: "b1", status: "waiting", reservedAt: addDays(now, -1), expiresAt: addDays(now, 6) },
    ],
    fines: [
      { id: "f1", loanId: "l5", userId: "u-student", amount: 20, daysOverdue: 4, rate: 5, status: "paid", createdAt: addDays(now, -28) },
      { id: "f2", loanId: "l6", userId: "u-student", amount: 10, daysOverdue: 2, rate: 5, status: "unpaid", createdAt: addDays(now, -14) },
    ],
    wishlists: [
      { userId: "u-student", bookId: "b12" },
      { userId: "u-student", bookId: "b26" },
    ],
    notifications: [
      { id: "n1", userId: "u-student", message: "“Database System Concepts” is overdue. Please return it.", type: "due", isRead: false, timestamp: addDays(now, 0) },
      { id: "n2", userId: "u-student", message: "“Python Programming” is due in 2 days.", type: "due", isRead: false, timestamp: addDays(now, -1) },
      { id: "n3", userId: "u-student", message: "Welcome to UniLibrary! Explore the new arrivals shelf.", type: "info", isRead: true, timestamp: addDays(now, -10) },
    ],
    reviews: [
      { id: "rv1", bookId: "b1", userId: "u-student2", userName: "Priya N.", rating: 5, text: "Changed how I write code for my projects. Must-read before placements.", verified: true, createdAt: addDays(now, -20) },
      { id: "rv2", bookId: "b1", userId: "u-student3", userName: "Rahul V.", rating: 4, text: "Great examples, a bit Java heavy.", verified: true, createdAt: addDays(now, -9) },
      { id: "rv3", bookId: "b2", userId: "u-student", userName: "Arjun S.", rating: 5, text: "The DAA bible. Dense but complete.", verified: true, createdAt: addDays(now, -40) },
    ],
    resources: [
      { id: "res1", title: "DBMS Unit 1–5 Lecture Notes", kind: "Lecture Notes", course: "CS301", approved: true, submittedBy: "u-faculty" },
      { id: "res2", title: "Operating Systems End-Sem 2025", kind: "Past Paper", course: "CS302", approved: true, submittedBy: "u-faculty" },
      { id: "res3", title: "B.Tech CSE 3rd Year Syllabus", kind: "Syllabus", course: "CSE", approved: true, submittedBy: "u-admin" },
      { id: "res4", title: "Computer Networks Mid-Sem 2025", kind: "Past Paper", course: "CS303", approved: true, submittedBy: "u-faculty" },
      { id: "res5", title: "Machine Learning Lab Manual", kind: "Lecture Notes", course: "CS351", approved: false, submittedBy: "u-faculty" },
    ],
    audit: [{ id: "a1", actorId: "u-admin", action: "system.seed", detail: "Demo data initialised", timestamp: now.toISOString() }],
    recent: [],
    settings: { loanDays: 14, finePerDay: 5, maxLoans: 4, maxRenewals: 2, fineBlockThreshold: 100, reservationHoldDays: 3 },
  };
}
