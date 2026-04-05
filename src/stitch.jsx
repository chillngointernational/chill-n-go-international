import { useState, useEffect } from 'react'

export function useDesktop(breakpoint = 768) {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(`(min-width: ${breakpoint}px)`).matches)
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const handler = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isDesktop
}

export const C = {
  bg: '#080C14',
  surface: '#0D1117',
  surfaceLow: '#181c22',
  surfaceContainer: '#1c2026',
  surfaceHigh: '#262a31',
  surfaceHighest: '#31353c',
  primary: '#68dbae',
  primaryContainer: '#26a37a',
  primaryDark: '#0F6E56',
  primaryBright: '#1D9E75',
  secondary: '#e7c092',
  secondaryDark: '#B8956A',
  tertiary: '#c5c0ff',
  tertiaryContainer: '#8c84eb',
  tertiaryDark: '#41379b',
  error: '#ffb4ab',
  errorBright: '#E24B4A',
  text: '#F1EFE8',
  textDim: 'rgba(241,239,232,0.6)',
  textFaint: 'rgba(241,239,232,0.4)',
  textGhost: 'rgba(241,239,232,0.3)',
  onSurface: '#dfe2eb',
  onSurfaceVariant: '#bccac1',
  outline: '#87948c',
  outlineVariant: '#3d4943',
}
export const FONT = {
  headline: "'Manrope', sans-serif",
  body: "'Be Vietnam Pro', sans-serif",
}
export function Icon({ name, fill, size = 24, className = '', style = {} }) {
  return (
    <span className={'material-symbols-outlined ' + className} style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : undefined, lineHeight: 1, ...style }}>{name}</span>
  )
}
export const GRADIENT = {
  primary: 'linear-gradient(135deg, #1D9E75, #0F6E56)',
  candy: 'linear-gradient(135deg, #7F77DD, #41379b)',
}
export const GLASS_NAV = {
  background: 'rgba(13,17,23,0.8)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}
