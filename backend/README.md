# 后端运行指南

本文档说明如何运行后端服务和数据库。

## 前置要求

- Python 3.10 或更高版本
- Docker 和 Docker Compose（推荐方式）
- PostgreSQL 15（如果本地运行）

## 方式一：使用 Docker Compose（推荐）

这是最简单的方式，会自动启动数据库和后端服务。

### 1. 配置环境变量

在项目根目录（`/home/water_tomato/Transaction`）创建 `.env` 文件：

```env
# PostgreSQL 数据库配置
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password_here
POSTGRES_DB=arbitrage_db

# 数据库连接 URL（用于后端应用）
DATABASE_URL=postgresql://postgres:your_password_here@db:5432/arbitrage_db
```

**注意**：请将 `your_password_here` 替换为你的实际密码。

### 2. 启动服务

在项目根目录运行：

```bash
docker-compose up -d
```

这个命令会：
- 启动 PostgreSQL 数据库容器
- 启动 FastAPI 后端容器
- 自动创建数据库表（如果不存在）

### 3. 查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看后端日志
docker-compose logs -f backend

# 只查看数据库日志
docker-compose logs -f db
```

### 4. 停止服务

```bash
docker-compose down
```

如果需要同时删除数据卷（会清空数据库数据）：

```bash
docker-compose down -v
```

### 5. 验证服务

- **后端健康检查**：访问 http://localhost:8000/api/health
- **数据库连接检查**：访问 http://localhost:8000/api/db-check
- **API 文档**：访问 http://localhost:8000/docs（Swagger UI）

## 方式二：本地开发运行（不使用 Docker）

如果你不想使用 Docker，可以本地运行数据库和后端。

### 1. 安装 PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

### 2. 创建数据库

```bash
# 登录 PostgreSQL
sudo -u postgres psql

# 创建数据库和用户
CREATE DATABASE arbitrage_db;
CREATE USER postgres_test WITH PASSWORD 'test_password';
ALTER ROLE postgres_test SET client_encoding TO 'utf8';
ALTER ROLE postgres_test SET default_transaction_isolation TO 'read committed';
ALTER ROLE postgres_test SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE arbitrage_db TO postgres_test;

# 授予用户在 public schema 中创建表的权限（重要！）
\c arbitrage_db
GRANT ALL ON SCHEMA public TO postgres_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres_test;
\q
```

### 3. 配置环境变量

在 `backend` 目录创建 `.env` 文件：

```env
DATABASE_URL=postgresql://postgres:your_password_here@localhost:5432/arbitrage_db
```

### 4. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
```

### 5. 运行后端服务

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

`--reload` 参数启用热重载，代码修改后会自动重启。

### 6. 验证服务

- **后端健康检查**：访问 http://localhost:8000/api/health
- **数据库连接检查**：访问 http://localhost:8000/api/db-check
- **API 文档**：访问 http://localhost:8000/docs

## 数据库管理

### 使用 Docker Compose 时

```bash
# 进入数据库容器
docker-compose exec db psql -U postgres -d arbitrage_db

# 查看所有表
\dt

# 退出
\q
```

### 本地运行时

```bash
# 连接数据库
psql -U postgres -d arbitrage_db

# 查看所有表
\dt

# 退出
\q
```

## 常见问题

### 1. 数据库连接失败

- 检查 `.env` 文件中的 `DATABASE_URL` 是否正确
- 确认数据库服务正在运行
- 检查防火墙设置

### 2. 端口被占用

如果 8000 端口被占用，可以修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8001:8000"  # 将 8001 映射到容器的 8000
```

### 3. 数据库表未创建

后端启动时会自动创建表。如果表不存在，可以手动触发：

```bash
# 进入后端容器
docker-compose exec backend python

# 在 Python 中执行
from app.database import engine
from app import models
models.Base.metadata.create_all(bind=engine)
```

### 4. 查看数据库数据

```bash
# 使用 Docker Compose
docker-compose exec db psql -U postgres -d arbitrage_db -c "SELECT * FROM uniswap_swaps LIMIT 10;"

# 本地运行
psql -U postgres -d arbitrage_db -c "SELECT * FROM uniswap_swaps LIMIT 10;"
```

## 开发建议

1. **使用 Docker Compose**：这是最简单的方式，确保环境一致性
2. **代码热重载**：Docker Compose 已配置代码挂载，修改代码后会自动重载
3. **查看日志**：使用 `docker-compose logs -f backend` 实时查看后端日志
4. **API 文档**：访问 `/docs` 查看交互式 API 文档，方便测试接口

## 项目结构

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI 应用主文件
│   ├── database.py      # 数据库连接配置
│   ├── models.py        # 数据库模型
│   └── scripts/         # 数据获取脚本
├── Dockerfile           # Docker 镜像配置
├── requirements.txt     # Python 依赖
└── README.md           # 本文件
```

## 下一步

- 查看 `BACKEND_API_REQUIREMENTS.md` 了解 API 需求
- 运行数据获取脚本填充数据库（如果存在）
- 访问 http://localhost:8000/docs 查看 API 文档

