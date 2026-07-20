import { useEffect, useMemo, useRef, useState } from 'react';
import type { Card, KunbanData, Priority, StackId } from '../shared/types';
import { priorityRank } from '../shared/types';

const stackMeta: Record<StackId, { title: string; hint: string }> = {
  priority: { title: 'Priority', hint: 'Do next' }, planned: { title: 'Planned', hint: 'Make room' }, finished: { title: 'Finished', hint: 'Closed' }
};

const emptyData: KunbanData = { cards: [], settings: { apiPort: 7481, theme: 'system', expandedOnHover: true }, localAccessKey: '' };
const formatDue = (due?: string) => {
  if (!due) return null;
  const delta = new Date(due).getTime() - Date.now();
  if (delta < 0) return 'Overdue';
  if (delta < 86_400_000) return `Due in ${Math.max(1, Math.ceil(delta / 3_600_000))}h`;
  return `Due ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(due))}`;
};

export default function App() {
  const [data, setData] = useState<KunbanData>(emptyData);
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState(false);
  const [composer, setComposer] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  useEffect(() => { void window.kunban.load().then(setData); }, []);
  useEffect(() => {
    const refresh = window.setInterval(() => { void window.kunban.load().then(setData); }, 10_000);
    return () => window.clearInterval(refresh);
  }, []);

  const cards = useMemo(() => [...data.cards].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || Number(Boolean(a.dueAt)) * -1), [data.cards]);
  const update = (next: KunbanData) => { setData(next); void window.kunban.save(next); };
  const open = () => {
    if (!expanded) { setExpanded(true); window.kunban.setExpanded(true); }
  };
  const close = () => {
    if (!settings && !composer) { setExpanded(false); window.kunban.setExpanded(false); }
  };
  const scheduleOpen = () => { if (data.settings.expandedOnHover) hoverTimer.current = window.setTimeout(open, 560); };
  const cancelOpen = () => { window.clearTimeout(hoverTimer.current); };
  const move = (id: string, stack: StackId) => update({ ...data, cards: data.cards.map((card) => card.id === id ? { ...card, stack } : card) });
  const toggleDone = (card: Card) => move(card.id, card.stack === 'finished' ? 'priority' : 'finished');
  const create = (input: Pick<Card, 'title' | 'priority' | 'details' | 'dueAt'>) => {
    update({ ...data, cards: [{ ...input, id: crypto.randomUUID(), stack: 'priority', source: 'manual', createdAt: new Date().toISOString() }, ...data.cards] });
    setComposer(false);
  };

  return <main className={`widget ${expanded ? 'is-expanded' : ''}`} onMouseEnter={scheduleOpen} onMouseLeave={() => { cancelOpen(); close(); }}>
    <header className="widget-header">
      <div className="brand drag"><Mark /><span>kunban</span><em>Today</em></div>
      <div className="header-actions">
        <button className="icon-button no-drag" aria-label="Add a card" onClick={() => { open(); setComposer(true); }}><Plus /></button>
        <button className="icon-button no-drag" aria-label="Settings" onClick={() => { open(); setSettings((value) => !value); }}><Gear /></button>
        <button className="icon-button no-drag hide-button" aria-label="Hide Kunban" onClick={() => window.kunban.hide()}><Minus /></button>
      </div>
    </header>

    {!expanded ? <Compact cards={cards.filter((card) => card.stack === 'priority')} onOpen={open} onDone={toggleDone} /> : <Expanded cards={cards} onMove={move} onDone={toggleDone} />}
    {composer && <Composer onClose={() => setComposer(false)} onCreate={create} />}
    {settings && <Settings data={data} onChange={update} onClose={() => setSettings(false)} />}
  </main>;
}

function Compact({ cards, onOpen, onDone }: { cards: Card[]; onOpen(): void; onDone(card: Card): void }) {
  const now = cards.slice(0, 4);
  return <section className="compact-view" aria-label="Priority cards">
    <div className="view-intro"><div><p>Up next</p><h1>{cards.length ? `${cards.length} commitments` : 'A clear day'}</h1></div><button className="text-button no-drag" onClick={onOpen}>Open board <Arrow /></button></div>
    <div className="priority-list">
      {now.length ? now.map((card, index) => <CardRow key={card.id} card={card} index={index} onDone={onDone} />) : <div className="empty"><span>✓</span><p>Nothing urgent. Add a card when the next thing becomes clear.</p></div>}
    </div>
    {cards.length > 4 && <button className="more-button no-drag" onClick={onOpen}>+{cards.length - 4} more priorities</button>}
    <footer><span className="pulse" />Hover to expand</footer>
  </section>;
}

function Expanded({ cards, onMove, onDone }: { cards: Card[]; onMove(id: string, stack: StackId): void; onDone(card: Card): void }) {
  return <section className="board" aria-label="Kunban board">
    {(Object.keys(stackMeta) as StackId[]).map((stack) => <section className="stack" key={stack}>
      <div className="stack-head"><div><p>{stackMeta[stack].hint}</p><h2>{stackMeta[stack].title}</h2></div><span>{cards.filter((card) => card.stack === stack).length}</span></div>
      <div className="stack-cards">
        {cards.filter((card) => card.stack === stack).map((card, index) => <CardRow key={card.id} card={card} index={index} onDone={onDone} onMove={onMove} />)}
        {!cards.some((card) => card.stack === stack) && <div className="stack-empty">Nothing here yet.</div>}
      </div>
    </section>)}
  </section>;
}

function CardRow({ card, index, onDone, onMove }: { card: Card; index: number; onDone(card: Card): void; onMove?(id: string, stack: StackId): void }) {
  const due = formatDue(card.dueAt);
  return <article className={`task task-${card.priority}`}>
    <button className={`check no-drag ${card.stack === 'finished' ? 'checked' : ''}`} aria-label={`Mark ${card.title} ${card.stack === 'finished' ? 'open' : 'done'}`} onClick={() => onDone(card)}>{card.stack === 'finished' && '✓'}</button>
    <div className="task-copy"><div className="task-title"><span className="task-number">{String(index + 1).padStart(2, '0')}</span><h3>{card.title}</h3></div>{card.details && <p>{card.details}</p>}<div className="task-meta"><span className={`priority-dot ${card.priority}`} />{card.priority}<span>·</span>{due && <span className={due === 'Overdue' ? 'overdue' : ''}>{due}</span>}<span className="source">{card.source}</span></div></div>
    {onMove && card.stack !== 'finished' && <select className="move no-drag" value={card.stack} onChange={(event) => onMove(card.id, event.target.value as StackId)} aria-label={`Move ${card.title}`}><option value="priority">Priority</option><option value="planned">Planned</option><option value="finished">Finish</option></select>}
  </article>;
}

function Composer({ onClose, onCreate }: { onClose(): void; onCreate(input: Pick<Card, 'title' | 'priority' | 'details' | 'dueAt'>): void }) {
  const [title, setTitle] = useState(''); const [details, setDetails] = useState(''); const [priority, setPriority] = useState<Priority>('high'); const [dueAt, setDueAt] = useState('');
  return <aside className="panel composer"><div className="panel-heading"><div><p>New commitment</p><h2>Keep it specific</h2></div><button className="icon-button no-drag" onClick={onClose} aria-label="Close"><Close /></button></div><form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onCreate({ title: title.trim(), details: details.trim() || undefined, priority, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }); }}><label>Title<input autoFocus value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} placeholder="What needs your attention?" /></label><label>Context<textarea value={details} maxLength={2000} onChange={(event) => setDetails(event.target.value)} placeholder="Optional details" /></label><div className="form-row"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label>Due<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div><button className="primary-button" type="submit">Add to priority</button></form></aside>;
}

function Settings({ data, onChange, onClose }: { data: KunbanData; onChange(data: KunbanData): void; onClose(): void }) {
  return <aside className="panel settings"><div className="panel-heading"><div><p>Preferences</p><h2>Make it yours</h2></div><button className="icon-button no-drag" onClick={onClose} aria-label="Close"><Close /></button></div><label className="setting-row"><span><strong>Expand on hover</strong><small>Reveal the board after a short pause.</small></span><input type="checkbox" checked={data.settings.expandedOnHover} onChange={(event) => onChange({ ...data, settings: { ...data.settings, expandedOnHover: event.target.checked } })} /></label><label>Appearance<select value={data.settings.theme} onChange={(event) => onChange({ ...data, settings: { ...data.settings, theme: event.target.value as KunbanData['settings']['theme'] } })}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></label><div className="integration"><p>Local integration</p><code>http://127.0.0.1:{data.settings.apiPort}/api/info</code><small>Browser sites can only request a new card. Local AI tools use the key below for read/write access.</small><code className="secret">{data.localAccessKey || 'Loading…'}</code></div></aside>;
}

const Mark = () => <svg className="mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.4 10 2l7 3.4v9.2L10 18l-7-3.4V5.4Z" /><path d="m6.4 10 2.2 2.2 5-5" /></svg>;
const Plus = () => <svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg>;
const Gear = () => <svg viewBox="0 0 20 20"><path d="M8.1 3.3h3.8l.5 2 1.7 1 .3 2 1.5 1.4-1.5 1.4-.3 2-1.7 1-.5 2H8.1l-.5-2-1.7-1-.3-2L4.1 10l1.5-1.4.3-2 1.7-1 .5-2ZM10 12.6A2.6 2.6 0 1 0 10 7.4a2.6 2.6 0 0 0 0 5.2Z" /></svg>;
const Minus = () => <svg viewBox="0 0 20 20"><path d="M4 10h12" /></svg>;
const Close = () => <svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15" /></svg>;
const Arrow = () => <svg viewBox="0 0 20 20"><path d="M4 10h11M11 5l5 5-5 5" /></svg>;
