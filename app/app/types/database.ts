export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      business: {
        Row: {
          address: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          logo_path: string | null
          name: string
          nit: string | null
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          logo_path?: string | null
          name: string
          nit?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          logo_path?: string | null
          name?: string
          nit?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      category: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      customer: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_sequence: {
        Row: {
          business_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          next_value: number
        }
        Insert: {
          business_id: string
          doc_type: Database["public"]["Enums"]["document_type"]
          next_value?: number
        }
        Update: {
          business_id?: string
          doc_type?: Database["public"]["Enums"]["document_type"]
          next_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "doc_sequence_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      expense: {
        Row: {
          amount: number
          business_id: string
          category: string
          concept: string
          created_at: string
          id: string
          recurring: boolean
          spent_at: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          concept: string
          created_at?: string
          id?: string
          recurring?: boolean
          spent_at?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          concept?: string
          created_at?: string
          id?: string
          recurring?: boolean
          spent_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          active: boolean
          business_id: string
          category_id: string | null
          cost: number
          created_at: string
          id: string
          min_stock: number
          name: string
          price: number
          sku: string
          stock: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: string
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          price?: number
          sku: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          price?: number
          sku?: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_line: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          qty: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          qty: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          qty?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_line_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order: {
        Row: {
          business_id: string
          code: string
          created_at: string
          expected_at: string | null
          id: string
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          expected_at?: string | null
          id?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          expected_at?: string | null
          id?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier"
            referencedColumns: ["id"]
          },
        ]
      }
      quote: {
        Row: {
          business_id: string
          code: string
          created_at: string
          customer_id: string | null
          id: string
          status: Database["public"]["Enums"]["quote_status"]
          total: number
          updated_at: string
          valid_until: string
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          customer_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number
          updated_at?: string
          valid_until: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          total?: number
          updated_at?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line: {
        Row: {
          created_at: string
          id: string
          name_snapshot: string
          product_id: string | null
          qty: number
          quote_id: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_snapshot: string
          product_id?: string | null
          qty: number
          quote_id: string
          unit_cost: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_snapshot?: string
          product_id?: string | null
          qty?: number
          quote_id?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
        ]
      }
      sale: {
        Row: {
          business_id: string
          code: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount: number
          due_date: string | null
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          quote_id: string | null
          sold_at: string
          status: Database["public"]["Enums"]["sale_status"]
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          code: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          quote_id?: string | null
          sold_at?: string
          status?: Database["public"]["Enums"]["sale_status"]
          total: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          code?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          quote_id?: string | null
          sold_at?: string
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_line: {
        Row: {
          category_snapshot: string | null
          created_at: string
          id: string
          name_snapshot: string
          product_id: string | null
          qty: number
          sale_id: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          category_snapshot?: string | null
          created_at?: string
          id?: string
          name_snapshot: string
          product_id?: string | null
          qty: number
          sale_id: string
          unit_cost: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          category_snapshot?: string | null
          created_at?: string
          id?: string
          name_snapshot?: string
          product_id?: string | null
          qty?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_line_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movement: {
        Row: {
          business_id: string
          created_at: string
          id: string
          product_id: string
          qty_delta: number
          ref_id: string | null
          ref_table: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          product_id: string
          qty_delta: number
          ref_id?: string | null
          ref_table?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          product_id?: string
          qty_delta?: number
          ref_id?: string | null
          ref_table?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "stock_movement_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movement_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_business: {
        Args: { p_currency: string; p_name: string; p_timezone: string }
        Returns: string
      }
      has_business_role: {
        Args: {
          p_business: string
          p_roles: Database["public"]["Enums"]["membership_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { p_business: string }; Returns: boolean }
      next_doc_code: {
        Args: { p_business: string; p_type: string }
        Returns: string
      }
    }
    Enums: {
      document_type: "SALE" | "QUOTE" | "PURCHASE"
      membership_role: "OWNER" | "ADMIN" | "CASHIER"
      payment_method: "CASH" | "TRANSFER" | "CARD" | "CREDIT"
      purchase_status: "PENDING" | "RECEIVED" | "CANCELLED"
      quote_status: "OPEN" | "CONVERTED" | "EXPIRED" | "CANCELLED"
      sale_status: "CONFIRMED" | "VOID"
      stock_movement_type: "SALE" | "PURCHASE" | "ADJUST" | "RETURN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      document_type: ["SALE", "QUOTE", "PURCHASE"],
      membership_role: ["OWNER", "ADMIN", "CASHIER"],
      payment_method: ["CASH", "TRANSFER", "CARD", "CREDIT"],
      purchase_status: ["PENDING", "RECEIVED", "CANCELLED"],
      quote_status: ["OPEN", "CONVERTED", "EXPIRED", "CANCELLED"],
      sale_status: ["CONFIRMED", "VOID"],
      stock_movement_type: ["SALE", "PURCHASE", "ADJUST", "RETURN"],
    },
  },
} as const

