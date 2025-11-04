import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import PriceDashboard from './pages/PriceDashboard';
import ArbitrageAnalysis from './pages/ArbitrageAnalysis';
import Info from './pages/Info';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Navigate to="/info" replace />} />
          <Route path="/price-dashboard" element={<PriceDashboard />} />
          <Route path="/arbitrage-analysis" element={<ArbitrageAnalysis />} />
          <Route path="/info" element={<Info />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
