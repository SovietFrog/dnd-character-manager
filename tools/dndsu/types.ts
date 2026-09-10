export interface DndClass {
  id: string
  name: string
  source?: string
  levels: ClassLevel[]
  features: ClassFeature[]
  origins: ClassOrigin[]
  archetypes: ClassArchetype[]
}

export interface ClassLevelColumn {
  id: string
  label: string
  value: number | null
}

export interface ClassLevel {
  level: number
  proficiencyBonus: number | null

  columns: ClassLevelColumn[]

  spellSlots: Record<string, number | null>

  features: string[]
}
export interface ClassFeature {
  id: string
  name: string
  level: number | null
  optional: boolean
  content: ContentNode[]
}

export interface ClassOrigin {
  id: string
  name: string
  content: ContentNode[]
}

export interface ClassArchetype {
  id: string
  name: string
  content: ContentNode[]
}

export type ContentNode =
  | TextNode
  | ParagraphNode
  | HeadingNode
  | ListNode
  | TableNode
  | LinkNode

export interface TextNode {
  type: 'text'
  text: string
}

export interface ParagraphNode {
  type: 'paragraph'
  children: ContentNode[]
}

export interface HeadingNode {
  type: 'heading'
  level: number
  children: ContentNode[]
}

export interface ListNode {
  type: 'list'
  ordered: boolean
  items: ContentNode[][]
}

export interface TableNode {
  type: 'table'
  headers: ContentNode[][]
  rows: ContentNode[][][]
}

export interface LinkNode {
  type: 'link'
  text: string
  href: string
  targetType: LinkTargetType
  targetId?: string
  targetSlug?: string
}

export type LinkTargetType =
  | 'spell'
  | 'bestiary'
  | 'homebrew-spell'
  | 'homebrew'
  | 'other'
