// GSAP foundation — registers plugins once and sets the global motion language.
// Import { gsap, ScrollTrigger, SplitText, useGSAP, reducedMotion } from here.
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP)

// One motion language for the whole site. Individual tweens can override.
gsap.defaults({ ease: 'power3.out', duration: 0.7 })

// Convenience flag for imperative branches outside a matchMedia block.
export const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, ScrollTrigger, SplitText, useGSAP }
