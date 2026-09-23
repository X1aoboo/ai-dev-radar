import { useEffect, useState } from 'react'

export default function useActiveSection(ids, enabled = true) {
  const identity = ids.join('\u0000')
  const [activeId, setActiveId] = useState(ids[0] ?? null)

  useEffect(() => {
    const sectionIds = identity ? identity.split('\u0000') : []
    if (!enabled || !sectionIds.length) {
      setActiveId(null)
      return undefined
    }
    setActiveId((current) => sectionIds.includes(current) ? current : sectionIds[0])
    if (typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver((entries) => {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setActiveId(sectionIds.at(-1))
        return
      }
      const next = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top - 96) - Math.abs(right.boundingClientRect.top - 96))[0]
      if (next) setActiveId(next.target.id)
    }, { rootMargin: '-96px 0px -35% 0px' })

    sectionIds.forEach((id) => {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    })
    const selectLastAtDocumentEnd = () => {
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1) {
        setActiveId(sectionIds.at(-1))
      }
    }
    window.addEventListener('scroll', selectLastAtDocumentEnd, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', selectLastAtDocumentEnd)
    }
  }, [enabled, identity])

  return activeId
}
