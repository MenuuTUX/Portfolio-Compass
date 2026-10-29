// Python sources installed into Pyodide by the Python strategy worker.

/** Pinned Pyodide build, the one measured in Phase 0. Served by jsDelivr, not by this site. */
export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/";

/** `import compass`: helpers that only look backwards, matching the TypeScript ctx helpers. */
export const COMPASS_PY = `"""Compass Lab helpers. Every function looks backwards only."""
import numpy as np
import pandas as pd


def returns(prices, n=1):
    """Return over the last n bars."""
    return prices.pct_change(n, fill_method=None)


def sma(prices, n):
    """Average of the last n prices that exist; gaps are skipped, not counted."""
    if isinstance(prices, pd.DataFrame):
        return prices.apply(lambda col: sma(col, n))
    return prices.dropna().rolling(n).mean().reindex(prices.index)


def ema(prices, n):
    return prices.ewm(span=n, adjust=False, min_periods=n).mean()


def stdev(prices, n):
    """Rolling sample standard deviation."""
    return prices.rolling(n).std()


def rsi(prices, n=14):
    """Wilder's relative strength index."""
    d = prices.diff()
    gain = d.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    loss = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    return 100 - 100 / (1 + gain / loss)


def top_n(scores, n):
    """Equal weights (1/n) on the n highest scores in each row; ties go to the earlier column."""
    rank = scores.rank(axis=1, ascending=False, method="first")
    return (rank <= n).astype(float) / n


def inverse_vol(prices, window=63):
    """Weights proportional to 1 / volatility of daily returns over the window."""
    vol = returns(prices).rolling(window).std()
    inv = 1 / vol.where(vol > 0)
    return inv.div(inv.sum(axis=1), axis=0).fillna(0.0)
`;

/** Glue the worker calls into. Names start with _lab so they do not collide with user code. */
export const HARNESS_PY = `
import json
import numpy as np
import pandas as pd


class _LabContext:
    def __init__(self, params):
        self.params = params


def _lab_load(code):
    ns = {"__name__": "strategy"}
    exec(compile(code, "strategy.py", "exec"), ns)
    if not callable(ns.get("weights")):
        raise NameError("Define a function weights(prices, ctx).")
    return ns


def _lab_params(code):
    raw = _lab_load(code).get("PARAMS", {})
    return json.dumps(raw if isinstance(raw, dict) else {}, default=str)


def _lab_weights(ns, adj, rows, cols, dates, tickers, overrides_json):
    # adj arrives as a JS Float64Array; to_py() shares its memory without copying through Python objects.
    prices = pd.DataFrame(
        np.asarray(adj.to_py(), dtype=float).reshape(rows, cols),
        index=pd.DatetimeIndex(list(dates)),
        columns=list(tickers),
    )
    params = {**ns.get("PARAMS", {}), **json.loads(overrides_json)}
    out = ns["weights"](prices, _LabContext(params))
    if isinstance(out, pd.Series):
        raise TypeError("weights() returned a Series; return a DataFrame with one column per ticker.")
    if isinstance(out, pd.DataFrame):
        unknown = [c for c in out.columns if c not in prices.columns]
        if unknown:
            raise KeyError(f"weights() has columns that are not in the universe: {unknown}")
        same_index = out.index.equals(prices.index)
        out = out.reindex(index=prices.index, columns=prices.columns)
        if not same_index:
            # Weekly or monthly targets hold until the next one.
            out = out.ffill()
        arr = out.to_numpy(dtype=float)
    elif isinstance(out, np.ndarray):
        if out.shape != (rows, cols):
            raise ValueError(f"weights() returned an array of shape {out.shape}; expected {(rows, cols)}.")
        arr = out.astype(float)
    else:
        raise TypeError("weights() must return a pandas DataFrame or a 2-D numpy array.")
    return np.nan_to_num(arr, nan=0.0).ravel()

`;
