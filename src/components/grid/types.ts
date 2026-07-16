import type { ReactNode } from 'react'

export interface GridColumnDef<TData> {
  /** Key of the row object to display; also used as the column id. */
  field: keyof TData & string
  /** Header label. Defaults to the capitalized field name. */
  headerName?: string
  /** Column width in pixels. Defaults to 150. */
  width?: number
  /** Minimum width in pixels when resizing. Defaults to 60. */
  minWidth?: number
  /** Whether clicking the header sorts the column. Defaults to true. */
  sortable?: boolean
  /** Whether the column can be resized by dragging its edge. Defaults to true. */
  resizable?: boolean
  /** Shows a text filter input under the header label. Defaults to false. */
  filter?: boolean
  /**
   * Pins the column to the left or right edge so it stays visible during
   * horizontal scroll. When any column is pinned left, the selection
   * checkbox column is pinned left automatically.
   */
  pinned?: 'left' | 'right'
  /** Formats the raw cell value into display text. */
  valueFormatter?: (value: unknown, row: TData) => string
  /** Renders custom cell content; takes precedence over valueFormatter. */
  cellRenderer?: (params: { value: unknown; data: TData }) => ReactNode
}

export interface GridProps<TData> {
  rowData: TData[]
  columnDefs: GridColumnDef<TData>[]
  /** Grid height (number = px). Defaults to 400. */
  height?: number | string
  /** Fixed row height in pixels. Defaults to 36. */
  rowHeight?: number
  /** Stable row id. Defaults to the row index. */
  getRowId?: (data: TData, index: number) => string
  /**
   * Enables row selection. 'single' selects one row via click; 'multiple'
   * adds a checkbox column and allows any number of selected rows.
   */
  rowSelection?: 'single' | 'multiple'
  /** Called with the currently selected row data whenever selection changes. */
  onSelectionChanged?: (selectedRows: TData[]) => void
  className?: string
}
