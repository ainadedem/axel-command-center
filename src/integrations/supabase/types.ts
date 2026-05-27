export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          currency: string
          id: string
          name: string
          statement_name: string | null
          statement_uploaded_at: string | null
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          name: string
          statement_name?: string | null
          statement_uploaded_at?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          name?: string
          statement_name?: string | null
          statement_uploaded_at?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      axel_chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "axel_chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "axel_chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      axel_chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          updated_at: string
          year: number
        }
        Insert: {
          amount?: number
          category_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          year: number
        }
        Update: {
          amount?: number
          category_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          account: string | null
          color: string | null
          company_id: string
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          account?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          account?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          acquired_at: string | null
          acquisition: string | null
          acquisition_year: number | null
          address: string | null
          avatar_url: string | null
          categories: string[] | null
          company_id: string
          contacts: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          name: string
          nif: string | null
          phone: string | null
          rcs: string | null
          referral: string | null
          stat: string | null
          status: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          acquired_at?: string | null
          acquisition?: string | null
          acquisition_year?: number | null
          address?: string | null
          avatar_url?: string | null
          categories?: string[] | null
          company_id: string
          contacts?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          referral?: string | null
          stat?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          acquired_at?: string | null
          acquisition?: string | null
          acquisition_year?: number | null
          address?: string | null
          avatar_url?: string | null
          categories?: string[] | null
          company_id?: string
          contacts?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          referral?: string | null
          stat?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          bank_swift: string | null
          base_currency: string
          code: string
          color: string | null
          created_at: string
          email: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          nif: string | null
          phone: string | null
          rcs: string | null
          short_name: string | null
          stat: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          base_currency?: string
          code: string
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          short_name?: string | null
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          base_currency?: string
          code?: string
          color?: string | null
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          short_name?: string | null
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account: string | null
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          category: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          due_date: string | null
          id: string
          issue_date: string
          kind: string
          number: string | null
          paid: number
          payee: string | null
          project_id: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_date: string
          kind?: string
          number?: string | null
          paid?: number
          payee?: string | null
          project_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          kind?: string
          number?: string | null
          paid?: number
          payee?: string | null
          project_id?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          capability: string | null
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          level: string | null
          position: number
          quantity: number
          rate: number
          unit: string
        }
        Insert: {
          capability?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          level?: string | null
          position?: number
          quantity?: number
          rate?: number
          unit?: string
        }
        Update: {
          capability?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          level?: string | null
          position?: number
          quantity?: number
          rate?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          company_id: string
          created_at: string
          currency: string
          due_date: string
          id: string
          issue_date: string
          number: string
          paid: number
          paid_date: string | null
          po_id: string | null
          project_id: string | null
          quote_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          issue_date: string
          number: string
          paid?: number
          paid_date?: string | null
          po_id?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          issue_date?: string
          number?: string
          paid?: number
          paid_date?: string | null
          po_id?: string | null
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          client: string
          client_id: string | null
          closer: string | null
          company_id: string
          created_at: string
          currency: string
          expected_close: string | null
          id: string
          name: string
          probability: number | null
          stage: string
          updated_at: string
          value: number
        }
        Insert: {
          client: string
          client_id?: string | null
          closer?: string | null
          company_id: string
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          name: string
          probability?: number | null
          stage?: string
          updated_at?: string
          value?: number
        }
        Update: {
          client?: string
          client_id?: string | null
          closer?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          name?: string
          probability?: number | null
          stage?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          company_id: string
          created_at: string
          currency: string
          entries: Json
          id: string
          month: string
          posted_transaction_ids: Json | null
          status: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          currency?: string
          entries?: Json
          id?: string
          month: string
          posted_transaction_ids?: Json | null
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          currency?: string
          entries?: Json
          id?: string
          month?: string
          posted_transaction_ids?: Json | null
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string | null
          company_id: string
          cost: number
          created_at: string
          currency: string
          id: string
          name: string
          revenue: number
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          name: string
          revenue?: number
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          cost?: number
          created_at?: string
          currency?: string
          id?: string
          name?: string
          revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number
          client_id: string | null
          client_reference: string | null
          company_id: string
          created_at: string
          currency: string
          document_history: Json | null
          document_name: string | null
          document_type: string | null
          document_uploaded_at: string | null
          document_url: string | null
          id: string
          issue_date: string
          lines: Json | null
          number: string
          project_id: string | null
          quote_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          client_reference?: string | null
          company_id: string
          created_at?: string
          currency?: string
          document_history?: Json | null
          document_name?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          document_url?: string | null
          id?: string
          issue_date: string
          lines?: Json | null
          number: string
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          client_reference?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          document_history?: Json | null
          document_name?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          document_url?: string | null
          id?: string
          issue_date?: string
          lines?: Json | null
          number?: string
          project_id?: string | null
          quote_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      quotes: {
        Row: {
          amount: number
          client_id: string | null
          company_id: string
          created_at: string
          currency: string
          id: string
          issue_date: string
          lines: Json | null
          mode: string | null
          notes: string | null
          number: string
          project_id: string | null
          status: string
          updated_at: string
          valid_until: string
        }
        Insert: {
          amount?: number
          client_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          issue_date: string
          lines?: Json | null
          mode?: string | null
          notes?: string | null
          number: string
          project_id?: string | null
          status?: string
          updated_at?: string
          valid_until: string
        }
        Update: {
          amount?: number
          client_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          issue_date?: string
          lines?: Json | null
          mode?: string | null
          notes?: string | null
          number?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          valid_until?: string
        }
        Relationships: []
      }
      recurring_billings: {
        Row: {
          active: boolean
          amount: number
          client_id: string | null
          company_id: string
          created_at: string
          currency: string
          end_date: string | null
          frequency: string
          id: string
          last_generated_at: string | null
          name: string
          next_run_date: string
          notes: string | null
          payment_terms_days: number | null
          project_id: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          client_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          name: string
          next_run_date: string
          notes?: string | null
          payment_terms_days?: number | null
          project_id?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          client_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          end_date?: string | null
          frequency?: string
          id?: string
          last_generated_at?: string | null
          name?: string
          next_run_date?: string
          notes?: string | null
          payment_terms_days?: number | null
          project_id?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      salary_register: {
        Row: {
          active: boolean
          cnaps_rate: number
          company_id: string
          created_at: string
          currency: string
          gross: number
          id: string
          irsa_rate: number
          ostie_rate: number
          start_date: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnaps_rate?: number
          company_id: string
          created_at?: string
          currency?: string
          gross?: number
          id?: string
          irsa_rate?: number
          ostie_rate?: number
          start_date: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnaps_rate?: number
          company_id?: string
          created_at?: string
          currency?: string
          gross?: number
          id?: string
          irsa_rate?: number
          ostie_rate?: number
          start_date?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_members: {
        Row: {
          created_at: string
          id: string
          role: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          account: string
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_name: string | null
          bank_swift: string | null
          categories: string[] | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string
          nif: string | null
          notes: string | null
          payment_terms: number | null
          phone: string | null
          rcs: string | null
          stat: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          categories?: string[] | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name: string
          nif?: string | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          rcs?: string | null
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account?: string
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          categories?: string[] | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string
          nif?: string | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          rcs?: string | null
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_name: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_name?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          client_id: string | null
          company_id: string
          created_at: string
          currency: string
          date: string
          description: string | null
          id: string
          invoice_id: string | null
          project_id: string | null
          source: string | null
          supplier_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          currency?: string
          date: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          source?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          project_id?: string | null
          source?: string | null
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_access_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "group_admin"
        | "company_admin"
        | "finance"
        | "viewer"
        | "sales"
        | "super_admin"
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
      app_role: [
        "group_admin",
        "company_admin",
        "finance",
        "viewer",
        "sales",
        "super_admin",
      ],
    },
  },
} as const
