import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import TfsaPlanner from "@/components/tfsa/TfsaPlanner";
import { cumulativeRoom, TFSA_LATEST_YEAR } from "@/lib/tfsa";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

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

describe("TfsaPlanner room inputs", () => {
  it("labels the birth-year field for residents who turned 18 before arriving", () => {
    setSystemTime(new Date(`${TFSA_LATEST_YEAR}-06-15T12:00:00Z`));
    render(<TfsaPlanner />);
    const field = screen.getByLabelText(/First year you were 18 or older and a Canadian resident/) as HTMLInputElement;
    expect(field.value).toBe("2022");
    expect(screen.getByText("Room builds from that year, or from 2009 if later.")).toBeTruthy();
  });

  it("drops room by the amount already contributed this year", () => {
    setSystemTime(new Date(`${TFSA_LATEST_YEAR}-06-15T12:00:00Z`));
    render(<TfsaPlanner />);
    const region = screen.getByRole("region", { name: "Contribution room" });
    const roomText = () => within(region).getByText(/^\$/, { selector: "p.font-display" }).textContent;
    const fullRoom = cumulativeRoom(2022, TFSA_LATEST_YEAR);
    expect(roomText()).toBe(cad.format(fullRoom));

    fireEvent.change(screen.getByLabelText(/Already contributed this year/), { target: { value: "1500" } });

    expect(roomText()).toBe(cad.format(fullRoom - 1500));
  });
});
