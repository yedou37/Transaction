// 搜索数据配置 - 定义所有页面的可搜索内容
export const searchableContent = [
  // 价格看板页面
  {
    page: '/price-dashboard',
    pageName: '价格看板',
    items: [
      {
        title: '价格看板',
        content: 'Uniswap V3 与 Binance 历史成交数据可视化',
        keywords: ['价格', '看板', 'Uniswap', 'Binance', '历史', '成交', '数据', '可视化']
      },
      {
        title: '数据分析',
        content: '查看详细的价格数据分析',
        keywords: ['数据', '分析', '价格']
      }
    ]
  },
  // 套利分析页面
  {
    page: '/arbitrage-analysis',
    pageName: '套利分析',
    items: [
      {
        title: '套利分析',
        content: '非原子套利行为识别与利润分析',
        keywords: ['套利', '分析', '非原子', '行为', '识别', '利润']
      },
      {
        title: '识别套利次数',
        content: '系统识别的套利交易次数统计',
        keywords: ['识别', '套利', '次数', '统计']
      },
      {
        title: '总潜在利润',
        content: '所有套利交易的潜在利润总和（USDT）',
        keywords: ['总', '潜在', '利润', 'USDT', '收益']
      },
      {
        title: '平均利润率',
        content: '套利交易的平均利润率统计',
        keywords: ['平均', '利润率', '统计', '收益率']
      },
      {
        title: '分析结果',
        content: '查看详细的套利分析结果',
        keywords: ['分析', '结果', '详细']
      }
    ]
  },
  // 项目信息页面
  {
    page: '/info',
    pageName: '项目信息',
    items: [
      {
        title: 'Trans - 区块链非原子套利交易识别系统',
        content: '区块链非原子套利交易识别系统',
        keywords: ['Trans', '区块链', '非原子', '套利', '交易', '识别', '系统']
      },
      {
        title: '项目概述',
        content: '交易者利用去中心化交易所（DEX）和中心化交易所（CEX）之间同一代币的价格差，执行非原子套利来获得利润。本项目以 Uniswap V3 和 Binance 之间的 USDT/ETH 交易对为研究对象。',
        keywords: ['项目', '概述', 'DEX', 'CEX', '去中心化', '中心化', '交易所', '代币', '价格差', 'Uniswap', 'Binance', 'USDT', 'ETH', '交易对']
      },
      {
        title: '核心功能 - 价格看板',
        content: '展示 2025 年 9 月期间，Uniswap V3（USDT/ETH池）与 Binance（USDT/ETH 交易对）的历史成交数据，并对两者价格变化进行可视化对比。',
        keywords: ['核心', '功能', '价格', '看板', '历史', '成交', '数据', '可视化', '对比']
      },
      {
        title: '核心功能 - 套利分析',
        content: '对 Uniswap V3 与 Binance 之间的 USDT/ETH 交易数据进行分析，识别非原子套利行为，并计算潜在获利金额（以 USDT 为单位）。',
        keywords: ['核心', '功能', '套利', '分析', '识别', '计算', '获利', '潜在']
      },
      {
        title: '技术栈 - React',
        content: 'React 是一个用于构建用户界面的 JavaScript 库。本项目使用 React 作为前端框架，构建了价格看板、套利分析等交互式页面。',
        keywords: ['技术栈', 'React', 'JavaScript', '前端', '框架', '组件', '虚拟DOM']
      },
      {
        title: '技术栈 - Python FastAPI',
        content: 'FastAPI 是一个现代、快速（高性能）的 Web 框架，用于构建 API。本项目使用 FastAPI 构建后端服务，提供数据查询和套利分析接口。',
        keywords: ['技术栈', 'Python', 'FastAPI', '后端', 'API', 'Web', '框架', '高性能']
      },
      {
        title: '技术栈 - PostgreSQL',
        content: 'PostgreSQL 是一个功能强大的开源关系型数据库系统。本项目使用 PostgreSQL 存储 Uniswap V3 和 Binance 的历史交易数据。',
        keywords: ['技术栈', 'PostgreSQL', '数据库', '关系型', '开源', '存储', '数据']
      },
      {
        title: '技术栈 - Docker',
        content: 'Docker 是一个开源的容器化平台，用于开发、交付和运行应用程序。本项目使用 Docker 容器化部署前端、后端和数据库服务。',
        keywords: ['技术栈', 'Docker', '容器', '部署', '开源', '平台']
      },
      {
        title: '技术栈 - Nginx',
        content: 'Nginx 是一个高性能的 HTTP 和反向代理服务器。本项目使用 Nginx 作为 Web 服务器，负责前端静态资源的托管和后端 API 的反向代理。',
        keywords: ['技术栈', 'Nginx', 'Web服务器', '反向代理', 'HTTP', '高性能']
      },
      {
        title: '数据来源 - Uniswap V3',
        content: '对 Uniswap V3 上 USDT/ETH 池进行分析，以太坊合约地址：0x11b815efB8f581194ae79006d24E0d814B7697F6',
        keywords: ['数据来源', 'Uniswap', '以太坊', '合约', '地址', 'Etherscan']
      },
      {
        title: '数据来源 - API 文档',
        content: '获取交易数据的 API 参考文档，包括 Dune、The Graph、Binance API、Etherscan',
        keywords: ['数据来源', 'API', '文档', 'Dune', 'Graph', 'Binance', 'Etherscan']
      },
      {
        title: '参考文献',
        content: '学术研究参考文献，包括非原子套利和 MEV 相关研究',
        keywords: ['参考', '文献', '学术', '研究', 'MEV', '论文']
      }
    ]
  }
];

// 搜索函数
export function searchContent(query) {
  if (!query || query.trim() === '') {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const results = [];

  searchableContent.forEach(page => {
    page.items.forEach(item => {
      // 检查标题、内容或关键词是否匹配
      const titleMatch = item.title.toLowerCase().includes(normalizedQuery);
      const contentMatch = item.content.toLowerCase().includes(normalizedQuery);
      const keywordMatch = item.keywords.some(keyword => 
        keyword.toLowerCase().includes(normalizedQuery)
      );

      if (titleMatch || contentMatch || keywordMatch) {
        // 计算匹配分数（用于排序）
        let score = 0;
        if (titleMatch) score += 3; // 标题匹配权重最高
        if (contentMatch) score += 2;
        if (keywordMatch) score += 1;

        results.push({
          page: page.page,
          pageName: page.pageName,
          title: item.title,
          content: item.content,
          score: score
        });
      }
    });
  });

  // 按分数降序排序
  return results.sort((a, b) => b.score - a.score);
}

