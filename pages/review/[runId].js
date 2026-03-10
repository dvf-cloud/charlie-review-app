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

  if (phase === 'loading') return <Shell><StateCard icon="⟳" title="Loading…" sub="Fetching Charlie's menu" /></Shell>;
  if (phase === 'notfound') return <Shell><StateCard icon="∅" title="Not found" sub="This review link is invalid or expired" /></Shell>;
  if (phase === 'error') return <Shell><StateCard icon="!" title="Error" sub="Something went wrong. Please try again." /></Shell>;
  if (phase === 'saving') return <Shell><StateCard icon="↑" title="Saving…" sub="Recording your approvals" /></Shell>;

  if (phase === 'done') {
    const allKita = meals.map(m => m.formatted.kita_message).join('\n\n---\n\n');
    return (
      <Shell record={record}>
        <div style={s.doneWrap}>
          <div style={s.doneCircle}>✓</div>
          <h2 style={s.doneTitle}>All meals approved</h2>
          <p style={s.doneSub}>Ready to send to KIDSatLAKE</p>
        </div>
        <Card>
          <Label>Kita Message</Label>
          <pre style={s.kitaPre}>{allKita}</pre>
          <button
            style={{...s.btnPrimary, marginTop:'1rem', width:'100%', background: copied ? '#059669' : '#0f172a'}}
            onClick={copyKita}
          >
            {copied ? '✓  Copied!' : 'Copy to clipboard'}
          </button>
        </Card>
      </Shell>
    );
  }

  const meal = meals[currentIndex];
  if (!meal) return null;
  const { formatted, raw } = meal;
  const carbFoods = raw?.carb_foods || [];
  const freeFoods = raw?.free_foods || [];
  const isFast = formatted?.herleitung?.toLowerCase().includes('fast');
  const pct = Math.round((currentIndex / meals.length) * 100);

  return (
    <Shell record={record}>
      <div style={s.progressWrap}>
        <div style={s.progressBg}>
          <div style={{...s.progressFill, width:`${pct}%`}} />
        </div>
        <div style={s.progressMeta}>
          <div style={s.dots}>
            {meals.map((_, i) => (
              <div key={i} style={{
                ...s.dot,
                background: i < currentIndex ? '#0f172a' : i === currentIndex ? '#0ea5e9' : '#e2e8f0'
              }} />
            ))}
          </div>
          <span style={s.counter}>{currentIndex + 1} of {meals.length}</span>
        </div>
      </div>

      <div style={s.mealHeader}>
        <div style={s.pills}>
          <Pill>{meal.day}</Pill>
          <Pill>{meal.type === 'Zmittag' ? 'Lunch' : 'Snack'}</Pill>
          <Pill color={isFast ? '#dc2626' : '#16a34a'} bg={isFast ? '#fef2f2' : '#f0fdf4'} ring={isFast ? '#fecaca' : '#bbf7d0'}>
            {isFast ? '⚡ Fast acting' : '◎ Slow acting'}
          </Pill>
        </div>
        <h1 style={s.mealTitle}>{raw?.dish_name || meal.type}</h1>
      </div>

      <div style={s.statsRow}>
        <div style={s.statCell}>
          <div style={s.statNum}>{formatted?.total_carbs_g}g</div>
          <div style={s.statLbl}>Total carbs</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCell}>
          <div style={{...s.statNum, color:'#0ea5e9'}}>{formatted?.omnipod_g}g</div>
          <div style={s.statLbl}>Enter in Omnipod</div>
        </div>
        <div style={s.statDivider} />
        <div style={s.statCell}>
          <div style={s.statNum}>{raw?.nachschlag?.carb_foods?.[0] ? `+${raw.nachschlag.carb_foods[0].carbs_g}g` : '—'}</div>
          <div style={s.statLbl}>If she wants more</div>
        </div>
      </div>

      <Card>
        <Label>Calculation Reasoning</Label>
        <div style={s.reasonBox}>
          {formatted?.herleitung?.split('\n').map((line, i) => {
            if (!line.trim()) return <div key={i} style={{height:'0.45rem'}} />;
            const isH = ['LIBRARY CHECK','CARB COMPONENT','ACCOMPANIMENT','FREE COMPONENTS','NACHSCHLAG','GLYCEMIC','OMNIPOD'].some(h => line.startsWith(h));
            if (isH) return (
              <div key={i} style={s.reasonHead}>
                <span style={s.reasonDot} />
                {line}
              </div>
            );
            return <div key={i} style={s.reasonLine}>{line}</div>;
          })}
        </div>
      </Card>

      <button style={s.toggle} onClick={() => setShowTable(v => !v)}>
        <span>{showTable ? 'Hide' : 'Show'} ingredient table</span>
        <span style={s.toggleChev}>{showTable ? '▲' : '▼'}</span>
      </button>

      {showTable && (
        <Card noPad>
          {carbFoods.length > 0 && (
            <div style={{padding:'1.1rem 1.3rem'}}>
              <Label>Carb Components</Label>
              <div style={s.tHead}>
                <span style={{flex:2.5}}>Ingredient</span>
                <span style={{flex:1,textAlign:'right'}}>Recipe wt.</span>
                <span style={{flex:1,textAlign:'right'}}>/100g</span>
                <span style={{flex:1,textAlign:'right'}}>Carbs</span>
              </div>
              {carbFoods.map((f, i) => (
                <div key={i} style={s.tRow}>
                  <span style={{flex:2.5,fontWeight:600,textTransform:'capitalize'}}>
                    {f.food}
                    <span style={{...s.speedTag, color:f.glycemic_speed==='fast'?'#dc2626':'#16a34a', background:f.glycemic_speed==='fast'?'#fef2f2':'#f0fdf4'}}>
                      {f.glycemic_speed}
                    </span>
                  </span>
                  <span style={{flex:1,textAlign:'right',color:'#64748b'}}>{f.portion_g}g</span>
                  <span style={{flex:1,textAlign:'right',color:'#94a3b8'}}>{f.carbs_per_100g}g</span>
                  <span style={{flex:1,textAlign:'right',fontWeight:700}}>{f.carbs_g}g</span>
                </div>
              ))}
              <div style={s.tFooter}>
                <span style={{flex:2.5,color:'#64748b',fontWeight:600}}>Total</span>
                <span style={{flex:1}}/><span style={{flex:1}}/>
                <span style={{flex:1,textAlign:'right',fontWeight:800,color:'#0ea5e9'}}>{formatted?.total_carbs_g}g</span>
              </div>
            </div>
          )}
          {freeFoods.length > 0 && (
            <div style={{padding:'0 1.3rem 1.1rem', borderTop:'1px solid #f1f5f9'}}>
              <div style={{paddingTop:'1rem'}}><Label>Free Foods</Label></div>
              {freeFoods.map((f, i) => (
                <div key={i} style={{...s.tRow, opacity:0.55}}>
                  <span style={{flex:2.5,textTransform:'capitalize',color:'#64748b'}}>{f.food.replace(/_/g,' ')}</span>
                  <span style={{flex:1,textAlign:'right',color:'#94a3b8'}}>{f.portion_g}g</span>
                  <span style={{flex:1,textAlign:'right',color:'#94a3b8'}}>—</span>
                  <span style={{flex:1,textAlign:'right',color:'#94a3b8',fontSize:'0.72rem'}}>{f.reason?.replace(/_/g,' ')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <Label>Your Decision</Label>
        <textarea
          style={s.textarea}
          placeholder="Optional correction — e.g. 'Portion size should be 150g not 41g'"
          value={correctionText}
          onChange={e => setCorrectionText(e.target.value)}
          rows={2}
        />
        <div style={s.btnRow}>
          <button style={s.btnPrimary} onClick={handleApprove}>✓  Approve</button>
          <button
            style={{...s.btnOutline, opacity:correctionText.trim()?1:0.3, cursor:correctionText.trim()?'pointer':'not-allowed'}}
            onClick={handleCorrect}
            disabled={!correctionText.trim()}
          >
            ✎  Correct &amp; continue
          </button>
        </div>
      </Card>

    </Shell>
  );
}

function Shell({ children, record }) {
  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>
            <div style={s.logoMark}>C</div>
            <div>
              <div style={s.logoName}>Charlie · Meal Review</div>
              {record?.email_subject && <div style={s.logoSub}>{record.email_subject}</div>}
            </div>
          </div>
        </div>
      </header>
      <main style={s.main}>{children}</main>
    </div>
  );
}

function Card({ children, noPad }) {
  return <div style={{...s.card, padding: noPad ? 0 : '1.2rem 1.3rem'}}>{children}</div>;
}

function Label({ children }) {
  return <div style={s.label}>{children}</div>;
}

function Pill({ children, color, bg, ring }) {
  return (
    <span style={{
      display:'inline-block', fontSize:'0.67rem', fontWeight:700,
      letterSpacing:'0.04em', textTransform:'uppercase',
      padding:'0.18rem 0.5rem', borderRadius:4,
      color: color||'#64748b', background: bg||'#f1f5f9',
      border:`1px solid ${ring||'#e2e8f0'}`
    }}>{children}</span>
  );
}

function StateCard({ icon, title, sub }) {
  return (
    <div style={{textAlign:'center', padding:'5rem 1rem'}}>
      <div style={{fontSize:'2rem', color:'#cbd5e1', marginBottom:'1.2rem'}}>{icon}</div>
      <div style={{fontWeight:700, fontSize:'1.1rem', color:'#0f172a', marginBottom:'0.3rem'}}>{title}</div>
      <div style={{fontSize:'0.85rem', color:'#94a3b8'}}>{sub}</div>
    </div>
  );
}

const s = {
  page: { minHeight:'100vh', background:'#f8fafc', fontFamily:"'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color:'#0f172a' },
  header: { background:'#ffffff', borderBottom:'1px solid #e2e8f0', position:'sticky', top:0, zIndex:10 },
  headerInner: { maxWidth:700, margin:'0 auto', padding:'0.85rem 1.2rem' },
  logo: { display:'flex', alignItems:'center', gap:'0.75rem' },
  logoMark: { width:34, height:34, borderRadius:8, background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:'0.95rem', color:'white', flexShrink:0 },
  logoName: { fontWeight:700, fontSize:'0.9rem', color:'#0f172a', letterSpacing:'-0.01em' },
  logoSub: { fontSize:'0.68rem', color:'#94a3b8', marginTop:'0.1rem' },
  main: { maxWidth:700, margin:'0 auto', padding:'1.5rem 1rem 4rem' },
  progressWrap: { marginBottom:'1.5rem' },
  progressBg: { height:3, background:'#e2e8f0', borderRadius:99, overflow:'hidden', marginBottom:'0.65rem' },
  progressFill: { height:'100%', background:'#0ea5e9', borderRadius:99, transition:'width 0.35s ease' },
  progressMeta: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  dots: { display:'flex', gap:'0.35rem' },
  dot: { width:8, height:8, borderRadius:'50%', transition:'background 0.2s' },
  counter: { fontSize:'0.72rem', fontWeight:600, color:'#94a3b8' },
  mealHeader: { marginBottom:'1.3rem', paddingBottom:'1.3rem', borderBottom:'1px solid #f1f5f9' },
  pills: { display:'flex', gap:'0.4rem', flexWrap:'wrap', marginBottom:'0.6rem' },
  mealTitle: { margin:0, fontSize:'1.75rem', fontWeight:800, letterSpacing:'-0.03em', lineHeight:1.2, color:'#0f172a' },
  statsRow: { display:'flex', background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, marginBottom:'1.2rem', overflow:'hidden' },
  statCell: { flex:1, padding:'1rem 0.8rem', textAlign:'center' },
  statNum: { fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.03em' },
  statLbl: { fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#94a3b8', marginTop:'0.2rem' },
  statDivider: { width:1, background:'#f1f5f9', margin:'0.8rem 0' },
  card: { background:'#ffffff', border:'1px solid #e2e8f0', borderRadius:12, marginBottom:'0.9rem' },
  label: { fontSize:'0.6rem', fontWeight:800, letterSpacing:'0.13em', textTransform:'uppercase', color:'#94a3b8', marginBottom:'0.65rem' },
  reasonBox: { background:'#f8fafc', borderRadius:8, border:'1px solid #f1f5f9', padding:'1rem 1.1rem', fontSize:'0.84rem', lineHeight:1.75, color:'#334155' },
  reasonHead: { display:'flex', alignItems:'center', gap:'0.45rem', fontWeight:700, color:'#0f172a', fontSize:'0.78rem', marginTop:'0.75rem', marginBottom:'0.15rem' },
  reasonDot: { width:5, height:5, borderRadius:'50%', background:'#0ea5e9', flexShrink:0 },
  reasonLine: { paddingLeft:'1rem', color:'#475569', fontSize:'0.82rem' },
  toggle: { width:'100%', padding:'0.75rem 1rem', borderRadius:10, border:'1px solid #e2e8f0', background:'white', color:'#64748b', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'0.9rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  toggleChev: { fontSize:'0.62rem', color:'#cbd5e1' },
  tHead: { display:'flex', padding:'0.35rem 0', borderBottom:'1px solid #f1f5f9', fontSize:'0.62rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.1rem' },
  tRow: { display:'flex', padding:'0.5rem 0', borderBottom:'1px solid #fafafa', alignItems:'center', fontSize:'0.82rem' },
  tFooter: { display:'flex', padding:'0.6rem 0 0', borderTop:'2px solid #f1f5f9', marginTop:'0.2rem', fontSize:'0.82rem' },
  speedTag: { marginLeft:'0.4rem', borderRadius:4, padding:'0.08rem 0.3rem', fontSize:'0.6rem', fontWeight:700, display:'inline-block' },
  textarea: { width:'100%', padding:'0.8rem 0.9rem', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:'0.84rem', fontFamily:'inherit', resize:'vertical', marginBottom:'0.9rem', outline:'none', boxSizing:'border-box', color:'#0f172a', lineHeight:1.55, background:'#f8fafc' },
  btnRow: { display:'flex', gap:'0.6rem' },
  btnPrimary: { flex:1, padding:'0.9rem', borderRadius:9, border:'none', background:'#0f172a', color:'white', fontSize:'0.9rem', fontWeight:700, cursor:'pointer', letterSpacing:'-0.01em' },
  btnOutline: { flex:1, padding:'0.9rem', borderRadius:9, border:'1.5px solid #e2e8f0', background:'white', color:'#0f172a', fontSize:'0.9rem', fontWeight:700, letterSpacing:'-0.01em' },
  doneWrap: { textAlign:'center', padding:'3rem 0 2rem' },
  doneCircle: { width:60, height:60, borderRadius:'50%', background:'#0f172a', color:'white', fontSize:'1.5rem', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.2rem' },
  doneTitle: { margin:'0 0 0.4rem', fontSize:'1.6rem', fontWeight:800, letterSpacing:'-0.03em' },
  doneSub: { margin:0, color:'#64748b', fontSize:'0.9rem' },
  kitaPre: { background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'1.1rem', fontSize:'0.83rem', lineHeight:1.8, whiteSpace:'pre-wrap', color:'#334155', fontFamily:'monospace', margin:0, overflowX:'auto' },
};
