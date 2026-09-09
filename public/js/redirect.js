/**
 * redirect.js - 智慧網址轉換與相容路由模組
 * 用途：自動將舊式扁平網址導向至新版資料夾分類網址（youth/, farm/, seed/），確保歷史連結與書籤不失效。
 */

(function () {
  'use strict';

  const URL_REDIRECT_MAP = {
    // 青年部模組
    '/list.html': '/youth/list.html',
    '/list': '/youth/list.html',
    '/admin.html': '/youth/admin.html',
    '/admin': '/youth/admin.html',
    '/group.html': '/youth/group.html',
    '/group': '/youth/group.html',
    '/seminar.html': '/youth/seminar.html',
    '/seminar': '/youth/seminar.html',
    '/lineage.html': '/youth/lineage.html',
    '/lineage': '/youth/lineage.html',

    // 自然農法模組
    '/natural-farm.html': '/farm/natural-farm.html',
    '/natural-farm': '/farm/natural-farm.html',
    '/natural-farm-admin.html': '/farm/natural-farm-admin.html',
    '/natural-farm-admin': '/farm/natural-farm-admin.html',

    // 種子交換會模組
    '/change.html': '/seed/change.html',
    '/change': '/seed/change.html'
  };

  /**
   * 取得新目標網址
   * @param {string} pathname 
   * @returns {string|null}
   */
  function getRedirectTarget(pathname) {
    if (!pathname) return null;
    
    // 標準化 pathname（移除尾隨斜線以利比對，但保留根目錄）
    const cleanPath = pathname.length > 1 && pathname.endsWith('/') 
      ? pathname.slice(0, -1) 
      : pathname;

    if (URL_REDIRECT_MAP[cleanPath]) {
      return URL_REDIRECT_MAP[cleanPath];
    }

    // 若路徑在某一子資料夾下被錯誤請求，比對檔名結尾
    const filename = cleanPath.substring(cleanPath.lastIndexOf('/'));
    if (URL_REDIRECT_MAP[filename]) {
      return URL_REDIRECT_MAP[filename];
    }

    return null;
  }

  /**
   * 檢查當前網址並執行即時跳轉
   * @returns {boolean} 是否觸發了轉址
   */
  function handleRedirect() {
    try {
      const currentPath = window.location.pathname;
      const target = getRedirectTarget(currentPath);

      if (target && target !== currentPath) {
        console.info(`[URLRedirector] 正在將 ${currentPath} 轉向至 ${target}`);
        const newUrl = target + window.location.search + window.location.hash;
        window.location.replace(newUrl);
        return true;
      }
    } catch (e) {
      console.error('[URLRedirector] 轉址處理異常:', e);
    }
    return false;
  }

  // 立即執行轉址檢查
  handleRedirect();

  // 暴露公開 API 供頁面或除錯使用
  window.URLRedirector = {
    map: URL_REDIRECT_MAP,
    getTarget: getRedirectTarget,
    check: handleRedirect
  };
})();
