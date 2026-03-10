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

  if (phase === 'loading') return <Center>⏳ Loading Charlie's menu...</Center>;
  if (phase === 'notfound') return <Center>🔍 Review not found.</Center>;
  if (phase === 'error') return <Center>⚠️ Something went wrong. Please try again.</Center>;
  if (phase === 'saving') return <Center>💾 Saving approvals...</Center>;

  if (phase === 'done') {
    const allKita = meals.map(m => m.formatted.kita_message).join('\n\n---\n\n');
    return (
      <div style={s.page}>
        <div style={s.header}>
          <h1 style={s.headerTitle}>🌟 All meals reviewed!</h1>
          <p style={s.headerSub}>Ready to send to Kita</p>
        </div>
        <div style={s.content}>
          <div style={s.card}>
            <div style={{...s.cardHeader, background:'linear-gradient(135deg, #059669, #10b981)'}}>
              <div style={{fontSize:'2.5rem', marginBottom:'0.3rem'}}>✅</div>
              <h2 style={{color:'white', margin:0, fontSize:'1.3rem'}}>Charlie's week is ready</h2>
            </div>
            <div style={s.cardBody}>
              <div style={s.sectionTitle}>📋 KITA MESSAGE — READY TO COPY</div>
              <div style={s.kitaBox}>{allKita}</div>
              <button style={{...s.btnApprove, marginTop:'1rem', background: copied ? '#059669' : '#4f46e5'}} onClick={copyKita}>
                {copied ? '✅ Copied!' : '📋 Copy to clipboard'}
              </button>
            </div>
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

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.headerTitle}>🩺 Charlie's Meal Review</h1>
        <p style={s.headerSub}>{record?.email_subject}</p>
      </div>
      <div style={s.progress}>
        {meals.map((m, i) => (
          <div key={i} style={{...s.dot, background: i < currentIndex ? '#4f46e5' : i === currentIndex ? '#818cf8' : '#e5e7eb', color: i <= currentIndex ? 'white' : '#9ca3af'}}>{i + 1}</div>
        ))}
        <span style={{marginLeft:'auto', fontSize:'0.75rem', color:'#9ca3af', fontWeight:600}}>{currentIndex + 1} / {meals.length}</span>
      </div>
      <div style={s.content}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.dayBadge}>{meal.day} · {meal.type === 'Zmittag' ? '🍽 Lunch' : '🍎 Snack'}</div>
            <h2 style={s.mealName}>{raw?.dish_name || meal.type}</h2>
            <div style={{display:'flex', gap:'0.4rem', marginTop:'0.5rem', flexWrap:'wrap'}}>
              <span style={s.badge}>{raw?.mode_applied}</span>
              <span style={s.badge}>Target: {raw?.carb_target_g}g carbs</span>
              <span style={s.badge}>Omnipod: {formatted?.omnipod_g}g</span>
            </div>
          </div>
          <div style={s.cardBody}>
            <div style={s.totalsRow}>
              <div style={{...s.totalBox, background:'#ede9fe', borderColor:'#c4b5fd'}}>
                <div style={{...s.totalLabel, color:'#5b21b6'}}>Total Carbs</div>
                <div style={{...s.totalValue, color:'#4f46e5'}}>{formatted?.total_carbs_g}g</div>
              </div>
              <div style={{...s.totalBox, background:'#fef3c7', borderColor:'#fde68a'}}>
                <div style={{...s.totalLabel, color:'#92400e'}}>Omnipod</div>
                <div style={{...s.totalValue, color:'#b45309'}}>Enter {formatted?.omnipod_g}g</div>
              </div>
              <div style={{...s.totalBox, background:'#f0fdf4', borderColor:'#86efac'}}>
                <div style={{...s.totalLabel, color:'#166534'}}>Nachschlag</div>
                <div style={{...s.totalValue, color:'#15803d', fontSize:'0.85rem'}}>{raw?.nachschlag?.carb_foods?.[0] ? `+${raw.nachschlag.carb_foods[0].carbs_g}g` : '—'}</div>
              </div>
            </div>
            <div style={s.section}>
              <div style={s.sectionTitle}>📚 HERLEITUNG</div>
              <div style={s.herleitungBox}>
                {formatted?.herleitung?.split('\n').map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{height:'0.5rem'}} />;
                  if (line.startsWith('LIBRARY CHECK') || line.startsWith('CARB COMPONENT') || line.startsWith('ACCOMPANIMENT') || line.startsWith('FREE COMPONENTS') || line.startsWith('NACHSCHLAG') || line.startsWith('GLYCEMIC') || line.startsWith('OMNIPOD')) {
                    return <div key={i} style={s.herleitungLabel}>{line}</div>;
                  }
                  return <div key={i} style={s.herleitungLine}>{line}</div>;
                })}
              </div>
            </div>
            <button style={s.toggleBtn} onClick={() => setShowTable(v => !v)}>
              {showTable ? '▲ Hide ingredient table' : '▼ Show full ingredient table'}
            </button>
            {showTable && (
              <div style={s.section}>
                {carbFoods.length > 0 && (<>
                  <div style={{...s.sectionTitle, marginTop:'0.8rem'}}>🌾 CARB COMPONENTS</div>
                  <div style={s.tableHeader}>
                    <span style={{flex:2}}>Ingredient</span>
                    <span style={{flex:1, textAlign:'right'}}>Weight</span>
                    <span style={{flex:1, textAlign:'right'}}>per 100g</span>
                    <span style={{flex:1, textAlign:'right'}}>Carbs</span>
                  </div>
                  {carbFoods.map((f, i) => (
                    <div key={i} style={s.tableRow}>
                      <span style={{flex:2, textTransform:'capitalize', fontWeight:600}}>{f.food}
                        <span style={{...s.speedTag, background: f.glycemic_speed==='fast'?'#fee2e2':'#d1fae5', color: f.glycemic_speed==='fast'?'#991b1b':'#065f46'}}>{f.glycemic_speed}</span>
                      </span>
                      <span style={{flex:1, textAlign:'right', color:'#6b7280'}}>{f.portion_g}g</span>
                      <span style={{flex:1, textAlign:'right', color:'#6b7280'}}>{f.carbs_per_100g}g</span>
                      <span style={{flex:1, textAlign:'right', fontWeight:700, color:'#4f46e5'}}>{f.carbs_g}g</span>
                    </div>
                  ))}
                </>)}
                {freeFoods.length > 0 && (<>
                  <div style={{...s.sectionTitle, marginTop:'0.8rem'}}>✅ FREE FOODS</div>
                  {freeFoods.map((f, i) => (
                    <div key={i} style={{...s.tableRow, opacity:0.65}}>
                      <span style={{flex:2, textTransform:'capitalize'}}>{f.food.replace(/_/g,' ')}</span>
                      <span style={{flex:1, textAlign:'right', color:'#6b7280'}}>{f.portion_g}g</span>
                      <span style={{flex:2, textAlign:'right', color:'#9ca3af', fontSize:'0.75rem'}}>{f.reason?.replace(/_/g,' ')}</span>
                    </div>
                  ))}
                </>)}
              </div>
            )}
          </div>
          <div style={s.actions}>
            <div style={s.sectionTitle}>✏️ CORRECTION (optional)</div>
            <textarea style={s.textarea} placeholder="e.g. 'Mehl portion should be 35g' or 'Dish name is wrong'..." value={correctionText} onChange={e => setCorrectionText(e.target.value)} rows={2} />
            <div style={s.btnRow}>
              <button style={s.btnApprove} onClick={handleApprove}>✅ Approve</button>
              <button style={{...s.btnCorrect, opacity: correctionText.trim() ? 1 : 0.35}} onClick={handleCorrect} disabled={!correctionText.trim()}>✏️ Correct & Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Center({ children }) {
  return <div style={{ textAlign:'center', padding:'4rem', fontFamily:'sans-serif', color:'#6b7280', fontSize:'1.1rem' }}>{children}</div>;
}

const s = {
  page: { minHeight:'100vh', background:'#f8f7ff', fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  header: { background:'white', borderBottom:'3px solid #4f46e5', padding:'1rem 1.5rem' },
  headerTitle: { margin:0, fontSize:'1.2rem', fontWeight:700, color:'#1e1b4b' },
  headerSub: { margin:'0.2rem 0 0', fontSize:'0.78rem', color:'#6b7280' },
  progress: { background:'white', padding:'0.8rem 1.5rem', borderBottom:'1px solid #e5e7eb', display:'flex', gap:'0.4rem', alignItems:'center' },
  dot: { width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, flexShrink:0 },
  content: { maxWidth:680, margin:'1.2rem auto', padding:'0 0.8rem' },
  card: { background:'white', borderRadius:16, boxShadow:'0 2px 20px rgba(79,70,229,0.1)', overflow:'hidden' },
  cardHeader: { background:'linear-gradient(135deg, #4f46e5, #7c3aed)', padding:'1.2rem 1.5rem', color:'white' },
  dayBadge: { fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', opacity:0.8, marginBottom:'0.3rem' },
  mealName: { margin:0, fontSize:'1.25rem', fontWeight:700, lineHeight:1.3 },
  badge: { display:'inline-block', background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'0.15rem 0.6rem', fontSize:'0.72rem', fontWeight:600 },
  cardBody: { padding:'1.2rem 1.5rem' },
  totalsRow: { display:'flex', gap:'0.6rem', marginBottom:'1.2rem' },
  totalBox: { flex:1, border:'1px solid', borderRadius:10, padding:'0.5rem 0.6rem', textAlign:'center' },
  totalLabel: { fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:'0.2rem' },
  totalValue: { fontSize:'1rem', fontWeight:800 },
  section: { marginBottom:'0.8rem' },
  sectionTitle: { fontSize:'0.63rem', fontWeight:700, letterSpacing:'0.1em', color:'#9ca3af', marginBottom:'0.4rem', textTransform:'uppercase' },
  herleitungBox: { background:'#f8f7ff', borderRadius:10, padding:'1rem', border:'1px solid #e5e7eb', fontSize:'0.85rem', lineHeight:1.65, color:'#374151' },
  herleitungLabel: { fontWeight:700, color:'#4f46e5', marginTop:'0.5rem', fontSize:'0.8rem', letterSpacing:'0.02em' },
  herleitungLine: { paddingLeft:'0.5rem', color:'#4b5563' },
  toggleBtn: { width:'100%', padding:'0.6rem', borderRadius:8, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#6b7280', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', marginBottom:'0.5rem', textAlign:'left' },
  tableHeader: { display:'flex', padding:'0.3rem 0.4rem', background:'#f9fafb', borderRadius:6, fontSize:'0.68rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.2rem' },
  tableRow: { display:'flex', padding:'0.45rem 0.4rem', borderBottom:'1px solid #f3f4f6', fontSize:'0.82rem', alignItems:'center' },
  speedTag: { display:'inline-block', marginLeft:'0.3rem', borderRadius:10, padding:'0.1rem 0.35rem', fontSize:'0.6rem', fontWeight:700 },
  actions: { padding:'1.1rem 1.5rem', background:'#fafafa', borderTop:'1px solid #f3f4f6' },
  textarea: { width:'100%', padding:'0.65rem 0.9rem', borderRadius:8, border:'2px solid #e5e7eb', fontSize:'0.85rem', fontFamily:'inherit', resize:'vertical', marginBottom:'0.8rem', outline:'none', boxSizing:'border-box' },
  btnRow: { display:'flex', gap:'0.7rem' },
  btnApprove: { flex:1, padding:'0.85rem', borderRadius:10, border:'none', background:'linear-gradient(135deg, #059669, #10b981)', color:'white', fontSize:'0.95rem', fontWeight:700, cursor:'pointer' },
  btnCorrect: { flex:1, padding:'0.85rem', borderRadius:10, border:'2px solid #e5e7eb', background:'white', color:'#374151', fontSize:'0.95rem', fontWeight:700, cursor:'pointer' },
  kitaBox: { background:'#f0fdf4', border:'2px solid #86efac', borderRadius:12, padding:'1.1rem', fontSize:'0.85rem', lineHeight:1.7, whiteSpace:'pre-wrap', color:'#166534' },
};
