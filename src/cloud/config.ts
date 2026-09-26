// Публичные параметры проекта Supabase. Publishable-ключ безопасен в клиенте:
// доступ к данным ограничен правилами Row Level Security (supabase/migrations/001_cloud_saves.sql).
export const SUPABASE_URL = 'https://pmqivhcraawvmxokthim.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_3IOby9Pn_NLrfhfaJsGzQg_m46BAQ1d';

/** Как часто отправлять сейв в облако, мс. */
export const PUSH_INTERVAL = 60_000;
/** Как часто делать резервную копию, мс. */
export const BACKUP_INTERVAL = 30 * 60_000;
