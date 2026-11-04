import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import TfsaPlanner from "@/components/tfsa/TfsaPlanner";
import { TFSA_LATEST_YEAR } from "@/lib/tfsa";

afterEach(() => {
  cleanup();
  setSystemTime();
});

describe("TfsaPlanner year coverage", () => {
  it("warns once the calendar year is past the last CRA limit in the table", () => {
    setSystemTime(new Date(`${TFSA_LATEST_YEAR + 1}-01-15T12:00:00Z`));
    render(<TfsaPlanner />);
    expect(screen.getByRole("status").textContent).toContain(`January 1, ${TFSA_LATEST_YEAR + 1}`);
  });

  it("shows no warning while the table covers the current year", () => {
    setSystemTime(new Date(`${TFSA_LATEST_YEAR}-06-15T12:00:00Z`));
    render(<TfsaPlanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
