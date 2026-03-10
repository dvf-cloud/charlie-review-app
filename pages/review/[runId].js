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

  useEffect(() => {
    if (!runId) return;
    fetchRecord();
  }, [runId]);

  async function fetchRecord() {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula={run_id}="${runId}"`,
        { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } }
      );
      const data = await res.json();
      if (!data.records || data.records.length === 0) { setPhase('notfound'); return; }
      const rec = data.records[0];
      setAirtableId(rec.id);
      setRecord(rec.fields);
      const calc = JSON.parse(rec.fields.calculation_json);
      const mealList = [];
      const mealData = calc.meals || {};
      Object.entries(mealData).forEach(([day, dayMeals]) => {
        if (dayMeals.Zmittag) mealList.push({ day, type: 'Zmittag', data: dayMeals.Zmittag });
        if (dayMeals.Zvieri) mealList.push({ day, type: 'Zvieri', data: dayMeals.Zvieri });
      });
      setMeals(mealList);
      setPhase('review');
    } catch (e) { setPhase('error'); }
  }

  function handleApprove() {
    const meal = meals[currentIndex];
    const newCorrections = { ...corrections, [`${meal.day}_${meal.type}`]: 'APPROVED' };
    setCorrections(newCorrections);
    setCorrectionText('');
    if (currentIndex < meals.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      finalizeAndSave(newCorrections);
    }
  }

  function handleCorrect() {
    if (!correctionText.trim()) return;
    const meal = meals[currentIndex];
    const newCorrections = { ...corrections, [`${meal.day}_${meal.type}`]: correctionText };
    setCorrections(newCorrections);
    setCorrectionText('');
    if (currentIndex < meals.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      finalizeAndSave(newCorrections);
    }
  }

  async function finalizeAndSave(finalCorrections) {
    setPhase('saving');
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${airtableId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: 'APPROVED', corrections: JSON.stringify(finalCorrections) } })
      });
      setPhase('done');
    } catch (e) { setPhase('error'); }
  }

  const meal = meals[currentIndex];

  if (phase === 'loading') return <div style={s.center}>⏳ Loading Charlie's menu...</div>;
  if (phase === 'notfound') return <div style={s.center}>🔍 Review not found.</div>;
  if (phase === 'error') return <div style={s.center}>⚠️ Something went wrong.</div>;
  if (phase === 'saving') return <div style={s.center}>💾 Saving...</div>;

  if (phase === 'done') return (
    <div style={s.page}>
      <div style={s.header}><h1 style={s.headerTitle}>🌟 Charlie's Meals</h1></div>
      <div style={s.content}>
        <div style={s.card}>
          <div style={{...s.cardHeader, textAlign:'center'}}>
            <div style={{fontSize:'3rem'}}>✅</div>
            <h2 style={{color:'white', margin:'0.5rem 0'}}>All meals approved!</h2>
            <p style={{color:'rgba(255,255,255,0.8)', margin:0}}>Kindergarten message ready</p>
          </div>
          <div style={s.cardBody}>
            <div style={s.sectionTitle}>MESSAGE FOR KITA</div>
            <div style={s.kitaMessage}>{record?.kindergarten_message?.replace(/\\n/g, '\n')}</div>
            <button style={s.copyBtn} onClick={() => {
              navigator.clipboard.writeText(record?.kindergarten_message?.replace(/\\n/g, '\n') || '');
              alert('Copied! 📋');
            }}>📋 Copy to clipboard</button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!meal) return null;

  const mealData = meal.data;
  const carbFoods = mealData?.carb_foods || [];
  const freeFoods = mealData?.free_foods || [];
  const totalCarbs = mealData?.total_carbs_g || mealData?.carb_target_g || '—';
  const nachschlag = mealData?.nachschlag;
  const glycemicSpeed = mealData?.glycemic_speed_meal || mealData?.glycemic_speed || '';

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.headerTitle}>🩺 Charlie's Meal Review</h1>
          <p style={s.headerSub}>{record?.email_subject}</p>
        </div>
      </div>
      <div style={s.progress}>
        {meals.map((m, i) => (
          <div key={i} style={{...s.dot, background: i < currentIndex ? '#4f46e5' : i === currentIndex ? '#818cf8' : '#e5e7eb', color: i <= currentIndex ? 'white' : '#9ca3af'}}>
            {i + 1}
          </div>
        ))}
        <span style={{marginLeft:'auto', fontSize:'0.8rem', color:'#9ca3af'}}>{currentIndex + 1} of {meals.length}</span>
      </div>
      <div style={s.content}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <div style={s.dayBadge}>{meal.day}</div>
            <h2 style={s.mealName}>{mealData?.dish_name || meal.type}</h2>
            <p style={s.mealType}>
              {meal.type === 'Zmittag' ? '🍽 Lunch' : '🍎 Afternoon Snack'}
              {glycemicSpeed && <span style={{...s.speedBadge, background: glycemicSpeed==='fast'?'#fee2e2':glycemicSpeed==='slow'?'#d1fae5':'#f3f4f6', color: glycemicSpeed==='fast'?'#991b1b':glycemicSpeed==='slow'?'#065f46':'#6b7280'}}>{glycemicSpeed}</span>}
            </p>
          </div>
          <div style={s.cardBody}>
            {mealData?.mode_applied && (
              <div style={s.section}>
                <div style={s.sectionTitle}>CALCULATION METHOD</div>
                <div style={s.modeBox}>
                  <span style={s.modeBadge}>{mealData.mode_applied}</span>
                  <span style={{fontSize:'0.85rem', color:'#4b5563'}}>Target: {mealData.carb_target_g}g carbs</span>
                </div>
              </div>
            )}
            {carbFoods.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>CARB COMPONENTS</div>
                {carbFoods.map((f, i) => (
                  <div key={i} style={s.row}>
                    <span style={{color:'#374151'}}>{f.food} <span style={{color:'#9ca3af', fontSize:'0.8rem'}}>({f.portion_g}g)</span></span>
                    <span style={{fontWeight:700, color:'#4f46e5'}}>{f.carbs_g}g</span>
                  </div>
                ))}
              </div>
            )}
            {freeFoods.length > 0 && (
              <div style={s.section}>
                <div style={s.sectionTitle}>FREE FOODS</div>
                {freeFoods.map((f, i) => (
                  <div key={i} style={s.row}>
                    <span style={{color:'#374151'}}>{f.food}</span>
                    <span style={{color:'#9ca3af'}}>{f.portion_g}g</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{...s.row, fontWeight:700, fontSize:'1rem', borderBottom:'none', paddingTop:'0.8rem'}}>
              <span>Total carbs</span>
              <span style={{color:'#4f46e5'}}>{totalCarbs}g</span>
            </div>
            {nachschlag && (
              <div style={s.nachschlag}>
                🔁 <strong>Nachschlag:</strong> {nachschlag.portion_g}g = +{nachschlag.additional_carbs_g}g carbs
              </div>
            )}
          </div>
          <div style={s.actions}>
            <textarea style={s.textarea} placeholder="Add a correction if needed (optional)..." value={correctionText} onChange={e => setCorrectionText(e.target.value)} rows={2} />
            <div style={s.btnRow}>
              <button style={s.btnApprove} onClick={handleApprove}>✅ Approve</button>
              <button style={{...s.btnCorrect, opacity: correctionText.trim() ? 1 : 0.4}} onClick={handleCorrect} disabled={!correctionText.trim()}>✏️ Correct & Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight:'100vh', background:'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)', fontFamily:"'Georgia', serif" },
  center: { textAlign:'center', padding:'4rem', fontFamily:'sans-serif', color:'#6b7280', fontSize:'1.2rem' },
  header: { background:'white', borderBottom:'3px solid #4f46e5', padding:'1.2rem 2rem' },
  headerTitle: { margin:0, fontSize:'1.3rem', fontWeight:700, color:'#1e1b4b' },
  headerSub: { margin:0, fontSize:'0.85rem', color:'#6b7280' },
  progress: { background:'white', padding:'1rem 2rem', borderBottom:'1px solid #e5e7eb', display:'flex', gap:'0.5rem', alignItems:'center' },
  dot: { width:32, height:32, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700 },
  content: { maxWidth:640, margin:'2rem auto', padding:'0 1rem' },
  card: { background:'white', borderRadius:20, boxShadow:'0 4px 24px rgba(79,70,229,0.08)', overflow:'hidden', marginBottom:'1.5rem' },
  cardHeader: { background:'linear-gradient(135deg, #4f46e5, #7c3aed)', padding:'1.5rem 2rem', color:'white' },
  dayBadge: { display:'inline-block', background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'0.2rem 0.8rem', fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:'0.5rem' },
  mealName: { margin:0, fontSize:'1.4rem', fontWeight:700, lineHeight:1.3 },
  mealType: { margin:'0.3rem 0 0', opacity:0.8, fontSize:'0.9rem' },
  speedBadge: { display:'inline-block', borderRadius:20, padding:'0.15rem 0.6rem', fontSize:'0.7rem', fontWeight:700, marginLeft:'0.5rem' },
  cardBody: { padding:'1.5rem 2rem' },
  section: { marginBottom:'1.2rem' },
  sectionTitle: { fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.1em', color:'#9ca3af', marginBottom:'0.5rem' },
  modeBox: { background:'#f0f4ff', borderRadius:10, padding:'0.8rem 1rem', display:'flex', gap:'1rem', alignItems:'center' },
  modeBadge: { background:'#4f46e5', color:'white', borderRadius:8, padding:'0.2rem 0.6rem', fontSize:'0.8rem', fontWeight:700 },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0', borderBottom:'1px solid #f3f4f6', fontSize:'0.9rem' },
  nachschlag: { background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'0.8rem 1rem', fontSize:'0.85rem', color:'#92400e', marginTop:'1rem' },
  actions: { padding:'1.5rem 2rem', background:'#fafafa', borderTop:'1px solid #f3f4f6' },
  textarea: { width:'100%', padding:'0.8rem 1rem', borderRadius:10, border:'2px solid #e5e7eb', fontSize:'0.9rem', fontFamily:'inherit', resize:'vertical', marginBottom:'1rem', outline:'none', boxSizing:'border-box' },
  btnRow: { display:'flex', gap:'0.8rem' },
  btnApprove: { flex:1, padding:'0.9rem', borderRadius:12, border:'none', background:'linear-gradient(135deg, #059669, #10b981)', color:'white', fontSize:'1rem', fontWeight:700, cursor:'pointer' },
  btnCorrect: { flex:1, padding:'0.9rem', borderRadius:12, border:'2px solid #e5e7eb', background:'white', color:'#374151', fontSize:'1rem', fontWeight:700, cursor:'pointer' },
  kitaMessage: { background:'#f0fdf4', border:'2px solid #86efac', borderRadius:12, padding:'1.2rem', fontSize:'0.9rem', lineHeight:1.6, whiteSpace:'pre-wrap', color:'#166534' },
  copyBtn: { marginTop:'1rem', padding:'0.8rem 2rem', borderRadius:12, border:'none', background:'#4f46e5', color:'white', fontSize:'0.9rem', fontWeight:700, cursor:'pointer', width:'100%' },
};
