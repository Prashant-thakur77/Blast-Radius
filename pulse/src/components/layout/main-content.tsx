import { ReactNode } from "react"

export function MainContent({ children }: { children: ReactNode }) {
  return (
    <main className="pt-11 md:pt-12 md:pl-10 lg:pt-[54px] lg:pl-11">
      {children}
    </main>
  )
}
