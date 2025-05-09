import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import ExcelJS from "exceljs";
import dagre from "dagre";

/* --------------------------------------------------------------
   Minimal Button & Input components (no external UI libs)
-------------------------------------------------------------- */
const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`rounded-lg border border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`.trim()}
    {...props}
  />
);

/* --------------------------- Layout + highlight constants --------------------------- */
const NODE_WIDTH = 150;
const NODE_HEIGHT = 40;
const NODE_HIGHLIGHT = { border: "2px solid #ff0072", background: "#fff3f8" };
const EDGE_HIGHLIGHT = { stroke: "#ff0072", strokeWidth: 2 };

export default function App() {
  /* ------------------------ React Flow state ------------------------ */
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef(null);

  /* ----------------------- Dagre layout helper ---------------------- */
  const runLayout = (rawNodes, rawEdges) => {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 });

    rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
    rawEdges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);

    return rawNodes.map((n) => {
      const { x, y } = g.node(n.id);
      return { ...n, position: { x, y } };
    });
  };

  /* ------------------- Highlight search matches (nodes + edges) ------------------- */
  const applySearchHighlight = useCallback(
    (term) => {
      const lower = term.toLowerCase();

      setNodes((prev) =>
        prev.map((n) => {
          const match = term && n.data.label.toLowerCase().includes(lower);
          return { ...n, style: match ? NODE_HIGHLIGHT : {} };
        })
      );

      setEdges((prev) =>
        prev.map((e) => {
          const labelMatch = e.label && e.label.toLowerCase().includes(lower);
          const srcMatch = e.source && e.source.toLowerCase().includes(lower);
          const tgtMatch = e.target && e.target.toLowerCase().includes(lower);
          const match = term && (labelMatch || srcMatch || tgtMatch);
          return { ...e, style: match ? EDGE_HIGHLIGHT : {} };
        })
      );
    },
    [setNodes, setEdges]
  );

  /* ------------------------- Upload handler ------------------------- */
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());

    const nodeMap = new Map();
    const newEdges = [];

    wb.eachSheet((ws) => {
      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx === 1) return; // header
        const [src, tgt, label] = row.values.slice(1).map(String);

        [src, tgt].forEach((id) => {
          if (!nodeMap.has(id))
            nodeMap.set(id, {
              id,
              data: { label: id },
              position: { x: 0, y: 0 },
            });
        });

        newEdges.push({
          markerEnd: { type: MarkerType.ArrowClosed }, id: `e-${src}-${tgt}-${idx}`, source: src, target: tgt, label });
      });
    });

    const laidOutNodes = runLayout([...nodeMap.values()], newEdges);
    setNodes(laidOutNodes);
    setEdges(newEdges);
    setSearch("");
  }, []);

  /* ------------------------- Relayout button ------------------------ */
  const handleRelayout = () => {
    if (!nodes.length) return;
    setNodes(runLayout(nodes, edges));
    if (search) applySearchHighlight(search);
  };

  /* ------------------------ Search handler ------------------------- */
  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearch(term);
    applySearchHighlight(term);
  };

  /* ------------------------------ JSX ------------------------------ */
  return (
    <div style={{ position: "fixed", inset: 0, background: "#1e1e1e" }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleUpload}
        style={{ display: "none" }}
      />

      {/* Toolbar */}
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          margin: "1rem",
          padding: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          background: "rgba(64,64,64,0.8)",
          borderRadius: "1rem",
        }}
      >
        <Button onClick={() => fileInputRef.current?.click()}>Upload Excel</Button>
        <Button onClick={handleRelayout} disabled={!nodes.length} className="bg-indigo-500 hover:bg-indigo-600">
          Auto-arrange
        </Button>
        <Input
          placeholder="Search nodes & edges…"
          value={search}
          onChange={handleSearchChange}
          style={{ width: "14rem", height: "2.5rem" }}
        />
      </div>

      {/* Graph canvas */}
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background gap={16} size={1} />
        <MiniMap zoomable pannable />
        <Controls />
      </ReactFlow>
    </div>
  );
}
