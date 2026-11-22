import type { ReactNode } from 'react';
import { cx } from './cx';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right';
  /** Esconde a coluna em ecrãs pequenos. */
  hideOnMobile?: boolean;
}

/** Tabela simples com cabeçalho fixo e scroll horizontal em ecrãs estreitos. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-canvas/60 text-left">
            {columns.map((c) => (
              <th
                key={c.header}
                scope="col"
                className={cx(
                  'whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5',
                  c.align === 'right' && 'text-right',
                  c.hideOnMobile && 'hidden md:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx('border-b border-line last:border-0 hover:bg-canvas/50', rowClassName?.(row))}
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cx(
                    'px-3 py-2.5 align-top first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5',
                    c.align === 'right' && 'text-right tabular',
                    c.hideOnMobile && 'hidden md:table-cell',
                    c.className,
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
