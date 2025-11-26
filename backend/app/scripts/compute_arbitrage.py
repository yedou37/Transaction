#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用数据库中的 Uniswap/Binance 原始数据计算非原子套利候选对，
并将结果写入 arbitrage_opportunities 表，供 API 直接查询。
"""
from __future__ import annotations

from bisect import bisect_left, bisect_right
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Tuple, Union, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal, engine
from .. import models

# ========== 可调参数 ==========
PAIR_TIME_WINDOW_SEC: int = 300
MIN_REL_SPREAD: float = 0.01


@dataclass
class UniswapSwapData:
    id: int
    transaction_hash: str
    log_index: int
    timestamp: int
    amount0: float
    amount1: float
    price: float

    @property
    def direction(self) -> str:
        return "buy" if self.amount1 > 0 else "sell"

    @property
    def amount_base(self) -> float:
        return abs(self.amount1)

    @property
    def fee_rate(self) -> float:
        return 0.003

    @property
    def slippage(self) -> float:
        return 0.002


@dataclass
class BinanceTradeData:
    id: int
    timestamp: int
    price: float
    quantity: float
    direction: str = "buy"

    @property
    def amount_base(self) -> float:
        return self.quantity

    @property
    def fee_rate(self) -> float:
        return 0.001

    @property
    def slippage(self) -> float:
        return 0.001


def to_unix(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def from_unix(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, tz=timezone.utc)

def load_uniswap_swaps(session: Session) -> List[UniswapSwapData]:
    swaps = []
    for row in session.query(models.UniswapSwap).order_by(models.UniswapSwap.timestamp.asc()):
        swaps.append(
            UniswapSwapData(
                id=row.id,
                transaction_hash=row.transaction_hash or "",
                log_index=row.log_index or 0,
                timestamp=to_unix(row.timestamp),
                amount0=float(row.amount0 or 0.0),
                amount1=float(row.amount1 or 0.0),
                price=float(row.price or 0.0),
            )
        )
    return swaps


def load_binance_trades(session: Session) -> List[BinanceTradeData]:
    trades = []
    for row in session.query(models.BinanceTrade).order_by(models.BinanceTrade.timestamp.asc()):
        trades.append(
            BinanceTradeData(
                id=row.id,
                timestamp=to_unix(row.timestamp),
                price=float(row.price or 0.0),
                quantity=float(row.quantity or 0.0),
            )
        )
    return trades


def relative_spread(dex_price: float, cex_price: float) -> float:
    mid = 0.5 * (dex_price + cex_price)
    if mid <= 0:
        return 0.0
    return abs(dex_price - cex_price) / mid


TradeLeg = Union[UniswapSwapData, BinanceTradeData]


def compute_profit_metrics(
    dex: UniswapSwapData, cex: BinanceTradeData
) -> Tuple[float, float, float, Optional[TradeLeg], Optional[TradeLeg]]:
    matched_amount_base = max(0.0, min(dex.amount_base, cex.amount_base))
    if matched_amount_base <= 0:
        return 0.0, 0.0, 0.0, None, None

    if dex.direction == "buy" and cex.direction == "sell":
        buy_leg, sell_leg = dex, cex
    elif dex.direction == "sell" and cex.direction == "buy":
        buy_leg, sell_leg = cex, dex
    else:
        return 0.0, 0.0, 0.0, None, None

    unit_buy_cost = buy_leg.price * (
        1.0 + max(0.0, buy_leg.fee_rate) + max(0.0, buy_leg.slippage)
    )
    unit_sell_rev = sell_leg.price * (
        1.0 - max(0.0, sell_leg.fee_rate) - max(0.0, sell_leg.slippage)
    )
    buy_cost = matched_amount_base * unit_buy_cost
    sell_revenue = matched_amount_base * unit_sell_rev
    net_profit = sell_revenue - buy_cost
    profit_rate = (net_profit / buy_cost) if buy_cost > 0 else 0.0
    return net_profit, profit_rate, matched_amount_base, buy_leg, sell_leg


def pair_candidates(
    dex_trades: List[UniswapSwapData], cex_trades: List[BinanceTradeData]
) -> List[Tuple[UniswapSwapData, BinanceTradeData, float, float, float, int, int]]:
    result = []
    if not dex_trades or not cex_trades:
        return result

    cex_sorted = sorted(cex_trades, key=lambda t: t.timestamp)
    cex_timestamps = [trade.timestamp for trade in cex_sorted]
    total_dex = len(dex_trades)
    progress_interval = max(1, total_dex // 10)

    for idx, d in enumerate(dex_trades, 1):
        window_start = d.timestamp - PAIR_TIME_WINDOW_SEC
        window_end = d.timestamp + PAIR_TIME_WINDOW_SEC
        left = bisect_left(cex_timestamps, window_start)
        right = bisect_right(cex_timestamps, window_end)

        for c in cex_sorted[left:right]:
            original_direction = c.direction

            if d.direction == "buy" and c.price > d.price:
                c.direction = "sell"
            elif d.direction == "sell" and c.price < d.price:
                c.direction = "buy"
            else:
                continue

            rs = relative_spread(d.price, c.price)
            if rs < MIN_REL_SPREAD:
                c.direction = original_direction
                continue

            net_profit, pr, matched_amt, buy_leg, sell_leg = compute_profit_metrics(d, c)
            if not buy_leg or not sell_leg:
                c.direction = original_direction
                continue
            if net_profit <= 0 or matched_amt <= 0:
                c.direction = original_direction
                continue

            buy_ts = buy_leg.timestamp
            sell_ts = sell_leg.timestamp
            if buy_ts >= sell_ts:
                c.direction = original_direction
                continue

            result.append((d, c, rs, net_profit, pr, buy_ts, sell_ts))
            c.direction = original_direction

        if idx % progress_interval == 0 or idx == total_dex:
            print(
                f"[pair_candidates] processed {idx}/{total_dex} Uniswap swaps",
                flush=True,
            )
    result.sort(key=lambda x: x[2], reverse=True)
    return result


def store_opportunities(session: Session, pairs):
    session.query(models.ArbitrageOpportunity).delete()
    opportunities = []
    for dex, cex, rs, net_profit, profit_rate, buy_ts, sell_ts in pairs:
        buy_dt = from_unix(buy_ts)
        sell_dt = from_unix(sell_ts)
        avg_timestamp = min(buy_dt, sell_dt)
        opportunities.append(
            models.ArbitrageOpportunity(
                transaction_hash=dex.transaction_hash,
                uniswap_log_index=dex.log_index,
                binance_trade_id=cex.id,
                timestamp=avg_timestamp,
                buy_timestamp=buy_dt,
                sell_timestamp=sell_dt,
                uniswap_price=dex.price,
                binance_price=cex.price,
                price_diff_percent=rs * 100,
                profit=net_profit,
                profit_rate=profit_rate,
                volume=min(dex.amount_base, cex.amount_base),
                relative_spread=rs,
            )
        )
    session.bulk_save_objects(opportunities)
    session.commit()
    return len(opportunities)


def main():
    models.Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        dex_trades = load_uniswap_swaps(session)
        cex_trades = load_binance_trades(session)
        pairs = pair_candidates(dex_trades, cex_trades)
        count = store_opportunities(session, pairs)
        print(f"已写入 {count} 条套利候选记录。")
    finally:
        session.close()


if __name__ == "__main__":
    main()

