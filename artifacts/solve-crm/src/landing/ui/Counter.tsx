import { useEffect, useRef, useState } from 'react'
import { useInView } from '../hooks/useInView'

interface CounterProps {
  target: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

export default function Counter({
  target,
  prefix = '',
  suffix = '',
  duration = 2000,
  className = '',
}: CounterProps) {
  const [count, setCount] = useState(0)
  const { ref, isInView } = useInView({ threshold: 0.5 })
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true
      const startTime = performance.now()
      const startValue = 0

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easeOutCubic(progress)
        setCount(Math.floor(startValue + (target - startValue) * easedProgress))

        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setCount(target)
        }
      }

      requestAnimationFrame(animate)
    }
  }, [isInView, target, duration])

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + ' MI'
    }
    if (num >= 1000) {
      // Se for exato (ex: 20000), devolve '20 MIL', senão '20,5 MIL'
      return (num / 1000).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) + ' MIL'
    }
    return num.toLocaleString('pt-PT')
  }

  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className={className}>
      {prefix}{formatNumber(count)}{suffix}
    </span>
  )
}
