export interface SearchProjectResult {
  id: string
  name: string
  slug: string
  status: string
  icon: string
}

export interface SearchTaskResult {
  id: string
  title: string
  status: string
  priority: string
  projectSlug: string
  projectName: string
}

export interface SearchResponse {
  projects: SearchProjectResult[]
  tasks: SearchTaskResult[]
}
