export const STARTING_BALANCE = 10_000;

export const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
