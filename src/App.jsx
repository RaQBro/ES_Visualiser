import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  getBezierPath,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import ExcelJS from "exceljs";
import dagre from "dagre";

/* ---------- Minimal in‑file Button & Input ---------- */
const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-lg bg-indigo-600 px-4 py-2 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = ({ className = "", ...props }) => (
  <input
    className={`rounded-lg border border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
    {...props}
  />
);

/* ---------- Custom edge w/ tooltip + arrow ---------- */
const EdgeWithTooltip = ({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, data }) => {
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY });
  return (
    <g>
      <path id={id} d={edgePath} markerEnd={markerEnd} style={style} className="react-flow__edge-path" />
      {data?.tooltip && <title>{data.tooltip}</title>}
    </g>
  );
};
const edgeTypes = { tooltip: EdgeWithTooltip };

/* ---------- constants ---------- */
const NODE_W = 150;
const NODE_H = 40;
const EDGE_STYLE = { stroke: "#f5f5f5", strokeWidth: 2 };
const NODE_MATCH_STYLE = { border: "3px solid #ff4d4f" };

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [query, setQuery] = useState("");
  const fileInput = useRef(null);

  /* Dagre layout */
  const layout = (rawNodes, rawEdges) => {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 });
    rawNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
    rawEdges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return rawNodes.map((n) => ({ ...n, position: g.node(n.id) }));
  };

  /* Search filter: show matches + neighbors & mark matches */
  const applySearchFilter = useCallback(
    (term) => {
      if (!term) {
        setNodes((prev) => prev.map((n) => ({ ...n, hidden: false, style: {} })));
        setEdges((prev) => prev.map((e) => ({ ...e, hidden: false })));
        return;
      }

      const lower = term.toLowerCase();

      // 1. Get matching node IDs by label
      const matchedIds = new Set(nodes.filter((n) => n.data.label.toLowerCase().includes(lower)).map((n) => n.id));

      // 2. Determine visible node IDs (matches + any directly connected)
      const visibleIds = new Set(matchedIds);
      edges.forEach((e) => {
        const labelHit = e.label?.toLowerCase().includes(lower) || e.data?.tooltip?.toLowerCase().includes(lower);
        const endpointHit = matchedIds.has(e.source) || matchedIds.has(e.target);
        if (labelHit || endpointHit) {
          visibleIds.add(e.source);
          visibleIds.add(e.target);
        }
      });

      // 3. Update node hidden & style
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          hidden: !visibleIds.has(n.id),
          style: matchedIds.has(n.id) ? { ...n.style, ...NODE_MATCH_STYLE } : { ...n.style, border: undefined },
        }))
      );

      // 4. Update edge hidden (show if both endpoints visible)
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          hidden: !(visibleIds.has(e.source) && visibleIds.has(e.target)),
        }))
      );
    },
    [nodes, edges]
  );

  /* Excel upload */
  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const nodeMap = new Map();
    const arrEdges = [];

    wb.eachSheet((ws) => {
      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx === 1) return;
        const [src, tgt, label, link] = row.values.slice(1).map(String);
        [src, tgt].forEach((id) => {
          if (!nodeMap.has(id)) nodeMap.set(id, { id, data: { label: id }, position: { x: 0, y: 0 } });
        });
        arrEdges.push({
          id: `e-${src}-${tgt}-${idx}`,
          source: src,
          target: tgt,
          label: label || "",
          data: { tooltip: link || label || "" },
          type: "tooltip",
          markerEnd: { type: MarkerType.ArrowClosed, width: 24, height: 24 },
          style: EDGE_STYLE,
        });
      });
    });

    setNodes(layout([...nodeMap.values()], arrEdges));
    setEdges(arrEdges);
    setQuery("");
  }, []);

  const relayout = () => {
    if (!nodes.length) return;
    setNodes(layout(nodes, edges));
    if (query) applySearchFilter(query);
  };

  /* JSX */
  return (
    <div style={{ position: "fixed", inset: 0, background: "#1e1e1e" }}>
      <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: "none" }} />

      <div style={{ position: "absolute", zIndex: 10, margin: "1rem", padding: "1rem", display: "flex", gap: "1rem", background: "rgba(64,64,64,0.8)", borderRadius: "1rem" }}>
        <Button onClick={() => fileInput.current?.click()}>Upload Excel</Button>
        <Button onClick={relayout} disabled={!nodes.length}>Auto-arrange</Button>
        <Input
          placeholder="Search & focus…"
          value={query}
          onChange={(e) => {
            const t = e.target.value;
            setQuery(t);
            applySearchFilter(t);
          }}
          style={{ width: "14rem", height: "2.5rem" }}
        />
      </div>

      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
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
