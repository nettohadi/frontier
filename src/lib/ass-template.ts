// Sufi Karaoke — ASS Style Template
//
// Visual design:
//   - Font: Amiri (Arabic calligraphy-style serif)
//   - Before state: Dim warm beige, semi-transparent
//   - Active state: Word fills left-to-right with warm ivory + golden glow (\kf)
//   - Lines fade in (300ms) and fade out (400ms)
//   - Soft blur creates a subtle glow around text
//   - Dark warm outline for readability on any background
//
// ASS color format: &HAABBGGRR (alpha, blue, green, red)
//   Alpha: 00 = opaque, FF = transparent

export const SUFI_STYLE = {
  name: 'SufiKaraoke',

  // Typography
  fontName: 'Impact',
  fontSize: 100,
  bold: 0,
  italic: 0,

  // Colors (ASS &HAABBGGRR format)
  //   PrimaryColour:   Dim warm beige RGB(180, 155, 120) @ ~65% transparent
  //   SecondaryColour: White RGB(255, 255, 255) — karaoke fill target
  //   OutlineColour:   Dark warm brown RGB(30, 20, 10)
  //   BackColour:      Dark warm shadow RGB(15, 10, 5) @ semi-transparent
  primaryColour: '&H0032D7FF',
  secondaryColour: '&H00FFFFFF',
  outlineColour: '&H000A141E',
  backColour: '&H50050A0F',

  // Effects
  borderStyle: 1,
  outline: 3,
  shadow: 1.5,

  // Alignment (numpad): 5 = center
  alignment: 5,

  // Margins (pixels from edge)
  marginL: 40,
  marginR: 40,
  marginV: 20,

  // Misc
  scaleX: 100,
  scaleY: 100,
  spacing: 1,
  angle: 0,
  encoding: 1,
} as const;

/**
 * Generate the complete ASS file header (Script Info + Styles + Events format).
 * Same for every video — only the Dialogue lines change.
 */
export function generateASSHeader(videoWidth: number = 1080, videoHeight: number = 1920): string {
  const s = SUFI_STYLE;

  return `[Script Info]
; Sufi Karaoke Subtitle — Auto-generated
Title: Sufi Karaoke
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${s.name},${s.fontName},${s.fontSize},${s.primaryColour},${s.secondaryColour},${s.outlineColour},${s.backColour},${s.bold},${s.italic},0,0,${s.scaleX},${s.scaleY},${s.spacing},${s.angle},${s.borderStyle},${s.outline},${s.shadow},${s.alignment},${s.marginL},${s.marginR},${s.marginV},${s.encoding}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}
