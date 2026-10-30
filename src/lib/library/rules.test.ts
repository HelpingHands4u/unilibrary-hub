import { describe, expect, it } from "vitest";
import { calculateFine, checkIssueEligibility, daysOverdue } from "./rules";
import { buildSeed } from "./seed";

const now = new Date("2026-10-24T10:00:00Z");

describe("fines", () => {
  it("charges ₹5 per day late at the default rate", () => {
    expect(calculateFine("2026-10-20T09:00:00Z", now, 5)).toBe(20);
  });
  it("charges nothing when returned on the due date", () => {
    expect(daysOverdue("2026-10-24T23:00:00Z", now)).toBe(0);
  });
});

describe("issue eligibility", () => {
  it("blocks a student already holding the 4-loan maximum", () => {
    const s = buildSeed(now);
    const u = s.users.find((x) => x.id === "u-student");
    if (!u) throw new Error("Missing seed student");
    s.loans = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}`, userId: u.id, bookId: "b9", copyId: "b9-c1", issueDate: now.toISOString(), dueDate: now.toISOString(), status: "active", renewals: 0, fineAmount: 0 }));
    expect(checkIssueEligibility(s, u).ok).toBe(false);
  });
  it("blocks when unpaid fines exceed ₹100", () => {
    const s = buildSeed(now);
    const u = s.users.find((x) => x.id === "u-student2");
    if (!u) throw new Error("Missing seed student");
    s.fines.push({ id: "z", loanId: "l1", userId: u.id, amount: 150, daysOverdue: 30, rate: 5, status: "unpaid", createdAt: now.toISOString() });
    expect(checkIssueEligibility(s, u).ok).toBe(false);
  });
});
