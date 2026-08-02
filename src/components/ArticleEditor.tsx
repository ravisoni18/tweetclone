import React, { useState, useRef } from 'react';
import {
  X, Image as ImageIcon, Save, Eye, Bold, Italic,
  List, ListOrdered, Heading1, Heading2, Code, Quote,
  Link as LinkIcon, EyeOff, Upload, Feather
} from 'lucide-react';
import { auth } from '../config/firebase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';

interface ArticleEditorProps {
  onClose?: () => void;
  onPublish?: (article: any) => void;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ onClose, onPublish }) => {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const coverImageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'editor-link' },
      }),
      Image.configure({ HTMLAttributes: { class: 'editor-img' } }),
      Placeholder.configure({ placeholder: 'Start writing your article…' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'patr-editor focus:outline-none' },
    },
  });

  const getAuthToken = async (): Promise<string> => {
    try {
      const cu = auth.currentUser;
      if (!cu) return '';
      return await cu.getIdToken(true);
    } catch { return ''; }
  };

  const handleCoverImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadCoverImage = async (): Promise<string> => {
    if (!coverImage) return '';
    try {
      const token = await getAuthToken();
      const fd = new FormData();
      fd.append('media', coverImage);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setCoverImageUrl(data.url);
        return data.url;
      }
      return '';
    } catch { return ''; }
  };

  const calcReadingTime = (html: string) => {
    const words = html.replace(/<[^>]*>/g, '').trim().split(/\s+/).length;
    return Math.ceil(words / 200);
  };

  const genExcerpt = (html: string) => {
    if (excerpt.trim()) return excerpt.trim();
    const text = html.replace(/<[^>]*>/g, '');
    return text.substring(0, 160).trim() + (text.length > 160 ? '...' : '');
  };

  const handlePublish = async (status: 'draft' | 'published') => {
    if (!title.trim()) { alert('Please enter a title'); return; }
    const content = editor?.getHTML() || '';
    if (!content.trim() || content === '<p></p>') { alert('Please write some content'); return; }

    try {
      setIsPublishing(true);
      const token = await getAuthToken();
      const cu = auth.currentUser;
      if (!cu) { alert('Please log in'); return; }

      let imgUrl = coverImageUrl;
      if (coverImage && !coverImageUrl) imgUrl = await uploadCoverImage();

      const payload = {
        userId: cu.uid,
        title: title.trim(),
        content,
        excerpt: genExcerpt(content),
        coverImageUrl: imgUrl || '',
        status,
        readingTimeMinutes: calcReadingTime(content),
      };

      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Article ${status === 'published' ? 'published' : 'saved as draft'}!`);
        if (onPublish) onPublish(result);
        setTitle(''); editor?.commands.setContent(''); setExcerpt('');
        setCoverImage(null); setCoverImagePreview(''); setCoverImageUrl('');
        if (onClose) onClose();
      } else {
        alert('Failed to publish. Please try again.');
      }
    } catch { alert('An error occurred.'); }
    finally { setIsPublishing(false); }
  };

  const setLink = () => {
    const url = window.prompt('Enter URL');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    const url = window.prompt('Enter image URL');
    if (url) editor?.chain().focus().setImage({ src: url }).run();
  };

  if (!editor) return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--bg, #000)' }}>
      <div style={{ color: 'var(--text, #fff)' }}>Loading editor…</div>
    </div>
  );

  const ToolbarBtn = ({
    onClick, active, title, children
  }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        backgroundColor: active ? 'var(--accent, #1d9bf0)' : 'var(--hover, rgba(255,255,255,0.06))',
        color: active ? 'var(--accent-text, #fff)' : 'var(--text-dim, #71767b)',
        border: 'none',
      }}
      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 hover:opacity-80 cursor-pointer"
    >
      {children}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: 'var(--bg, #0a0a0a)' }}>

      {/* ── Top bar ── */}
      <div
        style={{
          borderBottomColor: 'var(--border, #2f3336)',
          backgroundColor:   'var(--bg, #000)',
        }}
        className="flex-shrink-0 border-b px-6 py-4"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              style={{ color: 'var(--text-dim, #71767b)', borderColor: 'var(--border, #2f3336)' }}
              className="w-9 h-9 flex items-center justify-center rounded-full border transition-colors hover:border-current"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Feather style={{ color: 'var(--accent, #1d9bf0)' }} className="w-5 h-5" />
              <span style={{ color: 'var(--text, #e7e9ea)' }} className="font-bold text-lg">
                Write Article
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{
                color:       'var(--text-dim, #71767b)',
                borderColor: 'var(--border, #2f3336)',
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all hover:border-current"
            >
              {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="hidden sm:inline">{showPreview ? 'Edit' : 'Preview'}</span>
            </button>

            <button
              onClick={() => handlePublish('draft')}
              disabled={isPublishing}
              style={{
                color:           'var(--text, #e7e9ea)',
                borderColor:     'var(--border, #2f3336)',
                backgroundColor: 'transparent',
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-full border text-sm font-semibold transition-all hover:border-current disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save Draft</span>
            </button>

            <button
              onClick={() => handlePublish('published')}
              disabled={isPublishing}
              style={{
                backgroundColor: 'var(--accent, #1d9bf0)',
                color:           'var(--accent-text, #fff)',
              }}
              className="flex items-center space-x-2 px-5 py-2 rounded-full text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
            >
              {isPublishing
                ? <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /><span>Publishing…</span></>
                : <span>Publish</span>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {showPreview ? (
            /* ── Preview ── */
            <div>
              {coverImagePreview && (
                <img src={coverImagePreview} alt="Cover" className="w-full h-72 object-cover rounded-2xl mb-8" />
              )}
              <h1 style={{ color: 'var(--text, #e7e9ea)' }} className="text-5xl font-bold mb-4 leading-tight">
                {title || 'Untitled Article'}
              </h1>
              {excerpt && (
                <p style={{ color: 'var(--text-dim, #71767b)' }} className="text-xl mb-8 italic">
                  {excerpt}
                </p>
              )}
              <div
                className="article-preview-content"
                dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
              />
            </div>
          ) : (
            /* ── Edit ── */
            <div className="space-y-6">

              {/* Cover image */}
              <div>
                {coverImagePreview ? (
                  <div className="relative group rounded-2xl overflow-hidden">
                    <img src={coverImagePreview} alt="Cover" className="w-full h-64 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        onClick={() => coverImageInputRef.current?.click()}
                        style={{ background: 'var(--accent, #1d9bf0)', color: 'var(--accent-text, #fff)' }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
                      >
                        <Upload className="w-4 h-4" />Change
                      </button>
                      <button
                        onClick={() => { setCoverImage(null); setCoverImagePreview(''); setCoverImageUrl(''); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-red-500/80 text-white"
                      >
                        <X className="w-4 h-4" />Remove
                      </button>
                    </div>
                    {coverImageUrl && (
                      <div className="absolute bottom-3 left-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        ✓ Uploaded
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => coverImageInputRef.current?.click()}
                    style={{
                      borderColor:     'var(--border, #2f3336)',
                      color:           'var(--text-dim, #71767b)',
                      backgroundColor: 'var(--hover, rgba(255,255,255,0.03))',
                    }}
                    className="w-full h-44 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-3 transition-all hover:border-current group"
                  >
                    <div
                      style={{ background: 'var(--hover, rgba(255,255,255,0.06))' }}
                      className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
                    >
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-sm">Add a cover image</p>
                      <p style={{ color: 'var(--text-dim, #71767b)' }} className="text-xs mt-1">
                        JPG, PNG, GIF · up to 10MB
                      </p>
                    </div>
                  </button>
                )}
                <input ref={coverImageInputRef} type="file" accept="image/*" onChange={handleCoverImageSelect} className="hidden" />
              </div>

              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Article title…"
                maxLength={200}
                style={{
                  color:       'var(--text, #e7e9ea)',
                  background:  'transparent',
                  caretColor:  'var(--accent, #1d9bf0)',
                }}
                className="w-full text-4xl sm:text-5xl font-bold placeholder-gray-600 focus:outline-none leading-tight"
              />

              {/* Excerpt */}
              <div>
                <label style={{ color: 'var(--text-dim, #71767b)' }} className="block text-xs font-semibold uppercase tracking-widest mb-2">
                  Excerpt · optional
                </label>
                <textarea
                  value={excerpt}
                  onChange={e => setExcerpt(e.target.value)}
                  placeholder="Brief description shown in article cards…"
                  maxLength={300}
                  rows={2}
                  style={{
                    backgroundColor: 'var(--hover, rgba(255,255,255,0.03))',
                    borderColor:     'var(--border, #2f3336)',
                    color:           'var(--text, #e7e9ea)',
                  }}
                  className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none placeholder-gray-600"
                />
              </div>

              {/* Toolbar */}
              <div
                style={{
                  backgroundColor: 'var(--hover, rgba(255,255,255,0.03))',
                  borderColor:     'var(--border, #2f3336)',
                }}
                className="flex flex-wrap items-center gap-1 p-3 rounded-t-xl border border-b-0"
              >
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
                  <Bold className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
                  <Italic className="w-3.5 h-3.5" />
                </ToolbarBtn>

                <div style={{ background: 'var(--border, #2f3336)' }} className="w-px h-5 mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
                  <Heading1 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
                  <Heading2 className="w-3.5 h-3.5" />
                </ToolbarBtn>

                <div style={{ background: 'var(--border, #2f3336)' }} className="w-px h-5 mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
                  <List className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
                  <ListOrdered className="w-3.5 h-3.5" />
                </ToolbarBtn>

                <div style={{ background: 'var(--border, #2f3336)' }} className="w-px h-5 mx-1" />

                <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote">
                  <Quote className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">
                  <Code className="w-3.5 h-3.5" />
                </ToolbarBtn>

                <div style={{ background: 'var(--border, #2f3336)' }} className="w-px h-5 mx-1" />

                <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Add link">
                  <LinkIcon className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn onClick={addImage} title="Add image">
                  <ImageIcon className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>

              {/* Editor area */}
              <div
                style={{
                  backgroundColor: 'var(--hover, rgba(255,255,255,0.02))',
                  borderColor:     'var(--border, #2f3336)',
                }}
                className="rounded-b-xl border min-h-[320px]"
              >
                <EditorContent editor={editor} />
              </div>

            </div>
          )}
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        .patr-editor {
          padding: 1.5rem;
          min-height: 320px;
          color: var(--text, #e7e9ea);
          font-size: 1.05rem;
          line-height: 1.75;
        }
        .patr-editor p { margin: 0.75em 0; color: var(--text, #e7e9ea); }
        .patr-editor h1 { font-size: 2em; font-weight: bold; color: var(--text, #fff); margin: 1em 0 0.4em; }
        .patr-editor h2 { font-size: 1.5em; font-weight: bold; color: var(--text, #fff); margin: 0.9em 0 0.4em; }
        .patr-editor h3 { font-size: 1.2em; font-weight: bold; color: var(--text, #fff); margin: 0.8em 0 0.4em; }
        .patr-editor ul { list-style: disc; padding-left: 1.5em; margin: 0.75em 0; color: var(--text, #e7e9ea); }
        .patr-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0.75em 0; color: var(--text, #e7e9ea); }
        .patr-editor li { margin: 0.4em 0; }
        .patr-editor blockquote {
          border-left: 3px solid var(--accent, #1d9bf0);
          padding: 0.75em 1.25em;
          margin: 1em 0;
          color: var(--text-dim, #71767b);
          font-style: italic;
          background: var(--hover, rgba(255,255,255,0.03));
          border-radius: 0 8px 8px 0;
        }
        .patr-editor code {
          background: var(--widget, #1f2937);
          color: #f59e0b;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.88em;
        }
        .patr-editor pre {
          background: var(--widget, #111827);
          color: var(--text, #f3f4f6);
          padding: 1.25em;
          border-radius: 10px;
          overflow-x: auto;
          margin: 1em 0;
          border: 1px solid var(--border, #374151);
        }
        .patr-editor pre code { background: none; padding: 0; color: inherit; font-size: 0.875em; }
        .patr-editor a.editor-link { color: var(--accent, #1d9bf0); text-decoration: underline; }
        .patr-editor img.editor-img { max-width: 100%; border-radius: 10px; margin: 1em 0; }
        .patr-editor strong { font-weight: bold; color: var(--text, #fff); }
        .patr-editor em { font-style: italic; }
        .patr-editor p.is-editor-empty:first-child::before {
          color: var(--text-dim, #4b5563);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }

        /* Preview content styles */
        .article-preview-content { color: var(--text, #e7e9ea); font-size: 1.1rem; line-height: 1.8; }
        .article-preview-content p { margin: 1.25em 0; color: var(--text-dim, #e5e7eb); }
        .article-preview-content h1,.article-preview-content h2,.article-preview-content h3 {
          color: var(--text, #fff); font-weight: bold; margin: 1.2em 0 0.5em;
        }
        .article-preview-content ul,.article-preview-content ol {
          padding-left: 2em; margin: 1em 0; color: var(--text-dim, #e5e7eb);
        }
        .article-preview-content ul { list-style: disc; }
        .article-preview-content ol { list-style: decimal; }
        .article-preview-content blockquote {
          border-left: 3px solid var(--accent, #1d9bf0);
          padding: 0.75em 1.5em; margin: 1.5em 0;
          color: var(--text-dim, #9ca3af); font-style: italic;
          background: var(--hover, rgba(255,255,255,0.03)); border-radius: 0 8px 8px 0;
        }
        .article-preview-content code {
          background: var(--widget, #1f2937); color: #f59e0b;
          padding: 0.15em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.88em;
        }
        .article-preview-content pre {
          background: var(--widget, #111827); color: var(--text, #f3f4f6);
          padding: 1.25em; border-radius: 10px; overflow-x: auto; margin: 1em 0;
          border: 1px solid var(--border, #374151);
        }
        .article-preview-content pre code { background: none; padding: 0; }
        .article-preview-content a { color: var(--accent, #1d9bf0); text-decoration: underline; }
        .article-preview-content img { max-width: 100%; border-radius: 10px; margin: 1.5em auto; display: block; }
        .article-preview-content strong { color: var(--text, #fff); font-weight: bold; }
      `}</style>
    </div>
  );
};

export default ArticleEditor;