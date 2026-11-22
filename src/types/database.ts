// Tipos das tabelas e views (escritos à mão a partir de supabase/migrations).
// Para gerar automaticamente: `supabase gen types typescript --local > src/types/supabase.ts`.

export type MemberRole = 'owner' | 'manager' | 'stock_operator' | 'viewer';
export type BatchStatus = 'active' | 'blocked' | 'expired' | 'depleted';
export type EffectiveBatchStatus = 'active' | 'blocked' | 'expired' | 'depleted';
export type MovementType =
  | 'receipt'
  | 'issue'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'return_to_supplier'
  | 'internal_transfer_in'
  | 'internal_transfer_out'
  | 'expired_disposal'
  | 'damage';
export type StockCountStatus = 'draft' | 'in_progress' | 'review' | 'completed' | 'cancelled';

export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  currency: string;
  expiry_alert_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  pharmacy_id: string;
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  pharmacies: Pharmacy;
}

export interface ProductStock {
  id: string;
  pharmacy_id: string;
  name: string;
  active_ingredient: string | null;
  brand: string | null;
  strength: string | null;
  dosage_form: string | null;
  presentation: string | null;
  unit_name: string;
  barcode: string | null;
  internal_code: string | null;
  category: string | null;
  minimum_stock: number;
  is_active: boolean;
  available_quantity: number;
  unusable_quantity: number;
  next_expiry_date: string | null;
  active_batch_count: number;
  lot_numbers: string;
  supplier_ids: string[];
  stock_state: 'out' | 'low' | 'ok';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  pharmacy_id: string;
  name: string;
  active_ingredient: string | null;
  brand: string | null;
  strength: string | null;
  dosage_form: string | null;
  presentation: string | null;
  unit_name: string;
  barcode: string | null;
  internal_code: string | null;
  category: string | null;
  minimum_stock: number;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  pharmacy_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BatchOverview {
  id: string;
  pharmacy_id: string;
  product_id: string;
  supplier_id: string | null;
  lot_number: string;
  expiry_date: string | null;
  received_quantity: number;
  available_quantity: number;
  purchase_unit_cost: number | null;
  reference_sale_price: number | null;
  received_at: string;
  status: BatchStatus;
  status_reason: string | null;
  product_name: string;
  product_strength: string | null;
  product_presentation: string | null;
  unit_name: string;
  product_is_active: boolean;
  supplier_name: string | null;
  days_to_expiry: number | null;
  effective_status: EffectiveBatchStatus;
}

export interface MovementOverview {
  id: string;
  pharmacy_id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: MovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reason: string | null;
  reference: string | null;
  reverses_movement_id: string | null;
  stock_count_id: string | null;
  created_by: string;
  created_at: string;
  product_name: string;
  unit_name: string;
  lot_number: string | null;
  created_by_name: string | null;
  is_reversed: boolean;
}

export interface StockCount {
  id: string;
  pharmacy_id: string;
  status: StockCountStatus;
  started_by: string;
  approved_by: string | null;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface StockCountItem {
  id: string;
  stock_count_id: string;
  product_id: string;
  batch_id: string | null;
  expected_quantity: number;
  counted_quantity: number | null;
  difference: number | null;
  counted_by: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  pharmacy_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: { display_name: string | null } | null;
}

export interface TeamMember {
  member_id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface BackupRun {
  id: string;
  status: 'started' | 'success' | 'failed';
  started_at: string;
  finished_at: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  sha256_checksum: string | null;
  destination: string | null;
  error_summary: string | null;
}

export interface MovementSummaryRow {
  movement_type: MovementType;
  movement_count: number;
  total_quantity: number;
  product_count: number;
}
