import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const CATEGORIES = [
  { id: 'thought', label: 'A thought', icon: '✦', color: '#9bd7d2' },
  { id: 'confession', label: 'A confession', icon: '♡', color: '#f1b6bc' },
  { id: 'hope', label: 'A hope', icon: '☼', color: '#edc99f' },
  { id: 'story', label: 'A story', icon: '◌', color: '#b7b2ed' },
] as const;
export type Category = (typeof CATEGORIES)[number]['id'];

export type Post = {
  id: string;
  author_id: string;
  display_name: string;
  body: string;
  country_code: string;
  country_name: string;
  latitude: number;
  longitude: number;
  category: Category;
  parent_id: string | null;
  reaction_count: number;
  created_at: string;
  hidden: boolean;
};
export type Draft = Pick<Post, 'display_name' | 'body' | 'country_code' | 'country_name' | 'latitude' | 'longitude' | 'category' | 'parent_id'>;

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isLive = Boolean(url && key);
export const supabase: SupabaseClient | null = isLive ? createClient(url!, key!) : null;

const storeName = 'open-atlas-v1-posts';
const likesName = 'open-atlas-v1-likes';
const seedUser = 'demo-author';
const age = (hours: number) => new Date(Date.now() - hours * 3600000).toISOString();

/** Fictional preview posts, never presented as actual visitors. */
const DEMO_POSTS: Post[] = [
  ['demo1', 'littlemoon', 'Sometimes healing is just learning to enjoy a quiet evening again.', 'PH', 'Philippines', 10, 123, 'thought', 86, 2.1],
  ['demo2', 'solace', 'To whoever is starting over: there is no shame in beginning again.', 'JP', 'Japan', 36, 139, 'hope', 123, 5.4],
  ['demo3', 'bluehour', 'I still take the longer way home because the sky is prettier that way.', 'GB', 'United Kingdom', 52, -1, 'story', 54, 9.7],
  ['demo4', 'wanderer', 'A letter I never sent: I hope you are happy, even if we never speak again.', 'US', 'United States', 40, -74, 'confession', 210, 13],
  ['demo5', 'sunflower', 'Someday I want to live somewhere no one knows my old mistakes.', 'FR', 'France', 49, 2, 'hope', 64, 22],
  ['demo6', 'cloudwatcher', 'It is okay to not have everything figured out at twenty.', 'IN', 'India', 19, 73, 'thought', 93, 27],
  ['demo7', 'moss', 'Dear future me: I hope you kept your kindness.', 'CA', 'Canada', 49, -123, 'hope', 145, 36],
  ['demo8', 'petal', 'The best part of today was a stranger smiling back at me.', 'BR', 'Brazil', -23, -46, 'story', 49, 41],
  ['demo9', 'afterglow', 'I miss the version of us that laughed about absolutely nothing.', 'KR', 'South Korea', 37, 127, 'confession', 183, 49],
  ['demo10', 'orion', 'You are allowed to grow into someone you have not met yet.', 'AU', 'Australia', -34, 151, 'hope', 102, 63],
  ['demo11', 'ember', 'There is a special kind of freedom in finally being yourself.', 'DE', 'Germany', 52, 13, 'thought', 78, 76],
  ['demo12', 'sundae', 'Today, I watched the rain with no plans and it felt like enough.', 'ID', 'Indonesia', -6, 107, 'story', 57, 89],
].map(([id, name, body, code, country, lat, lng, category, count, hours]) => ({
  id: String(id), author_id: seedUser, display_name: String(name), body: String(body),
  country_code: String(code), country_name: String(country), latitude: Number(lat), longitude: Number(lng),
  category: category as Category, parent_id: null, reaction_count: Number(count),
  created_at: age(Number(hours)), hidden: false,
}));

const DEMO_REPLIES: Post[] = [
  { ...DEMO_POSTS[0], id: 'reply-demo1', parent_id: 'demo1', display_name: 'starling', body: 'Thank you. I needed this today.', reaction_count: 0, created_at: age(1.2) },
  { ...DEMO_POSTS[3], id: 'reply-demo2', parent_id: 'demo4', display_name: 'mellow', body: 'Some letters can be left unwritten. Wishing you peace.', reaction_count: 0, created_at: age(8) },
];

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}
function saveJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export async function getPosts(): Promise<Post[]> {
  if (!supabase) {
    const likes = new Set(readJSON<string[]>(likesName, []));
    return [...readJSON<Post[]>(storeName, []).filter(post => !post.parent_id), ...DEMO_POSTS]
      .filter(post => !post.hidden).map(post => ({ ...post, reaction_count: post.reaction_count + (likes.has(post.id) ? 1 : 0) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase.from('posts').select('*').is('parent_id', null)
    .eq('hidden', false).order('created_at', { ascending: false }).limit(350);
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function getReplies(postId: string): Promise<Post[]> {
  if (!supabase) {
    const likes = new Set(readJSON<string[]>(likesName, []));
    return [...DEMO_REPLIES, ...readJSON<Post[]>(storeName, [])]
      .filter(post => post.parent_id === postId && !post.hidden)
      .map(post => ({ ...post, reaction_count: post.reaction_count + (likes.has(post.id) ? 1 : 0) }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  const { data, error } = await supabase.from('posts').select('*').eq('parent_id', postId)
    .eq('hidden', false).order('created_at', { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function authenticateForPosting(): Promise<string> {
  if (!supabase) return 'browser-demo';
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session?.user) return session.user.id;
  const result = await supabase.auth.signInAnonymously();
  if (result.error || !result.data.user) throw result.error ?? new Error('Could not create a guest session.');
  return result.data.user.id;
}

export async function publishPost(draft: Draft): Promise<Post> {
  const author_id = await authenticateForPosting();
  if (!supabase) {
    const post: Post = { ...draft, author_id, id: crypto.randomUUID(), reaction_count: 0,
      hidden: false, created_at: new Date().toISOString() };
    saveJSON(storeName, [post, ...readJSON<Post[]>(storeName, [])]);
    return post;
  }
  const { data, error } = await supabase.from('posts').insert({ ...draft, author_id }).select('*').single();
  if (error) throw error;
  return data as Post;
}

export async function getMyLikes(): Promise<Set<string>> {
  if (!supabase) return new Set(readJSON<string[]>(likesName, []));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return new Set();
  const { data, error } = await supabase.from('post_likes').select('post_id').eq('author_id', session.user.id);
  if (error) throw error;
  return new Set((data ?? []).map(row => row.post_id as string));
}

export async function togglePostLike(postId: string, liked: boolean): Promise<void> {
  if (!supabase) {
    const likes = new Set(readJSON<string[]>(likesName, []));
    if (liked) likes.delete(postId); else likes.add(postId);
    saveJSON(likesName, [...likes]);
    return;
  }
  const author_id = await authenticateForPosting();
  if (liked) {
    const { error } = await supabase.from('post_likes').delete().eq('post_id', postId).eq('author_id', author_id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, author_id });
    if (error) throw error;
  }
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  if (!supabase) return;
  const author_id = await authenticateForPosting();
  const { error } = await supabase.from('post_reports').insert({ post_id: postId, author_id, reason });
  if (error) throw error;
}

export function watchPosts(onChange: () => void): () => void {
  if (!supabase) {
    const handleStorage = (e: StorageEvent) => {
      if ([storeName, likesName].includes(e.key ?? '')) onChange();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }
  const channel = supabase.channel('open-atlas-public-posts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
