import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // 当路径改变时，滚动到页面顶部
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // 使用 instant 而不是 smooth，确保立即跳转
    });
  }, [pathname]); // 只在 pathname 改变时触发

  return null;
}

export default ScrollToTop;

