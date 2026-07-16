import { useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  RowSelectionState,
  SortingState,
  Table,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { GridColumnDef, GridProps } from './types'
import './Grid.css'

const DEFAULT_WIDTH = 150
const DEFAULT_MIN_WIDTH = 60
const SELECT_COLUMN_ID = '__select'

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function SelectAllCheckbox<TData>({ table }: { table: Table<TData> }) {
  const ref = useRef<HTMLInputElement>(null)
  const allSelected = table.getIsAllRowsSelected()
  const someSelected = table.getIsSomeRowsSelected()

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="gridley-checkbox"
      aria-label="Select all rows"
      checked={allSelected}
      onChange={table.getToggleAllRowsSelectedHandler()}
    />
  )
}

function selectionColumn<TData>(): ColumnDef<TData, unknown> {
  return {
    id: SELECT_COLUMN_ID,
    size: 44,
    minSize: 44,
    enableSorting: false,
    enableResizing: false,
    enableColumnFilter: false,
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="gridley-checkbox"
        aria-label="Select row"
        tabIndex={-1}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        onClick={(event) => event.stopPropagation()}
      />
    ),
  }
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
    enableColumnFilter: def.filter ?? false,
    filterFn: 'includesString',
    sortDescFirst: false,
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

interface CellPosition {
  row: number
  col: number
}

export function Grid<TData>({
  rowData,
  columnDefs,
  height = 400,
  rowHeight = 36,
  getRowId,
  rowSelection,
  onSelectionChanged,
  className,
}: GridProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelectionState, setRowSelectionState] =
    useState<RowSelectionState>({})
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef(false)
  const selectionInitRef = useRef(true)
  const onSelectionChangedRef = useRef(onSelectionChanged)

  const columns = useMemo(() => {
    const cols = toTableColumns(columnDefs)
    if (rowSelection === 'multiple') {
      cols.unshift(selectionColumn<TData>())
    }
    return cols
  }, [columnDefs, rowSelection])

  const table = useReactTable({
    data: rowData,
    columns,
    state: { sorting, rowSelection: rowSelectionState },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelectionState,
    enableRowSelection: rowSelection != null,
    enableMultiRowSelection: rowSelection === 'multiple',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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

  const virtualItems = virtualizer.getVirtualItems()
  const totalWidth = table.getTotalSize()
  const colCount = table.getVisibleLeafColumns().length
  const hasFilterRow = columnDefs.some((def) => def.filter)
  const headerRowCount = hasFilterRow ? 2 : 1

  useEffect(() => {
    onSelectionChangedRef.current = onSelectionChanged
  })

  useEffect(() => {
    if (selectionInitRef.current) {
      selectionInitRef.current = false
      return
    }
    onSelectionChangedRef.current?.(
      table.getSelectedRowModel().rows.map((row) => row.original),
    )
  }, [rowSelectionState, table])

  // Focus the active cell once the virtualizer has rendered it. Guarded by
  // pendingFocusRef so scrolling never yanks focus back to the active cell.
  useEffect(() => {
    if (!pendingFocusRef.current || !activeCell) return
    const cell = scrollRef.current?.querySelector<HTMLElement>(
      `[aria-rowindex="${activeCell.row + headerRowCount + 1}"] [aria-colindex="${activeCell.col + 1}"]`,
    )
    if (cell) {
      pendingFocusRef.current = false
      cell.focus({ preventScroll: true })
    }
  })

  const moveActiveCell = (position: CellPosition) => {
    pendingFocusRef.current = true
    setActiveCell(position)
    virtualizer.scrollToIndex(position.row)
  }

  // Sizes a column to its widest rendered content (body cells + header label).
  const autoSizeColumn = (columnId: string, colIndex: number) => {
    const scrollEl = scrollRef.current
    const column = table.getColumn(columnId)
    if (!scrollEl || !column) return
    let contentWidth = 0
    const texts = scrollEl.querySelectorAll(
      `.gridley-row [aria-colindex="${colIndex + 1}"] .gridley-cell-text, ` +
        `.gridley-header [aria-colindex="${colIndex + 1}"] .gridley-header-text`,
    )
    texts.forEach((el) => {
      contentWidth = Math.max(contentWidth, el.scrollWidth)
    })
    if (contentWidth === 0) return
    const size = Math.max(
      contentWidth + 25,
      column.columnDef.minSize ?? DEFAULT_MIN_WIDTH,
    )
    table.setColumnSizing((prev) => ({ ...prev, [columnId]: size }))
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (target.getAttribute('role') !== 'gridcell') return
    if (!activeCell || rows.length === 0) return

    if (event.key === ' ') {
      if (rowSelection) {
        rows[activeCell.row]?.toggleSelected()
      }
      event.preventDefault()
      return
    }

    const lastRow = rows.length - 1
    const lastCol = colCount - 1
    let { row, col } = activeCell

    switch (event.key) {
      case 'ArrowDown':
        row = Math.min(row + 1, lastRow)
        break
      case 'ArrowUp':
        row = Math.max(row - 1, 0)
        break
      case 'ArrowRight':
        col = Math.min(col + 1, lastCol)
        break
      case 'ArrowLeft':
        col = Math.max(col - 1, 0)
        break
      case 'Home':
        col = 0
        if (event.ctrlKey) row = 0
        break
      case 'End':
        col = lastCol
        if (event.ctrlKey) row = lastRow
        break
      default:
        return
    }

    event.preventDefault()
    if (row !== activeCell.row || col !== activeCell.col) {
      moveActiveCell({ row, col })
    }
  }

  const activeRowRendered =
    activeCell != null &&
    virtualItems.some((item) => item.index === activeCell.row)

  const rootClassName = ['gridley', rowSelection && 'is-selectable', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="grid"
      aria-rowcount={rows.length + headerRowCount}
      aria-colcount={colCount}
      aria-multiselectable={rowSelection === 'multiple' || undefined}
      className={rootClassName}
      style={{ height }}
    >
      <div
        role="presentation"
        className="gridley-scroll"
        ref={scrollRef}
        onKeyDown={handleKeyDown}
      >
        <div role="rowgroup" className="gridley-head">
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
                      <span className="gridley-header-text">
                        {label}
                        {sorted && (
                          <span
                            className="gridley-sort-arrow"
                            aria-hidden="true"
                          >
                            {sorted === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                        {sorted && sorting.length > 1 && (
                          <span className="gridley-sort-order">
                            {column.getSortIndex() + 1}
                          </span>
                        )}
                      </span>
                    </button>
                  ) : (
                    <span className="gridley-header-label">
                      <span className="gridley-header-text">{label}</span>
                    </span>
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
                      onDoubleClick={() => autoSizeColumn(column.id, colIndex)}
                    />
                  )}
                </div>
              )
            })}
          </div>
          {hasFilterRow && (
            <div
              role="row"
              aria-rowindex={2}
              className="gridley-filter-row"
              style={{ minWidth: totalWidth }}
            >
              {table.getFlatHeaders().map((header, colIndex) => {
                const column = header.column
                return (
                  <div
                    key={header.id}
                    role="gridcell"
                    aria-colindex={colIndex + 1}
                    className="gridley-filter-cell"
                    style={{ width: header.getSize() }}
                  >
                    {column.getCanFilter() && (
                      <input
                        type="text"
                        className="gridley-filter"
                        aria-label={`Filter ${
                          typeof column.columnDef.header === 'string'
                            ? column.columnDef.header
                            : column.id
                        }`}
                        value={(column.getFilterValue() as string) ?? ''}
                        onChange={(event) =>
                          column.setFilterValue(event.target.value || undefined)
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div
          role="rowgroup"
          className="gridley-body"
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualItems.map((virtualItem) => {
            const row = rows[virtualItem.index]
            const selected = row.getIsSelected()
            return (
              <div
                key={row.id}
                role="row"
                aria-rowindex={virtualItem.index + headerRowCount + 1}
                aria-selected={rowSelection ? selected : undefined}
                className={selected ? 'gridley-row is-selected' : 'gridley-row'}
                style={{
                  height: rowHeight,
                  minWidth: totalWidth,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={rowSelection ? () => row.toggleSelected() : undefined}
              >
                {row.getVisibleCells().map((cell, colIndex) => {
                  const isActive =
                    activeCell?.row === virtualItem.index &&
                    activeCell?.col === colIndex
                  const isFallbackTabStop =
                    !activeRowRendered &&
                    virtualItem.index === virtualItems[0]?.index &&
                    colIndex === 0
                  return (
                    <div
                      key={cell.id}
                      role="gridcell"
                      aria-colindex={colIndex + 1}
                      tabIndex={isActive || isFallbackTabStop ? 0 : -1}
                      className="gridley-cell"
                      style={{ width: cell.column.getSize() }}
                      onFocus={() =>
                        setActiveCell((prev) =>
                          prev &&
                          prev.row === virtualItem.index &&
                          prev.col === colIndex
                            ? prev
                            : { row: virtualItem.index, col: colIndex },
                        )
                      }
                    >
                      <span className="gridley-cell-text">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
