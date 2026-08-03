import { useEffect } from 'react';
import { useStore } from '../state/store';

export default function TopBar() {
    const projects = useStore((s) => s.projects);
    const activeId = useStore((s) => s.activeId);
    const connected = useStore((s) => s.connected);
    const lastSavedAt = useStore((s) => s.lastSavedAt);
    const saveState = useStore((s) => s.saveState);
    const select = useStore((s) => s.selectProject);
    const newProject = useStore((s) => s.newProject);
    const setView = useStore((s) => s.setView);
    const status = useStore((s) => s.data?.project?.status);
    const theme = useStore((s) => s.theme);
    const setTheme = useStore((s) => s.setTheme);
    const undo = useStore((s) => s.undo);
    const redo = useStore((s) => s.redo);
    const undoDepth = useStore((s) => s.undoDepth);
    const redoDepth = useStore((s) => s.redoDepth);
    const setSettings = useStore((s) => s.openSettings);

    // Global Ctrl/Cmd+Z (undo) and Ctrl+Y / Ctrl+Shift+Z (redo). We defer to the browser's native
    // undo while a text field is focused so typing corrections still work as expected.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            const k = e.key.toLowerCase();
            if (k === 'z' && !e.shiftKey) {
                e.preventDefault();
                useStore.getState().undo();
            } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
                e.preventDefault();
                useStore.getState().redo();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const onNew = async () => {
        const name = window.prompt('New device / project name:', 'New device');
        if (name) await newProject(name);
    };

    const savedLabel =
        saveState === 'saving'
            ? 'saving…'
            : saveState === 'offline'
                ? 'unsaved — offline'
                : lastSavedAt
                    ? `saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                    : '';

    return (
        <header className="topbar">
            <div className="brand">
                <img className="logo" src="/favicon.svg" alt="" width={26} height={26} />
                <span>
                    EmbedRisk <small>· Threat &amp; Risk Assessment</small>
                </span>
            </div>

            <select className="inp" style={{ height: 34, width: 280 }} value={activeId || ''} onChange={(e) => select(e.target.value)}>
                {projects.length === 0 && <option value="">No projects</option>}
                {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.title} ({p.id})
                    </option>
                ))}
            </select>
            <button className="btn sm" onClick={onNew}>
                + New
            </button>
            {status && <span className="tag statuspill">{status}</span>}

            <div className="spacer" />

            <span className={'saved' + (saveState === 'offline' ? ' warnmark' : '')}>{savedLabel}</span>
            <span className="undogroup">
                <button className="btn sm iconbtn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!undoDepth} onClick={undo}>
                    ↶
                </button>
                <button className="btn sm iconbtn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!redoDepth} onClick={redo}>
                    ↷
                </button>
            </span>
            <button className="btn sm" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
            <button className="btn sm iconbtn" title="Project settings" aria-label="Project settings" onClick={() => setSettings(true)}>
                ⚙
            </button>
            <button className="btn" onClick={() => setView('review')}>
                Generate report
            </button>
            <span className="conn" title={connected ? 'Live sync connected' : 'Reconnecting…'}>
                <span className={'dot ' + (connected ? 'on' : 'off')} />
                {connected ? 'Live' : 'Offline'}
            </span>
        </header>
    );
}
