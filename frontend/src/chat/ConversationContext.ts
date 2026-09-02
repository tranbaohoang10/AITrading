import { createContext, useContext } from 'react'
import type { Conversation, Message } from './api'
import type { AiConfiguration, AiTurn } from './aiApi'

export type ChatState = {
  items: Conversation[]; nextCursor: string | null; selected: Conversation | null
  messages: Message[]; nextBefore: number | null; draft: string
  listLoading: boolean; messagesLoading: boolean; busy: boolean; uncertain: boolean
  pendingAction: 'create' | 'save' | 'ai' | null
  aiConfiguration: AiConfiguration | null; aiChecking: boolean; aiCancelling: boolean; aiError: string; aiTurn: AiTurn | null
  checkAiConfiguration: () => Promise<void>; send: () => Promise<void>; askAi: () => Promise<void>; checkAiStatus: () => Promise<void>; cancelAi: () => Promise<void>
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
