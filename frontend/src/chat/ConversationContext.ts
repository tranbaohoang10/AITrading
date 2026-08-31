import { createContext, useContext } from 'react'
import type { Conversation, Message } from './api'

export type ChatState = {
  items: Conversation[]; nextCursor: string | null; selected: Conversation | null
  messages: Message[]; nextBefore: number | null; draft: string
  listLoading: boolean; messagesLoading: boolean; busy: boolean; uncertain: boolean
  pendingAction: 'create' | 'save' | null
  listError: string; messageError: string; mutationError: string; notice: string
  setDraft: (text: string) => void; select: (item: Conversation) => void
  loadList: (more?: boolean) => Promise<void>; loadMessages: (earlier?: boolean) => Promise<void>
  create: () => Promise<void>; save: () => Promise<void>; rename: (title: string) => Promise<void>; remove: () => Promise<boolean>
}
export const ConversationContext = createContext<ChatState | null>(null)
export function useConversations() {
  const value = useContext(ConversationContext)
  if (!value) throw new Error('Conversations require the authenticated provider')
  return value
}
