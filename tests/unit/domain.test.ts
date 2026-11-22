import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDate, formatDateTime, parsePtDate, todayIso } from '@/lib/dates';
import { expiryInfo, formatQuantity, movementSign, sortFefo, stockState, totalsByUnit } from '@/lib/stock';
import { formatKz } from '@/lib/currency';
import { can } from '@/lib/permissions';
import { toCsv } from '@/lib/csv';
import {
  adjustmentSchema,
  issueSchema,
  quantitySchema,
  receiptSchema,
  setPasswordSchema,
} from '@/lib/validation/schemas';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('datas', () => {
  it('formata datas de calendário sem desvio de fuso', () => {
    expect(formatDate('2026-03-01')).toBe('01/03/2026');
    expect(formatDate(null)).toBe('—');
  });

  it('apresenta timestamps UTC em Africa/Luanda (UTC+1), formato 24 horas', () => {
    expect(formatDateTime('2026-11-22T23:30:00Z')).toBe('23/11/2026 00:30');
    expect(formatDateTime('2026-11-22T13:05:00Z')).toBe('22/11/2026 14:05');
  });

  it('calcula o dia actual em Luanda', () => {
    expect(todayIso(new Date('2026-11-22T23:30:00Z'))).toBe('2026-11-23');
  });

  it('conta dias e soma dias', () => {
    expect(daysBetween('2026-11-22', '2026-12-22')).toBe(30);
    expect(daysBetween('2026-11-22', '2026-11-20')).toBe(-2);
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('interpreta dd/MM/yyyy e rejeita datas impossíveis', () => {
    expect(parsePtDate('31/12/2026')).toBe('2026-12-31');
    expect(parsePtDate('31/02/2026')).toBeNull();
    expect(parsePtDate('2026-12-31')).toBeNull();
  });
});

describe('estado de validade', () => {
  const today = '2026-11-22';
  it('válido, próximo por janela e expirado', () => {
    expect(expiryInfo(null, today).state).toBe('none');
    expect(expiryInfo('2027-06-01', today)).toMatchObject({ state: 'ok', window: null });
    expect(expiryInfo('2026-12-10', today)).toMatchObject({ state: 'soon', window: 30, days: 18 });
    expect(expiryInfo('2027-01-15', today)).toMatchObject({ state: 'soon', window: 60 });
    expect(expiryInfo('2027-02-15', today)).toMatchObject({ state: 'soon', window: 90 });
    expect(expiryInfo('2026-11-22', today)).toMatchObject({ state: 'soon', days: 0 });
    expect(expiryInfo('2026-11-21', today)).toMatchObject({ state: 'expired', days: -1 });
  });
});

describe('stock', () => {
  it('determina stock baixo e esgotado', () => {
    expect(stockState(0, 10)).toBe('out');
    expect(stockState(10, 10)).toBe('low');
    expect(stockState(11, 10)).toBe('ok');
    expect(stockState(1, 0)).toBe('ok');
  });

  it('não soma unidades incompatíveis', () => {
    const totals = totalsByUnit([
      { unit_name: 'caixa', available_quantity: 3 },
      { unit_name: 'Caixa', available_quantity: '2' },
      { unit_name: 'frasco', available_quantity: 4 },
    ]);
    expect(Object.fromEntries(totals)).toEqual({ caixa: 5, frasco: 4 });
  });

  it('formata quantidades e sinais de movimento', () => {
    expect(formatQuantity(1234.5, 'caixa')).toBe('1234,5 caixa');
    expect(movementSign('receipt')).toBe(1);
    expect(movementSign('damage')).toBe(-1);
  });

  it('ordena lotes por FEFO, sem validade no fim', () => {
    const sorted = sortFefo([
      { id: 'c', expiry_date: null },
      { id: 'b', expiry_date: '2027-05-01' },
      { id: 'a', expiry_date: '2027-01-01' },
    ]);
    expect(sorted.map((b) => b.id)).toEqual(['a', 'b', 'c']);
  });

  it('formata kwanzas', () => {
    expect(formatKz(1500)).toMatch(/^1\D?500,00 Kz$/);
    expect(formatKz(1234567.5)).toMatch(/^1\D?234\D?567,50 Kz$/);
    expect(formatKz(null)).toBe('—');
  });
});

describe('permissões na interface', () => {
  it('aplica o menor privilégio por perfil', () => {
    expect(can('viewer', 'stock.move')).toBe(false);
    expect(can('stock_operator', 'stock.move')).toBe(true);
    expect(can('stock_operator', 'stock.adjust')).toBe(false);
    expect(can('stock_operator', 'team.manage')).toBe(false);
    expect(can('manager', 'audit.read')).toBe(true);
    expect(can('manager', 'team.manage')).toBe(false);
    expect(can('owner', 'team.manage')).toBe(true);
    expect(can(null, 'stock.move')).toBe(false);
  });
});

describe('validação', () => {
  it('quantidades: aceita vírgula, recusa zero e negativos', () => {
    expect(quantitySchema.parse('2,5')).toBe(2.5);
    expect(quantitySchema.safeParse('0').success).toBe(false);
    expect(quantitySchema.safeParse('-1').success).toBe(false);
    expect(quantitySchema.safeParse('abc').success).toBe(false);
  });

  it('entrada exige validade salvo produto sem validade', () => {
    const base = { product_id: UUID, supplier_id: '', lot_number: 'L1', quantity: '3', reference: '' };
    expect(receiptSchema.safeParse({ ...base, no_expiry: false, expiry_date: '' }).success).toBe(false);
    expect(receiptSchema.safeParse({ ...base, no_expiry: true, expiry_date: '' }).success).toBe(true);
    expect(receiptSchema.safeParse({ ...base, no_expiry: false, expiry_date: '2027-01-01' }).success).toBe(
      true,
    );
  });

  it('saídas excepcionais exigem motivo', () => {
    const base = { product_id: UUID, batch_id: UUID, quantity: '1', reference: '' };
    expect(issueSchema.safeParse({ ...base, movement_type: 'issue', reason: '' }).success).toBe(true);
    expect(issueSchema.safeParse({ ...base, movement_type: 'damage', reason: '' }).success).toBe(false);
    expect(issueSchema.safeParse({ ...base, movement_type: 'damage', reason: 'Caixa partida' }).success).toBe(
      true,
    );
  });

  it('ajuste exige motivo e quantidade não negativa', () => {
    expect(adjustmentSchema.safeParse({ new_quantity: '0', reason: 'Contagem' }).success).toBe(true);
    expect(adjustmentSchema.safeParse({ new_quantity: '-1', reason: 'Contagem' }).success).toBe(false);
    expect(adjustmentSchema.safeParse({ new_quantity: '2', reason: '' }).success).toBe(false);
  });

  it('palavra-passe forte e confirmação', () => {
    expect(setPasswordSchema.safeParse({ password: 'curta', confirm: 'curta' }).success).toBe(false);
    expect(
      setPasswordSchema.safeParse({ password: 'Farmacia2026ok', confirm: 'Farmacia2026ok' }).success,
    ).toBe(true);
    expect(
      setPasswordSchema.safeParse({ password: 'Farmacia2026ok', confirm: 'Outra2026okXX' }).success,
    ).toBe(false);
  });
});

describe('CSV', () => {
  it('usa ";" e vírgula decimal, escapa aspas e neutraliza fórmulas', () => {
    const csv = toCsv(
      [{ name: 'Xarope "A"; 200 ml', qty: 2.5, code: '=CMD()' }],
      [
        { header: 'Nome', value: (r) => r.name },
        { header: 'Qtd', value: (r) => r.qty },
        { header: 'Código', value: (r) => r.code },
      ],
    );
    expect(csv).toBe('Nome;Qtd;Código\r\n"Xarope ""A""; 200 ml";2,5;\'=CMD()');
  });
});
