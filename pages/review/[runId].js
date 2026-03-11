import React, { useState, useEffect } from 'react';
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
  const [tableOpen, setTableOpen] = useState(false);
  const [extractedMenu, setExtractedMenu] = useState(null);
  const [nutritionData, setNutritionData] = useState(null);

  useEffect(() => { if (!runId) return; fetchRecord(); }, [runId]);
  useEffect(() => { setTableOpen(false); }, [currentIndex]);

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
      let em = null;
      try { em = typeof rec.fields.extracted_menu === 'string' ? JSON.parse(rec.fields.extracted_menu) : rec.fields.extracted_menu; } catch(e) {}
      setExtractedMenu(em);
      let nd = null;
      try { nd = typeof rec.fields.nutrition_data === 'string' ? JSON.parse(rec.fields.nutrition_data) : rec.fields.nutrition_data; } catch(e) {}
      setNutritionData(nd);
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

  // Parse herleitung — extract DISH UNDERSTANDING and CARB CALCULATION only
  function parseHerleitung(text) {
    if (!text) return null;
    const dishMatch = text.match(/DISH UNDERSTANDING\n([\s\S]*?)(?=\nCARB CALCULATION|\nNOT COUNTED|\nNACHSCHLAG|\nGLYCEMIC|→ OMNIPOD|$)/i);
    const dishText = dishMatch ? dishMatch[1].trim() : null;
    const carbMatch = text.match(/CARB CALCULATION\n([\s\S]*?)(?=\nNOT COUNTED|\nNACHSCHLAG|\nGLYCEMIC|\n→ OMNIPOD|$)/i);
    const carbRaw = carbMatch ? carbMatch[1].trim() : null;
    let carbLines = null;
    if (carbRaw) {
      carbLines = carbRaw.split('\n').map(line => {
        const l = line.trim();
        if (!l) return null;
        if (l.includes('×') || (l.includes('=') && l.includes('g'))) return { type: 'bullet', text: l };
        return { type: 'text', text: l };
      }).filter(Boolean);
    }
    return { dishText, carbLines };
  }

  const BLUE = '#1a6fe8';
  const BLUE_LIGHT = '#e8f0fd';
  const BLUE_BORDER = '#93c5fd';
  const GRAY_DARK = '#374151';
  const GRAY_MID = '#6b7280';
  const BORDER = '#e5e7eb';
  const roundCarbs = (v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v;
  const cleanFoodName = (name) => (name || '').replace(/\s*\([^)]*\)/g, '').trim();
  const roundInt = (v) => typeof v === 'number' ? Math.round(v) : v;

  const S = {
    page: { minHeight: '100vh', background: 'white', fontFamily: "'Georgia', serif" },
    header: { background: 'white', borderBottom: `2px solid ${BLUE}`, padding: '1rem 2rem' },
    headerTitle: { margin: 0, fontSize: '1.05rem', fontWeight: 500, color: BLUE },
    headerSub: { margin: '0.1rem 0 0', fontSize: '0.8rem', color: GRAY_MID },
    progress: { background: 'white', padding: '0.85rem 2rem', borderBottom: `1px solid ${BORDER}`, display: 'flex', gap: '0.5rem', alignItems: 'center' },
    progressDot: (i, corrected) => ({
      width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.72rem', fontWeight: 700, transition: 'all 0.3s',
      background: i < currentIndex ? (corrected ? '#f97316' : '#16a34a') : i === currentIndex ? BLUE : '#e5e7eb',
      color: i <= currentIndex ? 'white' : '#9ca3af',
    }),
    content: { maxWidth: 660, margin: '2rem auto', padding: '0 1rem 3rem' },

    // Card — white bg, subtle shadow + border
    card: { background: 'white', borderRadius: 16, boxShadow: '0 2px 20px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem', border: `1px solid ${BORDER}` },

    // Blue pill row — ABOVE the dish name box, outside the blue section
    pillRow: { display: 'flex', gap: '0.5rem', padding: '1.4rem 1.8rem 0' },
    pill: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'white', color: BLUE, border: `2px solid ${BLUE}`, borderRadius: 10, padding: '0.25rem 0.85rem', fontSize: '0.8rem', fontWeight: 600 },

    // Dish name box — white bg, blue border (inverted from before)
    dishBox: { margin: '0.6rem 1.8rem 0', padding: '0.6rem 0 0' },
    mealName: { margin: 0, fontSize: '1.2rem', fontWeight: 600, lineHeight: 1.3, color: '#1f2937' },

    cardBody: { padding: '1.4rem 1.8rem' },

    // Section labels — dark, heavier
    sectionLabel: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1f2937', marginBottom: '0.6rem', marginTop: 0 },

    // Meal Calculation Approach — TWO options only
    approachRow: { display: 'flex', gap: '0.6rem', marginBottom: '1.4rem' },
    approachOption: (active) => ({
      flex: 1, borderRadius: 10, padding: '0.8rem 1rem', border: `2px solid ${active ? BLUE : BORDER}`,
      background: active ? BLUE_LIGHT : '#fafafa',
    }),
    approachOptionTitle: (active) => ({ fontSize: '0.82rem', fontWeight: 700, color: active ? BLUE : '#b0b8c4', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }),
    approachOptionDesc: (active) => ({ fontSize: '0.8rem', color: active ? '#1e3a6e' : '#b0b8c4', lineHeight: 1.35 }),

    // Omnipod — light blue, 3 cols
    omnipodBar: {
      background: BLUE_LIGHT, border: `1.5px solid ${BLUE_BORDER}`, borderRadius: 12,
      padding: '1rem 1.2rem', marginBottom: '1.4rem',
      display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', gap: '0',
    },
    omnipodDivider: { background: BLUE_BORDER, margin: '0 0.8rem' },
    omnipodCell: { padding: '0 0.6rem' },
    omnipodCellFirst: { padding: '0 0.6rem 0 0' },
    omnipodCellLabel: { color: GRAY_MID, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.3rem' },
    omnipodText: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 400, lineHeight: 1.5 },
    omnipodRounded: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'underline', display: 'inline' },
    omnipodCalc: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 400 },
    omnipodCellValue: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 400 },
    omnipodCellSub: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 400, lineHeight: 1.5 },
    omnipodCellEmphasis: { color: '#1e1b4b', fontSize: '0.85rem', fontWeight: 400, lineHeight: 1.5 },

    // Nachschlag — light blue box
    nachschlagBox: { background: BLUE_LIGHT, border: `1.5px solid ${BLUE_BORDER}`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.4rem', fontSize: '0.88rem', color: '#1e3a6e', lineHeight: 1.65 },

    // Parental control
    parentalBox: { background: '#f8f9fa', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '1.1rem 1.3rem', marginBottom: '1.4rem' },
    parentalSubLabel: { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#1f2937', marginBottom: '0.4rem' },
    parentalDishText: { fontSize: '0.83rem', color: '#374151', lineHeight: 1.75, margin: '0 0 1rem 0' },
    parentalBulletList: { margin: '0.3rem 0 0', padding: '0 0 0 1.2rem', listStyle: 'disc' },
    parentalBulletItem: { fontSize: '0.82rem', color: '#374151', lineHeight: 1.7 },
    parentalTextLine: { fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.6, marginTop: '0.3rem', fontStyle: 'italic' },

    // Ingredient table toggle + table
    tableToggleBtn: { width: '100%', background: 'none', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '0.7rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: BLUE, cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', fontFamily: "'Georgia', serif" },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', marginBottom: '1.4rem', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` },
    th: { textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.5rem 0.7rem', borderBottom: `2px solid ${BORDER}`, background: '#f9fafb' },
    thRight: { textAlign: 'right', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af', padding: '0.5rem 0.7rem', borderBottom: `2px solid ${BORDER}`, background: '#f9fafb' },
    td: { padding: '0.5rem 0.7rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, verticalAlign: 'middle' },
    tdRight: { padding: '0.5rem 0.7rem', borderBottom: `1px solid #f3f4f6`, color: GRAY_DARK, textAlign: 'right', verticalAlign: 'middle' },
    tdCarbs: { padding: '0.5rem 0.7rem', borderBottom: `1px solid #f3f4f6`, color: BLUE, fontWeight: 700, textAlign: 'right', verticalAlign: 'middle' },
    tdFree: { padding: '0.5rem 0.7rem', borderBottom: `1px solid #f3f4f6`, color: '#9ca3af', fontStyle: 'italic', textAlign: 'right', verticalAlign: 'middle', fontSize: '0.78rem' },
    tdTotalLabel: { padding: '0.6rem 0.7rem', color: '#111827', fontWeight: 700, background: '#f9fafb', borderTop: `2px solid ${BORDER}`, borderBottom: 'none' },
    tdTotalRight: { padding: '0.6rem 0.7rem', color: '#111827', fontWeight: 700, textAlign: 'right', background: '#f9fafb', borderTop: `2px solid ${BORDER}`, borderBottom: 'none' },
    tdTotalCarbs: { padding: '0.6rem 0.7rem', color: BLUE, fontWeight: 700, fontSize: '0.95rem', textAlign: 'right', background: '#f9fafb', borderTop: `2px solid ${BORDER}`, borderBottom: 'none' },

    actions: { padding: '1.2rem 1.8rem', background: '#fafafa', borderTop: `1px solid ${BORDER}` },
    correctionInput: { width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: `2px solid ${BORDER}`, fontSize: '0.88rem', fontFamily: 'inherit', resize: 'vertical', marginBottom: '0.9rem', outline: 'none', boxSizing: 'border-box', color: GRAY_DARK },
    btnRow: { display: 'flex', gap: '0.75rem' },
    btnApprove: { flex: 1, padding: '0.85rem', borderRadius: 11, border: '2px solid #16a34a', background: '#f0fdf4', color: '#15803d', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' },
    btnCorrect: (active) => ({ flex: 1, padding: '0.85rem', borderRadius: 11, border: `2px solid ${active ? '#f97316' : BORDER}`, background: active ? '#fff7ed' : 'white', color: active ? '#c2410c' : '#9ca3af', fontSize: '0.95rem', fontWeight: 600, cursor: active ? 'pointer' : 'default', transition: 'all 0.2s' }),
    doneCard: { background: 'white', borderRadius: 16, padding: '2.5rem 2rem', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', border: `1px solid ${BORDER}` },
    kitaMessage: { background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12, padding: '1.2rem', textAlign: 'left', fontSize: '0.88rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', marginTop: '1.5rem', color: '#166534' },
    copyBtn: { marginTop: '1rem', padding: '0.8rem 2rem', borderRadius: 11, border: 'none', background: BLUE, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', width: '100%' },
  };

  if (phase === 'loading') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⏳</div>Loading Charlie's menu...</div></div>;
  if (phase === 'notfound') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>🔍</div>Review not found.</div></div>;
  if (phase === 'error') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:'#ef4444'}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>⚠️</div>Something went wrong.</div></div>;
  if (phase === 'saving') return <div style={S.page}><div style={{textAlign:'center',padding:'4rem',color:GRAY_MID}}><div style={{fontSize:'2rem',marginBottom:'1rem'}}>💾</div>Saving your review...</div></div>;

  if (phase === 'done') return (
    <div style={S.page}>
      <div style={S.header}><div><h1 style={S.headerTitle}>🩺 Charlie's Meal Review</h1><p style={S.headerSub}>All meals reviewed</p></div></div>
      <div style={S.content}>
        <div style={{...S.doneCard, marginTop:'1rem'}}>
          <div style={{fontSize:'2.5rem',marginBottom:'0.75rem'}}>✅</div>
          <h2 style={{color:'#1e1b4b',marginBottom:'0.5rem',fontWeight:600}}>All done!</h2>
          <p style={{color:GRAY_MID,marginBottom:'1.5rem',fontSize:'0.9rem'}}>Message for the kindergarten:</p>
          <div style={S.kitaMessage}>{
            (() => {
              const msg = (record?.kindergarten_message || '').replace(/\\n/g, '\n');
              const closing = 'Please tell us if Charlotte did not finish her portion. Do not force her to eat — if she does not feel like eating, that is completely fine.';
              const sensorWarning = '⚠️ Do not use "Sensordaten verwenden" unless instructed otherwise.';
              const stripped = msg.split(closing).join('').split(sensorWarning).join('').replace(/\n{3,}/g, '\n\n').trim();
              return stripped + '\n\n' + sensorWarning + '\n\n' + closing;
            })()
          }</div>
          <button style={S.copyBtn} onClick={() => { navigator.clipboard.writeText(record?.kindergarten_message?.replace(/\\n/g, '\n') || ''); alert('Copied!'); }}>📋 Copy to clipboard</button>
        </div>
      </div>
    </div>
  );

  if (!meals.length) return null;
  const meal = meals[currentIndex];
  if (!meal) return null;

  // === DATA — identical to v7, untouched ===
  const mealData = meal.data;
  const carbFoods = mealData?.carb_foods || [];
  const freeFoods = mealData?.free_foods || [];
  const totalCarbs = mealData?.total_carbs_g ?? mealData?.carb_target_g ?? 0;
  // Charlie's carb foods — cleaned names, individual portions
  const carbFoodItems = (mealData?.carb_foods || []).map(f => ({
    ...f,
    cleanName: cleanFoodName(f.food)
  }));
  const portionSize = Math.round(carbFoodItems.reduce((s, f) => s + (f.portion_g || 0), 0));
  const freeFoodNames = (mealData?.free_foods || []).map(f => cleanFoodName(f.food)).join(', ');
  const nachschlag = mealData?.nachschlag;
  const glycemicSpeed = mealData?.glycemic_speed_meal || mealData?.glycemic_speed || '';
  const herleitung = mealsJson?.[meal.day]?.[meal.type]?.herleitung || null;
  const mealTypeLabel = meal.type === 'Zmittag' ? 'Lunch' : 'Afternoon Snack';
  const mealTypeEmoji = meal.type === 'Zmittag' ? '🍽️' : '🍎';
  const modeRaw = mealData?.mode_applied || '';
  const isModeA = modeRaw.toLowerCase().includes('mode a');
  const isModeB = modeRaw.toLowerCase().includes('mode b');
  const parsed = parseHerleitung(herleitung);
  // Free foods — source: University Hospital Zurich Austauschtabelle
  // Vegetables with counted carbs: Erbsen, Mais, Kefen, Maiskolben, Randen — these are NOT in this list
  const FREE_FOODS_LIST = [
    // Vegetables that are truly free (no meaningful carbs — per UHZ Austauschtabelle)
    'karotten', 'gurken', 'gurke', 'karotte', 'rüebli', 'tomaten', 'tomate',
    'brokkoli', 'blumenkohl', 'auberginen', 'aubergine', 'fenchel', 'lauch', 'lauch',
    'käse', 'schinken', 'schinkenwürfel', 'butter',
    'nüsslisalat', 'gemüsesticks', 'gemüse', 'paprika', 'zwiebeln', 'zwiebel',
    'spinat', 'zucchini', 'sellerie', 'rüebli', 'blattsalat',
    // Protein / fat
    'eier', 'ei ', 'spiegelei', 'fleisch', 'hähnchen', 'poulet',
    // Dressings
    'öl', 'olivenöl', 'essig',
  ];
  // NOTE: Erbsen (peas), Mais, Kefen, Maiskolben, Randen are NOT free — they count carbs per UHZ
  // Randen/Rote Bete handled separately in nutrition lookup (8.3g/100g)

  function isFreeFood(name) {
    const n = name.toLowerCase();
    return FREE_FOODS_LIST.some(v => n.includes(v));
  }

  // Nutrition lookup with improved fuzzy matching
  function lookupNutrition(name, nd) {
    if (!nd) return null;
    const n = name.toLowerCase();
    // Manual overrides first — most reliable
    const overrides = {
      'milch': 'milch', 'eier': 'eier', 'butter': 'butter',
      'kartoffel': 'kartoffeln', 'erbsen': 'erbsen', 'karotten': 'karotten',
      'karotte': 'karotten', 'gurken': 'gurken', 'gurke': 'gurken',
      'banane': 'banane', 'joghurt': 'joghurt',
      'mehl': 'mehl', 'rahm': 'rahm', 'lauch': 'lauch',
      'schinken': 'schinken', 'schinkenwürfel': 'schinken', 'schinkenwürfeli': 'schinken',
      'käse': 'käse', 'tomaten': 'tomaten', 'kichererbsen': 'kichererbsen',
      'rote bete': 'rote_bete', 'olivenöl': 'olivenöl', 'öl': 'öl',
      'zitronensaft': 'zitrone', 'zitrone': 'zitrone', 'essig': 'essig',
    };
    const overrideKey = Object.keys(overrides).find(k => n.includes(k));
    if (overrideKey) return nd[overrides[overrideKey]] || null;
    // Fallback fuzzy — try contains both ways
    let key = Object.keys(nd).find(k => n.includes(k.toLowerCase()));
    if (!key) key = Object.keys(nd).find(k => k.toLowerCase().includes(n.split(' ')[0]));
    // Last resort — partial stem match (e.g. 'bio-beeren' → key 'beeren')
    if (!key) {
      const stem = n.replace(/^bio-/, '').replace(/^tk-/, '').split(' ')[0];
      key = Object.keys(nd).find(k => k.toLowerCase().includes(stem) || stem.includes(k.toLowerCase()));
    }
    return key ? nd[key] : null;
  }

  // Validated nutritional overrides — source: University Hospital Zurich Austauschtabelle
  const VALIDATED_NUTRITION = {
    'bio-beeren': { carbs_per_100g: 7 },   // Migros/Coop Swiss retail = 7g/100g
    'beeren': { carbs_per_100g: 7 },
    'tk-beeren': { carbs_per_100g: 7 },
    'erbsen': { carbs_per_100g: 12.5 },    // UHZ: 80g = 10g KH
    'mais': { carbs_per_100g: 16.7 },      // UHZ: 60g = 10g KH
    'kefen': { carbs_per_100g: 10 },       // UHZ: 100g = 10g KH
    'maiskolben': { carbs_per_100g: 10 },  // UHZ: 100g = 10g KH
    'randen': { carbs_per_100g: 8.3 },     // UHZ: 120g = 10g KH
    'rote bete': { carbs_per_100g: 8.3 },  // same as Randen
    'ketchup': { carbs_per_100g: 25 },     // UHZ: 40g = 10g KH
    // Free vegetables — force 0g to prevent wrong lookup values
    'lauch': { carbs_per_100g: 0 },
    'karotten': { carbs_per_100g: 0 },
    'gurken': { carbs_per_100g: 0 },
    'tomaten': { carbs_per_100g: 0 },
    'paprika': { carbs_per_100g: 0 },
    'brokkoli': { carbs_per_100g: 0 },
    'zucchini': { carbs_per_100g: 0 },
    'spinat': { carbs_per_100g: 0 },
  };

  function lookupNutritionWithFallback(name, nd) {
    // Check validated overrides first
    const n = name.toLowerCase();
    const validatedKey = Object.keys(VALIDATED_NUTRITION).find(k => n.includes(k) || k.includes(n.split(' ')[0]));
    if (validatedKey) return VALIDATED_NUTRITION[validatedKey];
    return lookupNutrition(name, nd);
  }

  // Clustering — dish membership wins, explicit per ingredient
  function getCluster(name, modeRaw, dishName) {
    const n = name.toLowerCase();
    const dish = (dishName || '').toLowerCase();

    // ── KARTOFFELSTOCK ──
    if (dish.includes('kartoffelstock') || modeRaw.toLowerCase().includes('mode b')) {
      if (n.includes('kartoffel') || n.includes('milch') || n.includes('butter')) return 'Kartoffelstock';
      if (n.includes('erbsen')) return 'Erbsen & Karotten';
      if (n.includes('karotten') || n.includes('karotte') || n.includes('rüebli')) return 'Erbsen & Karotten';
      if (n.includes('gurken') || n.includes('gurke')) return 'Gurkensalat';
      if (n.includes('öl') || n.includes('essig') || n.includes('zitron')) return 'Gurkensalat';
      if (n.includes('eier') || n.includes('ei ') || n.includes('spiegelei')) return 'Spiegelei';
    }

    // ── QUICHE ── all filling ingredients stay in Quiche Lorraine cluster
    if (dish.includes('quiche')) {
      // Side salad only: tomaten + its dressing
      if (n.includes('tomaten') || n.includes('randen')) return 'Tomatensalat';
      if (n.includes('öl') || n.includes('olivenöl') || n.includes('essig') || n.includes('zitron')) return 'Tomatensalat';
      // All quiche ingredients including eggs, schinken, lauch
      return 'Quiche Lorraine';
    }

    // ── SMOOTHIE BOWL ──
    if (dish.includes('smoothie') || dish.includes('bowl')) return 'Smoothie Bowl';

    // ── HUMMUS ──
    if (dish.includes('hummus')) {
      // Only gemüsesticks are the free side
      if (n.includes('gemüsesticks')) return 'Gemüsesticks (free)';
      // Everything else is part of the hummus: kichererbsen, rote bete, olivenöl, zitronensaft
      return 'Pinker Hummus';
    }

    return 'Main';
  }

  // Build ingredient table from raw recipe data
  function buildRecipeIngredients(day, type) {
    if (!extractedMenu || !nutritionData) return [];
    const dishData = extractedMenu?.[day]?.[type];
    if (!dishData) return [];
    const ingredientStr = dishData.ingredients || '';
    return ingredientStr.split('|').map(part => {
      const p = part.trim();
      // Try: "Name X unit (Yg)" e.g. "Milch 4 dl (400g)" or "Eier 10 Stk (550g)"
      const bracketMatch = p.match(/^(.+?)\s+([\d.]+\s*(?:dl|Stk|EL|TL|kg|L|Stück|stk)[^(]*)\((\d+)g\)/i);
      // Try: "Name Xg" e.g. "Kartoffeln 2000g"
      const directMatch = p.match(/^(.+?)\s+([\d.]+)\s*g/);
      if (!bracketMatch && !directMatch) return null;
      const name = bracketMatch ? bracketMatch[1].trim() : directMatch[1].trim();
      // displayQty: show original unit e.g. "4 dl (400g)" or "10 Stk (550g)" or "2000g"
      const displayQty = bracketMatch ? `${bracketMatch[2].trim()} (${bracketMatch[3]}g)` : `${directMatch[2]}g`;
      const weight = bracketMatch ? parseFloat(bracketMatch[3]) : parseFloat(directMatch[2]);
      const nutrition = lookupNutritionWithFallback(name, nutritionData);
      const per100 = nutrition ? nutrition.carbs_per_100g : null;
      const totalCarb = per100 !== null ? Math.round((weight * per100 / 100) * 10) / 10 : null;
      // Cluster first — dish membership overrides free-food heuristics
      const cluster = getCluster(name, modeRaw, mealData?.dish_name);
      const FREE_SIDE_CLUSTERS = ['Erbsen & Karotten', 'Gurkensalat', 'Spiegelei', 'Tomatensalat', 'Gemüsesticks (free)', 'free'];
      const isFree = FREE_SIDE_CLUSTERS.includes(cluster) || (per100 !== null && per100 === 0);
      return { name, weight, displayQty, per100, total: totalCarb, free: isFree, cluster };
    }).filter(Boolean);
  }

  const recipeIngredients = buildRecipeIngredients(meal.day, meal.type);
  const useRecipeTable = recipeIngredients.length > 0;

  const allIngredients = useRecipeTable ? recipeIngredients : [
    ...carbFoods.map(f => ({ name: f.food, weight: f.portion_g, displayQty: `${f.portion_g}g`, per100: f.carbs_per_100g, total: f.carbs_g, free: false, cluster: 'Main' })),
    ...freeFoods.map(f => ({ name: f.food, weight: f.portion_g, displayQty: `${f.portion_g}g`, per100: null, total: null, free: true, cluster: 'Free' })),
  ];

  // Group ALL ingredients by cluster (free ones included in their dish cluster)
  const allClusters = {};
  allIngredients.forEach(ing => {
    const c = ing.cluster || 'Main';
    if (!allClusters[c]) allClusters[c] = [];
    allClusters[c].push(ing);
  });

  // Separate free section only for ingredients with cluster === 'free' (fallback)
  const carbIngredients = allIngredients.filter(i => !i.free);
  const freeIngredients = allIngredients.filter(i => i.free && i.cluster === 'free');

  // For the cluster display, use allClusters but exclude the raw 'free' key
  const carbClusters = {};
  Object.entries(allClusters).forEach(([k, v]) => {
    if (k !== 'free') carbClusters[k] = v;
  });

  const totalWeight = allIngredients.reduce((s, i) => s + (i.weight || 0), 0);
  const tableTotal = Math.round(carbIngredients.reduce((s, i) => s + (i.total || 0), 0) * 10) / 10;

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

          {/* PILLS — Monday | Lunch — above the dish box, inside the card but above the border */}
          <div style={S.pillRow}>
            <span style={S.pill}>{meal.day}</span>
            <span style={S.pill}>{mealTypeEmoji} {mealTypeLabel}</span>
          </div>

          {/* DISH NAME BOX — white bg, blue border */}
          <div style={S.dishBox}>
            <h2 style={S.mealName}>{mealData?.dish_name || meal.type}</h2>
          </div>

          <div style={S.cardBody}>

            {/* 1 — MEAL CALCULATION APPROACH */}
            <div style={{marginBottom:'1.4rem'}}>
              <div style={S.sectionLabel}>Meal Calculation Approach</div>
              <div style={S.approachRow}>
                <div style={S.approachOption(isModeA)}>
                  <div style={S.approachOptionTitle(isModeA)}>Carb Target</div>
                  <div style={S.approachOptionDesc(isModeA)}>e.g. pasta, rice, bread, couscous</div>
                </div>
                <div style={S.approachOption(isModeB)}>
                  <div style={S.approachOptionTitle(isModeB)}>Weight Target</div>
                  <div style={S.approachOptionDesc(isModeB)}>e.g. mashed potatoes, root vegetables</div>
                </div>
              </div>
            </div>

            {/* 2 — OMNIPOD ENTRY — 3 cols, light blue */}
            <div style={{marginBottom:'1.4rem'}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.6rem'}}>
                <div style={{...S.sectionLabel, marginBottom:0}}>Omnipod Entry</div>
                <div style={{fontSize:'0.72rem', color:'#6b7280', fontStyle:'italic'}}>⚠️ Do not use "Sensordaten verwenden" unless instructed otherwise.</div>
              </div>
              <div style={{...S.omnipodBar, gridTemplateColumns: '1fr 1px 1fr 1px 1fr'}}>
                {/* Col 0 — Portion Size */}
                <div style={S.omnipodCellFirst}>
                  <div style={S.omnipodCellLabel}>Portion Size</div>
                  {carbFoodItems.map((f, i) => (
                    <div key={i} style={S.omnipodText}><strong>{f.portion_g}g {f.cleanName}</strong></div>
                  ))}
                  {freeFoodNames && <div style={{...S.omnipodCellSub, marginTop:'0.3rem'}}>+ sides not counted: {freeFoodNames}</div>}
                </div>
                {/* Divider */}
                <div style={S.omnipodDivider} />
                {/* Col 1 — Carb Entry */}
                <div style={S.omnipodCell}>
                  <div style={S.omnipodCellLabel}>Omnipod Carb Entry</div>
                  <div style={S.omnipodText}>Calculated {roundCarbs(totalCarbs)}g</div>
                  <div style={S.omnipodText}>Rounded <span style={S.omnipodRounded}>{roundInt(totalCarbs)}g</span></div>
                </div>
                {/* Divider */}
                <div style={S.omnipodDivider} />
                {/* Col 2 — Glycemic Speed */}
                <div style={S.omnipodCell}>
                  <div style={S.omnipodCellLabel}>Glycemic Speed</div>
                  <div style={S.omnipodCellValue}>{glycemicSpeed === 'fast' ? '⚡ Fast acting' : '🐢 Slow acting'}</div>
                  <div style={S.omnipodCellSub}>{glycemicSpeed === 'fast' ? '⏱ Wait 10 min before meal' : '✓ No waiting needed'}</div>
                </div>

              </div>
            </div>


            {/* 3 — NACHSCHLAG — light blue */}
            {nachschlag && nachschlag.carb_foods && nachschlag.carb_foods.length > 0 && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={S.sectionLabel}>If She Wants More (Seconds)</div>
                <div style={S.nachschlagBox}>
                  {nachschlag.carb_foods.map((f, i) => (
                    <div key={i}>
                      +{f.portion_g}g {cleanFoodName(f.food)} → enter additional {roundCarbs(f.carbs_g)}g (<strong style={{textDecoration:'underline'}}>{roundInt(f.carbs_g)}g rounded</strong>) in Omnipod
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4 — PARENTAL CONTROL */}
            {parsed && (parsed.dishText || parsed.carbLines) && (
              <div style={{marginBottom:'1.4rem'}}>
                <div style={S.sectionLabel}>Parental Control</div>
                <div style={S.parentalBox}>
                  {parsed.dishText && (
                    <div style={{marginBottom: parsed.carbLines ? '1rem' : 0}}>
                      <div style={S.parentalSubLabel}>Dish Understanding</div>
                      <p style={S.parentalDishText}>{parsed.dishText}</p>
                      {freeFoods.length > 0 && (
                        <p style={{...S.parentalDishText, margin: 0, color: '#6b7280', fontStyle: 'italic'}}>
                          Not counted: {freeFoods.map(f => f.food).join(', ')} — served as separate components, carb-free.
                        </p>
                      )}
                    </div>
                  )}
                  {parsed.carbLines && parsed.carbLines.length > 0 && (
                    <div>
                      <div style={S.parentalSubLabel}>Carb Calculation</div>
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

            {/* 5 — FULL INGREDIENT TABLE (collapsible) */}
            {allIngredients.length > 0 && (
              <div style={{marginBottom:'0.5rem'}}>
                <button style={S.tableToggleBtn} onClick={() => setTableOpen(o => !o)}>
                  <span>📋 Full Ingredient Table (recipe quantities)</span>
                  <span>{tableOpen ? '▲ Hide' : '▼ Show'}</span>
                </button>
                {tableOpen && (
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Ingredient</th>
                        <th style={S.thRight}>Recipe weight</th>
                        <th style={S.thRight}>g / 100g</th>
                        <th style={S.thRight}>Total carbs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* CARB INGREDIENTS — grouped by cluster */}
                      {Object.entries(carbClusters).map(([clusterName, ings]) => {
                        const clusterCarbs = Math.round(ings.reduce((s, i) => s + (i.total || 0), 0) * 10) / 10;
                        const clusterTotal = Math.round(ings.filter(i => !i.free).reduce((s, i) => s + (i.total || 0), 0) * 10) / 10;
                        const clusterWeight = ings.reduce((s, i) => s + (i.weight || 0), 0);
                        const isFreeSideCluster = ings.every(i => i.free);
                        const showCluster = true;
                        return (
                          <React.Fragment key={clusterName}>
                            {showCluster && (
                              <tr>
                                <td colSpan={4} style={{
                                  padding: '0.4rem 0.7rem',
                                  background: isFreeSideCluster ? '#f9fafb' : BLUE_LIGHT,
                                  color: isFreeSideCluster ? '#9ca3af' : BLUE,
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  letterSpacing: '0.07em',
                                  textTransform: 'uppercase',
                                  borderBottom: `1px solid ${isFreeSideCluster ? BORDER : BLUE_BORDER}`,
                                }}>{clusterName}{isFreeSideCluster ? ' — not counted' : ''}</td>
                              </tr>
                            )}
                            {ings.map((ing, i) => (
                              <tr key={i}>
                                <td style={S.td}>{ing.name}</td>
                                <td style={S.tdRight}>{ing.weight}g</td>
                                <td style={S.tdRight}>{ing.per100 !== null ? `${ing.per100}g` : '—'}</td>
                                <td style={S.tdCarbs}>{ing.total !== null ? `${roundCarbs(ing.total)}g` : '?'}</td>
                              </tr>
                            ))}
                            {showCluster && (
                              <tr>
                                <td style={{...S.td, fontWeight:600, color: isFreeSideCluster ? '#9ca3af' : '#374151', background:'#f9fafb', borderTop:`1px solid ${BORDER}`, fontStyle: isFreeSideCluster ? 'italic' : 'normal'}}>↳ {clusterName} subtotal</td>
                                <td style={{...S.tdRight, fontWeight:600, color: isFreeSideCluster ? '#9ca3af' : '#374151', background:'#f9fafb', borderTop:`1px solid ${BORDER}`}}>{clusterWeight}g</td>
                                <td style={{...S.tdRight, background:'#f9fafb', borderTop:`1px solid ${BORDER}`, color: isFreeSideCluster ? '#9ca3af' : 'inherit'}}>{isFreeSideCluster ? `${clusterCarbs}g total` : ''}</td>
                                <td style={{...S.tdCarbs, fontWeight:700, background:'#f9fafb', borderTop:`1px solid ${BORDER}`, color: isFreeSideCluster ? '#9ca3af' : BLUE, fontStyle: isFreeSideCluster ? 'italic' : 'normal'}}>{isFreeSideCluster ? '0g counted' : `${clusterTotal}g`}</td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* FREE INGREDIENTS — fallback only */}
                      {freeIngredients.length > 0 && (
                        <React.Fragment>
                          <tr>
                            <td colSpan={4} style={{
                              padding: '0.4rem 0.7rem',
                              background: '#f9fafb',
                              color: '#6b7280',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              letterSpacing: '0.07em',
                              textTransform: 'uppercase',
                              borderBottom: `1px solid ${BORDER}`,
                              borderTop: `2px solid ${BORDER}`,
                            }}>Free Foods (not counted)</td>
                          </tr>
                          {freeIngredients.map((ing, i) => (
                            <tr key={i}>
                              <td style={{...S.td, color:'#9ca3af'}}>{ing.name}</td>
                              <td style={{...S.tdRight, color:'#9ca3af'}}>{ing.displayQty || `${ing.weight}g`}</td>
                              <td style={{...S.tdRight, color:'#9ca3af'}}>{ing.per100 !== null ? `${ing.per100}g` : '—'}</td>
                              <td style={{...S.tdFree}}>free</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )}

                      {/* GRAND TOTAL */}
                      <tr>
                        <td style={S.tdTotalLabel}>Total carbs in recipe</td>
                        <td style={S.tdTotalRight}></td>
                        <td style={S.tdTotalRight}></td>
                        <td style={S.tdTotalCarbs}>{tableTotal}g</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              {tableOpen && <div style={{fontSize:'0.75rem', color:'#9ca3af', marginTop:'0.4rem', fontStyle:'italic'}}>* Free food — not counted in carb calculation</div>}
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
