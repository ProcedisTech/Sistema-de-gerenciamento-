import { AgendaAppointmentSummaryCard } from './AgendaAppointmentSummaryCard.jsx';
import { AgendaGroupedSummaryCard } from './AgendaGroupedSummaryCard.jsx';

export function AgendaSummaryEntryCard({ entry, ...handlers }) {
  if (!entry) return null;

  if (entry.kind === 'group') {
    return <AgendaGroupedSummaryCard group={entry} {...handlers} />;
  }

  const appointment = entry.appointment;
  if (!appointment) return null;
  return <AgendaAppointmentSummaryCard appointment={appointment} {...handlers} />;
}
