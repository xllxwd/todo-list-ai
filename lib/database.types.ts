export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          title: string
          completed: boolean
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          completed?: boolean
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          completed?: boolean
          parent_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
