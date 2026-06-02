import InteractiveViewer from "./preview";

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <div className="app-brand__eyebrow">SHINIER</div>
            <div className="app-brand__title">CIE xyY Interactive Viewer</div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <InteractiveViewer />
      </main>
    </div>
  );
}
