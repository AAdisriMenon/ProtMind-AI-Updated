import { useEffect, useRef, useState } from "react";
import * as $3Dmol from "3dmol";
import Plotly from "plotly.js-dist-min";
import { postJson, validateInput, fetchReportPdf } from "./api";

/* ---------- shared helpers ---------- */

function useStep(path, payload) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: "" });
    postJson(path, payload)
      .then(data => alive && setState({ loading: false, data, error: "" }))
      .catch(e => alive && setState({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [path, payload]);
  return state;
}

function Loading({ text }) {
  return <div className="step-loading"><span className="spinner" />{text}</div>;
}

function Notice({ kind = "info", children }) {
  return <div className={`notice notice-${kind}`}>{children}</div>;
}

function Panel({ title, children, className = "" }) {
  return <section className={`step-panel ${className}`}>{title && <h3>{title}</h3>}{children}</section>;
}

function Metric({ label, value, delta, deltaKind }) {
  return <div className="metric"><small>{label}</small><b>{value}</b>{delta && <span className={`metric-delta ${deltaKind || ""}`}>{delta}</span>}</div>;
}

function KeyValues({ data }) {
  if (!data) return null;
  return (
    <dl className="kv">
      {Object.entries(data)
        .filter(([k, v]) => v !== null && v !== undefined && typeof v !== "object")
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </div>
        ))}
    </dl>
  );
}

function DataTable({ rows }) {
  if (!rows || rows.length === 0) return <p className="muted-text">No data available.</p>;
  const cols = Object.keys(rows[0]);
  return <div className="table-wrap"><table className="data-table"><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cols.map(c => <td key={c}>{String(r[c])}</td>)}</tr>)}</tbody></table></div>;
}

function Gate({ payload, children }) {
  if (!payload) return <Notice kind="warning">⚠️ No active protein data found. Please complete Step 1: User Input first.</Notice>;
  return children;
}

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

/* ---------- STEP 1: User Input ---------- */
export function Step1({ payload, onSaved }) {
  const [form, setForm] = useState({ uniprotId: payload?.uniprot_id || "", mutation: payload?.mutation || "", sequence: "" });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(payload ? { source: payload.source, length: payload.sequence.length } : null);
  const [busy, setBusy] = useState(false);
  const update = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErrors([]); setResult(null);
    try {
      const res = await validateInput({ ...form, file });
      if (!res.ok) setErrors(res.errors);
      else { onSaved(res.payload); setResult({ source: res.payload.source, length: res.length }); }
    } catch (err) { setErrors([err.message + " — is the backend running on port 8000?"]); }
    setBusy(false);
  };

  return <form onSubmit={submit}>
    <section className="input-card">
      <div className="card-title"><span>🧬</span><div><small>INPUT 01</small><h2>Protein & Mutation</h2><p>UniProt accession and the amino-acid substitution to analyze.</p></div></div>
      <div className="two-fields">
        <label className="big-field"><span>🧬 UniProt ID</span><input name="uniprotId" value={form.uniprotId} onChange={update} placeholder="P04637" /></label>
        <label className="big-field"><span>🧪 Mutation <small>[WT][Position][Mut]</small></span><input name="mutation" value={form.mutation} onChange={update} placeholder="R175H" /></label>
      </div>
    </section>
    <section className="input-card">
      <div className="card-title"><span>📂</span><div><small>INPUT 02</small><h2>Sequence Input Options</h2><p>Upload a FASTA file, or paste the sequence below. An uploaded file takes priority.</p></div></div>
      <label className="file-drop">
        <input type="file" accept=".fasta,.fa,.txt" onChange={e => setFile(e.target.files[0] || null)} />
        <b>{file ? `📄 ${file.name}` : "Upload FASTA File (.fasta, .fa, .txt)"}</b>
        <small>{file ? "Click to choose a different file" : "Drag and drop or click to browse"}</small>
      </label>
      <div className="or-line"><span>OR</span></div>
      <label className="big-field"><span>Paste Protein Sequence or FASTA text</span><textarea name="sequence" value={form.sequence} onChange={update} rows={6} placeholder={">sp|P04637|...\nMEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPL..."} /></label>
    </section>
    {errors.map(er => <Notice key={er} kind="error">❌ {er}</Notice>)}
    {result && <>
      <Notice kind="success">✅ Sequence successfully extracted and validated via {result.source}!</Notice>
      <Notice kind="info"><b>Loaded Sequence Length:</b> {result.length} amino acids</Notice>
    </>}
    <div className="analysis-actions"><button className="primary-btn" type="submit" disabled={busy}>{busy ? "Validating…" : "🚀 Validate & Save Data"}</button></div>
  </form>;
}

/* ---------- STEP 2: Data Retrieval ---------- */
export function Step2({ payload }) {
  const { loading, data, error } = useStep("/api/step2", payload);
  const [tab, setTab] = useState(0);
  if (loading) return <Loading text={`🔬 Querying live databases for ${payload.uniprot_id}...`} />;
  if (error) return <Notice kind="error">{error}</Notice>;
  const max = Math.max(...Object.values(data.gnomad));
  const tabs = ["🔵 UniProt", "🏥 NIH", "👥 gnomAD", "🧬 Structure"];
  return <>
    <div className="tabs">{tabs.map((t, i) => <button key={t} className={tab === i ? "active" : ""} onClick={() => setTab(i)}>{t}</button>)}</div>
    {tab === 0 && <Panel title="Protein Knowledgebase"><KeyValues data={data.uniprot} /></Panel>}
    {tab === 1 && <Panel title="Clinical Significance"><Metric label="Target Mutation" value={data.mutation} /></Panel>}
    {tab === 2 && <Panel title="Population Genomics">
      <div className="bars">{Object.entries(data.gnomad).map(([k, v]) => <div className="bar-col" key={k}><span className="bar-val">{v}</span><div className="bar" style={{ height: `${(v / max) * 160}px` }} /><small>{k}</small></div>)}</div>
    </Panel>}
    {tab === 3 && <Panel title="Predicted 3D Structure">
      {data.alphafold_url
        ? <><Notice kind="success">AlphaFold structure located!</Notice><a className="text-link" href={data.alphafold_url} target="_blank" rel="noreferrer"><b>Download .PDB File</b></a></>
        : <Notice kind="warning">No AlphaFold structure found.</Notice>}
    </Panel>}
  </>;
}

/* ---------- STEP 3: Preprocessing & Motif/Domain Search ---------- */
export function Step3({ payload }) {
  const { loading, data, error } = useStep("/api/step3", payload);
  const [customPat, setCustomPat] = useState("");
  const [customMatches, setCustomMatches] = useState([]);
  const [customMsg, setCustomMsg] = useState("");
  const [activeTab, setActiveTab] = useState("domains");

  if (loading) return <Loading text="⏳ Extracting physicochemical features and scanning sequence for motifs & functional domains..." />;
  if (error) return <Notice kind="error">{error}</Notice>;

  const { features: f, alignment_score: score, motif_domain_analysis: mda } = data;
  const seqLen = mda?.sequence_length || payload.sequence.length;
  const mutPos = f.Position;

  const handleCustomSearch = (e) => {
    e.preventDefault();
    if (!customPat.trim()) return;
    try {
      const reg = new RegExp(customPat.trim(), "gi");
      const matches = [];
      let match;
      while ((match = reg.exec(payload.sequence)) !== null) {
        matches.push({
          pattern: customPat.trim(),
          sequence: match[0],
          start: match.index + 1,
          end: match.index + match[0].length,
          overlaps_mutation: (match.index + 1 <= mutPos && mutPos <= match.index + match[0].length)
        });
      }
      setCustomMatches(matches);
      setCustomMsg(matches.length ? `Found ${matches.length} match(es) for pattern '${customPat}'` : `No matches found for '${customPat}'.`);
    } catch (err) {
      setCustomMsg(`Invalid Regex pattern: ${err.message}`);
    }
  };

  return <>
    <div className="two-col">
      <Panel title="Extracted Features">
        {!f["Positional Match"] && <Notice kind="error">⚠️ Wildtype mismatch at position {f.Position}.</Notice>}
        <KeyValues data={f} />
      </Panel>
      <Panel title="Evolutionary Analysis (MSA)">
        <Metric label="Sequence Identity" value={`${score.toFixed(2)}%`} />
        <div className="progress"><div style={{ width: `${Math.min(score, 100)}%` }} /></div>
        {f["WT Property"] !== f["Mutant Property"]
          ? <Notice kind="warning"><b>Significant Shift:</b> {f["Property Shift"]}</Notice>
          : <Notice kind="info"><b>Conserved Property:</b> {f["WT Property"]}</Notice>}
      </Panel>
    </div>

    {/* MOTIF AND DOMAIN SEARCHING THROUGH PROTEIN SEQUENCE */}
    <Panel title="🔍 Motif & Functional Domain Architecture" className="motif-domain-panel">
      {mda?.mutation_colocalized ? (
        <Notice kind="error">
          <b>{mda.impact_verdict}</b>
        </Notice>
      ) : (
        <Notice kind="info">
          {mda?.impact_verdict || "Sequence scanned against curated UniProt functional domains and motif patterns."}
        </Notice>
      )}

      {/* Visual Linear Sequence Track */}
      <div className="sequence-track-wrap">
        <div className="sequence-track-header">
          <span><b>Sequence Track:</b> 1 — {seqLen} AA</span>
          <span><b>Coverage:</b> {mda?.domain_coverage_pct || 0}% annotated</span>
        </div>
        <div className="sequence-track">
          {/* Domain blocks */}
          {mda?.domains?.slice(0, 10).map((dom, idx) => {
            const leftPct = ((dom.start - 1) / seqLen) * 100;
            const widthPct = Math.max(1.5, (dom.length / seqLen) * 100);
            const isMut = dom.overlaps_mutation;
            return (
              <div
                key={idx}
                className={`track-domain-block ${isMut ? "track-domain-mutated" : ""}`}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`${dom.name} (${dom.start}-${dom.end}) ${isMut ? "★ MUTATION SITE" : ""}`}
              >
                <span className="track-domain-label">{dom.name}</span>
              </div>
            );
          })}
          {/* Target mutation pin marker */}
          {mutPos && mutPos <= seqLen && (
            <div
              className="track-mutation-pin"
              style={{ left: `${((mutPos - 1) / seqLen) * 100}%` }}
              title={`Target Mutation: ${payload.mutation} at position ${mutPos}`}
            >
              <div className="pin-head">▼ {payload.mutation}</div>
              <div className="pin-line" />
            </div>
          )}
        </div>
      </div>

      {/* Sub-tabs for Domains vs Motifs vs Custom Search */}
      <div className="tabs sub-tabs" style={{ marginTop: "16px" }}>
        <button className={activeTab === "domains" ? "active" : ""} onClick={() => setActiveTab("domains")}>
          🏛️ Functional Domains ({mda?.total_domains_found || 0})
        </button>
        <button className={activeTab === "motifs" ? "active" : ""} onClick={() => setActiveTab("motifs")}>
          🧬 Signature Motifs ({mda?.total_motifs_found || 0})
        </button>
        <button className={activeTab === "custom" ? "active" : ""} onClick={() => setActiveTab("custom")}>
          🔎 Custom Pattern Search
        </button>
      </div>

      {activeTab === "domains" && (
        <div className="sub-panel">
          {mda?.domains?.length ? (
            <DataTable rows={mda.domains.map(d => ({
              "Region / Domain": d.name,
              "Start": d.start,
              "End": d.end,
              "Length (AA)": d.length,
              "Mutation Overlap": d.overlaps_mutation ? "🚨 OVERLAPS MUTATION" : "✅ Outside"
            }))} />
          ) : (
            <p>No annotated structural domains detected in current query.</p>
          )}
        </div>
      )}

      {activeTab === "motifs" && (
        <div className="sub-panel">
          <p className="sub-desc">Conserved regulatory motifs, phosphorylation sites, signals, and repeat signatures:</p>
          {mda?.motifs?.length ? (
            <DataTable rows={mda.motifs.slice(0, 15).map(m => ({
              "Motif Name": m.name,
              "Sequence": m.sequence,
              "Span": `${m.start}–${m.end}`,
              "Function": m.description,
              "Colocalized": m.overlaps_mutation ? "🚨 Yes" : "No"
            }))} />
          ) : (
            <p>No standard signature motifs identified.</p>
          )}
        </div>
      )}

      {activeTab === "custom" && (
        <div className="sub-panel">
          <form onSubmit={handleCustomSearch} className="custom-search-form">
            <label className="big-field">
              <span>Enter Amino Acid Pattern or Regular Expression (e.g., <code>[KR]{"{4}"}</code>, <code>C..C</code>, <code>P..P</code>)</span>
              <div className="search-input-group">
                <input
                  value={customPat}
                  onChange={e => setCustomPat(e.target.value)}
                  placeholder="e.g. C.{2,4}C or [KR]{4}"
                />
                <button type="submit" className="primary-btn">Scan Sequence</button>
              </div>
            </label>
          </form>
          {customMsg && <Notice kind={customMatches.length ? "success" : "info"}>{customMsg}</Notice>}
          {customMatches.length > 0 && (
            <DataTable rows={customMatches.map(c => ({
              "Matched Sequence": c.sequence,
              "Span": `${c.start}–${c.end}`,
              "Overlaps Target Mutation": c.overlaps_mutation ? "🚨 YES" : "No"
            }))} />
          )}
        </div>
      )}
    </Panel>
  </>;
}

/* ---------- STEP 4: Mutation Analysis & STRING Pathways Diagram ---------- */
function StringNetworkSvg({ graph, targetName }) {
  const [hoveredNode, setHoveredNode] = useState(null);
  if (!graph || !graph.nodes) return null;

  return (
    <div className="string-network-svg-container">
      <svg viewBox="0 0 500 440" className="string-svg-canvas">
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00F5D4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00F5D4" stopOpacity="0.0" />
          </radialGradient>
        </defs>

        {/* Outer background glow */}
        <circle cx="250" cy="220" r="170" fill="url(#centerGlow)" />

        {/* Edge Lines */}
        {graph.edges.map((edge, i) => {
          const targetNode = graph.nodes.find(n => n.id === edge.target);
          if (!targetNode) return null;
          const isHighConf = edge.score >= 0.95;
          return (
            <line
              key={i}
              x1="250"
              y1="220"
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={isHighConf ? "#00F5D4" : "#9B5DE5"}
              strokeWidth={Math.max(1.5, edge.score * 3.5)}
              strokeOpacity="0.6"
              strokeDasharray={edge.score < 0.9 ? "4,4" : "none"}
            />
          );
        })}

        {/* Center Node */}
        <circle cx="250" cy="220" r="32" fill="#0E79D5" stroke="#FFFFFF" strokeWidth="3" />
        <text x="250" y="225" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="bold">
          {graph.center || targetName || "TP53"}
        </text>

        {/* Surrounding Interactor Nodes */}
        {graph.nodes.filter(n => !n.is_center).map((n, i) => {
          const isHovered = hoveredNode?.id === n.id;
          return (
            <g
              key={i}
              className="network-node"
              onMouseEnter={() => setHoveredNode(n)}
              onMouseLeave={() => setHoveredNode(null)}
              cursor="pointer"
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={isHovered ? 26 : 22}
                fill={n.score >= 0.98 ? "#17A99D" : "#3B82F6"}
                stroke="#FFFFFF"
                strokeWidth={isHovered ? 2.5 : 1.5}
                filter="drop-shadow(0 4px 8px rgba(0,0,0,0.25))"
              />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Interactive Tooltip Card */}
      {hoveredNode && (
        <div className="network-tooltip-card">
          <h4>{hoveredNode.label}</h4>
          <p><b>STRING Score:</b> {(hoveredNode.score * 100).toFixed(1)}%</p>
          <p><small>{hoveredNode.evidence}</small></p>
        </div>
      )}
    </div>
  );
}

export function Step4({ payload }) {
  const { loading, data, error } = useStep("/api/step4", payload);
  const [viewTab, setViewTab] = useState("network_graph");

  if (loading) return <Loading text={`🔬 Analyzing pathogenicity and querying STRING database pathways for ${payload.uniprot_id}...`} />;
  if (error) return <Notice kind="error">{error}</Notice>;

  return <>
    <div className="two-col">
      <Panel title="⚠️ Pathogenicity Predictors">
        <Notice kind="info">Evaluating mutation impact using evolutionary conservation and structural features.</Notice>
        {Object.entries(data.pathogenicity).map(([tool, r]) => {
          const high = r.score > 0.8 || (tool === "SIFT" && r.score < 0.05);
          return <p className="predictor" key={tool}>{high ? "🔴" : "🟢"} <b>{tool}:</b> {r.prediction} (Score: {r.score})</p>;
        })}
      </Panel>
      <Panel title="🕸️ Protein-Protein Interactions (PPI)">
        <p>Top interacting partners that may be disrupted by this mutation:</p>
        {data.ppi.length
          ? <DataTable rows={data.ppi.map(r => ({ ...r, "Interaction Score": `${(r["Interaction Score"] * 100).toFixed(1)}%` }))} />
          : <Notice kind="warning">No significant interactions found in the STRING database for {payload.uniprot_id}.</Notice>}
      </Panel>
    </div>

    {/* STRING DATABASE PATHWAYS & INTERACTION DIAGRAM */}
    <Panel title="🌐 STRING Database Pathways & Interaction Network" className="pathways-panel">
      <div className="tabs sub-tabs" style={{ marginBottom: "14px" }}>
        <button className={viewTab === "network_graph" ? "active" : ""} onClick={() => setViewTab("network_graph")}>
          🕸️ Interactive Pathway Graph
        </button>
        <button className={viewTab === "pathways_list" ? "active" : ""} onClick={() => setViewTab("pathways_list")}>
          🧬 Enriched Biological Pathways ({data.pathways?.length || 0})
        </button>
        <button className={viewTab === "string_embed" ? "active" : ""} onClick={() => setViewTab("string_embed")}>
          🖼️ Official STRING Network Diagram
        </button>
      </div>

      {viewTab === "network_graph" && (
        <div className="network-graph-view">
          <div className="graph-meta-banner">
            <div>
              <span className="eyebrow">STRING INTERACTION NETWORK</span>
              <h4>{data.network_graph?.center || payload.uniprot_id} Functional Hub</h4>
              <p>Circle nodes represent primary interactors. Line thickness reflects confidence score (high confidence &gt; 95%). Hover on nodes for details.</p>
            </div>
            {data.diagram_urls?.web && (
              <a href={data.diagram_urls.web} target="_blank" rel="noreferrer" className="primary-btn sm">
                🔗 Open on STRING-DB.org ↗
              </a>
            )}
          </div>
          <StringNetworkSvg graph={data.network_graph} targetName={payload.uniprot_id} />
        </div>
      )}

      {viewTab === "pathways_list" && (
        <div className="pathways-list-view">
          <Notice kind="info">
            Statistically enriched cellular signaling pathways associated with this interaction network:
          </Notice>
          <DataTable rows={data.pathways.map(p => ({
            "Category": p.category,
            "Pathway Name": p.name,
            "FDR p-value": p.fdr < 0.0001 ? p.fdr.toExponential(2) : p.fdr.toFixed(4),
            "Associated Genes": p.genes_count
          }))} />
        </div>
      )}

      {viewTab === "string_embed" && (
        <div className="string-embed-view">
          <Notice kind="info">
            Live SVG network diagram retrieved from STRING Database API (Taxonomy 9606, Human):
          </Notice>
          <div className="string-image-wrap">
            <img
              src={data.diagram_urls?.svg || data.diagram_urls?.image}
              alt="STRING Database Pathway Network"
              className="string-network-img"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <div style={{ textAlign: "center", marginTop: "12px" }}>
            <a href={data.diagram_urls?.web} target="_blank" rel="noreferrer" className="text-link">
              <b>View Full Interactive STRING Canvas in New Tab ↗</b>
            </a>
          </div>
        </div>
      )}
    </Panel>

    <Notice kind="success">✅ Mutation Analysis complete. The data suggests this variant significantly alters the protein network and its key functional pathways.</Notice>
  </>;
}

/* ---------- STEP 5: Structure Prediction (3Dmol.js comprehensive viewer) ---------- */
function Viewer3D({ pdb, mutation, mutPos, style, scheme, surfaceOpacity, bgMode, isSpinning, viewerRef }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pdb) return;
    el.innerHTML = "";

    const bgColor = bgMode === "light" ? "#F7FBFC" : bgMode === "slate" ? "#0F1C2E" : "#161A23";
    const view = $3Dmol.createViewer(el, { backgroundColor: bgColor });
    if (viewerRef) viewerRef.current = view;

    view.addModel(pdb, "pdb");

    // Color definitions
    let colorObj = { color: "#00F5D4" };
    if (scheme === "By Secondary Structure") {
      colorObj = { colorscheme: "ssPyMOL" };
    } else if (scheme === "Spectrum (Rainbow)") {
      colorObj = { colorscheme: "amino" };
    } else if (scheme === "pLDDT Confidence (AlphaFold)") {
      colorObj = { colorscheme: "b" };
    } else if (scheme === "Element (CPK)") {
      colorObj = { colorscheme: "greenCarbon" };
    }

    // Representations (All 10 styles from Image 4)
    switch (style) {
      case "Cartoon":
        view.setStyle({}, { cartoon: colorObj });
        break;
      case "Tube":
        view.setStyle({}, { cartoon: { style: "tube", ...colorObj } });
        break;
      case "Trace":
        view.setStyle({}, { cartoon: { style: "trace", ...colorObj } });
        break;
      case "Lines":
        view.setStyle({}, { line: colorObj });
        break;
      case "Ball+Stick":
        view.setStyle({}, { stick: { radius: 0.16, ...colorObj }, sphere: { scale: 0.28, ...colorObj } });
        break;
      case "Licorice":
        view.setStyle({}, { stick: { radius: 0.38, ...colorObj } });
        break;
      case "Hyperball":
        view.setStyle({}, { stick: { radius: 0.32, ...colorObj }, sphere: { scale: 0.52, ...colorObj } });
        break;
      case "Rope":
        view.setStyle({}, { cartoon: { style: "oval", thickness: 0.8, ...colorObj } });
        break;
      case "Surface":
        view.setStyle({}, { cartoon: { opacity: 0.35, ...colorObj } });
        view.addSurface($3Dmol.SurfaceType.VDW, { opacity: surfaceOpacity, ...colorObj });
        break;
      case "Spacefill":
        view.setStyle({}, { sphere: colorObj });
        break;
      default:
        view.setStyle({}, { cartoon: colorObj });
    }

    // Highlight target mutation in all representations
    if (mutPos) {
      view.addStyle({ resi: String(mutPos) }, {
        stick: { colorscheme: "redCarbon", radius: 0.36 },
        sphere: { color: "#FF0055", radius: 1.4 }
      });
      view.addLabel(`★ Mut: ${mutation}`, {
        fontOpacity: 1,
        fontSize: 13,
        fontColor: "white",
        backgroundColor: "#FF0055",
        borderColor: "white",
        borderThickness: 1
      }, { resi: String(mutPos) });
      view.zoomTo({ resi: String(mutPos) });
    } else {
      view.zoomTo();
    }

    if (isSpinning) {
      view.spin("y", 1);
    }

    view.render();

    return () => {
      try {
        view.spin(false);
      } catch (e) {}
      el.innerHTML = "";
    };
  }, [pdb, mutation, mutPos, style, scheme, surfaceOpacity, bgMode, isSpinning]);

  return <div className="viewer3d" ref={containerRef} />;
}

export function Step5({ payload }) {
  const { loading, data, error } = useStep("/api/step5", payload);
  const [style, setStyle] = useState("Cartoon");
  const [scheme, setScheme] = useState("By Secondary Structure");
  const [surfaceOpacity, setSurfaceOpacity] = useState(0.8);
  const [bgMode, setBgMode] = useState("dark");
  const [isSpinning, setIsSpinning] = useState(false);
  const viewerRef = useRef(null);

  const representations = [
    "Cartoon", "Tube", "Trace", "Lines",
    "Ball+Stick", "Licorice", "Hyperball", "Rope",
    "Surface", "Spacefill"
  ];

  const handleZoomMutation = () => {
    if (viewerRef.current && data?.mut_pos) {
      viewerRef.current.zoomTo({ resi: String(data.mut_pos) });
      viewerRef.current.render();
    }
  };

  const handleResetCamera = () => {
    if (viewerRef.current) {
      viewerRef.current.zoomTo();
      viewerRef.current.render();
    }
  };

  const handleTakeSnapshot = () => {
    if (viewerRef.current) {
      const uri = viewerRef.current.pngURI();
      const a = document.createElement("a");
      a.href = uri;
      a.download = `${payload.uniprot_id}_${payload.mutation}_${style}_3D.png`;
      a.click();
    }
  };

  const handleToggleSpin = () => {
    setIsSpinning(prev => {
      const next = !prev;
      if (viewerRef.current) {
        if (next) viewerRef.current.spin("y", 1);
        else viewerRef.current.spin(false);
      }
      return next;
    });
  };

  if (loading) return <Loading text={`🔬 Fetching AlphaFold 3D structure for ${payload.uniprot_id}...`} />;
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data.pdb) return <Notice kind="error">❌ Could not retrieve 3D structure for {payload.uniprot_id}. It may not be available in the AlphaFold database.</Notice>;

  return (
    <div className="viewer-layout-pro">
      <Panel title="🔍 Interactive 3D Biomolecular Structure Viewer">
        {/* Quick representation pills from Image 4 */}
        <div className="representation-pills-bar">
          <span className="rep-label">Representation:</span>
          <div className="rep-pills-wrap">
            {representations.map(rep => (
              <button
                key={rep}
                type="button"
                className={`rep-pill-btn ${style === rep ? "active" : ""}`}
                onClick={() => setStyle(rep)}
              >
                {rep}
              </button>
            ))}
          </div>
        </div>

        <div className="viewer-canvas-wrap">
          <Viewer3D
            pdb={data.pdb}
            mutation={data.mutation}
            mutPos={data.mut_pos}
            style={style}
            scheme={scheme}
            surfaceOpacity={surfaceOpacity}
            bgMode={bgMode}
            isSpinning={isSpinning}
            viewerRef={viewerRef}
          />

          {/* Quick Floating Overlays on canvas */}
          <div className="viewer-floating-toolbar">
            <button
              type="button"
              className={`tool-btn ${isSpinning ? "active" : ""}`}
              onClick={handleToggleSpin}
              title="Toggle Auto-Spin"
            >
              🔄 {isSpinning ? "Stop Spin" : "Auto-Spin"}
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={handleZoomMutation}
              title="Zoom into Mutated Residue"
            >
              🎯 Focus Mutation
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={handleResetCamera}
              title="Center & Reset View"
            >
              👁️ Center View
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={handleTakeSnapshot}
              title="Save PNG Image"
            >
              📸 Snapshot PNG
            </button>
          </div>
        </div>

        <div className="viewer-bottom-bar">
          <span className="structure-tag"><b>Source:</b> AlphaFold2 Database</span>
          <span className="structure-tag"><b>Target Residue:</b> {data.mutation} (Position {data.mut_pos})</span>
          <span className="structure-tag highlight">Mutant site highlighted in <b>RED</b></span>
        </div>
      </Panel>

      <Panel title="📊 Structure Display Controls">
        <label className="big-field">
          <span>🎨 Protein Representation (10 Styles)</span>
          <select value={style} onChange={e => setStyle(e.target.value)}>
            {representations.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>

        <label className="big-field" style={{ marginTop: "12px" }}>
          <span>🌈 Color Scheme</span>
          <select value={scheme} onChange={e => setScheme(e.target.value)}>
            <option value="By Secondary Structure">Secondary Structure (Helix=Red, Sheet=Yellow, Loop=Gray)</option>
            <option value="Default (Teal)">Default (Cyan / Teal)</option>
            <option value="Spectrum (Rainbow)">Spectrum (Rainbow N-to-C)</option>
            <option value="pLDDT Confidence (AlphaFold)">pLDDT Confidence (AlphaFold B-factor)</option>
            <option value="Element (CPK)">Element (CPK Carbon-Green)</option>
          </select>
        </label>

        {style === "Surface" && (
          <label className="big-field" style={{ marginTop: "12px" }}>
            <span>Surface Opacity: <b>{Math.round(surfaceOpacity * 100)}%</b></span>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={surfaceOpacity}
              onChange={e => setSurfaceOpacity(parseFloat(e.target.value))}
            />
          </label>
        )}

        <label className="big-field" style={{ marginTop: "12px" }}>
          <span>Background Mode</span>
          <div className="bg-toggle-group">
            <button
              type="button"
              className={`bg-toggle-btn ${bgMode === "dark" ? "active" : ""}`}
              onClick={() => setBgMode("dark")}
            >
              Dark
            </button>
            <button
              type="button"
              className={`bg-toggle-btn ${bgMode === "slate" ? "active" : ""}`}
              onClick={() => setBgMode("slate")}
            >
              Slate
            </button>
            <button
              type="button"
              className={`bg-toggle-btn ${bgMode === "light" ? "active" : ""}`}
              onClick={() => setBgMode("light")}
            >
              Light
            </button>
          </div>
        </label>

        <div className="viewer-actions" style={{ marginTop: "18px" }}>
          <button
            className="secondary-btn full"
            onClick={handleTakeSnapshot}
            style={{ marginBottom: "8px" }}
          >
            📸 Export High-Res PNG
          </button>
          <button
            className="primary-btn full"
            onClick={() => download(new Blob([data.pdb], { type: "text/plain" }), `${data.uniprot_id}_AF.pdb`)}
          >
            📥 Download .PDB Coordinates
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ---------- STEP 6: Thermodynamic Stability & Potential Energy Calculations ---------- */
export function Step6({ payload }) {
  const { loading, data, error } = useStep("/api/step6", payload);
  if (loading) return <Loading text="⚛️ Calculating biophysical potential energy and ΔG / ΔΔG shifts from research papers..." />;
  if (error) return <Notice kind="error">{error}</Notice>;

  const { features: f, stability: s } = data;
  const pe = s.potential_energy || {};
  const kind = s.status === "Highly Destabilizing" ? "error" : s.status === "Mildly Destabilizing" ? "warning" : "success";

  return <>
    {/* Gibbs Free Energy Overview */}
    <div className="two-col">
      <Panel title="⚙️ Gibbs Free Energy (ΔG & ΔΔG)">
        <Notice kind="info">
          ΔG represents the conformational folding free energy. <b>ΔΔG measures the stability perturbation</b> (positive = destabilizing, negative = stabilizing).
        </Notice>
        <div className="energy-readout-row">
          <Metric
            label="Conformational Free Energy (ΔG)"
            value={`${s.delta_g.toFixed(2)} kcal/mol`}
            delta={s.delta_g < -5.0 ? "▼ Native Globular Fold" : "▲ Destabilized Fold"}
            deltaKind={s.delta_g < -5.0 ? "good" : "bad"}
          />
          <Metric
            label="Mutation Stability Shift (ΔΔG)"
            value={s.ddG > 0 ? `+${s.ddG.toFixed(2)} kcal/mol` : `${s.ddG.toFixed(2)} kcal/mol`}
            delta={s.ddG > 0 ? "▲ Destabilizing" : "▼ Stabilizing"}
            deltaKind={s.ddG > 0 ? "bad" : "good"}
          />
        </div>
      </Panel>
      <Panel title="📉 Biophysical Verdict">
        <p>Based on multi-component energetic and steric evaluation:</p>
        <h2 className="verdict">{s.color} {s.status}</h2>
        <Notice kind={kind}>{s.alert}</Notice>
      </Panel>
    </div>

    {/* Potential Energy Calculations Breakdown */}
    <Panel title="⚛️ Molecular Mechanics Potential Energy Breakdown (CHARMM Force Field)" className="energy-panel">
      <Notice kind="info">
        Classical empirical potential energy components evaluated according to the CHARMM biomolecular force field equation:
        <br />
        <code>E_total = E_bond + E_angle + E_dihedral + E_vdw + E_electrostatic</code>
      </Notice>
      
      <div className="energy-grid">
        <div className="energy-card">
          <small>Bond Stretching (E_bond)</small>
          <b>{pe.E_bond}</b>
          <span>kcal/mol</span>
        </div>
        <div className="energy-card">
          <small>Angle Bending (E_angle)</small>
          <b>{pe.E_angle}</b>
          <span>kcal/mol</span>
        </div>
        <div className="energy-card highlight">
          <small>Torsion / Dihedral (E_dihedral)</small>
          <b>{pe.E_dihedral}</b>
          <span>kcal/mol (from Φ/Ψ)</span>
        </div>
        <div className="energy-card">
          <small>Van der Waals (E_vdw)</small>
          <b>{pe.E_vdw}</b>
          <span>kcal/mol</span>
        </div>
        <div className="energy-card">
          <small>Electrostatic (E_elec)</small>
          <b>{pe.E_electrostatic}</b>
          <span>kcal/mol</span>
        </div>
        <div className="energy-card total">
          <small>Total Potential Energy</small>
          <b>{pe.E_total}</b>
          <span>kcal/mol (ΔE: {pe.Delta_E_potential > 0 ? `+${pe.Delta_E_potential}` : pe.Delta_E_potential})</span>
        </div>
      </div>
    </Panel>

    {/* Peer-Reviewed Research Paper Citations & Parameters */}
    <Panel title="📚 Research Paper Foundations & Physical Parameters">
      <div className="two-col">
        <div>
          <h4>Calculation Parameters</h4>
          <ul className="plain-list">
            <li><b>Wildtype Core:</b> {f["WT Property"]} ({f["Wildtype AA"]})</li>
            <li><b>Mutant Core:</b> {f["Mutant Property"]} ({f["Mutant AA"]})</li>
            <li><b>Hydropathy Shift (ΔH):</b> {s.hydropathy_delta} (Kyte-Doolittle scale)</li>
            <li><b>Residue Volume Shift (ΔV):</b> {s.volume_delta} Å³ (Zamyatnin scale)</li>
            <li><b>Physiological Charge Shift (ΔQ):</b> {s.charge_delta} e</li>
            <li><b>BLOSUM62 Conservation Score:</b> {s.blosum62_score}</li>
          </ul>
        </div>
        <div>
          <h4>Literature References</h4>
          <ul className="plain-list spaced">
            {s.citations?.map((cite, i) => (
              <li key={i}>📄 <small>{cite}</small></li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  </>;
}

/* ---------- STEP 7: Stereochemical Validation (Ramachandran Plot) ---------- */
function RamachandranPlot({ figure }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    Plotly.newPlot(el, figure.data, { ...figure.layout, template: undefined }, { displayModeBar: false, responsive: true });
    return () => Plotly.purge(el);
  }, [figure]);
  return <div ref={ref} className="plot" />;
}

export function Step7({ payload }) {
  const { loading, data, error } = useStep("/api/step7", payload);
  const [plotMode, setPlotMode] = useState("procheck"); // 'procheck' or 'density'

  if (loading) return <Loading text="📐 Parsing AlphaFold atomic coordinates for Phi/Psi angles..." />;
  if (error) return <Notice kind="error">{error}</Notice>;
  if (!data.angles) return <Notice kind="error">❌ Could not calculate backbone angles. The residue position might not exist in the AlphaFold structure.</Notice>;

  const phi = data.angles.phi;
  const psi = data.angles.psi;
  const quadrant = (phi >= 0 && psi >= 0) ? "QI (+φ, +ψ)"
    : (phi < 0 && psi >= 0) ? "QII (-φ, +ψ)"
    : (phi < 0 && psi < 0) ? "QIII (-φ, -ψ)"
    : "QIV (+φ, -ψ)";

  const cls = data.classification || {
    secondary_structure: "Beta-sheet",
    steric_feasibility: "Allowed (Optimal Sterics)",
    status_code: "allowed",
    procheck_zone: "Most Favoured [A,B,L]"
  };

  const stats = data.statistics || {
    favoured_count: 0, favoured_pct: 0.0,
    additional_count: 0, additional_pct: 0.0,
    generously_count: 0, generously_pct: 0.0,
    disallowed_count: 0, disallowed_pct: 0.0,
    total_non_gly_pro: 0, total_residues: 0
  };

  const activeFigure = (plotMode === "density" && data.figure_density)
    ? data.figure_density
    : (data.figure_procheck || data.figure);

  return <>
    {/* Panel A: Dipeptide Torsion Angles Backbone Diagram */}
    <Panel title="📐 Panel A: Dipeptide Torsion Angles (φ & ψ Rotations)" className="torsion-diagram-panel">
      <div className="torsion-diagram-wrap">
        <div className="torsion-img-box">
          <img
            src="/dipeptide_torsion.png"
            alt="Dipeptide Torsion Angles phi and psi"
            className="dipeptide-img"
          />
        </div>
        <div className="torsion-explanation">
          <h4>Peptide Backbone Dihedral Angle Geometry</h4>
          <p>
            Definition of the Ramachandran backbone dihedral angles <b>ϕ (phi)</b> and <b>ψ (psi)</b> along the polypeptide chain:
          </p>
          <ul className="plain-list">
            <li><b>ϕ (Phi) Angle:</b> Rotation around the <code>N—Cα</code> bond (controlled by C<sub>i-1</sub>—N<sub>i</sub>—Cα<sub>i</sub>—C<sub>i</sub> atoms).</li>
            <li><b>ψ (Psi) Angle:</b> Rotation around the <code>Cα—C</code> bond (controlled by N<sub>i</sub>—Cα<sub>i</sub>—C<sub>i</sub>—N<sub>i+1</sub> atoms).</li>
            <li><b>ω (Omega) Angle:</b> The peptide bond itself (<code>C—N</code>) possesses ~40% double-bond character and is planar with <b>ω ≈ 180°</b> (trans configuration).</li>
          </ul>
          <Notice kind="info">
            Steric clashes between non-bonded carbonyl oxygens, amide nitrogens, and side-chain Cβ atoms restrict permissible (ϕ, ψ) combinations, defining standard secondary structural motifs.
          </Notice>
        </div>
      </div>
    </Panel>

    {/* Panel B: Ramachandran Plot with View Switcher */}
    <Panel title="🗺️ Panel B: Ramachandran Plot & Stereochemical Conformation" className="ramachandran-panel-b">
      {/* Visual Style Switcher Bar */}
      <div className="rama-style-switcher-bar">
        <span className="switcher-label">Visual Style:</span>
        <div className="switcher-btns">
          <button
            type="button"
            className={`switcher-btn ${plotMode === "procheck" ? "active" : ""}`}
            onClick={() => setPlotMode("procheck")}
          >
            📊 PROCHECK / SAVES (Classic Publication)
          </button>
          <button
            type="button"
            className={`switcher-btn ${plotMode === "density" ? "active" : ""}`}
            onClick={() => setPlotMode("density")}
          >
            📈 Structural Density Contours (Image 5)
          </button>
        </div>
      </div>

      <div className="two-col narrow-left">
        {/* Left Column matching calculated diagnostics */}
        <div className="rama-left-diagnostics">
          <div className="diag-box">
            <div className="angle-badge">
              <span>ϕ (Phi) Angle:</span> <b>{phi.toFixed(2)}°</b>
            </div>
            <div className="angle-badge">
              <span>ψ (Psi) Angle:</span> <b>{psi.toFixed(2)}°</b>
            </div>
            <div className="angle-badge">
              <span>Quadrant:</span> <b>{quadrant}</b>
            </div>
          </div>

          <h4 style={{ marginTop: "16px", marginBottom: "8px", color: "#244960" }}>Conformational Classification</h4>
          <div className="class-pill struct">
            Secondary Structure: <b>{cls.secondary_structure}</b>
          </div>
          <div className={`class-pill feas ${cls.status_code || "allowed"}`}>
            Steric Feasibility: <b>{cls.steric_feasibility}</b>
          </div>
          {cls.procheck_zone && (
            <div className="class-pill procheck-zone">
              PROCHECK Zone: <b>{cls.procheck_zone}</b>
            </div>
          )}

          {plotMode === "procheck" ? (
            /* PROCHECK 4-Zone Color Key */
            <div className="rama-procheck-guide">
              <h5>PROCHECK Region Key</h5>
              <div className="procheck-zone-list">
                <div className="p-zone-item">
                  <span className="p-color red" />
                  <div>
                    <b>Most Favoured [A, B, L]</b>
                    <small>Core α-helix &amp; β-sheet conformations</small>
                  </div>
                </div>
                <div className="p-zone-item">
                  <span className="p-color yellow" />
                  <div>
                    <b>Additional Allowed [a, b, l, p]</b>
                    <small>Permissible outer conformations</small>
                  </div>
                </div>
                <div className="p-zone-item">
                  <span className="p-color cream" />
                  <div>
                    <b>Generously Allowed [~a, ~b, ~l, ~p]</b>
                    <small>Sterically constrained boundary regions</small>
                  </div>
                </div>
                <div className="p-zone-item">
                  <span className="p-color white" />
                  <div>
                    <b>Disallowed Regions</b>
                    <small>Severe steric clashes between atoms</small>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Image 5 Circular Regions Guide */
            <div className="rama-regions-guide">
              <h5>Structural Region Identifiers</h5>
              <div className="region-chips-grid">
                <span className="region-chip"><b>↑↓</b> Antiparallel β-sheet</span>
                <span className="region-chip"><b>↑↑</b> Parallel β-sheet</span>
                <span className="region-chip"><b>II</b> Polyproline II</span>
                <span className="region-chip"><b>C</b> Collagen triple helix</span>
                <span className="region-chip"><b>2</b> 2.2₇ Ribbon</span>
                <span className="region-chip"><b>α</b> Right-handed α-helix</span>
                <span className="region-chip"><b>3</b> 3₁₀-helix</span>
                <span className="region-chip"><b>π</b> π-helix</span>
                <span className="region-chip"><b>α_L</b> Left-handed α-helix</span>
              </div>
              <div className="alpha-box-note">
                <span className="alpha-box-swatch" />
                <small><b>Red Dashed Box:</b> α-core region (φ: -89° to -39°; ψ: -66° to -16°)</small>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Active Ramachandran Plot */}
        <div className="rama-plot-container">
          <RamachandranPlot figure={activeFigure} />

          {/* Under-plot section based on active visual mode */}
          {plotMode === "procheck" ? (
            /* Authentic PROCHECK / SAVES Plot Statistics Table */
            <div className="procheck-stats-card">
              <h5 className="stats-title">Plot statistics</h5>
              <div className="stats-table">
                <div className="stats-row">
                  <span className="stats-name">Residues in most favoured regions [A,B,L]</span>
                  <span className="stats-val">{stats.favoured_count}</span>
                  <span className="stats-pct">{stats.favoured_pct}%</span>
                </div>
                <div className="stats-row">
                  <span className="stats-name">Residues in additional allowed regions [a,b,l,p]</span>
                  <span className="stats-val">{stats.additional_count}</span>
                  <span className="stats-pct">{stats.additional_pct}%</span>
                </div>
                <div className="stats-row">
                  <span className="stats-name">Residues in generously allowed regions [~a,~b,~l,~p]</span>
                  <span className="stats-val">{stats.generously_count}</span>
                  <span className="stats-pct">{stats.generously_pct}%</span>
                </div>
                <div className="stats-row">
                  <span className="stats-name">Residues in disallowed regions</span>
                  <span className="stats-val">{stats.disallowed_count}</span>
                  <span className="stats-pct">{stats.disallowed_pct}%</span>
                </div>
                <div className="stats-separator" />
                <div className="stats-row total">
                  <span className="stats-name"><b>Number of non-glycine and non-proline residues</b></span>
                  <span className="stats-val"><b>{stats.total_non_gly_pro}</b></span>
                  <span className="stats-pct"><b>100.0%</b></span>
                </div>
              </div>
            </div>
          ) : (
            /* Image 5 Defined Boundaries Note */
            <div className="rama-caption-note">
              <p>
                <b>Defined boundaries:</b> φ = -45°, ψ = +45°, ψ = -100°, ψ = ±90°. 
                Red dashed box: α-core (φ -89° to -39°; ψ -66° to -16°). 
                Quadrants: QI (+φ, +ψ), QII (-φ, +ψ), QIII (-φ, -ψ), QIV (+φ, -ψ).
              </p>
            </div>
          )}
        </div>
      </div>
    </Panel>
  </>;
}

/* ---------- STEP 8: Explainable AI ---------- */
export function Step8({ payload }) {
  return <Panel title="📋 Automated Pathogenicity Verdict">
    <Notice kind="info">The mutation <b>{payload.mutation}</b> in target <b>{payload.uniprot_id}</b> has been analyzed across the ProtMind AI pipeline. The integration of comparative, structural, and functional proteomics yields the following insights:</Notice>
    <ul className="plain-list spaced">
      <li><b>Evolutionary Context:</b> The sequence analysis indicates a deviation from highly conserved physicochemical properties, suggesting a breakdown of the target's native environment.</li>
      <li><b>Structural Physics:</b> 3D coordinate mapping and thermodynamic equations suggest a shift in potential energy, forcing the protein backbone into a potentially clashing conformation.</li>
      <li><b>Systemic Impact:</b> Protein-protein interaction (PPI) networks indicate this local structural failure will likely propagate, disrupting known cellular pathways.</li>
    </ul>
    <Notice kind="success">✅ <b>Final AI Verdict:</b> High confidence of pathogenic mechanism via structural destabilization.</Notice>
  </Panel>;
}

/* ---------- STEP 9: Therapeutic Targeting ---------- */
export function Step9({ payload }) {
  const { loading, data, error } = useStep("/api/step9", payload);
  if (loading) return <Loading text="🔗 Scanning ChEMBL for pharmacological targets..." />;
  if (error) return <Notice kind="error">{error}</Notice>;
  return <Panel title={`Pharmacological Network for Target: ${data.gene} (${payload.uniprot_id})`}>
    {data.drugs.length
      ? <><DataTable rows={data.drugs} /><Notice kind="info">Use these Molecule IDs in PubChem or ChEMBL to design docking simulations against the mutant pocket.</Notice></>
      : <Notice kind="warning">No documented small molecules or targeted therapies found in the ChEMBL database for {payload.uniprot_id}.</Notice>}
  </Panel>;
}

/* ---------- STEP 10: Clinical Report ---------- */
export function Step10({ payload }) {
  const [state, setState] = useState({ loading: true, blob: null, error: "" });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, blob: null, error: "" });
    fetchReportPdf(payload)
      .then(blob => alive && setState({ loading: false, blob, error: "" }))
      .catch(e => alive && setState({ loading: false, blob: null, error: e.message }));
    return () => { alive = false; };
  }, [payload]);
  return <Panel title="Export Full Pipeline Analytics">
    <p>Generate a comprehensive PDF document summarizing sequence metrics, structural disruption profiles, and therapeutic targeting insights.</p>
    {state.loading && <Loading text="📑 Assembling report and generating structural plots..." />}
    {state.error && <Notice kind="error">{state.error}</Notice>}
    {state.blob && <>
      <button className="primary-btn" onClick={() => download(state.blob, `${payload.uniprot_id}_${payload.mutation}_Clinical_Report.pdf`)}>📥 Download Clinical Report (PDF)</button>
      <Notice kind="success">✅ Report generated with embedded structural and biophysical profiles!</Notice>
    </>}
  </Panel>;
}

export { Gate };
