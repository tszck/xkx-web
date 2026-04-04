import { apiFetch } from './client'

export interface HelpTopicsResponse {
  id: string
  title: string
  text: string
  html: string
  updatedAt: string
}

export async function getHelpTopics(): Promise<HelpTopicsResponse> {
  return apiFetch<HelpTopicsResponse>('/help/topics')
}
