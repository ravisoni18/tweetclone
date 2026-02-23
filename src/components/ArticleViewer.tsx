import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Calendar, Eye, Heart, MessageCircle, Share,
  Bookmark, MoreHorizontal, Trash2, Edit3, Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../config/firebase';

interface ArticleViewerProps {
  articleId: string;
  onBack: () => void;
}

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  coverImageUrl?: string;
  status: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  readingTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  user: {
    id: string;
    displayName: string;
    username: string;
    email: string;
    profileImageUrl?: string;
    verified: boolean;
  };
  userHasLiked?: boolean;
  userHasBookmarked?: boolean;
}

const ArticleViewer: React.FC<ArticleViewerProps> = ({ articleId, onBack }) => {
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [likeLoading, setLikeLoading] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const getAuthToken = async (): Promise<string> => {
    try {
      const cu = auth.currentUser;
      if (!cu) return '';
      return await cu.getIdToken(true);
    } catch { return ''; }
  };

  useEffect(() => {
    const loadArticle = async () => {
      try {
        setLoading(true);
        const token = await getAuthToken();
        const res = await fetch(`https://patr.me/api/articles/${articleId}`, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (res.ok) setArticle(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    loadArticle();
  }, [articleId]);

  const handleLike = async () => {
    if (!user || !article || likeLoading) return;
    try {
      setLikeLoading(true);
      const token = await getAuthToken();
      const res = await fetch(`https://patr.me/api/articles/${articleId}/like`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const r = await res.json();
        setArticle(prev => prev ? { ...prev, userHasLiked: r.liked, likesCount: r.likesCount } : null);
      }
    } catch (e) { console.error(e); }
    finally { setLikeLoading(false); }
  };

  const handleBookmark = async () => {
    if (!user || !article || bookmarkLoading) return;
    try {
      setBookmarkLoading(true);
      const token = await getAuthToken();
      const res = await fetch(`https://patr.me/api/articles/${articleId}/bookmark`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const r = await res.json();
        setArticle(prev => prev ? { ...prev, userHasBookmarked: r.bookmarked } : null);
      }
    } catch (e) { console.error(e); }
    finally { setBookmarkLoading(false); }
  };

  const handleDelete = async () => {
    if (!user || !article || user.id !== article.user.id) return;
    if (!window.confirm('Delete this article?')) return;
    try {
      const token = await getAuthToken();
      const res = await fetch(`https://patr.me/api/articles/${articleId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) { alert('Article deleted'); onBack(); }
    } catch (e) { alert('Failed to delete'); }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/articles/${articleId}`;
    if (navigator.share) {
      navigator.share({ title: article?.title, text: article?.excerpt, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);

  /* ── Loading ── */
  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg, #000)' }}>
      <div className="text-center">
        <div style={{ borderColor: 'var(--accent, #1d9bf0)' }} className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p style={{ color: 'var(--text-dim, #71767b)' }}>Loading article…</p>
      </div>
    </div>
  );

  /* ── Not found ── */
  if (!article) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--bg, #000)' }}>
      <div className="text-center px-6">
        <div className="text-6xl mb-4">😔</div>
        <h3 style={{ color: 'var(--text, #e7e9ea)' }} className="text-xl font-bold mb-2">Article not found</h3>
        <p style={{ color: 'var(--text-dim, #71767b)' }} className="mb-6">This article may have been deleted.</p>
        <button
          onClick={onBack}
          style={{ background: 'var(--accent, #1d9bf0)', color: 'var(--accent-text, #fff)' }}
          className="px-6 py-2.5 rounded-full font-semibold transition-opacity hover:opacity-90"
        >
          Go back
        </button>
      </div>
    </div>
  );

  const isAuthor = user?.id === article.user.id;

  return (
    <main
      style={{
        borderRightColor: 'var(--border, #2f3336)',
        background:       'var(--bg, #000)',
      }}
      className="flex-1 border-r overflow-y-auto max-w-4xl"
    >
      {/* ── Sticky header ── */}
      <div
        style={{
          borderBottomColor: 'var(--border, #2f3336)',
          background:        'var(--bg, #000)',
          backdropFilter:    'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
        className="sticky top-0 z-10 border-b px-4 py-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              style={{
                color:       'var(--text-dim, #71767b)',
                borderColor: 'var(--border, #2f3336)',
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full border transition-all hover:border-current"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 style={{ color: 'var(--text, #e7e9ea)' }} className="text-lg font-bold">
              Article
            </h1>
          </div>

          {/* Action dots */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              style={{ color: 'var(--text-dim, #71767b)' }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div
                  style={{
                    background:   'var(--widget, #16181c)',
                    borderColor:  'var(--border, #2f3336)',
                  }}
                  className="absolute right-0 top-full mt-2 border rounded-2xl shadow-2xl py-2 z-20 min-w-48"
                >
                  {isAuthor && (
                    <>
                      <button
                        style={{ color: 'var(--text, #e7e9ea)' }}
                        className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center space-x-3 text-sm font-medium"
                      >
                        <Edit3 className="w-4 h-4" /><span>Edit article</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2.5 text-left text-red-400 hover:bg-red-500/10 flex items-center space-x-3 text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" /><span>Delete article</span>
                      </button>
                      <div style={{ borderColor: 'var(--border, #2f3336)' }} className="border-t my-1" />
                    </>
                  )}
                  <button
                    onClick={handleShare}
                    style={{ color: 'var(--text, #e7e9ea)' }}
                    className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center space-x-3 text-sm font-medium"
                  >
                    <Share className="w-4 h-4" /><span>Share article</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Article content ── */}
      <article className="px-6 sm:px-10 lg:px-16 py-10">

        {/* Cover image */}
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt={article.title}
            className="w-full h-64 sm:h-80 object-cover rounded-2xl mb-10"
          />
        )}

        {/* Title */}
        <h1
          style={{ color: 'var(--text, #e7e9ea)' }}
          className="text-4xl sm:text-5xl font-bold leading-tight mb-8"
        >
          {article.title}
        </h1>

        {/* Author row */}
        <div
          style={{ borderBottomColor: 'var(--border, #2f3336)' }}
          className="flex items-center justify-between mb-8 pb-8 border-b"
        >
          <div className="flex items-center space-x-4">
            {article.user.profileImageUrl ? (
              <img src={article.user.profileImageUrl} alt={article.user.displayName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                {getInitials(article.user.displayName)}
              </div>
            )}
            <div>
              <div className="flex items-center space-x-1.5">
                <span style={{ color: 'var(--text, #e7e9ea)' }} className="font-bold">{article.user.displayName}</span>
                {article.user.verified && (
                  <div style={{ background: 'var(--accent, #1d9bf0)' }} className="w-4 h-4 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
              </div>
              <span style={{ color: 'var(--text-dim, #71767b)' }} className="text-sm">@{article.user.username}</span>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div style={{ color: 'var(--text-dim, #71767b)' }} className="flex items-center justify-end space-x-1.5 text-sm">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {article.readingTimeMinutes && (
              <div style={{ color: 'var(--text-dim, #71767b)' }} className="flex items-center justify-end space-x-1.5 text-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>{article.readingTimeMinutes} min read</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{ borderBottomColor: 'var(--border, #2f3336)', color: 'var(--text-dim, #71767b)' }}
          className="flex items-center space-x-6 text-sm mb-10 pb-6 border-b"
        >
          <div className="flex items-center space-x-1.5">
            <Eye className="w-4 h-4" />
            <span>{article.viewsCount.toLocaleString()} views</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <Heart className="w-4 h-4" />
            <span>{article.likesCount} likes</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <MessageCircle className="w-4 h-4" />
            <span>{article.commentsCount} comments</span>
          </div>
        </div>

        {/* Body */}
        <div className="article-body" dangerouslySetInnerHTML={{ __html: article.content }} />

        {/* Bottom actions */}
        <div
          style={{ borderTopColor: 'var(--border, #2f3336)' }}
          className="flex items-center justify-between pt-8 mt-12 border-t"
        >
          <div className="flex items-center space-x-5">
            <button
              onClick={handleLike}
              disabled={!user || likeLoading}
              style={{ color: article.userHasLiked ? '#f87171' : 'var(--text-dim, #71767b)' }}
              className="flex items-center space-x-2 transition-colors hover:text-red-400 disabled:opacity-50"
            >
              <Heart className={`w-6 h-6 ${article.userHasLiked ? 'fill-current' : ''}`} />
              <span className="font-semibold">{article.likesCount}</span>
            </button>

            <button
              style={{ color: 'var(--text-dim, #71767b)' }}
              className="flex items-center space-x-2 transition-colors hover:text-blue-400"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="font-semibold">{article.commentsCount}</span>
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleBookmark}
              disabled={!user || bookmarkLoading}
              style={{ color: article.userHasBookmarked ? '#facc15' : 'var(--text-dim, #71767b)' }}
              className="transition-colors hover:text-yellow-400 disabled:opacity-50"
            >
              <Bookmark className={`w-6 h-6 ${article.userHasBookmarked ? 'fill-current' : ''}`} />
            </button>

            <button
              onClick={handleShare}
              style={{ color: 'var(--text-dim, #71767b)' }}
              className="transition-colors hover:text-blue-400"
            >
              <Share className="w-6 h-6" />
            </button>
          </div>
        </div>
      </article>

      {/* ── Article body styles — fully theme-aware ── */}
      <style>{`
        .article-body {
          color: var(--text, #e7e9ea);
          font-size: 1.125rem;
          line-height: 1.85;
        }
        .article-body p {
          margin: 1.4em 0;
          color: var(--text-dim, #d1d5db);
        }
        .article-body h1,
        .article-body h2,
        .article-body h3,
        .article-body h4 {
          color: var(--text, #e7e9ea);
          font-weight: 800;
          line-height: 1.25;
          margin: 1.75em 0 0.6em;
        }
        .article-body h1 { font-size: 2.2em; }
        .article-body h2 { font-size: 1.65em; border-bottom: 1px solid var(--border, #2f3336); padding-bottom: 0.3em; }
        .article-body h3 { font-size: 1.3em; }
        .article-body h4 { font-size: 1.1em; }
        .article-body ul,
        .article-body ol {
          margin: 1.25em 0;
          padding-left: 2em;
          color: var(--text-dim, #d1d5db);
        }
        .article-body ul { list-style-type: disc; }
        .article-body ol { list-style-type: decimal; }
        .article-body li { margin: 0.6em 0; line-height: 1.7; }
        .article-body blockquote {
          border-left: 4px solid var(--accent, #1d9bf0);
          padding: 1em 1.5em;
          margin: 2em 0;
          color: var(--text-dim, #9ca3af);
          font-style: italic;
          background: var(--hover, rgba(255,255,255,0.03));
          border-radius: 0 12px 12px 0;
        }
        .article-body code {
          background: var(--widget, #1f2937);
          color: #f59e0b;
          padding: 0.18em 0.5em;
          border-radius: 5px;
          font-family: 'Courier New', monospace;
          font-size: 0.88em;
        }
        .article-body pre {
          background: var(--widget, #111827);
          color: var(--text, #f3f4f6);
          padding: 1.5em;
          border-radius: 12px;
          overflow-x: auto;
          margin: 1.5em 0;
          border: 1px solid var(--border, #374151);
        }
        .article-body pre code { background: none; padding: 0; color: inherit; font-size: 0.875em; }
        .article-body a {
          color: var(--accent, #1d9bf0);
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: opacity 0.15s;
        }
        .article-body a:hover { opacity: 0.75; }
        .article-body img {
          max-width: 100%;
          height: auto;
          border-radius: 14px;
          margin: 2em auto;
          display: block;
          box-shadow: 0 8px 30px rgba(0,0,0,0.25);
        }
        .article-body strong { font-weight: 700; color: var(--text, #fff); }
        .article-body em { font-style: italic; }
        .article-body hr {
          border: none;
          border-top: 2px solid var(--border, #374151);
          margin: 3em 0;
        }
        .article-body table { width: 100%; border-collapse: collapse; margin: 1.5em 0; }
        .article-body th,
        .article-body td {
          padding: 0.75em 1em;
          border: 1px solid var(--border, #374151);
          text-align: left;
          color: var(--text, #e7e9ea);
        }
        .article-body th {
          background: var(--widget, #1f2937);
          font-weight: 700;
        }
      `}</style>
    </main>
  );
};

export default ArticleViewer;