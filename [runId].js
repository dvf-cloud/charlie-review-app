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
  const [meals, setMeals] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [corrections, setCorrections] = useState({});
  const [correctionText, setCorrectionText] = useState('');
  const [phase, setPhase] = useState('loading'); // loading, review, done
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
      if (!data.records || data.records.length === 0) {
        setPhase('notfound');
        return;
      }
      const rec = data.records[0];
      setAirtableId(rec.id);
      setRecord(rec.fields);

      const calc = JSON.parse(rec.fields.calculation_json);
      setCalculation(calc);

      // Build meal list from calculation
      const mealList = [];
      const mealData = calc.meals || {};
      Object.entries(mealData).forEach(([day, dayMeals]) => {
        if (dayMeals.Zmittag) mealList.push({ day, type: 'Zmittag', data: dayMeals.Zmittag });
        if (dayMeals.Zvieri) mealList.push({ day, type: 'Zvieri', data: dayMeals.Zvieri });
      });

      setMeals(mealList);
      setPhase('review');
    } catch (e) {
      setPhase('error');
    }
  }

  function handleApprove() {
    const meal = meals[currentIndex];
    setCorrections(prev => ({ ...prev, [`${meal.day}_${meal.type}`]: 'APPROVED' }));
    setCorrectionText('');
    if (currentIndex < meals.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      finalizeAndSave();
    }
  }

  function handleCorrect() {
    if (!correctionText.trim()) return;
    const meal = meals[currentIndex];
    setCorrections(prev => ({ ...prev, [`${meal.day}_${meal.type}`]: correctionText }));
    setCorrectionText('');
    if (currentIndex < meals.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      finalizeAndSave();
    }
  }

  async function finalizeAndSave() {
    setPhase('saving');
    try {
      await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}/${airtableId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            status: 'APPROVED',
            corrections: JSON.stringify(corrections)
          }
        })
      });
      setPhase('done');
    } catch (e) {
      setPhase('error');
    }
  }

  const meal = meals[currentIndex];

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%)',
      fontFamily: "'Georgia', serif",
      padding: '0',
    },
    header: {
      background: 'white',
      borderBottom: '3px solid #4f46e5',
      padding: '1.2rem 2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    },
    headerTitle: {
      margin: 0,
      fontSize: '1.3rem',
      fontWeight: 700,
      color: '#1e1b4b',
      letterSpacing: '-0.02em',
    },
    headerSub: {
      margin: 0,
      fontSize: '0.85rem',
      color: '#6b7280',
    },
    progress: {
      background: 'white',
      padding: '1rem 2rem',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
    },
    progressDot: (i) => ({
      width: 32,
      height: 32,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
      fontWeight: 700,
      background: i < currentIndex ? '#4f46e5' : i === currentIndex ? '#818cf8' : '#e5e7eb',
      color: i <= currentIndex ? 'white' : '#9ca3af',
      transition: 'all 0.3s ease',
    }),
    content: {
      maxWidth: 640,
      margin: '2rem auto',
      padding: '0 1rem',
    },
    card: {
      background: 'white',
      borderRadius: 20,
      boxShadow: '0 4px 24px rgba(79,70,229,0.08)',
      overflow: 'hidden',
      marginBottom: '1.5rem',
    },
    cardHeader: {
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      padding: '1.5rem 2rem',
      color: 'white',
    },
    dayBadge: {
      display: 'inline-block',
      background: 'rgba(255,255,255,0.2)',
      borderRadius: 20,
      padding: '0.2rem 0.8rem',
      fontSize: '0.75rem',
      fontWeight: 700,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      marginBottom: '0.5rem',
    },
    mealName: {
      margin: 0,
      fontSize: '1.4rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    mealType: {
      margin: '0.3rem 0 0',
      opacity: 0.8,
      fontSize: '0.9rem',
    },
    cardBody: {
      padding: '1.5rem 2rem',
    },
    section: {
      marginBottom: '1.2rem',
    },
    sectionTitle: {
      fontSize: '0.7rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color: '#9ca3af',
      marginBottom: '0.5rem',
    },
    modeBox: {
      background: '#f0f4ff',
      borderRadius: 10,
      padding: '0.8rem 1rem',
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
    },
    modeBadge: {
      background: '#4f46e5',
      color: 'white',
      borderRadius: 8,
      padding: '0.2rem 0.6rem',
      fontSize: '0.8rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
    },
    modeText: {
      fontSize: '0.85rem',
      color: '#4b5563',
      margin: 0,
    },
    ingredientRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.6rem 0',
      borderBottom: '1px solid #f3f4f6',
      fontSize: '0.9rem',
    },
    ingredientName: {
      color: '#374151',
      flex: 1,
    },
    ingredientFree: {
      color: '#9ca3af',
      fontSize: '0.75rem',
      fontStyle: 'italic',
    },
    ingredientCarbs: {
      fontWeight: 700,
      color: '#4f46e5',
      minWidth: 60,
      textAlign: 'right',
    },
    totalRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.8rem 0 0',
      fontWeight: 700,
      fontSize: '1rem',
      color: '#1e1b4b',
    },
    nachschlagBox: {
      background: '#fef3c7',
      border: '1px solid #fde68a',
      borderRadius: 10,
      padding: '0.8rem 1rem',
      fontSize: '0.85rem',
      color: '#92400e',
    },
    speedBadge: (speed) => ({
      display: 'inline-block',
      borderRadius: 20,
      padding: '0.15rem 0.6rem',
      fontSize: '0.7rem',
      fontWeight: 700,
      background: speed === 'fast' ? '#fee2e2' : speed === 'slow' ? '#d1fae5' : '#f3f4f6',
      color: speed === 'fast' ? '#991b1b' : speed === 'slow' ? '#065f46' : '#6b7280',
      marginLeft: '0.5rem',
    }),
    actions: {
      padding: '1.5rem 2rem',
      background: '#fafafa',
      borderTop: '1px solid #f3f4f6',
    },
    correctionInput: {
      width: '100%',
      padding: '0.8rem 1rem',
      borderRadius: 10,
      border: '2px solid #e5e7eb',
      fontSize: '0.9rem',
      fontFamily: 'inherit',
      resize: 'vertical',
      marginBottom: '1rem',
      outline: 'none',
      boxSizing: 'border-box',
    },
    btnRow: {
      display: 'flex',
      gap: '0.8rem',
    },
    btnApprove: {
      flex: 1,
      padding: '0.9rem',
      borderRadius: 12,
      border: 'none',
      background: 'linear-gradient(135deg, #059669, #10b981)',
      color: 'white',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
      letterSpacing: '-0.01em',
    },
    btnCorrect: {
      flex: 1,
      padding: '0.9rem',
      borderRadius: 12,
      border: '2px solid #e5e7eb',
      background: 'white',
      color: '#374151',
      fontSize: '1rem',
      fontWeight: 700,
      cursor: 'pointer',
    },
    doneCard: {
      background: 'white',
      borderRadius: 20,
      padding: '3rem 2rem',
      textAlign: 'center',
      boxShadow: '0 4px 24px rgba(79,70,229,0.08)',
    },
    kitaMessage: {
      background: '#f0fdf4',
      border: '2px solid #86efac',
      borderRadius: 12,
      padding: '1.2rem',
      textAlign: 'left',
      fontSize: '0.9rem',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      marginTop: '1.5rem',
      color: '#166534',
    },
    copyBtn: {
      marginTop: '1rem',
      padding: '0.8rem 2rem',
      borderRadius: 12,
      border: 'none',
      background: '#4f46e5',
      color: 'white',
      fontSize: '0.9rem',
      fontWeight: 700,
      cursor: 'pointer',
      width: '100%',
    }
  };

  if (phase === 'loading') return (
    <div style={styles.page}>
      <div style={{textAlign:'center', padding:'4rem', color:'#6b7280'}}>
        <div style={{fontSize:'2rem', marginBottom:'1rem'}}>⏳</div>
        Loading Charlie's menu...
      </div>
    </div>
  );

  if (phase === 'notfound') return (
    <div style={styles.page}>
      <div style={{textAlign:'center', padding:'4rem', color:'#6b7280'}}>
        <div style={{fontSize:'2rem', marginBottom:'1rem'}}>🔍</div>
        Review not found.
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div style={styles.page}>
      <div style={{textAlign:'center', padding:'4rem', color:'#ef4444'}}>
        <div style={{fontSize:'2rem', marginBottom:'1rem'}}>⚠️</div>
        Something went wrong. Please try again.
      </div>
    </div>
  );

  if (phase === 'saving') return (
    <div style={styles.page}>
      <div style={{textAlign:'center', padding:'4rem', color:'#6b7280'}}>
        <div style={{fontSize:'2rem', marginBottom:'1rem'}}>💾</div>
        Saving your approvals...
      </div>
    </div>
  );

  if (phase === 'done') return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🌟 Charlie's Meals</h1>
          <p style={styles.headerSub}>All meals reviewed!</p>
        </div>
      </div>
      <div style={styles.content}>
        <div style={styles.doneCard}>
          <div style={{fontSize:'3rem', marginBottom:'1rem'}}>✅</div>
          <h2 style={{color:'#1e1b4b', marginBottom:'0.5rem'}}>All done!</h2>
          <p style={{color:'#6b7280', marginBottom:'1.5rem'}}>Here's the message for the kindergarten:</p>
          <div style={styles.kitaMessage}>
            {record?.kindergarten_message?.replace(/\\n/g, '\n')}
          </div>
          <button style={styles.copyBtn} onClick={() => {
            navigator.clipboard.writeText(record?.kindergarten_message?.replace(/\\n/g, '\n') || '');
            alert('Copied to clipboard!');
          }}>
            📋 Copy to clipboard
          </button>
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
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>🩺 Charlie's Meal Review</h1>
          <p style={styles.headerSub}>{record?.email_subject}</p>
        </div>
      </div>

      <div style={styles.progress}>
        {meals.map((m, i) => (
          <div key={i} style={styles.progressDot(i)} title={`${m.day} ${m.type}`}>
            {i + 1}
          </div>
        ))}
        <span style={{marginLeft:'auto', fontSize:'0.8rem', color:'#9ca3af'}}>
          {currentIndex + 1} of {meals.length}
        </span>
      </div>

      <div style={styles.content}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div style={styles.dayBadge}>{meal.day}</div>
            <h2 style={styles.mealName}>{mealData?.dish_name || `${meal.type}`}</h2>
            <p style={styles.mealType}>
              {meal.type === 'Zmittag' ? '🍽 Lunch' : '🍎 Afternoon Snack'}
              {glycemicSpeed && <span style={styles.speedBadge(glycemicSpeed)}>{glycemicSpeed}</span>}
            </p>
          </div>

          <div style={styles.cardBody}>
            {mealData?.mode_applied && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Calculation Method</div>
                <div style={styles.modeBox}>
                  <span style={styles.modeBadge}>{mealData.mode_applied}</span>
                  <p style={styles.modeText}>Target: {mealData.carb_target_g}g carbs</p>
                </div>
              </div>
            )}

            {carbFoods.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Carb Components</div>
                {carbFoods.map((f, i) => (
                  <div key={i} style={styles.ingredientRow}>
                    <span style={styles.ingredientName}>
                      {f.food} <span style={{color:'#9ca3af', fontSize:'0.8rem'}}>({f.portion_g}g)</span>
                    </span>
                    <span style={styles.ingredientCarbs}>{f.carbs_g}g</span>
                  </div>
                ))}
              </div>
            )}

            {freeFoods.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Free Foods (no carbs)</div>
                {freeFoods.map((f, i) => (
                  <div key={i} style={styles.ingredientRow}>
                    <span style={styles.ingredientName}>{f.food}</span>
                    <span style={{...styles.ingredientCarbs, color:'#9ca3af', fontWeight:400}}>{f.portion_g}g</span>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.totalRow}>
              <span>Total carbs</span>
              <span style={{color:'#4f46e5'}}>{totalCarbs}g</span>
            </div>

            {nachschlag && (
              <div style={{...styles.nachschlagBox, marginTop:'1rem'}}>
                🔁 <strong>Nachschlag:</strong> {nachschlag.portion_g}g = +{nachschlag.additional_carbs_g}g carbs
                (total with seconds: {nachschlag.total_carbs_with_nachschlag_g || (totalCarbs + nachschlag.additional_carbs_g)}g)
              </div>
            )}
          </div>

          <div style={styles.actions}>
            <textarea
              style={styles.correctionInput}
              placeholder="Add a correction if needed (optional)..."
              value={correctionText}
              onChange={e => setCorrectionText(e.target.value)}
              rows={2}
            />
            <div style={styles.btnRow}>
              <button style={styles.btnApprove} onClick={handleApprove}>
                ✅ Approve
              </button>
              <button
                style={{...styles.btnCorrect, opacity: correctionText.trim() ? 1 : 0.4}}
                onClick={handleCorrect}
                disabled={!correctionText.trim()}
              >
                ✏️ Correct & Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
