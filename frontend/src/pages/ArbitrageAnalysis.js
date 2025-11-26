import React, { useEffect, useState } from 'react';
import './ArbitrageAnalysis.css';

// API基础URL（根据项目配置调整）
const DEFAULT_API_BASE = 'http://127.0.0.1:8000/api';
const API_BASE_URL = process.env.REACT_APP_API_URL || DEFAULT_API_BASE;

function ArbitrageAnalysis() {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 统计数据
  const [statistics, setStatistics] = useState({
    totalOpportunities: 0,
    totalProfit: 0,
    averageProfitRate: 0
  });
  
  // 套利机会列表
  const [opportunities, setOpportunities] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    minProfit: '',
    sortBy: 'profit', // profit, timestamp
    sortOrder: 'desc' // asc, desc
  });

  // 获取统计数据
  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/arbitrage/statistics`);
      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }
      const data = await response.json();
      setStatistics({
        totalOpportunities: data.total_opportunities || 0,
        totalProfit: data.total_profit || 0,
        averageProfitRate: data.average_profit_rate || 0
      });
    } catch (err) {
      console.error('获取统计数据错误:', err);
      setError('获取统计数据失败，请稍后重试');
    }
  };

  // 获取套利机会列表
  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        sort_by: filters.sortBy,
        sort_order: filters.sortOrder
      });
      
      if (filters.minProfit) {
        params.append('min_profit', filters.minProfit);
      }
      
      const response = await fetch(`${API_BASE_URL}/arbitrage/opportunities?${params}`);
      if (!response.ok) {
        throw new Error('获取套利机会列表失败');
      }
      const data = await response.json();
      setOpportunities(data.opportunities || []);
      setTotalPages(data.total_pages || 1);
      setError(null);
    } catch (err) {
      console.error('获取套利机会列表错误:', err);
      setError('获取套利机会列表失败，请稍后重试');
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载数据
  useEffect(() => {
    fetchStatistics();
    fetchOpportunities();
  }, []);

  // 当筛选条件或页码改变时重新获取数据
  useEffect(() => {
    if (currentPage === 1) {
      fetchOpportunities();
    } else {
      setCurrentPage(1);
    }
  }, [filters]);

  useEffect(() => {
    fetchOpportunities();
  }, [currentPage]);

  // 处理滚动
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 格式化日期时间
  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 格式化数字
  const formatNumber = (num, decimals = 2) => {
    if (num === null || num === undefined) return '-';
    return Number(num).toLocaleString('zh-CN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  // 格式化利润显示
  const formatProfit = (profit) => {
    if (profit === null || profit === undefined) return '-';
    const num = Number(profit);
    if (num >= 0) {
      return `+${formatNumber(num, 4)} USDT`;
    }
    return `${formatNumber(num, 4)} USDT`;
  };

  return (
    <div className="page-container">
      {/* Hero Section - Full Screen */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">套利分析</h1>
          <p className="hero-subtitle">非原子套利行为识别与利润分析</p>
          
          {/* 统计卡片 */}
          <div className="analysis-placeholder">
            <div className="animated-analysis">
              <div className="data-card card-1">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">识别套利次数</div>
                  <div className="metric-value">
                    {loading ? '---' : formatNumber(statistics.totalOpportunities, 0)}
                  </div>
                </div>
              </div>
              <div className="data-card card-2">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">总潜在利润</div>
                  <div className="metric-value">
                    {loading ? '--- USDT' : `${formatNumber(statistics.totalProfit, 2)} USDT`}
                  </div>
                </div>
              </div>
              <div className="data-card card-3">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">平均利润率</div>
                  <div className="metric-value">
                    {loading ? '---%' : `${formatNumber(statistics.averageProfitRate, 2)}%`}
                  </div>
                </div>
              </div>
              <div className="connection-line line-1"></div>
              <div className="connection-line line-2"></div>
            </div>
          </div>

          {/* Scroll Indicator */}
          <div className="scroll-indicator">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M12 19L5 12M12 19L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>向下滑动查看更多</span>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="content-section">
        <div className="content-wrapper">
          <h2 className="section-title">分析结果</h2>
          
          {/* 错误提示 */}
          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{error}</span>
              <button onClick={() => { fetchStatistics(); fetchOpportunities(); }}>重试</button>
            </div>
          )}

          {/* 筛选器 */}
          <div className="filters-container">
            <div className="filter-group">
              <label htmlFor="minProfit">最小利润 (USDT):</label>
              <input
                id="minProfit"
                type="number"
                placeholder="0"
                step="0.01"
                value={filters.minProfit}
                onChange={(e) => setFilters({ ...filters, minProfit: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="sortBy">排序方式:</label>
              <select
                id="sortBy"
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              >
                <option value="profit">按利润</option>
                <option value="buy_timestamp">按买入时间</option>
                <option value="sell_timestamp">按卖出时间</option>
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="sortOrder">排序顺序:</label>
              <select
                id="sortOrder"
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value })}
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
            <button 
              className="reset-filters-btn"
              onClick={() => setFilters({ minProfit: '', sortBy: 'profit', sortOrder: 'desc' })}
            >
              重置筛选
            </button>
          </div>

          {/* 套利机会表格 */}
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>加载中...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p>暂无套利机会数据</p>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="opportunities-table">
                  <thead>
                    <tr>
                      <th>交易哈希</th>
                      <th>买入时间</th>
                      <th>卖出时间</th>
                      <th>Uniswap 价格</th>
                      <th>Binance 价格</th>
                      <th>价格差 (%)</th>
                      <th>潜在利润 (USDT)</th>
                      <th>利润率 (%)</th>
                      <th>交易量 (ETH)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp, index) => (
                      <tr key={opp.id || index}>
                        <td className="tx-hash">
                          {opp.transaction_hash ? (
                            <a
                              href={`https://etherscan.io/tx/${opp.transaction_hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={opp.transaction_hash}
                            >
                              {opp.transaction_hash.slice(0, 10)}...{opp.transaction_hash.slice(-8)}
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>{formatDateTime(opp.buy_timestamp)}</td>
                        <td>{formatDateTime(opp.sell_timestamp)}</td>
                        <td>{formatNumber(opp.uniswap_price, 4)}</td>
                        <td>{formatNumber(opp.binance_price, 4)}</td>
                        <td className={opp.price_diff_percent >= 0 ? 'positive' : 'negative'}>
                          {opp.price_diff_percent >= 0 ? '+' : ''}{formatNumber(opp.price_diff_percent, 2)}%
                        </td>
                        <td className={opp.profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {formatProfit(opp.profit)}
                        </td>
                        <td className={opp.profit_rate >= 0 ? 'positive' : 'negative'}>
                          {opp.profit_rate >= 0 ? '+' : ''}{formatNumber(opp.profit_rate, 2)}%
                        </td>
                        <td>{formatNumber(opp.volume, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页器 */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span className="pagination-info">
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default ArbitrageAnalysis;

