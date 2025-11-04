import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    console.log('Search query:', searchQuery);
    // TODO: 实现搜索功能
    setShowSearch(false);
    setSearchQuery('');
  };

  return (
    <nav className="navbar">
      <div className="navbar-content">
        {/* Logo and Brand */}
        <div className="navbar-left">
          <div className="logo" onClick={() => navigate('/info')}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 16L16 20L20 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="brand-name">Trans</span>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="navbar-center">
          <button 
            className={`nav-link ${isActive('/price-dashboard') ? 'active' : ''}`}
            onClick={() => navigate('/price-dashboard')}
          >
            价格看板
          </button>
          <button 
            className={`nav-link ${isActive('/arbitrage-analysis') ? 'active' : ''}`}
            onClick={() => navigate('/arbitrage-analysis')}
          >
            套利分析
          </button>
        </div>

        {/* Action Buttons */}
        <div className="navbar-right">
          <button 
            className="icon-button"
            onClick={() => setShowSearch(!showSearch)}
            title="搜索"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <button 
            className={`icon-button ${isActive('/info') ? 'active' : ''}`}
            onClick={() => navigate('/info')}
            title="项目信息"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="10" cy="7" r="0.5" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="search-container">
          <form onSubmit={handleSearch} className="search-form">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button type="button" onClick={() => setShowSearch(false)} className="close-search">
              ×
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}

export default Navbar;

