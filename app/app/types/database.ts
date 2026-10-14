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
          catalog_enabled: boolean
          catalog_token: string
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
          catalog_enabled?: boolean
          catalog_token?: string
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
          catalog_enabled?: boolean
          catalog_token?: string
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
            foreignKeyName: "payment_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payment_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_detail"
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
            foreignKeyName: "purchase_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_line_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_line_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_purchase_orders"
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
          {
            foreignKeyName: "quote_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
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
            foreignKeyName: "quote_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_line_detail"
            referencedColumns: ["quote_id"]
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
            foreignKeyName: "sale_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sale_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quote"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_detail"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "v_quote_line_detail"
            referencedColumns: ["quote_id"]
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
            foreignKeyName: "sale_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_line_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_line_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_detail"
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
          reason: string | null
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
          reason?: string | null
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
          reason?: string | null
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
          {
            foreignKeyName: "stock_movement_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stats"
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
      v_credits: {
        Row: {
          business_id: string | null
          credit_sales_count: number | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          days_overdue: number | null
          debt: number | null
          is_overdue: boolean | null
          last_credit_at: string | null
          last_payment_at: string | null
          oldest_due_date: string | null
          total_credit: number | null
          total_paid: number | null
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
      v_inventory_summary: {
        Row: {
          business_id: string | null
          inventory_value: number | null
          product_count: number | null
          retail_value: number | null
          stock_units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business"
            referencedColumns: ["id"]
          },
        ]
      }
      v_product_stats: {
        Row: {
          active: boolean | null
          business_id: string | null
          category_id: string | null
          category_name: string | null
          cost: number | null
          created_at: string | null
          id: string | null
          inventory_value: number | null
          is_low_stock: boolean | null
          is_thin_margin: boolean | null
          margin_amount: number | null
          margin_pct: number | null
          min_stock: number | null
          name: string | null
          price: number | null
          retail_value: number | null
          sku: string | null
          stock: number | null
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string | null
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
      v_purchase_orders: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string | null
          expected_at: string | null
          id: string | null
          line_count: number | null
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_status"] | null
          supplier_id: string | null
          supplier_name: string | null
          total_cost: number | null
          total_units: number | null
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
      v_quote_detail: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          detail: string | null
          gross_profit: number | null
          id: string | null
          line_count: number | null
          status: Database["public"]["Enums"]["quote_status"] | null
          total: number | null
          total_units: number | null
          updated_at: string | null
          valid_until: string | null
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
          {
            foreignKeyName: "quote_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      v_quote_line_detail: {
        Row: {
          business_id: string | null
          code: string | null
          created_at: string | null
          customer_id: string | null
          line_id: string | null
          line_profit: number | null
          line_total: number | null
          name_snapshot: string | null
          product_id: string | null
          qty: number | null
          quote_id: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          unit_cost: number | null
          unit_price: number | null
          valid_until: string | null
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
          {
            foreignKeyName: "quote_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "quote_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_product_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      v_sale_detail: {
        Row: {
          business_id: string | null
          code: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          discount: number | null
          due_date: string | null
          gross_profit: number | null
          id: string | null
          items: number | null
          line_count: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          sold_at: string | null
          status: Database["public"]["Enums"]["sale_status"] | null
          subtotal: number | null
          total: number | null
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
            foreignKeyName: "sale_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_credits"
            referencedColumns: ["customer_id"]
          },
        ]
      }
    }
    Functions: {
      adjust_stock: {
        Args: { p_delta: number; p_product: string; p_reason: string }
        Returns: Json
      }
      convert_quote: {
        Args: { p_due: string; p_method: string; p_quote: string }
        Returns: Json
      }
      create_business: {
        Args: { p_currency: string; p_name: string; p_timezone: string }
        Returns: string
      }
      create_purchase_order: {
        Args: {
          p_business: string
          p_expected: string | null
          p_lines: Json
          p_receive: boolean
          p_supplier: string | null
        }
        Returns: Json
      }
      create_quote: {
        Args: {
          p_business: string
          p_customer: string
          p_lines: Json
          p_valid_until: string
        }
        Returns: Json
      }
      create_sale: {
        Args: {
          p_business: string
          p_customer: string
          p_discount: number
          p_due: string
          p_lines: Json
          p_method: string
        }
        Returns: Json
      }
      create_suggested_purchase_order: {
        Args: { p_business: string }
        Returns: Json
      }
      credit_dashboard_summary: {
        Args: { p_business: string; p_from: string; p_to: string }
        Returns: {
          debtor_count: number
          overdue_amount: number
          overdue_count: number
          paid_in_period: number
          total_debt: number
        }[]
      }
      expense_category_totals: {
        Args: {
          p_business: string
          p_category?: string
          p_from: string
          p_to: string
        }
        Returns: {
          category: string
          expense_count: number
          share_pct: number
          total_amount: number
        }[]
      }
      frequent_products: {
        Args: { p_business: string; p_days?: number; p_limit?: number }
        Returns: {
          category_name: string
          cost: number
          id: string
          is_low_stock: boolean
          min_stock: number
          name: string
          price: number
          sku: string
          sold_qty: number
          stock: number
        }[]
      }
      get_public_catalog: { Args: { p_catalog: string }; Returns: Json }
      has_business_role: {
        Args: {
          p_business: string
          p_roles: Database["public"]["Enums"]["membership_role"][]
        }
        Returns: boolean
      }
      import_products: {
        Args: { p_business: string; p_rows: Json }
        Returns: Json
      }
      is_member: { Args: { p_business: string }; Returns: boolean }
      logo_business_id: { Args: { p_object_name: string }; Returns: string }
      metrics_alerts: { Args: { p_business: string }; Returns: Json }
      metrics_categories: {
        Args: { p_business: string; p_month_offset: number; p_period: string }
        Returns: Json
      }
      metrics_daily: {
        Args: { p_business: string; p_days: number }
        Returns: Json
      }
      metrics_products: {
        Args: {
          p_business: string
          p_limit?: number
          p_month_offset: number
          p_period: string
        }
        Returns: Json
      }
      metrics_summary: {
        Args: { p_business: string; p_month_offset?: number; p_period: string }
        Returns: Json
      }
      next_doc_code: {
        Args: { p_business: string; p_type: string }
        Returns: string
      }
      period_range: {
        Args: { p_month_offset?: number; p_period: string; p_timezone: string }
        Returns: {
          from: string
          label: string
          prev_from: string
          prev_to: string
          previous_label: string
          to: string
        }[]
      }
      receive_purchase_order: { Args: { p_order: string }; Returns: undefined }
      register_payment: {
        Args: {
          p_amount: number
          p_business: string
          p_customer: string
          p_method: string
        }
        Returns: Json
      }
      search_products: {
        Args: { p_business: string; p_limit?: number; p_q: string }
        Returns: {
          category_name: string
          cost: number
          id: string
          is_low_stock: boolean
          min_stock: number
          name: string
          price: number
          sku: string
          stock: number
        }[]
      }
      suggest_purchase: { Args: { p_business: string }; Returns: Json }
      void_sale: { Args: { p_sale: string }; Returns: undefined }
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
