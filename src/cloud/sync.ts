// Облачная синхронизация через Supabase: анонимный вход, сейв раз в минуту, резервные копии.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BACKUP_INTERVAL, PUSH_INTERVAL, SUPABASE_KEY, SUPABASE_URL } from './config';
import { resolveSave, type CloudSave } from './resolve';

export type CloudStatus = 'off' | 'connecting' | 'synced' | 'offline' | 'error';

export interface CloudHooks {
  /** Текущее локальное состояние для отправки. */
  getLocal: () => { data: unknown; progress: number; updatedAt: number };
  /** Облако новее — применить сейв. */
  applyCloud: (data: unknown) => void;
  /** Нужен выбор игрока (облако дальше по прогрессу). */
  askConflict: (cloud: CloudSave, useCloud: () => void, keepLocal: () => void) => void;
  onStatus: (status: CloudStatus, at?: number) => void;
}

let client: SupabaseClient | null = null;
let userId: string | null = null;
let hooks: CloudHooks | null = null;
let timer: number | undefined;
let lastBackup = 0;
let lastPushed = '';
let paused = false;

async function getClient(): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alchemist-guild-auth' },
  });
  return client;
}

async function ensureUser(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error('anonymous sign-in failed');
  return anon.user.id;
}

export async function startCloud(h: CloudHooks): Promise<void> {
  hooks = h;
  h.onStatus('connecting');
  try {
    const sb = await getClient();
    userId = await ensureUser(sb);
    const { data, error } = await sb.from('saves').select('data, progress, updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const cloud: CloudSave | null = data ? { progress: Number(data.progress) || 0, updatedAt: Date.parse(data.updated_at) } : null;
    const local = h.getLocal();
    const decision = resolveSave(local, cloud);
    if (decision === 'pull-cloud' && data) {
      h.applyCloud(data.data);
      lastPushed = JSON.stringify(data.data);
    } else if (decision === 'ask' && data && cloud) {
      paused = true;
      h.askConflict(
        cloud,
        () => {
          h.applyCloud(data.data);
          lastPushed = JSON.stringify(data.data);
          paused = false;
        },
        () => {
          paused = false;
          void pushNow(true);
        },
      );
    } else {
      await pushNow(true);
    }
    h.onStatus('synced', Date.now());
  } catch {
    h.onStatus(navigator.onLine ? 'error' : 'offline');
  }
  clearInterval(timer);
  timer = window.setInterval(() => void pushNow(), PUSH_INTERVAL);
}

/** Отправить сейв, если он изменился. */
export async function pushNow(force = false): Promise<void> {
  if (!hooks || paused) return;
  try {
    const sb = await getClient();
    if (!userId) userId = await ensureUser(sb);
    const local = hooks.getLocal();
    const json = JSON.stringify(local.data);
    if (!force && json === lastPushed) return;
    const row = { user_id: userId, data: local.data, progress: local.progress, version: 1, updated_at: new Date().toISOString() };
    const { error } = await sb.from('saves').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    lastPushed = json;
    if (Date.now() - lastBackup > BACKUP_INTERVAL) {
      lastBackup = Date.now();
      await sb.from('save_backups').insert({ user_id: userId, data: local.data, progress: local.progress });
    }
    hooks.onStatus('synced', Date.now());
  } catch {
    hooks.onStatus(navigator.onLine ? 'error' : 'offline');
  }
}

/** Удалить облачный аккаунт и все сейвы (требование App Store). */
export async function deleteCloudAccount(): Promise<boolean> {
  try {
    const sb = await getClient();
    const { error } = await sb.rpc('delete_my_account');
    if (error) throw error;
    await sb.auth.signOut();
    userId = null;
    lastPushed = '';
    return true;
  } catch {
    return false;
  }
}
