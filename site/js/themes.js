// Engine tokens per livery: text ink, boxes, perforation, codes, QR tile, export mat and the page glow.
// Art tokens (sky, buildings, tabs) live in art.js. Values are frozen unless a contrast check fails:
// ink on box >= 5.8:1, QR modules on tile >= 7:1, always dark modules on a light tile.

export const THEME_IDS = ['night', 'sunset', 'keys', 'ocean'];
export const DEFAULT_THEME = 'night';
// First Class tab and seal fill, every livery. White text holds >= 3.4:1 on each stop.
export const FOIL = ['#6E5BC4', '#2E8FA8', '#B8862B', '#B8467F', '#6E5BC4'];   // stops at 0 .25 .5 .75 1

export const THEMES = {
  sunset: {
    id: 'sunset', name: 'Sunset', line: 'The original lavender, at dusk.', scheme: 'light',
    ink: '#293452', muted: '#293452', onBand: '#FFFFFF', onInk: '#FFFFFF',
    box: '#FFFFFF', boxOpacity: 0.6, boxLine: null, boxLineOpacity: 0,
    tear: '#FFFFFF', tearOpacity: 1, code: '#293452',
    qrTile: '#FFFFFF', qrTileOpacity: 0.9, qrInk: '#293452',
    mat: '#111016', pageGlow: '#B28FCE', swatch: ['#8968AB', '#D9B1EA', '#293452'],
  },
  night: {
    id: 'night', name: 'Night', line: 'Midnight over downtown.', scheme: 'dark',
    ink: '#F5EDFB', muted: '#C3B3D8', onBand: '#FFFFFF', onInk: '#100C1E',
    box: '#100C1E', boxOpacity: 0.62, boxLine: '#FFFFFF', boxLineOpacity: 0.16,
    tear: '#F5EDFB', tearOpacity: 1, code: '#F5EDFB',
    qrTile: '#F5EDFB', qrTileOpacity: 1, qrInk: '#100C1E',
    mat: '#08070B', pageGlow: '#FF5FD2', swatch: ['#3A1D58', '#2B1745', '#F5EDFB'],
  },
  keys: {
    id: 'keys', name: 'Leonida Keys', line: 'Seaplane over the Keys.', scheme: 'light',
    ink: '#06343F', muted: '#06343F', onBand: '#FFFFFF', onInk: '#FFFFFF',
    box: '#FFFFFF', boxOpacity: 0.72, boxLine: null, boxLineOpacity: 0,
    tear: '#FFFFFF', tearOpacity: 1, code: '#06343F',
    qrTile: '#FFFFFF', qrTileOpacity: 0.92, qrInk: '#06343F',
    mat: '#F2FBFC', pageGlow: '#5FD6E0', swatch: ['#14A3A8', '#F2A65A', '#06343F'],
  },
  ocean: {
    id: 'ocean', name: 'Ocean Drive', line: 'Teal, coral, 1986.', scheme: 'light',
    ink: '#0E3446', muted: '#0E3446', onBand: '#FFFFFF', onInk: '#FFFFFF',
    box: '#FFFFFF', boxOpacity: 0.7, boxLine: null, boxLineOpacity: 0,
    tear: '#FFFFFF', tearOpacity: 1, code: '#0E3446',
    qrTile: '#FFFFFF', qrTileOpacity: 0.9, qrInk: '#0E3446',
    mat: '#0B1721', pageGlow: '#86DFDC', swatch: ['#178A8E', '#BFE6DA', '#0E3446'],
  },
};

export const themeOf = id => THEMES[id] || THEMES[DEFAULT_THEME];
