import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DcfPanel from "@/components/dcf/DcfPanel";
import { dcfValue, impliedGrowth, sensitivity, type DcfInputs } from "@/lib/valuation/dcf";
import { describeResult } from "@/lib/valuation/summarize";
import type { DcfResponse } from "@/lib/valuation/response";
import { withFetch } from "@/tests/helpers/fetch";

const inputs: DcfInputs = {
  rev0: 400e9, g1: 0.05, gT: 0.025, margin0: 0.3, marginT: 0.3, tax: 0.15, taxMarginal: 0.25,
  ronic: 0.25, wacc: 0.09, netClaims: -50e9, shares: 15e9, midYear: true, stub: 0.5, years: 10,
};
const price = dcfValue({ ...inputs, g1: 0.08 }).perShare;
const described = (i: DcfInputs) =>
  describeResult({ implied: impliedGrowth(i, price), band: sensitivity(i, price) }, i);

const ok: DcfResponse = {
  status: "ok", ticker: "TEST", name: "Test Corp", price, priceAsOf: null, fiscalYearEnd: "2025-09-27",
  inputs, neutralInputs: inputs, headline: described(inputs), neutral: described(inputs),
  impliedReturn: null, rows: [{ label: "Cost of capital", value: "9.0%", note: "From beta." }], warnings: ["A warning."],
};
function mount(body: unknown, status = 200) {
  withFetch(async () => new Response(JSON.stringify(body), { status }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><DcfPanel ticker="TEST" /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
});

describe("DcfPanel", () => {
  it("shows what the price implies, with the assumptions and a disclaimer", async () => {
    mount(ok);
    expect(await screen.findByText(/the model needs revenue growth of 8\.0% a year/)).toBeTruthy();
    expect(screen.getByText(/Held fixed: margin held at 30\.0%/)).toBeTruthy();
    expect(screen.getByText(/not investment advice/i)).toBeTruthy();
    expect(screen.getByText("A warning.")).toBeTruthy();
  });

  it("solves again in the browser when an assumption is changed", async () => {
    mount(ok);
    await screen.findByText(/revenue growth of 8\.0% a year/);

    fireEvent.change(screen.getByLabelText("Cost of capital"), { target: { value: "10.5" } });

    expect(screen.queryByText(/revenue growth of 8\.0% a year/)).toBeNull();
    expect(screen.getByText(/WACC 10\.5%/)).toBeTruthy();
    fireEvent.click(screen.getByText("Back to the filing-based values"));
    expect(screen.getByText(/revenue growth of 8\.0% a year/)).toBeTruthy();
  });

  it("explains an unusable assumption instead of showing a number", async () => {
    mount(ok);
    await screen.findByText(/revenue growth of 8\.0% a year/);
    fireEvent.change(screen.getByLabelText("Terminal growth"), { target: { value: "9" } });
    expect(screen.getByText(/could not give a dependable answer/)).toBeTruthy();
    expect(screen.getByText(/too close to long-term growth/)).toBeTruthy();
    expect(screen.queryByText(/needs revenue growth of/)).toBeNull();
  });

  it("lists the reasons when a company is out of scope", async () => {
    mount({ status: "refused", ticker: "JPM", reasons: ["Cash-flow models do not suit banks."] });
    expect(await screen.findByText("Cash-flow models do not suit banks.")).toBeTruthy();
    expect(screen.queryByText(/revenue growth of/)).toBeNull();
  });

  it("shows a plain message when the service fails", async () => {
    mount({ error: "Company filings are temporarily unavailable." }, 502);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Company filings are temporarily unavailable.")).toBeTruthy();
  });
});
