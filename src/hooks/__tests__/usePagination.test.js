import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '@/hooks/usePagination';

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination());

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.from).toBe(0);
    expect(result.current.to).toBe(19);
  });

  it('should accept custom page size', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 50 }));

    expect(result.current.pageSize).toBe(50);
    expect(result.current.to).toBe(49);
  });

  it('should calculate totalPages correctly', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(95);
    });

    expect(result.current.totalPages).toBe(10);
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(50);
    });

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.from).toBe(10);
    expect(result.current.to).toBe(19);
  });

  it('should not go beyond last page', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(20);
    });

    act(() => {
      result.current.nextPage();
    });
    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('should navigate to previous page', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(50);
    });

    act(() => {
      result.current.goToPage(3);
    });

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('should not go before first page', () => {
    const { result } = renderHook(() => usePagination());

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should reset to page 1 when changing page size', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(100);
    });

    act(() => {
      result.current.goToPage(5);
    });

    act(() => {
      result.current.changePageSize(20);
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(20);
  });

  it('should provide correct hasNextPage/hasPrevPage', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(30);
    });

    expect(result.current.hasPrevPage).toBe(false);
    expect(result.current.hasNextPage).toBe(true);

    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.hasPrevPage).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should reset correctly', () => {
    const { result } = renderHook(() => usePagination({ pageSize: 10 }));

    act(() => {
      result.current.setTotalCount(100);
    });

    act(() => {
      result.current.goToPage(5);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalCount).toBe(0);
  });
});
