import type { BonusType, GeneratorId, HeroRole, Rarity } from '../core/types';
import { TEXTS } from '../data/texts';
import { HEROES } from '../data/heroes';
import { pct } from './format';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export const ROLE_LABEL: Record<HeroRole, { name: string; icon: string }> = {
  herbalist: { name: 'Травник', icon: 'role_herbalist' },
  warrior: { name: 'Воин', icon: 'role_warrior' },
  sage: { name: 'Мудрец', icon: 'role_sage' },
  merchant: { name: 'Торговец', icon: 'role_merchant' },
};

export function bonusText(type: BonusType, value: number, target?: GeneratorId): string {
  const v = pct(value, value < 0.1 ? 1 : 0);
  switch (type) {
    case 'tapMult':
      return `+${v} к силе тапа`;
    case 'prodMult':
      return `+${v} ко всему доходу`;
    case 'genMult':
      return `+${v} к «${target ? TEXTS.generators[target].name : '?'}»`;
    case 'critChance':
      return `+${v} шанс крита`;
    case 'critMult':
      return `+${v} к силе крита`;
    case 'expeditionSpeed':
      return `−${v} времени экспедиций`;
    case 'expeditionLoot':
      return `+${v} добычи экспедиций`;
    case 'wispBonus':
      return `+${v} к наградам искр`;
    case 'offlineMult':
      return `+${v} оффлайн-дохода`;
    case 'costReduction':
      return `−${v} к цене построек`;
    case 'essenceMult':
      return `+${v} эссенции`;
  }
}

const HERO_NAME = Object.fromEntries(HEROES.map((h) => [h.id, h.name]));

/** Имя и портрет говорящего: сюжетные персонажи, а также любой герой гильдии по его id. */
export function speaker(id: string) {
  return TEXTS.speakers[id] ?? (HERO_NAME[id] ? { name: HERO_NAME[id], icon: id } : { name: id, icon: 'question' });
}
