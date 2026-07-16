import { useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { GridColumnDef, GridProps } from './types'
import './Grid.css'

const DEFAULT_WIDTH = 150
const DEFAULT_MIN_WIDTH = 60

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toTableColumns<TData>(
  columnDefs: GridColumnDef<TData>[],
): ColumnDef<TData, unknown>[] {
  return columnDefs.map((def) => ({
    id: def.field,
    accessorKey: def.field,
    header: def.headerName ?? capitalize(def.field),
    size: def.width ?? DEFAULT_WIDTH,
    minSize: def.minWidth ?? DEFAULT_MIN_WIDTH,
    enableSorting: def.sortable ?? true,
    enableResizing: def.resizable ?? true,
    cell: (ctx) => {
      const value = ctx.getValue()
      if (def.cellRenderer) {
        return def.cellRenderer({ value, data: ctx.row.original })
      }
      if (def.valueFormatter) {
        return def.valueFormatter(value, ctx.row.original)
      }
      return String(value ?? '')
    },
  }))
}

export function Grid<TData>({
  rowData,
  columnDefs,
  height = 400,
  rowHeight = 36,
  getRowId,
  className,
}: GridProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const columns = useMemo(() => toTableColumns(columnDefs), [columnDefs])

  const table = useReactTable({
    data: rowData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    getRowId,
  })

  const rows = table.getRowModel().rows

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  })

  const totalWidth = table.getTotalSize()

  return (
    <div
      role="grid"
      aria-rowcount={rows.length + 1}
      aria-colcount={columns.length}
      className={className ? `gridley ${className}` : 'gridley'}
      style={{ height }}
    >
      <div className="gridley-scroll" ref={scrollRef}>
        <div
          role="row"
          aria-rowindex={1}
          className="gridley-header"
          style={{ minWidth: totalWidth }}
        >
          {table.getFlatHeaders().map((header, colIndex) => {
            const column = header.column
            const canSort = column.getCanSort()
            const sorted = column.getIsSorted()
            const label = flexRender(
              column.columnDef.header,
              header.getContext(),
            )
            return (
              <div
                key={header.id}
                role="columnheader"
                aria-colindex={colIndex + 1}
                aria-sort={
                  canSort
                    ? sorted === 'asc'
                      ? 'ascending'
                      : sorted === 'desc'
                        ? 'descending'
                        : 'none'
                    : undefined
                }
                className="gridley-header-cell"
                style={{ width: header.getSize() }}
              >
                {canSort ? (
                  <button
                    type="button"
                    className="gridley-sort-btn"
                    onClick={column.getToggleSortingHandler()}
                  >
                    {label}
                    {sorted && (
                      <span className="gridley-sort-arrow" aria-hidden="true">
                        {sorted === 'asc' ? '▲' : '▼'}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="gridley-header-label">{label}</span>
                )}
                {column.getCanResize() && (
                  <div
                    aria-hidden="true"
                    className={
                      column.getIsResizing()
                        ? 'gridley-resizer is-resizing'
                        : 'gridley-resizer'
                    }
                    onMouseDown={header.getResizeHandler()}
                    onTouchStart={header.getResizeHandler()}
                  />
                )}
              </div>
            )
          })}
        </div>
        <div
          className="gridley-body"
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index]
            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={virtualItem.index + 2}
                className="gridley-row"
                style={{
                  height: rowHeight,
                  minWidth: totalWidth,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell, colIndex) => (
                  <div
                    key={cell.id}
                    role="gridcell"
                    aria-colindex={colIndex + 1}
                    className="gridley-cell"
                    style={{ width: cell.column.getSize() }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
