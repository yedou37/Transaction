---

# Price Dashboard

## 响应定义

### 顶级结构

| 字段    | 类型           | 说明                 |
| ------- | -------------- | -------------------- |
| uniswap | `Array<OHLCV>` | Uniswap V3 逐日 K 线 |
| binance | `Array<OHLCV>` | Binance 逐日 K 线    |

### OHLCV 元素

| 字段      | 类型     | 说明                          | 示例                     |
| --------- | -------- | ----------------------------- | ------------------------ |
| timestamp | `string` | ISO-8601 格式，日级 00:00:00Z | `"2025-09-15T00:00:00Z"` |
| open      | `number` | 当日开盘价格 (USDT)           | `2501.40`                |
| high      | `number` | 当日最高价格                  | `2548.90`                |
| low       | `number` | 当日最低价格                  | `2487.20`                |
| close     | `number` | 当日收盘价格                  | `2520.00`                |
| volume    | `number` | 当日成交量 (ETH)              | `123.45`                 |

### 成功响应示例（200）

```json
{
  "uniswap": [
    {
      "timestamp": "2025-09-01T00:00:00Z",
      "open": 2501.4,
      "high": 2548.9,
      "low": 2487.2,
      "close": 2520.0,
      "volume": 123.45
    },
    ...
  ],
  "binance": [
    {
      "timestamp": "2025-09-01T00:00:00Z",
      "open": 2505.1,
      "high": 2555.0,
      "low": 2490.5,
      "close": 2524.8,
      "volume": 234.56
    },
    ...
  ]
}
```
