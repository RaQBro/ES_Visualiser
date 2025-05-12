import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  getBezierPath,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import ExcelJS from "exceljs";
import dagre from "dagre";

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

const edgeTypes = { tooltip: EdgeWithTooltip };
const EDGE_STYLE = { stroke: "#f5f5f5", strokeWidth: 2 };
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
  const fileRef = useRef(null);

  const dagreLayout = useCallback((nArr, eArr) => {
    const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 50, ranksep: 80 });
    nArr.forEach((n) => g.setNode(n.id, calcNodeSize(n.data.label)));
    eArr.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    return nArr.map((n) => ({ ...n, position: g.node(n.id), ...calcNodeSize(n.data.label) }));
  }, []);

  const applyFilter = useCallback(
    (term) => {
      if (!term) {
        setNodes((prev) => prev.map((n) => ({ ...n, hidden: false, style: { ...n.style, border: undefined } })));
        setEdges((prev) => prev.map((e) => ({ ...e, hidden: false })));
        return;
      }
      const q = term.toLowerCase();
      const matched = new Set(nodes.filter((n) => n.data.label.toLowerCase().includes(q)).map((n) => n.id));
      const visible = new Set(matched);
      edges.forEach((e) => {
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
    },
    [nodes, edges]
  );

  const handleUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const map = new Map();
    const newEdges = [];
    wb.eachSheet((ws) => {
      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx === 1) return;
        const [src, tgt, label, link] = row.values.slice(1).map(String);
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
    setNodes(dagreLayout([...map.values()], newEdges));
    setEdges(newEdges);
    setSearch("");
  }, [dagreLayout]);

  const relayout = () => {
    if (!nodes.length) return;
    setNodes(dagreLayout(nodes, edges));
    if (search) applyFilter(search);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1e1e1e" }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: "none" }} />
      <div style={{ position: "absolute", zIndex: 10, margin: 16, padding: 16, display: "flex", gap: 16, background: "rgba(64,64,64,0.8)", borderRadius: 16 }}>
        <Button onClick={() => fileRef.current?.click()}>Upload Excel</Button>
        <Button onClick={relayout} disabled={!nodes.length}>Auto-arrange</Button>
        <Input
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            const v = e.target.value;
            setSearch(v);
            applyFilter(v);
          }}
          style={{ width: 224, height: 40 }}
        />
      </div>
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
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
