import React, {
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import "./PriceDashboard.css";

const USE_BACKEND =
  (process.env.REACT_APP_USE_BACKEND || "").toLowerCase() === "true";
const API_BASE_URL = (
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PriceDashboard = () => {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const [dataSource, setDataSource] = useState("uniswap");

  // 视图状态
  const [viewState, setViewState] = useState({ start: 0, count: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState(null);
  const [dragStartViewIndex, setDragStartViewIndex] = useState(0);
  const [hoveredItem, setHoveredItem] = useState(null);

  // --- 数据处理辅助函数 ---
  const normalizeSeries = (series = []) => {
    return series
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(a.timestamp || 0).valueOf() -
          new Date(b.timestamp || 0).valueOf()
      )
      .map((item, idx) => {
        const ts = item.timestamp ? new Date(item.timestamp) : new Date();
        const month = (ts.getMonth() + 1).toString().padStart(2, "0");
        const day = ts.getDate().toString().padStart(2, "0");
        return {
          id: item.id ?? idx + 1,
          timestamp: item.timestamp || ts.toISOString(),
          displayTime: item.displayTime || `${month}-${day}`,
          open: Number(item.open ?? 0),
          high: Number(item.high ?? 0),
          low: Number(item.low ?? 0),
          close: Number(item.close ?? 0),
          volume: Number(item.volume ?? 0),
        };
      });
  };

  const fetchBackendData = async () => {
    const response = await fetch(`${API_BASE_URL}/api/price-data`);
    if (!response.ok) throw new Error(`后端返回错误: ${response.status}`);
    const data = await response.json();
    return {
      uniswap: normalizeSeries(data?.uniswap),
      binance: normalizeSeries(data?.binance),
    };
  };

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

      const bBase = basePrice + Math.sin(i * 0.2) * 20;
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

  // --- 修改：将数据加载逻辑提取为 useCallback ---
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // 清除之前的 Notice 以便用户感知刷新
      setNotice("");

      if (USE_BACKEND) {
        const backendData = await fetchBackendData();
        if (!backendData.uniswap.length) throw new Error("Empty backend data");
        setPriceData(backendData);
      } else {
        // 模拟网络延迟，让刷新动画显示一会
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPriceData(generateMockData());
        setNotice("已刷新：使用模拟数据");
      }
    } catch (err) {
      console.warn("Falling back to mock data", err);
      setPriceData(generateMockData());
      setNotice("数据加载失败，已显示模拟数据");
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fullData = useMemo(() => {
    return priceData?.uniswap || [];
  }, [priceData]);

  useEffect(() => {
    if (fullData.length > 0) {
      const initialCount = 60;
      setViewState({
        start: Math.max(0, fullData.length - initialCount),
        count: initialCount,
      });
    }
  }, [fullData.length]);

  const activeData = useMemo(() => {
    if (!priceData || !priceData.uniswap || !priceData.binance) return [];

    const { start, count } = viewState;
    const safeStart = Math.max(0, Math.floor(start));
    const safeEnd = Math.min(
      priceData.uniswap.length,
      Math.ceil(start + count)
    );

    if (dataSource === "comparison") {
      const uniSlice = priceData.uniswap.slice(safeStart, safeEnd);
      const binSlice = priceData.binance.slice(safeStart, safeEnd);

      return uniSlice.map((u, i) => {
        const b = binSlice[i] || u;
        const spread = u.close - b.close;
        return {
          ...u,
          uniClose: u.close,
          binClose: b.close,
          spread: spread,
          close: u.close,
          high: Math.max(u.high, b.high),
          low: Math.min(u.low, b.low),
        };
      });
    } else {
      const source = priceData[dataSource] || [];
      return source.slice(safeStart, safeEnd);
    }
  }, [priceData, viewState, dataSource]);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, active: false });

  const handleDateChange = (e) => {
    const dateStr = e.target.value; // YYYY-MM-DD
    if (!dateStr || !fullData.length) return;

    const targetTime = new Date(dateStr).getTime();

    let closestIndex = 0;
    let minDiff = Infinity;

    fullData.forEach((item, index) => {
      const itemTime = new Date(item.timestamp).getTime();
      const diff = Math.abs(itemTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    let newStart = closestIndex - Math.floor(viewState.count / 2);

    if (newStart < 0) newStart = 0;
    if (newStart + viewState.count > fullData.length) {
      newStart = fullData.length - viewState.count;
    }

    setViewState((prev) => ({ ...prev, start: newStart }));
  };

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
    setTimeout(updateSize, 100);
    return () => window.removeEventListener("resize", updateSize);
  }, [loading]);

  const handleWheel = (e) => {
    e.preventDefault();
    if (!fullData.length || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );

    const { start, count } = viewState;
    const focusIndex = start + count * ratio;

    const zoomStrength = Math.abs(e.deltaY) > 50 ? 5 : 2;
    const delta = e.deltaY > 0 ? zoomStrength : -zoomStrength;

    let newCount = Math.max(5, Math.min(count + delta, fullData.length));
    let newStart = focusIndex - newCount * ratio;

    if (newStart < 0) newStart = 0;
    if (newStart + newCount > fullData.length)
      newStart = fullData.length - newCount;

    setViewState({ start: newStart, count: newCount });
  };

  const handleMouseDown = (e) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStartPos(e.clientX);
    setDragStartViewIndex(viewState.start);
    containerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });

    if (isDragging && dragStartPos !== null) {
      const deltaPixels = e.clientX - dragStartPos;
      const moveRatio = deltaPixels / dimensions.width;
      const candlesMoved = moveRatio * viewState.count;

      let newStart = dragStartViewIndex - candlesMoved;
      if (newStart < 0) newStart = 0;
      if (newStart + viewState.count > fullData.length)
        newStart = fullData.length - viewState.count;

      setViewState((prev) => ({ ...prev, start: newStart }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStartPos(null);
    if (containerRef.current) containerRef.current.style.cursor = "crosshair";
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
    setMousePos((prev) => ({ ...prev, active: false }));
    setIsDragging(false);
    setDragStartPos(null);
  };

  const chartMetrics = useMemo(() => {
    if (!activeData.length || !dimensions.height) return null;

    const isCompare = dataSource === "comparison";
    const padding = 20;
    const bottomHeight = isCompare ? dimensions.height * 0.3 : 0;

    let minPrice, maxPrice;
    if (isCompare) {
      const allPrices = activeData.flatMap((d) => [d.uniClose, d.binClose]);
      minPrice = Math.min(...allPrices);
      maxPrice = Math.max(...allPrices);
    } else {
      minPrice = Math.min(...activeData.map((d) => d.low));
      maxPrice = Math.max(...activeData.map((d) => d.high));
    }
    const range = maxPrice - minPrice || 1;

    let maxSpread = 1;
    if (isCompare) {
      const spreads = activeData.map((d) => Math.abs(d.spread));
      maxSpread = Math.max(...spreads) || 1;
    }

    return {
      minPrice,
      maxPrice,
      range,
      maxSpread,
      isCompare,
      bottomHeight,
      padding,
    };
  }, [activeData, dimensions.height, dataSource]);

  const cursorPrice = useMemo(() => {
    if (!chartMetrics || !mousePos.active) return null;
    const { minPrice, range, bottomHeight, padding } = chartMetrics;
    const { height } = dimensions;

    const chartHeight = height - bottomHeight - padding * 2;
    const relativeY = mousePos.y - padding;

    if (relativeY < 0 || relativeY > chartHeight) return null;

    const ratio = 1 - relativeY / chartHeight;
    return minPrice + ratio * range;
  }, [mousePos, chartMetrics, dimensions]);

  const { points, yTicks, spreadZeroY } = useMemo(() => {
    if (!activeData.length || !dimensions.width || !chartMetrics)
      return { points: [], yTicks: [], spreadZeroY: 0 };

    const { minPrice, range, maxSpread, isCompare, bottomHeight, padding } =
      chartMetrics;
    const count = activeData.length;
    const xStep = dimensions.width / count;
    const candleWidth = Math.max(1, Math.min(xStep * 0.7, 40));

    const chartHeight = dimensions.height - bottomHeight - padding * 2;

    const getPriceY = (price) => {
      const ratio = (price - minPrice) / range;
      return chartHeight + padding - ratio * chartHeight;
    };

    const spreadCenterY = dimensions.height - bottomHeight / 2;
    const spreadMaxH = (bottomHeight / 2) * 0.8;

    const getSpreadH = (spread) => {
      return (spread / maxSpread) * spreadMaxH;
    };

    const pts = activeData.map((d, i) => {
      const x = i * xStep + xStep / 2;
      const base = {
        ...d,
        x,
        xStart: i * xStep,
        width: candleWidth,
      };

      if (isCompare) {
        return {
          ...base,
          yUni: getPriceY(d.uniClose),
          yBin: getPriceY(d.binClose),
          spreadH: getSpreadH(d.spread),
        };
      } else {
        return {
          ...base,
          yOpen: getPriceY(d.open),
          yClose: getPriceY(d.close),
          yHigh: getPriceY(d.high),
          yLow: getPriceY(d.low),
          isRising: d.close >= d.open,
        };
      }
    });

    const ticks = [];
    for (let i = 0; i <= 5; i++) {
      const val = minPrice + (range * i) / 5;
      ticks.push({ val, y: getPriceY(val) });
    }

    return { points: pts, yTicks: ticks, spreadZeroY: spreadCenterY };
  }, [activeData, dimensions, chartMetrics, dataSource]);

  const getLinePath = (pts, key) => {
    if (!pts.length) return "";
    return "M" + pts.map((p) => `${p.x},${p[key]}`).join(" L");
  };

  const displayStats = useMemo(() => {
    const target =
      hoveredItem ||
      (activeData.length > 0 ? activeData[activeData.length - 1] : null);
    if (!target) return null;

    if (dataSource === "comparison") {
      return {
        mode: "compare",
        uniPrice: target.uniClose,
        binPrice: target.binClose,
        spread: target.spread,
        timestamp: target.timestamp,
      };
    }
    const change = target.close - target.open;
    return {
      mode: "single",
      price: target.close,
      open: target.open,
      high: target.high,
      low: target.low,
      change,
      changePercent: (change / target.open) * 100,
      isRising: target.close >= target.open,
      volume: target.volume,
      periodHigh: chartMetrics ? chartMetrics.maxPrice : 0,
      timestamp: target.timestamp,
    };
  }, [activeData, hoveredItem, dataSource, chartMetrics]);

  const snapX = hoveredItem ? hoveredItem.x : mousePos.x;

  // 注意：不再整个页面 Loading，而是在 Chart 区域处理 Loading 状态或允许透明刷新
  // 为了不闪烁，这里只在初始化没有数据时显示全屏 Loading
  if (loading && !priceData)
    return <div className="loading-screen">Loading Market Data...</div>;

  return (
    <div className="dashboard-container">
      {notice && <div className="notice-bar">{notice}</div>}

      <header className="dashboard-header">
        <div className="pair-info-group">
          <div className="coin-icon">ETH</div>
          <div className="coin-details">
            <h2 className="pair-title">ETH / USDT</h2>
            <div className="tags">
              {dataSource === "comparison" ? (
                <>
                  <span className="tag-source" style={{ color: "#6366f1" }}>
                    Uniswap
                  </span>
                  <span
                    className="tag-source"
                    style={{ color: "#f0b90b", marginLeft: 4 }}
                  >
                    Binance
                  </span>
                </>
              ) : (
                <span className="tag-source">
                  {dataSource === "uniswap" ? "Uniswap V3" : "Binance"}
                </span>
              )}
            </div>
          </div>
        </div>

        {displayStats && (
          <div className="stats-group">
            {displayStats.mode === "compare" ? (
              <>
                <div className="stat-block">
                  <span className="stat-label">Spread</span>
                  <span
                    className={`current-price ${
                      displayStats.spread >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {displayStats.spread.toFixed(2)}
                  </span>
                </div>
                <div className="stat-block">
                  <span className="stat-label">Uniswap</span>
                  <span className="stat-value" style={{ color: "#6366f1" }}>
                    ${displayStats.uniPrice.toFixed(2)}
                  </span>
                </div>
                <div className="stat-block">
                  <span className="stat-label">Binance</span>
                  <span className="stat-value" style={{ color: "#f0b90b" }}>
                    ${displayStats.binPrice.toFixed(2)}
                  </span>
                </div>
                <div className="stat-block">
                  <span className="stat-label">Date</span>
                  <span className="stat-value text-bright">
                    {displayStats.timestamp.slice(5, 10)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="stat-block">
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
                  <span className="stat-value text-bright">
                    ${displayStats.high.toFixed(2)}
                  </span>
                </div>
                <div className="stat-block">
                  <span className="stat-label">Low</span>
                  <span className="stat-value text-bright">
                    ${displayStats.low.toFixed(2)}
                  </span>
                </div>
                <div className="stat-block">
                  <span className="stat-label">Vol</span>
                  <span className="stat-value text-bright">
                    {displayStats.volume.toFixed(0)}
                  </span>
                </div>
              </>
            )}
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
                    onClick={() =>
                      setViewState({ start: fullData.length - d, count: d })
                    }
                    className={`time-btn ${
                      viewState.count === d ? "active" : ""
                    }`}
                  >
                    {d}D
                  </button>
                ))}
              </div>

              <div
                style={{
                  marginLeft: "12px",
                  borderLeft: "1px solid var(--border-color)",
                  paddingLeft: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <input
                  type="date"
                  className="date-picker-input"
                  onChange={handleDateChange}
                  max={new Date().toISOString().split("T")[0]}
                />

                {/* --- 新增刷新按钮 --- */}
                <button
                  className={`refresh-btn ${loading ? "spinning" : ""}`}
                  onClick={fetchData}
                  title="Refresh Data"
                  disabled={loading}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                </button>
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
                <div className="divider"></div>
                <button
                  className={dataSource === "comparison" ? "active-comp" : ""}
                  onClick={() => setDataSource("comparison")}
                >
                  Trend & Spread
                </button>
              </div>
            </div>
          </div>

          <div
            className="chart-area"
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ userSelect: "none" }}
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

              {dataSource === "comparison" ? (
                <>
                  <line
                    x1="0"
                    y1={spreadZeroY}
                    x2="100%"
                    y2={spreadZeroY}
                    stroke="#444"
                    strokeDasharray="2 2"
                  />
                  {points.map((p) => (
                    <g key={`spread-${p.id}`}>
                      <rect
                        x={p.x - p.width / 2}
                        y={
                          p.spreadH >= 0 ? spreadZeroY - p.spreadH : spreadZeroY
                        }
                        width={p.width}
                        height={Math.max(1, Math.abs(p.spreadH))}
                        fill={
                          p.spread >= 0
                            ? "var(--color-up)"
                            : "var(--color-down)"
                        }
                        opacity={0.6}
                      />
                    </g>
                  ))}
                  <text x="10" y={spreadZeroY - 10} fill="#888" fontSize="10">
                    Spread (Uni - Bin)
                  </text>
                  <path
                    d={getLinePath(points, "yUni")}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                  />
                  <path
                    d={getLinePath(points, "yBin")}
                    fill="none"
                    stroke="#f0b90b"
                    strokeWidth="2"
                  />
                </>
              ) : (
                points.map((p) => (
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
                  </g>
                ))
              )}

              {points.map((p) => (
                <rect
                  key={`hit-${p.id}`}
                  x={p.xStart}
                  y="0"
                  width={dimensions.width / points.length}
                  height="100%"
                  fill="transparent"
                  onMouseEnter={() => !isDragging && setHoveredItem(p)}
                />
              ))}

              {mousePos.active && !isDragging && (
                <>
                  <line
                    x1={snapX}
                    y1="0"
                    x2={snapX}
                    y2="100%"
                    className="crosshair-line"
                  />
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

            {mousePos.active && !isDragging && hoveredItem && (
              <div
                className="floating-tooltip"
                style={{
                  left: snapX > dimensions.width / 2 ? snapX - 180 : snapX + 20,
                  top:
                    mousePos.y > dimensions.height / 2
                      ? mousePos.y - 150
                      : mousePos.y + 10,
                }}
              >
                <div className="tooltip-date">{hoveredItem.timestamp}</div>
                {dataSource === "comparison" ? (
                  <>
                    <div className="tooltip-row" style={{ color: "#6366f1" }}>
                      <span>Uniswap:</span>
                      <span className="font-mono">
                        {hoveredItem.uniClose.toFixed(2)}
                      </span>
                    </div>
                    <div className="tooltip-row" style={{ color: "#f0b90b" }}>
                      <span>Binance:</span>
                      <span className="font-mono">
                        {hoveredItem.binClose.toFixed(2)}
                      </span>
                    </div>
                    <div
                      className="tooltip-row"
                      style={{
                        borderTop: "1px solid #333",
                        marginTop: 4,
                        paddingTop: 4,
                      }}
                    >
                      <span>Spread:</span>
                      <span
                        className={`font-mono ${
                          hoveredItem.spread >= 0 ? "text-up" : "text-down"
                        }`}
                      >
                        {hoveredItem.spread.toFixed(2)}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="tooltip-row">
                      <span>Open:</span>
                      <span className="font-mono">
                        {hoveredItem.open.toFixed(2)}
                      </span>
                    </div>
                    <div className="tooltip-row">
                      <span>High:</span>
                      <span className="font-mono">
                        {hoveredItem.high.toFixed(2)}
                      </span>
                    </div>
                    <div className="tooltip-row">
                      <span>Low:</span>
                      <span className="font-mono">
                        {hoveredItem.low.toFixed(2)}
                      </span>
                    </div>
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
                  </>
                )}
              </div>
            )}

            <div className="x-axis">
              {points
                .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
                .map((p) => (
                  <span key={p.id} style={{ left: p.x }}>
                    {p.displayTime}
                  </span>
                ))}
            </div>
          </div>
        </section>

        <aside className="table-card">
          <div className="table-header">
            <h3>
              {dataSource === "comparison"
                ? "Spread Analysis"
                : "Market Trades"}
            </h3>
          </div>
          <div className="table-body">
            <table>
              <thead>
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-right">
                    {dataSource === "comparison" ? "Spread" : "Price"}
                  </th>
                  <th className="text-right">
                    {dataSource === "comparison" ? "Uni Price" : "Amount"}
                  </th>
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
                    {dataSource === "comparison" ? (
                      <>
                        <td
                          className={`text-right ${
                            row.spread >= 0 ? "text-up" : "text-down"
                          }`}
                        >
                          {row.spread.toFixed(2)}
                        </td>
                        <td className="text-right text-normal">
                          {row.uniClose.toFixed(0)}
                        </td>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
