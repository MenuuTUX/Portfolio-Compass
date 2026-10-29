"use client";

import { useEffect, useRef } from "react";
import Editor, { loader, type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { STRATEGY_API_DTS } from "@/lib/lab/strategy/api-dts";
import type { StrategyError, StrategyLanguage } from "@/lib/lab/strategy/types";

// Monaco, loaded from jsDelivr at a pinned version so the editor (several MB)
// costs this site no bandwidth. This module is only imported through
// next/dynamic in code mode on wide screens.
loader.config({ paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs" } });

type Monaco = Parameters<BeforeMount>[0];
type EditorInstance = Parameters<OnMount>[0];

interface CodeEditorProps {
  language: StrategyLanguage;
  value: string;
  onChange: (code: string) => void;
  error: StrategyError | null;
  onRun: () => void;
}

const beforeMount: BeforeMount = (monaco) => {
  const ts = monaco.languages.typescript.typescriptDefaults;
  ts.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    lib: ["es2020"],
    strict: false,
    noEmit: true,
    allowNonTsExtensions: true,
  });
  ts.addExtraLib(STRATEGY_API_DTS, "file:///compass-lab.d.ts");
};

export default function CodeEditor({ language, value, onChange, error, onRun }: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const refs = useRef<{ editor: EditorInstance; monaco: Monaco } | null>(null);
  const runRef = useRef(onRun);
  useEffect(() => {
    runRef.current = onRun;
  }, [onRun]);

  // Mark the failing line, and jump to it.
  useEffect(() => {
    const r = refs.current;
    const model = r?.editor.getModel();
    if (!r || !model) return;
    const markers = error?.line && error.line <= model.getLineCount()
      ? [{
          startLineNumber: error.line,
          endLineNumber: error.line,
          startColumn: 1,
          endColumn: model.getLineMaxColumn(error.line),
          message: error.message,
          severity: r.monaco.MarkerSeverity.Error,
        }]
      : [];
    r.monaco.editor.setModelMarkers(model, "compass-lab", markers);
    if (markers.length) r.editor.revealLineInCenterIfOutsideViewport(error!.line!);
  }, [error, value]);

  return (
    <Editor
      height="100%"
      language={language}
      path={language === "python" ? "strategy.py" : "strategy.ts"}
      value={value}
      theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
      beforeMount={beforeMount}
      onMount={(editor, monaco) => {
        refs.current = { editor, monaco };
        // Monaco swallows key presses, so ⌘/Ctrl+Enter is bound inside it too.
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
      }}
      onChange={(v) => onChange(v ?? "")}
      loading={<div className="ws-skeleton h-full w-full" aria-label="Loading editor" />}
      options={{
        // The site font is proportional; code needs the system monospace font.
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 13,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: language === "python" ? 4 : 2,
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  );
}
