import type { BonusType, GeneratorId, HeroRole, Rarity } from '../core/types';
import { TEXTS } from '../data/texts';
import { pct } from './format';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

export const ROLE_LABEL: Record<HeroRole, { name: string; emoji: string }> = {
  herbalist: { name: 'Травник', emoji: '🌿' },
  warrior: { name: 'Воин', emoji: '⚔️' },
  sage: { name: 'Мудрец', emoji: '📚' },
  merchant: { name: 'Торговец', emoji: '💰' },
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

export function speaker(id: string) {
  return TEXTS.speakers[id] ?? { name: id, emoji: '❔' };
}
