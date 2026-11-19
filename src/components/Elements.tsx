import type { ReactNode, CSSProperties } from 'react';
import { ArrowUpRight, Heart, MapPin } from 'lucide-react';
import type { Post } from '../lib/data';
import { CATEGORIES } from '../lib/data';
import { flagEmoji, relativeTime } from '../lib/geography';

export function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}>
    <span className="brand-mark"><span className="brand-orbit" /><span className="brand-dot" /></span>
    <span className="brand-word">open<span>atlas.</span></span>
  </div>;
}

export function CategoryTag({ category }: { category: Post['category'] }) {
  const item = CATEGORIES.find(c => c.id === category) ?? CATEGORIES[0];
  return <span className="category-tag" style={{ '--tag-color': item.color } as CSSProperties}>
    <span>{item.icon}</span>{item.label}
  </span>;
}

export function PostCard({ post, active = false, liked = false, onOpen, onLike }: {
  post: Post; active?: boolean; liked?: boolean; onOpen: () => void; onLike: () => void;
}) {
  return <article className={`post-card ${active ? 'post-card-active' : ''}`}>
    <button className="post-card-open" onClick={onOpen} aria-label={`Read message from ${post.display_name}`}>
      <div className="post-card-head"><span className="author-avatar" aria-hidden="true">{post.display_name.slice(0, 1).toUpperCase()}</span>
        <span className="post-card-byline"><strong>{post.display_name}</strong><span><MapPin size={11} /> {flagEmoji(post.country_code)} {post.country_name} · {relativeTime(post.created_at)}</span></span>
        <ArrowUpRight className="post-open-icon" size={17} />
      </div>
      <p className="post-card-body">{post.body}</p>
    </button>
    <div className="post-card-footer"><CategoryTag category={post.category} />
      <button className={`mini-like ${liked ? 'liked' : ''}`} onClick={onLike} aria-label={liked ? 'Unlike message' : 'Like message'}>
        <Heart size={15} fill={liked ? 'currentColor' : 'none'} /> {post.reaction_count}
      </button>
    </div>
  </article>;
}

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose: () => void; className?: string }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal-window ${className}`} role="dialog" aria-modal="true">{children}</section>
  </div>;
}
