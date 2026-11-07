import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { cleanup, render, waitFor } from "@testing-library/react";
import LabApp from "@/components/lab/LabApp";
import { BLANK_FORM, LAB_ACK_KEY, LAB_FORM_KEY } from "@/lib/lab/lab-form";

const todayIso = () => new Date().toISOString().slice(0, 10);

describe("LabApp before the acknowledgement flag is read", () => {
  it("renders a skeleton with the page title, not an empty page", () => {
    const html = renderToString(<LabApp />);
    expect(html).toContain("Compass Lab");
    expect(html).toMatch(/<h1[^>]*>Compass Lab<\/h1>/);
  });
});

describe("LabApp saved form", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("restores the start date but always backtests to today", async () => {
    localStorage.setItem(LAB_ACK_KEY, "1");
    localStorage.setItem(
      LAB_FORM_KEY,
      JSON.stringify({ ...BLANK_FORM, mode: "form", start: "2015-03-02", end: "2016-01-04" }),
    );

    render(<LabApp />);

    await waitFor(() => {
      const end = document.querySelector<HTMLInputElement>('input[type="date"][id$="end"]');
      expect(end).not.toBeNull();
      expect(end?.value).toBe(todayIso());
    });
    const start = document.querySelector<HTMLInputElement>('input[type="date"][id$="start"]');
    expect(start?.value).toBe("2015-03-02");
  });
});
