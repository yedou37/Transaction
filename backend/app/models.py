from sqlalchemy import Column, Integer, String, Float, DateTime, BigInteger
from .database import Base

# 示例模型：存储 Uniswap V3 的 Swap 事件
class UniswapSwap(Base):
    __tablename__ = "uniswap_swaps"
    id = Column(Integer, primary_key=True, index=True)
    transaction_hash = Column(String, unique=True, index=True)
    timestamp = Column(DateTime, index=True)
    amount0 = Column(Float) # (例如 USDT)
    amount1 = Column(Float) # (例如 ETH)
    price = Column(Float)   # (USDT/ETH)

# 示例模型：存储 Binance 的成交数据
class BinanceTrade(Base):
    __tablename__ = "binance_trades"
    id = Column(BigInteger, primary_key=True, index=True) # Binance trade ID 很大
    timestamp = Column(DateTime, index=True)
    price = Column(Float)
    quantity = Column(Float)