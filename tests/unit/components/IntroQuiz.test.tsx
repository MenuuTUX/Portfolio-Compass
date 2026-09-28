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
});
