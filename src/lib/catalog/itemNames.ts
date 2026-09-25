import itemNames from '../../data/item-names.json';

const names: Record<string, string> = itemNames;

export function displayItemName(item: string): string {
  return names[item] ?? item;
}
