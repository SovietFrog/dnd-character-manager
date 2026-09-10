export interface Character {
  id: string

  name: string
  race: string
  class: string
  level: number

  hitPoints: {
    current: number
    maximum: number
  }
}
