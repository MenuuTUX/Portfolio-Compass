/** Cost of capital the DCF model accepts at all; outside it the discounting is not meaningful. */
export const WACC_MIN = 0.03;
export const WACC_MAX = 0.2;
/** Smallest gap between cost of capital and terminal growth before the terminal value explodes. */
export const MIN_WACC_SPREAD = 0.01;

/** The band a computed cost of capital is clamped into before it is used. */
export const WACC_FLOOR = 0.06;
export const WACC_CEILING = 0.14;

/** Long-term growth may not exceed the risk-free rate or this. */
export const TERMINAL_GROWTH_MAX = 0.04;
