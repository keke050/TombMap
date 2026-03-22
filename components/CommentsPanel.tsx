'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
type CommentItem = {
  id: string;
  content: string;
  createdAt: string;
  userLabel: string;
  canDelete?: boolean;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

export default function CommentsPanel({ tombId }: { tombId: string }) {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [total, setTotal] = useState(0);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / limit)), [limit, total]);
  const requestIdRef = useRef(0);

  const canSubmit = useMemo(() => Boolean(comment.trim()) && !sending, [comment, sending]);

  const load = async (id = tombId, nextPage = page) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/tombs/${id}/comment?page=${nextPage}&limit=${limit}`, { method: 'GET' }).catch(
      () => null
    );
    if (requestId !== requestIdRef.current) return;

    if (!response?.ok) {
      setError('评论加载失败');
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (requestId !== requestIdRef.current) return;
    setItems(Array.isArray(data?.comments) ? data.comments : []);
    setPage(Number(data?.page ?? nextPage) || nextPage);
    setTotal(Number(data?.total ?? 0) || 0);
    setLoading(false);
  };

  useEffect(() => {
    setItems([]);
    setComment('');
    setPage(1);
    setTotal(0);
    load(tombId, 1);
  }, [tombId]);

  const handleSubmit = async () => {
    const content = comment.trim();
    if (!content) return;
    if (sending) return;

    setSending(true);
    setError(null);
    const response = await fetch(`/api/tombs/${tombId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }).catch(() => null);

    if (!response?.ok) {
      setError('提交失败，请稍后重试');
      setSending(false);
      return;
    }

    setComment('');
    setSending(false);
    setPage(1);
    load(tombId, 1);
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    setError(null);
    const response = await fetch(`/api/tombs/${tombId}/comment/${commentId}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) {
      setError('删除失败，请稍后重试');
      setDeletingId(null);
      return;
    }
    const nextTotal = Math.max(0, total - 1);
    const nextPage = Math.min(page, Math.max(1, Math.ceil(nextTotal / limit)));
    setDeletingId(null);
    setPage(nextPage);
    load(tombId, nextPage);
  };

  return (
    <section className="panel comments-panel" aria-label="评论区">
      <h3>评论区</h3>

      <div className="field">
        <label>说点什么</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="分享你的探访记录"
          maxLength={280}
        />
      </div>

      <div className="inline-actions">
        <button className="primary-button primary-button--jade" onClick={handleSubmit} disabled={!canSubmit}>
          {sending ? '提交中…' : '提交评论'}
        </button>
        <button className="ghost-button" onClick={() => load(tombId, page)} disabled={loading || sending}>
          刷新
        </button>
      </div>

      {error && <div className="footer-note">{error}</div>}

      <div className="comment-list comments-panel-list" aria-live="polite">
        {loading && <div className="footer-note">评论加载中…</div>}
        {!loading && items.length === 0 && <div className="footer-note">暂无评论</div>}
        {!loading &&
          items.map((item) => (
            <div key={item.id} className="comment-item">
              <div className="comment-meta">
                <strong>{item.userLabel}</strong>
                <span className="comment-time">{formatDateTime(item.createdAt)}</span>
                {item.canDelete && (
                  <button
                    type="button"
                    className="ghost-button comment-delete"
                    onClick={() => handleDelete(item.id)}
                    disabled={sending || loading || deletingId === item.id}
                    title="删除评论"
                  >
                    {deletingId === item.id ? '删除中…' : '删除'}
                  </button>
                )}
              </div>
              <div className="comment-content">{item.content}</div>
            </div>
          ))}
      </div>

      <div className="inline-actions comments-panel-pagination" aria-label="评论分页">
        <button
          type="button"
          className="ghost-button"
          onClick={() => load(tombId, Math.max(1, page - 1))}
          disabled={loading || sending || page <= 1}
        >
          上一页
        </button>
        <span className="footer-note">
          第 {page} / {pageCount} 页 · 共 {total} 条
        </span>
        <button
          type="button"
          className="ghost-button"
          onClick={() => load(tombId, Math.min(pageCount, page + 1))}
          disabled={loading || sending || page >= pageCount}
        >
          下一页
        </button>
      </div>
    </section>
  );
}
