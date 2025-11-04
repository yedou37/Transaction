import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [healthStatus, setHealthStatus] = useState('checking...');
  const [dbStatus, setDbStatus] = useState('checking...');

  useEffect(() => {
    // 检查后端健康状况
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealthStatus(data.status))
      .catch(() => setHealthStatus('Error'));

    // 检查数据库连接
    fetch('/api/db-check')
      .then(res => res.json())
      .then(data => setDbStatus(data.db_status))
      .catch(() => setDbStatus('Error'));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>区块链非原子套利分析</h1>
        <p>后端服务状态: <strong>{healthStatus}</strong></p>
        <p>数据库连接状态: <strong>{dbStatus}</strong></p>
        
        {/* 在这里你将添加你的可视化图表和分析结果 */}

      </header>
    </div>
  );
}

export default App;