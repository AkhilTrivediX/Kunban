import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Card, KunbanData, Priority, StackId } from '../shared/types';
import { priorityRank } from '../shared/types';

const stackMeta: Record<StackId, { title: string; hint: string }> = {
  priority: { title: 'Priority', hint: 'Do next' }, planned: { title: 'Planned', hint: 'Make room' }, finished: { title: 'Finished', hint: 'Closed' }
};
const accents = [
  { id: 'moss', name: 'Moss', color: 'oklch(.52 .112 160)' },
  { id: 'iris', name: 'Iris', color: 'oklch(.58 .14 275)' },
  { id: 'coral', name: 'Coral', color: 'oklch(.61 .18 28)' },
  { id: 'sun', name: 'Sun', color: 'oklch(.68 .15 78)' }
] as const;
const emptyData: KunbanData = { cards: [], settings: { apiPort: 7481, theme: 'system', expandedOnHover: true, accent: 'system' } };

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
  const [resizing, setResizing] = useState(false);
  const [systemAccent, setSystemAccent] = useState('#0078d4');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [settings, setSettings] = useState(false);
  const [composer, setComposer] = useState(false);
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<StackId | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);

  useEffect(() => { void window.kunban.load().then(setData); void window.kunban.getSystemAccent().then(setSystemAccent); }, []);
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => setSystemDark(query.matches);
    query.addEventListener('change', syncTheme);
    return () => query.removeEventListener('change', syncTheme);
  }, []);
  useEffect(() => {
    const refresh = window.setInterval(() => { void window.kunban.load().then(setData); }, 10_000);
    return () => window.clearInterval(refresh);
  }, []);

  const cards = useMemo(() => [...data.cards].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || Number(Boolean(a.dueAt)) * -1), [data.cards]);
  const update = (next: KunbanData) => { setData(next); void window.kunban.save(next); };
  const open = () => {
    if (expanded || resizing) return;
    setResizing(true);
    void window.kunban.setExpanded(true).then(() => { setExpanded(true); setResizing(false); });
  };
  const close = () => {
    if (settings || composer || !expanded || resizing) return;
    setExpanded(false);
    setResizing(true);
    void window.kunban.setExpanded(false).then(() => setResizing(false));
  };
  const scheduleOpen = () => { if (data.settings.expandedOnHover) hoverTimer.current = window.setTimeout(open, 560); };
  const cancelOpen = () => window.clearTimeout(hoverTimer.current);
  const move = (id: string, stack: StackId) => update({ ...data, cards: data.cards.map((card) => card.id === id ? { ...card, stack } : card) });
  const toggleDone = (card: Card) => move(card.id, card.stack === 'finished' ? 'priority' : 'finished');
  const create = (input: Pick<Card, 'title' | 'priority' | 'details' | 'dueAt'>) => {
    update({ ...data, cards: [{ ...input, id: crypto.randomUUID(), stack: 'priority', source: 'manual', createdAt: new Date().toISOString() }, ...data.cards] });
    setComposer(false);
  };

  const widgetStyle = { '--system-accent': systemAccent } as CSSProperties;
  const effectiveTheme = data.settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : data.settings.theme;
  return <main className={`widget theme-${effectiveTheme} accent-${data.settings.accent} ${expanded ? 'is-expanded' : ''} ${resizing ? 'is-resizing' : ''}`} style={widgetStyle} onMouseEnter={scheduleOpen} onMouseLeave={() => { cancelOpen(); close(); }}>
    <header className="widget-header"><div className="brand drag"><Mark /><span>kunban</span><em>Today</em></div><div className="header-actions"><button className="icon-button no-drag" aria-label="Add a card" onClick={() => { open(); setComposer(true); }}><Plus /></button><button className="icon-button no-drag" aria-label="Settings" onClick={() => { open(); setSettings((value) => !value); }}><Gear /></button><button className="icon-button no-drag hide-button" aria-label="Hide Kunban" onClick={() => window.kunban.hide()}><Minus /></button></div></header>
    {!expanded ? <Compact cards={cards.filter((card) => card.stack === 'priority')} onOpen={open} onDone={toggleDone} /> : <Expanded cards={cards} onMove={move} onDone={toggleDone} draggedCard={draggedCard} dropTarget={dropTarget} onDragStart={setDraggedCard} onDragEnd={() => { setDraggedCard(null); setDropTarget(null); }} onDragTarget={setDropTarget} />}
    {composer && <Composer onClose={() => setComposer(false)} onCreate={create} />}
    {settings && <Settings data={data} onChange={update} onClose={() => setSettings(false)} />}
  </main>;
}

function Compact({ cards, onOpen, onDone }: { cards: Card[]; onOpen(): void; onDone(card: Card): void }) {
  const now = cards.slice(0, 4);
  return <section className="compact-view" aria-label="Priority cards"><div className="view-intro"><div><p>Up next</p><h1>{cards.length ? `${cards.length} commitments` : 'A clear day'}</h1></div><button className="text-button no-drag" onClick={onOpen}>Open board <Arrow /></button></div><div className="priority-list">{now.length ? now.map((card, index) => <CardRow key={card.id} card={card} index={index} onDone={onDone} />) : <div className="empty"><span>✓</span><p>Nothing urgent. Add a card when the next thing becomes clear.</p></div>}</div>{cards.length > 4 && <button className="more-button no-drag" onClick={onOpen}>+{cards.length - 4} more priorities</button>}<footer><span className="pulse" />Hover to expand</footer></section>;
}

function Expanded({ cards, onMove, onDone, draggedCard, dropTarget, onDragStart, onDragEnd, onDragTarget }: { cards: Card[]; onMove(id: string, stack: StackId): void; onDone(card: Card): void; draggedCard: string | null; dropTarget: StackId | null; onDragStart(id: string): void; onDragEnd(): void; onDragTarget(stack: StackId | null): void }) {
  const stackAtPointer = (event: React.PointerEvent<HTMLElement>) => document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-stack]')?.dataset.stack as StackId | undefined;
  const finishPointerDrag = (event: React.PointerEvent<HTMLElement>) => { const stack = stackAtPointer(event); if (draggedCard && stack) onMove(draggedCard, stack); onDragEnd(); };
  return <section className="board" aria-label="Kunban board" onPointerMove={(event) => { if (draggedCard) onDragTarget(stackAtPointer(event) ?? null); }} onPointerUp={finishPointerDrag} onPointerCancel={onDragEnd}>{(Object.keys(stackMeta) as StackId[]).map((stack) => <section data-stack={stack} className={`stack ${dropTarget === stack ? 'is-drop-target' : ''}`} key={stack}><div className="stack-head"><div><p>{stackMeta[stack].hint}</p><h2>{stackMeta[stack].title}</h2></div><span>{cards.filter((card) => card.stack === stack).length}</span></div><div className="stack-cards">{cards.filter((card) => card.stack === stack).map((card, index) => <CardRow key={card.id} card={card} index={index} onDone={onDone} dragging={draggedCard === card.id} onDragStart={onDragStart} onDragEnd={onDragEnd} />)}{!cards.some((card) => card.stack === stack) && <div className="stack-empty">Drop a card here.</div>}</div></section>)}</section>;
}

function CardRow({ card, index, onDone, dragging, onDragStart, onDragEnd }: { card: Card; index: number; onDone(card: Card): void; dragging?: boolean; onDragStart?(id: string): void; onDragEnd?(): void }) {
  const due = formatDue(card.dueAt);
  return <article className={`task task-${card.priority} ${dragging ? 'is-dragging' : ''}`} onPointerDown={(event) => { if (onDragStart && !(event.target as HTMLElement).closest('button')) { event.currentTarget.setPointerCapture(event.pointerId); onDragStart(card.id); } }} onLostPointerCapture={() => onDragEnd?.()}><button className={`check no-drag ${card.stack === 'finished' ? 'checked' : ''}`} aria-label={`Mark ${card.title} ${card.stack === 'finished' ? 'open' : 'done'}`} onClick={() => onDone(card)}>{card.stack === 'finished' && '✓'}</button><div className="task-copy"><div className="task-title"><span className="task-number">{String(index + 1).padStart(2, '0')}</span><h3>{card.title}</h3></div>{card.details && <p>{card.details}</p>}<div className="task-meta"><span className={`priority-dot ${card.priority}`} />{card.priority}<span>·</span>{due && <span className={due === 'Overdue' ? 'overdue' : ''}>{due}</span>}<span className="source">{card.source}</span></div></div>{onDragStart && <span className="drag-handle" aria-label="Drag card to another stack"><Drag /></span>}</article>;
}

function Composer({ onClose, onCreate }: { onClose(): void; onCreate(input: Pick<Card, 'title' | 'priority' | 'details' | 'dueAt'>): void }) {
  const [title, setTitle] = useState(''); const [details, setDetails] = useState(''); const [priority, setPriority] = useState<Priority>('high'); const [dueAt, setDueAt] = useState('');
  return <aside className="panel composer"><div className="panel-heading"><div><p>New commitment</p><h2>Keep it specific</h2></div><button className="icon-button no-drag" onClick={onClose} aria-label="Close"><Close /></button></div><form onSubmit={(event) => { event.preventDefault(); if (title.trim()) onCreate({ title: title.trim(), details: details.trim() || undefined, priority, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }); }}><label>Title<input autoFocus value={title} maxLength={140} onChange={(event) => setTitle(event.target.value)} placeholder="What needs your attention?" /></label><label>Context<textarea value={details} maxLength={2000} onChange={(event) => setDetails(event.target.value)} placeholder="Optional details" /></label><div className="form-row"><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label>Due<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div><button className="primary-button" type="submit">Add to priority</button></form></aside>;
}

function Settings({ data, onChange, onClose }: { data: KunbanData; onChange(data: KunbanData): void; onClose(): void }) {
  const updateSettings = (changes: Partial<KunbanData['settings']>) => onChange({ ...data, settings: { ...data.settings, ...changes } });
  return <aside className="panel settings" aria-label="Kunban settings"><div className="panel-heading"><div><p>Preferences</p><h2>Make it yours</h2></div><button className="icon-button no-drag" onClick={onClose} aria-label="Close"><Close /></button></div><section className="setting-group"><p className="group-label">Behaviour</p><div className="setting-row"><span><strong>Expand on hover</strong><small>Reveal stacks after a short pause.</small></span><button className={`switch no-drag ${data.settings.expandedOnHover ? 'is-on' : ''}`} role="switch" aria-checked={data.settings.expandedOnHover} onClick={() => updateSettings({ expandedOnHover: !data.settings.expandedOnHover })}><span /></button></div></section><section className="setting-group"><p className="group-label">Appearance</p><div className="setting-field"><span>Theme</span><div className="segmented">{(['system', 'light', 'dark'] as const).map((theme) => <button key={theme} className={data.settings.theme === theme ? 'is-selected' : ''} onClick={() => updateSettings({ theme })}>{theme}</button>)}</div></div><div className="setting-field"><span>Accent</span><div className="accent-picker"><button className={`accent-swatch system ${data.settings.accent === 'system' ? 'is-selected' : ''}`} aria-label="Use system accent" aria-pressed={data.settings.accent === 'system'} onClick={() => updateSettings({ accent: 'system' })}>⌘</button>{accents.map((accent) => <button key={accent.id} className={`accent-swatch ${data.settings.accent === accent.id ? 'is-selected' : ''}`} style={{ background: accent.color }} aria-label={`Use ${accent.name} accent`} aria-pressed={data.settings.accent === accent.id} onClick={() => updateSettings({ accent: accent.id })}>{data.settings.accent === accent.id && '✓'}</button>)}</div></div></section><section className="setting-group integration"><p className="group-label">Local integration</p><code>127.0.0.1:{data.settings.apiPort}</code><small>Local AI clients have full board access automatically. The service is bound to this device only.</small></section></aside>;
}

const Mark = () => <svg className="mark" viewBox="0 0 32 32" aria-label="Kunban"><rect x="2" y="2" width="28" height="28" rx="8" /><path d="M10 8v16M12.5 16l8-8M13 16l8 8" /><path d="M7.5 10h2M7.5 16h2M7.5 22h2" /></svg>;
const Plus = () => <svg viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" /></svg>;
const Gear = () => <svg viewBox="0 0 20 20"><path d="M8.1 3.3h3.8l.5 2 1.7 1 .3 2 1.5 1.4-1.5 1.4-.3 2-1.7 1-.5 2H8.1l-.5-2-1.7-1-.3-2L4.1 10l1.5-1.4.3-2 1.7-1 .5-2ZM10 12.6A2.6 2.6 0 1 0 10 7.4a2.6 2.6 0 0 0 0 5.2Z" /></svg>;
const Minus = () => <svg viewBox="0 0 20 20"><path d="M4 10h12" /></svg>;
const Close = () => <svg viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15" /></svg>;
const Arrow = () => <svg viewBox="0 0 20 20"><path d="M4 10h11M11 5l5 5-5 5" /></svg>;
const Drag = () => <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="5" r="1"/><circle cx="13" cy="5" r="1"/><circle cx="7" cy="10" r="1"/><circle cx="13" cy="10" r="1"/><circle cx="7" cy="15" r="1"/><circle cx="13" cy="15" r="1"/></svg>;
