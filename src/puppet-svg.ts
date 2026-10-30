// Static SVG markup of the procedural puppet (original design, palette from docs/CHARACTER.md).
// Parts carry data-part attributes; puppet.ts moves them. No user text is ever put here.
// Tokens: @name = palette colour, #S = side (L or R), #X = x offset.

export const PALETTE = {
 orange: '#F28C28', lightOrange: '#FFB45E', white: '#FFFFFF', cream: '#FFF4E3',
 brown: '#4A2C1A', midBrown: '#7A4A2B', skin: '#FFE3CF', blush: '#FF9E8A',
} as const;

function paint(s: string): string {
 let out = s;
 for (const [name, hex] of Object.entries(PALETTE)) out = out.split('@' + name).join(hex);
 return out;
}

function side(s: string, side: 'L' | 'R', x: number): string {
 return paint(s).split('#S').join(side).split('#X').join(String(x));
}

const ARM =
 '<g data-part="arm#S" transform="translate(#X 150)"><rect x="-7" y="0" width="14" height="62" rx="7" fill="@cream" stroke="@brown" stroke-width="2"/>' +
 '<circle cx="0" cy="64" r="8" fill="@skin" stroke="@brown" stroke-width="2"/></g>';

const EYE =
 '<g data-part="eye#S" transform="translate(#X 112)"><ellipse rx="11" ry="13" fill="@white" stroke="@brown" stroke-width="2"/>' +
 '<g data-part="iris#S"><circle r="8" fill="@orange"/><circle r="4" fill="@brown"/><circle cx="-3" cy="-4" r="2" fill="@white"/></g>' +
 '<rect data-part="lid#S" x="-13" y="-15" width="26" height="0" fill="@skin"/></g>';

const BACK =
 '<g data-part="hairBack"><path d="M45 90 Q40 200 60 270 Q100 290 140 270 Q160 200 155 90 Z" fill="@orange" stroke="@brown" stroke-width="2"/></g>';

const BODY =
 '<g data-part="body">' +
 '<path d="M62 150 Q100 140 138 150 L146 262 Q100 276 54 262 Z" fill="@brown"/>' +
 '<path d="M74 158 Q100 152 126 158 L134 262 Q100 272 66 262 Z" fill="@white" stroke="@brown" stroke-width="2"/>' +
 '<path d="M66 255 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0 q8 10 16 0" fill="@cream" stroke="@brown" stroke-width="2"/>' +
 '<path d="M80 152 L84 205 M120 152 L116 205" stroke="@midBrown" stroke-width="6" fill="none"/>' +
 '<path d="M88 150 L100 158 L112 150 L108 166 L100 160 L92 166 Z" fill="@midBrown" stroke="@brown" stroke-width="2"/>' +
 '<circle cx="100" cy="160" r="6" fill="@lightOrange" stroke="@orange" stroke-width="2"/></g>';

const FACE =
 '<ellipse cx="100" cy="108" rx="46" ry="50" fill="@skin" stroke="@brown" stroke-width="2"/>';

const BROWS =
 '<path data-part="browL" d="M68 92 Q80 86 92 92" stroke="@brown" stroke-width="3" fill="none" stroke-linecap="round"/>' +
 '<path data-part="browR" d="M108 92 Q120 86 132 92" stroke="@brown" stroke-width="3" fill="none" stroke-linecap="round"/>' +
 '<ellipse data-part="cheekL" cx="70" cy="128" rx="9" ry="5" fill="@blush" opacity="0"/>' +
 '<ellipse data-part="cheekR" cx="130" cy="128" rx="9" ry="5" fill="@blush" opacity="0"/>' +
 '<path data-part="mouth" d="M90 138 Q100 144 110 138" stroke="@brown" stroke-width="3" fill="@brown" fill-opacity="0" stroke-linecap="round"/>';

const TOP =
 '<path data-part="hairFront" d="M52 100 Q56 52 100 50 Q144 52 148 100 Q132 70 112 72 Q90 82 70 72 Q58 80 52 100 Z" fill="@orange" stroke="@brown" stroke-width="2"/>' +
 '<path d="M66 62 Q100 36 134 62 Q100 54 66 62 Z" fill="@white" stroke="@brown" stroke-width="2"/>' +
 '<g transform="translate(142 70)"><circle r="7" fill="@lightOrange" stroke="@orange" stroke-width="2"/><circle r="2.5" fill="@brown"/>' +
 '<path d="M-3 7 L-5 22 M3 7 L5 20" stroke="@brown" stroke-width="2"/></g>';

export const PUPPET_SVG =
 '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" width="100%" height="100%" role="img" aria-label="Claude-chan">' +
 '<g data-part="root">' + paint(BACK) + paint(BODY) + side(ARM, 'L', 62) + side(ARM, 'R', 138) +
 '<g data-part="head">' + paint(FACE) + side(EYE, 'L', 80) + side(EYE, 'R', 120) + paint(BROWS) + paint(TOP) + '</g></g></svg>';
