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
          opening_balance: number
          opening_balance_date: string | null
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
          opening_balance?: number
          opening_balance_date?: string | null
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
          opening_balance?: number
          opening_balance_date?: string | null
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
      ar_alert_log: {
        Row: {
          company_id: string
          created_at: string
          error_message: string | null
          id: string
          invoice_id: string
          recipients: string[]
          sent_at: string
          stage: number
        }
        Insert: {
          company_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id: string
          recipients?: string[]
          sent_at?: string
          stage: number
        }
        Update: {
          company_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          invoice_id?: string
          recipients?: string[]
          sent_at?: string
          stage?: number
        }
        Relationships: [
          {
            foreignKeyName: "ar_alert_log_company_id_fkey"
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
      bank_reconciliations: {
        Row: {
          account_id: string
          adjustment_amount: number | null
          adjustment_transaction_id: string | null
          company_id: string
          computed_closing_balance: number
          created_at: string
          created_by: string | null
          difference: number
          id: string
          opening_balance: number | null
          period_end: string | null
          period_start: string | null
          row_count: number
          statement_closing_balance: number
          statement_name: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          adjustment_amount?: number | null
          adjustment_transaction_id?: string | null
          company_id: string
          computed_closing_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          statement_closing_balance?: number
          statement_name?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          adjustment_amount?: number | null
          adjustment_transaction_id?: string | null
          company_id?: string
          computed_closing_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          opening_balance?: number | null
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          statement_closing_balance?: number
          statement_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_reconciliations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      client_bank_details: {
        Row: {
          account_number: string | null
          bank_account: string | null
          bank_code: string | null
          bank_holder: string | null
          bank_name: string | null
          bank_swift: string | null
          branch_code: string | null
          client_id: string
          company_id: string
          created_at: string
          iban: string | null
          intl_enabled: boolean
          mobile_enabled: boolean
          mobile_name: string | null
          mobile_number: string | null
          mobile_provider: string | null
          rib_key: string | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          bank_account?: string | null
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          branch_code?: string | null
          client_id: string
          company_id: string
          created_at?: string
          iban?: string | null
          intl_enabled?: boolean
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          rib_key?: string | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          bank_account?: string | null
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          branch_code?: string | null
          client_id?: string
          company_id?: string
          created_at?: string
          iban?: string | null
          intl_enabled?: boolean
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          rib_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_bank_details_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
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
          color: string | null
          company_id: string
          contacts: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          industry: string | null
          name: string
          nif: string | null
          payment_terms_by_currency: Json
          payment_terms_days: number | null
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
          color?: string | null
          company_id: string
          contacts?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          name: string
          nif?: string | null
          payment_terms_by_currency?: Json
          payment_terms_days?: number | null
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
          color?: string | null
          company_id?: string
          contacts?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          name?: string
          nif?: string | null
          payment_terms_by_currency?: Json
          payment_terms_days?: number | null
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
          account_number: string | null
          address: string | null
          bank_account: string | null
          bank_accounts: Json
          bank_code: string | null
          bank_holder: string | null
          bank_name: string | null
          bank_swift: string | null
          base_currency: string
          branch_code: string | null
          code: string
          color: string | null
          created_at: string
          default_document_language: string
          email: string | null
          iban: string | null
          id: string
          intl_enabled: boolean
          is_demo: boolean
          legal_name: string | null
          logo_crop: Json | null
          logo_height: number
          logo_max_width: number
          logo_url: string | null
          mobile_enabled: boolean
          mobile_name: string | null
          mobile_number: string | null
          mobile_provider: string | null
          name: string
          nif: string | null
          phone: string | null
          rcs: string | null
          rib_key: string | null
          short_name: string | null
          show_payment_details: boolean
          show_stamp: boolean
          stamp_opacity: number
          stamp_position: string
          stamp_url: string | null
          stamp_width: number
          stat: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_number?: string | null
          address?: string | null
          bank_account?: string | null
          bank_accounts?: Json
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          base_currency?: string
          branch_code?: string | null
          code: string
          color?: string | null
          created_at?: string
          default_document_language?: string
          email?: string | null
          iban?: string | null
          id?: string
          intl_enabled?: boolean
          is_demo?: boolean
          legal_name?: string | null
          logo_crop?: Json | null
          logo_height?: number
          logo_max_width?: number
          logo_url?: string | null
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          rib_key?: string | null
          short_name?: string | null
          show_payment_details?: boolean
          show_stamp?: boolean
          stamp_opacity?: number
          stamp_position?: string
          stamp_url?: string | null
          stamp_width?: number
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_number?: string | null
          address?: string | null
          bank_account?: string | null
          bank_accounts?: Json
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          base_currency?: string
          branch_code?: string | null
          code?: string
          color?: string | null
          created_at?: string
          default_document_language?: string
          email?: string | null
          iban?: string | null
          id?: string
          intl_enabled?: boolean
          is_demo?: boolean
          legal_name?: string | null
          logo_crop?: Json | null
          logo_height?: number
          logo_max_width?: number
          logo_url?: string | null
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          rcs?: string | null
          rib_key?: string | null
          short_name?: string | null
          show_payment_details?: boolean
          show_stamp?: boolean
          stamp_opacity?: number
          stamp_position?: string
          stamp_url?: string | null
          stamp_width?: number
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      document_activity: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          created_at: string
          details: Json
          doc_id: string
          doc_number: string | null
          doc_type: string
          id: string
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          created_at?: string
          details?: Json
          doc_id: string
          doc_number?: string | null
          doc_type: string
          id?: string
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          created_at?: string
          details?: Json
          doc_id?: string
          doc_number?: string | null
          doc_type?: string
          id?: string
          summary?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          account: string | null
          account_id: string | null
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          due_date: string | null
          funding_invoice_id: string | null
          id: string
          issue_date: string
          kind: string
          medical_claim: boolean
          number: string | null
          paid: number
          payee: string | null
          payment_cycle: string | null
          project_id: string | null
          reimbursable_pct: number | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          account?: string | null
          account_id?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          funding_invoice_id?: string | null
          id?: string
          issue_date: string
          kind?: string
          medical_claim?: boolean
          number?: string | null
          paid?: number
          payee?: string | null
          payment_cycle?: string | null
          project_id?: string | null
          reimbursable_pct?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          account?: string | null
          account_id?: string | null
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          due_date?: string | null
          funding_invoice_id?: string | null
          id?: string
          issue_date?: string
          kind?: string
          medical_claim?: boolean
          number?: string | null
          paid?: number
          payee?: string | null
          payment_cycle?: string | null
          project_id?: string | null
          reimbursable_pct?: number | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          company_id: string
          created_at: string
          date: string
          id: string
          name: string
          recurring: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          id?: string
          name: string
          recurring?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          recurring?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_escalations: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          performed_at: string
          performed_by: string | null
          performed_by_name: string | null
          stage: number
          updated_at: string
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          stage: number
          updated_at?: string
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          stage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_escalations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          capability: string | null
          created_at: string
          created_by: string | null
          description: string | null
          details: string | null
          discount_pct: number | null
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
          created_by?: string | null
          description?: string | null
          details?: string | null
          discount_pct?: number | null
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
          created_by?: string | null
          description?: string | null
          details?: string | null
          discount_pct?: number | null
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
          assigned_to: string[]
          bank_account_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          dating_note: string | null
          discount_pct: number | null
          due_date: string
          handover_by: string | null
          handover_proof_name: string | null
          handover_proof_url: string | null
          handover_stamped_at: string | null
          id: string
          ingestion_date: string | null
          issue_date: string
          language: string
          number: string
          opportunity_id: string | null
          paid: number
          paid_date: string | null
          po_id: string | null
          po_waived: boolean
          po_waiver_reason: string | null
          project_id: string | null
          quote_id: string | null
          signer_id: string | null
          stamp_dirty: boolean
          stamp_scale: number | null
          stamp_x: number | null
          stamp_y: number | null
          status: string
          subject: string | null
          tax_amount: number
          tax_rate: number
          total_amount: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          assigned_to?: string[]
          bank_account_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          dating_note?: string | null
          discount_pct?: number | null
          due_date: string
          handover_by?: string | null
          handover_proof_name?: string | null
          handover_proof_url?: string | null
          handover_stamped_at?: string | null
          id?: string
          ingestion_date?: string | null
          issue_date: string
          language?: string
          number: string
          opportunity_id?: string | null
          paid?: number
          paid_date?: string | null
          po_id?: string | null
          po_waived?: boolean
          po_waiver_reason?: string | null
          project_id?: string | null
          quote_id?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string[]
          bank_account_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          dating_note?: string | null
          discount_pct?: number | null
          due_date?: string
          handover_by?: string | null
          handover_proof_name?: string | null
          handover_proof_url?: string | null
          handover_stamped_at?: string | null
          id?: string
          ingestion_date?: string | null
          issue_date?: string
          language?: string
          number?: string
          opportunity_id?: string | null
          paid?: number
          paid_date?: string | null
          po_id?: string | null
          po_waived?: boolean
          po_waiver_reason?: string | null
          project_id?: string | null
          quote_id?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
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
            foreignKeyName: "invoices_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
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
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          date: string
          description: string
          id: string
          journal: string
          lines: Json
          piece: string
          source: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          date: string
          description?: string
          id?: string
          journal: string
          lines?: Json
          piece: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          journal?: string
          lines?: Json
          piece?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_credentials: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          pin_hash: string
          qr_token: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          pin_hash: string
          qr_token?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          pin_hash?: string
          qr_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          employee_id: string
          end_date: string
          half_day: boolean
          id: string
          kind: string
          note: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          employee_id: string
          end_date: string
          half_day?: boolean
          id?: string
          kind?: string
          note?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string
          end_date?: string
          half_day?: boolean
          id?: string
          kind?: string
          note?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_email_queue: {
        Row: {
          actor_name: string | null
          body: string | null
          company_id: string | null
          created_at: string
          doc_number: string | null
          href: string | null
          id: string
          kind: string
          scheduled_for: string
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_name?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string
          doc_number?: string | null
          href?: string | null
          id?: string
          kind: string
          scheduled_for?: string
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_name?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string
          doc_number?: string | null
          href?: string | null
          id?: string
          kind?: string
          scheduled_for?: string
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          ar_alerts_enabled: boolean
          created_at: string
          digest_modes: Json
          events: Json
          id: string
          quiet_hours: Json
          stages: number[]
          time_zone: string | null
          updated_at: string
          user_id: string
          watch_company_ids: string[]
          watch_rules: Json
        }
        Insert: {
          ar_alerts_enabled?: boolean
          created_at?: string
          digest_modes?: Json
          events?: Json
          id?: string
          quiet_hours?: Json
          stages?: number[]
          time_zone?: string | null
          updated_at?: string
          user_id: string
          watch_company_ids?: string[]
          watch_rules?: Json
        }
        Update: {
          ar_alerts_enabled?: boolean
          created_at?: string
          digest_modes?: Json
          events?: Json
          id?: string
          quiet_hours?: Json
          stages?: number[]
          time_zone?: string | null
          updated_at?: string
          user_id?: string
          watch_company_ids?: string[]
          watch_rules?: Json
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          body: string | null
          company_id: string | null
          created_at: string
          doc_id: string | null
          doc_number: string | null
          doc_type: string | null
          href: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string
          doc_id?: string | null
          doc_number?: string | null
          doc_type?: string | null
          href?: string | null
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          body?: string | null
          company_id?: string | null
          created_at?: string
          doc_id?: string | null
          doc_number?: string | null
          doc_type?: string | null
          href?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
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
      payment_request_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          company_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          request_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          company_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_request_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          account_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_url: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          expense_id: string | null
          id: string
          kind: string
          needed_by: string | null
          off_cycle: boolean
          off_cycle_reason: string | null
          paid_at: string | null
          payee: string | null
          project_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string | null
          status: string
          submitted_at: string | null
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          kind?: string
          needed_by?: string | null
          off_cycle?: boolean
          off_cycle_reason?: string | null
          paid_at?: string | null
          payee?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_id?: string | null
          id?: string
          kind?: string
          needed_by?: string | null
          off_cycle?: boolean
          off_cycle_reason?: string | null
          paid_at?: string | null
          payee?: string | null
          project_id?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          run_id?: string | null
          status?: string
          submitted_at?: string | null
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_runs: {
        Row: {
          company_id: string
          created_at: string
          id: string
          note: string | null
          released_at: string | null
          released_by: string | null
          run_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          note?: string | null
          released_at?: string | null
          released_by?: string | null
          run_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          note?: string | null
          released_at?: string | null
          released_by?: string | null
          run_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
          signature_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          signature_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          signature_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_stage_templates: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          stages: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          stages?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          stages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stage_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          auto: boolean
          blocked_reason: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          key: string
          name: string
          notes: string | null
          owner: string | null
          planned_start: string | null
          position: number
          project_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auto?: boolean
          blocked_reason?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          key: string
          name: string
          notes?: string | null
          owner?: string | null
          planned_start?: string | null
          position?: number
          project_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auto?: boolean
          blocked_reason?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          key?: string
          name?: string
          notes?: string | null
          owner?: string | null
          planned_start?: string | null
          position?: number
          project_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          bank_account_id: string | null
          buying_entity: string | null
          client_id: string | null
          client_reference: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          document_history: Json | null
          document_name: string | null
          document_type: string | null
          document_uploaded_at: string | null
          document_url: string | null
          id: string
          issue_date: string
          language: string
          lines: Json | null
          number: string
          project_id: string | null
          quote_id: string | null
          signer_id: string | null
          stamp_dirty: boolean
          stamp_scale: number | null
          stamp_x: number | null
          stamp_y: number | null
          status: string
          subject: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount?: number
          bank_account_id?: string | null
          buying_entity?: string | null
          client_id?: string | null
          client_reference?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_history?: Json | null
          document_name?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          document_url?: string | null
          id?: string
          issue_date: string
          language?: string
          lines?: Json | null
          number: string
          project_id?: string | null
          quote_id?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          buying_entity?: string | null
          client_id?: string | null
          client_reference?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          document_history?: Json | null
          document_name?: string | null
          document_type?: string | null
          document_uploaded_at?: string | null
          document_url?: string | null
          id?: string
          issue_date?: string
          language?: string
          lines?: Json | null
          number?: string
          project_id?: string | null
          quote_id?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pvr_records: {
        Row: {
          company_id: string
          completion_pct: number
          created_at: string
          created_by: string | null
          document_name: string | null
          document_url: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          project_id: string | null
          quote_id: string | null
          reference: string | null
          scm_coordinator: string | null
          signed_by: string | null
          signed_date: string
          updated_at: string
        }
        Insert: {
          company_id: string
          completion_pct?: number
          created_at?: string
          created_by?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          project_id?: string | null
          quote_id?: string | null
          reference?: string | null
          scm_coordinator?: string | null
          signed_by?: string | null
          signed_date: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          completion_pct?: number
          created_at?: string
          created_by?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          project_id?: string | null
          quote_id?: string | null
          reference?: string | null
          scm_coordinator?: string | null
          signed_by?: string | null
          signed_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pvr_records_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_followups: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          happened_at: string
          id: string
          kind: string
          note: string
          quote_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          kind?: string
          note?: string
          quote_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          kind?: string
          note?: string
          quote_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_followups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_followups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          amount: number
          assigned_to: string[]
          bank_account_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          discount_pct: number | null
          fx_base_currency: string | null
          fx_rate: number | null
          id: string
          issue_date: string
          language: string
          lines: Json | null
          mode: string | null
          next_follow_up_at: string | null
          notes: string | null
          number: string
          opportunity_id: string | null
          pdf_url: string | null
          project_id: string | null
          sent_at: string | null
          sent_to: string | null
          signer_id: string | null
          stamp_dirty: boolean
          stamp_scale: number | null
          stamp_x: number | null
          stamp_y: number | null
          status: string
          subject: string | null
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
          updated_by: string | null
          valid_until: string
        }
        Insert: {
          amount?: number
          assigned_to?: string[]
          bank_account_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_pct?: number | null
          fx_base_currency?: string | null
          fx_rate?: number | null
          id?: string
          issue_date: string
          language?: string
          lines?: Json | null
          mode?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          number: string
          opportunity_id?: string | null
          pdf_url?: string | null
          project_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          valid_until: string
        }
        Update: {
          amount?: number
          assigned_to?: string[]
          bank_account_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_pct?: number | null
          fx_base_currency?: string | null
          fx_rate?: number | null
          id?: string
          issue_date?: string
          language?: string
          lines?: Json | null
          mode?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          number?: string
          opportunity_id?: string | null
          pdf_url?: string | null
          project_id?: string | null
          sent_at?: string | null
          sent_to?: string | null
          signer_id?: string | null
          stamp_dirty?: boolean
          stamp_scale?: number | null
          stamp_x?: number | null
          stamp_y?: number | null
          status?: string
          subject?: string | null
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
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
          source: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          source?: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          source?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          break_minutes: number
          company_id: string
          created_at: string
          employee_id: string | null
          end_time: string
          grace_minutes: number
          id: string
          name: string | null
          role: string | null
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          break_minutes?: number
          company_id: string
          created_at?: string
          employee_id?: string | null
          end_time?: string
          grace_minutes?: number
          id?: string
          name?: string | null
          role?: string | null
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          break_minutes?: number
          company_id?: string
          created_at?: string
          employee_id?: string | null
          end_time?: string
          grace_minutes?: number
          id?: string
          name?: string | null
          role?: string | null
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account: string
          account_number: string | null
          address: string | null
          avatar_url: string | null
          bank_account: string | null
          bank_code: string | null
          bank_holder: string | null
          bank_name: string | null
          bank_swift: string | null
          branch_code: string | null
          categories: string[] | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          intl_enabled: boolean
          kind: string
          mobile_enabled: boolean
          mobile_name: string | null
          mobile_number: string | null
          mobile_provider: string | null
          name: string
          nif: string | null
          notes: string | null
          payment_terms: number | null
          phone: string | null
          rcs: string | null
          rib_key: string | null
          stat: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account: string
          account_number?: string | null
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          branch_code?: string | null
          categories?: string[] | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          intl_enabled?: boolean
          kind?: string
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          rcs?: string | null
          rib_key?: string | null
          stat?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account?: string
          account_number?: string | null
          address?: string | null
          avatar_url?: string | null
          bank_account?: string | null
          bank_code?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          bank_swift?: string | null
          branch_code?: string | null
          categories?: string[] | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          intl_enabled?: boolean
          kind?: string
          mobile_enabled?: boolean
          mobile_name?: string | null
          mobile_number?: string | null
          mobile_provider?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          payment_terms?: number | null
          phone?: string | null
          rcs?: string | null
          rib_key?: string | null
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
      tasks: {
        Row: {
          assigned_to: string[]
          client_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_request_id: string | null
          priority: string
          project_id: string | null
          quote_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string[]
          client_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_request_id?: string | null
          priority?: string
          project_id?: string | null
          quote_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string[]
          client_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_request_id?: string | null
          priority?: string
          project_id?: string | null
          quote_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          department: string | null
          email: string | null
          first_name: string | null
          id: string
          is_global: boolean
          job_title: string | null
          last_name: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_global?: boolean
          job_title?: string | null
          last_name?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          is_global?: boolean
          job_title?: string | null
          last_name?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          activity: string | null
          billable: boolean
          clock_in: string
          clock_out: string | null
          company_id: string
          created_at: string
          created_by: string | null
          duration_minutes: number
          employee_id: string
          gps_lat: number | null
          gps_lng: number | null
          id: string
          method: string
          note: string | null
          photo_url: string | null
          project_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activity?: string | null
          billable?: boolean
          clock_in?: string
          clock_out?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          employee_id: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          method?: string
          note?: string | null
          photo_url?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activity?: string | null
          billable?: boolean
          clock_in?: string
          clock_out?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          employee_id?: string
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          method?: string
          note?: string | null
          photo_url?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          entry_id: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          entry_id: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          entry_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          break_minutes: number
          company_id: string
          created_at: string
          employee_id: string
          id: string
          leave_minutes: number
          note: string | null
          overtime_minutes: number
          period_end: string
          period_start: string
          regular_minutes: number
          status: string
          unpaid_leave_minutes: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          leave_minutes?: number
          note?: string | null
          overtime_minutes?: number
          period_end: string
          period_start: string
          regular_minutes?: number
          status?: string
          unpaid_leave_minutes?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          break_minutes?: number
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          leave_minutes?: number
          note?: string | null
          overtime_minutes?: number
          period_end?: string
          period_start?: string
          regular_minutes?: number
          status?: string
          unpaid_leave_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      user_admin_audit: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          company_id: string | null
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          requested_role: string | null
          success: boolean
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          requested_role?: string | null
          success?: boolean
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          company_id?: string | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          requested_role?: string | null
          success?: boolean
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
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
      can_touch_quote: { Args: { _quote_id: string }; Returns: boolean }
      decide_payment_request: {
        Args: { _decision: string; _note?: string; _request_id: string }
        Returns: {
          account_id: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_url: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          expense_id: string | null
          id: string
          kind: string
          needed_by: string | null
          off_cycle: boolean
          off_cycle_reason: string | null
          paid_at: string | null
          payee: string | null
          project_id: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          run_id: string | null
          status: string
          submitted_at: string | null
          supplier_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      document_numbers: {
        Args: { _company_id: string; _kind: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
