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

  useEffect(() => { if (!runId) return; fetchRecord(); }, [runId]);

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
    if (currentIndex < meals.length - 1) setCurrentIndex(i => i + 1);
    else finalizeAndSave(false);
  }

  function handleCorrect() {
    if (!correctionText.trim()) return;
    const meal = meals[currentIndex];
    setCorrections(prev => ({ ...prev, [`${meal.day}_${meal.type}`]: correctionText }));
    setCorrectionText('');
    if (currentIndex < meals.length - 1) setCurrentIndex(i => i + 1);
    else finalizeAndSave(true);
  }

  async function finalizeAndSave(hadCorrections) {
    setPhase('saving');
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${airtableId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { status: hadCorrections ? 'CORRECTED' : 'APPROVED', corrections: JSON.stringify(corrections) } })
      });
      setPhase('done');
    } catch (e) { setPhase('error'); }
  }

  // Parse herleitung — extract only DISH UNDERSTANDING and CARB CALCULATION sections,
  // strip headers already shown in UI, add bullets to calc lines
  function parseHerleitung(text) {
    if (!text) return null;

    // Remove sections we show elsewhere: day/meal header, RULE APPLIED, GLYCEMIC SPEED, OMNIPOD line
    const skipPatterns = [
      /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY).*/im,
      /^RULE APPLIED[\s\S]*?(?=\n[A-Z])/im,
      /^GLYCEMIC SPEED[\s\S]*?(?=\n[A-Z→]|$)/im,
      /^→\s*OMNIPOD.*$/im,
    ];

    // Extract DISH UNDERSTANDING block
    const dishMatch = text.match(/DISH UNDERSTANDING\n([\s\S]*?)(?=\n[A-Z ]{3,}:|CARB CALCULATION|NOT COUNTED|NACHSCHLAG|GLYCEMIC|→ OMNIPOD|$)/i);
    const dishText = dishMatch ? dishMatch[1].trim() : null;

    // Extract CARB CALCULATION block
    const carbMatch = text.match(/CARB CALCULATION\n([\s\S]*?)(?=\nNOT COUNTED|\nNACHSCHLAG|\nGLYCEMIC|\n→ OMNIPOD|$)/i);
    const carbRaw = carbMatch ? carbMatch[1].trim() : null;

    // Process carb lines — add bullet to ingredient lines (lines with ×)
    let carbLines = null;
    if (carbRaw) {
      carbLines = carbRaw.split('\n').map(line => {
        const l = line.trim();
        if (!l) return null;
        // Lines with × or = are calculation lines → bullet
        if (l.includes('×') || (l.includes('=') && l.includes('g'))) return { type: 'bullet', text: l };
        // Total/summary lines
        return { type: 'text', text: l };
      }).filter(Boolean);
    }

    return { dishText, carbLines };
  }

  const BLUE = '#1a6fe8';
  const BLUE_LIGHT = '#e8f0fd';
  const GRAY_DARK = '#374151';
  const GRAY_MID = '#6b7280';
  const BORDER = '#e5e7eb';
  const roundCarbs = (v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v;

  const S = {
    page: { minHeight: '100vh', background: 'white', fontFamily: "'Georgia', serif" },
    header: { background: 'white', borderBottom: `2px solid ${BLUE}`, padding: '1rem 2rem' },
    headerTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 500, color: BLUE, letterSpacing: '-0.01em' },
    headerSub: { margin: '0.1rem 0 0', fontSize: '0.8rem', color: GRAY_MID },
    progress: { background: 'white', padding: '0.85rem 2rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: '0.5rem', alignItems: 'center' },
    progressDot: (i, corrected) => ({
      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.3s',
      background: i < currentIndex ? (corrected ? '#f97316' : '#16a34a') : i === currentIndex ? BLUE : '#e5e7eb',
      color: i <= currentIndex ? 'white' : '#9ca3af',
    }),
    content: { maxWidth: 660, margin: '2rem auto', padding: '0 1rem 3rem' },
    card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem', border: `1px solid ${BORDER}` },

    // Card header
    cardHeader: { background: `linear-gradient(135deg, ${BLUE} 0%, #1254c0 100%)`, padding: '1.4rem 1.8rem', color: 'white' },
    bubbleRow: { display: 'flex', gap: '0.5rem', marginBottom: '0.7rem', alignItems: 'center' },
    bubble: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '0.22rem 0.75rem', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.02em' },
    mealName: { margin: 0, fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em' },

    cardBody: { padding: '1.5rem 1.8rem' },
    sectionLabel: { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '0.6rem', marginTop: 0 },

    // Meal Calculation Approach — two options side by side
    approachRow: { display: 'flex', gap: '0.6rem', marginBottom: '1.4rem' },
    approachOption: (active) => ({
      flex: 1, borderRadius: 10, padding: '0.7rem 0.9rem', textAlign: 'center', border: `2px solid ${active ? BLUE : BORDER}`,
      background: active ? BLUE_LIGHT : '#fafafa', transition: 'all 0.2s',
    }),
    approachOptionLabel: (active) => ({ fontSize: '0.75rem', fontWeight: 700, color: active ? BLUE : '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase' }),
    approachOptionDesc: (active) => ({ fontSize: '0.78rem', color: active ? '#1e3a6e' : '#9ca3af', marginTop: '0.2rem', lineHeight: 1.3 }),

    // Carb table
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0' },
    th: { textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.4rem 0.5rem', borderBottom: `2px solid ${BORDER}` },
    thRight: { textAlign: 'right', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.4rem 0.5rem', borderBottom: `2px solid ${BORDER}` },
    td: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, verticalAlign: 'middle', fontSize: '0.85rem' },
    tdRight: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, textAlign: 'right', verticalAlign: 'middle', fontSize: '0.85rem' },
    tdCarbs: { padding: '0.5rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: BLUE, fontWeight: 700, textAlign: 'right', verticalAlign: 'middle', fontSize: '0.85rem' },
    tdFree: { padding: '0.4rem 0.5rem', borderBottom: `1px solid #f3f4f6`, color: '#9ca3af', verticalAlign: 'middle', fontSize: '0.82rem', fontStyle: 'italic' },

    // Omnipod bar — 3 columns side by side
    omnipodBar: { background: '#0f172a', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' },
    omnipodCell: { padding: '0.2rem 0' },
    omnipodCellLabel: { color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' },
    omnipodCellValue: { color: 'white', fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.02em' },
    omnipodCellSub: { color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', marginTop: '0.15rem', lineHeight: 1.3 },
    omnipodDivider: { width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 0.2rem' },

    // Nachschlag
    nachschlagBox: { background: '#fef9ec', border: `1px solid #fde68a`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.4rem', fontSize: '0.85rem', color: '#78350f', lineHeight: 1.6 },

    // Parental control
    parentalBox: { background: '#f8f9fa', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '1.1rem 1.2rem', marginBottom: '1rem' },
    parentalDishText: { fontSize: '0.83rem', color: '#4b5563', lineHeight: 1.7, margin: '0 0 0.8rem 0' },
    parentalCarbHeader: { fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: '0.4rem' },
    parentalBulletList: { margin: '0', padding: '0 0 0 1.2rem', listStyle: 'disc' },
    parentalBulletItem: { fontSize: '0.82rem', color: '#374151', lineHeight: 1.6, padding: '0.05rem 0' },
    parentalTextLine: { fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6, marginTop: '0.3rem', fontStyle: 'italic' },

    actions: { padding: '1.2rem 1.8rem', background: '#fafafa', borderTop: `1px solid ${BORDER}` },
    correctionInput: { width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: `2px solid ${BORDER}`, fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.9rem', outline: 'none', boxSizing: 'border-box', color: GRAY_DARK },
    btnRow: { display: 'flex', gap: '0.75rem' },
    btnApprove: { flex: 1, padding: '0.85rem', borderRadius: 11, border: '2px solid #16a34a', background: '#f0fdf4', color: '#15803d', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },
    btnCorrect: (active) => ({ flex: 1, padding: '0.85rem', borderRadius: 11, border: `2px solid ${active ? '#f97316' : BORDER}`, background: active ? '#fff7ed' : 'white', color: active ? '#c2410c' : '#9ca3af', fontSize: '0.95rem', fontWeight: 600, cursor: active ? 'pointer' : 'default', transition: 'all 0.2s' }),
    doneCard: { background: 'white', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}` },
    kitaMessage: { background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12, padding: '1.2rem', textAlign: 'left', fontSize: '0.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginTop: '1.5rem', color: '#166534' },
    copyBtn: { marginTop: '1rem', padding: '0.8rem 2rem', borderRadius: 11, border: 'none', background: BLUE, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', width: '100%' },
  };

  // Loading states
  if (phase === 'loading') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⏳</div>Loading Charlie's menu...</div></div>;
  if (phase === 'notfound') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>🔍</div>Review not found.</div></div>;
  if (phase === 'error') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:'#ef4444'}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⚠️</div>Something went wrong.</div></div>;
  if (phase === 'saving') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>💾</div>Saving your review...</div></div>;

  if (phase === 'done') return (
    <div style={S.page}>
      <div style={S.header}><div><h1 style={S.headerTitle}>🩺 Charlie's Meal Review</h1><p style={S.headerSub}>All meals reviewed</p></div></div>
      <div style={S.content}>
        <div style={S.doneCard}>
          <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>✅</div>
          <h2 style={{color:'#1e1b4b',marginBottom:'0.5rem',fontWeight:600}}>All done!</h2>
          <p style={{color:GRAY_MID,marginBottom:'1.5rem',fontSize:'0.9rem'}}>Message for the kindergarten:</p>
          <div style={S.kitaMessage}>{record?.kindergarten_message?.replace(/\\n/g, '\n')}</div>
          <button style={S.copyBtn} onClick={() => { navigator.clipboard.writeText(record?.kindergarten_message?.replace(/\\n/g, '\n') || ''); alert('Copied!'); }}>📋 Copy to clipboard</button>
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
  const totalCarbs = mealData?.total_carbs_g ?? mealData?.carb_target_g ?? 0;
  const nachschlag = mealData?.nachschlag;
  const glycemicSpeed = mealData?.glycemic_speed_meal || mealData?.glycemic_speed || '';
  const herleitung = mealsJson?.[meal.day]?.[meal.type]?.herleitung || null;
  const mealTypeLabel = meal.type === 'Zmittag' ? 'Lunch' : 'Afternoon Snack';
  const mealTypeEmoji = meal.type === 'Zmittag' ? '🍽️' : '🍎';
  const speedEmoji = glycemicSpeed === 'fast' ? '⚡' : '🐢';
  const speedLabel = glycemicSpeed === 'fast' ? 'Fast acting' : 'Slow acting';

  // Determine which approach options to show
  const modeRaw = mealData?.mode_applied || '';
  const isModeA = modeRaw.toLowerCase().includes('mode a');
  const isModeB = modeRaw.toLowerCase().includes('mode b');

  // Parse herleitung for parental control section
  const parsed = parseHerleitung(herleitung);

  // Rounded suggestion
  const roundedSuggestion = Math.round(roundCarbs(totalCarbs));

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h1 style={S.headerTitle}>🩺 Charlie's Meal Review</h1>
          <p style={S.headerSub}>{record?.email_subject}</p>
        </div>
      </div>

      {/* PROGRESS */}
      <div style={S.progress}>
        {meals.map((m, i) => {
          const key = `${m.day}_${m.type}`;
          const corrected = corrections[key] && corrections[key] !== 'APPROVED';
          return <div key={i} style={S.progressDot(i, corrected)} title={`${m.day} ${m.type}`}>{i + 1}</div>;
        })}
        <span style={{marginLeft:'auto',fontSize:'0.78rem',color:'#9ca3af'}}>{currentIndex + 1} / {meals.length}</span>
      </div>

      <div style={S.content}>
        <div style={S.card}>

          {/* CARD HEADER */}
          <div style={S.cardHeader}>
            {/* Two bubbles: Day | Meal type + speed */}
            <div style={S.bubbleRow}>
              <span style={S.bubble}>{meal.day}</span>
              <span style={S.bubble}>{mealTypeEmoji} {mealTypeLabel}</span>
              {glycemicSpeed && (
                <span style={{...S.bubble, background: glycemicSpeed === 'fast' ? 'rgba(254,226,226,0.85)' : 'rgba(209,250,229,0.85)', color: glycemicSpeed === 'fast' ? '#991b1b' : '#065f46'}}>
                  {speedEmoji} {speedLabel}
                </span>
              )}
            </div>
            <h2 style={S.mealName}>{mealData?.dish_name || meal.type}</h2>
          </div>

          <div style={S.cardBody}>

            {/* MEAL CALCULATION APPROACH */}
            <div style={{marginBottom:'1.4rem'}}>
              <div style={S.sectionLabel}>Meal Calculation Approach</div>
              <div style={S.approachRow}>
                {/* Mode A */}
                <div style={S.approachOption(isModeA)}>
                  <div style={S.approachOptionLabel(isModeA)}>Mode A</div>
                  <div style={S.approachOptionDesc(isModeA)}>Carb-target first<br/>pasta · rice · bread · quiche</div>
                </div>
                {/* Mode B */}
                <div style={S.approachOption(isModeB)}>
                  <div style={S.approachOptionLabel(isModeB)}>Mode B</div>
                  <div style={S.approachOptionDesc(isModeB)}>Weight-first<br/>potatoes · root vegetables</div>
                </div>
                {/* Blended */}
                <div style={S.approachOption(!isModeA && !isModeB)}>
                  <div style={S.approachOptionLabel(!isModeA && !isModeB)}>Blended</div>
                  <div style={S.approachOptionDesc(!isModeA && !isModeB)}>Mixed dish<br/>smoothie · soup · dip</div>
                </div>
              </div>
            </div>

            {/* CARB CALCULATION TABLE */}
            {carbFoods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={S.sectionLabel}>Carb Calculation</div>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Ingredient</th>
                      <th style={S.thRight}>Total weight</th>
                      <th style={S.thRight}>g / 100g</th>
                      <th style={S.thRight}>Total carbs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carbFoods.map((f, i) => (
                      <tr key={i}>
                        <td style={S.td}>{f.food}</td>
                        <td style={S.tdRight}>{f.portion_g}g</td>
                        <td style={S.tdRight}>{f.carbs_per_100g}g</td>
                        <td style={S.tdCarbs}>{roundCarbs(f.carbs_g)}g</td>
                      </tr>
                    ))}
                    {freeFoods.map((f, i) => (
                      <tr key={`free-${i}`}>
                        <td style={S.tdFree}>{f.food}</td>
                        <td style={{...S.tdFree, textAlign:'right'}}>{f.portion_g}g</td>
                        <td style={{...S.tdFree, textAlign:'right'}}>—</td>
                        <td style={{...S.tdFree, textAlign:'right'}}>free</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{...S.td, fontWeight:700, borderTop:`2px solid ${BORDER}`, borderBottom:'none', paddingTop:'0.7rem'}}>Total</td>
                      <td style={{...S.tdRight, borderTop:`2px solid ${BORDER}`, borderBottom:'none', paddingTop:'0.7rem'}}></td>
                      <td style={{...S.tdRight, borderTop:`2px solid ${BORDER}`, borderBottom:'none', paddingTop:'0.7rem'}}></td>
                      <td style={{...S.tdCarbs, fontWeight:700, fontSize:'0.95rem', borderTop:`2px solid ${BORDER}`, borderBottom:'none', paddingTop:'0.7rem'}}>{roundCarbs(totalCarbs)}g</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* OMNIPOD — 3 columns side by side */}
            <div style={{marginBottom:'1.4rem'}}>
              <div style={S.sectionLabel}>Omnipod Entry</div>
              <div style={S.omnipodBar}>
                {/* Col 1: exact carbs */}
                <div style={S.omnipodCell}>
                  <div style={S.omnipodCellLabel}>Enter carbs</div>
                  <div style={S.omnipodCellValue}>{roundCarbs(totalCarbs)}g</div>
                  <div style={S.omnipodCellSub}>or rounded: {roundedSuggestion}g</div>
                </div>
                {/* Col 2: speed + wait */}
                <div style={{...S.omnipodCell, borderLeft:'1px solid rgba(255,255,255,0.12)', paddingLeft:'0.9rem'}}>
                  <div style={S.omnipodCellLabel}>Acting speed</div>
                  <div style={S.omnipodCellValue}>{speedEmoji} {speedLabel}</div>
                  <div style={S.omnipodCellSub}>{glycemicSpeed === 'fast' ? 'Wait 10 min before meal' : 'No waiting needed'}</div>
                </div>
                {/* Col 3: warning */}
                <div style={{...S.omnipodCell, borderLeft:'1px solid rgba(255,255,255,0.12)', paddingLeft:'0.9rem'}}>
                  <div style={S.omnipodCellLabel}>Important</div>
                  <div style={{...S.omnipodCellValue, fontSize:'0.85rem', lineHeight:1.4, marginTop:'0.1rem'}}>⚠️ Do not use</div>
                  <div style={S.omnipodCellSub}>"Sensordaten verwenden" unless instructed</div>
                </div>
              </div>
            </div>

            {/* NACHSCHLAG */}
            {nachschlag && nachschlag.carb_foods && nachschlag.carb_foods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={S.sectionLabel}>Nachschlag</div>
                <div style={S.nachschlagBox}>
                  {nachschlag.carb_foods.map((f, i) => (
                    <div key={i}>
                      +{f.portion_g}g {f.food} → enter additional <strong>{roundCarbs(f.carbs_g)}g carbs</strong> in Omnipod
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PARENTAL CONTROL */}
            {parsed && (parsed.dishText || parsed.carbLines) && (
              <div style={{marginBottom:'0.5rem'}}>
                <div style={S.sectionLabel}>Parental Control</div>
                <div style={S.parentalBox}>
                  {/* Dish Understanding */}
                  {parsed.dishText && (
                    <p style={S.parentalDishText}><strong>Dish understanding</strong><br/>{parsed.dishText}</p>
                  )}
                  {/* Carb Calculation with bullets */}
                  {parsed.carbLines && parsed.carbLines.length > 0 && (
                    <div>
                      <div style={S.parentalCarbHeader}>Carb calculation</div>
                      <ul style={S.parentalBulletList}>
                        {parsed.carbLines.map((line, i) =>
                          line.type === 'bullet'
                            ? <li key={i} style={S.parentalBulletItem}>{line.text}</li>
                            : <div key={i} style={S.parentalTextLine}>{line.text}</div>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* ACTIONS */}
          <div style={S.actions}>
            <textarea
              style={S.correctionInput}
              placeholder="Add a correction if needed (optional)..."
              value={correctionText}
              onChange={e => setCorrectionText(e.target.value)}
              rows={2}
            />
            <div style={S.btnRow}>
              <button style={S.btnApprove} onClick={handleApprove}>✅ Approve</button>
              <button style={S.btnCorrect(!!correctionText.trim())} onClick={handleCorrect} disabled={!correctionText.trim()}>✏️ Correct & Next</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
