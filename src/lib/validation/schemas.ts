import { z } from 'zod';
import { ISSUE_TYPES } from '@/lib/stock';

// Os campos numéricos aceitam vírgula decimal ("2,5"). Campo vazio = sem valor.
function toNumber(value: unknown): unknown {
  if (value === '' || value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const n = Number(String(value).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isNaN(n) ? value : n;
}

const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value);

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `Máximo de ${max} caracteres.`).nullable());

export const quantitySchema = z.preprocess(
  toNumber,
  z
    .number({ error: 'Indique uma quantidade válida.' })
    .positive('A quantidade tem de ser maior que zero.')
    .max(1_000_000_000, 'Quantidade demasiado grande.')
    .refine((n) => Number.isInteger(Math.round(n * 1000)), 'Use no máximo 3 casas decimais.'),
);

const nonNegativeNumber = z.preprocess(
  toNumber,
  z
    .number({ error: 'Indique um número válido.' })
    .min(0, 'O valor não pode ser negativo.')
    .max(1_000_000_000),
);

const optionalMoney = z.preprocess(
  toNumber,
  z
    .number({ error: 'Indique um valor válido.' })
    .min(0, 'O valor não pode ser negativo.')
    .max(1_000_000_000)
    .optional(),
);

const uuid = z.uuid('Seleccione uma opção.');

/** Texto livre que não deve conter dados de pacientes (aviso na interface). */
const reasonText = z.string().trim().max(300, 'Máximo de 300 caracteres.');

export const loginSchema = z.object({
  email: z.email('Indique um email válido.'),
  password: z.string().min(1, 'Indique a palavra-passe.'),
});

export const resetRequestSchema = z.object({ email: z.email('Indique um email válido.') });

export const passwordSchema = z
  .string()
  .min(12, 'Use pelo menos 12 caracteres.')
  .max(72, 'Use no máximo 72 caracteres.')
  .regex(/[a-z]/, 'Inclua pelo menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua pelo menos uma letra maiúscula.')
  .regex(/\d/, 'Inclua pelo menos um algarismo.');

export const setPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'As palavras-passe não coincidem.',
  });

export const productSchema = z.object({
  name: z.string().trim().min(1, 'Indique o nome comercial.').max(200),
  active_ingredient: optionalText(200),
  brand: optionalText(120),
  strength: optionalText(80),
  dosage_form: optionalText(80),
  presentation: optionalText(160),
  unit_name: z.string().trim().min(1, 'Indique a unidade de controlo.').max(40),
  barcode: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z-]{4,64}$/, 'Use apenas letras, números e hífen (4 a 64 caracteres).')
      .nullable(),
  ),
  internal_code: optionalText(64),
  category: optionalText(80),
  minimum_stock: nonNegativeNumber,
  notes: optionalText(500),
  is_active: z.boolean(),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Indique o nome do fornecedor.').max(160),
  phone: optionalText(40),
  email: z.preprocess(blankToNull, z.email('Indique um email válido.').max(160).nullable()),
  notes: optionalText(500),
  is_active: z.boolean(),
});

export const receiptSchema = z
  .object({
    product_id: uuid,
    supplier_id: z.preprocess(blankToNull, z.uuid().nullable()),
    lot_number: z.string().trim().min(1, 'Indique o número do lote.').max(64),
    no_expiry: z.boolean(),
    expiry_date: z.preprocess(blankToNull, z.iso.date('Data inválida.').nullable()),
    quantity: quantitySchema,
    purchase_unit_cost: optionalMoney,
    reference_sale_price: optionalMoney,
    reference: optionalText(120),
  })
  .superRefine((v, ctx) => {
    if (!v.no_expiry && !v.expiry_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiry_date'],
        message: 'Indique a data de validade, ou marque "Produto sem data de validade".',
      });
    }
  });

const issueTypeValues = ISSUE_TYPES.map((t) => t.value) as [string, ...string[]];

export const issueSchema = z
  .object({
    product_id: uuid,
    batch_id: z.uuid('Seleccione o lote.'),
    movement_type: z.enum(issueTypeValues, 'Seleccione o motivo.'),
    quantity: quantitySchema,
    reason: reasonText,
    reference: optionalText(120),
  })
  .superRefine((v, ctx) => {
    const type = ISSUE_TYPES.find((t) => t.value === v.movement_type);
    if (type?.reasonRequired && v.reason.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Indique o motivo desta saída.' });
    }
  });

export const adjustmentSchema = z.object({
  new_quantity: nonNegativeNumber,
  reason: reasonText.min(3, 'O ajuste exige um motivo.'),
});

export const reasonSchema = z.object({ reason: reasonText.min(3, 'Indique o motivo.') });

export const inviteSchema = z.object({
  display_name: z.string().trim().min(2, 'Indique o nome do funcionário.').max(120),
  email: z.email('Indique um email válido.'),
  role: z.enum(['owner', 'manager', 'stock_operator', 'viewer']),
});

export const pharmacySettingsSchema = z.object({
  name: z.string().trim().min(2, 'Indique o nome da farmácia.').max(160),
  address: optionalText(300),
  phone: optionalText(40),
  expiry_alert_days: z
    .string()
    .trim()
    .transform((s) =>
      s
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number),
    )
    .refine(
      (arr) =>
        arr.length >= 1 && arr.length <= 5 && arr.every((n) => Number.isInteger(n) && n > 0 && n <= 730),
      'Indique entre 1 e 5 números de dias (1 a 730), separados por vírgulas.',
    ),
});

export const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Indique o seu nome.').max(120),
});
