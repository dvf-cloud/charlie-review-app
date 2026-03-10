import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.NEXT_PUBLIC_AIRTABLE_BASE;
const AIRTABLE_TABLE = process.env.NEXT_PUBLIC_AIRTABLE_TABLE;

export default function ReviewPage() {
  const router = useRouter();
  const { runId } = router.query;
  const [record, setRecord] = useState(null);
  const [meals, setMeals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [corrections, setCorrections] = useState({});
  const [correctionText, setCorrectionText] = useState('');
  const [phase, setPhase] = useState('loading');
  const [airtableId, setAirtableId] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (runId) fetchRecord(); }, [runId]);

  async function fetchRecord() {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula={run_id}="${runId}"`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      );
      const data = await res.json();
      if (!data.records?.length) { setPhase('notfound'); return; }
      const rec = data.records[0];
      setAirtableId(rec.id);
      setRecord(rec.fields);
      const mealsJson = JSON.parse(rec.fields.meals_json || '{}');
      const calcJson = JSON.parse(rec.fields.calculation_json || '{}');
      const mealList = [];
      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      dayOrder.forEach(day => {
        if (!mealsJson[day]) return;
        ['Zmittag', 'Zvieri'].forEach(type => {
          if (!mealsJson[day][type]) return;
          mealList.push({ day, type, formatted: mealsJson[day][type], raw: calcJson.meals?.[day]?.[type] || {} });
        });
      });
      setMeals(mealList);
      setPhase('review');
    } catch (e) { setPhase('error'); }
  }

  function handleApprove() {
    const meal = meals[currentIndex];
    const nc = { ...corrections, [`${meal.day}_${meal.type}`]: 'APPROVED' };
    setCorrections(nc);
    setCorrectionText('');
    setShowTable(false);
    if (currentIndex < meals.length - 1) { setCurrentIndex(i => i + 1); }
    else { finalizeAndSave(nc); }
  }

  function handleCorrect() {
    if (!correctionText.trim()) return;
    const meal = meals[currentIndex];
    const nc = { ...corrections, [`${meal.day}_${meal.type}`]: correctionText };
    setCorrections(nc);
    setCorrectionText('');
    setShowTable(false);
    if (currentIndex < meals.length - 1) { setCurrentIndex(i => i + 1); }
    else { finalizeAndSave(nc); }
  }

  async function finalizeAndSave(fc) {
    setPhase('saving');
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${airtableId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: 'APPROVED', corrections: JSON.stringify(fc) } })
      });
      setPhase('done');
    } catch (e) { setPhase('error'); }
  }

  function copyKita() {
    const kitaMsg = meals.map(m => m.formatted.kita_message).join('\n\n---\n\n');
    navigator.clipboard.writeText(kitaMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (phase === 'loading') return <StateScreen icon="⏳" title="Loading..." sub="Fetching Charlie's menu" />;
  if (phase === 'notfound') return <StateScreen icon="🔍" title="Not found" sub="This review link is invalid or expired" />;
  if (phase === 'error') return <StateScreen icon="⚠️" title="Something went wrong" sub="Please try again or contact support" />;
  if (phase === 'saving') return <StateScreen icon="💾" title="Saving..." sub="Recording your approvals" />;

  if (phase === 'done') {
    const allKita = meals.map(m => m.formatted.kita_message).join('\n\n---\n\n');
    return (
      <div style={s.page}>
        <Header title="Charlie · Meal Review" sub={record?.email_subject} />
        <div style={s.content}>
          <div style={s.doneHero}>
            <span style={s.doneIcon}>✓</span>
            <h2 style={s.doneTitle}>All meals approved</h2>
            <p style={s.doneSub}>Ready to send to KIDSatLAKE</p>
          </div>
          <div style={s.section}>
            <div style={s.label}>KITA MESSAGE</div>
            <div style={s.kitaBox}>{allKita}</div>
            <button style={{...s.btnPrimary, marginTop:'1rem', width:'100%', background: copied ? '#0d9488' : '#0f172a'}} onClick={copyKita}>
              {copied ? '✓ Copied to clipboard' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const meal = meals[currentIndex];
  if (!meal) return null;
  const { formatted, raw } = meal;
  const carbFoods = raw?.carb_foods || [];
  const freeFoods = raw?.free_foods || [];
  const progress = Math.round((currentIndex / meals.length) * 100);
  const isFast = formatted?.herleitung?.toLowerCase().includes('fast');

  return (
    <div style={s.page}>
      <Header title="Charlie · Meal Review" sub={record?.email_subject} />
      <div style={s.progressBar}><div style={{...s.progressFill, width:`${progress}%`}} /></div>
      <div style={s.progressMeta}>
        <span style={s.progressLabel}>
          {meals.map((m, i) => (
            <span key={i} style={{...s.progressStep, background: i < currentIndex ? '#0f172a' : i === currentIndex ? '#0ea5e9' : '#e2e8f0', color: i <= currentIndex ? 'white' : '#94a3b8'}}>{i+1}</span>
          ))}
        </span>
        <span style={s.progressCount}>{currentIndex+1} of {meals.length}</span>
      </div>

      <div style={s.content}>
        <div style={s.mealHeader}>
          <div style={s.mealMeta}>
            <span style={s.mealDay}>{meal.day}</span>
            <span style={s.mealTypeBadge}>{meal.type === 'Zmittag' ? 'Lunch' : 'Snack'}</span>
            <span style={{...s.speedBadge, background: isFast ? '#fef2f2' : '#f0fdf4', color: isFast ? '#dc2626' : '#16a34a', border:`1px solid ${isFast ? '#fecaca' : '#bbf7d0'}`}}>
              {isFast ? 'Fast acting' : 'Slow acting'}
            </span>
          </div>
          <h1 style={s.mealName}>{raw?.dish_name || meal.type}</h1>
        </div>

        <div style={s.statsRow}>
          <div style={s.statBox}>
            <div style={s.statValue}>{formatted?.total_carbs_g}g</div>
            <div style={s.statLabel}>Total carbs</div>
          </div>
          <div style={{...s.statBox, borderLeft:'2px solid #f1f5f9'}}>
            <div style={{...s.statValue, color:'#0ea5e9'}}>{formatted?.omnipod_g}g</div>
            <div style={s.statLabel}>Enter in Omnipod</div>
          </div>
          <div style={{...s.statBox, borderLeft:'2px solid #f1f5f9'}}>
            <div style={s.statValue}>{raw?.nachschlag?.carb_foods?.[0] ? `+${raw.nachschlag.carb_foods[0].carbs_g}g` : '—'}</div>
            <div style={s.statLabel}>If seconds</div>
          </div>
        </div>

        <div style={s.section}>
          <div style={s.label}>CALCULATION REASONING</div>
          <div style={s.herleitungBox}>
            {formatted?.herleitung?.split('\n').map((line, i) => {
              if (!line.trim()) return <div key={i} style={{height:'0.6rem'}} />;
              const isHeader = ['LIBRARY CHECK','CARB COMPONENT','ACCOMPANIMENT','FREE COMPONENTS','NACHSCHLAG','GLYCEMIC','OMNIPOD'].some(h => line.startsWith(h));
              if (isHeader) return (
                <div key={i} style={s.herleitungHeader}>
                  <span style={s.herleitungHeaderDot} />
                  {line}
                </div>
              );
              return <div key={i} style={s.herleitungLine}>{line}</div>;
            })}
          </div>
        </div>

        <button style={s.toggleBtn} onClick={() => setShowTable(v => !v)}>
          <span>{showTable ? '▲' : '▼'}</span>
          <span>{showTable ? 'Hide ingredient table' : 'Show full ingredient table'}</span>
        </button>

        {showTable && (
          <div style={s.tableWrap}>
            {carbFoods.length > 0 && (<>
              <div style={s.tableSection}>Carb components</div>
              <div style={s.tableHead}>
                <span style={{flex:2}}>Ingredient</span>
                <span style={{flex:1, textAlign:'right'}}>Recipe wt.</span>
                <span style={{flex:1, textAlign:'right'}}>per 100g</span>
                <span style={{flex:1, textAlign:'right'}}>Carbs</span>
              </div>
              {carbFoods.map((f, i) => (
                <div key={i} style={s.tableRow}>
                  <span style={{flex:2, fontWeight:600, textTransform:'capitalize'}}>{f.food}
                    <span style={{...s.tag, background: f.glycemic_speed==='fast'?'#fef2f2':'#f0fdf4', color: f.glycemic_speed==='fast'?'#dc2626':'#16a34a'}}>{f.glycemic_speed}</span>
                  </span>
                  <span style={{flex:1, textAlign:'right', color:'#64748b'}}>{f.portion_g}g</span>
                  <span style={{flex:1, textAlign:'right', color:'#64748b'}}>{f.carbs_per_100g}g</span>
                  <span style={{flex:1, textAlign:'right', fontWeight:700}}>{f.carbs_g}g</span>
                </div>
              ))}
              <div style={s.tableTotal}>
                <span style={{flex:2}}>Total carbs</span>
                <span style={{flex:1}}/><span style={{flex:1}}/>
                <span style={{flex:1, textAlign:'right', color:'#0ea5e9'}}>{formatted?.total_carbs_g}g</span>
              </div>
            </>)}
            {freeFoods.length > 0 && (<>
              <div style={{...s.tableSection, marginTop:'1rem'}}>Free foods & accompaniments</div>
              {freeFoods.map((f, i) => (
                <div key={i} style={{...s.tableRow, opacity:0.6}}>
                  <span style={{flex:2, textTransform:'capitalize'}}>{f.food.replace(/_/g,' ')}</span>
                  <span style={{flex:1, textAlign:'right', color:'#64748b'}}>{f.portion_g}g</span>
                  <span style={{flex:1, textAlign:'right', color:'#94a3b8'}}>—</span>
                  <span style={{flex:1, textAlign:'right', color:'#94a3b8', fontSize:'0.75rem'}}>{f.reason?.replace(/_/g,' ')}</span>
                </div>
              ))}
            </>)}
          </div>
        )}

        <div style={s.actionBox}>
          <div style={s.label}>CORRECTION (optional)</div>
          <textarea style={s.textarea} placeholder="Describe what needs to be changed, e.g. 'Portion size should be 150g not 41g'" value={correctionText} onChange={e => setCorrectionText(e.target.value)} rows={2} />
          <div style={s.btnRow}>
            <button style={s.btnPrimary} onClick={handleApprove}>✓ Approve</button>
            <button style={{...s.btnSecondary, opacity: correctionText.trim()?1:0.35, cursor: correctionText.trim()?'pointer':'not-allowed'}} onClick={handleCorrect} disabled={!correctionText.trim()}>✎ Correct & continue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ title, sub }) {
  return (
    <div style={s.header}>
      <div style={s.headerInner}>
        <div style={s.headerLogo}>C</div>
        <div>
          <div style={s.headerTitle}>{title}</div>
          {sub && <div style={s.headerSub}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function StateScreen({ icon, title, sub }) {
  return (
    <div style={s.page}>
      <Header title="Charlie · Meal Review" />
      <div style={{textAlign:'center', padding:'5rem 2rem'}}>
        <div style={{fontSize:'2.5rem', marginBottom:'1rem'}}>{icon}</div>
        <div style={{fontSize:'1.2rem', fontWeight:700, color:'#0f172a', marginBottom:'0.4rem'}}>{title}</div>
        <div style={{fontSize:'0.9rem', color:'#64748b'}}>{sub}</div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight:'100vh', background:'#f8fafc', fontFamily:"'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color:'#0f172a' },
  header: { background:'#0f172a' },
  headerInner: { maxWidth:680, margin:'0 auto', padding:'1rem 1.2rem', display:'flex', alignItems:'center', gap:'0.8rem' },
  headerLogo: { width:32, height:32, borderRadius:8, background:'#0ea5e9', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1rem', color:'white', flexShrink:0 },
  headerTitle: { fontWeight:700, fontSize:'0.95rem', color:'white', letterSpacing:'-0.01em' },
  headerSub: { fontSize:'0.72rem', color:'#94a3b8', marginTop:'0.1rem' },
  progressBar: { height:3, background:'#e2e8f0' },
  progressFill: { height:'100%', background:'#0ea5e9', transition:'width 0.4s ease' },
  progressMeta: { background:'white', borderBottom:'1px solid #f1f5f9', padding:'0.6rem 1.2rem', maxWidth:680, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' },
  progressLabel: { display:'flex', gap:'0.3rem' },
  progressStep: { width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.65rem', fontWeight:700 },
  progressCount: { fontSize:'0.75rem', color:'#94a3b8', fontWeight:600 },
  content: { maxWidth:680, margin:'0 auto', padding:'1.5rem 1.2rem 3rem' },
  mealHeader: { marginBottom:'1.5rem', paddingBottom:'1.5rem', borderBottom:'1px solid #f1f5f9' },
  mealMeta: { display:'flex', gap:'0.5rem', alignItems:'center', marginBottom:'0.6rem', flexWrap:'wrap' },
  mealDay: { fontSize:'0.7rem', fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8' },
  mealTypeBadge: { fontSize:'0.7rem', fontWeight:700, background:'#f1f5f9', color:'#475569', borderRadius:4, padding:'0.15rem 0.5rem', textTransform:'uppercase', letterSpacing:'0.05em' },
  speedBadge: { fontSize:'0.7rem', fontWeight:700, borderRadius:4, padding:'0.15rem 0.5rem' },
  mealName: { margin:0, fontSize:'1.5rem', fontWeight:800, color:'#0f172a', lineHeight:1.25, letterSpacing:'-0.02em' },
  statsRow: { display:'flex', background:'white', borderRadius:12, border:'1px solid #e2e8f0', marginBottom:'1.5rem', overflow:'hidden' },
  statBox: { flex:1, padding:'1rem', textAlign:'center' },
  statValue: { fontSize:'1.4rem', fontWeight:800, color:'#0f172a', letterSpacing:'-0.02em' },
  statLabel: { fontSize:'0.65rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:'0.2rem' },
  section: { marginBottom:'1.2rem' },
  label: { fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.12em', color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.5rem' },
  herleitungBox: { background:'white', borderRadius:10, border:'1px solid #e2e8f0', padding:'1.2rem', fontSize:'0.85rem', lineHeight:1.7, color:'#334155' },
  herleitungHeader: { display:'flex', alignItems:'center', gap:'0.5rem', fontWeight:700, color:'#0f172a', fontSize:'0.8rem', marginTop:'0.8rem', marginBottom:'0.2rem' },
  herleitungHeaderDot: { width:6, height:6, borderRadius:'50%', background:'#0ea5e9', flexShrink:0 },
  herleitungLine: { color:'#475569', paddingLeft:'1.1rem', fontSize:'0.83rem' },
  toggleBtn: { width:'100%', padding:'0.7rem 1rem', borderRadius:8, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'0.8rem', display:'flex', alignItems:'center', gap:'0.5rem' },
  tableWrap: { background:'white', borderRadius:10, border:'1px solid #e2e8f0', padding:'1rem 1.2rem', marginBottom:'1.2rem', fontSize:'0.82rem' },
  tableSection: { fontSize:'0.62rem', fontWeight:800, letterSpacing:'0.1em', color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.5rem' },
  tableHead: { display:'flex', padding:'0.4rem 0', borderBottom:'2px solid #f1f5f9', fontSize:'0.65rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' },
  tableRow: { display:'flex', padding:'0.55rem 0', borderBottom:'1px solid #f8fafc', alignItems:'center' },
  tableTotal: { display:'flex', padding:'0.6rem 0 0', fontWeight:700, fontSize:'0.82rem', borderTop:'2px solid #f1f5f9', marginTop:'0.3rem' },
  tag: { display:'inline-block', marginLeft:'0.4rem', borderRadius:4, padding:'0.1rem 0.35rem', fontSize:'0.6rem', fontWeight:700 },
  actionBox: { background:'white', borderRadius:12, border:'1px solid #e2e8f0', padding:'1.2rem', marginTop:'1.5rem' },
  textarea: { width:'100%', padding:'0.75rem 0.9rem', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:'0.85rem', fontFamily:'inherit', resize:'vertical', marginBottom:'1rem', outline:'none', boxSizing:'border-box', color:'#0f172a', lineHeight:1.5 },
  btnRow: { display:'flex', gap:'0.7rem' },
  btnPrimary: { flex:1, padding:'0.9rem', borderRadius:8, border:'none', background:'#0f172a', color:'white', fontSize:'0.9rem', fontWeight:700, cursor:'pointer', letterSpacing:'-0.01em' },
  btnSecondary: { flex:1, padding:'0.9rem', borderRadius:8, border:'1.5px solid #e2e8f0', background:'white', color:'#0f172a', fontSize:'0.9rem', fontWeight:700, letterSpacing:'-0.01em' },
  doneHero: { textAlign:'center', padding:'2.5rem 0 2rem' },
  doneIcon: { display:'inline-flex', alignItems:'center', justifyContent:'center', width:56, height:56, borderRadius:'50%', background:'#0f172a', color:'white', fontSize:'1.5rem', fontWeight:800, marginBottom:'1rem' },
  doneTitle: { margin:'0 0 0.4rem', fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em' },
  doneSub: { margin:0, color:'#64748b', fontSize:'0.9rem' },
  kitaBox: { background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'1.2rem', fontSize:'0.85rem', lineHeight:1.8, whiteSpace:'pre-wrap', color:'#334155', fontFamily:'monospace' },
};
