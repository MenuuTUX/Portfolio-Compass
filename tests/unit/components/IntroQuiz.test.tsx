import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import IntroQuiz, { QuizResult } from "@/components/IntroQuiz";

const RISK_ANSWERS = ["10+ years", "Buy more", "Experienced", "Yes, fully covered", "Grow capital"];
// Age, then the optional savings goal and monthly amount, both skipped.
const FOLLOW_UPS = ["30 to 44", "Skip this", "Skip this"];

describe("IntroQuiz", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  const runQuiz = (
    answers: string[],
    props: { hasExistingPortfolio?: boolean } = {},
    extras: string[] = ["US dollars", "Not sure"],
  ) => {
    render(<IntroQuiz onComplete={() => {}} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...answers, ...extras, ...FOLLOW_UPS]) fireEvent.click(screen.getByRole("button", { name: answer }));
  };

  // Runs the quiz and returns what onComplete receives when the user accepts the example.
  const resultOf = (answers: string[], extras: string[]): QuizResult => {
    let completed: QuizResult | undefined;
    render(<IntroQuiz onComplete={(result) => { completed = result; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...answers, ...extras, ...FOLLOW_UPS]) fireEvent.click(screen.getByRole("button", { name: answer }));
    fireEvent.click(screen.getByRole("button", { name: "Open portfolio" }));
    return completed!;
  };

  // Enters one optional amount ("" skips it) and moves on.
  const amountStep = (label: string, value: string) => {
    if (value === "") {
      fireEvent.click(screen.getByRole("button", { name: "Skip this" }));
      return;
    }
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
  };

  // Finishes the quiz with the given age and optional amounts, and returns the stored profile.
  const finishWith = (age: string, goal: string, monthly: string): QuizResult => {
    let completed: QuizResult | undefined;
    render(<IntroQuiz onComplete={(result) => { completed = result; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...RISK_ANSWERS, "US dollars", "Not sure", age]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
    }
    amountStep("Amount (USD)", goal);
    amountStep("Amount (USD)", monthly);
    fireEvent.click(screen.getByRole("button", { name: "Open portfolio" }));
    return completed!;
  };

  it("labels its scored preset as an educational example and explains overlap", () => {
    runQuiz(RISK_ANSWERS);

    expect(screen.getByText(/a simple score picked this preset/i)).toBeTruthy();
    expect(screen.getByText(/does not establish a personal fit/i)).toBeTruthy();
    expect(screen.getByText(/US-listed funds illustrate a stock\/bond mix in US dollars/i)).toBeTruthy();
    expect(screen.getByText(/VTI and QQQ have overlapping US large-company holdings/i)).toBeTruthy();
  });

  it("allows a first-time user to skip without selecting example holdings", () => {
    let completed: QuizResult | undefined;
    render(<IntroQuiz onComplete={(result) => { completed = result; }} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(completed?.isSkipped).toBe(true);
    expect(completed?.suggestedPortfolio).toEqual([]);
  });

  it("describes ten short questions and counts progress against ten", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    expect(screen.getByText(/Ten short questions/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("1 of 10")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("asks for currency and account after the five risk questions", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of RISK_ANSWERS) fireEvent.click(screen.getByRole("button", { name: answer }));

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Which currency do you invest in?");
    fireEvent.click(screen.getByRole("button", { name: "US dollars" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Which account?");
  });

  it("keeps Back working through the new questions and retains earlier answers", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of RISK_ANSWERS) fireEvent.click(screen.getByRole("button", { name: answer }));

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Priority");
    expect(screen.getByRole("button", { name: "Grow capital" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps Skip working on the new questions", () => {
    let completed: QuizResult | undefined;
    render(<IntroQuiz onComplete={(result) => { completed = result; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of RISK_ANSWERS) fireEvent.click(screen.getByRole("button", { name: answer }));

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(completed?.isSkipped).toBe(true);
  });

  it("uses CAD example funds listed in Canada for a Canadian-dollar Growth result", () => {
    runQuiz(RISK_ANSWERS, {}, ["Canadian dollars", "TFSA or RRSP"]);

    expect(screen.getByText("XEQT.TO")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.queryByText("VTI")).toBeNull();
    expect(screen.queryByText("QQQ")).toBeNull();
    expect(screen.getByText(/Canadian-listed funds illustrate a stock\/bond mix in Canadian dollars/)).toBeTruthy();
    expect(screen.queryByText(/VTI and QQQ have overlapping/)).toBeNull();
  });

  it("uses CAD example funds for a Balanced result", () => {
    runQuiz(["10+ years", "Hold", "Comfortable", "3 to 6 months of expenses", "Balance of both"], {}, ["Canadian dollars", "Non-registered"]);

    expect(screen.getByText("XIC.TO")).toBeTruthy();
    expect(screen.getByText("XBB.TO")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
  });

  it("warns about US withholding tax only for US dollars in a TFSA or RRSP", () => {
    runQuiz(RISK_ANSWERS, {}, ["US dollars", "TFSA or RRSP"]);
    expect(screen.getByText(/US-listed funds can face US withholding tax/)).toBeTruthy();
  });

  it("does not show the withholding warning for Canadian dollars in a TFSA", () => {
    runQuiz(RISK_ANSWERS, {}, ["Canadian dollars", "TFSA or RRSP"]);
    expect(screen.queryByText(/withholding tax/)).toBeNull();
  });

  it("does not show the withholding warning for US dollars in a non-registered account", () => {
    runQuiz(RISK_ANSWERS, {}, ["US dollars", "Non-registered"]);
    expect(screen.queryByText(/withholding tax/)).toBeNull();
  });

  it("does not let the currency or account answers change the score", () => {
    const usd = resultOf(RISK_ANSWERS, ["US dollars", "TFSA or RRSP"]);
    cleanup();
    const cad = resultOf(RISK_ANSWERS, ["Canadian dollars", "Non-registered"]);

    expect(cad.score).toBe(usd.score);
    expect(cad.profile).toBe(usd.profile);
    expect(cad.why).toEqual(usd.why);
  });

  it("reports the chosen currency and account to the caller", () => {
    const result = resultOf(RISK_ANSWERS, ["Canadian dollars", "TFSA or RRSP"]);

    expect(result.currency).toBe("CAD");
    expect(result.account).toBe("TFSA or RRSP");
    expect(result.isSkipped).toBe(false);
  });

  it("does not let strong answers cancel a horizon under 2 years", () => {
    runQuiz(["Under 2 years", "Buy more", "Experienced", "Yes, fully covered", "Grow capital"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Conservative");
  });

  it("does not let strong answers cancel selling everything in a crash", () => {
    runQuiz(["10+ years", "Sell everything", "Experienced", "Yes, fully covered", "Grow capital"]);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Conservative");
  });

  it("shows why the result came out as it did", () => {
    runQuiz(["Under 2 years", "Buy more", "Experienced", "Yes, fully covered", "Grow capital"]);
    expect(screen.getByText(/within 2 years/i)).toBeTruthy();
    expect(screen.getByText(/comfort with loss/i)).toBeTruthy();
  });

  it("says an example will not replace holdings the user already has", () => {
    runQuiz(
      ["10+ years", "Hold", "Comfortable", "3 to 6 months of expenses", "Balance of both"],
      { hasExistingPortfolio: true },
    );
    expect(screen.getByText(/will not replace/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep my portfolio" })).toBeTruthy();
  });

  it("asks age after the account question, then the savings goal and monthly amount", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...RISK_ANSWERS, "US dollars", "Not sure"]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
    }

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("How old are you?");
    expect(screen.getByText("8 of 10")).toBeTruthy();
    for (const label of ["Under 30", "30 to 44", "45 to 59", "60 or over"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "45 to 59" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Do you have a savings goal in mind?");
    expect(screen.getByText("9 of 10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Skip this" }));
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("How much could you add each month?");
    expect(screen.getByText("10 of 10")).toBeTruthy();
  });

  it("keeps Next disabled for a negative, too large or non-numeric amount", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...RISK_ANSWERS, "US dollars", "Not sure", "Under 30"]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
    }
    const next = () => screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    const input = () => screen.getByLabelText("Amount (USD)") as HTMLInputElement;

    fireEvent.change(input(), { target: { value: "-5" } });
    expect(next().disabled).toBe(true);
    expect(screen.getByRole("alert")).toBeTruthy();

    fireEvent.change(input(), { target: { value: "1000000000000" } });
    expect(next().disabled).toBe(true);

    fireEvent.change(input(), { target: { value: "25000" } });
    expect(next().disabled).toBe(false);
    fireEvent.click(next());
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("How much could you add each month?");
  });

  it("keeps an amount typed on a question when Back returns to it", () => {
    render(<IntroQuiz onComplete={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [...RISK_ANSWERS, "US dollars", "Not sure", "Under 30"]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
    }
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "25000" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect((screen.getByLabelText("Amount (USD)") as HTMLInputElement).value).toBe("25000");
  });

  it("saves the age and optional amounts when the last question is answered", () => {
    finishWith("30 to 44", "250000", "800");

    const stored = JSON.parse(localStorage.getItem("compass_risk_profile_v1") ?? "{}");
    expect(stored.ageBand).toBe("30-44");
    expect(stored.goalAmount).toBe(250000);
    expect(stored.monthlyContribution).toBe(800);
    expect(["Conservative", "Balanced", "Growth"]).toContain(stored.profile);
  });

  it("stores no amount for a skipped optional question", () => {
    finishWith("Under 30", "", "");

    const stored = JSON.parse(localStorage.getItem("compass_risk_profile_v1") ?? "{}");
    expect(stored.ageBand).toBe("under-30");
    expect(stored.goalAmount).toBeUndefined();
    expect(stored.monthlyContribution).toBeUndefined();
  });

  it("does not let age, savings goal or monthly amount change the score or profile", () => {
    const plain = finishWith("Under 30", "", "");
    cleanup();
    const detailed = finishWith("60 or over", "5000000", "12000");

    expect(detailed.score).toBe(plain.score);
    expect(detailed.profile).toBe(plain.profile);
    expect(detailed.why).toEqual(plain.why);
  });

  it("reports the age and optional amounts to the caller", () => {
    const result = finishWith("45 to 59", "75000", "400");

    expect(result.ageBand).toBe("45-59");
    expect(result.goalAmount).toBe(75000);
    expect(result.monthlyContribution).toBe(400);
  });
});
