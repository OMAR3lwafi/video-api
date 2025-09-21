// Basic Database types for validation script
// Generate full types with: supabase gen types typescript --linked > src/lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string;
          status: string;
          progress_percentage: number | null;
          result_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          status?: string;
          progress_percentage?: number | null;
          result_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          status?: string;
          progress_percentage?: number | null;
          result_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      processing_timeline: {
        Row: {
          id: string;
          job_id: string;
          step: string;
          success: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          step: string;
          success?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          step?: string;
          success?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
