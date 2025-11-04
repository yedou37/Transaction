from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
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
        db.execute("SELECT 1")
        return {"db_status": "connected"}
    except Exception as e:
        return {"db_status": "error", "detail": str(e)}

# --- 未来的功能 ---
# 在这里你将添加你的核心功能 API 端点
# 例如:
# @app.get("/api/price-data")
# def get_price_data(start_date: str, end_date: str, db: Session = Depends(get_db)):
#     # ... 此处添加查询数据库的逻辑 ...
#     return {"uniswap": [...], "binance": [...]}
#
# @app.get("/api/arbitrage-analysis")
# def get_arbitrage_analysis(db: Session = Depends(get_db)):
#     # ... 此处添加分析套利机会的逻辑 ...
#     return {"opportunities": [...], "total_profit": 0.0}