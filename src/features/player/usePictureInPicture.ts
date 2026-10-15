import { useCallback, useEffect, useState, type RefObject } from 'react'

/**
 * Picture-in-picture via the standard API (Chromium, Safari) from our control bar only.
 * `disablePictureInPicture` stays set so browsers don't add their own PiP button over the video
 * (Vivaldi, Opera, Edge); it is lifted just for our own request and restored when PiP ends.
 * Firefox has no API for this and keeps its own toggle.
 */
export function usePictureInPicture(videoRef: RefObject<HTMLVideoElement | null>) {
  const supported = typeof document !== 'undefined' && document.pictureInPictureEnabled === true
  const [active, setActive] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.disablePictureInPicture = true
    if (!supported) return
    const enter = () => setActive(true)
    const leave = () => {
      setActive(false)
      video.disablePictureInPicture = true
    }
    video.addEventListener('enterpictureinpicture', enter)
    video.addEventListener('leavepictureinpicture', leave)
    return () => {
      video.removeEventListener('enterpictureinpicture', enter)
      video.removeEventListener('leavepictureinpicture', leave)
    }
  }, [videoRef, supported])

  const toggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch((error: unknown) => console.warn('Player: leaving picture-in-picture failed', error))
      return
    }
    video.disablePictureInPicture = false
    void video.requestPictureInPicture().catch((error: unknown) => {
      video.disablePictureInPicture = true
      console.warn('Player: picture-in-picture failed', error)
    })
  }, [videoRef])

  return { supported, active, toggle }
}
