from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    BigInteger,
    UniqueConstraint,
    func,
    Numeric,
)
from .database import Base

# 示例模型：存储 Uniswap V3 的 Swap 事件
class UniswapSwap(Base):
    __tablename__ = "uniswap_swaps"
    id = Column(Integer, primary_key=True, index=True)
    transaction_hash = Column(String, index=True) # A transaction can have multiple swaps
    log_index = Column(Integer) # Log index within the block, to uniquely identify the event
    timestamp = Column(DateTime, index=True)
    amount0 = Column(Float) # (例如 USDT)
    amount1 = Column(Float) # (例如 ETH)
    price = Column(Float)   # (USDT/ETH)
    block_number = Column(BigInteger, index=True)
    block_hash = Column(String)
    transaction_index = Column(Integer)
    sender = Column(String)
    recipient = Column(String)
    sqrt_price_x96 = Column(Numeric(precision=50, scale=0))
    liquidity = Column(Numeric(precision=40, scale=0))
    tick = Column(Integer)
    gas_price_wei = Column(Numeric(precision=40, scale=0))
    gas_used = Column(Numeric(precision=40, scale=0))
    gas_fee_eth = Column(Float)
    fee_amount = Column(Float)
    slippage_bps = Column(Float)

    __table_args__ = (UniqueConstraint('transaction_hash', 'log_index', name='_tx_hash_log_index_uc'),)

# 示例模型：存储 Binance 的成交数据
class BinanceTrade(Base):
    __tablename__ = "binance_trades"
    id = Column(BigInteger, primary_key=True, index=True) # Binance trade ID 很大
    timestamp = Column(DateTime, index=True)
    price = Column(Float)
    quantity = Column(Float)
    open_time = Column(DateTime)
    close_time = Column(DateTime)
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    quote_volume = Column(Float)
    number_of_trades = Column(BigInteger)
    taker_buy_base_volume = Column(Float)
    taker_buy_quote_volume = Column(Float)

class ArbitrageOpportunity(Base):
    __tablename__ = "arbitrage_opportunities"

    id = Column(Integer, primary_key=True, index=True)
    transaction_hash = Column(String, index=True)
    uniswap_log_index = Column(Integer, nullable=True)
    binance_trade_id = Column(BigInteger, nullable=True)
    timestamp = Column(DateTime, index=True)
    buy_timestamp = Column(DateTime, nullable=True)
    sell_timestamp = Column(DateTime, nullable=True)
    uniswap_price = Column(Float)
    binance_price = Column(Float)
    price_diff_percent = Column(Float)
    profit = Column(Float)
    profit_rate = Column(Float)  # stored as ratio (e.g. 0.05 = 5%)
    volume = Column(Float)  # matched amount in ETH
    relative_spread = Column(Float)
    direction = Column(String, nullable=True)  # "cex->dex" or "dex->cex"
    created_at = Column(DateTime, server_default=func.now())


class ArbitrageOpportunityMinute(Base):
    """
    按分钟预计算的套利机会
    用于识别潜在的套利机会（用户在这个时间点进行交易可能获得的利润）
    """
    __tablename__ = "arbitrage_opportunities_minute"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True, unique=True)  # 分钟级时间戳（精确到分钟）
    uniswap_price = Column(Float)  # 该分钟 Uniswap 平均价格
    binance_price = Column(Float)  # 该分钟 Binance 平均价格
    price_diff_percent = Column(Float)  # 价格差百分比
    profit = Column(Float)  # 每 ETH 预期利润（USDT/ETH）
    profit_rate = Column(Float)  # 利润率（小数，如 0.45 = 45%）
    direction = Column(String)  # "cex->dex" or "dex->cex"
    uniswap_trade_count = Column(Integer)  # 该分钟 Uniswap 交易数量
    binance_trade_count = Column(Integer)  # 该分钟 Binance 交易数量
    created_at = Column(DateTime, server_default=func.now())
