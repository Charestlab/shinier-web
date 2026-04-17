import React, { useEffect, useState } from "react";
import InteractiveViewer from "./preview";
import { DocsPage } from "./components/DocsPage";

type AppTab = "viewer" | "docs";

function getTabFromHash(hash: string): AppTab {
  return hash.startsWith("#docs") ? "docs" : "viewer";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => getTabFromHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(getTabFromHash(window.location.hash));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const switchTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === "docs") {
      if (!window.location.hash.startsWith("#docs")) {
        window.history.replaceState(null, "", "#docs");
      }
      return;
    }

    window.history.replaceState(null, "", "#viewer");
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-brand">
            <div className="app-brand__eyebrow">SHINIER</div>
            <div className="app-brand__title">Interactive Viewer + Package Documentation</div>
          </div>

          <nav className="app-tabs" aria-label="Main navigation tabs">
            <button
              type="button"
              className={`app-tab ${activeTab === "viewer" ? "is-active" : ""}`}
              onClick={() => switchTab("viewer")}
            >
              Viewer
            </button>
            <button
              type="button"
              className={`app-tab ${activeTab === "docs" ? "is-active" : ""}`}
              onClick={() => switchTab("docs")}
            >
              Documentation
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === "viewer" ? <InteractiveViewer /> : <DocsPage />}
      </main>
    </div>
  );
}