import { CalendarRange, Grid2X2, List } from 'lucide-react';

export function AgendaViewModeToggles({ agenda }) {
  return (
    <div className="inline-flex w-fit shrink-0 rounded-lg bg-[#F5F6FA] p-0.5">
      <button
        type="button"
        aria-label="Visualizacao em grade"
        onClick={() => agenda.setViewMode('grid')}
        className={`rounded-md p-1.5 transition-colors duration-150 ${agenda.viewMode === 'grid' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}
      >
        <Grid2X2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Visualizacao em lista"
        onClick={() => agenda.setViewMode('list')}
        className={`rounded-md p-1.5 transition-colors duration-150 ${agenda.viewMode === 'list' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Visualizacao em semana"
        onClick={() => {
          agenda.syncWeekFromSelection();
          agenda.setViewMode('semana');
        }}
        className={`rounded-md p-1.5 transition-colors duration-150 ${agenda.viewMode === 'semana' ? 'bg-brand-primarySubtle text-brand-primaryDark' : 'text-[#888888]'}`}
      >
        <CalendarRange className="h-4 w-4" />
      </button>
    </div>
  );
}
