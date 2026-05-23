import { AgendaAppointmentCardRich } from './AgendaAppointmentCardRich.jsx';
import { AgendaGroupedAppointmentCard } from './AgendaGroupedAppointmentCard.jsx';
import { AgendaGroupedNextUpCard } from './AgendaGroupedNextUpCard.jsx';
import { AgendaNextUpCard } from './AgendaNextUpCard.jsx';

export function AgendaEntryCard({
  entry,
  variant = 'rich',
  ...handlers
}) {
  if (!entry) return null;

  if (entry.kind === 'group') {
    if (variant === 'nextUp') {
      return <AgendaGroupedNextUpCard group={entry} {...handlers} />;
    }
    return <AgendaGroupedAppointmentCard group={entry} {...handlers} />;
  }

  const appointment = entry.appointment;
  if (!appointment) return null;

  if (variant === 'nextUp') {
    return <AgendaNextUpCard appointment={appointment} {...handlers} />;
  }
  return <AgendaAppointmentCardRich appointment={appointment} {...handlers} />;
}

