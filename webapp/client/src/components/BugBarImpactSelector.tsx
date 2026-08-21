// Interactive Bug Bar impact rating: the full C/I/A/Safety matrix with its worked scenarios,
// so a user rates each dimension by clicking the scenario text that applies instead of picking a
// bare number from a dropdown. Impact = the worst (max) of the four selected dimension scores.
import { useStore } from '../state/store';
import type { Objectives } from '../types';

const LEVELS_DESC = [5, 4, 3, 2, 1];
const DIM_KEYS = ['confidentiality', 'integrity', 'availability', 'safety'] as const;

export default function BugBarImpactSelector({ dims, onSelect }: { dims?: Objectives; onSelect: (key: string, score: number | undefined) => void }) {
    const bugBar = useStore((s) => s.bugBar);
    const dimensions = bugBar?.dimensions || [];
    if (!dimensions.length) return <p className="hint">Bug bar reference not available.</p>;
    const levelLabel = (score: number) => dimensions[0].levels.find((l: any) => l.score === score)?.label || '';
    const missing = DIM_KEYS.filter((k) => typeof (dims as any)?.[k] !== 'number');
    const overall = DIM_KEYS.map((k) => (dims as any)?.[k]).filter((v) => typeof v === 'number');

    return (
        <div className="bbselect">
            {bugBar.rule && <p className="hint" style={{ marginTop: 0 }}>{bugBar.rule}</p>}
            <table className="tbl bugbar bbselect-table">
                <thead>
                    <tr>
                        <th style={{ width: 90 }}>Level</th>
                        {dimensions.map((d: any) => {
                            const selected = (dims as any)?.[d.key];
                            return (
                                <th key={d.key}>
                                    {d.label}
                                    {typeof selected === 'number' ? (
                                        <span className="bbsel-badge">{selected}</span>
                                    ) : (
                                        <span className="bbsel-badge unset">–</span>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {LEVELS_DESC.map((score) => (
                        <tr key={score}>
                            <td className="bblevel">
                                <b>{score}</b> · {levelLabel(score)}
                            </td>
                            {dimensions.map((d: any) => {
                                const level = d.levels.find((l: any) => l.score === score);
                                const selectedVal = (dims as any)?.[d.key];
                                const exact = selectedVal === score;
                                // Fill every bar below the selected level too, so the column reads like a bar chart.
                                const filled = typeof selectedVal === 'number' && score <= selectedVal;
                                return (
                                    <td key={d.key}>
                                        <button
                                            type="button"
                                            className={'bbcell' + (filled ? ' filled' : '') + (exact ? ' selected' : '')}
                                            aria-pressed={exact}
                                            onClick={() => onSelect(d.key, exact ? undefined : score)}
                                        >
                                            {level?.scenario}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="hint" style={{ marginTop: 6 }}>
                {overall.length ? (
                    <>Impact = worst selected dimension — currently <b>{Math.max(...overall)}</b>.</>
                ) : (
                    'Select the applicable scenario in every column.'
                )}
                {missing.length > 0 && missing.length < 4 && (
                    <span className="warnmark"> Still missing: {missing.join(', ')}.</span>
                )}
            </p>
        </div>
    );
}
