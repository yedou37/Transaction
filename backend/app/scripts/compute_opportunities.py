#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
按分钟计算套利机会并存储到 arbitrage_opportunities_minute 表
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date, extract

from ..database import SessionLocal, engine
from .. import models

# ========== 可调参数 ==========
CEX_FEE_RATE = 0.001  # CEX 手续费率 0.1%
CEX_SLIPPAGE = 0.001  # CEX 滑点 0.1%
DEX_FEE_RATE = 0.003  # DEX 手续费率 0.3%
DEX_SLIPPAGE = 0.002  # DEX 滑点 0.2%
MIN_PROFIT_RATE = 0.0  # 最小利润率阈值（小数，0.0 表示不限制）


def truncate_to_minute(dt: datetime) -> datetime:
    """将时间戳截断到分钟（秒和微秒设为0）"""
    return dt.replace(second=0, microsecond=0)


def compute_opportunity_for_minute(
    uniswap_avg_price: float,
    binance_avg_price: float,
    timestamp: datetime
) -> Optional[Tuple[str, float, float]]:
    """
    计算该分钟的套利机会
    
    Returns:
        (direction, profit, profit_rate) 或 None
    """
    if uniswap_avg_price <= 0 or binance_avg_price <= 0:
        return None
    
    # 计算两个方向的套利机会
    opportunities = []
    
    # 方向1: cex->dex (在 CEX 买入，在 DEX 卖出)
    buy_cost_cex = binance_avg_price * (1.0 + CEX_FEE_RATE + CEX_SLIPPAGE)
    sell_revenue_dex = uniswap_avg_price * (1.0 - DEX_FEE_RATE - DEX_SLIPPAGE)
    profit_cex_dex = sell_revenue_dex - buy_cost_cex
    profit_rate_cex_dex = (profit_cex_dex / buy_cost_cex) if buy_cost_cex > 0 else 0.0
    
    if profit_rate_cex_dex >= MIN_PROFIT_RATE:
        opportunities.append(("cex->dex", profit_cex_dex, profit_rate_cex_dex))
    
    # 方向2: dex->cex (在 DEX 买入，在 CEX 卖出)
    buy_cost_dex = uniswap_avg_price * (1.0 + DEX_FEE_RATE + DEX_SLIPPAGE)
    sell_revenue_cex = binance_avg_price * (1.0 - CEX_FEE_RATE - CEX_SLIPPAGE)
    profit_dex_cex = sell_revenue_cex - buy_cost_dex
    profit_rate_dex_cex = (profit_dex_cex / buy_cost_dex) if buy_cost_dex > 0 else 0.0
    
    if profit_rate_dex_cex >= MIN_PROFIT_RATE:
        opportunities.append(("dex->cex", profit_dex_cex, profit_rate_dex_cex))
    
    # 返回利润率最高的机会
    if not opportunities:
        return None
    
    # 选择利润率最高的方向
    best_opp = max(opportunities, key=lambda x: x[2])
    return best_opp


def compute_opportunities(session: Session, start_time: Optional[datetime] = None, end_time: Optional[datetime] = None):
    """
    计算套利机会并存储到数据库
    """
    print("=" * 60)
    print("开始计算套利机会（按分钟）")
    print("=" * 60)
    
    # 确定时间范围（全量计算，不从最新机会时间开始）
    if start_time is None:
        # 获取最早的数据时间
        earliest_uniswap = session.query(func.min(models.UniswapSwap.timestamp)).scalar()
        earliest_binance = session.query(func.min(models.BinanceTrade.timestamp)).scalar()
        if earliest_uniswap and earliest_binance:
            start_time = min(earliest_uniswap, earliest_binance)
            start_time = truncate_to_minute(start_time)
            print(f"从最早数据时间开始: {start_time}")
        else:
            print("数据库中没有数据，退出")
            return
    
    if end_time is None:
        # 获取最新的数据时间
        latest_uniswap = session.query(func.max(models.UniswapSwap.timestamp)).scalar()
        latest_binance = session.query(func.max(models.BinanceTrade.timestamp)).scalar()
        if latest_uniswap and latest_binance:
            end_time = max(latest_uniswap, latest_binance)
            end_time = truncate_to_minute(end_time)
            print(f"计算到最新数据时间: {end_time}")
        else:
            print("数据库中没有数据，退出")
            return
    
    print(f"\n时间范围: {start_time} -> {end_time}")
    
    # 按分钟分组计算 Uniswap 平均价格
    print("\n[1/3] 计算 Uniswap 每分钟平均价格...")
    uniswap_minute_prices = {}
    
    uniswap_data = (
        session.query(
            func.date_trunc('minute', models.UniswapSwap.timestamp).label('minute'),
            func.avg(models.UniswapSwap.price).label('avg_price'),
            func.count(models.UniswapSwap.id).label('trade_count')
        )
        .filter(
            models.UniswapSwap.timestamp >= start_time,
            models.UniswapSwap.timestamp <= end_time
        )
        .group_by(func.date_trunc('minute', models.UniswapSwap.timestamp))
        .all()
    )
    
    for row in uniswap_data:
        minute = row.minute
        if minute.tzinfo is None:
            minute = minute.replace(tzinfo=timezone.utc)
        uniswap_minute_prices[minute] = {
            'price': float(row.avg_price),
            'trade_count': int(row.trade_count)
        }
    
    print(f"  处理了 {len(uniswap_minute_prices)} 分钟的 Uniswap 数据")
    
    # 按分钟分组计算 Binance 平均价格
    print("\n[2/3] 计算 Binance 每分钟平均价格...")
    binance_minute_prices = {}
    
    binance_data = (
        session.query(
            func.date_trunc('minute', models.BinanceTrade.timestamp).label('minute'),
            func.avg(models.BinanceTrade.price).label('avg_price'),
            func.count(models.BinanceTrade.id).label('trade_count')
        )
        .filter(
            models.BinanceTrade.timestamp >= start_time,
            models.BinanceTrade.timestamp <= end_time
        )
        .group_by(func.date_trunc('minute', models.BinanceTrade.timestamp))
        .all()
    )
    
    for row in binance_data:
        minute = row.minute
        if minute.tzinfo is None:
            minute = minute.replace(tzinfo=timezone.utc)
        binance_minute_prices[minute] = {
            'price': float(row.avg_price),
            'trade_count': int(row.trade_count)
        }
    
    print(f"  处理了 {len(binance_minute_prices)} 分钟的 Binance 数据")
    
    # 计算套利机会
    print("\n[3/3] 计算套利机会...")
    opportunities = []
    all_minutes = set(uniswap_minute_prices.keys()) | set(binance_minute_prices.keys())
    
    for minute in sorted(all_minutes):
        uniswap_data = uniswap_minute_prices.get(minute)
        binance_data = binance_minute_prices.get(minute)
        
        # 需要两个市场都有数据才能计算
        if not uniswap_data or not binance_data:
            continue
        
        uniswap_price = uniswap_data['price']
        binance_price = binance_data['price']
        
        # 计算套利机会
        result = compute_opportunity_for_minute(uniswap_price, binance_price, minute)
        if result:
            direction, profit, profit_rate = result
            price_diff_percent = abs(uniswap_price - binance_price) / ((uniswap_price + binance_price) / 2) * 100
            
            opportunities.append(
                models.ArbitrageOpportunityMinute(
                    timestamp=minute,
                    uniswap_price=uniswap_price,
                    binance_price=binance_price,
                    price_diff_percent=price_diff_percent,
                    profit=profit,
                    profit_rate=profit_rate,
                    direction=direction,
                    uniswap_trade_count=uniswap_data['trade_count'],
                    binance_trade_count=binance_data['trade_count'],
                )
            )
    
    # 存储到数据库（全量计算，先清空表再插入）
    print(f"\n存储 {len(opportunities)} 条套利机会记录...")
    if opportunities:
        # 清空表（全量重新计算）
        session.query(models.ArbitrageOpportunityMinute).delete()
        print("  已清空旧数据")
        
        session.bulk_save_objects(opportunities)
        session.commit()
        print(f"已写入 {len(opportunities)} 条套利机会记录")
    else:
        print("没有找到套利机会")
    
    print("=" * 60)
    print("计算完成")
    print("=" * 60)


def main():
    """主函数"""
    models.Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        compute_opportunities(session)
    except Exception as e:
        print(f"发生错误: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    main()

