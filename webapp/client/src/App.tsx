import { useStore } from './state/store';
import TopBar from './components/TopBar';
import StepNav from './components/StepNav';
import Inspector from './components/Inspector';
import WizardBar from './components/WizardBar';
import DfdView from './components/dfd/DfdView';
import ProjectPanel from './components/panels/ProjectPanel';
import AssumptionsPanel from './components/panels/AssumptionsPanel';
import SystemPanel from './components/panels/SystemPanel';
import ThreatsPanel from './components/panels/ThreatsPanel';
import RequirementsPanel from './components/panels/RequirementsPanel';
import CountermeasuresPanel from './components/panels/CountermeasuresPanel';
import AttackTreesPanel from './components/panels/AttackTreesPanel';
import ReviewPanel from './components/panels/ReviewPanel';
import VersionsPanel from './components/panels/VersionsPanel';
import DashboardPanel from './components/panels/DashboardPanel';
import DefectsPanel from './components/panels/DefectsPanel';
import AssistantPanel from './components/panels/AssistantPanel';
import KbPanel from './components/panels/KbPanel';

export default function App() {
    const data = useStore((s) => s.data);
    const view = useStore((s) => s.activeView);
    const newProject = useStore((s) => s.newProject);

    const main = () => {
        switch (view) {
            case 'dfd':
                return <DfdView />;
            case 'project':
                return <ProjectPanel />;
            case 'assumptions':
                return <AssumptionsPanel />;
            case 'system':
                return <SystemPanel />;
            case 'threats':
                return <ThreatsPanel />;
            case 'requirements':
                return <RequirementsPanel />;
            case 'countermeasures':
                return <CountermeasuresPanel />;
            case 'attackTrees':
                return <AttackTreesPanel />;
            case 'review':
                return <ReviewPanel />;
            case 'versions':
                return <VersionsPanel />;
            case 'dashboard':
                return <DashboardPanel />;
            case 'defects':
                return <DefectsPanel />;
            case 'assistant':
                return <AssistantPanel />;
            case 'kb':
                return <KbPanel />;
            default:
                return <DfdView />;
        }
    };

    return (
        <div className="app">
            <TopBar />
            {data ? (
                <div className={'layout' + (view === 'dashboard' || view === 'kb' || view === 'defects' || view === 'assistant' || view === 'versions' ? ' wide' : '')}>
                    <StepNav />
                    <main className={'main' + (view === 'dfd' ? ' is-dfd' : '')}>
                        {main()}
                        {view !== 'dfd' && <WizardBar />}
                    </main>
                    {view !== 'dashboard' && view !== 'kb' && view !== 'defects' && view !== 'assistant' && view !== 'versions' && <Inspector />}
                </div>
            ) : (
                <div className="empty">
                    <div className="box">
                        <h2>No project open</h2>
                        <p className="muted">
                            Create a project to begin, or copy a folder into <code>tra-webapp/projects/</code>. Each step is a JSON
                            file you can edit here or directly on disk — changes sync live.
                        </p>
                        <button className="btn primary" onClick={() => newProject('New device')}>
                            + New project
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
