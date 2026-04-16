import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { C, FONT, Icon, GRADIENT } from '../../stitch'
import TopBar from '../../components/TopBar'

export default function NetworkScreen({ onBack, isDesktop }) {
    const { user, member } = useAuth()
    const [referrals, setReferrals] = useState([])
    const [ledger, setLedger] = useState([])
    const [loading, setLoading] = useState(true)
    const [copied, setCopied] = useState(false)
    const [activeTab, setActiveTab] = useState('network')

    const pad = isDesktop ? '0 32px' : '0 16px'

    const refLink = member?.ref_code
        ? `${window.location.origin}/join?ref=${member.ref_code}`
        : null

    useEffect(() => {
        if (user?.id) {
            fetchReferrals()
            fetchLedger()
        }
    }, [user])

    async function fetchReferrals() {
        try {
            // 1. Get referral tree entries where this user is the referrer
            const { data: treeData } = await supabase
                .from('referral_tree')
                .select('*')
                .eq('referred_by', user.id)
                .order('created_at', { ascending: false })

            if (!treeData || treeData.length === 0) {
                setReferrals([])
                setLoading(false)
                return
            }

            // 2. Collect all referred member IDs
            const memberIds = treeData.map(r => r.member_id).filter(Boolean)

            // 3. Fetch profiles for those members
            const { data: profiles } = await supabase
                .from('identity_profiles')
                .select('user_id, email, full_name, ref_code, payment_status, chilliums_balance, created_at, direct_referrals_count')
                .in('user_id', memberIds)

            const profileMap = {}
            ;(profiles || []).forEach(p => { profileMap[p.user_id] = p })

            // 4. Also find L2 referrals (people referred by my direct referrals)
            const { data: l2Data } = await supabase
                .from('referral_tree')
                .select('*')
                .in('referred_by', memberIds)
                .order('created_at', { ascending: false })

            let allL2MemberIds = []
            if (l2Data && l2Data.length > 0) {
                allL2MemberIds = l2Data.map(r => r.member_id).filter(Boolean)
                const { data: l2Profiles } = await supabase
                    .from('identity_profiles')
                    .select('user_id, email, full_name, ref_code, payment_status, chilliums_balance, created_at, direct_referrals_count')
                    .in('user_id', allL2MemberIds)

                ;(l2Profiles || []).forEach(p => { profileMap[p.user_id] = p })
            }

            // 5. Build combined list with level info
            const combined = [
                ...treeData.map(r => ({ ...r, level: 1, referred_member: profileMap[r.member_id] || null })),
                ...(l2Data || []).map(r => ({ ...r, level: 2, referred_member: profileMap[r.member_id] || null })),
            ]

            setReferrals(combined)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function fetchLedger() {
        try {
            const { data } = await supabase
                .from('chilliums_ledger')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            setLedger(data || [])
        } catch (e) {
            console.error(e)
        }
    }

    function copyLink() {
        if (refLink) {
            navigator.clipboard.writeText(refLink)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const l1 = referrals.filter(r => r.level === 1)
    const l2 = referrals.filter(r => r.level === 2)

    const earnings = {
        cashback: ledger.filter(l => l.type === 'cashback_direct').reduce((s, l) => s + Number(l.amount), 0),
        referral_l1: ledger.filter(l => l.type === 'cashback_network' && l.referral_level === 2).reduce((s, l) => s + Number(l.amount), 0),
        referral_l2: ledger.filter(l => l.type === 'cashback_network' && l.referral_level === 3).reduce((s, l) => s + Number(l.amount), 0),
        bonus: ledger.filter(l => l.type === 'bonus').reduce((s, l) => s + Number(l.amount), 0),
        redeemed: member?.chilliums_total_spent || 0,
    }

    const typeLabels = {
        cashback_direct: 'Cashback',
        cashback_network: 'Referido',
        bonus: 'Bono',
        redemption: 'Redención',
        adjustment: 'Ajuste',
    }

    const typeColors = {
        cashback_direct: C.primaryBright,
        cashback_network: C.tertiaryContainer,
        bonus: '#EF9F27',
        redemption: C.errorBright,
        adjustment: C.onSurfaceVariant,
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <TopBar title="Mi Red CNG+" leftIcon="arrow_back" onLeft={onBack} />

            <div style={{ padding: isDesktop ? '32px 32px 60px' : '16px 16px 120px', width: '100%', boxSizing: 'border-box' }}>
                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 14, color: C.onSurfaceVariant }}>{member?.full_name || user?.email}</p>
                </div>

                {/* Big balance card */}
                <div style={s.bigBalance}>
                    <div style={s.bigBalanceInner}>
                        <svg width="40" height="35" viewBox="0 0 50 40" style={{ flexShrink: 0 }}>
                            <ellipse cx="25" cy="28" rx="18" ry="6" fill="#BA7517" opacity="0.4" />
                            <ellipse cx="25" cy="22" rx="18" ry="6" fill="#EF9F27" opacity="0.5" />
                            <ellipse cx="25" cy="16" rx="18" ry="6" fill="#FAC775" opacity="0.7" stroke="#854F0B" strokeWidth="0.5" />
                            <text x="25" y="20" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#633806">C</text>
                        </svg>
                        <div>
                            <div style={s.bigBalanceLabel}>Balance total</div>
                            <div style={{ ...s.bigBalanceAmount, ...(!isDesktop ? { fontSize: 24 } : {}) }}>{member?.chilliums_balance?.toFixed(2) || '0.00'} <span style={s.bigBalanceCurrency}>Chilliums</span></div>
                        </div>
                    </div>

                    {/* Earnings breakdown */}
                    <div style={{ ...s.earningsGrid, gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                        <div style={s.earningItem}>
                            <div style={s.earningDot(C.primaryBright)} />
                            <div style={s.earningInfo}>
                                <span style={s.earningLabel}>Cashback</span>
                                <span style={s.earningValue}>{earnings.cashback.toFixed(2)}</span>
                            </div>
                        </div>
                        <div style={s.earningItem}>
                            <div style={s.earningDot(C.tertiaryContainer)} />
                            <div style={s.earningInfo}>
                                <span style={s.earningLabel}>Nivel 1</span>
                                <span style={s.earningValue}>{earnings.referral_l1.toFixed(2)}</span>
                            </div>
                        </div>
                        <div style={s.earningItem}>
                            <div style={s.earningDot('#D85A30')} />
                            <div style={s.earningInfo}>
                                <span style={s.earningLabel}>Nivel 2</span>
                                <span style={s.earningValue}>{earnings.referral_l2.toFixed(2)}</span>
                            </div>
                        </div>
                        <div style={s.earningItem}>
                            <div style={s.earningDot('#EF9F27')} />
                            <div style={s.earningInfo}>
                                <span style={s.earningLabel}>Bonos</span>
                                <span style={s.earningValue}>{earnings.bonus.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referral link card */}
                <div style={s.refCard}>
                    <div style={s.refCardHeader}>
                        <h3 style={s.refCardTitle}>Tu link de referido</h3>
                        <div style={s.refStats}>
                            <span style={s.refStatBadge(C.tertiaryContainer)}>{l1.length} nivel 1</span>
                            <span style={s.refStatBadge('#D85A30')}>{l2.length} nivel 2</span>
                        </div>
                    </div>
                    {refLink ? (
                        <div style={{ ...s.refLinkRow, ...(!isDesktop ? { flexDirection: 'column' } : {}) }}>
                            <div style={s.refLinkBox}>{refLink}</div>
                            <button onClick={copyLink} style={s.copyBtn}>
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                    ) : (
                        <p style={s.refPending}>Activa tu membresía para obtener tu link</p>
                    )}
                </div>

                {/* Tabs */}
                <div style={s.tabs}>
                    {['network', 'history'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{ ...s.tab, ...(activeTab === tab ? s.tabActive : {}) }}
                        >
                            {tab === 'network' ? 'Mi red' : 'Historial'}
                        </button>
                    ))}
                </div>

                {/* Network tab */}
                {activeTab === 'network' && (
                    <div>
                        {/* Visual tree */}
                        <div style={{ ...s.treeContainer, ...(!isDesktop ? { padding: '12px 0', gap: 4 } : {}) }}>
                            {/* YOU at top */}
                            <div style={s.treeYou}>
                                <div style={s.treeYouAvatar}>
                                    {(member?.full_name || 'U')[0].toUpperCase()}
                                </div>
                                <div style={s.treeYouName}>{member?.full_name || 'Tú'}</div>
                                <div style={s.treeYouCode}>{member?.ref_code}</div>
                            </div>

                            {/* Level 1 */}
                            {l1.length > 0 && (
                                <>
                                    <div style={s.treeLine} />
                                    <div style={s.treeLevelLabel}>
                                        <span style={s.treeLevelBadge(C.tertiaryContainer)}>Nivel 1 — {l1.length} referidos</span>
                                    </div>
                                    <div style={{ ...s.treeRow, ...(!isDesktop ? { gap: 8 } : {}) }}>
                                        {l1.map((ref) => (
                                            <div key={ref.id} style={s.treeNode(C.tertiaryContainer, '#EEEDFE', '#3C3489')}>
                                                <div style={s.treeNodeAvatar(C.tertiaryContainer)}>
                                                    {(ref.referred_member?.full_name || ref.referred_member?.email || '?')[0].toUpperCase()}
                                                </div>
                                                <div style={s.treeNodeName}>
                                                    {ref.referred_member?.full_name || ref.referred_member?.email?.split('@')[0]}
                                                </div>
                                                <div style={s.treeNodeStatus(ref.referred_member?.payment_status)}>
                                                    {ref.referred_member?.payment_status === 'active' ? 'Activo' : 'Pendiente'}
                                                </div>
                                                {ref.referred_member?.direct_referrals_count > 0 && (
                                                    <div style={s.treeNodeSubs}>
                                                        +{ref.referred_member.direct_referrals_count} referidos
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Level 2 */}
                            {l2.length > 0 && (
                                <>
                                    <div style={s.treeLine} />
                                    <div style={s.treeLevelLabel}>
                                        <span style={s.treeLevelBadge('#D85A30')}>Nivel 2 — {l2.length} referidos</span>
                                    </div>
                                    <div style={{ ...s.treeRow, ...(!isDesktop ? { gap: 8 } : {}) }}>
                                        {l2.map((ref) => (
                                            <div key={ref.id} style={s.treeNode('#D85A30', '#FAECE7', '#712B13')}>
                                                <div style={s.treeNodeAvatar('#D85A30')}>
                                                    {(ref.referred_member?.full_name || ref.referred_member?.email || '?')[0].toUpperCase()}
                                                </div>
                                                <div style={s.treeNodeName}>
                                                    {ref.referred_member?.full_name || ref.referred_member?.email?.split('@')[0]}
                                                </div>
                                                <div style={s.treeNodeStatus(ref.referred_member?.payment_status)}>
                                                    {ref.referred_member?.payment_status === 'active' ? 'Activo' : 'Pendiente'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Empty state */}
                            {l1.length === 0 && l2.length === 0 && (
                                <div style={s.emptyState}>
                                    <div style={s.emptyIcon}>
                                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                                            <circle cx="30" cy="18" r="8" stroke="#444" strokeWidth="1.5" fill="none" />
                                            <path d="M16 42c0-7.7 6.3-14 14-14s14 6.3 14 14" stroke="#444" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                                            <circle cx="12" cy="30" r="5" stroke="#555" strokeWidth="1" fill="none" opacity="0.5" />
                                            <circle cx="48" cy="30" r="5" stroke="#555" strokeWidth="1" fill="none" opacity="0.5" />
                                            <line x1="20" y1="22" x2="15" y2="28" stroke="#555" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
                                            <line x1="40" y1="22" x2="45" y2="28" stroke="#555" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.5" />
                                        </svg>
                                    </div>
                                    <p style={s.emptyTitle}>Tu red está vacía</p>
                                    <p style={s.emptyText}>Comparte tu link de referido para empezar a construir tu red y ganar Chilliums</p>
                                    {refLink && (
                                        <button onClick={copyLink} style={s.emptyBtn}>
                                            {copied ? 'Link copiado' : 'Copiar link de referido'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Network summary cards */}
                        <div style={{ ...s.summaryGrid, gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)' }}>
                            <div style={s.summaryCard}>
                                <div style={s.summaryIcon(C.tertiaryContainer)}>
                                    <Icon name="group" size={20} style={{ color: C.tertiaryContainer }} />
                                </div>
                                <div style={s.summaryNumber}>{member?.direct_referrals_count || 0}</div>
                                <div style={s.summaryLabel}>Referidos directos</div>
                                <div style={s.summarySub}>$3.00/mes c/u</div>
                            </div>
                            <div style={s.summaryCard}>
                                <div style={s.summaryIcon('#D85A30')}>
                                    <Icon name="groups" size={20} style={{ color: '#D85A30' }} />
                                </div>
                                <div style={s.summaryNumber}>{l2.length}</div>
                                <div style={s.summaryLabel}>Red extendida</div>
                                <div style={s.summarySub}>$2.10/mes c/u</div>
                            </div>
                            <div style={s.summaryCard}>
                                <div style={s.summaryIcon('#EF9F27')}>
                                    <Icon name="paid" size={20} style={{ color: '#EF9F27' }} />
                                </div>
                                <div style={s.summaryNumber}>{member?.chilliums_total_earned?.toFixed(2) || '0.00'}</div>
                                <div style={s.summaryLabel}>Ganado total</div>
                                <div style={s.summarySub}>Chilliums</div>
                            </div>
                            <div style={s.summaryCard}>
                                <div style={s.summaryIcon(C.errorBright)}>
                                    <Icon name="redeem" size={20} style={{ color: C.errorBright }} />
                                </div>
                                <div style={s.summaryNumber}>{(member?.chilliums_total_spent || 0).toFixed(2)}</div>
                                <div style={s.summaryLabel}>Redimidos</div>
                                <div style={s.summarySub}>Usados en compras</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* History tab */}
                {activeTab === 'history' && (
                    <div style={{ marginTop: 8 }}>
                        {ledger.length === 0 ? (
                            <div style={s.emptyState}>
                                <p style={s.emptyTitle}>Sin movimientos</p>
                                <p style={s.emptyText}>Tu historial de Chilliums aparecerá aquí</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {ledger.map((entry) => (
                                    <div key={entry.id} style={s.historyItem}>
                                        <div style={s.historyDot(typeColors[entry.type] || C.onSurfaceVariant)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={s.historyType}>{typeLabels[entry.type] || entry.type}</div>
                                            <div style={s.historyDesc}>{entry.description || '-'}</div>
                                            <div style={s.historyDate}>
                                                {new Date(entry.created_at).toLocaleDateString('es-MX', {
                                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap',
                                            color: Number(entry.amount) >= 0 ? C.primary : C.error,
                                        }}>
                                            {Number(entry.amount) >= 0 ? '+' : ''}{Number(entry.amount).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

const s = {
    bigBalance: {
        background: 'rgba(239,159,39,0.04)',
        border: '1px solid rgba(239,159,39,0.12)',
        borderRadius: 16,
        padding: '24px',
        marginBottom: 20,
    },
    bigBalanceInner: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 },
    bigBalanceLabel: { fontSize: 13, color: C.onSurfaceVariant },
    bigBalanceAmount: { fontSize: 32, fontWeight: 700, color: '#FAC775' },
    bigBalanceCurrency: { fontSize: 14, fontWeight: 400, color: '#854F0B' },
    earningsGrid: { display: 'grid', gap: 12 },
    earningItem: { display: 'flex', alignItems: 'center', gap: 8 },
    earningDot: (color) => ({ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }),
    earningInfo: { display: 'flex', flexDirection: 'column' },
    earningLabel: { fontSize: 11, color: C.onSurfaceVariant },
    earningValue: { fontSize: 14, fontWeight: 600, color: C.text },

    refCard: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '20px',
        marginBottom: 20,
    },
    refCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 },
    refCardTitle: { fontSize: 15, fontWeight: 600 },
    refStats: { display: 'flex', gap: 6 },
    refStatBadge: (color) => ({
        fontSize: 11,
        padding: '3px 10px',
        borderRadius: 12,
        background: color + '15',
        color: color,
        fontWeight: 500,
    }),
    refLinkRow: { display: 'flex', gap: 8 },
    refLinkBox: {
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        color: C.primary,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    copyBtn: {
        background: 'rgba(29,158,117,0.15)',
        border: '1px solid rgba(29,158,117,0.3)',
        borderRadius: 8,
        padding: '10px 18px',
        fontSize: 12,
        color: C.primary,
        cursor: 'pointer',
        fontWeight: 600,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
    },
    refPending: { fontSize: 13, color: C.textFaint, fontStyle: 'italic' },

    tabs: {
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 10,
        padding: 4,
    },
    tab: {
        flex: 1,
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 500,
        color: C.onSurfaceVariant,
        background: 'none',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.2s',
    },
    tabActive: {
        background: 'rgba(255,255,255,0.06)',
        color: C.text,
    },

    treeContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
    },
    treeYou: { textAlign: 'center', marginBottom: 8 },
    treeYouAvatar: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: GRADIENT.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 700,
        color: C.surface,
        margin: '0 auto 8px',
        border: '3px solid rgba(29,158,117,0.3)',
    },
    treeYouName: { fontSize: 15, fontWeight: 600 },
    treeYouCode: { fontSize: 11, color: C.primary, marginTop: 2 },
    treeLine: {
        width: 2,
        height: 30,
        background: 'rgba(255,255,255,0.08)',
        margin: '4px 0',
    },
    treeLevelLabel: { marginBottom: 12 },
    treeLevelBadge: (color) => ({
        fontSize: 12,
        padding: '4px 14px',
        borderRadius: 12,
        background: color + '15',
        color: color,
        fontWeight: 500,
    }),
    treeRow: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        justifyContent: 'center',
        marginBottom: 8,
        maxWidth: '100%',
    },
    treeNode: (color) => ({
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${color}30`,
        borderRadius: 12,
        padding: '14px 16px',
        minWidth: 120,
        textAlign: 'center',
    }),
    treeNodeAvatar: (color) => ({
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: color + '20',
        border: `1px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 600,
        color: color,
        margin: '0 auto 8px',
    }),
    treeNodeName: { fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 },
    treeNodeStatus: (status) => ({
        fontSize: 10,
        color: status === 'active' ? C.primary : '#FAC775',
        fontWeight: 500,
    }),
    treeNodeSubs: { fontSize: 10, color: C.onSurfaceVariant, marginTop: 4 },

    emptyState: { textAlign: 'center', padding: '40px 20px' },
    emptyIcon: { marginBottom: 16 },
    emptyTitle: { fontSize: 16, fontWeight: 600, marginBottom: 8, color: C.text },
    emptyText: { fontSize: 13, color: C.onSurfaceVariant, maxWidth: 300, margin: '0 auto 20px', lineHeight: 1.6 },
    emptyBtn: {
        background: GRADIENT.primary,
        border: 'none',
        borderRadius: 8,
        padding: '12px 24px',
        fontSize: 13,
        fontWeight: 600,
        color: 'white',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },

    summaryGrid: {
        display: 'grid',
        gap: 10,
        marginTop: 24,
    },
    summaryCard: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '16px 12px',
        textAlign: 'center',
    },
    summaryIcon: (color) => ({
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: color + '12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 10px',
    }),
    summaryNumber: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
    summaryLabel: { fontSize: 11, color: C.onSurfaceVariant },
    summarySub: { fontSize: 10, color: C.textFaint, marginTop: 2 },

    historyItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    historyDot: (color) => ({
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
    }),
    historyType: { fontSize: 13, fontWeight: 500, color: C.text },
    historyDesc: { fontSize: 12, color: C.onSurfaceVariant, marginTop: 2 },
    historyDate: { fontSize: 11, color: C.textFaint, marginTop: 2 },
}
