import { useEffect, useState } from 'react'
import * as api from '../lib/api'
import type { Project } from '../lib/api'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    api.listProjects().then(({ projects }) => setProjects(projects))
  }, [])

  return projects
}
