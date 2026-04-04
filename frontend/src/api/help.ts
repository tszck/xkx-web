import { apiFetch } from './client'

export interface HelpTopicsResponse {
  id: string
  title: string
  text: string
  html: string
  updatedAt: string
}

export interface HelpTopicResponse {
  key: string
  title: string
  text: string
  updatedAt: string
}

export async function getHelpTopics(): Promise<HelpTopicsResponse> {
  return apiFetch<HelpTopicsResponse>('/help/topics')
}

export async function getHelpTopic(topic: string): Promise<HelpTopicResponse> {
  const key = topic.trim()
  return apiFetch<HelpTopicResponse>(`/help/topic/${encodeURIComponent(key)}`)
}
