import React, { useEffect, useState } from "react";
import "./PriceDashboard.css";

function PriceDashboard() {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartView, setChartView] = useState("both"); // 'both', 'uniswap', 'binance'

  useEffect(() => {
    fetchData();
  }, []);

  // 生成模拟数据的函数
  const generateMockData = () => {
    const uniswapData = [];
    const binanceData = [];

    // 生成30天的数据
    for (let i = 1; i <= 30; i++) {
      const basePrice = 2500 + Math.sin(i * 0.5) * 50;

      // Uniswap数据
      uniswapData.push({
        timestamp: `2025-09-${i.toString().padStart(2, "0")}T12:00:00Z`,
        open: basePrice - Math.random() * 10,
        high: basePrice + Math.random() * 15,
        low: basePrice - Math.random() * 15,
        close: basePrice + Math.random() * 10,
        volume: Math.random() * 100,
      });

      // Binance数据 (与Uniswap略有不同，模拟价格差异)
      binanceData.push({
        timestamp: `2025-09-${i.toString().padStart(2, "0")}T12:00:00Z`,
        open: basePrice - Math.random() * 8 + 5,
        high: basePrice + Math.random() * 12 + 5,
        low: basePrice - Math.random() * 12 + 5,
        close: basePrice + Math.random() * 8 + 5,
        volume: Math.random() * 200,
      });
    }

    return {
      uniswap: uniswapData,
      binance: binanceData,
    };
  };

  // 修改：添加一个函数来获取数据（支持mock或后端）
  const fetchData = async () => {
    try {
      setLoading(true);

      // 检查是否应该使用后端API
      const useBackend = process.env.REACT_APP_USE_BACKEND === "true";

      if (useBackend) {
        // 从后端获取数据
        const response = await fetch("/api/price-data");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setPriceData(data);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // 使用mock数据
        const mockData = generateMockData();
        setPriceData(mockData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 生成图表点数据
  const generateChartPoints = (data, isUniswap = true, priceRange) => {
    if (!data || !priceRange) return [];

    const dataset = isUniswap ? data.uniswap : data.binance;
    if (!dataset || dataset.length === 0) return [];

    const { min, max } = priceRange;
    const range = max - min;
    const chartHeight = 250; // SVG 图表高度
    const chartTop = 25; // 顶部边距

    return dataset.map((item, index) => ({
      x: (index / (dataset.length - 1)) * 750 + 25, // 在SVG坐标系中的x位置
      yOpen: 300 - ((item.open - 2400) / 200) * 250, // 开盘价在SVG坐标系中的y位置
      yHigh: 300 - ((item.high - 2400) / 200) * 250, // 最高价在SVG坐标系中的y位置
      yLow: 300 - ((item.low - 2400) / 200) * 250, // 最低价在SVG坐标系中的y位置
      yClose: 300 - ((item.close - 2400) / 200) * 250, // 收盘价在SVG坐标系中的y位置
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      isRising: item.close >= item.open, // 判断是否上涨
    }));
  };

  // 生成Y轴刻度
  const generateYTicks = (priceRange) => {
    if (!priceRange || priceRange.min === priceRange.max) {
      return [2600, 2550, 2500, 2450, 2400]; // 默认值
    }

    const { min, max } = priceRange;
    const range = max - min;
    const step = range / 4; // 5个刻度点（包括最小和最大）
    
    return [
      Math.ceil(max),
      Math.ceil(max - step),
      Math.ceil(max - step * 2),
      Math.ceil(max - step * 3),
      Math.floor(min)
    ].reverse();
  };

  const renderChart = () => {
    if (loading) {
        return <div className="chart-placeholder">加载中...</div>;
    }

    if (error) {
        return <div className="chart-placeholder">错误: {error}</div>;
    }

    if (!priceData) {
        return <div className="chart-placeholder">无数据</div>;
    }

    const priceRange = calculatePriceRange(priceData);
    const uniswapPoints = generateChartPoints(priceData, true, priceRange);
    const binancePoints = generateChartPoints(priceData, false, priceRange);
    const yTicks = generateYTicks(priceRange);

    return (
        <div className="chart-container">
            <div className="chart-wrapper">
                <div className="chart-header">
                    <h3>USDT/ETH 价格对比 (2025年9月)</h3>
                    <div className="chart-controls">
                        {/* 修改: 更新按钮样式并统一高度 */}
                        <button
                            className={`chart-button ${chartView === "both" ? "active" : ""}`}
                            onClick={() => setChartView("both")}
                            style={{
                                marginRight: "10px",
                                padding: "10px 20px",
                                borderRadius: "4px",
                                border: "none",
                                backgroundColor: "#808695", // 修改：设置为灰色
                                color: "#ffffff",
                                height: "40px",
                                fontSize: "14px",
                                display: "flex", // 新增：使用flex布局
                                alignItems: "center", // 新增：使文字垂直居中
                                justifyContent: "center", // 新增：使文字水平居中
                            }}
                        >
                            显示全部
                        </button>
                        <button
                            className={`chart-button ${chartView === "uniswap" ? "active" : ""}`}
                            onClick={() => setChartView("uniswap")}
                            style={{
                                marginRight: "10px",
                                padding: "10px 20px",
                                borderRadius: "4px",
                                border: "none",
                                backgroundColor: "#6366f1", // 修改：设置为紫色
                                color: "#ffffff",
                                height: "40px",
                                fontSize: "14px",
                                display: "flex", // 新增：使用flex布局
                                alignItems: "center", // 新增：使文字垂直居中
                                justifyContent: "center", // 新增：使文字水平居中
                            }}
                        >
                            Uniswap V3
                        </button>
                        <button
                            className={`chart-button ${chartView === "binance" ? "active" : ""}`}
                            onClick={() => setChartView("binance")}
                            style={{
                                padding: "10px 20px",
                                borderRadius: "4px",
                                border: "none",
                                backgroundColor: "#10b981", // 修改：设置为绿色
                                color: "#ffffff",
                                height: "40px",
                                fontSize: "14px",
                                display: "flex", // 新增：使用flex布局
                                alignItems: "center", // 新增：使文字垂直居中
                                justifyContent: "center", // 新增：使文字水平居中
                            }}
                        >
                            Binance
                        </button>
                    </div>
                    <div className="legend">
                        {chartView !== "binance" && (
                            <div className="legend-item">
                                <div className="color-box uniswap"></div>
                                <span>Uniswap V3</span>
                            </div>
                        )}
                        {chartView !== "uniswap" && (
                            <div className="legend-item">
                                <div className="color-box binance"></div>
                                <span>Binance</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="chart-area">
                    <div className="y-axis">
                        {[2600, 2550, 2500, 2450, 2400].map((price) => (
                            <div key={price} className="y-tick">
                                {price}
                            </div>
                        ))}
                    </div>
                    <div className="chart-grid">
                        <svg viewBox="0 0 800 300" className="price-chart">
                            {/* 网格线 */}
                            {[0, 1, 2, 3, 4].map((i) => (
                                <line
                                    key={i}
                                    x1="0"
                                    y1={i * 75}
                                    x2="800"
                                    y2={i * 75}
                                    stroke="#eee"
                                    strokeWidth="1"
                                />
                            ))}

                            {/* Uniswap K线 */}
                            {chartView !== "binance" &&
                                uniswapPoints.map((point, i) => (
                                    <g key={`uni-${i}`}>
                                        {/* 影线 */}
                                        <line
                                            x1={point.x}
                                            y1={point.yHigh}
                                            x2={point.x}
                                            y2={point.yLow}
                                            stroke={point.isRising ? "#6366f1" : "#ef4444"}
                                            strokeWidth="1"
                                        />
                                        {/* 实体 */}
                                        {/* 修改: 增加K线图方块宽度 */}
                                        <rect
                                            x={point.x - 4}
                                            y={Math.min(point.yOpen, point.yClose)}
                                            width="8"
                                            height={Math.max(
                                                1,
                                                Math.abs(point.yOpen - point.yClose)
                                            )}
                                            fill={point.isRising ? "#6366f1" : "#ef4444"}
                                        />
                                    </g>
                                ))}

                            {/* Binance K线 */}
                            {chartView !== "uniswap" &&
                                binancePoints.map((point, i) => (
                                    <g key={`bin-${i}`} opacity="0.7">
                                        {/* 影线 */}
                                        <line
                                            x1={point.x}
                                            y1={point.yHigh}
                                            x2={point.x}
                                            y2={point.yLow}
                                            stroke={point.isRising ? "#10b981" : "#f97316"}
                                            strokeWidth="1"
                                        />
                                        {/* 实体 */}
                                        {/* 修改: 增加K线图方块宽度 */}
                                        <rect
                                            x={point.x - 4}
                                            y={Math.min(point.yOpen, point.yClose)}
                                            width="8"
                                            height={Math.max(
                                                1,
                                                Math.abs(point.yOpen - point.yClose)
                                            )}
                                            fill={point.isRising ? "#10b981" : "#f97316"}
                                        />
                                    </g>
                                ))}
                        </svg>
                    </div>
                </div>
                <div className="x-axis">
                    {[1, 5, 10, 15, 20, 25, 30].map((day) => (
                        <div key={day} className="x-tick">
                            9/{day}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="page-container">
      {/* Hero Section - Full Screen */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">价格看板</h1>
          <p className="hero-subtitle">
            Uniswap V3 与 Binance 历史成交数据可视化
          </p>

          {/* 价格对比图表 */}
          <div className="chart-placeholder">{renderChart()}</div>
        </div>
      </section>

      {/* Content Section */}
      <section className="content-section">
        <div className="content-wrapper">
          <h2 className="section-title">数据分析</h2>
          <div className="analysis-content">
            <div className="analysis-card">
              <h3>价格趋势对比</h3>
              <p>
                在2025年9月期间，Uniswap
                V3和Binance上的USDT/ETH交易对价格走势总体保持一致，
                但在某些时段存在明显价差，这为套利交易提供了机会。
              </p>
            </div>

            <div className="analysis-card">
              <h3>市场波动性</h3>
              <p>
                数据显示，Binance上的价格波动通常比Uniswap V3更剧烈，
                这可能与两个市场的流动性深度和交易量差异有关。
              </p>
            </div>

            <div className="analysis-card">
              <h3>套利机会分析</h3>
              <p>
                当两个平台间的价差超过0.3%时，扣除交易成本后仍有盈利空间。
                在9月份共检测到约120次潜在套利机会。
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PriceDashboard;
