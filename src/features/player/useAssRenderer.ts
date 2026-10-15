import type JASSUB from 'jassub'
import { useEffect, useRef, useState, type RefObject } from 'react'

type Options = {
  /** Original .ass/.ssa URL of the selected track; undefined = no ASS rendering. */
  subUrl: string | undefined
  /** Fonts embedded in the file (MKV attachments). */
  fontUrls: readonly string[]
  /** Subtitle delay in seconds (positive = later). */
  offset: number
}

/**
 * Renders ASS/SSA subtitles with full styling via JASSUB (libass in WebAssembly), loaded lazily the
 * first time it's needed. JASSUB draws on its own canvas right after the <video>.
 * Returns whether it is rendering; on failure the caller falls back to plain text.
 */
export function useAssRenderer(videoRef: RefObject<HTMLVideoElement | null>, { subUrl, fontUrls, offset }: Options) {
  const instance = useRef<JASSUB | null>(null)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const fontsKey = fontUrls.join('\n')
  const offsetRef = useRef(offset)
  useEffect(() => {
    offsetRef.current = offset
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !subUrl || subUrl === failedUrl) return
    let cancelled = false
    void (async () => {
      try {
        const { default: Jassub } = await import('jassub')
        if (cancelled) return
        const renderer = new Jassub({
          video,
          subUrl,
          fonts: fontsKey ? fontsKey.split('\n') : [],
          // No local-font permission prompts / Google Fonts lookups: embedded fonts + bundled fallback.
          queryFonts: false,
          // JASSUB shifts the other way: positive timeOffset shows subtitles earlier.
          timeOffset: -offsetRef.current,
        })
        instance.current = renderer
        await renderer.ready
      } catch (error) {
        console.warn('Player: styled ASS rendering failed, using plain text', error)
        if (!cancelled) setFailedUrl(subUrl)
      }
    })()
    return () => {
      cancelled = true
      void instance.current?.destroy()
      instance.current = null
    }
  }, [videoRef, subUrl, fontsKey, failedUrl])

  useEffect(() => {
    const renderer = instance.current
    if (!renderer) return
    renderer.timeOffset = -offset
    void renderer.resize(true).catch(() => undefined)
  }, [offset])

  return !!subUrl && subUrl !== failedUrl
}
