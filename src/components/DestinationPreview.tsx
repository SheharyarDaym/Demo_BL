import type { DestContent, Destination, SessionSnapshot } from '../domain/types';
import { isBookable, sessionStatusLabel } from '../state/facts';
import { fmtDate, fmtDateTime, money, sessionDateLabel, sessionTimeLabel } from '../utils/format';
import { Icon } from './Icon';

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </>
  );
}

function ScheduleCard({ s }: { s: SessionSnapshot }) {
  const bookable = isBookable(s);
  return (
    <li className={`pv-class ${bookable ? '' : 'pv-class-off'}`}>
      <div>
        <strong>{s.courseName}</strong>
        <span>
          {sessionDateLabel(s.start, s.end)} · {sessionTimeLabel(s.start, s.end)}
        </span>
        <span>{s.venue}</span>
        {s.price !== null && <span>Fee: {money(s.price)}</span>}
      </div>
      <div className="pv-class-side">
        {bookable ? (
          <>
            <span className="pv-seats">
              {s.available} of {s.capacity} seats available
            </span>
            <span className="pv-cta" aria-label="Register (preview only)">
              Register
            </span>
            <span className="pv-deadline">Register by {fmtDate(s.deadline)}</span>
          </>
        ) : (
          <span className="pv-off">
            <Icon name="alert" size={14} /> {sessionStatusLabel(s)} — registration closed
          </span>
        )}
      </div>
    </li>
  );
}

function schemaJson(c: DestContent): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: c.title,
    provider: { '@type': 'Organization', name: 'Lifeguard-Pro' },
    hasCourseInstance: (c.schedule ?? []).map((s) => ({
      '@type': 'CourseInstance',
      name: s.courseName,
      startDate: s.start,
      endDate: s.end,
      location: s.venue,
      courseMode: 'onsite',
      ...(s.price !== null && s.status === 'scheduled' ? { offers: { '@type': 'Offer', price: s.price, priceCurrency: 'USD', availability: s.available > 0 ? 'InStock' : 'SoldOut' } } : {}),
      ...(s.status === 'cancelled' ? { eventStatus: 'EventCancelled' } : {}),
    })),
  };
  return JSON.stringify(data, null, 2);
}

export function ContentPreview({ dest, content, label }: { dest: Destination; content: DestContent; label?: string }) {
  if (dest.kind === 'posts' || dest.kind === 'reviews') {
    const items = content.items ?? [];
    return (
      <div className="pv pv-google">
        <div className="pv-bar">
          <Icon name="map" size={14} /> {dest.path} {label && <em>· {label}</em>}
        </div>
        <div className="pv-body">
          {!items.length && <p className="muted">Nothing published yet.</p>}
          <ul className="pv-items">
            {items.map((it) => (
              <li key={it.id}>
                <span className="muted small">{fmtDateTime(it.at)}</span>
                <p>{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }
  return (
    <div className={`pv ${dest.channel === 'Website' ? 'pv-web' : 'pv-google'}`}>
      <div className="pv-bar">
        <Icon name={dest.channel === 'Website' ? 'globe' : 'map'} size={14} />
        {dest.channel === 'Website' ? `lifeguard-pro.org ${dest.path}` : dest.path}
        {label && <em>· {label}</em>}
      </div>
      <div className="pv-body">
        <h4>{content.title}</h4>
        {dest.kind === 'schema' ? (
          <>
            <p className="muted small">Structured data (JSON-LD) as it would appear in the page source — demo preview.</p>
            <pre className="pv-code">{schemaJson(content)}</pre>
          </>
        ) : dest.kind === 'faq' ? (
          <dl className="pv-faq">
            {content.text
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((block, i) => {
                const [q, ...a] = block.split('\n');
                return (
                  <div key={i}>
                    <dt>{q.replace(/^Q:\s*/, '')}</dt>
                    <dd>{a.join(' ').replace(/^A:\s*/, '')}</dd>
                  </div>
                );
              })}
          </dl>
        ) : (
          <Paragraphs text={content.text} />
        )}
        {content.prices && (
          <table className="pv-prices">
            <tbody>
              {content.prices.map((p) => (
                <tr key={p.sessionId}>
                  <th scope="row">{p.label}</th>
                  <td>{p.price === null ? <span className="muted">Not shown (pending confirmation)</span> : money(p.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {content.schedule && dest.kind !== 'schema' && (
          <>
            <h5>Upcoming classes</h5>
            {content.schedule.length ? (
              <ul className="pv-classes">
                {content.schedule.map((s) => (
                  <ScheduleCard key={s.sessionId} s={s} />
                ))}
              </ul>
            ) : (
              <p className="muted">No classes listed.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function DestinationPreview({ dest }: { dest: Destination }) {
  return <ContentPreview dest={dest} content={dest.content} label={`version ${dest.version}`} />;
}
