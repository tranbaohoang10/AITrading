import { mutate, request } from '../auth/api'

export type Conversation = { id: string; title: string; version: number; createdAt: string; updatedAt: string; lastMessage: string }
export type Message = { sequence: number; requestId: string; role: 'user' | 'assistant'; content: string; createdAt: string }
export type Page = { items: Conversation[]; nextCursor: string | null }
export type Messages = { conversation: Conversation; items: Message[]; nextBefore: number | null }
const invalid = () => new Error('Invalid conversation response. Please retry.')
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
const text = (value: unknown): string => { if (typeof value !== 'string') throw invalid(); return value }
const number = (value: unknown): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw invalid(); return value }
const date = (value: unknown): string => { const s = text(value); if (!Number.isFinite(Date.parse(s))) throw invalid(); return s }
const id = (value: unknown): string => { const s = text(value); if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s)) throw invalid(); return s }
function conversation(value: unknown): Conversation {
  const v = object(value)
  return { id: id(v.id), title: text(v.title), version: number(v.version), createdAt: date(v.createdAt), updatedAt: date(v.updatedAt), lastMessage: text(v.lastMessage) }
}
function message(value: unknown): Message {
  const v = object(value)
  if (v.role !== 'user' && v.role !== 'assistant') throw invalid()
  return { sequence: number(v.sequence), requestId: id(v.requestId), role: v.role, content: text(v.content), createdAt: date(v.createdAt) }
}
export async function listConversations(cursor?: string): Promise<Page> {
  const v = object(await (await request(`/conversations?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).json())
  if (!Array.isArray(v.items)) throw invalid()
  return { items: v.items.map(conversation), nextCursor: v.nextCursor === null ? null : text(v.nextCursor) }
}
export async function getMessages(conversationId: string, before?: number): Promise<Messages> {
  const v = object(await (await request(`/conversations/${id(conversationId)}/messages?limit=50${before ? `&before=${before}` : ''}`)).json())
  if (!Array.isArray(v.items)) throw invalid()
  const selected = conversation(v.conversation)
  if (selected.id !== conversationId) throw invalid()
  return { conversation: selected, items: v.items.map(message), nextBefore: v.nextBefore === null ? null : number(v.nextBefore) }
}
export const createConversation = async (requestId: string) => conversation(await mutate('/conversations', { requestId }))
export const renameConversation = async (value: Conversation, title: string) => conversation(await mutate(`/conversations/${id(value.id)}`, { title, expectedVersion: value.version }, 'PATCH'))
export const deleteConversation = async (value: Conversation) => mutate(`/conversations/${id(value.id)}`, { expectedVersion: value.version }, 'DELETE')
export const saveMessage = async (conversationId: string, requestId: string, content: string) => message(await mutate(`/conversations/${id(conversationId)}/messages`, { requestId, content }))
