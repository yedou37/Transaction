import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { searchContent } from '../utils/searchData';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef(null);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // 监听搜索输入变化
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
    } else {
      const results = searchContent(searchQuery);
      setSearchResults(results);
    }
  }, [searchQuery]);

  // 点击外部关闭搜索框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearch(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
  };

  const handleResultClick = (page) => {
    navigate(page);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // 高亮匹配的文本
  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={index}>{part}</mark>
        : part
    );
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
        <div className="search-container" ref={searchRef}>
          <form onSubmit={handleSearch} className="search-form">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M14 14L18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="输入搜索内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <button type="button" onClick={handleCloseSearch} className="close-search">
              ×
            </button>
          </form>

          {/* 搜索结果 */}
          {searchQuery.trim() !== '' && (
            <div className="search-results">
              {searchResults.length > 0 ? (
                <>
                  <div className="search-results-header">
                    找到 {searchResults.length} 个结果
                  </div>
                  <div className="search-results-list">
                    {searchResults.map((result, index) => (
                      <div 
                        key={index} 
                        className="search-result-item"
                        onClick={() => handleResultClick(result.page)}
                      >
                        <div className="search-result-badge">{result.pageName}</div>
                        <div className="search-result-title">
                          {highlightText(result.title, searchQuery)}
                        </div>
                        <div className="search-result-content">
                          {highlightText(result.content, searchQuery)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="search-no-results">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M11 8v6M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  <p>没有找到对应结果</p>
                  <span>尝试使用其他关键词</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

export default Navbar;

