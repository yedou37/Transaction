import React, { useEffect, useState, useMemo, useRef } from "react";
import "./PriceDashboard.css";

const PriceDashboard = () => {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dataSource, setDataSource] = useState("uniswap");
  const [visibleCount, setVisibleCount] = useState(60);
  const [hoveredItem, setHoveredItem] = useState(null);

  // --- 数据加载 (Mock) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 800));
        setPriceData(generateMockData());
      } catch (err) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const generateMockData = () => {
    const uniswapData = [];
    const binanceData = [];
    const totalDays = 180;
    for (let i = 1; i <= totalDays; i++) {
      const trend = i * 2;
      const volatility = 40;
      const basePrice = 2500 + Math.sin(i * 0.1) * 200 + trend;
      const date = new Date();
      date.setDate(date.getDate() - (totalDays - i));
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const dateStr = `${date.getFullYear()}-${month}-${day}`;
      const displayTime = `${month}-${day}`;

      const uOpen = basePrice + (Math.random() - 0.5) * volatility;
      const uClose = basePrice + (Math.random() - 0.5) * volatility;
      const uHigh =
        Math.max(uOpen, uClose) + Math.random() * (volatility * 0.5);
      const uLow = Math.min(uOpen, uClose) - Math.random() * (volatility * 0.5);
      const uVol = Math.random() * 1000 + 500;
      uniswapData.push({
        id: i,
        timestamp: dateStr,
        displayTime,
        open: uOpen,
        high: uHigh,
        low: uLow,
        close: uClose,
        volume: uVol,
      });

      const bBase = basePrice + (Math.random() - 0.5) * 15;
      const bOpen = bBase + (Math.random() - 0.5) * volatility;
      const bClose = bBase + (Math.random() - 0.5) * volatility;
      const bHigh =
        Math.max(bOpen, bClose) + Math.random() * (volatility * 0.5);
      const bLow = Math.min(bOpen, bClose) - Math.random() * (volatility * 0.5);
      const bVol = uVol * 1.5;
      binanceData.push({
        id: i,
        timestamp: dateStr,
        displayTime,
        open: bOpen,
        high: bHigh,
        low: bLow,
        close: bClose,
        volume: bVol,
      });
    }
    return { uniswap: uniswapData, binance: binanceData };
  };

  const fullData = useMemo(
    () => (priceData ? priceData[dataSource] : []),
    [priceData, dataSource]
  );
  const activeData = useMemo(() => {
    if (!fullData.length) return [];
    const safeCount = Math.min(visibleCount, fullData.length);
    return fullData.slice(-safeCount);
  }, [fullData, visibleCount]);

  // --- 核心修改：displayStats 逻辑 ---
  const displayStats = useMemo(() => {
    // 1. 确定目标数据：是 Hover 的那条，还是最新那条？
    const target =
      hoveredItem ||
      (activeData.length > 0 ? activeData[activeData.length - 1] : null);

    if (!target) return null;

    // 2. 计算通用指标 (Period High 是整个可视区域的最高，不应该随 hover 变化，否则没意义)
    const periodHigh = Math.max(...activeData.map((d) => d.high));

    // 3. 计算特定指标 (基于 target)
    const change = target.close - target.open;
    const changePercent = (change / target.open) * 100;
    const isRising = target.close >= target.open;

    return {
      price: target.close,
      open: target.open,
      high: target.high,
      low: target.low,
      volume: target.volume,
      change,
      changePercent,
      isRising,
      periodHigh, // 保持全局上下文
      timestamp: target.timestamp, // 用于显示当前是哪一天的数据
    };
  }, [activeData, hoveredItem]);

  // --- 尺寸与交互 ---
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener("resize", updateSize);
    setTimeout(updateSize, 0);
    return () => window.removeEventListener("resize", updateSize);
  }, [loading]);

  const handleZoom = (delta) => {
    if (!fullData.length) return;
    setVisibleCount((prev) =>
      Math.max(10, Math.min(prev + delta, fullData.length))
    );
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      const zoomStrength = Math.abs(e.deltaY) > 50 ? 5 : 2;
      handleZoom(e.deltaY > 0 ? zoomStrength : -zoomStrength);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [fullData]);

  // --- 绘图计算 ---
  const chartMetrics = useMemo(() => {
    if (!activeData.length || !dimensions.height) return null;
    const paddingY = 40;
    const minPrice = Math.min(...activeData.map((d) => d.low));
    const maxPrice = Math.max(...activeData.map((d) => d.high));
    const range = maxPrice - minPrice || 1;
    return { minPrice, maxPrice, range, paddingY };
  }, [activeData, dimensions.height]);

  const { points, yTicks } = useMemo(() => {
    if (!activeData.length || !dimensions.width || !chartMetrics)
      return { points: [], yTicks: [] };

    const { minPrice, range, paddingY } = chartMetrics;
    const getY = (price) => {
      const ratio = (price - minPrice) / range;
      const drawHeight = dimensions.height - paddingY * 2;
      return dimensions.height - paddingY - ratio * drawHeight;
    };

    const count = activeData.length;
    const xStep = dimensions.width / count;
    const candleWidth = Math.max(1, Math.min(xStep * 0.7, 40));

    const pts = activeData.map((d, i) => ({
      ...d,
      x: i * xStep + xStep / 2,
      xStart: i * xStep,
      yOpen: getY(d.open),
      yClose: getY(d.close),
      yHigh: getY(d.high),
      yLow: getY(d.low),
      width: candleWidth,
      isRising: d.close >= d.open,
    }));

    const ticks = [];
    for (let i = 0; i <= 5; i++) {
      const val = minPrice + (range * i) / 5;
      ticks.push({ val, y: getY(val) });
    }
    return { points: pts, yTicks: ticks };
  }, [activeData, dimensions, chartMetrics]);

  const cursorPrice = useMemo(() => {
    if (!chartMetrics || !mousePos.active) return null;
    const { minPrice, range, paddingY } = chartMetrics;
    const drawHeight = dimensions.height - paddingY * 2;
    const ratio = (dimensions.height - paddingY - mousePos.y) / drawHeight;
    return minPrice + ratio * range;
  }, [mousePos, chartMetrics, dimensions]);

  const handleMouseMove = (e) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        active: true,
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setMousePos((prev) => ({ ...prev, active: false }));
  };

  if (loading)
    return <div className="loading-screen">Loading Market Data...</div>;
  if (error) return <div className="error-screen">{error}</div>;

  return (
    <div className="dashboard-container">
      {/* 头部信息 - 现已改为根据 displayStats 动态显示 */}
      <header className="dashboard-header">
        <div className="pair-info-group">
          <div className="coin-icon">ETH</div>
          <div className="coin-details">
            <h2 className="pair-title">ETH / USDT</h2>
            <div className="tags">
              <span className="tag-source">
                {dataSource === "uniswap" ? "Uniswap V3" : "Binance"}
              </span>
              {/* 可选：显示当前头部数据对应的日期，如果不想显示可去掉 */}
              {hoveredItem && (
                <span className="tag-source" style={{ marginLeft: 8 }}>
                  {hoveredItem.timestamp}
                </span>
              )}
            </div>
          </div>
        </div>

        {displayStats && (
          <div className="stats-group">
            <div className="stat-block">
              {/* 这里的 Label 当 hover 时其实是指 specific candle price，但保持 Current Price 也是业内的通用做法 */}
              <span className="stat-label">Price</span>
              <span
                className={`current-price ${
                  displayStats.isRising ? "text-up" : "text-down"
                }`}
              >
                ${displayStats.price.toFixed(2)}
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">Change</span>
              <span
                className={`stat-value ${
                  displayStats.isRising ? "text-up" : "text-down"
                }`}
              >
                {displayStats.change >= 0 ? "+" : ""}
                {displayStats.change.toFixed(2)} (
                {displayStats.changePercent.toFixed(2)}%)
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">High</span>
              <span className="stat-value text-normal">
                ${displayStats.high.toFixed(2)}
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">Low</span>
              <span className="stat-value text-normal">
                ${displayStats.low.toFixed(2)}
              </span>
            </div>
            {/* Period High 保持不变，始终显示可视区域最大值 */}
            <div className="stat-block">
              <span className="stat-label">Period High</span>
              <span className="stat-value text-gold">
                ${displayStats.periodHigh.toFixed(2)}
              </span>
            </div>
            <div className="stat-block">
              <span className="stat-label">Volume</span>
              <span className="stat-value text-normal">
                {displayStats.volume.toFixed(0)}
              </span>
            </div>
          </div>
        )}
      </header>

      <main className="dashboard-main">
        <section className="chart-card">
          <div className="chart-toolbar">
            <div className="toolbar-group">
              <span className="toolbar-label">Time</span>
              <div className="time-btns">
                {[30, 90, 180].map((d) => (
                  <button
                    key={d}
                    onClick={() => setVisibleCount(d)}
                    className={`time-btn ${visibleCount === d ? "active" : ""}`}
                  >
                    {d}D
                  </button>
                ))}
              </div>
            </div>
            <div className="toolbar-group">
              <div className="segmented-control">
                <button
                  className={dataSource === "uniswap" ? "active-uni" : ""}
                  onClick={() => setDataSource("uniswap")}
                >
                  Uniswap
                </button>
                <div className="divider"></div>
                <button
                  className={dataSource === "binance" ? "active-bin" : ""}
                  onClick={() => setDataSource("binance")}
                >
                  Binance
                </button>
              </div>
            </div>
          </div>

          <div
            className="chart-area"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <svg width="100%" height="100%" className="chart-svg">
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line
                    x1="0"
                    y1={t.y}
                    x2="100%"
                    y2={t.y}
                    className="grid-line"
                  />
                  <text
                    x={dimensions.width - 6}
                    y={t.y - 4}
                    className="axis-label"
                  >
                    {t.val.toFixed(0)}
                  </text>
                </g>
              ))}

              {points.map((p) => (
                <g key={p.id}>
                  <line
                    x1={p.x}
                    y1={p.yHigh}
                    x2={p.x}
                    y2={p.yLow}
                    className={p.isRising ? "stroke-up" : "stroke-down"}
                  />
                  <rect
                    x={p.x - p.width / 2}
                    y={Math.min(p.yOpen, p.yClose)}
                    width={p.width}
                    height={Math.max(1, Math.abs(p.yOpen - p.yClose))}
                    className={p.isRising ? "fill-up" : "fill-down"}
                    shapeRendering="crispEdges"
                  />
                  <rect
                    x={p.xStart}
                    y="0"
                    width={dimensions.width / points.length}
                    height="100%"
                    fill="transparent"
                    onMouseEnter={() => setHoveredItem(p)}
                  />
                </g>
              ))}

              {mousePos.active && (
                <>
                  {hoveredItem && (
                    <line
                      x1={hoveredItem.x}
                      y1="0"
                      x2={hoveredItem.x}
                      y2="100%"
                      className="crosshair-line"
                    />
                  )}
                  <line
                    x1="0"
                    y1={mousePos.y}
                    x2="100%"
                    y2={mousePos.y}
                    className="crosshair-line"
                  />
                  {cursorPrice && (
                    <g
                      transform={`translate(${dimensions.width - 55}, ${
                        mousePos.y
                      })`}
                    >
                      <rect
                        x="0"
                        y="-10"
                        width="55"
                        height="20"
                        className="axis-cursor-label-bg"
                      />
                      <text x="27.5" y="1" className="axis-cursor-label-text">
                        {cursorPrice.toFixed(2)}
                      </text>
                    </g>
                  )}
                </>
              )}
            </svg>

            <div className="x-axis">
              {points
                .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
                .map((p) => (
                  <span key={p.id} style={{ left: p.x }}>
                    {p.displayTime}
                  </span>
                ))}
            </div>

            {/* Tooltip 修改部分：增加颜色判断 logic */}
            {hoveredItem && (
              <div
                className="floating-tooltip"
                style={{
                  left:
                    mousePos.x > dimensions.width / 2
                      ? mousePos.x - 180
                      : mousePos.x + 20,
                  top: Math.min(mousePos.y, dimensions.height - 150),
                }}
              >
                <div className="tooltip-date">{hoveredItem.timestamp}</div>

                {/* 1. Open 一般保持白色或灰色 */}
                <div className="tooltip-row">
                  <span>Open:</span>
                  <span className="font-mono">
                    {hoveredItem.open.toFixed(2)}
                  </span>
                </div>

                {/* 2. High 随 K线颜色 */}
                <div className="tooltip-row">
                  <span>High:</span>
                  <span className="font-mono">
                    {hoveredItem.high.toFixed(2)}
                  </span>
                </div>

                {/* 3. Low 随 K线颜色 */}
                <div className="tooltip-row">
                  <span>Low:</span>
                  <span className="font-mono">
                    {hoveredItem.low.toFixed(2)}
                  </span>
                </div>

                {/* 4. Close 严格根据涨跌变色 */}
                <div className="tooltip-row">
                  <span>Close:</span>
                  <span
                    className={`font-mono ${
                      hoveredItem.isRising ? "text-up" : "text-down"
                    }`}
                  >
                    {hoveredItem.close.toFixed(2)}
                  </span>
                </div>

                {/* 5. Vol 一般保持白色 */}
                <div className="tooltip-row">
                  <span>Vol:</span>
                  <span className="font-mono">
                    {hoveredItem.volume.toFixed(0)}
                  </span>
                </div>

                {/* 6. Chg 严格根据正负变色 */}
                <div className="tooltip-row">
                  <span>Chg:</span>
                  <span
                    className={`font-mono ${
                      hoveredItem.close - hoveredItem.open >= 0
                        ? "text-up"
                        : "text-down"
                    }`}
                  >
                    {(hoveredItem.close - hoveredItem.open).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="table-card">
          <div className="table-header">
            <h3>Market Trades</h3>
          </div>
          <div className="table-body">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {[...activeData].reverse().map((row) => (
                  <tr
                    key={row.id}
                    className={
                      hoveredItem && hoveredItem.id === row.id
                        ? "row-hover"
                        : ""
                    }
                    onMouseEnter={() => setHoveredItem(row)}
                  >
                    <td className="text-left text-dim">{row.displayTime}</td>
                    <td
                      className={`text-right ${
                        row.close >= row.open ? "text-up" : "text-down"
                      }`}
                    >
                      {row.close.toFixed(2)}
                    </td>
                    <td className="text-right text-normal">
                      {row.volume.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default PriceDashboard;
