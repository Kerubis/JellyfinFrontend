import { useCallback, useEffect, useState, type RefObject } from 'react'

export type RemoteState = 'unavailable' | 'disconnected' | 'connecting' | 'connected'

/**
 * Browser-native casting (Remote Playback API, e.g. Chrome → Chromecast). The browser hands the
 * stream URL to the device, so it only works for direct-play URLs the device can reach; streams
 * fed through hls.js (Media Source Extensions) can't be cast this way.
 */
export function useRemotePlayback(videoRef: RefObject<HTMLVideoElement | null>, sourceKey: string | undefined) {
  const [state, setState] = useState<RemoteState>('unavailable')

  useEffect(() => {
    const video = videoRef.current
    const remote = video?.remote
    if (!video || !remote || !sourceKey) return
    let callbackId: number | undefined
    let available = false
    const sync = () => setState(available || remote.state !== 'disconnected' ? remote.state : 'unavailable')
    remote
      .watchAvailability((isAvailable) => {
        available = isAvailable
        sync()
      })
      .then((id) => (callbackId = id))
      .catch(() => {
        // NotSupportedError: this source can't be cast (e.g. hls.js / MSE).
        available = false
        sync()
      })
    remote.addEventListener('connecting', sync)
    remote.addEventListener('connect', sync)
    remote.addEventListener('disconnect', sync)
    return () => {
      if (callbackId !== undefined) void remote.cancelWatchAvailability(callbackId).catch(() => undefined)
      remote.removeEventListener('connecting', sync)
      remote.removeEventListener('connect', sync)
      remote.removeEventListener('disconnect', sync)
    }
  }, [videoRef, sourceKey])

  const prompt = useCallback(() => {
    void videoRef.current?.remote.prompt().catch(() => undefined)
  }, [videoRef])

  return { state, prompt }
}
