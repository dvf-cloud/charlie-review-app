import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const AIRTABLE_TOKEN = process.env.NEXT_PUBLIC_AIRTABLE_TOKEN;
const AIRTABLE_BASE = process.env.NEXT_PUBLIC_AIRTABLE_BASE;
const AIRTABLE_TABLE = process.env.NEXT_PUBLIC_AIRTABLE_TABLE;

export default function ReviewPage() {
  const router = useRouter();
  const { runId } = router.query;

  const [record, setRecord] = useState(null);
  const [calculation, setCalculation] = useState(null);
  const [mealsJson, setMealsJson] = useState(null);
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
      setCalculation(calc);

      let mj = null;
      try { mj = JSON.parse(rec.fields.meals_json); } catch(e) {}
      setMealsJson(mj);

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
    setCorrections(prev => ({ ...prev, [`${meal.day}_${meal.type}`]: 'APPROVED' }));
    setCorrectionText('');
    if (currentIndex < meals.length - 1) { setCurrentIndex(i => i + 1); }
    else { finalizeAndSave(false); }
  }

  function handleCorrect() {
    if (!correctionText.trim()) return;
    const meal = meals[currentIndex];
    setCorrections(prev => ({ ...prev, [`${meal.day}_${meal.type}`]: correctionText }));
    setCorrectionText('');
    if (currentIndex < meals.length - 1) { setCurrentIndex(i => i + 1); }
    else { finalizeAndSave(true); }
  }

  async function finalizeAndSave(hasCorrectionsMade) {
    setPhase('saving');
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${airtableId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: hasCorrectionsMade ? 'CORRECTED' : 'APPROVED', corrections: JSON.stringify(corrections) } })
      });
      setPhase('done');
    } catch (e) { setPhase('error'); }
  }

  const BLUE = '#1a6fe8';
  const BLUE_LIGHT = '#e8f0fd';
  const GRAY_DARK = '#374151';
  const GRAY_MID = '#6b7280';
  const BORDER = '#e5e7eb';

  const roundCarbs = (v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v;

  const styles = {
    page: { minHeight: '100vh', background: '#f5f7fa', fontFamily: "'Georgia', serif" },
    header: { background: 'white', borderBottom: `2px solid ${BLUE}`, padding: '1rem 2rem', display: 'flex', alignItems: 'center' },
    headerTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 500, color: BLUE, letterSpacing: '-0.01em' },
    headerSub: { margin: '0.1rem 0 0', fontSize: '0.8rem', color: GRAY_MID },
    progress: { background: 'white', padding: '0.85rem 2rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: '0.5rem', alignItems: 'center' },
    progressDot: (i, corrected) => ({
      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.3s',
      background: i < currentIndex ? (corrected ? '#f97316' : '#16a34a') : i === currentIndex ? BLUE : '#e5e7eb',
      color: i <= currentIndex ? 'white' : '#9ca3af',
    }),
    content: { maxWidth: 660, margin: '2rem auto', padding: '0 1rem' },
    card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', overflow: 'hidden', marginBottom: '1.5rem' },
    cardHeader: { background: `linear-gradient(135deg, ${BLUE} 0%, #1557c0 100%)`, padding: '1.4rem 1.8rem', color: 'white' },
    dayBadge: { display: 'inline-block', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '0.18rem 0.7rem', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '0.4rem' },
    mealName: { margin: 0, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },
    mealTypeLine: { margin: '0.4rem 0 0', opacity: 0.88, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    speedBadge: (speed) => ({
      display: 'inline-block', borderRadius: 20, padding: '0.12rem 0.55rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
      background: speed === 'fast' ? 'rgba(254,226,226,0.9)' : 'rgba(209,250,229,0.9)',
      color: speed === 'fast' ? '#991b1b' : '#065f46',
    }),
    cardBody: { padding: '1.5rem 1.8rem' },
    sectionLabel: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '0.5rem', marginTop: 0 },
    approachBox: { background: BLUE_LIGHT, borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '1.4rem' },
    approachBadge: { background: BLUE, color: 'white', borderRadius: 7, padding: '0.18rem 0.55rem', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' },
    approachText: { fontSize: '0.85rem', color: '#1e3a6e', margin: 0, lineHeight: 1.4 },
    omnipodBar: { background: '#1e1b4b', borderRadius: 10, padding: '0.9rem 1.2rem', marginBottom: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' },
    omnipodLabel: { color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' },
    omnipodValue: { color: 'white', fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' },
    omnipodNote: { color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', marginTop: '0.15rem' },
    omnipodSpeed: (speed) => ({
      background: speed === 'fast' ? '#fee2e2' : '#d1fae5', color: speed === 'fast' ? '#991b1b' : '#065f46',
      borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap',
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.4rem' },
    th: { textAlign: 'left', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.4rem 0.5rem', borderBottom: `2px solid ${BORDER}` },
    thRight: { textAlign: 'right', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.4rem 0.5rem', borderBottom: `2px solid ${BORDER}` },
    td: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, verticalAlign: 'middle' },
    tdRight: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, textAlign: 'right', verticalAlign: 'middle' },
    tdCarbs: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: BLUE, fontWeight: 700, textAlign: 'right', verticalAlign: 'middle' },
    freeFoodsBox: { background: '#f9fafb', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.4rem' },
    freeFoodItem: { fontSize: '0.85rem', color: GRAY_MID, padding: '0.2rem 0', display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' },
    freeFoodName: { color: GRAY_DARK, fontWeight: 500 },
    nachschlagBox: { background: '#fef9ec', border: `1px solid #fde68a`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.4rem', fontSize: '0.85rem', color: '#78350f', lineHeight: 1.6 },
    parentalBox: { background: '#f3f4f6', borderRadius: 10, padding: '1rem 1.2rem', marginBottom: '1rem' },
    parentalText: { fontSize: '0.82rem', color: '#4b5563', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0, fontFamily: "'Georgia', serif" },
    actions: { padding: '1.2rem 1.8rem', background: '#fafafa', borderTop: `1px solid ${BORDER}` },
    correctionInput: { width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: `2px solid ${BORDER}`, fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.9rem', outline: 'none', boxSizing: 'border-box', color: GRAY_DARK },
    btnRow: { display: 'flex', gap: '0.75rem' },
    btnApprove: { flex: 1, padding: '0.85rem', borderRadius: 11, border: '2px solid #16a34a', background: '#f0fdf4', color: '#15803d', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },
    btnCorrect: (active) => ({ flex: 1, padding: '0.85rem', borderRadius: 11, border: `2px solid ${active ? '#f97316' : BORDER}`, background: active ? '#fff7ed' : 'white', color: active ? '#c2410c' : '#9ca3af', fontSize: '0.95rem', fontWeight: 600, cursor: active ? 'pointer' : 'default', transition: 'all 0.2s' }),
    doneCard: { background: 'white', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' },
    kitaMessage: { background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12, padding: '1.2rem', textAlign: 'left', fontSize: '0.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginTop: '1.5rem', color: '#166534' },
    copyBtn: { marginTop: '1rem', padding: '0.8rem 2rem', borderRadius: 11, border: 'none', background: BLUE, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', width: '100%' },
  };

  if (phase === 'loading') return <div style={styles.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⏳</div>Loading Charlie's menu...</div></div>;
  if (phase === 'notfound') return <div style={styles.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>🔍</div>Review not found.</div></div>;
  if (phase === 'error') return <div style={styles.page}><div style={{textAlign:'center',padding:'4rem',color:'#ef4444'}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⚠️</div>Something went wrong.</div></div>;
  if (phase === 'saving') return <div style={styles.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>💾</div>Saving your review...</div></div>;

  if (phase === 'done') return (
    <div style={styles.page}>
      <div style={styles.header}><div><h1 style={styles.headerTitle}>🩺 Charlie's Meal Review</h1><p style={styles.headerSub}>All meals reviewed</p></div></div>
      <div style={styles.content}>
        <div style={styles.doneCard}>
          <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>✅</div>
          <h2 style={{color:'#1e1b4b',marginBottom:'0.5rem',fontWeight:600}}>All done!</h2>
          <p style={{color:GRAY_MID,marginBottom:'1.5rem',fontSize:'0.9rem'}}>Message for the kindergarten:</p>
          <div style={styles.kitaMessage}>{record?.kindergarten_message?.replace(/\\n/g, '\n')}</div>
          <button style={styles.copyBtn} onClick={() => { navigator.clipboard.writeText(record?.kindergarten_message?.replace(/\\n/g, '\n') || ''); alert('Copied!'); }}>📋 Copy to clipboard</button>
        </div>
      </div>
    </div>
  );

  if (!meals.length) return null;
  const meal = meals[currentIndex];
  if (!meal) return null;

  const mealData = meal.data;
  const carbFoods = mealData?.carb_foods || [];
  const freeFoods = mealData?.free_foods || [];
  const totalCarbs = mealData?.total_carbs_g ?? mealData?.carb_target_g ?? '—';
  const nachschlag = mealData?.nachschlag;
  const glycemicSpeed = mealData?.glycemic_speed_meal || mealData?.glycemic_speed || '';
  const herleitung = mealsJson?.[meal.day]?.[meal.type]?.herleitung || null;
  const mealTypeLabel = meal.type === 'Zmittag' ? 'Lunch' : 'Afternoon Snack';
  const mealTypeEmoji = meal.type === 'Zmittag' ? '🍽' : '🍎';

  // Parse mode_applied — extract badge text and description
  const modeRaw = mealData?.mode_applied || '';
  const modeParts = modeRaw.split(/—|-(.+)/s);
  const modeBadge = modeParts[0]?.trim() || modeRaw;
  const modeDesc = modeParts.slice(1).join('').trim() || `Target: ${mealData?.carb_target_g}g carbs`;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🩺 Charlie's Meal Review</h1>
          <p style={styles.headerSub}>{record?.email_subject}</p>
        </div>
      </div>

      <div style={styles.progress}>
        {meals.map((m, i) => {
          const key = `${m.day}_${m.type}`;
          const corrected = corrections[key] && corrections[key] !== 'APPROVED';
          return <div key={i} style={styles.progressDot(i, corrected)} title={`${m.day} ${m.type}`}>{i + 1}</div>;
        })}
        <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'#9ca3af'}}>{currentIndex + 1} / {meals.length}</span>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>

          {/* HEADER */}
          <div style={styles.cardHeader}>
            <div style={styles.dayBadge}>{meal.day}</div>
            <h2 style={styles.mealName}>{mealData?.dish_name || meal.type}</h2>
            <div style={styles.mealTypeLine}>
              <span>{mealTypeEmoji} {mealTypeLabel}</span>
              {glycemicSpeed && (
                <span style={styles.speedBadge(glycemicSpeed)}>
                  {glycemicSpeed === 'fast' ? '⚡ Fast acting' : '🐢 Slow acting'}
                </span>
              )}
            </div>
          </div>

          <div style={styles.cardBody}>

            {/* MEAL APPROACH */}
            {modeRaw && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={styles.sectionLabel}>Meal Approach</div>
                <div style={styles.approachBox}>
                  <span style={styles.approachBadge}>{modeBadge}</span>
                  <p style={styles.approachText}>{modeDesc}</p>
                </div>
              </div>
            )}

            {/* OMNIPOD */}
            <div style={styles.omnipodBar}>
              <div>
                <div style={styles.omnipodLabel}>Omnipod — Enter carbs</div>
                <div style={styles.omnipodValue}>{roundCarbs(totalCarbs)}g</div>
                <div style={styles.omnipodNote}>Do not click "Sensordaten verwenden" unless instructed</div>
              </div>
              {glycemicSpeed && (
                <div style={styles.omnipodSpeed(glycemicSpeed)}>
                  {glycemicSpeed === 'fast' ? '⏱ Wait 10 min' : '✓ No wait needed'}
                </div>
              )}
            </div>

            {/* CARB CALCULATION TABLE */}
            {carbFoods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={styles.sectionLabel}>Carb Calculation</div>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Ingredient</th>
                      <th style={styles.thRight}>Total weight</th>
                      <th style={styles.thRight}>g / 100g</th>
                      <th style={styles.thRight}>Total carbs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carbFoods.map((f, i) => (
                      <tr key={i}>
                        <td style={styles.td}>{f.food}</td>
                        <td style={styles.tdRight}>{f.portion_g}g</td>
                        <td style={styles.tdRight}>{f.carbs_per_100g}g</td>
                        <td style={styles.tdCarbs}>{roundCarbs(f.carbs_g)}g</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{...styles.td, fontWeight:700, borderTop:`2px solid ${BORDER}`, borderBottom:'none'}}>Total</td>
                      <td style={{...styles.tdRight, borderTop:`2px solid ${BORDER}`, borderBottom:'none'}}></td>
                      <td style={{...styles.tdRight, borderTop:`2px solid ${BORDER}`, borderBottom:'none'}}></td>
                      <td style={{...styles.tdCarbs, fontWeight:700, fontSize:'1rem', borderTop:`2px solid ${BORDER}`, borderBottom:'none'}}>{roundCarbs(totalCarbs)}g</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* CARB-FREE FOODS */}
            {freeFoods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={styles.sectionLabel}>Carb-Free Foods</div>
                <div style={styles.freeFoodsBox}>
                  {freeFoods.map((f, i) => (
                    <div key={i} style={styles.freeFoodItem}>
                      <span style={styles.freeFoodName}>{f.food}</span>
                      <span style={{color:'#9ca3af', fontSize:'0.8rem'}}>{f.portion_g}g — {f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NACHSCHLAG */}
            {nachschlag && nachschlag.carb_foods && nachschlag.carb_foods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={styles.sectionLabel}>Nachschlag</div>
                <div style={styles.nachschlagBox}>
                  {nachschlag.carb_foods.map((f, i) => (
                    <div key={i}>
                      +{f.portion_g}g {f.food} → enter additional <strong>{roundCarbs(f.carbs_g)}g carbs</strong> in Omnipod
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PARENTAL CONTROL */}
            {herleitung && (
              <div style={{marginBottom:'0.5rem'}}>
                <div style={styles.sectionLabel}>Parental Control</div>
                <div style={styles.parentalBox}>
                  <p style={styles.parentalText}>{herleitung}</p>
                </div>
              </div>
            )}

          </div>

          {/* ACTIONS */}
          <div style={styles.actions}>
            <textarea
              style={styles.correctionInput}
              placeholder="Add a correction if needed (optional)..."
              value={correctionText}
              onChange={e => setCorrectionText(e.target.value)}
              rows={2}
            />
            <div style={styles.btnRow}>
              <button style={styles.btnApprove} onClick={handleApprove}>✅ Approve</button>
              <button style={styles.btnCorrect(!!correctionText.trim())} onClick={handleCorrect} disabled={!correctionText.trim()}>✏️ Correct & Next</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
