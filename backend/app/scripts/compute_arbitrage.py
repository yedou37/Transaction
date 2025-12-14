#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用数据库中的 Uniswap/Binance 原始数据计算非原子套利候选对，
并将结果写入 arbitrage_opportunities 表，供 API 直接查询。
"""
from __future__ import annotations

from bisect import bisect_left, bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Tuple, Union, Optional, Dict, Set

from sqlalchemy.orm import Session

from ..database import SessionLocal, engine
from .. import models

# ========== 可调参数 ==========
PAIR_TIME_WINDOW_SEC: int = 300
MIN_REL_SPREAD: float = 0.01
MAX_GAS_FOR_SIMPLE_SWAP: int = 400000  # Heuristic 1 (第二组): gas限制

# 手续费和滑点参数（与 compute_opportunities.py 保持一致）
CEX_FEE_RATE = 0.001  # CEX 手续费率 0.1%
CEX_SLIPPAGE = 0.001  # CEX 滑点 0.1%
DEX_FEE_RATE = 0.003  # DEX 手续费率 0.3%
DEX_SLIPPAGE = 0.002  # DEX 滑点 0.2%

# ========== 已知路由器/交易机器人地址列表 ==========
# Heuristic 5: 非已知路由器/交易机器人
# 注意：地址已转换为小写以便比较
KNOWN_ROUTERS: Set[str] = {
    # Uniswap Routers
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # Uniswap V2 Router 2
    "0xf164fc0ec4e93095b804a4795bbe1e041497b92a",  # Uniswap V2 Router (旧版)
    "0xe592427a0aece92de3edee1f18e0157c05861564",  # Uniswap V3 SwapRouter
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",  # Uniswap V3 SwapRouter02
    "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f",  # Uniswap V2 Factory
    # 1inch Routers (多个版本)
    "0x1111111254eeb25477b68fb85ed929f73a960582",  # 1inch Router V4
    "0x11111112542d85b3ef69ae05771c2dccff4faa26",  # 1inch Router V3
    "0x1111111254fb6c44bac0bed2854e76f90643097d",  # 1inch Router V2
    "0x111111125421ca6dc452d289314280a0f8842a65",  # 1inch Router V6
    # 0x Protocol
    "0xdef1c0ded9bec7f1a1670819833240f027b25eff",  # 0x Exchange Proxy (V4)
    # Paraswap
    "0xdef171fe48cf0115b1d80b88dc8eab59176fee57",  # Paraswap Augustus Swapper
    "0x880a845a85f843a5c67db2061623c6fc3bfb1f36",  # Paraswap Augustus Swapper V5
    # Cow Protocol
    "0x9008d19f58aabd9ed0d60971565aa8510560ab41",  # CoW Protocol Settlement
    "0x3328f5f2cecaf00a2443082b657cedeaf70bfae1",  # CoW Protocol GPv2Settlement
    # SushiSwap
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",  # SushiSwap Router
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # SushiSwap Router (复用Uniswap V2)
    # Matcha / 0x API
    "0x617dee16b86534a5d792a4d7a62fbcb1e6b8e2e4",  # Matcha Aggregator
    # Curve
    "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1",  # Curve Router
    # Balancer
    "0xba12222222228d8ba445958a75a0704d566bf2c8",  # Balancer Vault
    # Kyber Network
    "0xdf1ec4e6182ef4b5d12b8f1c91b9b6b9e81c5e5e",  # KyberSwap Router
    # Bancor
    "0x2f9ec37d6ccfff0cab22e3b4e403fa9a05edb2ef",  # Bancor Network
}

KNOWN_BOTS: Set[str] = {
    "0x0000000000000000000000000000000000000000",  # 零地址（某些MEV交易使用）
}


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
        return DEX_FEE_RATE

    @property
    def slippage(self) -> float:
        return DEX_SLIPPAGE


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
        return CEX_FEE_RATE

    @property
    def slippage(self) -> float:
        return CEX_SLIPPAGE


def to_unix(dt: datetime) -> int:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def from_unix(ts: int) -> datetime:
    return datetime.fromtimestamp(ts, tz=timezone.utc)

def load_uniswap_swaps(session: Session) -> List[UniswapSwapData]:
    """加载所有Uniswap swap数据，包含完整字段用于启发式过滤"""
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


def load_uniswap_swaps_with_metadata(session: Session) -> List[Tuple[UniswapSwapData, Dict]]:
    """加载Uniswap swap数据及其元数据（用于启发式过滤）"""
    swaps_with_meta = []
    for row in session.query(models.UniswapSwap).order_by(
        models.UniswapSwap.block_number.asc(),
        models.UniswapSwap.transaction_index.asc(),
        models.UniswapSwap.log_index.asc()
    ):
        swap_data = UniswapSwapData(
            id=row.id,
            transaction_hash=row.transaction_hash or "",
            log_index=row.log_index or 0,
            timestamp=to_unix(row.timestamp),
            amount0=float(row.amount0 or 0.0),
            amount1=float(row.amount1 or 0.0),
            price=float(row.price or 0.0),
        )
        metadata = {
            "block_number": row.block_number,
            "transaction_index": row.transaction_index or 0,
            "sender": row.sender,
            "recipient": row.recipient,
            "gas_used": float(row.gas_used) if row.gas_used else None,
        }
        swaps_with_meta.append((swap_data, metadata))
    return swaps_with_meta


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


# ========== 启发式过滤函数 ==========

def filter_known_routers_and_bots(
    swaps_with_meta: List[Tuple[UniswapSwapData, Dict]]
) -> List[Tuple[UniswapSwapData, Dict]]:
    """
    Heuristic 5: 排除已知路由器/交易机器人
    检查 sender 或 recipient 是否在已知列表中
    """
    filtered = []
    excluded_count = 0
    
    for swap_data, metadata in swaps_with_meta:
        sender = metadata.get("sender", "").lower() if metadata.get("sender") else ""
        recipient = metadata.get("recipient", "").lower() if metadata.get("recipient") else ""
        
        # 检查是否匹配已知路由器或机器人（地址已统一为小写）
        is_known = (
            sender in (KNOWN_ROUTERS | KNOWN_BOTS) or
            recipient in (KNOWN_ROUTERS | KNOWN_BOTS)
        )
        
        if not is_known:
            filtered.append((swap_data, metadata))
        else:
            excluded_count += 1
    
    if excluded_count > 0:
        print(f"[Heuristic 5] 已排除 {excluded_count} 个来自已知路由器/机器人的swap")
    
    return filtered


def filter_simple_swaps(
    swaps_with_meta: List[Tuple[UniswapSwapData, Dict]]
) -> List[Tuple[UniswapSwapData, Dict]]:
    """
    Heuristic 1 (第二组): 简单swap检查
    1. 每个交易只有一个swap（单swap）
    2. gas_used <= 400000
    注意：忽略MEV标签检查（因为无法获取相关信息）
    """
    # 统计每个交易的swap数量
    tx_swap_counts: Dict[str, int] = defaultdict(int)
    for swap_data, _ in swaps_with_meta:
        tx_swap_counts[swap_data.transaction_hash] += 1
    
    # 过滤：只保留单swap的交易
    single_swap_txs = {tx_hash for tx_hash, count in tx_swap_counts.items() if count == 1}
    
    filtered = []
    excluded_single = 0
    excluded_gas = 0
    
    for swap_data, metadata in swaps_with_meta:
        # 检查是否为单swap交易
        if swap_data.transaction_hash not in single_swap_txs:
            excluded_single += 1
            continue
        
        # 检查gas限制
        gas_used = metadata.get("gas_used")
        if gas_used is None or gas_used > MAX_GAS_FOR_SIMPLE_SWAP:
            excluded_gas += 1
            continue
        
        filtered.append((swap_data, metadata))
    
    if excluded_single > 0:
        print(f"[Heuristic 1] 已排除 {excluded_single} 个多swap交易")
    if excluded_gas > 0:
        print(f"[Heuristic 1] 已排除 {excluded_gas} 个gas超过限制的交易")
    
    return filtered


def filter_first_swap_or_same_recipient(
    swaps_with_meta: List[Tuple[UniswapSwapData, Dict]]
) -> List[Tuple[UniswapSwapData, Dict]]:
    """
    Heuristic 4 (第二组): 第一个swap或前置交易相同接收者
    1. 检查是否为区块内该方向的第一个swap
    2. 如果不是第一个，检查所有前置交易的recipient是否相同
    """
    # 按区块和方向组织数据
    block_direction_swaps: Dict[Tuple[int, str], List[Tuple[UniswapSwapData, Dict]]] = defaultdict(list)
    
    for swap_data, metadata in swaps_with_meta:
        block_number = metadata.get("block_number")
        direction = swap_data.direction
        if block_number is not None:
            block_direction_swaps[(block_number, direction)].append((swap_data, metadata))
    
    filtered = []
    excluded_count = 0
    
    for (block_number, direction), swaps_in_block in block_direction_swaps.items():
        # 按 transaction_index 和 log_index 排序
        swaps_in_block.sort(
            key=lambda x: (
                x[1].get("transaction_index", 0),
                x[0].log_index
            )
        )
        
        # 记录每个位置的recipient集合
        recipient_sets: Dict[int, Set[str]] = {}
        
        for idx, (swap_data, metadata) in enumerate(swaps_in_block):
            recipient = metadata.get("recipient", "")
            
            if idx == 0:
                # 第一个swap，直接通过
                filtered.append((swap_data, metadata))
                recipient_sets[0] = {recipient} if recipient else set()
            else:
                # 检查所有前置交易的recipient是否相同
                prev_recipients = set()
                for prev_idx in range(idx):
                    prev_recipients.update(recipient_sets.get(prev_idx, set()))
                
                # 如果前置交易只有一个唯一的recipient，或者当前recipient与前置相同
                if len(prev_recipients) <= 1:
                    if not prev_recipients or (recipient and recipient in prev_recipients):
                        filtered.append((swap_data, metadata))
                        recipient_sets[idx] = prev_recipients | ({recipient} if recipient else set())
                    else:
                        excluded_count += 1
                else:
                    excluded_count += 1
    
    if excluded_count > 0:
        print(f"[Heuristic 4] 已排除 {excluded_count} 个不符合第一个swap或相同接收者条件的swap")
    
    return filtered


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
        
        # 确定套利方向
        # 如果 buy_leg 是 dex，则买入在 DEX，卖出在 CEX，方向是 dex->cex
        # 如果 buy_leg 是 cex，则买入在 CEX，卖出在 DEX，方向是 cex->dex
        # 根据 compute_profit_metrics 的逻辑：
        # - 如果 dex.direction == "buy" and cex.direction == "sell"，则 buy_leg=dex, sell_leg=cex，方向是 dex->cex
        # - 如果 dex.direction == "sell" and cex.direction == "buy"，则 buy_leg=cex, sell_leg=dex，方向是 cex->dex
        if dex.direction == "buy" and cex.direction == "sell":
            direction = "dex->cex"
        elif dex.direction == "sell" and cex.direction == "buy":
            direction = "cex->dex"
        else:
            direction = "unknown"
        
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
                direction=direction,
            )
        )
    session.bulk_save_objects(opportunities)
    session.commit()
    return len(opportunities)


def main():
    models.Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        print("=" * 60)
        print("开始计算非原子套利机会")
        print("=" * 60)
        
        # 加载原始数据（包含元数据用于启发式过滤）
        print("\n[1/5] 加载Uniswap swap数据...")
        swaps_with_meta = load_uniswap_swaps_with_metadata(session)
        print(f"  加载了 {len(swaps_with_meta)} 个swap记录")
        
        # 应用启发式过滤
        print("\n[2/5] 应用启发式过滤...")
        
        # Heuristic 5: 排除已知路由器/交易机器人
        swaps_with_meta = filter_known_routers_and_bots(swaps_with_meta)
        print(f"  过滤后剩余 {len(swaps_with_meta)} 个swap")
        
        # Heuristic 1 (第二组): 简单swap检查（单swap + gas限制）
        swaps_with_meta = filter_simple_swaps(swaps_with_meta)
        print(f"  过滤后剩余 {len(swaps_with_meta)} 个swap")
        
        # Heuristic 4 (第二组): 第一个swap或前置交易相同接收者
        swaps_with_meta = filter_first_swap_or_same_recipient(swaps_with_meta)
        print(f"  过滤后剩余 {len(swaps_with_meta)} 个swap")
        
        # 提取过滤后的swap数据
        print("\n[3/5] 准备套利匹配...")
        dex_trades = [swap_data for swap_data, _ in swaps_with_meta]
        print(f"  将使用 {len(dex_trades)} 个过滤后的Uniswap swap进行匹配")
        
        # 加载Binance数据
        print("\n[4/5] 加载Binance交易数据...")
        cex_trades = load_binance_trades(session)
        print(f"  加载了 {len(cex_trades)} 个Binance交易记录")
        
        # 计算套利候选对
        print("\n[5/5] 计算套利候选对...")
        pairs = pair_candidates(dex_trades, cex_trades)
        print(f"  找到 {len(pairs)} 个套利候选对")
        
        # 存储结果
        count = store_opportunities(session, pairs)
        print(f"\n已写入 {count} 条套利候选记录。")
        print("=" * 60)
        print("计算完成")
        print("=" * 60)
    finally:
        session.close()


if __name__ == "__main__":
    main()

