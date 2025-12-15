import os
import sys
import requests
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine, func, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import ssl
from requests.adapters import HTTPAdapter
from typing import Optional

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
BINANCE_API_URL = os.getenv("BINANCE_API_URL", "https://api.binance.com/api/v3/klines")
BINANCE_FALLBACK_API_URL = os.getenv(
    "BINANCE_FALLBACK_API_URL", "https://data-api.binance.vision/api/v3/klines"
)
ETHERSCAN_API_URL = os.getenv("ETHERSCAN_API_URL", "https://api.etherscan.io/v2/api")
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY")
UNISWAP_POOL_ADDRESS = "0x11b815efB8f581194ae79006d24E0d814B7697F6"

# --- 默认起始时间（数据库为空时使用） ---
DEFAULT_START_TIMESTAMP = int(datetime(2025, 9, 1, tzinfo=timezone.utc).timestamp())

# --- 常量 ---
USDC_DECIMALS = 6
WETH_DECIMALS = 18
UNISWAP_SWAP_TOPIC = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
BLOCK_CHUNK_SIZE = 5000  # Etherscan 对区块范围有隐式限制
UNISWAP_FEE_RATE = 0.0005  # 0.05% fee tier for the tracked pool
WEI_IN_ETH = 10 ** 18
UNISWAP_SCHEMA_UPDATES = [
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS block_number BIGINT",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66)",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS transaction_index INTEGER",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS sender VARCHAR(66)",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS recipient VARCHAR(66)",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS sqrt_price_x96 NUMERIC",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS liquidity NUMERIC",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS tick INTEGER",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS gas_price_wei NUMERIC",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS gas_used NUMERIC",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS gas_fee_eth DOUBLE PRECISION",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS fee_amount DOUBLE PRECISION",
    "ALTER TABLE uniswap_swaps ADD COLUMN IF NOT EXISTS slippage_bps DOUBLE PRECISION"
]
BINANCE_SCHEMA_UPDATES = [
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS open_time TIMESTAMPTZ",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS open_price DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS high_price DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS low_price DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS close_price DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS quote_volume DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS number_of_trades BIGINT",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS taker_buy_base_volume DOUBLE PRECISION",
    "ALTER TABLE binance_trades ADD COLUMN IF NOT EXISTS taker_buy_quote_volume DOUBLE PRECISION"
]


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


def hex_to_int(value: str) -> int:
    """安全地将十六进制字符串转换为整数"""
    if value.startswith("0x"):
        value = value[2:]
    if not value:
        return 0
    return int(value, 16)


def topic_to_address(topic_hex: str) -> Optional[str]:
    """将 log topic 转换为以太坊地址"""
    if not topic_hex:
        return None
    pure = topic_hex[2:] if topic_hex.startswith("0x") else topic_hex
    if len(pure) < 40:
        return None
    return "0x" + pure[-40:]


def calculate_pool_price_from_sqrt(sqrt_price_x96: int) -> Optional[float]:
    """根据 sqrtPriceX96 计算 token1/token0 的价格"""
    if sqrt_price_x96 <= 0:
        return None
    ratio = sqrt_price_x96 / (1 << 96)
    return ratio * ratio


def calculate_slippage_bps(trade_price: float, pool_price: Optional[float]) -> Optional[float]:
    """计算基于交易价与池子价格的滑点（基点）"""
    if trade_price <= 0 or not pool_price or pool_price <= 0:
        return None
    return (trade_price / pool_price - 1.0) * 10000


def parse_uniswap_swap_data(log_data: str) -> Optional[dict]:
    """
    解析 Uniswap Swap 事件数据
    
    Args:
        log_data: 十六进制格式的事件数据（去除 0x 前缀）
    
    Returns:
        包含 amount0, amount1, price, sqrtPriceX96, liquidity, tick 等字段的字典
    """
    if len(log_data) < 64 * 5:
        return None

    words = [log_data[i:i+64] for i in range(0, len(log_data), 64)]
    if len(words) < 5:
        return None

    amount0_hex = words[0]
    amount1_hex = words[1]
    sqrt_price_hex = words[2]
    liquidity_hex = words[3]
    tick_hex = words[4]

    try:
        amount0_int = int(amount0_hex, 16)
        amount1_int = int(amount1_hex, 16)
        sqrt_price_x96 = int(sqrt_price_hex, 16)
        liquidity = int(liquidity_hex, 16)
        tick = uint256_to_int256(int(tick_hex, 16))
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

    pool_price = calculate_pool_price_from_sqrt(sqrt_price_x96)
    slippage_bps = calculate_slippage_bps(price, pool_price)

    return {
        "amount0": amount0,
        "amount1": amount1,
        "price": price,
        "sqrt_price_x96": sqrt_price_x96,
        "liquidity": liquidity,
        "tick": tick,
        "pool_price": pool_price,
        "slippage_bps": slippage_bps,
    }


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


def get_latest_timestamp(session, model) -> Optional[datetime]:
    """返回指定模型的最新时间戳"""
    return session.query(func.max(model.timestamp)).scalar()


def ensure_utc(dt: datetime) -> datetime:
    """确保 datetime 带有 UTC 时区"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def current_utc_timestamp() -> int:
    """返回当前 UTC 时间戳（秒）"""
    return int(datetime.now(timezone.utc).timestamp())


def ensure_schema_upgraded():
    """确保数据库包含扩展列"""
    statements = UNISWAP_SCHEMA_UPDATES + BINANCE_SCHEMA_UPDATES
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


# --- 数据获取函数 ---

def fetch_binance_data(db_session):
    """获取并存储币安 USDT/ETH 交易数据"""
    print("正在获取币安数据...")
    symbol = "ETHUSDT"
    interval = "1m"  # 1分钟 K 线
    limit = 1000  # API 单次请求限制
    interval_ms = 60 * 1000
    max_window_ms = limit * interval_ms  # 每次请求最多 1000 根 K 线
    current_window_ms = max_window_ms
    binance_api_url = BINANCE_API_URL
    fallback_available = (
        BINANCE_FALLBACK_API_URL and BINANCE_FALLBACK_API_URL != binance_api_url
    )

    latest_timestamp = get_latest_timestamp(db_session, BinanceTrade)
    if latest_timestamp:
        latest_timestamp = ensure_utc(latest_timestamp)
        start_time = int(latest_timestamp.timestamp() * 1000) + 1
        print(f"币安数据从数据库最新时间 {latest_timestamp} 之后开始")
    else:
        start_time = DEFAULT_START_TIMESTAMP * 1000
        print("币安数据库暂无记录，从默认起始时间获取")

    end_time = current_utc_timestamp() * 1000

    session = requests.Session()
    session.mount("https://", TLSv12HttpAdapter())
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; BinanceFetcher/1.0; +https://example.com)"
    })

    total_trades = 0
    consecutive_errors = 0

    while start_time < end_time:
        request_end_time = min(start_time + current_window_ms - 1, end_time)
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": start_time,
            "endTime": request_end_time,
            "limit": limit
        }
        
        try:
            response = session.get(binance_api_url, params=params, timeout=60)
            response.raise_for_status()
            klines = response.json()
            consecutive_errors = 0
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code if e.response else "unknown"
            body_preview = e.response.text[:200] if e.response else ""
            print(f"请求币安数据时发生 HTTP 错误 (状态 {status_code}): {e}")
            if body_preview:
                print(f"响应内容: {body_preview}")

            status_str = str(status_code)
            error_str = str(e)
            status_matches = status_code in (451, 403) or any(code in status_str for code in ("451", "403")) or any(code in error_str for code in ("451", "403"))

            if status_matches and fallback_available:
                print(f"主 Binance API 无法访问，切换到备用接口 {BINANCE_FALLBACK_API_URL}")
                binance_api_url = BINANCE_FALLBACK_API_URL
                fallback_available = False
                continue

            if status_code in (451, 429, 418, 403):
                consecutive_errors += 1
                current_window_ms = max(interval_ms, current_window_ms // 2)
                wait_time = min(30, 5 * consecutive_errors)
                print(f"遇到速率或访问限制，将时间窗口缩小至 {current_window_ms // 60000} 分钟，等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
                continue

            print("非可恢复错误，停止币安数据获取。")
            break
        except requests.exceptions.RequestException as e:
            consecutive_errors += 1
            wait_time = min(30, 5 * consecutive_errors)
            print(f"请求币安数据时发生网络错误: {e}，等待 {wait_time} 秒后重试...")
            time.sleep(wait_time)
            continue

        if not klines:
            if request_end_time >= end_time:
                print("未收到更多币安数据，任务结束。")
                break
            print("此时间窗口未返回数据，移动至下一个窗口。")
            start_time = request_end_time + 1
            continue

        batch_count = 0
        for kline in klines:
            open_time = datetime.fromtimestamp(kline[0] / 1000, tz=timezone.utc)
            close_time = datetime.fromtimestamp(kline[6] / 1000, tz=timezone.utc)
            open_price = float(kline[1])
            high_price = float(kline[2])
            low_price = float(kline[3])
            close_price = float(kline[4])
            base_volume = float(kline[5])
            quote_volume = float(kline[7])
            trades_count = int(kline[8])
            taker_buy_base_volume = float(kline[9])
            taker_buy_quote_volume = float(kline[10])

            # 检查数据是否已存在
            exists = db_session.query(BinanceTrade).filter_by(
                timestamp=open_time, 
                price=close_price
            ).first()
            
            if not exists:
                trade = BinanceTrade(
                    timestamp=open_time,
                    price=close_price,
                    quantity=base_volume,
                    open_time=open_time,
                    close_time=close_time,
                    open_price=open_price,
                    high_price=high_price,
                    low_price=low_price,
                    close_price=close_price,
                    quote_volume=quote_volume,
                    number_of_trades=trades_count,
                    taker_buy_base_volume=taker_buy_base_volume,
                    taker_buy_quote_volume=taker_buy_quote_volume
                )
                db_session.add(trade)
                batch_count += 1
        
        if batch_count > 0:
            db_session.commit()
            total_trades += batch_count
            print(f"已添加 {batch_count} 条币安交易记录，总计 {total_trades} 条")

        # 更新下一次请求的开始时间
        start_time = klines[-1][0] + 1
        current_window_ms = max_window_ms  # 恢复默认窗口大小
        print(f"已处理至：{datetime.fromtimestamp(start_time / 1000, tz=timezone.utc)}")
        time.sleep(0.5)  # 尊重 API 速率限制

    print(f"币安数据获取完成，共获取 {total_trades} 条交易记录。")


def fetch_uniswap_data(db_session):
    """获取并存储 Uniswap V3 Swap 事件数据"""
    print("正在获取 Uniswap 数据...")

    latest_timestamp = get_latest_timestamp(db_session, UniswapSwap)
    if latest_timestamp:
        latest_timestamp = ensure_utc(latest_timestamp)
        start_timestamp = int(latest_timestamp.timestamp()) + 1
        print(f"Uniswap 数据从数据库最新时间 {latest_timestamp} 之后开始")
    else:
        start_timestamp = DEFAULT_START_TIMESTAMP
        print("Uniswap 数据库暂无记录，从默认起始时间获取")

    end_timestamp = current_utc_timestamp()

    start_block = get_block_number_by_timestamp(start_timestamp, closest="after")
    end_block = get_block_number_by_timestamp(end_timestamp, closest="before")

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
                amount0 = parsed_data["amount0"]
                amount1 = parsed_data["amount1"]
                price = parsed_data["price"]
                sqrt_price_x96 = parsed_data["sqrt_price_x96"]
                liquidity = parsed_data["liquidity"]
                tick = parsed_data["tick"]
                slippage_bps = parsed_data.get("slippage_bps")
                
                tx_hash = log['transactionHash']
                log_index = int(log['logIndex'], 16)
                block_number = int(log['blockNumber'], 16)
                block_hash = log.get('blockHash')
                transaction_index = hex_to_int(log.get('transactionIndex', '0x0'))
                gas_price_wei = hex_to_int(log.get('gasPrice', '0x0'))
                gas_used = hex_to_int(log.get('gasUsed', '0x0'))
                gas_fee_eth = (
                    (gas_price_wei * gas_used) / WEI_IN_ETH if gas_price_wei and gas_used else None
                )
                fee_amount = abs(amount1) * UNISWAP_FEE_RATE
                topics = log.get('topics', [])
                sender = topic_to_address(topics[1]) if len(topics) > 1 else None
                recipient = topic_to_address(topics[2]) if len(topics) > 2 else None

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
                        price=price,
                        block_number=block_number,
                        block_hash=block_hash,
                        transaction_index=transaction_index,
                        sender=sender,
                        recipient=recipient,
                        sqrt_price_x96=sqrt_price_x96,
                        liquidity=liquidity,
                        tick=tick,
                        gas_price_wei=gas_price_wei,
                        gas_used=gas_used,
                        gas_fee_eth=gas_fee_eth,
                        fee_amount=fee_amount,
                        slippage_bps=slippage_bps
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
    ensure_schema_upgraded()
    
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
