export default function TombDetailLoading() {
  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>加载详情中…</h1>
            <div className="detail-page-meta">正在获取古墓基础信息</div>
            <div className="detail-page-meta">摘要与相关推荐会稍后补全</div>
          </div>
        </div>
        <div className="detail-page-section">
          <h3>简介</h3>
          <p>加载中…</p>
        </div>
        <div className="detail-page-section">
          <h3>文保信息</h3>
          <p>加载中…</p>
        </div>
      </div>
    </div>
  );
}
