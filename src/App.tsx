import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { gsap } from 'gsap';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, Compass, Flag, Globe2,
  Heart, Info, LocateFixed, MapPin, Menu, MessageCircle, Minus, Plus, Search,
  Send, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import GlobeMap, { type MapActions, type MapLocation } from './components/GlobeMap';
import { Brand, CategoryTag, Modal, PostCard } from './components/Elements';
import { CATEGORIES, getMyLikes, getPosts, getReplies, isLive, publishPost,
  reportPost, togglePostLike, watchPosts, type Category, type Draft, type Post } from './lib/data';
import { byCode, countries, flagEmoji, relativeTime } from './lib/geography';

type Phase = 'intro' | 'transition' | 'explore';
type FeedTab = 'latest' | 'loved';
type ComposeContext = { location?: MapLocation; replyTo?: Post };
const NAME_KEY = 'open-atlas-name-v1';
const COUNTRY_KEY = 'open-atlas-home-country-v1';
const MAX_MESSAGE = 650;

function readLocal(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function saveLocal(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Browsers may disable storage */ }
}

function Clouds({ active }: { active: boolean }) {
  return <div className={`cloud-curtain ${active ? 'cloud-curtain-active' : ''}`} aria-hidden="true">
    <span className="cloud cloud-a" /><span className="cloud cloud-b" /><span className="cloud cloud-c" />
    <span className="cloud cloud-d" /><span className="cloud cloud-e" />
    <span className="cloud-flash" />
  </div>;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('intro');
  const [cloudActive, setCloudActive] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [username, setUsername] = useState(() => readLocal(NAME_KEY));
  const [homeCountry, setHomeCountry] = useState(() => readLocal(COUNTRY_KEY));
  const [nameModal, setNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pendingCompose, setPendingCompose] = useState<ComposeContext | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext>({});
  const [messageInput, setMessageInput] = useState('');
  const [composeCategory, setComposeCategory] = useState<Category>('thought');
  const [composeCountry, setComposeCountry] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Post[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterCategory, setFilterCategory] = useState<Category | 'all'>('all');
  const [feedTab, setFeedTab] = useState<FeedTab>('latest');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [reporting, setReporting] = useState<Post | null>(null);
  const [reportReason, setReportReason] = useState('spam');
  const [reportingBusy, setReportingBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState('');
  const mapRef = useRef<MapActions>(null);
  const toastTimerRef = useRef<number | null>(null);

  // GSAP gives the first reveal a soft, coordinated entrance.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = gsap.fromTo(
      '.hero-kicker, .landing-hero h1, .landing-hero > p, .hero-cta, .hero-subnote',
      { y: 28, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.0, stagger: 0.12, ease: 'power3.out', delay: 0.15 },
    );
    return () => { animation.kill(); };
  }, []);

  const notify = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 4200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [all, likes] = await Promise.all([getPosts(), getMyLikes()]);
      setPosts(all);
      setLikedIds(likes);
      setLoadError('');
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load the freedom wall.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const unwatch = watchPosts(() => void refresh());
    return () => { unwatch(); if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current); };
  }, [refresh]);

  useEffect(() => {
    if (!selected) { setReplies([]); return; }
    let active = true;
    setLoadingReplies(true);
    setReplyError('');
    getReplies(selected.id).then(all => { if (active) setReplies(all); })
      .catch(cause => { if (active) setReplyError(cause instanceof Error ? cause.message : 'Could not load replies.'); })
      .finally(() => { if (active) setLoadingReplies(false); });
    return () => { active = false; };
  }, [selected?.id, posts]);

  const visiblePosts = useMemo(() => {
    const query = searchText.toLowerCase().trim();
    return posts.filter(post => (!filterCountry || post.country_code === filterCountry)
      && (filterCategory === 'all' || post.category === filterCategory)
      && (!query || `${post.body} ${post.display_name} ${post.country_name}`.toLowerCase().includes(query)))
      .sort((a, b) => feedTab === 'loved'
        ? b.reaction_count - a.reaction_count
        : b.created_at.localeCompare(a.created_at));
  }, [posts, searchText, filterCountry, filterCategory, feedTab]);

  const countryCount = new Set(posts.map(post => post.country_code)).size;

  const enterWorld = () => {
    if (phase !== 'intro') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase('explore'); return; }
    setCloudActive(true);
    setPhase('transition');
    window.setTimeout(() => setPhase('explore'), 1500);
    window.setTimeout(() => setCloudActive(false), 3400);
  };

  const openCompose = (context: ComposeContext = {}) => {
    setPendingCompose(context);
    if (!username) {
      setNameInput('');
      setNameModal(true);
      return;
    }
    showComposer(context);
  };

  const showComposer = (context: ComposeContext) => {
    setPendingCompose(null);
    setComposeContext(context);
    setMessageInput('');
    setComposeCategory(context.replyTo?.category ?? 'thought');
    setComposeCountry(context.location?.country?.code ?? homeCountry);
    setComposerOpen(true);
    setSidebarOpen(false);
  };

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = nameInput.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 28) { notify('Choose a display name with 2–28 characters.'); return; }
    saveLocal(NAME_KEY, clean);
    setUsername(clean);
    setNameModal(false);
    if (pendingCompose) showComposer(pendingCompose);
    else notify(`Welcome, ${clean}. Your display name is ready.`);
  };

  const selectPost = (post: Post) => {
    setSelected(post);
    setSidebarOpen(false);
    mapRef.current?.flyTo(post.longitude, post.latitude, 4.2);
  };

  const selectMapPosition = (location: MapLocation) => openCompose({ location });

  const selectedCountry = byCode(composeCountry);
  const locationIsSelectedCountry = !!selectedCountry && composeContext.location?.country?.code === selectedCountry.code;
  const chosenLocation = selectedCountry ? {
    latitude: locationIsSelectedCountry ? composeContext.location!.latitude : selectedCountry.lat,
    longitude: locationIsSelectedCountry ? composeContext.location!.longitude : selectedCountry.lng,
  } : undefined;

  const submitPost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = messageInput.trim();
    if (!username || !selectedCountry || !chosenLocation) { notify('Choose your country before posting.'); return; }
    if (body.length < 2 || body.length > MAX_MESSAGE) { notify('Write between 2 and 650 characters.'); return; }
    const draft: Draft = {
      display_name: username, body, category: composeCategory,
      country_code: selectedCountry.code, country_name: selectedCountry.name,
      latitude: chosenLocation.latitude, longitude: chosenLocation.longitude,
      parent_id: composeContext.replyTo?.id ?? null,
    };
    setPublishing(true);
    try {
      const post = await publishPost(draft);
      setHomeCountry(selectedCountry.code);
      saveLocal(COUNTRY_KEY, selectedCountry.code);
      setComposerOpen(false);
      setMessageInput('');
      await refresh();
      if (post.parent_id) {
        if (selected?.id === post.parent_id) setReplies(await getReplies(post.parent_id));
      } else {
        setSelected(post);
        mapRef.current?.flyTo(post.longitude, post.latitude, 4.4);
      }
      notify(isLive ? 'Your words are now on the world map. ✦' : 'Saved in demo mode on this browser only. ✦');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not publish. Try again.'); }
    finally { setPublishing(false); }
  };

  const likePost = async (post: Post) => {
    const wasLiked = likedIds.has(post.id);
    setLikedIds(previous => {
      const updated = new Set(previous);
      if (wasLiked) updated.delete(post.id); else updated.add(post.id);
      return updated;
    });
    const updateCount = (entry: Post) => entry.id === post.id
      ? { ...entry, reaction_count: Math.max(0, entry.reaction_count + (wasLiked ? -1 : 1)) }
      : entry;
    setPosts(previous => previous.map(updateCount));
    setReplies(previous => previous.map(updateCount));
    setSelected(previous => previous ? updateCount(previous) : null);
    try {
      await togglePostLike(post.id, wasLiked);
      if (isLive) await refresh();
    } catch (cause) {
      setLikedIds(previous => { const next = new Set(previous); if (wasLiked) next.add(post.id); else next.delete(post.id); return next; });
      setPosts(previous => previous.map(entry => entry.id === post.id
        ? { ...entry, reaction_count: Math.max(0, entry.reaction_count + (wasLiked ? 1 : -1)) } : entry));
      setReplies(previous => previous.map(entry => entry.id === post.id
        ? { ...entry, reaction_count: Math.max(0, entry.reaction_count + (wasLiked ? 1 : -1)) } : entry));
      setSelected(previous => previous?.id === post.id
        ? { ...previous, reaction_count: Math.max(0, previous.reaction_count + (wasLiked ? 1 : -1)) } : previous);
      notify(cause instanceof Error ? cause.message : 'Could not update the heart.');
    }
  };

  const submitReport = async () => {
    if (!reporting) return;
    setReportingBusy(true);
    try {
      await reportPost(reporting.id, reportReason);
      setReporting(null);
      notify(isLive ? 'Report submitted for review. Thank you.' : 'Demo mode: reports are not sent to a moderator.');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Could not submit report.');
    } finally { setReportingBusy(false); }
  };

  return <div className={`app app-${phase}`}>
    <div className="space-decor" aria-hidden="true"><div className="starfield" /><div className="space-glow" /><span className="shooting-star" /></div>
    <GlobeMap ref={mapRef} phase={phase} posts={phase === 'explore' ? visiblePosts : []}
      selectedId={selected?.id ?? null} onSelectPost={selectPost} onSelectLocation={selectMapPosition} />
    <Clouds active={cloudActive} />

    {phase !== 'explore' && <div className={`landing-screen ${phase === 'transition' ? 'landing-leaving' : ''}`}>
      <header className="landing-header"><Brand />
        <div className="landing-right"><span className="landing-edition">A CORNER OF THE INTERNET FOR EVERYONE</span>
          <button className="landing-about" onClick={() => setAboutOpen(true)}>About this place <ArrowUpRight size={14} /></button>
        </div>
      </header>
      <div className="landing-hero">
        <div className="hero-kicker"><span className="eyebrow-line" /> THE GLOBAL FREEDOM WALL <span className="eyebrow-line" /></div>
        <h1>A world full of<br /><em>unsaid things.</em></h1>
        <p>Somewhere in this world, someone feels the same way you do. Leave a little piece of yourself on the map.</p>
        <button className="hero-cta" onClick={enterWorld}><span>Enter the world</span><span className="hero-cta-arrow"><ArrowRight size={19} /></span></button>
        <div className="hero-subnote"><span className="sparkle-char">✳</span> No account needed. Just your words.</div>
      </div>
      <div className="landing-bottom"><div className="landing-bottom-left"><span className="pulse-indicator" /> {isLive ? 'A REAL-TIME WORLD OF VOICES' : 'DEMO PREVIEW · CONNECT SUPABASE TO GO LIVE'}</div>
        <div className="landing-coordinates">51° 30′ N &nbsp;·&nbsp; 0° 07′ W <span>✦</span> EVERYWHERE</div>
        <button className="scroll-discover" onClick={enterWorld}>EXPLORE <ArrowDownRight size={17} /></button>
      </div>
      <span className="floating-space-label label-one">BILLIONS OF STORIES</span>
      <span className="floating-space-label label-two">ONE SHARED SKY</span>
    </div>}

    {phase === 'explore' && <>
      <header className="site-header">
        <div className="site-header-brand"><button className="mobile-menu" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle message feed"><Menu size={21} /></button>
          <Brand small /><span className="header-divider" /><span className="header-subtitle">A WORLDWIDE FREEDOM WALL</span></div>
        <div className="site-header-right">
          <span className={`live-label ${!isLive ? 'demo-label' : ''}`}><span className="live-dot" />{isLive ? 'LIVE WORLD' : 'DEMO MODE'}</span>
          <button className="header-icon" onClick={() => setAboutOpen(true)} title="About and community guidelines" aria-label="About"><Info size={18} /></button>
          <button className="profile-button" onClick={() => { setNameInput(username); setNameModal(true); setPendingCompose(null); }}>
            <span className="small-avatar">{username ? username[0].toUpperCase() : <span>?</span>}</span>
            <span>{username || 'Your name'}</span><ChevronDown size={13} />
          </button>
          <button className="header-share-button" onClick={() => openCompose()}><Plus size={18} /> <span>Leave a message</span></button>
        </div>
      </header>

      <aside className={`feed-panel ${sidebarOpen ? 'feed-panel-open' : ''}`} aria-label="Message feed">
        <div className="feed-heading"><div className="feed-overline"><span className="tiny-fourstar">✦</span> THE WORLD IS LISTENING</div>
          <h2>Words from<br /><em>everywhere.</em></h2>
          <p>Read what people wish they could say out loud.</p></div>
        <div className="feed-stats"><div><strong>{posts.length}</strong><span>{posts.length === 1 ? 'MESSAGE' : 'MESSAGES'}</span></div>
          <div className="stat-divider" /><div><strong>{countryCount}</strong><span>COUNTRIES</span></div>
          <div className="stat-divider" /><div><strong>∞</strong><span>FEELINGS</span></div></div>
        {!isLive && <div className="preview-notice"><Sparkles size={15}/><span>Fictional sample messages + posts saved in your browser. Connect Supabase for public sharing.</span></div>}
        {loadError && <div className="error-notice">{loadError} <button onClick={() => void refresh()}>Retry</button></div>}
        <div className="feed-controls">
          <label className="search-field"><Search size={17} /><input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="Search words, names, places…" aria-label="Search messages" />{searchText && <button onClick={() => setSearchText('')} aria-label="Clear search"><X size={14}/></button>}</label>
          <div className="feed-filters">
            <label className="country-filter"><MapPin size={14} /> <select aria-label="Filter by country" value={filterCountry} onChange={event => { setFilterCountry(event.target.value); if (event.target.value) { const c = byCode(event.target.value); if (c) mapRef.current?.flyTo(c.lng, c.lat, 3.2); } }}>
              <option value="">Everywhere</option>
              {countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select><ChevronDown size={14}/></label>
            <label className="category-filter"><select aria-label="Filter by message category" value={filterCategory} onChange={event => setFilterCategory(event.target.value as Category | 'all')}>
              <option value="all">All feelings</option>
              {CATEGORIES.map(category => <option key={category.id} value={category.id}>{category.label}</option>)}
            </select><ChevronDown size={14}/></label>
          </div>
        </div>
        <div className="feed-list-header"><div className="feed-tabs">
          <button className={feedTab === 'latest' ? 'tab-selected' : ''} onClick={() => setFeedTab('latest')}>Latest</button>
          <button className={feedTab === 'loved' ? 'tab-selected' : ''} onClick={() => setFeedTab('loved')}>Most loved</button></div>
          <span>{visiblePosts.length} {visiblePosts.length === 1 ? 'post' : 'posts'}</span></div>
        <div className="posts-scroll" aria-live="polite">
          {loading && <div className="empty-feed"><span className="loader-ring"/> Finding words around the world…</div>}
          {!loading && visiblePosts.length === 0 && <div className="empty-feed"><MessageCircle size={30}/><strong>No words here yet.</strong><span>Try a different filter, or leave the first message.</span><button onClick={() => openCompose()}>Write something <ArrowRight size={15}/></button></div>}
          {visiblePosts.map(post => <PostCard key={post.id} post={post} active={selected?.id === post.id} liked={likedIds.has(post.id)} onOpen={() => selectPost(post)} onLike={() => void likePost(post)}/>) }
        </div>
        <div className="feed-bottom"><button className="feed-compose" onClick={() => openCompose()}><Plus size={19}/> Add your voice to the map <ArrowUpRight size={18}/></button>
          <div className="feed-footnote"><ShieldCheck size={12}/> Your location is chosen by you, never tracked.</div></div>
      </aside>

      <div className="map-heading-overlay"><div><span className="map-eyebrow"><span className="mini-pulse"/> EXPLORE THE FREEDOM WALL</span>
        <h3>Every pin is a <em>feeling.</em></h3></div><span className="map-heading-hint">Click anywhere on land to leave your mark <span>↘</span></span></div>
      <div className="map-controls"><button onClick={() => mapRef.current?.zoomIn()} title="Zoom in" aria-label="Zoom in"><Plus size={19}/></button>
        <button onClick={() => mapRef.current?.zoomOut()} title="Zoom out" aria-label="Zoom out"><Minus size={19}/></button>
        <button onClick={() => mapRef.current?.reset()} title="Show whole world" aria-label="Reset map"><LocateFixed size={19}/></button></div>
      <div className="map-attribution-note"><Compass size={13} /> PIN LOCATIONS ARE APPROXIMATE</div>
      {!selected && <div className="map-encouragement"><span>✳</span><p><strong>A little reminder</strong>There's a place for your words here, too.</p><button onClick={() => openCompose()} aria-label="Write a message"><ArrowUpRight size={19}/></button></div>}
      {selected && <section className="story-panel" aria-label="Selected message">
        <div className="story-topline"><span><span className="tiny-fourstar">✦</span> A VOICE FROM {selected.country_name.toUpperCase()}</span>
          <button onClick={() => setSelected(null)} aria-label="Close message"><X size={19}/></button></div>
        <div className="story-location">{flagEmoji(selected.country_code)} <MapPin size={14}/> {selected.country_name} <span>·</span> {relativeTime(selected.created_at)}</div>
        <div className="story-author"><div className="large-avatar">{selected.display_name[0]?.toUpperCase()}</div><div><span>WRITTEN BY</span><strong>{selected.display_name}</strong></div></div>
        <div className="story-quote">“</div><p className="story-body">{selected.body}</p><CategoryTag category={selected.category}/>
        <div className="story-actions"><button className={`story-like ${likedIds.has(selected.id) ? 'liked' : ''}`} onClick={() => void likePost(selected)}><Heart size={18} fill={likedIds.has(selected.id) ? 'currentColor' : 'none'}/> {selected.reaction_count} hearts</button>
          <button onClick={() => openCompose({ replyTo: selected })}><MessageCircle size={17}/> Reply</button>
          <button onClick={() => { setReporting(selected); setReportReason('spam'); }} className="story-report" aria-label="Report message" title="Report this message"><Flag size={17}/></button></div>
        <div className="replies-area"><div className="replies-title"><MessageCircle size={15}/> REPLIES <span>{replies.length}</span></div>
          {loadingReplies && <p className="muted-small">Loading replies…</p>}
          {replyError && <p className="muted-small">{replyError}</p>}
          {!loadingReplies && replies.length === 0 && <p className="muted-small">No replies yet. Be the first to leave a kind word.</p>}
          {replies.map(reply => <div className="reply-item" key={reply.id}><div className="reply-top"><span className="reply-avatar">{reply.display_name[0]?.toUpperCase()}</span><strong>{reply.display_name}</strong><span>{flagEmoji(reply.country_code)} {relativeTime(reply.created_at)}</span></div>
            <p>{reply.body}</p><div className="reply-actions"><button className={likedIds.has(reply.id) ? 'liked' : ''} onClick={() => void likePost(reply)}><Heart size={13} fill={likedIds.has(reply.id) ? 'currentColor' : 'none'}/>{reply.reaction_count}</button>
              <button onClick={() => { setReporting(reply); setReportReason('spam'); }}><Flag size={12}/> Report</button></div></div>)}
          <button className="reply-cta" onClick={() => openCompose({ replyTo: selected })}><Plus size={15}/> Add a reply</button></div>
      </section>}
      <button className="mobile-fab" onClick={() => openCompose()}><Plus size={21} /> Write</button>
      {sidebarOpen && <button className="mobile-sidebar-backdrop" aria-label="Close feed" onClick={() => setSidebarOpen(false)}/>}
    </>}

    {nameModal && <Modal onClose={() => { setNameModal(false); setPendingCompose(null); }} className="name-window">
      <button className="modal-close" onClick={() => { setNameModal(false); setPendingCompose(null); }} aria-label="Close"><X size={20}/></button>
      <div className="modal-star">✳</div><div className="modal-eyebrow">BEFORE WE BEGIN</div>
      <h2>What should the<br />world <em>call you?</em></h2>
      <p>Your display name will appear beside your messages. No email or password is needed.</p>
      <form onSubmit={submitName}><label htmlFor="name-input">YOUR DISPLAY NAME</label>
        <input autoFocus id="name-input" maxLength={28} value={nameInput} placeholder="e.g. wanderingmoon" onChange={event => setNameInput(event.target.value)}/>
        <small>2–28 characters. This is a public nickname, not a verified identity.</small>
        <button className="solid-action" type="submit">{username ? 'Save display name' : 'Continue to the world'} <ArrowRight size={18}/></button></form>
      <div className="modal-foot">ONE WORLD <span>✦</span> COUNTLESS STORIES</div>
    </Modal>}

    {composerOpen && <Modal onClose={() => { if (!publishing) setComposerOpen(false); }} className="compose-window">
      <div className="compose-top"><div className="compose-kicker"><Sparkles size={16}/> {composeContext.replyTo ? 'A REPLY TO THE WORLD' : 'LEAVE A PIECE OF YOURSELF'}</div>
        <button onClick={() => setComposerOpen(false)} aria-label="Close composer" disabled={publishing}><X size={20}/></button></div>
      <h2>{composeContext.replyTo ? <>Write something <em>back.</em></> : <>Your words have<br /><em>a place here.</em></>}</h2>
      {composeContext.replyTo && <div className="reply-context">Replying to <strong>{composeContext.replyTo.display_name}</strong><span>“{composeContext.replyTo.body.slice(0, 100)}{composeContext.replyTo.body.length > 100 ? '…' : ''}”</span></div>}
      <form onSubmit={event => void submitPost(event)}>
        <div className="compose-field"><label htmlFor="country">WHERE ARE YOU WRITING FROM?</label><div className="select-wrap"><MapPin size={17}/><select id="country" required value={composeCountry} onChange={event => setComposeCountry(event.target.value)}>
          <option value="">Select your country</option>{countries.map(country => <option key={country.code} value={country.code}>{flagEmoji(country.code)} {country.name}</option>)}
        </select><ChevronDown size={17}/></div><p className="field-hint">Only the country and an approximate pin appear publicly. No GPS is used.</p></div>
        <div className="compose-field"><label>WHAT KIND OF WORDS?</label><div className="category-choices">{CATEGORIES.map(category => <button type="button" key={category.id} className={`category-choice ${composeCategory === category.id ? 'category-choice-selected' : ''}`} onClick={() => setComposeCategory(category.id)} style={{ '--category-accent': category.color } as CSSProperties}><span>{category.icon}</span>{category.label}</button>)}</div></div>
        <div className="compose-field"><label htmlFor="message-text">SAY WHAT'S ON YOUR MIND</label><textarea autoFocus id="message-text" required minLength={2} maxLength={MAX_MESSAGE} value={messageInput} onChange={event => setMessageInput(event.target.value)} placeholder="Something you wish you could say…" rows={5} />
          <div className="message-counter"><span>Kindness travels further than words.</span><span>{messageInput.length} / {MAX_MESSAGE}</span></div></div>
        <div className="compose-bottom"><div className="compose-user"><span className="small-avatar">{username[0]?.toUpperCase()}</span><span>Posting as <strong>{username}</strong></span></div>
          <button className="solid-action" type="submit" disabled={publishing || !composeCountry || messageInput.trim().length < 2}>{publishing ? 'Publishing…' : composeContext.replyTo ? 'Publish reply' : 'Place on the map'} <Send size={16}/></button></div>
      </form>
    </Modal>}

    {aboutOpen && <Modal onClose={() => setAboutOpen(false)} className="about-window">
      <button className="modal-close" aria-label="Close" onClick={() => setAboutOpen(false)}><X size={20}/></button>
      <span className="about-icon"><Globe2 size={26}/></span><div className="modal-eyebrow">AN OPEN CORNER OF THE WORLD</div>
      <h2>Every place has<br /><em>a story.</em></h2>
      <p>Open Atlas is a public freedom wall mapped across the world. Share an anonymous-feeling thought with a nickname, write a confession, leave a little hope, or respond to someone else's story.</p>
      <div className="about-guidelines"><h3>Be kind here.</h3><div><Heart size={16}/> Respect people and their stories.</div><div><ShieldCheck size={16}/> Never post addresses, phone numbers, or private details.</div><div><Flag size={16}/> Report harassment, threats, spam, or hateful messages.</div><div><MapPin size={16}/> Country and map pins are manually chosen and approximate.</div></div>
      <p className="about-disclaimer">Display names are not verified. Guest sessions are tied to your browser, and removing its storage may lose your identity. This is a public website: never share information you need to keep private. Reports are reviewed manually in the Supabase dashboard. Public posting requires Supabase setup.</p>
      <button className="solid-action" onClick={() => setAboutOpen(false)}>Back to the world <ArrowRight size={17}/></button>
    </Modal>}

    {reporting && <Modal onClose={() => { if (!reportingBusy) setReporting(null); }} className="report-window">
      <button className="modal-close" onClick={() => setReporting(null)} aria-label="Close report"><X size={19}/></button>
      <span className="report-icon"><Flag size={23}/></span><div className="modal-eyebrow">KEEP THIS SPACE SAFE</div><h2>Report this <em>message.</em></h2>
      <p>Tell us why this message needs review.</p>
      <div className="report-choices">{[
        ['spam', 'Spam or advertising'], ['harassment', 'Harassment or bullying'],
        ['hate', 'Hateful or threatening content'], ['privacy', 'Private information'], ['other', 'Something else'],
      ].map(([key, label]) => <label key={key}><input type="radio" name="report" checked={reportReason === key} onChange={() => setReportReason(key)}/><span>{label}</span></label>)}</div>
      <button className="solid-action" onClick={() => void submitReport()} disabled={reportingBusy}>{reportingBusy ? 'Submitting…' : 'Submit report'} <ArrowRight size={17}/></button>
    </Modal>}

    {toast && <div className="toast-message" role="status"><Check size={17}/>{toast}<button onClick={() => setToast('')} aria-label="Dismiss"><X size={15}/></button></div>}
    {phase === 'explore' && <div className="mobile-top-shadow" aria-hidden="true" />}
    <div className="sr-only" aria-live="polite">{isLive ? 'Connected to a public Supabase database.' : 'Demonstration mode. Posts are only visible in this browser.'}</div>
  </div>;
}
