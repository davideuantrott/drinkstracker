export const PRESETS = [
  { icon: '🍺', name: 'Pint Lager',  vol: 568, abv: 4.5 },
  { icon: '🍷', name: 'Wine 175ml',  vol: 175, abv: 13.0 },
  { icon: '🥃', name: 'Spirit 25ml', vol: 25,  abv: 40.0 },
  { icon: '🍻', name: 'Half Lager',  vol: 284, abv: 4.5 },
  { icon: '🍹', name: 'Bottle WKD',  vol: 275, abv: 4.0 },
  { icon: '🥂', name: 'Prosecco',    vol: 125, abv: 11.0 },
  { icon: '🍸', name: 'Cocktail',    vol: 150, abv: 12.0 },
  { icon: '🍾', name: 'Bottle Beer', vol: 330, abv: 5.0 },
  { icon: '🥃', name: 'Double',      vol: 50,  abv: 40.0 }
]

export function getPresetIcon(name) {
  return PRESETS.find(p => p.name === name)?.icon ?? '🥤'
}
