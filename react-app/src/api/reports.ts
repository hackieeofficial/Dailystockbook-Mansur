import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DailyReport } from '../types';

export const reportsKeys = {
  all: ['reports'] as const,
  lists: () => [...reportsKeys.all, 'list'] as const,
  list: (filters: string) => [...reportsKeys.lists(), { filters }] as const,
  details: () => [...reportsKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportsKeys.details(), id] as const,
};

// Fetch a single daily report by date string
export function useDailyReport(dateStr: string) {
  return useQuery({
    queryKey: reportsKeys.detail(dateStr),
    queryFn: async () => {
      if (!dateStr) return null;
      const { data, error } = await supabase
        .from('daily_reports')
        .select('data')
        .eq('date_str', dateStr)
        .maybeSingle();

      if (error) throw error;
      return (data?.data as DailyReport) || null;
    },
    enabled: !!dateStr,
  });
}

// Fetch lightweight summaries of reports (used by Calendar)
export function useReportsSummary() {
  return useQuery({
    queryKey: reportsKeys.lists(),
    queryFn: async () => {
      // Just fetch the date_str to see what days have data.
      // This is lightweight and avoids downloading massive JSON blobs.
      const { data: allDates, error: datesErr } = await supabase
        .from('daily_reports')
        .select('date_str');
        
      if (datesErr) throw datesErr;
      
      const hasDataMap: Record<string, boolean> = {};
      allDates?.forEach(row => {
        hasDataMap[row.date_str] = true;
      });
      return hasDataMap;
    },
  });
}

// For WorkspaceView to save
export function useSaveDailyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dateStr, report }: { dateStr: string; report: DailyReport }) => {
      const payload = { ...report, _by: 'react-v1', _at: Date.now() };
      const { error } = await supabase.from('daily_reports')
        .upsert({ date_str: dateStr, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'date_str' });
      if (error) throw error;
      return payload;
    },
    onSuccess: (data, variables) => {
      // Update cache
      queryClient.setQueryData(reportsKeys.detail(variables.dateStr), data);
      queryClient.invalidateQueries({ queryKey: reportsKeys.lists() });
    }
  });
}

// For WorkspaceView to delete
export function useDeleteDailyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dateStr: string) => {
      const { error } = await supabase.from('daily_reports').delete().eq('date_str', dateStr);
      if (error) throw error;
      return dateStr;
    },
    onSuccess: (_, dateStr) => {
      queryClient.removeQueries({ queryKey: reportsKeys.detail(dateStr) });
      queryClient.invalidateQueries({ queryKey: reportsKeys.lists() });
    }
  });
}
