# ES_Visualiser - Improvement Checklist

**Last Updated:** 2026-02-27  
**Status:** Ready for implementation  
**Estimated Total Time:** 21 hours to production-ready

---

## Priority 1: Critical Fixes (1 hour) ⚠️

These prevent crashes and improve basic usability.

### [✅] Task 1.1: Add Error Handling for Excel Upload
**Time:** 30 minutes  
**Priority:** Critical  
**Impact:** Prevents application crashes  
**Status:** ✅ COMPLETE (2026-02-27)

**Implementation:**
```javascript
// In handleUpload function (line ~118)
const handleUpload = useCallback(async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    // ... rest of parsing logic
  } catch (err) {
    console.error('Excel parse error:', err);
    alert('Failed to read Excel file. Please check the file format and try again.');
    return;
  }
}, [dagreLayout]);
```

**Test:**
1. Upload corrupted Excel file → should show error message
2. Upload non-Excel file → should show error message
3. Upload valid Excel file → should work normally

---

### [✅] Task 1.2: Add File Size Limit
**Time:** 10 minutes  
**Priority:** Critical  
**Impact:** Prevents browser memory exhaustion  
**Status:** ✅ COMPLETE (2026-02-27)

**Implementation:**
```javascript
// In handleUpload function, before parsing
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
if (file.size > MAX_FILE_SIZE) {
  alert(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB.`);
  return;
}
```

**Test:**
1. Upload 6MB file → should reject with message
2. Upload 4MB file → should process normally

---

### [✅] Task 1.3: Debounce Search Input
**Time:** 20 minutes  
**Priority:** Critical  
**Impact:** Improves performance with large graphs  
**Status:** ✅ COMPLETE (2026-02-27)

**Implementation:**
```javascript
// Add at top of file
import { useEffect, useRef } from 'react';

// In Flow component
const searchTimerRef = useRef(null);

// Update search input onChange
onChange={(e) => {
  const v = e.target.value;
  setSearch(v);
  
  // Clear existing timer
  if (searchTimerRef.current) {
    clearTimeout(searchTimerRef.current);
  }
  
  // Debounce filter application
  searchTimerRef.current = setTimeout(() => {
    applyFilter(v);
  }, 300); // 300ms delay
}}
```

**Test:**
1. Type rapidly in search box → filter should apply 300ms after last keystroke
2. Large graphs (>500 nodes) → should not lag while typing

---

## Priority 2: Documentation (2 hours) 📄

Essential for onboarding new users.

### [ ] Task 2.1: Write Comprehensive README
**Time:** 2 hours  
**Priority:** High  
**Impact:** Enables user onboarding

**Sections to Include:**

#### 1. Project Overview
- What is ES_Visualiser?
- Key features
- Screenshot/demo

#### 2. Excel Format Specification
```
| Column A     | Column B     | Column C     | Column D          |
|--------------|--------------|--------------|-------------------|
| Source Node  | Target Node  | Edge Label   | Edge Tooltip      |
| Node1        | Node2        | connects to  | Connection info   |
| Node2        | Node3        | depends on   | Dependency detail |
```

**Rules:**
- First row is skipped (header)
- Multiple sheets supported
- Empty cells → empty strings
- `\n` in tooltips → line breaks

#### 3. Installation & Setup
```bash
npm install
npm run dev
```

#### 4. Usage Guide
1. Click "Upload Excel"
2. Select .xlsx file
3. Graph appears automatically
4. Use search to filter
5. Click "Auto-arrange" to re-layout
6. Drag nodes to reposition

#### 5. Features
- Interactive graph visualization
- Real-time search & filter
- Zoom, pan, mini-map
- Edge tooltips
- Automatic layout

#### 6. Limitations
- Max recommended: 2000 nodes
- File size limit: 5MB
- No export feature (yet)
- No save/load projects

#### 7. Troubleshooting
- **Graph is empty** → Check Excel format
- **Search is slow** → Graph may be too large
- **Upload fails** → Check file size (<5MB)

#### 8. Technology Stack
- React 19
- Vite 6
- React Flow 11
- ExcelJS 4
- Dagre 0.8

#### 9. License
- (Add appropriate license)

**Deliverable:** `README.md` replacing default Vite template

---

## Priority 3: UX Improvements (3 hours) 🎨

Enhance user experience with feedback and features.

### [ ] Task 3.1: Add Loading Indicator
**Time:** 1 hour  
**Priority:** Medium  
**Impact:** User feedback during upload

**Implementation:**
```javascript
const [loading, setLoading] = useState(false);

const handleUpload = useCallback(async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  setLoading(true);
  try {
    // ... parsing logic
  } finally {
    setLoading(false);
  }
}, [dagreLayout]);

// In UI
<Button onClick={() => fileRef.current?.click()} disabled={loading}>
  {loading ? 'Loading...' : 'Upload Excel'}
</Button>
```

**Test:**
1. Upload large file → button should show "Loading..."
2. Upload completes → button returns to "Upload Excel"

---

### [ ] Task 3.2: Add Export Feature
**Time:** 2 hours  
**Priority:** Medium  
**Impact:** Users can share visualizations

**Implementation:**
```javascript
// Add button
<Button onClick={exportGraph}>Export PNG</Button>

// Add function
const exportGraph = useCallback(() => {
  // React Flow has built-in export
  // See: https://reactflow.dev/api-reference/hooks/use-react-flow
  const reactFlowInstance = useReactFlow();
  const imageData = reactFlowInstance.toObject();
  // Convert to PNG using html2canvas or built-in method
}, []);
```

**Features:**
- Export as PNG (full graph)
- Export as SVG (vector)
- Optional: Export as JSON (re-import later)

**Test:**
1. Click export → file downloads
2. Open file → graph visible
3. Re-import JSON → graph restored

---

## Priority 4: Code Quality (15 hours) 🔧

Long-term maintainability improvements.

### [ ] Task 4.1: Migrate to TypeScript
**Time:** 6 hours  
**Priority:** Low  
**Impact:** Type safety, better IDE support

**Steps:**
1. Rename `App.jsx` → `App.tsx`
2. Add type definitions:
   ```typescript
   interface Node {
     id: string;
     data: { label: string };
     position?: { x: number; y: number };
     width?: number;
     height?: number;
     style?: React.CSSProperties;
   }
   
   interface Edge {
     id: string;
     source: string;
     target: string;
     label?: string;
     data?: { tooltip?: string };
     type?: string;
     markerEnd?: any;
     style?: React.CSSProperties;
   }
   ```
3. Add types to all functions
4. Fix type errors
5. Update `tsconfig.json`

**Benefits:**
- Catch errors at compile-time
- Better autocomplete in IDE
- Self-documenting code

---

### [ ] Task 4.2: Add Unit Tests
**Time:** 8 hours  
**Priority:** Low  
**Impact:** Confidence in refactoring

**Setup:**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Tests to Write:**

#### Test 1: calcNodeSize
```javascript
test('calcNodeSize returns correct dimensions', () => {
  expect(calcNodeSize('Short')).toEqual({ width: expect.any(Number), height: 40 });
  expect(calcNodeSize('Line1\nLine2')).toEqual({ width: expect.any(Number), height: 40 });
});
```

#### Test 2: applyFilter
```javascript
test('applyFilter highlights matching nodes', () => {
  // Mock nodes and edges
  // Call applyFilter with search term
  // Verify nodes are hidden/highlighted correctly
});
```

#### Test 3: handleUpload
```javascript
test('handleUpload rejects large files', async () => {
  const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.xlsx');
  // Simulate upload
  // Verify alert was shown
});
```

**Coverage Goal:** 80%+ of critical functions

---

### [ ] Task 4.3: Split Components into Separate Files
**Time:** 3 hours  
**Priority:** Low  
**Impact:** Better organization, easier testing

**New Structure:**
```
src/
├── components/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── EdgeWithTooltip.tsx
│   ├── GraphControls.tsx
│   └── GraphCanvas.tsx
├── hooks/
│   ├── useGraphLayout.ts (dagreLayout logic)
│   ├── useExcelUpload.ts (handleUpload logic)
│   └── useGraphFilter.ts (applyFilter logic)
├── utils/
│   ├── nodeCalculations.ts (calcNodeSize, measureText)
│   └── constants.ts (styles, configs)
└── App.tsx (orchestration only)
```

**Benefits:**
- Easier to test individual components
- Clearer separation of concerns
- Easier to understand for new developers

---

## Priority 5: Advanced Features (Optional) 🚀

Nice-to-have enhancements for power users.

### [ ] Task 5.1: Add Keyboard Shortcuts
**Time:** 1 hour  
**Priority:** Optional  
**Impact:** Power user efficiency

**Shortcuts:**
- `Ctrl+O` → Open file dialog
- `Ctrl+L` → Auto-arrange layout
- `Escape` → Clear search
- `Ctrl+E` → Export graph
- `Ctrl+Z` → Undo (if implementing undo stack)

---

### [ ] Task 5.2: Add Graph Statistics Panel
**Time:** 2 hours  
**Priority:** Optional  
**Impact:** Data insights

**Display:**
- Node count
- Edge count
- Average degree
- Isolated nodes
- Strongly connected components

---

### [ ] Task 5.3: Add Layout Options
**Time:** 3 hours  
**Priority:** Optional  
**Impact:** Flexibility

**Options:**
- Horizontal (LR) vs Vertical (TB)
- Compact vs Spacious
- Circular layout (alternative to Dagre)

---

## Testing Checklist

### Manual Testing
- [ ] Upload valid Excel file → graph displays
- [ ] Upload invalid file → error message shows
- [ ] Upload large file (>5MB) → rejected with message
- [ ] Search for node → highlights correctly
- [ ] Search for edge label → shows connected nodes
- [ ] Clear search → all nodes visible
- [ ] Drag node → position updates
- [ ] Zoom in/out → works smoothly
- [ ] Pan graph → works smoothly
- [ ] Hover edge → tooltip appears
- [ ] Click "Auto-arrange" → layout recalculates
- [ ] Multiple sheets → all data combined

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Performance Testing
- [ ] 100 nodes → smooth
- [ ] 500 nodes → acceptable
- [ ] 1000 nodes → acceptable
- [ ] 2000 nodes → usable (some lag)
- [ ] 5000 nodes → (should add warning)

---

## Deployment Checklist

### Before Public Deployment
- [ ] All Priority 1 tasks complete
- [ ] README documentation complete
- [ ] Security audit performed (`npm audit`)
- [ ] All dependencies updated
- [ ] User testing completed (3+ users)
- [ ] Performance benchmarking done
- [ ] Error logging added (e.g., Sentry)
- [ ] Analytics added (optional, e.g., Plausible)
- [ ] License file added
- [ ] Contributing guidelines added (if open-source)

### Build & Deploy
- [ ] Run `npm run build`
- [ ] Test production build locally
- [ ] Configure hosting (Netlify, Vercel, etc.)
- [ ] Set up CI/CD (optional)
- [ ] Configure domain (if custom)
- [ ] Enable HTTPS
- [ ] Test deployed version
- [ ] Monitor for errors (first 24 hours)

---

## Progress Tracking

**Started:** 2026-02-27  
**Target Completion:** In Progress  
**Actual Completion:** Priority 1 Complete

**Completed Tasks:**
- [✅] Priority 1 (Critical): 3/3 ✅ COMPLETE
- [ ] Priority 2 (Documentation): 0/1
- [ ] Priority 3 (UX): 0/2
- [ ] Priority 4 (Code Quality): 0/3
- [ ] Priority 5 (Advanced): 0/3

**Total Progress:** 3/12 tasks (25%)

---

## Notes & Decisions

### Decision Log
- **2026-02-27:** Analysis completed, checklist created
- **2026-02-27:** Priority 1 tasks implemented
  - Used browser `alert()` for error messages (quick implementation)
  - 5MB file size limit chosen (balances usability vs memory safety)
  - 300ms debounce delay for search (responsive but prevents lag)
  - Added timer cleanup to prevent memory leaks

### Blockers & Risks
- _Document any blockers or risks encountered_

### Questions
- _Add questions that arise during implementation_

---

**Next Action:** Start with Priority 1, Task 1.1 (Error Handling) - 30 minutes
