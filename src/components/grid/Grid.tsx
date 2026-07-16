import { useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  Column,
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

function columnLabel<TData>(column: Column<TData, unknown>): string {
  return typeof column.columnDef.header === 'string'
    ? column.columnDef.header
    : column.id
}

// Pinned cells stick to their edge during horizontal scroll; the offset is
// the summed width of the pinned columns between them and that edge.
function pinProps<TData>(column: Column<TData, unknown>): {
  className: string
  style: React.CSSProperties | undefined
} {
  const pinned = column.getIsPinned()
  if (!pinned) {
    return { className: '', style: undefined }
  }
  if (pinned === 'left') {
    return {
      className: column.getIsLastColumn('left')
        ? ' is-pinned is-pinned-last'
        : ' is-pinned',
      style: {
        position: 'sticky',
        left: column.getStart('left'),
        zIndex: 1,
      },
    }
  }
  return {
    className: column.getIsFirstColumn('right')
      ? ' is-pinned is-pinned-first'
      : ' is-pinned',
    style: {
      position: 'sticky',
      right: column.getAfter('right'),
      zIndex: 1,
    },
  }
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
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [dragColumnId, setDragColumnId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
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

  const columnPinning = useMemo(() => {
    const left: string[] = columnDefs
      .filter((def) => def.pinned === 'left')
      .map((def) => def.field)
    if (left.length > 0 && rowSelection === 'multiple') {
      left.unshift(SELECT_COLUMN_ID)
    }
    const right: string[] = columnDefs
      .filter((def) => def.pinned === 'right')
      .map((def) => def.field)
    return { left, right }
  }, [columnDefs, rowSelection])

  const table = useReactTable({
    data: rowData,
    columns,
    state: {
      sorting,
      rowSelection: rowSelectionState,
      columnPinning,
      columnOrder,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelectionState,
    onColumnOrderChange: setColumnOrder,
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

  // Moves the dragged column to the drop target's position. Reordering is
  // only allowed within the same pin group so pinned blocks stay coherent.
  const moveColumn = (fromId: string, toId: string) => {
    if (fromId === toId) return
    const from = table.getColumn(fromId)
    const to = table.getColumn(toId)
    if (!from || !to || from.getIsPinned() !== to.getIsPinned()) return
    const order =
      columnOrder.length > 0
        ? [...columnOrder]
        : table.getAllLeafColumns().map((column) => column.id)
    const fromIndex = order.indexOf(fromId)
    const toIndex = order.indexOf(toId)
    if (fromIndex === -1 || toIndex === -1) return
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, fromId)
    setColumnOrder(order)
  }

  const canDropOn = (targetId: string) =>
    dragColumnId != null &&
    dragColumnId !== targetId &&
    table.getColumn(dragColumnId)?.getIsPinned() ===
      table.getColumn(targetId)?.getIsPinned()

  const handleResizerKeyDown = (
    event: React.KeyboardEvent,
    column: Column<TData, unknown>,
    colIndex: number,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      autoSizeColumn(column.id, colIndex)
      return
    }
    const step = event.key === 'ArrowLeft' ? -10 : event.key === 'ArrowRight' ? 10 : 0
    if (step === 0) return
    event.preventDefault()
    const size = Math.max(
      column.getSize() + step,
      column.columnDef.minSize ?? DEFAULT_MIN_WIDTH,
    )
    table.setColumnSizing((prev) => ({ ...prev, [column.id]: size }))
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
      case 'PageDown':
      case 'PageUp': {
        const viewport = scrollRef.current?.clientHeight ?? 0
        const pageSize = Math.max(1, Math.floor(viewport / rowHeight) - 2)
        row =
          event.key === 'PageDown'
            ? Math.min(row + pageSize, lastRow)
            : Math.max(row - pageSize, 0)
        break
      }
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
              const pin = pinProps(column)
              const draggable = column.id !== SELECT_COLUMN_ID
              const dragClassName =
                (dragColumnId === column.id ? ' is-dragging' : '') +
                (dropTargetId === column.id ? ' is-drop-target' : '')
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
                  className={`gridley-header-cell${pin.className}${dragClassName}`}
                  style={{ width: header.getSize(), ...pin.style }}
                  draggable={draggable}
                  onDragStart={(event) => {
                    // A mousedown on the resize handle sets the resizing state
                    // before dragstart fires; cancel the native drag so the
                    // resize keeps receiving mouse moves.
                    if (table.getState().columnSizingInfo.isResizingColumn) {
                      event.preventDefault()
                      return
                    }
                    event.dataTransfer.setData('text/plain', column.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDragColumnId(column.id)
                  }}
                  onDragOver={(event) => {
                    if (!canDropOn(column.id)) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropTargetId(column.id)
                  }}
                  onDragLeave={() =>
                    setDropTargetId((id) => (id === column.id ? null : id))
                  }
                  onDrop={(event) => {
                    event.preventDefault()
                    if (dragColumnId) moveColumn(dragColumnId, column.id)
                    setDragColumnId(null)
                    setDropTargetId(null)
                  }}
                  onDragEnd={() => {
                    setDragColumnId(null)
                    setDropTargetId(null)
                  }}
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
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${columnLabel(column)} column`}
                      aria-valuenow={Math.round(header.getSize())}
                      aria-valuemin={column.columnDef.minSize ?? DEFAULT_MIN_WIDTH}
                      tabIndex={0}
                      className={
                        column.getIsResizing()
                          ? 'gridley-resizer is-resizing'
                          : 'gridley-resizer'
                      }
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      onDoubleClick={() => autoSizeColumn(column.id, colIndex)}
                      onKeyDown={(event) =>
                        handleResizerKeyDown(event, column, colIndex)
                      }
                      onDragStart={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
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
                const pin = pinProps(column)
                return (
                  <div
                    key={header.id}
                    role="gridcell"
                    aria-colindex={colIndex + 1}
                    className={`gridley-filter-cell${pin.className}`}
                    style={{ width: header.getSize(), ...pin.style }}
                  >
                    {column.getCanFilter() && (
                      <input
                        type="text"
                        className="gridley-filter"
                        aria-label={`Filter ${columnLabel(column)}`}
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
        {rows.length === 0 && (
          <div className="gridley-empty" role="status">
            No rows to show
          </div>
        )}
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
                  const pin = pinProps(cell.column)
                  return (
                    <div
                      key={cell.id}
                      role="gridcell"
                      aria-colindex={colIndex + 1}
                      tabIndex={isActive || isFallbackTabStop ? 0 : -1}
                      className={`gridley-cell${pin.className}`}
                      style={{ width: cell.column.getSize(), ...pin.style }}
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
