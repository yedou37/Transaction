from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger, UniqueConstraint
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

    __table_args__ = (UniqueConstraint('transaction_hash', 'log_index', name='_tx_hash_log_index_uc'),)

# 示例模型：存储 Binance 的成交数据
class BinanceTrade(Base):
    __tablename__ = "binance_trades"
    id = Column(BigInteger, primary_key=True, index=True) # Binance trade ID 很大
    timestamp = Column(DateTime, index=True)
    price = Column(Float)
    quantity = Column(Float)