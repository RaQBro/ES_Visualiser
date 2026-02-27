import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  getBezierPath,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getRectOfNodes,
  getTransformForBounds,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import ExcelJS from "exceljs";
import dagre from "dagre";
import { toPng } from "html-to-image";

const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`rounded-lg border border-gray-600 bg-gray-800 text-gray-100 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    {...props}
  />
);

const EdgeWithTooltip = ({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, data }) => {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return (
    <g>
      <path id={id} d={edgePath} markerEnd={markerEnd} style={style} className="react-flow__edge-path" />
      {data?.tooltip && <title>{data.tooltip}</title>}
    </g>
  );
};

// Toast notification component
const Toast = ({ message, type = "error", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-blue-600";

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg max-w-md`}
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 transition"
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

const edgeTypes = { tooltip: EdgeWithTooltip };
const EDGE_STYLE = { stroke: "#f5f5f5", strokeWidth: 2, fill: "none" };
const HIGHLIGHT_STYLE = { border: "3px solid #ff4d4f" };

const measureText = (() => {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  ctx.font = "14px sans-serif";
  return (t) => ctx.measureText(t).width;
})();

const calcNodeSize = (label) => {
  const lines = label.split("\n");
  const width = Math.min(Math.max(80, Math.max(...lines.map(measureText)) + 24), 600);
  const height = Math.max(40, lines.length * 20);
  return { width, height };
};

const Flow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [search, setSearch] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const searchTimerRef = useRef(null);
  const { getNodes } = useReactFlow();

  // CRITICAL FIX: Use refs to track latest nodes/edges for debounced filter
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // Keep refs in sync with state
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const dagreLayout = useCallback((nArr, eArr) => {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 });
    nArr.forEach((n) => g.setNode(n.id, calcNodeSize(n.data.label)));
    eArr.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nArr.map((n) => ({ ...n, position: g.node(n.id), ...calcNodeSize(n.data.label) }));
  }, []);

  const applyFilter = useCallback((term) => {
    // CRITICAL FIX: Use refs instead of closure variables to get latest nodes/edges
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;

    if (!term) {
      setNodes((prev) => prev.map((n) => ({ ...n, hidden: false, style: { ...n.style, border: undefined } })));
      setEdges((prev) => prev.map((e) => ({ ...e, hidden: false })));
      setIsFiltering(false);
      return;
    }

    const q = term.toLowerCase();
    const matched = new Set(currentNodes.filter((n) => n.data.label.toLowerCase().includes(q)).map((n) => n.id));
    const visible = new Set(matched);

    currentEdges.forEach((e) => {
      const hit = e.label?.toLowerCase().includes(q) || e.data?.tooltip?.toLowerCase().includes(q);
      if (hit || matched.has(e.source) || matched.has(e.target)) {
        visible.add(e.source);
        visible.add(e.target);
      }
    });

    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        hidden: !visible.has(n.id),
        style: matched.has(n.id) ? { ...n.style, ...HIGHLIGHT_STYLE } : { ...n.style, border: undefined },
      }))
    );
    setEdges((prev) => prev.map((e) => ({ ...e, hidden: !(visible.has(e.source) && visible.has(e.target)) })));
    setIsFiltering(false);
  }, [setNodes, setEdges]);

  // Cleanup search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
  }, []);

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Empty file validation
    if (file.size === 0) {
      showToast("The selected file is empty. Please choose a valid Excel file.", "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    // File size validation (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      showToast(`File too large (${sizeMB}MB). Maximum size is 5MB. Please compress or split your data.`, "error");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setIsLoading(true);
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const map = new Map();
      const newEdges = [];
      let rowCount = 0;

      wb.eachSheet((ws) => {
        ws.eachRow({ includeEmpty: false }, (row, idx) => {
          if (idx === 1) return; // Skip header row
          rowCount++;
          const [src, tgt, label, link] = row.values.slice(1).map(String);

          if (!src || !tgt || src === "undefined" || tgt === "undefined") return;

          [src, tgt].forEach((id) => {
            if (!map.has(id))
              map.set(id, {
                id,
                data: { label: id },
                style: {
                  padding: 6,
                  background: "#2d2d2d",
                  color: "#f5f5f5",
                  borderRadius: 4,
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  textAlign: "center",
                },
              });
          });
          newEdges.push({
            id: `e-${src}-${tgt}-${idx}`,
            source: src,
            target: tgt,
            label: label || "",
            data: { tooltip: (link || label || "").replace(/\\n/g, "\n") },
            type: "tooltip",
            markerEnd: { type: MarkerType.ArrowClosed, width: 24, height: 24 },
            style: EDGE_STYLE,
          });
        });
      });

      if (map.size === 0 || newEdges.length === 0) {
        showToast("No valid data found in Excel file. Please check the format:\n- Column A: Source Node\n- Column B: Target Node\n- Column C: Edge Label (optional)\n- Column D: Tooltip (optional)", "error");
        if (fileRef.current) fileRef.current.value = "";
        return;
      }

      setNodes(dagreLayout([...map.values()], newEdges));
      setEdges(newEdges);
      setSearch("");

      showToast(`Successfully loaded ${map.size} nodes and ${newEdges.length} edges from ${rowCount} rows.`, "success");

      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      console.error('Excel parse error:', err);
      let errorMessage = 'Failed to read Excel file. ';

      if (err.message?.includes('Corrupt')) {
        errorMessage += 'The file appears to be corrupted.';
      } else if (err.message?.includes('zip')) {
        errorMessage += 'The file format is invalid. Please ensure it is a .xlsx file.';
      } else {
        errorMessage += 'Please check the file format:\n- Must be .xlsx or .xls\n- Column A: Source Node\n- Column B: Target Node';
      }

      showToast(errorMessage, "error");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setIsLoading(false);
    }
  }, [dagreLayout, showToast, setNodes, setEdges]);

  const handleExport = useCallback(async () => {
    const viewportEl = document.querySelector(".react-flow__viewport");
    if (!viewportEl) return;

    const nodesBounds = getRectOfNodes(getNodes());
    const PAD = 80;
    const IMAGE_WIDTH = Math.max(800, Math.ceil(nodesBounds.width) + PAD * 2);
    const IMAGE_HEIGHT = Math.max(600, Math.ceil(nodesBounds.height) + PAD * 2);
    const [x, y, zoom] = getTransformForBounds(nodesBounds, IMAGE_WIDTH, IMAGE_HEIGHT, 0.05, 2);

    try {
      const dataUrl = await toPng(viewportEl, {
        backgroundColor: "#1e1e1e",
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        style: {
          width: `${IMAGE_WIDTH}px`,
          height: `${IMAGE_HEIGHT}px`,
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "graph-export.png";
      a.click();
    } catch (err) {
      console.error("Export failed:", err);
      showToast("Export failed. Please try again.", "error");
    }
  }, [getNodes, showToast]);

  const relayout = () => {
    if (!nodes.length) return;
    setNodes(dagreLayout(nodes, edges));
    if (search) applyFilter(search);
  };

  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;
    const visibleNodes = search ? nodes.filter((n) => !n.hidden).length : totalNodes;
    const visibleEdges = search ? edges.filter((e) => !e.hidden).length : totalEdges;
    return { totalNodes, totalEdges, visibleNodes, visibleEdges };
  }, [nodes, edges, search]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1e1e1e" }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: "none" }} />

      {/* Toolbar */}
      <div style={{ position: "absolute", zIndex: 10, margin: 16, padding: 16, display: "flex", gap: 16, background: "rgba(64,64,64,0.8)", borderRadius: 16 }}>
        <Button onClick={() => fileRef.current?.click()} disabled={isLoading}>
          {isLoading ? "Loading…" : "Upload Excel"}
        </Button>
        <Button onClick={relayout} disabled={!nodes.length || isLoading}>Auto-arrange</Button>
        <Button onClick={handleExport} disabled={!nodes.length || isLoading}>Export PNG</Button>
        <div style={{ position: "relative" }}>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
              setIsFiltering(true);
              searchTimerRef.current = setTimeout(() => applyFilter(v), 300);
            }}
            style={{ width: 224, height: 40 }}
          />
          {isFiltering && (
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#6366f1",
                fontSize: 12,
                pointerEvents: "none",
              }}
            >
              Filtering...
            </span>
          )}
        </div>
      </div>

      {/* Flow canvas */}
      <div style={{ width: "100%", height: "100%" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          style={{ width: "100%", height: "100%" }}
        >
          <Background gap={16} size={1} />
          <MiniMap zoomable pannable />
          <Controls />
        </ReactFlow>
      </div>

      {/* Onboarding panel — shown when no graph is loaded */}
      {nodes.length === 0 && !isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          <div className="onboarding-panel">
            <h2 style={{ color: "#f5f5f5", fontSize: 20, marginBottom: 8, fontWeight: 600 }}>
              Getting Started
            </h2>
            <p style={{ color: "#aaa", fontSize: 14, marginBottom: 16 }}>
              Upload an Excel file (<code>.xlsx</code> / <code>.xls</code>) to visualise it as an interactive graph.
            </p>
            <p style={{ color: "#ccc", fontSize: 13, marginBottom: 10, fontWeight: 500 }}>Required columns (row 1 = header):</p>
            <table className="onboarding-table">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Name</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>A</td><td>Source Node</td><td>Yes</td></tr>
                <tr><td>B</td><td>Target Node</td><td>Yes</td></tr>
                <tr><td>C</td><td>Edge Label</td><td>No</td></tr>
                <tr><td>D</td><td>Tooltip</td><td>No</td></tr>
              </tbody>
            </table>
            <p style={{ color: "#888", fontSize: 12, marginTop: 14 }}>
              Multi-sheet workbooks are supported — all sheets are merged into one graph.
            </p>
          </div>
        </div>
      )}

      {/* Stats panel — bottom-left, above React Flow controls */}
      {nodes.length > 0 && (
        <div className="stats-panel">
          <span>{stats.totalNodes} nodes</span>
          <span className="stats-divider">·</span>
          <span>{stats.totalEdges} edges</span>
          {search && (
            <>
              <span className="stats-divider">·</span>
              <span style={{ color: "#6366f1" }}>
                {stats.visibleNodes} / {stats.totalNodes} visible
              </span>
            </>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p style={{ color: "#ccc", marginTop: 16, fontSize: 14 }}>Processing file…</p>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.15);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .stats-panel {
          position: absolute;
          bottom: 140px;
          left: 10px;
          z-index: 10;
          background: rgba(45, 45, 45, 0.85);
          border: 1px solid #444;
          border-radius: 8px;
          padding: 6px 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #ccc;
          backdrop-filter: blur(4px);
        }

        .stats-divider {
          color: #555;
        }

        .onboarding-panel {
          background: rgba(40, 40, 40, 0.97);
          border: 1px solid #444;
          border-radius: 16px;
          padding: 32px 36px;
          max-width: 460px;
          width: calc(100% - 64px);
          pointer-events: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .onboarding-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: #ccc;
        }

        .onboarding-table th {
          text-align: left;
          padding: 6px 10px;
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          font-weight: 500;
          border-bottom: 1px solid #444;
        }

        .onboarding-table td {
          padding: 6px 10px;
          border-bottom: 1px solid #333;
        }

        .onboarding-table tr:last-child td {
          border-bottom: none;
        }

        .onboarding-table td:first-child {
          font-family: monospace;
          color: #818cf8;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
