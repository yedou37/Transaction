import React, { useEffect, useState } from 'react';
import './PriceDashboard.css';

function PriceDashboard() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="page-container">
      {/* Hero Section - Full Screen */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">价格看板</h1>
          <p className="hero-subtitle">Uniswap V3 与 Binance 历史成交数据可视化</p>
          
          {/* 酷炫动画占位 */}
          <div className="chart-placeholder">
            <div className="animated-chart">
              <div className="chart-line line-1"></div>
              <div className="chart-line line-2"></div>
              <div className="chart-dot dot-1"></div>
              <div className="chart-dot dot-2"></div>
              <div className="chart-dot dot-3"></div>
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
          <h2 className="section-title">数据分析</h2>
          <div className="todo-placeholder">
            <p>TODO</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PriceDashboard;

