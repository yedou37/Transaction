# ⛓️ 非原子区块链交易识别网站 (Non-Atomic Blockchain Transaction Identification Website)

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)![Nginx](https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)

## 📄 项目简介

本项目是一个用于识别和分析不同区块链平台间套利机会的网站。系统通过收集并分析来自 **Uniswap V3** 和 **Binance** 等平台的交易数据，识别潜在的套利机会，并提供一个可视化分析界面。

## 🏗️ 技术架构

本项目采用微服务架构，主要包含以下组件：

- **前端 (Frontend)** 🖥️: 使用 **React** 构建，提供用户界面及数据可视化。
- **后端 (Backend)** ⚙️: 使用 **FastAPI** 提供 RESTful API 接口。
- **数据库 (Database)** 🐘: 采用 **PostgreSQL** 作为关系型数据库，用于存储交易和套利数据。
- **反向代理 (Reverse Proxy)** 🌐: 使用 **Nginx** 作为反向代理，负责请求路由。
- **数据获取 (Data Fetching)** 🐍: 使用 **Python** 脚本，用于定期从各平台 API 获取数据。

服务间的关系如下：

```
用户浏览器 → Nginx → React前端 → FastAPI后端 ↔ PostgreSQL数据库
                        ↓
                   Python数据脚本
```

## 🚀 快速开始

### 🐳 使用 Docker Compose 运行 (推荐)

请确保本地环境已安装 [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)。

1.  **配置环境变量**

    在项目根目录创建 `.env` 文件，并写入以下内容：

    ```env
    # 数据库配置
    POSTGRES_USER=postgres
    POSTGRES_PASSWORD=password
    POSTGRES_DB=arbitrage_db
    DATABASE_URL=postgresql://postgres:password@db:5432/arbitrage_db

    # 第三方服务 API
    ETHERSCAN_API_KEY=your_etherscan_api_key
    BINANCE_API_URL=https://api.binance.com/api/v3/klines
    ```

2.  **构建并启动服务**

    在项目根目录执行以下命令：

    ```bash
    docker-compose up --build
    ```

3.  **访问应用**
    - **网站**: http://127.0.0.1
    - **API 文档**: http://127.0.0.1/docs

### 🛑 停止服务

执行以下命令可停止所有服务：

```bash
docker-compose down
```

如需清除 Docker 数据卷（**警告：此操作将永久删除数据库数据**），请执行以下命令：

```bash
docker-compose down -v
```

## 📂 项目结构

```
Transaction/
├── backend/                 # 后端服务 (FastAPI)
│   ├── app/                 # 应用代码
│   │   ├── scripts/         # 数据获取脚本
│   │   ├── __init__.py
│   │   ├── database.py      # 数据库配置
│   │   ├── main.py          # 主应用文件
│   │   └── models.py        # 数据模型
│   ├── Dockerfile
│   └── requirements.txt     # Python依赖
├── frontend/                # 前端应用 (React)
│   ├── public/
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面组件
│   │   └── utils/           # 工具函数
│   ├── Dockerfile
│   └── package.json         # npm依赖
├── nginx/                   # Nginx配置
│   ├── Dockerfile
│   └── default.conf
├── docker-compose.yml       # Docker编排配置
├── .env                     # 环境变量配置
└── README.md
```

## 🧩 功能模块

### 前端页面

- **价格仪表板 (PriceDashboard.js)** 📊: 显示来自多个平台的价格数据，提供 K 线图进行可视化。
- **套利分析 (ArbitrageAnalysis.js)** 📈: 展示已识别的套利机会及其详细信息。
- **信息页面 (Info.js)** ℹ️: 提供项目相关信息与说明。

### 后端 API

后端提供以下主要 API 端点：

- `GET /api/price-data`: 获取价格数据用于图表展示。
- `GET /api/arbitrage/statistics`: 获取套利机会的统计信息。
- `GET /api/arbitrage/opportunities`: 获取套利机会列表，支持分页和筛选。
- `GET /api/health`: 服务健康检查。
- `GET /api/db-check`: 数据库连接检查。

详细的 API 文档可在服务启动后访问 http://127.0.0.1/docs 查看。

## 👨‍💻 开发指南

### 前端开发

前端代码位于 `frontend/` 目录。

1.  **安装依赖**:

    ```bash
    cd frontend
    npm install
    ```

2.  **启动开发服务器**:
    ```bash
    npm start
    ```
    应用将在 http://localhost:3000 上运行。

### 后端开发

后端代码位于 `backend/` 目录。

1.  **安装依赖**:

    ```bash
    cd backend
    pip install -r requirements.txt
    ```

2.  **启动开发服务器**:
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
    API 文档可在 http://localhost:8000/docs 查看。

### 数据库操作

在使用 Docker Compose 运行时，可以通过以下命令访问数据库容器：

```bash
docker-compose exec db psql -U postgres -d arbitrage_db
```
