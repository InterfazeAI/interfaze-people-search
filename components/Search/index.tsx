"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@chakra-ui/react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { InterfazeMark } from "@/components/ui/InterfazeMark";
import { useApiKey } from "@/hooks/useApiKey";
import { useContactLinks } from "@/hooks/useContactLinks";
import { mergeContacts } from "@/lib/contacts";
import { useSearch } from "@/hooks/useSearch";
import type { Expert } from "@/lib/schema";
import { SearchForm } from "./SearchForm";
import { Settings } from "./Settings";
import { Results } from "./Results";
import { EvidencePanel } from "./EvidencePanel";

export function PeopleSearch() {
  const key = useApiKey();
  const search = useSearch();
  const contactSearch = useContactLinks();
  const sourceRun = search.run;
  const run = sourceRun
    ? {
        ...sourceRun,
        experts: sourceRun.experts.map((person) => ({
          ...person,
          contacts: mergeContacts(
            person.contacts ?? [],
            contactSearch.records[person.id]?.contacts ?? [],
          ),
        })),
      }
    : null;
  const busy = run?.phase === "discovering" || run?.phase === "reading";
  const [formVersion, setFormVersion] = useState(0);
  const [settings, setSettings] = useState(false);
  const [selected, setSelected] = useState<Expert | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>();
  function reset() {
    contactSearch.reset();
    search.reset();
    setFormVersion((value) => value + 1);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to search
      </a>
      <header className="site-header shell">
        <Link
          href="/"
          className="brand"
          aria-label="Interfaze People Search home"
        >
          <InterfazeMark height={16} />
          <span className="wordmark">interfaze</span>
          <span className="brand-divider" />
          <span className="product-name">people search</span>
        </Link>
        <Button variant="outline" onClick={() => setSettings(true)}>
          {key.apiKey ? "API key saved" : "Add API key"}
          <Settings2 size={13} />
        </Button>
      </header>
      <main id="main" className={`shell ${run ? "has-results" : ""}`}>
        <section className={`intro ${run ? "intro-compact" : ""}`}>
          <h1>
            Find the people
            <br /> behind <span>the work.</span>
          </h1>
          <p>
            Discover researchers and inventors through papers and patents.
            <br className="desktop-break" /> Every result leads back to the
            source.
          </p>
        </section>
        <SearchForm
          key={formVersion}
          busy={!!busy}
          hasKey={!!key.apiKey}
          showExamples={!run}
          onSearch={(config) => {
            if (!key.apiKey) {
              setSettings(true);
              return;
            }
            contactSearch.reset();
            void search.start(config, key.apiKey);
          }}
          onCancel={search.cancel}
          onSettings={() => setSettings(true)}
        />
        {search.error && (
          <p className="error-note" role="alert">
            {search.error}
          </p>
        )}
        {run && (
          <Results
            key={run.startedAt}
            run={run}
            onSelect={(expert, sourceId) => {
              setSelected(expert);
              setSelectedSource(sourceId);
            }}
            onReset={reset}
          />
        )}
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <a
            className="footer-brand"
            href="https://interfaze.ai"
            target="_blank"
            rel="noreferrer"
          >
            <InterfazeMark height={12} /> Powered by Interfaze{" "}
            <ArrowUpRight size={12} />
          </a>
          <a href="https://interfaze.ai/docs" target="_blank" rel="noreferrer">
            API docs <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
      {settings && (
        <Settings
          apiKey={key.apiKey}
          busy={search.busy || contactSearch.busy}
          storageError={key.storageError}
          onSave={key.save}
          onClose={() => setSettings(false)}
        />
      )}
      {selected && (
        <EvidencePanel
          preferredSourceId={selectedSource}
          sources={run?.sources ?? []}
          expert={
            run?.experts.find((person) => person.id === selected.id) ?? selected
          }
          contactState={contactSearch.records[selected.id]}
          contactBusy={contactSearch.busy || search.busy}
          onCancelContacts={contactSearch.cancel}
          onFindContacts={() => {
            if (!key.apiKey) {
              setSelected(null);
              setSettings(true);
              return;
            }
            void contactSearch.find(selected, key.apiKey);
          }}
          onClose={() => setSelected(null)}
          hasKey={!!key.apiKey}
        />
      )}
    </div>
  );
}
