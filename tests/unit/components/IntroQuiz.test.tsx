import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import IntroQuiz, { QuizResult } from "@/components/IntroQuiz";

describe("IntroQuiz", () => {
  afterEach(cleanup);

  it("labels its scored preset as an educational example and explains overlap", () => {
    render(<IntroQuiz onComplete={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of [
      "10+ years",
      "Buy more",
      "Experienced",
      "Yes, fully covered",
      "Grow capital",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: answer }));
    }

    expect(screen.getByText(/a simple score picked this preset/i)).toBeTruthy();
    expect(screen.getByText(/does not establish a personal fit/i)).toBeTruthy();
    expect(screen.getByText(/US-listed funds illustrate a stock\/bond mix/i)).toBeTruthy();
    expect(screen.getByText(/VTI and QQQ have overlapping US large-company holdings/i)).toBeTruthy();
  });

  it("allows a first-time user to skip without selecting example holdings", () => {
    let completed: QuizResult | undefined;
    render(<IntroQuiz onComplete={(result) => { completed = result; }} />);

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(completed?.isSkipped).toBe(true);
    expect(completed?.suggestedPortfolio).toEqual([]);
  });

  const runQuiz = (answers: string[], props: { hasExistingPortfolio?: boolean } = {}) => {
    render(<IntroQuiz onComplete={() => {}} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    for (const answer of answers) fireEvent.click(screen.getByRole("button", { name: answer }));
  };

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
});
