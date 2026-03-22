import { nationalHeritageLinks, provincialHeritageLinks } from '../lib/officialLinks';

const renderLinkItem = (item: { region: string; agency: string; url: string; kind: string }) => (
  <li key={`${item.region}-${item.agency}`} className="official-link-item">
    <a className="official-link-anchor" href={item.url} target="_blank" rel="noreferrer noopener">
      <span className="official-link-title">
        {item.region} · {item.agency}
      </span>
      <span className="official-link-meta">{item.kind} ↗</span>
    </a>
  </li>
);

export default function OfficialHeritageLinks() {
  return (
    <section className="official-links-strip" aria-label="文保单位官方入口">
      <div className="official-links-header">
        <div className="official-links-title">文保单位官方入口</div>
        <div className="official-links-sub">
          全国 + 各省（区、市）官方入口，按条目逐条跳转。若页面无直接名单，可在站内搜索“文物保护单位”。
        </div>
      </div>

      <div className="official-links-columns">
        <div className="official-links-panel">
          <div className="official-links-panel-title">全国入口</div>
          <ul className="official-links-list">{nationalHeritageLinks.map((item) => renderLinkItem(item))}</ul>
        </div>

        <div className="official-links-panel official-links-panel--scroll">
          <div className="official-links-panel-title">各省（区、市）入口</div>
          <ul className="official-links-list">{provincialHeritageLinks.map((item) => renderLinkItem(item))}</ul>
        </div>
      </div>
    </section>
  );
}
