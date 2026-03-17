'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { getChinaDateKey, getDailyHotSearchItems, type HotSearchItem } from '../lib/hotSearch';

type HotSearchPanelProps = {
  onApply: (patch: HotSearchItem['apply']) => void;
  compact?: boolean;
  count?: number;
};

const kindLabel: Record<HotSearchItem['type'], string> = {
  person: '人物',
  city: '城市',
  dynasty: '朝代',
  province: '省份'
};

const chipLayout = (index: number, compact: boolean) => {
  if (compact) {
    const span = [2, 2, 3, 3, 2, 4, 2, 2, 3, 2, 3, 2][index % 12];
    const lift = [0, 2, 1, 3, 1, 2][index % 6];
    const accent = index % 3;
    return { span, lift, tilt: 0, accent };
  }
  const span = [3, 2, 4, 3, 2, 3][index % 6];
  const lift = [-2, 6, 0, 10, 2, 8][index % 6];
  const tilt = [-0.6, 0.35, 0.0, 0.45, -0.25, 0.2][index % 6];
  const accent = index % 3;
  return { span, lift, tilt, accent };
};

const GRID_COLUMNS = 6;

const pickBottomMostIndex = (options: { count: number; compact: boolean }) => {
  const count = options.count;
  if (count <= 0) return null;

  const spans = Array.from({ length: count }, (_, index) =>
    Math.max(1, Math.min(GRID_COLUMNS, chipLayout(index, options.compact).span))
  );
  const lifts = Array.from({ length: count }, (_, index) => chipLayout(index, options.compact).lift);

  const occupied: boolean[][] = [];
  const ensureRow = (row: number) => {
    if (!occupied[row]) occupied[row] = Array.from({ length: GRID_COLUMNS }, () => false);
  };
  const canPlace = (row: number, col: number, span: number) => {
    ensureRow(row);
    for (let c = col; c < col + span; c += 1) {
      if (occupied[row][c]) return false;
    }
    return true;
  };
  const place = (row: number, col: number, span: number) => {
    ensureRow(row);
    for (let c = col; c < col + span; c += 1) occupied[row][c] = true;
  };

  const rows: number[] = new Array(count).fill(0);
  const cols: number[] = new Array(count).fill(0);
  for (let index = 0; index < count; index += 1) {
    const span = spans[index];
    let placed = false;
    for (let row = 0; !placed; row += 1) {
      ensureRow(row);
      for (let col = 0; col <= GRID_COLUMNS - span; col += 1) {
        if (!canPlace(row, col, span)) continue;
        place(row, col, span);
        rows[index] = row;
        cols[index] = col;
        placed = true;
        break;
      }
    }
  }

  let bestIndex = 0;
  for (let index = 1; index < count; index += 1) {
    if (rows[index] > rows[bestIndex]) {
      bestIndex = index;
      continue;
    }
    if (rows[index] < rows[bestIndex]) continue;

    if (cols[index] < cols[bestIndex]) {
      bestIndex = index;
      continue;
    }
    if (cols[index] > cols[bestIndex]) continue;

    if (lifts[index] > lifts[bestIndex]) {
      bestIndex = index;
      continue;
    }
    if (lifts[index] < lifts[bestIndex]) continue;

    if (index > bestIndex) bestIndex = index;
  }
  return bestIndex;
};

export default function HotSearchPanel({ onApply, compact = false, count }: HotSearchPanelProps) {
  const [rotate, setRotate] = useState(0);
  const dateKey = useMemo(() => getChinaDateKey(), []);
  const itemCount = count ?? (compact ? 12 : 14);
  const items = useMemo(
    () => getDailyHotSearchItems({ count: itemCount, rotate, dateKey }),
    [dateKey, itemCount, rotate]
  );
  const hiddenIndex = useMemo(
    () => pickBottomMostIndex({ count: items.length, compact }),
    [compact, items.length]
  );
  const hiddenId = useMemo(() => {
    const liBai = items.find((item) => item.id === 'p-li-bai');
    if (liBai) return liBai.id;
    return null;
  }, [compact, items]);

  return (
    <section className={`hot-panel ${compact ? 'hot-panel--compact' : ''}`} aria-label="热门搜索">
      <div className="hot-panel-header">
        <div className="hot-panel-title">
          <div className="hot-panel-titleText">热门搜索</div>
          <div className="hot-panel-sub">每日更新 · {dateKey || '—'}</div>
        </div>
        <button
          type="button"
          className="ghost-button hot-panel-refresh"
          onClick={() => setRotate((prev) => prev + 1)}
          title="换一换"
        >
          换一换
        </button>
      </div>

      <div className="hot-grid" role="list">
        {items.map((item, index) => {
          const layout = chipLayout(index, compact);
          const isHidden =
            hiddenId ? item.id === hiddenId : hiddenIndex !== null && index === hiddenIndex;
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              className={`hot-chip hot-chip--${item.type} hot-chip--accent${layout.accent}`}
              style={
                (compact
                  ? ({
                      gridColumn: `span ${layout.span}`,
                      marginTop: layout.lift,
                      visibility: isHidden ? 'hidden' : undefined,
                      pointerEvents: isHidden ? 'none' : undefined
                    } as CSSProperties)
                  : ({
                      gridColumn: `span ${layout.span}`,
                      transform: `translateY(${layout.lift}px) rotate(${layout.tilt}deg)`,
                      visibility: isHidden ? 'hidden' : undefined,
                      pointerEvents: isHidden ? 'none' : undefined
                    } as CSSProperties))
              }
              onClick={
                isHidden
                  ? undefined
                  : () =>
                      onApply({
                        person: '',
                        keyword: '',
                        province: '',
                        city: '',
                        county: '',
                        level: '',
                        nearby: null,
                        radius: 20000,
                        ...item.apply
                      })
              }
              aria-hidden={isHidden ? true : undefined}
              aria-label={isHidden ? undefined : `热门${kindLabel[item.type]}：${item.label}，点击检索`}
              title={isHidden ? undefined : '点击检索'}
              tabIndex={isHidden ? -1 : undefined}
              disabled={isHidden}
            >
              <span className="hot-chip-kind">{kindLabel[item.type]}</span>
              <span className="hot-chip-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {!compact && (
        <div className="footer-note hot-panel-note">
          点击任意标签会自动填充左侧条件并开始检索。
        </div>
      )}
    </section>
  );
}
