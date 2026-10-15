// Language codes: Jellyfin reports ISO 639-2 (mostly the "terminology" form, sometimes the
// "bibliographic" one: ger/deu, fre/fra). Everything is normalized to 639-2/T for comparisons.

const BIBLIOGRAPHIC: Record<string, string> = {
  ger: 'deu', fre: 'fra', chi: 'zho', cze: 'ces', dut: 'nld', gre: 'ell', per: 'fas', rum: 'ron', slo: 'slk',
  alb: 'sqi', arm: 'hye', baq: 'eus', bur: 'mya', geo: 'kat', ice: 'isl', mac: 'mkd', mao: 'mri', may: 'msa',
  tib: 'bod', wel: 'cym',
}

const TWO_TO_THREE: Record<string, string> = {
  en: 'eng', ja: 'jpn', de: 'deu', fr: 'fra', es: 'spa', it: 'ita', pt: 'por', ru: 'rus', zh: 'zho', ko: 'kor',
  nl: 'nld', pl: 'pol', sv: 'swe', no: 'nor', nb: 'nob', da: 'dan', fi: 'fin', cs: 'ces', hu: 'hun', tr: 'tur',
  ar: 'ara', he: 'heb', hi: 'hin', th: 'tha', vi: 'vie', id: 'ind', uk: 'ukr', el: 'ell', ro: 'ron', sk: 'slk',
}

const THREE_TO_TWO = Object.fromEntries(Object.entries(TWO_TO_THREE).map(([two, three]) => [three, two]))

/** "de", "ger", "GER" → "deu". Unknown or empty → undefined. */
export function normalizeLanguage(code: string | null | undefined): string | undefined {
  const c = code?.trim().toLowerCase()
  if (!c || c === 'und' || c === 'unk') return undefined
  if (c.length === 2) return TWO_TO_THREE[c] ?? c
  return BIBLIOGRAPHIC[c] ?? c
}

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    return null
  }
})()

/** "jpn" → "Japanese". */
export function languageName(code: string | undefined): string {
  const normalized = normalizeLanguage(code)
  if (!normalized) return 'Unknown'
  try {
    return displayNames?.of(THREE_TO_TWO[normalized] ?? normalized) ?? normalized
  } catch {
    return normalized
  }
}

/** "jpn, en; de" → ["jpn", "eng", "deu"] (deduplicated, order kept). */
export function parseLanguageList(text: string): string[] {
  const codes = text
    .split(/[\s,;]+/)
    .map((c) => normalizeLanguage(c))
    .filter((c): c is string => !!c)
  return [...new Set(codes)]
}
