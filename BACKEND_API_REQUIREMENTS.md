# 后端 API 需求文档 - 套利分析功能

本文档说明了套利分析功能所需的后端 API 端点。

## 概述

前端套利分析页面需要两个主要 API 端点：
1. **统计信息端点** - 获取套利分析的总体统计
2. **套利机会列表端点** - 获取具体的套利机会数据，支持分页和筛选

---

## 1. 统计信息 API

### 端点
```
GET /api/arbitrage/statistics
```

### 描述
返回套利分析的总体统计数据，包括：
- 识别到的套利机会总数
- 总潜在利润（USDT）
- 平均利润率（%）

### 请求参数
无

### 响应格式
```json
{
  "total_opportunities": 1523,
  "total_profit": 45678.90,
  "average_profit_rate": 2.35
}
```

### 响应字段说明
- `total_opportunities` (integer): 识别到的套利机会总数
- `total_profit` (float): 总潜在利润，单位为 USDT
- `average_profit_rate` (float): 平均利润率，单位为百分比（例如 2.35 表示 2.35%）

### 实现建议
```python
@app.get("/api/arbitrage/statistics")
def get_arbitrage_statistics(db: Session = Depends(get_db)):
    # 查询套利机会表，计算：
    # 1. 总数量
    # 2. 利润总和
    # 3. 平均利润率
    pass
```

---

## 2. 套利机会列表 API

### 端点
```
GET /api/arbitrage/opportunities
```

### 描述
返回套利机会的详细信息列表，支持分页和筛选。

### 请求参数（Query Parameters）

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|--------|------|------|------|------|
| `page` | integer | 是 | 页码，从 1 开始 | `1` |
| `page_size` | integer | 是 | 每页数量 | `10` |
| `min_profit` | float | 否 | 最小利润筛选（USDT） | `10.5` |
| `sort_by` | string | 否 | 排序字段：`profit` 或 `timestamp`，默认 `profit` | `profit` |
| `sort_order` | string | 否 | 排序顺序：`asc` 或 `desc`，默认 `desc` | `desc` |

### 响应格式
```json
{
  "opportunities": [
    {
      "id": 1,
      "transaction_hash": "0x1234567890abcdef...",
      "timestamp": "2025-09-15T10:30:00Z",
      "uniswap_price": 2850.50,
      "binance_price": 2845.30,
      "price_diff_percent": 0.18,
      "profit": 25.40,
      "profit_rate": 0.89,
      "volume": 10.5
    }
  ],
  "total_pages": 153,
  "current_page": 1,
  "page_size": 10,
  "total_count": 1523
}
```

### 响应字段说明

#### opportunities 数组中的对象字段：
- `id` (integer): 套利机会的唯一标识符
- `transaction_hash` (string): Uniswap 交易的哈希值
- `timestamp` (string): 交易时间，ISO 8601 格式
- `uniswap_price` (float): Uniswap V3 上的价格（USDT/ETH）
- `binance_price` (float): Binance 上的价格（USDT/ETH）
- `price_diff_percent` (float): 价格差异百分比
- `profit` (float): 潜在利润（USDT）
- `profit_rate` (float): 利润率（百分比，例如 0.89 表示 0.89%）
- `volume` (float): 交易量（ETH）

#### 分页信息：
- `total_pages` (integer): 总页数
- `current_page` (integer): 当前页码
- `page_size` (integer): 每页数量
- `total_count` (integer): 总记录数（可选）

### 实现建议
```python
@app.get("/api/arbitrage/opportunities")
def get_arbitrage_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    min_profit: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("profit", regex="^(profit|timestamp)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    # 1. 构建查询，根据筛选条件过滤
    # 2. 根据 sort_by 和 sort_order 排序
    # 3. 分页查询
    # 4. 返回结果和分页信息
    pass
```

---

## 3. 数据库模型需求

### 需要创建的套利机会表

建议在 `backend/app/models.py` 中添加以下模型：

```python
class ArbitrageOpportunity(Base):
    __tablename__ = "arbitrage_opportunities"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_hash = Column(String, index=True)  # Uniswap 交易哈希
    timestamp = Column(DateTime, index=True)  # 交易时间
    
    # 价格信息
    uniswap_price = Column(Float)  # Uniswap V3 价格 (USDT/ETH)
    binance_price = Column(Float)  # Binance 价格 (USDT/ETH)
    price_diff_percent = Column(Float)  # 价格差异百分比
    
    # 利润信息
    profit = Column(Float)  # 潜在利润 (USDT)
    profit_rate = Column(Float)  # 利润率 (%)
    
    # 交易信息
    volume = Column(Float)  # 交易量 (ETH)
    
    # 可选：关联到原始交易
    uniswap_swap_id = Column(Integer, ForeignKey("uniswap_swaps.id"), nullable=True)
    binance_trade_id = Column(BigInteger, ForeignKey("binance_trades.id"), nullable=True)
```

### 数据填充

需要实现套利识别算法，通过比较 Uniswap V3 和 Binance 的价格数据来识别套利机会：

1. **价格比较算法**：
   - 对于每个 Uniswap Swap 事件，查找时间窗口内（例如 ±5 分钟）的 Binance 交易
   - 计算价格差异
   - 如果价格差异超过阈值（例如 0.1%），则认为是套利机会

2. **利润计算**：
   - 根据价格差异和交易量计算潜在利润
   - 考虑交易费用（gas 费用、手续费等）

3. **数据同步**：
   - 可以批量处理历史数据
   - 或者实时监听新的交易并计算

---

## 4. 错误处理

所有 API 端点应返回标准的错误响应：

### 成功响应
- HTTP 200 OK
- 返回 JSON 数据

### 错误响应
```json
{
  "detail": "错误描述信息"
}
```

常见错误：
- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误

---

## 5. 实现优先级

1. **高优先级**：
   - [ ] 创建 `ArbitrageOpportunity` 数据库模型
   - [ ] 实现统计信息 API (`/api/arbitrage/statistics`)
   - [ ] 实现套利机会列表 API (`/api/arbitrage/opportunities`)

2. **中优先级**：
   - [ ] 实现套利识别算法
   - [ ] 填充历史数据

3. **低优先级**：
   - [ ] 添加缓存机制
   - [ ] 添加实时数据更新
   - [ ] 优化查询性能

---

## 6. 测试建议

### 单元测试
- 测试统计信息的计算准确性
- 测试分页逻辑
- 测试筛选和排序功能

### 集成测试
- 测试 API 端点与数据库的交互
- 测试错误处理

### 示例测试数据
可以使用模拟数据来测试前端功能：

```python
# 在数据库中插入测试数据
test_opportunities = [
    {
        "transaction_hash": "0x1234567890abcdef1234567890abcdef12345678",
        "timestamp": datetime.now(),
        "uniswap_price": 2850.50,
        "binance_price": 2845.30,
        "price_diff_percent": 0.18,
        "profit": 25.40,
        "profit_rate": 0.89,
        "volume": 10.5
    },
    # ... 更多测试数据
]
```

---

## 7. 注意事项

1. **性能优化**：
   - 对于大量数据，考虑添加数据库索引
   - 可以使用 Redis 缓存统计数据
   - 考虑使用数据库视图或物化视图

2. **数据一致性**：
   - 确保套利机会数据与原始交易数据一致
   - 考虑数据更新的时间窗口

3. **安全性**：
   - 验证所有输入参数
   - 防止 SQL 注入
   - 限制分页大小

4. **文档**：
   - FastAPI 会自动生成 API 文档（Swagger UI）
   - 访问 `/docs` 查看交互式 API 文档

---

## 8. 参考实现示例

```python
from fastapi import FastAPI, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from typing import Optional
from datetime import datetime
from .database import get_db
from .models import ArbitrageOpportunity

@app.get("/api/arbitrage/statistics")
def get_arbitrage_statistics(db: Session = Depends(get_db)):
    total_count = db.query(ArbitrageOpportunity).count()
    total_profit = db.query(func.sum(ArbitrageOpportunity.profit)).scalar() or 0
    avg_rate = db.query(func.avg(ArbitrageOpportunity.profit_rate)).scalar() or 0
    
    return {
        "total_opportunities": total_count,
        "total_profit": float(total_profit),
        "average_profit_rate": float(avg_rate)
    }

@app.get("/api/arbitrage/opportunities")
def get_arbitrage_opportunities(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    min_profit: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("profit", regex="^(profit|timestamp)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    # 构建查询
    query = db.query(ArbitrageOpportunity)
    
    # 应用筛选
    if min_profit is not None:
        query = query.filter(ArbitrageOpportunity.profit >= min_profit)
    
    # 应用排序
    sort_column = ArbitrageOpportunity.profit if sort_by == "profit" else ArbitrageOpportunity.timestamp
    if sort_order == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))
    
    # 计算总数
    total_count = query.count()
    total_pages = (total_count + page_size - 1) // page_size
    
    # 分页
    offset = (page - 1) * page_size
    opportunities = query.offset(offset).limit(page_size).all()
    
    # 转换为字典
    opportunities_data = [
        {
            "id": opp.id,
            "transaction_hash": opp.transaction_hash,
            "timestamp": opp.timestamp.isoformat() if opp.timestamp else None,
            "uniswap_price": opp.uniswap_price,
            "binance_price": opp.binance_price,
            "price_diff_percent": opp.price_diff_percent,
            "profit": opp.profit,
            "profit_rate": opp.profit_rate,
            "volume": opp.volume
        }
        for opp in opportunities
    ]
    
    return {
        "opportunities": opportunities_data,
        "total_pages": total_pages,
        "current_page": page,
        "page_size": page_size,
        "total_count": total_count
    }
```

---

## 总结

前端套利分析页面已经完成，需要后端实现以上两个 API 端点。建议按照以下步骤进行：

1. 创建数据库模型 `ArbitrageOpportunity`
2. 实现套利识别算法（或先使用测试数据）
3. 实现统计信息 API
4. 实现套利机会列表 API
5. 测试 API 与前端集成
6. 优化性能和添加缓存（可选）

如有任何问题，请参考 FastAPI 官方文档：https://fastapi.tiangolo.com/
