import { useLayoutEffect, useRef, useState } from 'react';
import type { CursorKey } from '../tutorial/tutorialData';

export interface CursorState {
    x: number;
    y: number;
    clicking: boolean;
    typing: boolean;
    reveal: number;
    progress: number;
    done: boolean;
}

// Smooth acceleration/deceleration so the cursor never zig-zags between points.
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function sample(path: CursorKey[], localT: number) {
    if (path.length === 0) return { x: 50, y: 50, typing: false };
    if (path.length === 1) return { x: path[0].x, y: path[0].y, typing: !!path[0].typing };
    let i = 0;
    while (i < path.length - 2 && localT > path[i + 1].t) i++;
    const a = path[i];
    const b = path[i + 1];
    const span = Math.max(b.t - a.t, 1e-4);
    const seg = Math.min(Math.max((localT - a.t) / span, 0), 1);
    const eased = easeInOut(seg);
    return { x: lerp(a.x, b.x, eased), y: lerp(a.y, b.y, eased), typing: !!a.typing };
}

function revealAt(path: CursorKey[], localT: number) {
    let r = 0;
    for (const k of path) {
        if (k.t <= localT + 1e-6 && typeof k.reveal === 'number') r = k.reveal;
    }
    return r;
}

/**
 * Drives one step's cursor choreography. Returns the live cursor position (percent of stage),
 * a click pulse flag, a typing flag and the current reveal count used by screen renderers.
 * `replayKey` restarts the animation when it changes; `reduceMotion` jumps straight to the end.
 */
export function useTutorialCursor(
    path: CursorKey[],
    duration: number,
    active: boolean,
    reduceMotion: boolean,
    replayKey: number,
): CursorState {
    const first = path[0] ?? { x: 50, y: 50 };
    const [state, setState] = useState<CursorState>({
        x: first.x,
        y: first.y,
        clicking: false,
        typing: false,
        reveal: 0,
        progress: 0,
        done: false,
    });

    const rafRef = useRef<number | null>(null);
    const startRef = useRef<number>(0);
    const firedRef = useRef<Set<number>>(new Set());
    const clickUntilRef = useRef<number>(0);

    useLayoutEffect(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        firedRef.current = new Set();
        clickUntilRef.current = 0;

        if (!active) return;

        if (reduceMotion) {
            const last = path[path.length - 1] ?? first;
            setState({ x: last.x, y: last.y, clicking: false, typing: false, reveal: revealAt(path, 1), progress: 1, done: true });
            return;
        }

        // Reset to the initial keyframe before the first animation tick so the
        // browser never paints stale reveal state from the previous step.
        setState({ x: first.x, y: first.y, clicking: false, typing: false, reveal: 0, progress: 0, done: false });

        startRef.current = performance.now();

        const tick = (now: number) => {
            const localT = Math.min((now - startRef.current) / duration, 1);
            const pos = sample(path, localT);

            path.forEach((k, idx) => {
                if (k.click && k.t <= localT + 1e-6 && !firedRef.current.has(idx)) {
                    firedRef.current.add(idx);
                    clickUntilRef.current = now + 220;
                }
            });

            setState({
                x: pos.x,
                y: pos.y,
                clicking: now < clickUntilRef.current,
                typing: pos.typing,
                reveal: revealAt(path, localT),
                progress: localT,
                done: localT >= 1,
            });

            if (localT < 1) rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [replayKey, active, reduceMotion, duration]);

    return state;
}
