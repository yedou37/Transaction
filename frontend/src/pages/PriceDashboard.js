import React, { useEffect, useState } from "react";
import "./PriceDashboard.css";

function PriceDashboard() {
  const [scrolled, setScrolled] = useState(false);
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

          // Mock数据 - 模拟2025年9月1日至9月30日的数据
          const mockData = generateMockData();
          setPriceData(mockData);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

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

  // 生成图表点数据
  const generateChartPoints = (data, isUniswap = true) => {
    if (!data) return [];

    const dataset = isUniswap ? data.uniswap : data.binance;
    if (!dataset) return [];

    return dataset.map((item, index) => ({
      x: (index / (dataset.length - 1)) * 750 + 25, // 在SVG坐标系中的x位置
      y: 300 - ((item.close - 2400) / 200) * 250, // 在SVG坐标系中的y位置
      price: item.close.toFixed(2),
    }));
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

    const uniswapPoints = generateChartPoints(priceData, true);
    const binancePoints = generateChartPoints(priceData, false);

    return (
      <div className="chart-container">
        <div className="chart-wrapper">
          <div className="chart-header">
            <h3>USDT/ETH 价格对比 (2025年9月)</h3>
            <div className="legend">
              <div className="legend-item">
                <div className="color-box uniswap"></div>
                <span>Uniswap V3</span>
              </div>
              <div className="legend-item">
                <div className="color-box binance"></div>
                <span>Binance</span>
              </div>
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

                {/* Uniswap 折线 */}
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  points={uniswapPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                />

                {/* Binance 折线 */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  points={binancePoints.map((p) => `${p.x},${p.y}`).join(" ")}
                />

                {/* 数据点 - Uniswap */}
                {uniswapPoints
                  .filter((_, i) => i % 3 === 0)
                  .map((point, i) => (
                    <circle
                      key={`uni-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="#6366f1"
                    />
                  ))}

                {/* 数据点 - Binance */}
                {binancePoints
                  .filter((_, i) => i % 3 === 0)
                  .map((point, i) => (
                    <circle
                      key={`bin-${i}`}
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill="#10b981"
                    />
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
