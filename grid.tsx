// shared/ui/grid/components/grid-table/grid-table.tsx
import React, { useMemo, useCallback } from ‘react’;
import {
useReactTable,
getCoreRowModel,
getSortedRowModel,
getPaginationRowModel,
ColumnDef,
flexRender,
SortingState,
RowSelectionState,
PaginationState,
} from ‘@tanstack/react-table’;
import { GridTableProps, GridColumnMeta } from ‘../../grid.types’;
import styles from ‘./grid-table.module.scss’;

/**

- 메타데이터를 기반으로 TanStack Table 컬럼 정의를 생성하는 함수
- @template T - 데이터 행의 타입
- @param columnsMeta - 그리드 컬럼 메타데이터 배열
- @returns TanStack Table 컬럼 정의 배열
  */
  const createColumnsFromMeta = <T extends Record<string, any>>(
  columnsMeta: GridColumnMeta<T>[]
  ): ColumnDef<T>[] => {
  return columnsMeta
  .filter(col => col.visible !== false) // 숨겨진 컬럼 제외
  .map((columnMeta): ColumnDef<T> => ({
  id: String(columnMeta.field),
  accessorKey: columnMeta.field as string, // keyof T를 string으로 캐스팅
  header: () => (
  <div className={styles.headerContent}>
  <span>{columnMeta.headerRenderer ? columnMeta.headerRenderer() : columnMeta.title}</span>
  </div>
  ),
  cell: ({ getValue, row }) => {
  const value = getValue() as T[keyof T];
  
  ```
   // 커스텀 렌더러가 있으면 사용
   if (columnMeta.cellRenderer) {
     return columnMeta.cellRenderer(value, row.original, row.index);
   }
   
   // 포맷터가 있으면 적용
   if (columnMeta.formatter) {
     return columnMeta.formatter(value);
   }
   
   // 타입별 기본 렌더링
   switch (columnMeta.type) {
     case 'boolean':
       return value ? '예' : '아니오';
     case 'date':
       return value instanceof Date ? value.toLocaleDateString('ko-KR') : String(value);
     case 'number':
       return typeof value === 'number' ? value.toLocaleString('ko-KR') : String(value);
     default:
       return String(value ?? '');
   }
  ```
  
  },
  // 정렬 설정
  enableSorting: columnMeta.sortable !== false,
  // 크기 설정
  size: typeof columnMeta.width === ‘number’ ? columnMeta.width : undefined,
  minSize: columnMeta.minWidth,
  maxSize: columnMeta.maxWidth,
  // 메타데이터 저장 (스타일링 등에서 활용)
  meta: columnMeta,
  }));
  };

/**

- TanStack Table 기반 커스텀 그리드 컴포넌트 (CSS Grid 사용)
- @template T - 데이터 행의 타입
  */
  export const gridTable = <T extends Record<string, any>>({
  data,
  meta,
  loading = false,
  onRowClick,
  onRowSelect,
  onRowCheck,
  onPaginationChange,
  selectedRowIndex: controlledSelectedRowIndex,
  checkedRowIndices: controlledCheckedRowIndices,
  className,
  }: GridTableProps<T>) => {
  // 정렬 상태 관리
  const [sorting, setSorting] = React.useState<SortingState>([]);

// 페이지네이션 상태 관리
const [pagination, setPagination] = React.useState<PaginationState>({
pageIndex: meta.pagination?.currentPage || 0,
pageSize: meta.pagination?.pageSize || 10,
});

// 서버 사이드 페이지네이션 여부
const isServerSidePagination = meta.pagination?.serverSide === true;

// 체크박스 상태 관리 (controlled vs uncontrolled)
const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});

// 행 선택 상태 관리 (controlled vs uncontrolled)
const [internalSelectedRowIndex, setInternalSelectedRowIndex] = React.useState<number | null>(null);

// controlled component 여부 확인
const isSelectedRowControlled = controlledSelectedRowIndex !== undefined;
const isCheckedRowsControlled = controlledCheckedRowIndices !== undefined;

// 실제 사용할 상태 (controlled vs uncontrolled)
const selectedRowIndex = isSelectedRowControlled ? controlledSelectedRowIndex : internalSelectedRowIndex;
const rowSelection = isCheckedRowsControlled
? (controlledCheckedRowIndices || []).reduce((acc, index) => ({ …acc, [String(index)]: true }), {} as RowSelectionState)
: internalRowSelection;

// 콜백 함수를 ref로 저장하여 무한 반복 방지
const onRowCheckRef = React.useRef(onRowCheck);
onRowCheckRef.current = onRowCheck;

// 메타데이터 기반 컬럼 정의 생성
const columns = useMemo(() => createColumnsFromMeta(meta.columns), [meta.columns]);

// CSS Grid 템플릿 컬럼 계산 (핵심!)
const gridTemplateColumns = useMemo(() => {
const columnWidths = [];

```
// 체크박스 컬럼
if (meta.selection?.enabled && meta.selection.showCheckbox !== false) {
  columnWidths.push('50px');
}

// 데이터 컬럼들
meta.columns
  .filter(col => col.visible !== false)
  .forEach(columnMeta => {
    if (columnMeta.width) {
      // 고정 너비
      const width = typeof columnMeta.width === 'number' ? `${columnMeta.width}px` : columnMeta.width;
      columnWidths.push(width);
    } else {
      // 유연한 너비 (최소값과 함께)
      const minWidth = columnMeta.minWidth || 100;
      columnWidths.push(`minmax(${minWidth}px, 1fr)`);
    }
  });

return columnWidths.join(' ');
```

}, [meta.columns, meta.selection]);

// TanStack Table 인스턴스 생성
const table = useReactTable({
data,
columns,
state: {
sorting,
pagination: meta.pagination?.enabled ? pagination : undefined,
…(meta.selection?.enabled && { rowSelection }),
},
onSortingChange: setSorting,
onPaginationChange: meta.pagination?.enabled ? setPagination : undefined,
…(meta.selection?.enabled && !isCheckedRowsControlled && { onRowSelectionChange: setInternalRowSelection }),
getCoreRowModel: getCoreRowModel(),
getSortedRowModel: getSortedRowModel(),
getPaginationRowModel: meta.pagination?.enabled && !isServerSidePagination ? getPaginationRowModel() : undefined,
// 정렬 기능 활성화 여부
enableSorting: meta.sorting?.enabled !== false,
// 다중 정렬 허용 여부
enableMultiSort: meta.sorting?.multiple === true,
// 선택 기능 활성화 여부
enableRowSelection: meta.selection?.enabled === true,
// 다중 선택 허용 여부 (단일 선택인 경우 하나만 선택 가능)
enableMultiRowSelection: meta.selection?.type !== ‘single’,
// 행별 체크 가능 여부 설정
getRowCanSelect: meta.selection?.isRowCheckable
? (row) => meta.selection!.isRowCheckable!(row.original, row.index)
: undefined,
// 페이지네이션 설정
manualPagination: isServerSidePagination,
pageCount: isServerSidePagination && meta.pagination?.totalCount
? Math.ceil(meta.pagination.totalCount / pagination.pageSize)
: undefined,
});

// 체크박스로 체크된 행들을 부모 컴포넌트에 전달 (uncontrolled 모드에서만)
React.useEffect(() => {
if (meta.selection?.enabled && meta.selection.showCheckbox !== false && !isCheckedRowsControlled && onRowCheckRef.current) {
const checkedRows = table.getSelectedRowModel().rows.map(row => row.original as T);
const checkedIndices = table.getSelectedRowModel().rows.map(row => row.index);
onRowCheckRef.current(checkedRows, checkedIndices);
}
}, [internalRowSelection]);

// 서버 사이드 페이지네이션 변경 알림
React.useEffect(() => {
if (isServerSidePagination && onPaginationChange) {
onPaginationChange(pagination.pageIndex, pagination.pageSize);
}
}, [pagination.pageIndex, pagination.pageSize, isServerSidePagination, onPaginationChange]);

/**

- 행 클릭 핸들러 (선택 처리)
- @param row - 클릭된 행 데이터
- @param index - 행 인덱스
  */
  const handleRowClick = (row: T, index: number) => {
  // 일반 행 클릭 이벤트 (항상 호출)
  onRowClick?.(row, index);

```
// 행 클릭으로 선택 처리 (체크박스와 별개)
const wasSelected = selectedRowIndex === index;
const isSelected = !wasSelected;

// uncontrolled 모드에서만 내부 상태 업데이트
if (!isSelectedRowControlled) {
  setInternalSelectedRowIndex(isSelected ? index : null);
}

// 행 선택 이벤트 호출 (controlled 모드에서는 부모가 상태 관리)
onRowSelect?.(row, index, isSelected);
```

};

/**

- 체크박스 변경 핸들러 (체크박스 전용 - 행 선택과 완전 분리)
- @param row - 체크된 행 데이터
- @param index - 행 인덱스
  */
  const handleCheckboxChange = (row: any, index: number) => {
  // 체크 가능 여부 확인
  const isCheckable = meta.selection?.isRowCheckable
  ? meta.selection.isRowCheckable(row.original, index)
  : true;

```
if (!isCheckable) {
  return;
}

// uncontrolled 모드에서만 TanStack Table의 내부 상태 사용
if (!isCheckedRowsControlled) {
  row.getToggleSelectedHandler()();
} else {
  // controlled 모드에서는 부모 컴포넌트에 알리기만 함
  const currentCheckedIndices = controlledCheckedRowIndices || [];
  const isCurrentlyChecked = currentCheckedIndices.includes(index);
  const newCheckedIndices = isCurrentlyChecked
    ? currentCheckedIndices.filter(i => i !== index)
    : [...currentCheckedIndices, index];
  const newCheckedRows = newCheckedIndices.map(i => data[i]);
  
  onRowCheckRef.current?.(newCheckedRows, newCheckedIndices);
}
```

};

/**

- 정렬 아이콘 렌더링
- @param isSorted - 정렬 상태 (‘asc’ | ‘desc’ | false)
  */
  const renderSortIcon = (isSorted: ‘asc’ | ‘desc’ | false) => {
  if (!isSorted) return null;
  return (
  <span className={`${styles.sortIcon} ${isSorted === 'asc' ? styles.ascending : styles.descending}`}>
  {isSorted === ‘asc’ ? ‘↑’ : ‘↓’}
  </span>
  );
  };

/**

- 셀 정렬 클래스 생성
- @param align - 정렬 방향
  */
  const getCellAlignClass = (align?: ‘left’ | ‘center’ | ‘right’) => {
  switch (align) {
  case ‘center’:
  return styles.alignCenter;
  case ‘right’:
  return styles.alignRight;
  default:
  return ‘’;
  }
  };

/**

- 전체 체크 체크박스 컴포넌트
  */
  const SelectAllCheckbox = () => {
  const checkboxRef = React.useRef<HTMLInputElement>(null);

```
// 체크 가능한 행만 필터링
const checkableRows = data.filter((row, index) => 
  meta.selection?.isRowCheckable ? meta.selection.isRowCheckable(row, index) : true
);
const checkableCount = checkableRows.length;

// 체크 가능한 행 중에서 실제 체크된 행 계산
const checkedCheckableCount = checkableRows.filter((row) => {
  const dataIndex = data.indexOf(row);
  return Boolean(rowSelection[String(dataIndex)]);
}).length;

const isAllSelected = checkableCount > 0 && checkedCheckableCount === checkableCount;
const isSomeSelected = checkedCheckableCount > 0 && checkedCheckableCount < checkableCount;

React.useEffect(() => {
  if (checkboxRef.current) {
    checkboxRef.current.indeterminate = isSomeSelected;
  }
}, [isSomeSelected]);

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (isCheckedRowsControlled) {
    // controlled 모드: 전체 선택/해제 (체크 가능한 행만)
    const checkableIndices = Array.from({ length: data.length }, (_, i) => i)
      .filter(i => meta.selection?.isRowCheckable ? meta.selection.isRowCheckable(data[i], i) : true);
    
    const newCheckedIndices = isAllSelected ? [] : checkableIndices;
    const newCheckedRows = newCheckedIndices.map(i => data[i]);
    onRowCheckRef.current?.(newCheckedRows, newCheckedIndices);
  } else {
    // uncontrolled 모드: 체크박스 상태에 따라 명시적으로 설정
    const shouldSelectAll = e.target.checked;
    table.toggleAllRowsSelected(shouldSelectAll);
  }
};

// 체크 가능한 행이 없으면 체크박스 비활성화
const isDisabled = checkableCount === 0;

return (
  <input
    ref={checkboxRef}
    type="checkbox"
    checked={isAllSelected}
    disabled={isDisabled}
    onChange={handleChange}
  />
);
```

};

/**

- 페이지네이션 컴포넌트
  */
  const Pagination = () => {
  if (!meta.pagination?.enabled) return null;

```
// 서버 사이드와 클라이언트 사이드에 따라 다른 값 사용
const pageCount = isServerSidePagination && meta.pagination.totalCount
  ? Math.ceil(meta.pagination.totalCount / pagination.pageSize)
  : table.getPageCount();

const currentPage = pagination.pageIndex + 1;
const pageSize = pagination.pageSize;

const totalRows = isServerSidePagination 
  ? meta.pagination.totalCount || 0
  : table.getFilteredRowModel().rows.length;

const startRow = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
const endRow = isServerSidePagination 
  ? Math.min(currentPage * pageSize, totalRows)
  : Math.min(currentPage * pageSize, totalRows);

// 페이지 버튼들 생성 (최대 5개)
const getPageNumbers = () => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(pageCount, start + maxVisible - 1);
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
};

// 페이지 변경 핸들러
const handlePageChange = (newPageIndex: number) => {
  if (isServerSidePagination) {
    // 서버 사이드: 상태만 업데이트, useEffect에서 onPaginationChange 호출
    setPagination(prev => ({ ...prev, pageIndex: newPageIndex }));
  } else {
    // 클라이언트 사이드: TanStack Table 핸들러 사용
    table.setPageIndex(newPageIndex);
  }
};

// 페이지 크기 변경 핸들러
const handlePageSizeChange = (newPageSize: number) => {
  if (isServerSidePagination) {
    // 서버 사이드: 상태 업데이트, 첫 페이지로 이동
    setPagination({ pageIndex: 0, pageSize: newPageSize });
  } else {
    // 클라이언트 사이드: TanStack Table 핸들러 사용
    table.setPageSize(newPageSize);
  }
};

return (
  <div className={styles.pagination}>
    {/* 페이지 정보 */}
    <div className={styles.paginationInfo}>
      <span>
        {startRow}-{endRow} of {totalRows}
      </span>
      
      {/* 페이지 크기 선택 */}
      {meta.pagination.pageSizeOptions && meta.pagination.pageSizeOptions.length > 1 && (
        <select
          value={pageSize}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          className={styles.pageSizeSelect}
        >
          {meta.pagination.pageSizeOptions.map(size => (
            <option key={size} value={size}>
              {size} rows
            </option>
          ))}
        </select>
      )}
    </div>

    {/* 페이지 컨트롤 */}
    <div className={styles.paginationControls}>
      {/* 첫 페이지 */}
      <button
        onClick={() => handlePageChange(0)}
        disabled={pagination.pageIndex === 0}
        className={styles.pageButton}
        title="첫 페이지"
      >
        ⟪
      </button>
      
      {/* 이전 페이지 */}
      <button
        onClick={() => handlePageChange(pagination.pageIndex - 1)}
        disabled={pagination.pageIndex === 0}
        className={styles.pageButton}
        title="이전 페이지"
      >
        ⟨
      </button>

      {/* 페이지 번호들 */}
      {getPageNumbers().map(pageNum => (
        <button
          key={pageNum}
          onClick={() => handlePageChange(pageNum - 1)}
          className={`${styles.pageButton} ${
            pageNum === currentPage ? styles.active : ''
          }`}
        >
          {pageNum}
        </button>
      ))}

      {/* 다음 페이지 */}
      <button
        onClick={() => handlePageChange(pagination.pageIndex + 1)}
        disabled={pagination.pageIndex >= pageCount - 1}
        className={styles.pageButton}
        title="다음 페이지"
      >
        ⟩
      </button>
      
      {/* 마지막 페이지 */}
      <button
        onClick={() => handlePageChange(pageCount - 1)}
        disabled={pagination.pageIndex >= pageCount - 1}
        className={styles.pageButton}
        title="마지막 페이지"
      >
        ⟫
      </button>
    </div>
  </div>
);
```

};

return (
<div className={`${styles.grid} ${loading ? styles.loading : ''} ${className || ''}`}>
{/* 로딩 오버레이 */}
{loading && (
<div className={styles.loadingOverlay}>
<div className={styles.spinner} />
</div>
)}

```
  {/* CSS Grid 기반 테이블 */}
  <div className={styles.table}>
    {/* 헤더 */}
    <div 
      className={styles.header}
      style={{ gridTemplateColumns }}
    >
      {/* 체크박스 헤더 */}
      {meta.selection?.enabled && meta.selection.showCheckbox !== false && (
        <div className={`${styles.headerCell} ${styles.alignCenter}`}>
          {meta.selection.type === 'multiple' && <SelectAllCheckbox />}
        </div>
      )}
      
      {/* 데이터 컬럼 헤더들 */}
      {table.getHeaderGroups()[0]?.headers
        .filter((_, index) => !meta.selection?.enabled || meta.selection.showCheckbox === false || index < meta.columns.filter(col => col.visible !== false).length)
        .map(header => {
          const columnMeta = header.column.columnDef.meta as GridColumnMeta<T>;
          return (
            <div
              key={header.id}
              className={`${styles.headerCell} ${
                header.column.getCanSort() ? styles.sortable : ''
              } ${getCellAlignClass(columnMeta?.align)}`}
              onClick={header.column.getToggleSortingHandler()}
            >
              <div className={styles.headerContent}>
                {flexRender(header.column.columnDef.header, header.getContext())}
                {renderSortIcon(header.column.getIsSorted())}
              </div>
            </div>
          );
        })}
    </div>
    
    {/* 바디 (스크롤 영역) */}
    <div className={styles.body}>
      {table.getRowModel().rows.length === 0 ? (
        <div className={styles.emptyState}>
          표시할 데이터가 없습니다.
        </div>
      ) : (
        // 서버 사이드에서는 data 그대로 사용, 클라이언트 사이드에서는 페이지네이션된 행 사용
        (isServerSidePagination ? table.getCoreRowModel().rows : table.getRowModel().rows).map(row => {
          const isRowSelected = selectedRowIndex === row.index;
          const isRowChecked = Boolean(rowSelection[String(row.index)]);
          const isRowCheckable = meta.selection?.isRowCheckable 
            ? meta.selection.isRowCheckable(row.original, row.index)
            : true;
          
          return (
            <div
              key={row.id}
              className={`${styles.row} ${
                onRowClick ? styles.clickable : ''
              } ${isRowSelected ? styles.selected : ''} ${isRowChecked ? styles.checked : ''} ${
                !isRowCheckable ? styles.disabled : ''
              }`}
              style={{ gridTemplateColumns }}
              onClick={() => handleRowClick(row.original as T, row.index)}
            >
              {/* 체크박스 */}
              {meta.selection?.enabled && meta.selection.showCheckbox !== false && (
                <div className={styles.cell}>
                  <input
                    type={meta.selection.type === 'single' ? 'radio' : 'checkbox'}
                    checked={Boolean(rowSelection[String(row.index)])}
                    disabled={!isRowCheckable}
                    onChange={() => handleCheckboxChange(row, row.index)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              
              {/* 데이터 셀들 */}
              {row.getVisibleCells().map(cell => {
                const columnMeta = cell.column.columnDef.meta as GridColumnMeta<T>;
                return (
                  <div
                    key={cell.id}
                    className={`${styles.cell} ${getCellAlignClass(columnMeta?.align)}`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  </div>
  
  {/* 페이지네이션 */}
  <Pagination />
</div>
```

);
};