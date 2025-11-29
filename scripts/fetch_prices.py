import sys
import yfinance as yf
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
from dotenv import load_dotenv
import numpy as np

# Load environment variables
load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")

# Handle Prisma format connection string if necessary
if DATABASE_URL and DATABASE_URL.startswith("prisma+postgres://"):
    DATABASE_URL = DATABASE_URL.replace("prisma+postgres://", "postgresql://")

# Fallback for local development if not set (mirroring run.sh default)
if not DATABASE_URL:
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/portfolio_compass?schema=public"

Base = declarative_base()

class Etf(Base):
    __tablename__ = 'Etf'
    ticker = Column(String, primary_key=True)
    name = Column(String)
    currency = Column(String)
    exchange = Column(String, nullable=True)
    price = Column(Float)
    daily_change = Column(Float)
    yield_val = Column("yield", Float, nullable=True)
    mer = Column(Float, nullable=True)
    updatedAt = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    history = relationship("EtfHistory", back_populates="etf", cascade="all, delete-orphan")
    sectors = relationship("EtfSector", back_populates="etf", cascade="all, delete-orphan")
    allocation = relationship("EtfAllocation", back_populates="etf", uselist=False, cascade="all, delete-orphan")

class EtfHistory(Base):
    __tablename__ = 'EtfHistory'
    id = Column(Integer, primary_key=True, autoincrement=True)
    etfId = Column(String, ForeignKey('Etf.ticker'))
    date = Column(DateTime)
    close = Column(Float)
    etf = relationship("Etf", back_populates="history")

class EtfSector(Base):
    __tablename__ = 'EtfSector'
    id = Column(Integer, primary_key=True, autoincrement=True)
    etfId = Column(String, ForeignKey('Etf.ticker'))
    sector_name = Column(String)
    weight = Column(Float)
    etf = relationship("Etf", back_populates="sectors")

class EtfAllocation(Base):
    __tablename__ = 'EtfAllocation'
    id = Column(Integer, primary_key=True, autoincrement=True)
    etfId = Column(String, ForeignKey('Etf.ticker'), unique=True)
    stocks_weight = Column(Float)
    bonds_weight = Column(Float)
    cash_weight = Column(Float)
    etf = relationship("Etf", back_populates="allocation")


def to_py_float(val):
    """Safely convert numpy/pandas floats to python float."""
    if val is None:
        return 0.0
    if isinstance(val, (np.floating, np.integer)):
        return float(val)
    return float(val)

def get_ticker_data(ticker_symbol):
    """
    Tries to fetch data for ticker_symbol.
    If fails or empty info, tries appending '.TO' (Smart Fetch).
    Returns (ticker_obj, info_dict, success_symbol) or (None, None, None).
    """

    def fetch(symbol):
        t = yf.Ticker(symbol)
        try:
            # Accessing info triggers the fetch
            i = t.info
            # specific check: if regularMarketPrice is missing or 0, might be invalid
            # but sometimes it's just delayed.
            # If 'symbol' key is not present, it's often a sign of failed fetch in older yfinance
            # but currently yfinance returns info even for invalid sometimes (mostly empty).
            # A good check is if we have a price or name.
            if not i or 'symbol' not in i or ('currentPrice' not in i and 'regularMarketPreviousClose' not in i):
                 return None, None
            return t, i
        except Exception:
            return None, None

    # Try original
    stock, info = fetch(ticker_symbol)
    if stock:
        return stock, info, ticker_symbol.upper()

    # Try with .TO if original didn't have suffix
    if not ticker_symbol.upper().endswith(".TO"):
        print(f"  > '{ticker_symbol}' not found. Retrying with '{ticker_symbol}.TO'...")
        stock_to, info_to = fetch(ticker_symbol + ".TO")
        if stock_to:
            return stock_to, info_to, (ticker_symbol + ".TO").upper()

    return None, None, None


def fetch_and_store_etfs(tickers):
    if not DATABASE_URL:
        print("Error: DATABASE_URL is not set.")
        return

    engine = None
    try:
        engine = create_engine(DATABASE_URL)
        Session = sessionmaker(bind=engine)
    except Exception as e:
        print(f"Database connection setup failed: {e}")
        return

    print(f"Fetching data for {len(tickers)} ETFs...")

    for ticker_input in tickers:
        session = Session()
        try:
            print(f"Processing {ticker_input}...")

            # Smart Fetch
            stock, info, valid_ticker = get_ticker_data(ticker_input)

            if not stock:
                print(f"  x Failed to fetch data for {ticker_input} (and .TO variant)")
                session.close()
                continue

            # Use the valid ticker for DB operations (e.g. VFV -> VFV.TO)
            ticker = valid_ticker

            # Fetch history (1mo)
            hist = stock.history(period="1mo")

            # Extract basic info safely
            price_raw = info.get("currentPrice", info.get("regularMarketPreviousClose", 0.0))
            daily_change_raw = info.get("regularMarketChangePercent", 0.0)

            # --- Explicit Casting to fix 'np' schema errors ---
            price = to_py_float(price_raw)
            daily_change = to_py_float(daily_change_raw) * 100

            yield_raw = info.get("yield", info.get("dividendYield", 0.0))
            yield_val = to_py_float(yield_raw) * 100 if yield_raw else 0.0

            mer_raw = info.get("annualReportExpenseRatio", 0.0)
            mer = to_py_float(mer_raw) * 100 if mer_raw else 0.0

            # Upsert ETF
            etf = session.query(Etf).filter_by(ticker=ticker).first()
            if not etf:
                etf = Etf(ticker=ticker)
                session.add(etf)

            etf.name = str(info.get("shortName", ticker))
            etf.currency = str(info.get("currency", "USD"))
            etf.exchange = str(info.get("exchange", "Unknown"))
            etf.price = price
            etf.daily_change = daily_change
            etf.yield_val = yield_val
            etf.mer = mer
            etf.updatedAt = datetime.now()

            # Update History
            # We want to keep last 30 days roughly.
            # To be safe and avoid duplicates, we check.
            for date, row in hist.iterrows():
                # date is Timestamp, needs conversion to python datetime if needed, but sqlalchemy handles pandas timestamp often.
                # safer to cast.
                date_py = date.to_pydatetime()
                close_val = to_py_float(row['Close'])

                existing_hist = session.query(EtfHistory).filter_by(etfId=ticker, date=date_py).first()
                if not existing_hist:
                    new_hist = EtfHistory(etfId=ticker, date=date_py, close=close_val)
                    session.add(new_hist)

            # Update Sectors
            session.query(EtfSector).filter_by(etfId=ticker).delete()

            # yfinance often hides sector data. We try best effort.
            # Some versions use 'sectorWeightings' (list of dicts).
            # If not available, we skip sector update to avoid crashing.
            # In a real app, we might want to preserve old sectors if new fetch fails, but requirements imply refreshing.

            # Attempt to find sector data structure
            # Not reliably available in free yfinance, but we implement the logic if it appears
            sectors_data = info.get("sectorWeightings", [])
            if sectors_data and isinstance(sectors_data, list):
                 for s in sectors_data:
                     # format usually: {'sector': '...', 'weight': 0.1}
                     s_name = s.get('sector', 'Unknown')
                     s_weight = to_py_float(s.get('weight', 0)) * 100 # usually 0-1
                     if s_weight > 0:
                         session.add(EtfSector(etfId=ticker, sector_name=s_name, weight=s_weight))

            # Update Allocation
            session.query(EtfAllocation).filter_by(etfId=ticker).delete()

            # Logic for allocation (Stocks/Bonds/Cash)
            # Default to 100% Equity if unknown, or try to parse 'assetClasses' if available (rare in free yf)
            # For this task, we can use a heuristic or simple default.
            # Since user wants "Robust", let's default to safe values if we can't determine.
            # Most things users search are ETFs.
            # If "bond" is in name or "Fixed Income", assume bond?
            # Let's just stick to 100% stock as placeholder unless we have data, to match previous behavior logic.

            alloc_stocks = 100.0
            alloc_bonds = 0.0
            alloc_cash = 0.0

            # Check category for hints?
            cat = info.get("category", "").lower()
            if "bond" in cat or "fixed income" in cat:
                alloc_stocks = 0.0
                alloc_bonds = 100.0

            session.add(EtfAllocation(
                etfId=ticker,
                stocks_weight=alloc_stocks,
                bonds_weight=alloc_bonds,
                cash_weight=alloc_cash
            ))

            session.commit()
            print(f"  ✓ Successfully updated {ticker}")

        except Exception as e:
            session.rollback()
            print(f"  ! Error fetching/saving {ticker_input}: {e}")
            # print(traceback.format_exc()) # Optional for debugging
        finally:
            session.close()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Arguments provided
        tickers_to_fetch = sys.argv[1:]
        # In case args are comma separated string "A,B,C" or separate args
        if len(tickers_to_fetch) == 1 and "," in tickers_to_fetch[0]:
            tickers_to_fetch = tickers_to_fetch[0].split(",")
    else:
        # Default list if no args
        tickers_to_fetch = [
            "VFV.TO", "XEQT.TO", "VGRO.TO", "XIU.TO", "ZEB.TO",
            "SPY", "QQQ", "VOO", "VTI", "SCHD"
        ]

    fetch_and_store_etfs(tickers_to_fetch)
