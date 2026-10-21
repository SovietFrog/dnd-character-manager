export interface DndSource {
  id: string
  name: string
}

export type DndEntityType =
  | 'class'
  | 'subclass'
  | 'spell'
  | 'equipment'
  | 'species'
  | 'background'
  | 'feat'
  | 'other'

export interface DndEntity {
  id: string
  name: string
  source?: string
}

export type DndSourceCategory =
  | 'core'
  | 'sourcebook'
  | 'campaign'
  | 'supplement'
  | 'homebrew'

export interface DndSource {
  id: string
  name: string
  shortName?: string
  localizedName?: string
  category: DndSourceCategory
  url?: string
}

export interface DndReference {
  type: DndEntityType
  id: string
  name?: string
}

export interface DndClass extends DndEntity {
  levels: ClassLevel[]
  features: ClassFeature[]
  subclasses: ClassSubclass[]
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

export interface ClassSubclass extends DndEntity {
  features: ClassFeature[]
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
  targetType: DndEntityType | 'homebrew' | 'other'
  targetId?: string
  targetSlug?: string
}
