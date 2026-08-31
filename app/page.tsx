'use client';
import { AlertTriangle, ArrowUpRight, Bell, Building2, CheckCircle2, ChevronDown, ClipboardCheck, FileCheck2, GraduationCap, LayoutDashboard, Map, Menu, Network, School, Search, Settings, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';

const metrics = [
  { label: 'Government schools', value: '1,247', delta: '100% mapped', icon: School, tone: 'blue' },
  { label: 'Students enrolled', value: '2.84L', delta: '96.8% attendance', icon: GraduationCap, tone: 'violet' },
  { label: 'Teachers & staff', value: '12,486', delta: '312 vacancies', icon: Users, tone: 'teal' },
  { label: 'Actions pending', value: '148', delta: '23 priority', icon: ClipboardCheck, tone: 'amber' },
];
const zones = [
  { name: 'NMC Schools', detail: '10 zones · 218 schools', score: 91, color: '#2762d9' },
  { name: 'Zilla Parishad', detail: '13 blocks · 842 schools', score: 86, color: '#6941c6' },
  { name: 'Municipal Councils', detail: '14 councils · 126 schools', score: 82, color: '#079a82' },
  { name: 'State & Central', detail: 'Special bodies · 61 schools', score: 94, color: '#d97706' },
];
const tasks = [
  { title: 'Teacher vacancy approval', school: 'ZP Primary School, Hingna', time: 'Due today', level: 'Urgent' },
  { title: 'Infrastructure grant · ₹18.4L', school: 'NMC High School, Zone 7', time: '2 days left', level: 'Review' },
  { title: 'Inspection report verification', school: '12 schools · Parseoni Block', time: '4 days left', level: 'Normal' },
];
const nav = [
  ['Command Centre', LayoutDashboard], ['School Network', School], ['Officer Hierarchy', Network], ['Students & Staff', Users], ['Inspections', ClipboardCheck], ['Finance & Assets', Building2], ['District Map', Map],
] as const;

const schools = [
  ['27091500101', 'NMC Marathi Primary School, Mahal', 'NMC · Zone 6', '486', '97.4%', 'Compliant'],
  ['27090407201', 'ZP Primary School, Hingna', 'ZP · Hingna Block', '218', '89.1%', 'Review'],
  ['27091304302', 'NMC Hindi High School, Mominpura', 'NMC · Zone 8', '742', '94.8%', 'Compliant'],
  ['27090601801', 'ZP Upper Primary School, Parseoni', 'ZP · Parseoni Block', '361', '78.6%', 'Intervention'],
  ['27090802901', 'Municipal School, Kamptee', 'Municipal Council', '529', '92.3%', 'Compliant'],
];

function ModuleView({ active }: { active: string }) {
  if (active === 'Officer Hierarchy') return <div className="module-page">
    <div className="module-banner"><div><p className="eyebrow">LIVE ORGANOGRAM</p><h1>Officer hierarchy & accountability</h1><p>Every position, assignment, jurisdiction and escalation path—kept current through transfers.</p></div><button><Network size={16}/> Export structure</button></div>
    <div className="hierarchy-board panel">
      <div className="org-level"><div className="org-card apex"><span>STATE</span><strong>School Education Department</strong><small>Government of Maharashtra</small></div></div>
      <div className="org-line"/><div className="org-level"><div className="org-card"><span>DIVISION</span><strong>Deputy Director of Education</strong><small>Nagpur Division · 6 districts</small></div></div>
      <div className="org-line split"/><div className="org-columns">
        <div><div className="org-card blue"><span>URBAN</span><strong>NMC Education Officer</strong><small>218 schools</small></div><div className="mini-tree"><b>2</b> Assistant Education Officers <i>→</i> <b>10</b> Zone Inspectors <i>→</i> <b>218</b> Heads</div></div>
        <div><div className="org-card violet"><span>RURAL</span><strong>ZP Education Officer</strong><small>842 schools</small></div><div className="mini-tree"><b>2</b> Deputy Education Officers <i>→</i> <b>13</b> BEOs <i>→</i> <b>96</b> Cluster Heads</div></div>
        <div><div className="org-card teal"><span>LOCAL BODIES</span><strong>Municipal Council Officers</strong><small>126 schools</small></div><div className="mini-tree"><b>14</b> Chief Officers <i>→</i> <b>19</b> Inspectors <i>→</i> <b>126</b> Heads</div></div>
      </div>
    </div>
    <div className="module-stats"><div><strong>1,412</strong><span>active positions</span></div><div><strong>98.7%</strong><span>positions assigned</span></div><div><strong>17</strong><span>delegations active</span></div><div><strong>4</strong><span>vacant officer posts</span></div></div>
  </div>;

  if (active === 'School Network') return <div className="module-page">
    <div className="module-banner"><div><p className="eyebrow">MASTER SCHOOL REGISTRY</p><h1>Every school. One trusted record.</h1><p>Ownership, UDISE identity, enrollment, compliance and supervising officers in one place.</p></div><button><School size={16}/> Add school record</button></div>
    <div className="registry-tools panel"><label><Search size={16}/><input placeholder="Search 1,247 schools..."/></label><button>All authorities <ChevronDown size={14}/></button><button>All compliance states <ChevronDown size={14}/></button></div>
    <div className="school-table panel"><div className="table-row table-head"><span>UDISE CODE & SCHOOL</span><span>AUTHORITY</span><span>STUDENTS</span><span>ATTENDANCE</span><span>STATUS</span></div>{schools.map(s=><button className="table-row" key={s[0]}><span><small>{s[0]}</small><strong>{s[1]}</strong></span><span>{s[2]}</span><span>{s[3]}</span><span>{s[4]}</span><span><em className={s[5].toLowerCase()}>{s[5]}</em></span></button>)}</div>
  </div>;

  const moduleData: Record<string, [string,string,string,string][]> = {
    'Students & Staff': [['Total students','2,84,190','+3.2% YoY','blue'],['Teachers deployed','11,942','95.1% filled','teal'],['Vacant posts','312','42 critical','amber'],['At-risk students','1,864','Early intervention','violet']],
    'Inspections': [['Scheduled this month','486','71% completed','blue'],['Safety alerts','23','Action required','amber'],['Reports overdue','18','Escalated','violet'],['Fully compliant','1,071','85.9% schools','teal']],
    'Finance & Assets': [['Annual allocation','₹412.6Cr','FY 2026–27','blue'],['Funds utilised','₹286.4Cr','69.4% utilised','teal'],['Open grants','₹38.7Cr','148 requests','amber'],['Assets tagged','46,218','98.2% verified','violet']],
    'District Map': [['Urban schools','218','10 NMC zones','blue'],['Rural schools','842','13 blocks','teal'],['Municipal schools','126','14 councils','amber'],['Special schools','61','State & Central','violet']],
  };
  const cards = moduleData[active] || moduleData['Inspections'];
  return <div className="module-page"><div className="module-banner"><div><p className="eyebrow">DISTRICT MODULE</p><h1>{active}</h1><p>Live, jurisdiction-aware information for authorised officers across Nagpur district.</p></div><button><ArrowUpRight size={16}/> Generate briefing</button></div><div className="module-kpis">{cards.map(([a,b,c,d])=><article className={`module-kpi ${d}`} key={a}><span>{a}</span><strong>{b}</strong><small>{c}</small></article>)}</div><div className="panel activity-panel"><div className="panel-head"><div><p className="eyebrow">OPERATIONAL VIEW</p><h2>Latest district activity</h2></div><button>View all records <ArrowUpRight size={14}/></button></div>{['Zone 4 submitted its monthly compliance report','Hingna Block completed 18 school inspections','Infrastructure grant released to 7 schools','Officer assignment updated for Parseoni cluster'].map((x,i)=><div className="activity" key={x}><span>{i+1}</span><div><strong>{x}</strong><small>{i+1} hour{i ? 's':''} ago · Verified system event</small></div><CheckCircle2 size={17}/></div>)}</div></div>;
}

export default function Home() {
  const [active, setActive] = useState('Command Centre');
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  return <main className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="state-mark"><span>महा</span></div><div><strong>शिक्षण सेतु</strong><small>Nagpur School ERP</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={19}/></button></div>
      <div className="scope-pill"><ShieldCheck size={15}/><span>Government Network</span></div>
      <nav><p className="nav-label">DISTRICT OPERATIONS</p>{nav.map(([label, Icon]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => { setActive(label); setMenuOpen(false); }}><Icon size={18}/><span>{label}</span>{label === 'Inspections' && <em>23</em>}</button>)}</nav>
      <div className="sidebar-foot"><button><Settings size={18}/> System settings</button><div className="user-mini"><span>DK</span><div><strong>District Administrator</strong><small>Nagpur District</small></div></div></div>
    </aside>
    <section className="workspace">
      <header className="topbar"><button className="menu-button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumbs"><span>Maharashtra</span><b>/</b><strong>Nagpur District</strong><ChevronDown size={15}/></div><div className="top-actions"><label className="search"><Search size={17}/><input placeholder="Search school, officer, UDISE code..."/></label><button className="icon-button" onClick={() => setNotice(!notice)} aria-label="Notifications"><Bell size={19}/><i/></button><button className="profile">DK</button></div>{notice && <div className="notice-pop"><strong>3 priority alerts</strong><span>Two approvals and one safety inspection need attention.</span></div>}</header>
      <div className="content">{active !== 'Command Centre' ? <ModuleView active={active}/> : <>
        <section className="page-intro"><div><p className="eyebrow">DISTRICT COMMAND CENTRE</p><h1>Good morning, Commissioner</h1><p>One real-time view of every government school, officer and decision in Nagpur.</p></div><div className="status"><span/><div><strong>District systems operational</strong><small>Last synced 31 Aug 2026 · 10:42 AM</small></div></div></section>
        <section className="metric-grid">{metrics.map(({ label, value, delta, icon: Icon, tone }) => <article className="metric-card" key={label}><div className={`metric-icon ${tone}`}><Icon size={20}/></div><p>{label}</p><strong>{value}</strong><span>{delta}</span></article>)}</section>
        <section className="main-grid">
          <article className="panel performance"><div className="panel-head"><div><p className="eyebrow">SYSTEM PULSE</p><h2>Administrative performance</h2></div><button>View detailed report <ArrowUpRight size={15}/></button></div><div className="score-row"><div className="score-ring"><div><strong>88</strong><span>/100</span></div></div><div className="score-copy"><strong>District health is strong</strong><p>7 points above Maharashtra’s district benchmark</p><div className="legend"><span><i className="good"/>On track</span><span><i className="watch"/>Needs attention</span></div></div></div><div className="zone-list">{zones.map(zone => <div className="zone" key={zone.name}><div><strong>{zone.name}</strong><span>{zone.detail}</span></div><div className="bar"><i style={{width: `${zone.score}%`, background: zone.color}}/></div><b>{zone.score}%</b></div>)}</div></article>
          <article className="panel action-panel"><div className="panel-head"><div><p className="eyebrow">ACTION DESK</p><h2>Awaiting your office</h2></div><span className="count">148</span></div><div className="task-list">{tasks.map((task, i) => <button className="task" key={task.title} onClick={()=>setSelectedTask(task.title)}><span className={`task-symbol t${i}`}><FileCheck2 size={18}/></span><div><strong>{task.title}</strong><p>{task.school}</p><small>{task.time}</small></div><em>{task.level}</em><ArrowUpRight size={16}/></button>)}</div><button className="primary-action" onClick={()=>setActive('Inspections')}>Open unified action desk <ArrowUpRight size={16}/></button></article>
        </section>
        <section className="lower-grid">
          <article className="panel hierarchy-card"><div className="panel-head"><div><p className="eyebrow">ACCOUNTABILITY MAP</p><h2>Who reports to whom</h2></div><button onClick={() => setActive('Officer Hierarchy')}>Explore hierarchy <ArrowUpRight size={15}/></button></div><div className="hierarchy-flow"><div className="node top"><span>DD</span><div><strong>Divisional Director</strong><small>Nagpur Division</small></div></div><div className="connector"/><div className="branches"><div className="branch"><div className="node"><span>EO</span><div><strong>NMC Education Officer</strong><small>10 zone inspectors</small></div></div></div><div className="branch"><div className="node"><span>ZP</span><div><strong>ZP Education Officer</strong><small>13 block officers</small></div></div></div><div className="branch"><div className="node"><span>MC</span><div><strong>Municipal Councils</strong><small>14 chief officers</small></div></div></div></div></div></article>
          <article className="panel alerts-card"><div className="panel-head"><div><p className="eyebrow">EARLY WARNING</p><h2>Needs intervention</h2></div></div><div className="alert-item"><AlertTriangle size={18}/><div><strong>23 schools below 80% attendance</strong><span>Concentrated in 3 rural blocks</span></div><b>High</b></div><div className="alert-item safe"><CheckCircle2 size={18}/><div><strong>Drinking water compliance</strong><span>1,219 of 1,247 schools verified</span></div><b>97.8%</b></div></article>
        </section></>}
      </div>
    </section>
    {selectedTask && <div className="modal-backdrop" onClick={()=>setSelectedTask(null)}><div className="decision-modal" onClick={e=>e.stopPropagation()}><button className="modal-x" onClick={()=>setSelectedTask(null)}><X size={18}/></button><p className="eyebrow">SECURE APPROVAL WORKFLOW</p><h2>{selectedTask}</h2><p>This request has passed school and supervisory verification. Your decision will be time-stamped in the permanent audit trail.</p><div className="decision-meta"><span>Current stage<strong>Commissioner review</strong></span><span>Jurisdiction<strong>Nagpur District</strong></span></div><textarea placeholder="Add decision remarks (optional)"/><div className="decision-buttons"><button onClick={()=>setSelectedTask(null)}>Return for clarification</button><button onClick={()=>setSelectedTask(null)}><CheckCircle2 size={16}/> Approve request</button></div></div></div>}
  </main>;
}
