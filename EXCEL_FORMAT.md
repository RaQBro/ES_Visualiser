# Excel Format Specification for ES_Visualiser

**Quick Reference Guide**

---

## Required Column Structure

| Column | Name | Type | Required | Description |
|--------|------|------|----------|-------------|
| **A** | Source Node | Text | ✅ Yes | Starting node ID |
| **B** | Target Node | Text | ✅ Yes | Ending node ID |
| **C** | Edge Label | Text | ❌ Optional | Text displayed on the edge |
| **D** | Edge Tooltip | Text | ❌ Optional | Text shown when hovering over edge |

---

## Example Data

### Simple Graph
```
| Column A  | Column B  | Column C      | Column D                    |
|-----------|-----------|---------------|-----------------------------|
| Source    | Target    | Label         | Tooltip                     |
| Frontend  | Backend   | API calls     | REST API communication      |
| Backend   | Database  | queries       | PostgreSQL connection       |
| Frontend  | User      | displays to   | User interface presentation |
```

**Result:** 3 edges connecting 4 nodes (Frontend, Backend, Database, User)

### Multi-line Tooltips
```
| Column A | Column B | Column C | Column D                              |
|----------|----------|----------|---------------------------------------|
| Step1    | Step2    | next     | First line\nSecond line\nThird line  |
```

**Note:** Use `\n` for line breaks in tooltips

### Multiple Sheets
```
Sheet 1: "Dependencies"
| A      | B       | C         | D                    |
|--------|---------|-----------|----------------------|
| React  | Vite    | built by  | Build tool           |
| React  | ESLint  | linted by | Code quality checker |

Sheet 2: "Flow"
| A      | B       | C         | D           |
|--------|---------|-----------|-------------|
| Input  | Process | feeds     | Data flow   |
| Process| Output  | produces  | Final result|
```

**Result:** All sheets combined into single graph (4 edges total)

---

## Rules & Behavior

### ✅ Supported
- Multiple sheets (all data combined)
- Empty cells in columns C & D (treated as empty strings)
- Duplicate node IDs (automatically merged)
- Special characters in node IDs
- Multi-line text in tooltips (use `\n`)
- Any row count (within performance limits)

### ❌ Not Supported
- Node styling via Excel (colors, shapes)
- Edge weights or numerical metadata
- Hierarchical relationships beyond parent→child
- Images or embedded objects
- Formulas (only values used)
- More than 4 columns (extra columns ignored)

---

## Header Row

**First row is ALWAYS skipped** (assumed to be header)

✅ Good:
```
| Source | Target | Label | Tooltip |  ← Skipped
| Node1  | Node2  | link  | info    |  ← Processed
```

❌ Problematic:
```
| Node1  | Node2  | link  | info    |  ← Skipped (lost!)
| Node2  | Node3  | next  | more    |  ← First edge processed
```

**Solution:** Always include a header row, even if generic (Source, Target, Label, Tooltip)

---

## Data Validation

### Column Count
- Minimum: 2 columns (A & B only)
- Recommended: 4 columns (A, B, C, D)
- Extra columns: Ignored

### Node IDs (Columns A & B)
- **Type:** Any text
- **Required:** Yes (both columns)
- **Empty cells:** Creates edge to/from empty string ""
- **Duplicates:** OK (nodes merged automatically)
- **Case sensitive:** Yes ("Node1" ≠ "node1")

**Examples:**
- ✅ `"User123"`, `"System_A"`, `"Step-1"`
- ✅ Numbers: `1`, `2`, `3` (converted to strings "1", "2", "3")
- ⚠️ Empty: `""` (creates node with empty label)

### Edge Labels (Column C)
- **Type:** Text
- **Optional:** Yes (can be empty)
- **Display:** Shown on edge
- **Length:** No limit (but affects layout)

### Edge Tooltips (Column D)
- **Type:** Text
- **Optional:** Yes (can be empty)
- **Display:** Shown on hover
- **Multi-line:** Use `\n` for line breaks
- **Length:** No limit

---

## Performance Guidelines

| Row Count | Node Count* | Performance | Recommendation |
|-----------|-------------|-------------|----------------|
| 1-100 | ~50 | ✅ Excellent | Ideal |
| 100-500 | ~250 | ✅ Good | Comfortable |
| 500-2000 | ~1000 | ⚠️ Acceptable | May lag on search |
| 2000-5000 | ~2500 | ⚠️ Slow | Consider splitting |
| 5000+ | ~2500+ | ❌ Poor | Not recommended |

*Approximate - depends on edge density

**File Size Limit:** 5MB (enforced)

---

## Common Issues & Solutions

### Issue 1: Graph is Empty
**Cause:** Header row missing or first data row skipped  
**Solution:** Ensure first row is header, data starts on row 2

### Issue 2: Nodes Not Connected
**Cause:** Node ID mismatch (typos, case sensitivity)  
**Solution:** Verify IDs match exactly:
```
❌ Source: "Node1" → Target: "node1" (NOT connected)
✅ Source: "Node1" → Target: "Node1" (connected)
```

### Issue 3: Tooltip Not Showing
**Cause:** Data in column C instead of column D  
**Solution:** Move tooltip text to column D

### Issue 4: Multi-line Tooltip Not Working
**Cause:** Using actual line breaks instead of `\n`  
**Solution:** Replace line breaks with literal `\n` string:
```
❌ "Line 1
     Line 2"
✅ "Line 1\nLine 2"
```

### Issue 5: Extra Columns Breaking Import
**Cause:** n/a (extra columns are ignored)  
**Solution:** No action needed - columns E+ ignored

---

## Template

**Copy this into Excel to get started:**

```
| Source    | Target    | Label     | Tooltip           |
|-----------|-----------|-----------|-------------------|
| Start     | Process   | begins    | Initial step      |
| Process   | Decision  | evaluates | Check condition   |
| Decision  | End       | yes path  | Success case      |
| Decision  | Start     | no path   | Retry loop        |
```

**Download:** [demo_graph.xlsx](./demo_graph.xlsx) (included in repository)

---

## Advanced Usage

### Self-Loops
```
| A       | B       | C      | D           |
|---------|---------|--------|-------------|
| Node1   | Node1   | loops  | Recursive   |
```
**Result:** Edge from Node1 to itself

### Bidirectional Edges
```
| A       | B       | C      | D              |
|---------|---------|--------|----------------|
| Node1   | Node2   | to     | Forward link   |
| Node2   | Node1   | back   | Reverse link   |
```
**Result:** Two separate edges (one in each direction)

### Multiple Edges Between Same Nodes
```
| A       | B       | C        | D             |
|---------|---------|----------|---------------|
| Node1   | Node2   | type A   | First link    |
| Node1   | Node2   | type B   | Second link   |
```
**Result:** Two edges with different labels

---

## Best Practices

### ✅ DO:
- Use clear, descriptive node IDs
- Include header row
- Keep labels concise (< 20 chars)
- Use tooltips for detailed info
- Test with small dataset first
- Keep graphs under 2000 nodes

### ❌ DON'T:
- Use random/meaningless IDs
- Mix case inconsistently (Node1 vs node1)
- Put long text in labels (use tooltips)
- Include non-data rows (summaries, notes)
- Upload files larger than 5MB
- Expect styling to transfer from Excel

---

## Quick Checklist

Before uploading your Excel file, verify:

- [ ] First row is header
- [ ] Columns A & B have data (node IDs)
- [ ] Node IDs are consistent (case-sensitive)
- [ ] File size < 5MB
- [ ] No more than ~2000 rows (performance)
- [ ] Tooltips use `\n` for line breaks (not actual breaks)
- [ ] Extra columns removed (columns E+)
- [ ] File saved as .xlsx or .xls

---

**Need Help?** See [RESEARCH_ANALYSIS.md](./RESEARCH_ANALYSIS.md) for detailed technical documentation.
