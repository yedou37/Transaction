import React, { useState } from 'react';
import './Info.css';

function Info() {
  const [selectedTech, setSelectedTech] = useState(0);

  const techStack = [
    {
      name: 'React',
      description: 'React 是一个用于构建用户界面的 JavaScript 库。本项目使用 React 作为前端框架，构建了价格看板、套利分析等交互式页面。React 的组件化开发模式和高效的虚拟 DOM 机制，使得应用具有出色的性能和良好的可维护性。',
      logo: (
        <svg viewBox="-11.5 -10.23174 23 20.46348" fill="#61dafb">
          <circle cx="0" cy="0" r="2.05" fill="#61dafb"/>
          <g stroke="#61dafb" strokeWidth="1" fill="none">
            <ellipse rx="11" ry="4.2"/>
            <ellipse rx="11" ry="4.2" transform="rotate(60)"/>
            <ellipse rx="11" ry="4.2" transform="rotate(120)"/>
          </g>
        </svg>
      )
    },
    {
      name: 'Python FastAPI',
      description: 'FastAPI 是一个现代、快速（高性能）的 Web 框架，用于构建 API。本项目使用 FastAPI 构建后端服务，提供数据查询和套利分析接口。FastAPI 基于标准 Python 类型提示，具有自动数据验证、API 文档生成等特性，开发效率极高。',
      logo: (
        <svg viewBox="0 0 154 154" fill="none">
          <circle cx="77" cy="77" r="77" fill="#05998B"/>
          <path d="M81.375 18.667l-38.75 70H77.5l-3.875 46.666 38.75-70H77.5z" fill="white"/>
        </svg>
      )
    },
    {
      name: 'PostgreSQL',
      description: 'PostgreSQL 是一个功能强大的开源关系型数据库系统。本项目使用 PostgreSQL 存储 Uniswap V3 和 Binance 的历史交易数据，支持复杂的查询和数据分析。PostgreSQL 的高可靠性、数据完整性和丰富的数据类型，为套利分析提供了坚实的数据基础。',
      logo: (
        <svg viewBox="0 0 432.071 445.383" fill="#336791">
          <path d="M323.205 324.227c2.833-23.601 1.984-27.062 19.563-23.239l4.463.392c13.517.615 31.199-2.174 41.587-7 22.362-10.376 35.622-27.7 13.572-23.148-50.297 10.376-53.755-6.655-53.755-6.655 53.111-78.803 75.313-178.836 56.149-203.322C352.514-5.534 262.036 26.049 260.522 26.869l-.482.089c-9.938-2.062-21.06-3.294-33.554-3.496-22.761-.374-40.032 5.967-53.133 15.904 0 0-161.408-66.498-153.899 83.628 1.597 31.936 45.777 241.655 98.47 178.31 19.259-23.163 37.871-42.748 37.871-42.748 9.242 6.14 20.307 9.272 31.912 8.147l.897-.765c-.281 2.876-.157 5.689.359 9.019-13.572 15.167-9.584 17.83-36.723 23.416-27.457 5.659-11.326 15.734-.797 18.367 12.768 3.193 42.305 7.716 62.268-20.224l-.795 3.188c5.325 4.26 4.965 30.619 5.72 49.452.756 18.834 1.578 36.11 3.902 46.254 2.323 10.144 5.545 28.535 28.525 22.663 19.375-4.946 29.282-23.984 30.417-52.763 1.136-28.779 1.336-31.936 2.724-55.297l.747-27.033c-.878 50.287 1.438 75.7 3.762 85.843 2.324 10.144 5.545 28.535 28.525 22.663 19.375-4.946 30.417-23.984 30.417-52.763 0-28.779.336-31.936 2.724-55.297l.747-27.033zm-117.993-5.536c-11.326 0-20.307-9.272-20.307-20.598 0-11.325 8.981-20.597 20.307-20.597 11.326 0 20.307 9.272 20.307 20.597 0 11.326-8.981 20.598-20.307 20.598z"/>
        </svg>
      )
    },
    {
      name: 'Docker',
      description: 'Docker 是一个开源的容器化平台，用于开发、交付和运行应用程序。本项目使用 Docker 容器化部署前端、后端和数据库服务，实现了一键部署和环境隔离。Docker 的轻量级和可移植性，使得应用可以在任何环境中稳定运行。',
      logo: (
        <svg viewBox="0 0 512 512" fill="#2496ED">
          <path d="M507 211.16c-1.42-1.19-14.25-10.94-41.79-10.94a132.55 132.55 0 0 0-21.61 1.9c-5.22-36.4-35.38-54-36.57-55l-7.36-4.28-4.75 6.9a101.65 101.65 0 0 0-13.06 30.45c-5 20.7-1.9 40.2 8.55 56.85-12.59 7.14-33 8.8-37.28 9H15.94A15.93 15.93 0 0 0 0 262.07a241.25 241.25 0 0 0 14.75 86.83C26.39 379.35 43.72 402 66 415.74 91.22 431.2 132.3 440 178.6 440a344.23 344.23 0 0 0 62.45-5.71 257.44 257.44 0 0 0 81.69-29.73 223.55 223.55 0 0 0 55.57-45.67c26.83-30.21 42.74-64 54.38-94h4.75c29.21 0 47.26-11.66 57.23-21.65a63.31 63.31 0 0 0 15.2-22.36l2.14-6.18z"/>
        </svg>
      )
    },
    {
      name: 'Nginx',
      description: 'Nginx 是一个高性能的 HTTP 和反向代理服务器。本项目使用 Nginx 作为 Web 服务器，负责前端静态资源的托管和后端 API 的反向代理。Nginx 的高并发处理能力和灵活的配置选项，保证了应用的高可用性和访问速度。',
      logo: (
        <svg viewBox="0 0 512 512" fill="#009639">
          <path d="M386.5 0h-261C56.4 0 0 56.4 0 125.5v261C0 455.6 56.4 512 125.5 512h261c69.1 0 125.5-56.4 125.5-125.5v-261C512 56.4 455.6 0 386.5 0zM391.6 338.8c0 15.4-8.4 29.5-21.9 37.1-13.5 7.6-30.1 7.6-43.6 0L210.9 294c-6.7-3.9-10.9-11-10.9-18.6V139c0-15.4 8.4-29.5 21.9-37.1 13.5-7.6 30.1-7.6 43.6 0l115.2 81.9c6.7 3.9 10.9 11 10.9 18.6v136.4z"/>
        </svg>
      )
    }
  ];

  return (
    <div className="info-container">
      <div className="info-hero">
        <div className="info-hero-content">
          <div className="logo-large">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="35" stroke="url(#gradient)" strokeWidth="3"/>
              <path d="M30 40L38 48L50 30" stroke="url(#gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#a855f7"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="info-title">Trans</h1>
          <p className="info-tagline">区块链非原子套利交易识别系统</p>
        </div>
      </div>

      <div className="info-content">
        <div className="info-section">
          <h2 className="section-heading" style={{ color: 'darkgray'}}>项目概述</h2>
          <div className="info-card">
            <p className="info-text">
              交易者利用去中心化交易所（DEX）和中心化交易所（CEX）之间同一代币的价格差，执行非原子套利（Non-Atomic Arbitrage）来获得利润。
              与原子套利不同，非原子套利的交易不是在一个区块或一笔交易中完成的，因此存在一定的风险，比如价格变化或交易延迟。
            </p>
            <p className="info-text">
              本项目以 Uniswap V3 和 Binance 之间的 USDT/ETH 交易对为研究对象，通过对两边的价格数据进行分析，尝试识别其中可能存在的非原子套利行为。
            </p>
          </div>
        </div>

        <div className="info-section">
          <h2 className="section-heading">核心功能</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <path d="M3 3v18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 16l4-4 4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3 className="feature-title">价格看板</h3>
              <p className="feature-description">
                展示 2025 年 9 月期间，Uniswap V3（USDT/ETH池）与 Binance（USDT/ETH 交易对）的历史成交数据，并对两者价格变化进行可视化对比。
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3 className="feature-title">套利分析</h3>
              <p className="feature-description">
                对 Uniswap V3 与 Binance 之间的 USDT/ETH 交易数据进行分析，识别非原子套利行为，并计算潜在获利金额（以 USDT 为单位）。
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack Section - Full Width */}
      </div>

      <div className="tech-stack-section">
        <div className="tech-stack-container">
          <h2 className="tech-stack-heading">技术栈</h2>
          
          <div className="tech-selector-bar">
            <div className="tech-tabs">
              {techStack.map((tech, index) => (
                <button
                  key={index}
                  className={`tech-tab ${selectedTech === index ? 'active' : ''}`}
                  onClick={() => setSelectedTech(index)}
                >
                  {tech.name}
                </button>
              ))}
            </div>
            <div 
              className="tech-slider" 
              style={{
                transform: `translateX(calc(${selectedTech * 100}% + ${selectedTech * 8}px))`,
                width: `calc(${100 / techStack.length}% - 10px)`
              }}
            />
          </div>

          <div className="tech-detail">
            <div className="tech-logo">
              {techStack[selectedTech].logo}
            </div>
            <div className="tech-description">
              <h3>{techStack[selectedTech].name}</h3>
              <p>{techStack[selectedTech].description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="info-content-after">
        <div className="info-section">
          <div className="references-section">
            {/* 数据来源 */}
            <div className="reference-row">
              <div className="reference-label">数据来源</div>
              <div className="reference-content">
                <div className="reference-item">
                  <p className="reference-number">1.</p>
                  <div>
                    <p>对 Uniswap V3 上其中一个 USDT/ETH 池进行分析</p>
                    <p>• 以太坊合约地址：0x11b815efB8f581194ae79006d24E0d814B7697F6</p>
                    <p>• 可通过如下链接查看：
                      <a 
                        href="https://goto.etherscan.com/address/0x11b815efb8f581194ae79006d24e0d814b7697f6" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="reference-link"
                      >
                        https://goto.etherscan.com/address/0x11b815efb8f581194ae79006d24e0d814b7697f6
                      </a>
                    </p>
                  </div>
                </div>
                <div className="reference-item">
                  <p className="reference-number">2.</p>
                  <div>
                    <p>获取交易数据的 API 参考文档</p>
                    <p>
                      <a href="https://dune.com/home" target="_blank" rel="noopener noreferrer" className="reference-link">https://dune.com/home</a>
                    </p>
                    <p>
                      <a href="https://thegraph.com/docs/zh/" target="_blank" rel="noopener noreferrer" className="reference-link">https://thegraph.com/docs/zh/</a>
                    </p>
                    <p>
                      <a href="https://github.com/binance/binance-spot-api-docs" target="_blank" rel="noopener noreferrer" className="reference-link">https://github.com/binance/binance-spot-api-docs</a>
                    </p>
                    <p>
                      <a href="https://docs.etherscan.io/" target="_blank" rel="noopener noreferrer" className="reference-link">https://docs.etherscan.io/</a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 参考文献 */}
            <div className="reference-row">
              <div className="reference-label">参考文献</div>
              <div className="reference-content">
                <div className="reference-item">
                  <p className="reference-number">[1]</p>
                  <p>Heimbach L, Pahari V, Schertenleib E. Non-atomic arbitrage in decentralized finance[C]//2024 IEEE Symposium on Security and Privacy (SP). IEEE, 2024: 3866-3884.</p>
                </div>
                <div className="reference-item">
                  <p className="reference-number">[2]</p>
                  <p>Wu F, Sui D, Thiery T, et al. Measuring CEX-DEX Extracted Value and Searcher Profitability: The Darkest of the MEV Dark Forest[J]. arXiv preprint arXiv:2507.13023, 2025.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Info;

