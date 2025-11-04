import React, { useEffect, useState } from 'react';
import './ArbitrageAnalysis.css';

function ArbitrageAnalysis() {
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
          <h1 className="hero-title">套利分析</h1>
          <p className="hero-subtitle">非原子套利行为识别与利润分析</p>
          
          {/* 数据分析动画占位 */}
          <div className="analysis-placeholder">
            <div className="animated-analysis">
              <div className="data-card card-1">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">识别套利次数</div>
                  <div className="metric-value">---</div>
                </div>
              </div>
              <div className="data-card card-2">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">总潜在利润</div>
                  <div className="metric-value">--- USDT</div>
                </div>
              </div>
              <div className="data-card card-3">
                <div className="card-shimmer"></div>
                <div className="card-content">
                  <div className="metric-label">平均利润率</div>
                  <div className="metric-value">---%</div>
                </div>
              </div>
              <div className="connection-line line-1"></div>
              <div className="connection-line line-2"></div>
            </div>
            <p className="placeholder-text">全屏数据分析展示区域</p>
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
          <h2 className="section-title">详细分析结果</h2>
          <div className="todo-placeholder">
            <p>TODO</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ArbitrageAnalysis;

