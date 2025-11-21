import os
import sys
import requests
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import ssl
from requests.adapters import HTTPAdapter
from typing import Optional, Tuple

# 将项目根目录添加到 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# --- 设置 ---
# 向上移动两级以加载项目根目录的 .env 文件
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- 数据库配置 ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL 环境变量未设置")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- 导入数据库模型 ---
from app.models import Base, UniswapSwap, BinanceTrade

# --- API 配置 ---
BINANCE_API_URL = "https://api.binance.com/api/v3/klines"
ETHERSCAN_API_URL = os.getenv("ETHERSCAN_API_URL", "https://api.etherscan.io/v2/api")
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
UNISWAP_POOL_ADDRESS = "0x11b815efB8f581194ae79006d24E0d814B7697F6"

# --- 时间范围 ---
START_TIMESTAMP = int(datetime(2025, 9, 1, tzinfo=timezone.utc).timestamp())
END_TIMESTAMP = int(datetime(2025, 9, 30, 23, 59, 59, tzinfo=timezone.utc).timestamp())

# --- 常量 ---
USDC_DECIMALS = 6
WETH_DECIMALS = 18
UNISWAP_SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
BLOCK_CHUNK_SIZE = 5000  # Etherscan 对区块范围有隐式限制


# --- 自定义 SSL 适配器 ---
class TLSv12HttpAdapter(HTTPAdapter):
    """自定义 HTTP 适配器，强制使用 TLSv1.2"""
    def init_poolmanager(self, connections, maxsize, block=False):
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        self.poolmanager = requests.packages.urllib3.poolmanager.PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            ssl_context=ctx
        )


# --- 工具函数 ---

def uint256_to_int256(value: int) -> int:
    """将 uint256 转换为有符号 int256"""
    if value >= 2**255:
        return value - 2**256
    return value


def parse_uniswap_swap_data(log_data: str) -> Optional[Tuple[float, float, float]]:
    """
    解析 Uniswap Swap 事件数据
    
    Args:
        log_data: 十六进制格式的事件数据（去除 0x 前缀）
    
    Returns:
        (amount0, amount1, price) 元组，如果解析失败返回 None
    """
    if len(log_data) < 128:
        return None
    
    amount0_hex = log_data[0:64]
    amount1_hex = log_data[64:128]
    
    try:
        amount0_int = int(amount0_hex, 16)
        amount1_int = int(amount1_hex, 16)
    except ValueError:
        return None
    
    # 转换为有符号整数
    amount0_int = uint256_to_int256(amount0_int)
    amount1_int = uint256_to_int256(amount1_int)
    
    # 转换为实际金额（考虑小数位）
    # 对于 USDC/WETH 池：amount0 是 USDC (6位小数)，amount1 是 WETH (18位小数)
    amount0 = amount0_int / (10 ** WETH_DECIMALS)  # WETH
    amount1 = amount1_int / (10 ** USDC_DECIMALS)  # USDC
    
    # 计算绝对值用于验证和价格计算
    abs_amount0 = abs(amount0)
    abs_amount1 = abs(amount1)
    
    # 避免除零错误
    if abs_amount0 < 1e-10:  # 避免除以接近0的值
        return None
    
    
    # 计算价格：USDC / WETH
    price = abs_amount1 / abs_amount0
    
    
    return (amount0, amount1, price)


def get_block_number_by_timestamp(timestamp: int, closest: str = "before") -> Optional[int]:
    """
    使用 Etherscan API 根据时间戳获取区块号
    
    Args:
        timestamp: Unix 时间戳
        closest: "before" 或 "after"
    
    Returns:
        区块号，如果失败返回 None
    """
    params = {
        "module": "block",
        "action": "getblocknobytime",
        "timestamp": str(timestamp),
        "closest": closest,
        "apikey": ETHERSCAN_API_KEY,
        "chainId": 1
    }
    
    for attempt in range(3):  # 重试3次
        try:
            response = requests.get(ETHERSCAN_API_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "1":
                return int(data["result"])
            else:
                print(f"获取区块号API错误: {data.get('message')} - {data.get('result')}")
        except requests.exceptions.RequestException as e:
            print(f"获取区块号时出错 (尝试 {attempt + 1}/3): {e}")
        
        if attempt < 2:  # 最后一次尝试不需要等待
            time.sleep(3)
    
    return None


# --- 数据获取函数 ---

def fetch_binance_data(db_session):
    """获取并存储币安 USDT/ETH 交易数据"""
    print("正在获取币安数据...")
    symbol = "ETHUSDT"
    interval = "1m"  # 1分钟 K 线
    limit = 1000  # API 单次请求限制

    # 将时间戳转换为毫秒
    start_time = START_TIMESTAMP * 1000
    end_time = END_TIMESTAMP * 1000

    session = requests.Session()
    session.mount("https://", TLSv12HttpAdapter())

    total_trades = 0
    
    while start_time < end_time:
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": start_time,
            "endTime": end_time,
            "limit": limit
        }
        
        try:
            response = session.get(BINANCE_API_URL, params=params, timeout=60)
            response.raise_for_status()
            klines = response.json()
        except requests.exceptions.RequestException as e:
            print(f"请求币安数据时发生错误: {e}")
            break

        if not klines:
            break

        batch_count = 0
        for kline in klines:
            trade_time = datetime.fromtimestamp(kline[0] / 1000, tz=timezone.utc)
            price = float(kline[4])  # 收盘价
            quantity = float(kline[5])  # 成交量

            # 检查数据是否已存在
            exists = db_session.query(BinanceTrade).filter_by(
                timestamp=trade_time, 
                price=price
            ).first()
            
            if not exists:
                trade = BinanceTrade(
                    timestamp=trade_time,
                    price=price,
                    quantity=quantity
                )
                db_session.add(trade)
                batch_count += 1
        
        if batch_count > 0:
            db_session.commit()
            total_trades += batch_count
            print(f"已添加 {batch_count} 条币安交易记录，总计 {total_trades} 条")

        # 更新下一次请求的开始时间
        start_time = klines[-1][0] + 1
        print(f"已处理至：{datetime.fromtimestamp(start_time / 1000, tz=timezone.utc)}")
        time.sleep(0.5)  # 尊重 API 速率限制

    print(f"币安数据获取完成，共获取 {total_trades} 条交易记录。")


def fetch_uniswap_data(db_session):
    """获取并存储 Uniswap V3 Swap 事件数据"""
    print("正在获取 Uniswap 数据...")

    start_block = get_block_number_by_timestamp(START_TIMESTAMP, closest="after")
    end_block = get_block_number_by_timestamp(END_TIMESTAMP, closest="before")

    if not start_block or not end_block:
        print("无法获取起始或结束区块号，正在退出。")
        return

    print(f"将从区块 {start_block} 获取到 {end_block}...")

    current_block = start_block
    total_swaps = 0

    while current_block <= end_block:
        chunk_end_block = min(current_block + BLOCK_CHUNK_SIZE - 1, end_block)
        print(f"正在处理区块范围: {current_block} -> {chunk_end_block}")

        params = {
            "module": "logs",
            "action": "getLogs",
            "address": UNISWAP_POOL_ADDRESS,
            "fromBlock": str(current_block),
            "toBlock": str(chunk_end_block),
            "topic0": UNISWAP_SWAP_TOPIC,
            "apikey": ETHERSCAN_API_KEY,
            "chainId": 1
        }

        try:
            response = requests.get(ETHERSCAN_API_URL, params=params, timeout=30)
            response.raise_for_status()
            response_data = response.json()

            if response_data.get("status") != "1":
                error_message = response_data.get("message", "Unknown error")
                result = response_data.get("result", "")
                print(f"Etherscan API 返回错误: {error_message} - {result}")
                
                if "rate limit" in error_message.lower():
                    print("达到速率限制，等待5秒...")
                    time.sleep(5)
                    continue
                else:
                    # 如果不是速率限制，可能是无效的区块范围或其他问题，前进到下一个 chunk
                    current_block += BLOCK_CHUNK_SIZE
                    time.sleep(1)
                    continue

            logs = response_data.get("result", [])

            if not logs:
                print("在此区块范围未找到日志。")
                current_block += BLOCK_CHUNK_SIZE
                time.sleep(0.2)
                continue

            batch_count = 0
            for log in logs:
                timestamp_val = int(log['timeStamp'], 16)
                timestamp = datetime.fromtimestamp(timestamp_val, tz=timezone.utc)

                # 解析事件数据
                log_data = log.get('data', '')
                if log_data.startswith('0x'):
                    log_data = log_data[2:]  # 移除 0x 前缀
                
                parsed_data = parse_uniswap_swap_data(log_data)
                if not parsed_data:
                    continue
                amount0, amount1, price = parsed_data
                
                tx_hash = log['transactionHash']
                log_index = int(log['logIndex'], 16)

                # 使用 tx_hash 和 log_index 确保唯一性
                exists = db_session.query(UniswapSwap).filter_by(
                    transaction_hash=tx_hash, 
                    log_index=log_index
                ).first()
                
                
                if not exists:
                    swap = UniswapSwap(
                        transaction_hash=tx_hash,
                        log_index=log_index,
                        timestamp=timestamp,
                        amount0=amount0,
                        amount1=amount1,
                        price=price
                    )
                    db_session.add(swap)
                    batch_count += 1
            
            if batch_count > 0:
                db_session.commit()
                total_swaps += batch_count
                print(f"已提交 {batch_count} 条 Swap 记录，总计 {total_swaps} 条")
            else:
                print(f"此区块范围无新数据")

        except requests.exceptions.RequestException as e:
            print(f"请求 Uniswap 数据时发生错误: {e}")
            db_session.rollback()
            time.sleep(5)
            continue

        current_block += BLOCK_CHUNK_SIZE
        time.sleep(0.2)  # 尊重 API 速率限制

    print(f"Uniswap 数据获取完成，共获取 {total_swaps} 条 Swap 记录。")


def main():
    """主函数，用于执行数据爬取和存储"""
    print("=" * 60)
    print("开始数据爬取任务")
    print("=" * 60)
    
    # 创建表（如果不存在）
    Base.metadata.create_all(bind=engine)
    
    db_session = SessionLocal()
    
    try:
        fetch_uniswap_data(db_session)
        fetch_binance_data(db_session)
        print("=" * 60)
        print("数据爬取任务完成")
        print("=" * 60)
    except Exception as e:
        print(f"发生错误: {e}")
        import traceback
        traceback.print_exc()
        db_session.rollback()
    finally:
        db_session.close()
        print("数据库会话已关闭。")


if __name__ == "__main__":
    main()
