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
import compass


class _LabContext:
    def __init__(self, params):
        self.params = params


def _lab_load(code):
    ns = {"__name__": "strategy"}
    exec(compile(code, "strategy.py", "exec"), ns)
    if not callable(ns.get("weights")) and not callable(ns.get("decide")):
        raise NameError("Define a function decide(day). (Advanced: weights(prices, ctx) also works.)")
    return ns


def _lab_params(code):
    raw = _lab_load(code).get("PARAMS", {})
    return json.dumps(raw if isinstance(raw, dict) else {}, default=str)

class _Book:
    """Indicator series for one run, each computed once over the whole column and read at day t.
    It lives for a single _lab_weights call, so the lookahead reruns on cut-off history stay honest."""

    def __init__(self, prices):
        self.prices = prices
        self.dates = [d.strftime("%Y-%m-%d") for d in prices.index]
        self.cache = {}

    def get(self, kind, ticker, n=None):
        if ticker not in self.prices.columns:
            raise ValueError(f'"{ticker}" is not in your tickers. Write it in your code as text, like "{ticker}", and it is added for you.')
        if n is not None:
            if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or n < 1:
                raise ValueError(f"days must be a whole number of 1 or more, not {n!r}.")
            n = int(n)
        key = (kind, ticker, n)
        if key not in self.cache:
            px = self.prices[ticker]
            if kind == "price":
                s = px
            elif kind == "average":
                s = compass.sma(px, n)
            elif kind == "change":
                s = compass.returns(px, n)
            elif kind == "high":
                s = px.rolling(n).max()
            elif kind == "low":
                s = px.rolling(n).min()
            else:
                s = compass.rsi(px, n)
            self.cache[key] = s.to_numpy(dtype=float)
        return self.cache[key]


class _Day:
    """What decide(day) sees: today and everything before it. Later prices do not exist yet."""

    def __init__(self, book, t, params):
        self._book, self._t = book, t
        self.params = params
        self.date = book.dates[t]

    def price(self, ticker):
        """Today's closing price. NaN before the fund existed."""
        return float(self._book.get("price", ticker)[self._t])

    def average(self, ticker, days):
        """Average closing price over the last days days. NaN until that much history exists."""
        return float(self._book.get("average", ticker, days)[self._t])

    def change(self, ticker, days):
        """Growth over the last days days as a fraction: 0.05 means up 5%."""
        return float(self._book.get("change", ticker, days)[self._t])

    def high(self, ticker, days):
        """Highest close over the last days days."""
        return float(self._book.get("high", ticker, days)[self._t])

    def low(self, ticker, days):
        """Lowest close over the last days days."""
        return float(self._book.get("low", ticker, days)[self._t])

    def rsi(self, ticker, days=14):
        """Relative strength index, 0 to 100. Below 30 is often called oversold, above 70 overbought."""
        return float(self._book.get("rsi", ticker, days)[self._t])


def _lab_row(out, columns):
    if out is None:
        return {}
    if isinstance(out, str):
        out = {out: 1.0}
    elif isinstance(out, (list, tuple, set)):
        names = list(out)
        out = {name: 1.0 / len(names) for name in names}
    if not isinstance(out, dict):
        raise TypeError('decide(day) should return a ticker like "SPY", a list like ["SPY", "QQQ"], weights like {"SPY": 0.6, "AGG": 0.4}, or None to hold cash.')
    row = {}
    for ticker, weight in out.items():
        if ticker not in columns:
            raise ValueError(f'decide() returned "{ticker}", which is not in your tickers.')
        w = float(weight)
        if w != w:
            continue
        if w < 0:
            raise ValueError("Weights cannot be negative. Short selling is not supported.")
        row[ticker] = row.get(ticker, 0.0) + w
    total = sum(row.values())
    if total > 1.0001:
        hint = " Use fractions: 0.6 means 60%." if total <= 100.0001 else ""
        raise ValueError(f"Your weights add up to {total:g}, but they must total 1 or less (the rest stays in cash).{hint}")
    return row


def _lab_decide(decide, prices, params):
    book = _Book(prices)
    columns = {name: j for j, name in enumerate(prices.columns)}
    arr = np.zeros((len(prices), len(columns)))
    for t in range(len(prices)):
        for ticker, weight in _lab_row(decide(_Day(book, t, params)), columns).items():
            arr[t, columns[ticker]] = weight
    for (kind, ticker, n), series in book.cache.items():
        if kind == "price":
            continue
        ok = np.flatnonzero(~np.isnan(series))
        label = {
            "average": f"the {n}-day average of {ticker}",
            "change": f"the {n}-day change of {ticker}",
            "high": f"the {n}-day high of {ticker}",
            "low": f"the {n}-day low of {ticker}",
        }.get(kind, f"the RSI of {ticker}")
        if len(ok) == 0:
            print(f"warning: {label} never has a value in this period; use fewer days or a longer period.")
        elif ok[0] > 0:
            print(f"note: {label} starts on {book.dates[ok[0]]}. Before that it is not a number, so comparisons with it are False.")
    return arr.ravel()


def _lab_weights(ns, adj, rows, cols, dates, tickers, overrides_json):
    # adj arrives as a JS Float64Array; to_py() shares its memory without copying through Python objects.
    prices = pd.DataFrame(
        np.asarray(adj.to_py(), dtype=float).reshape(rows, cols),
        index=pd.DatetimeIndex(list(dates)),
        columns=list(tickers),
    )
    params = {**ns.get("PARAMS", {}), **json.loads(overrides_json)}
    if not callable(ns.get("weights")):
        return _lab_decide(ns["decide"], prices, params)
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
