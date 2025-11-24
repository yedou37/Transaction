from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, text
from datetime import datetime, timezone, time
from typing import List, Dict, Optional
from .database import engine, Base, get_db
from . import models

# 创建数据库表 (如果它们不存在)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.get("/api/health")
def health_check():
    """
Signature: `GET /api/health`

Description:
用于检查后端服务是否正常运行的健康检查端点。

Returns:
- `dict`: 包含状态信息的 JSON 对象 `{"status": "ok"}`。
    """
    return {"status": "ok"}

@app.get("/api/db-check")
def db_check(db: Session = Depends(get_db)):
    """
Signature: `GET /api/db-check`

Description:
用于检查数据库连接是否成功的端点。

Parameters:
- `db` (Session): 通过依赖注入提供的数据库会话。

Returns:
- `dict`: 包含数据库连接状态的 JSON 对象。
    """
    try:
        # 执行一个简单的查询来测试连接
        db.execute(text("SELECT 1"))
        return {"db_status": "connected"}
    except Exception as e:
        return {"db_status": "error", "detail": str(e)}

@app.get("/api/price-data")
def get_price_data(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Signature: `GET /api/price-data`
    
    Description:
    获取 Uniswap V3 和 Binance 的价格数据，按天聚合为 OHLC（开高低收）格式。
    
    Parameters:
    - `start_date` (str, optional): 开始日期，格式为 "YYYY-MM-DD"，默认为 2025-09-01
    - `end_date` (str, optional): 结束日期，格式为 "YYYY-MM-DD"，默认为 2025-09-30
    - `db` (Session): 通过依赖注入提供的数据库会话。
    
    Returns:
    - `dict`: 包含 uniswap 和 binance 价格数据的 JSON 对象，格式为：
      {
        "uniswap": [
          {
            "timestamp": "2025-09-01T12:00:00Z",
            "open": 2500.0,
            "high": 2515.0,
            "low": 2490.0,
            "close": 2505.0,
            "volume": 100.0
          }
        ],
        "binance": [...]
      }
    """
    # 默认时间范围：2025年9月
    if not start_date:
        start_date = "2025-09-01"
    if not end_date:
        end_date = "2025-09-30"
    
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=timezone.utc
        )
    except ValueError:
        return {"error": "日期格式错误，请使用 YYYY-MM-DD 格式"}
    
    # 查询 Uniswap 数据并按天聚合
    uniswap_data = db.query(
        cast(models.UniswapSwap.timestamp, Date).label('date'),
        func.min(models.UniswapSwap.price).label('low'),
        func.max(models.UniswapSwap.price).label('high'),
        func.sum(func.abs(models.UniswapSwap.amount1)).label('volume')
    ).filter(
        models.UniswapSwap.timestamp >= start_dt,
        models.UniswapSwap.timestamp <= end_dt
    ).group_by(
        cast(models.UniswapSwap.timestamp, Date)
    ).order_by(
        cast(models.UniswapSwap.timestamp, Date)
    ).all()
    
    # 获取每天的第一笔和最后一笔交易价格（open 和 close）
    uniswap_ohlc = []
    for row in uniswap_data:
        date = row.date
        # 获取当天的第一笔交易（open）
        first_trade = db.query(models.UniswapSwap).filter(
            cast(models.UniswapSwap.timestamp, Date) == date
        ).order_by(models.UniswapSwap.timestamp.asc()).first()
        
        # 获取当天的最后一笔交易（close）
        last_trade = db.query(models.UniswapSwap).filter(
            cast(models.UniswapSwap.timestamp, Date) == date
        ).order_by(models.UniswapSwap.timestamp.desc()).first()
        
        if first_trade and last_trade:
            # 将日期转换为 UTC 时间戳字符串（使用当天的 00:00:00）
            date_dt = datetime.combine(date, time.min).replace(tzinfo=timezone.utc)
            uniswap_ohlc.append({
                "timestamp": date_dt.isoformat().replace('+00:00', 'Z'),
                "open": float(first_trade.price),
                "high": float(row.high),
                "low": float(row.low),
                "close": float(last_trade.price),
                "volume": float(row.volume) if row.volume else 0.0
            })
    
    # 查询 Binance 数据并按天聚合
    binance_data = db.query(
        cast(models.BinanceTrade.timestamp, Date).label('date'),
        func.min(models.BinanceTrade.price).label('low'),
        func.max(models.BinanceTrade.price).label('high'),
        func.sum(models.BinanceTrade.quantity).label('volume')
    ).filter(
        models.BinanceTrade.timestamp >= start_dt,
        models.BinanceTrade.timestamp <= end_dt
    ).group_by(
        cast(models.BinanceTrade.timestamp, Date)
    ).order_by(
        cast(models.BinanceTrade.timestamp, Date)
    ).all()
    
    # 获取每天的第一笔和最后一笔交易价格（open 和 close）
    binance_ohlc = []
    for row in binance_data:
        date = row.date
        # 获取当天的第一笔交易（open）
        first_trade = db.query(models.BinanceTrade).filter(
            cast(models.BinanceTrade.timestamp, Date) == date
        ).order_by(models.BinanceTrade.timestamp.asc()).first()
        
        # 获取当天的最后一笔交易（close）
        last_trade = db.query(models.BinanceTrade).filter(
            cast(models.BinanceTrade.timestamp, Date) == date
        ).order_by(models.BinanceTrade.timestamp.desc()).first()
        
        if first_trade and last_trade:
            # 将日期转换为 UTC 时间戳字符串（使用当天的 00:00:00）
            date_dt = datetime.combine(date, time.min).replace(tzinfo=timezone.utc)
            binance_ohlc.append({
                "timestamp": date_dt.isoformat().replace('+00:00', 'Z'),
                "open": float(first_trade.price),
                "high": float(row.high),
                "low": float(row.low),
                "close": float(last_trade.price),
                "volume": float(row.volume) if row.volume else 0.0
            })
    
    return {
        "uniswap": uniswap_ohlc,
        "binance": binance_ohlc
    }