import React, { useCallback, useEffect, useRef, useState } from "react";
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

// Toast notification component
const Toast = ({ message, type = "error", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === "error" ? "bg-red-600" : type === "success" ? "bg-green-600" : "bg-blue-600";
  
  return (
    <div
      className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg max-w-md animate-slide-in`}
      style={{
        animation: "slideIn 0.3s ease-out",
      }}
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
  const [isFiltering, setIsFiltering] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);
  const searchTimerRef = useRef(null);
  
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
      // Reset file input
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      return;
    }

    // File size validation (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      showToast(`File too large (${sizeMB}MB). Maximum size is 5MB. Please compress or split your data.`, "error");
      // Reset file input
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      return;
    }

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
          
          // Validate required columns
          if (!src || !tgt || src === "undefined" || tgt === "undefined") {
            return; // Skip invalid rows
          }
          
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
        // Reset file input
        if (fileRef.current) {
          fileRef.current.value = "";
        }
        return;
      }
      
      setNodes(dagreLayout([...map.values()], newEdges));
      setEdges(newEdges);
      setSearch("");
      
      showToast(`Successfully loaded ${map.size} nodes and ${newEdges.length} edges from ${rowCount} rows.`, "success");
      
      // Reset file input to allow re-uploading the same file
      if (fileRef.current) {
        fileRef.current.value = "";
      }
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
      
      // Reset file input
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }, [dagreLayout, showToast, setNodes, setEdges]);

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
        <div style={{ position: "relative" }}>
          <Input
            placeholder="Search…"
            value={search}
            onChange={(e) => {
              const v = e.target.value;
              setSearch(v);
              
              // Clear existing timer
              if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
              }
              
              // Show filtering indicator
              setIsFiltering(true);
              
              // Debounce filter application (300ms delay)
              searchTimerRef.current = setTimeout(() => {
                applyFilter(v);
              }, 300);
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
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
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
