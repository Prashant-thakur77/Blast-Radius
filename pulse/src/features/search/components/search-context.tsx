"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface SearchContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function useSearch() {
  const ctx = useContext(SearchContext)
  if (!ctx) throw new Error("useSearch must be used within SearchProvider")
  return ctx
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false)
  const setOpen = useCallback((value: boolean) => setOpenState(value), [])

  return (
    <SearchContext.Provider value={{ open, setOpen }}>
      {children}
    </SearchContext.Provider>
  )
}
