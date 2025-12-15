from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, text, and_
from datetime import datetime, timezone, time, date, timedelta
from typing import List, Dict, Optional
from .database import engine, Base, get_db
from . import models

# 创建数据库表 (如果它们不存在)
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",
        "http://127.0.0.1",
    ],  # 允许前端访问（含 Nginx 80 端口）
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有请求头
)

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

DEFAULT_PRICE_WINDOW_DAYS = 180  # 默认返回最近 30 天（含今天）的数据


def _ensure_utc(dt: datetime) -> datetime:
    """保证 datetime 带有 UTC 时区信息。"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _daily_ohlcv(
    db: Session,
    model,
    volume_expr,
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, float]]:
    """
    将任意包含 price/timestamp 的表聚合为日级 OHLCV。
    额外返回 id（行号）和 displayTime 以兼容前端现有结构。
    """
    grouped = (
        db.query(
            cast(model.timestamp, Date).label("date"),
            func.min(model.price).label("low"),
            func.max(model.price).label("high"),
            func.sum(volume_expr).label("volume"),
        )
        .filter(model.timestamp >= start_dt, model.timestamp <= end_dt)
        .group_by(cast(model.timestamp, Date))
        .order_by(cast(model.timestamp, Date))
        .all()
    )

    results: List[Dict[str, float]] = []
    for idx, row in enumerate(grouped, start=1):
        current_date = row.date
        first_trade = (
            db.query(model)
            .filter(cast(model.timestamp, Date) == current_date)
            .order_by(model.timestamp.asc())
            .first()
        )
        last_trade = (
            db.query(model)
            .filter(cast(model.timestamp, Date) == current_date)
            .order_by(model.timestamp.desc())
            .first()
        )
        if not first_trade or not last_trade:
            continue

        ts = _ensure_utc(datetime.combine(current_date, time.min))
        results.append(
            {
                "id": idx,
                "timestamp": ts.isoformat().replace("+00:00", "Z"),
                "displayTime": ts.strftime("%m-%d"),
                "open": float(first_trade.price or 0.0),
                "high": float(row.high or first_trade.price or 0.0),
                "low": float(row.low or first_trade.price or 0.0),
                "close": float(last_trade.price or 0.0),
                "volume": float(row.volume or 0.0),
            }
        )
    return results


@app.get("/api/price-data")
def get_price_data(
    start_date: Optional[date] = Query(
        None, description="开始日期，格式 YYYY-MM-DD（默认返回最近 30 天）"
    ),
    end_date: Optional[date] = Query(
        None, description="结束日期，格式 YYYY-MM-DD（默认今天，UTC）"
    ),
    db: Session = Depends(get_db)
):
    """
    Signature: `GET /api/price-data`
    
    Description:
    获取 Uniswap V3 和 Binance 的价格数据，按天聚合为 OHLC（开高低收）格式，
    并提供前端图表直接可用的 displayTime/id 字段。
    
    Parameters:
    - `start_date` (date, optional): 开始日期，格式为 "YYYY-MM-DD"，默认 = 结束日期往前 29 天
    - `end_date` (date, optional): 结束日期，格式为 "YYYY-MM-DD"，默认 = 今天 (UTC)
    - `db` (Session): 通过依赖注入提供的数据库会话。
    
    Returns:
    - `dict`: 包含 uniswap 和 binance 价格数据的 JSON 对象，格式为：
      {
        "uniswap": [
          {
            "timestamp": "2025-09-01T00:00:00Z",
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
    today_utc = datetime.now(timezone.utc).date()
    resolved_end = end_date or today_utc
    resolved_start = start_date or (resolved_end - timedelta(days=DEFAULT_PRICE_WINDOW_DAYS - 1))
    if resolved_start > resolved_end:
        raise HTTPException(status_code=400, detail="start_date must not be after end_date")

    start_dt = _ensure_utc(datetime.combine(resolved_start, time.min))
    end_dt = _ensure_utc(datetime.combine(resolved_end, time.max))

    uniswap_ohlc = _daily_ohlcv(
        db,
        models.UniswapSwap,
        func.abs(models.UniswapSwap.amount1),
        start_dt,
        end_dt,
    )
    binance_ohlc = _daily_ohlcv(
        db,
        models.BinanceTrade,
        models.BinanceTrade.quantity,
        start_dt,
        end_dt,
    )

    return {
        "uniswap": uniswap_ohlc,
        "binance": binance_ohlc
    }


@app.get("/api/arbitrage/statistics")
def get_arbitrage_statistics(db: Session = Depends(get_db)):
    """
    Signature: `GET /api/arbitrage/statistics`

    Description:
    返回预计算的非原子套利统计数据，直接读取 arbitrage_opportunities 表的汇总。
    """
    total_opportunities = db.query(func.count(models.ArbitrageOpportunity.id)).scalar() or 0
    total_profit = (
        db.query(func.coalesce(func.sum(models.ArbitrageOpportunity.profit), 0)).scalar() or 0.0
    )
    average_profit_rate = (
        db.query(func.coalesce(func.avg(models.ArbitrageOpportunity.profit_rate), 0)).scalar() or 0.0
    )
    return {
        "total_opportunities": int(total_opportunities),
        "total_profit": float(total_profit),
        "average_profit_rate": float(average_profit_rate * 100),
    }


@app.get("/api/arbitrage/behaviors")
def get_arbitrage_behaviors(
    page: int = 1,
    page_size: int = 10,
    sort_by: str = "profit",  # profit | buy_timestamp | sell_timestamp
    sort_order: str = "desc",
    min_profit: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """
    Signature: `GET /api/arbitrage/behaviors`

    Description:
    分页返回识别出的套利行为，支持最小利润过滤和排序。
    与套利机会的区别：移除了 transaction_hash、timestamp、volume，新增了 direction 字段。
    """
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    query = db.query(models.ArbitrageOpportunity)
    if min_profit is not None:
        query = query.filter(models.ArbitrageOpportunity.profit >= min_profit)

    total = query.count()
    sort_column_map = {
        "profit": models.ArbitrageOpportunity.profit,
        "buy_timestamp": models.ArbitrageOpportunity.buy_timestamp,
        "sell_timestamp": models.ArbitrageOpportunity.sell_timestamp,
    }
    sort_column = sort_column_map.get(sort_by, models.ArbitrageOpportunity.profit)
    order_clause = (
        sort_column.desc() if sort_order.lower() == "desc" else sort_column.asc()
    )

    opportunities = (
        query.order_by(order_clause)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    def serialize_timestamp(dt: Optional[datetime]) -> Optional[str]:
        if not dt:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")

    data = []
    for opp in opportunities:
        data.append(
            {
                "id": opp.id,
                "buy_timestamp": serialize_timestamp(opp.buy_timestamp),
                "sell_timestamp": serialize_timestamp(opp.sell_timestamp),
                "uniswap_price": opp.uniswap_price,
                "binance_price": opp.binance_price,
                "price_diff_percent": opp.price_diff_percent,
                "profit": opp.profit,
                "profit_rate": (opp.profit_rate or 0.0) * 100,
                "direction": opp.direction or "unknown",
            }
        )

    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    return {
        "behaviors": data,
        "total_pages": total_pages,
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@app.get("/api/arbitrage/opportunities")
def get_arbitrage_opportunities(
    min_profit_rate: Optional[float] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Signature: `GET /api/arbitrage/opportunities`

    Description:
    获取预计算的套利机会列表（按分钟），支持最小利润率过滤和时间范围筛选。
    这些机会表示在某个时间点，用户如果进行套利交易可能获得的利润。
    """
    query = db.query(models.ArbitrageOpportunityMinute)
    
    # 时间范围筛选
    if start_time:
        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            query = query.filter(models.ArbitrageOpportunityMinute.timestamp >= start_dt)
        except ValueError:
            return {"error": "start_time 格式错误，请使用 ISO 8601 格式（如 2025-09-01T12:00:00Z）"}
    
    if end_time:
        try:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            query = query.filter(models.ArbitrageOpportunityMinute.timestamp <= end_dt)
        except ValueError:
            return {"error": "end_time 格式错误，请使用 ISO 8601 格式（如 2025-09-01T12:00:00Z）"}
    
    # 最小利润率筛选
    if min_profit_rate is not None:
        query = query.filter(models.ArbitrageOpportunityMinute.profit_rate >= min_profit_rate)
    
    # 按时间倒序排列（最新的在前）
    opportunities = query.order_by(models.ArbitrageOpportunityMinute.timestamp.desc()).all()
    
    def serialize_timestamp(dt: Optional[datetime]) -> Optional[str]:
        if not dt:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")
    
    data = []
    for opp in opportunities:
        data.append(
            {
                "id": opp.id,
                "timestamp": serialize_timestamp(opp.timestamp),
                "uniswap_price": opp.uniswap_price,
                "binance_price": opp.binance_price,
                "price_diff_percent": opp.price_diff_percent,
                "profit": opp.profit,
                "profit_rate": (opp.profit_rate or 0.0) * 100,  # 转换为百分比
                "direction": opp.direction or "unknown",
            }
        )
    
    return {
        "opportunities": data,
    }
