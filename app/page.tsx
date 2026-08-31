'use client';

import { Bell, Check, ChevronDown, CircleAlert, Download, FileText, Filter, Landmark, Menu, Network, Search, School, ShieldCheck, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type Issue = { id:string; subject:string; school:string; authority:string; pending:string; priority:'Immediate'|'This week'|'Routine'; stage:string };

const issues: Issue[] = [
  { id:'EO/EST/2026/0418', subject:'Approval against vacant graduate teacher post', school:'Z.P. Upper Primary School, Parseoni', authority:'Zilla Parishad', pending:'6 days', priority:'Immediate', stage:'Education Officer' },
  { id:'NMC/EDU/2026/1192', subject:'Structural repair estimate — Block B', school:'NMC Hindi High School, Zone 8', authority:'NMC', pending:'4 days', priority:'Immediate', stage:'Municipal Commissioner' },
  { id:'BEO/HIN/2026/0834', subject:'Attendance below 75% for three consecutive weeks', school:'Z.P. Primary School, Wanadongri', authority:'Hingna Block', pending:'2 days', priority:'This week', stage:'Block Education Officer' },
  { id:'EO/POS/2026/0261', subject:'PM POSHAN grain reconciliation variance', school:'12 schools, Kamptee Block', authority:'Zilla Parishad', pending:'8 days', priority:'This week', stage:'Deputy Education Officer' },
  { id:'NMC/INS/2026/0620', subject:'Annual fire-safety inspection report', school:'NMC Marathi School, Mahal', authority:'NMC', pending:'1 day', priority:'Routine', stage:'Zone Inspector' },
];

const schools = [
  ['27091500101','NMC Marathi Primary School, Mahal','NMC / Zone 6','Primary','486','97.4%','Verified'],
  ['27090407201','Z.P. Primary School, Hingna','ZP / Hingna','Primary','218','89.1%','Review'],
  ['27091304302','NMC Hindi High School, Mominpura','NMC / Zone 8','Secondary','742','94.8%','Verified'],
  ['27090601801','Z.P. Upper Primary School, Parseoni','ZP / Parseoni','Upper Primary','361','78.6%','Action due'],
  ['27090802901','Municipal School, Kamptee','Municipal Council','Composite','529','92.3%','Verified'],
  ['27091001504','Government High School, Umred','State Government','Secondary','604','95.7%','Verified'],
];

const nav = ['District overview','School register','Officer hierarchy','Staff position','Inspection register','Grants & works'];

function Stat({label,value,note,warning}:{label:string,value:string,note:string,warning?:boolean}) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong><small className={warning?'warn':''}>{note}</small></div>;
}

export default function Home(){
  const [active,setActive]=useState('District overview');
  const [lang,setLang]=useState<'EN'|'मराठी'>('EN');
  const [menu,setMenu]=useState(false);
  const [selected,setSelected]=useState<Issue|null>(null);
  const [query,setQuery]=useState('');
  const visibleSchools=useMemo(()=>schools.filter(s=>s.join(' ').toLowerCase().includes(query.toLowerCase())),[query]);

  return <main className="portal">
    <div className="tricolour"><i/><i/><i/></div>
    <header className="masthead">
      <button className="mobile-menu" onClick={()=>setMenu(true)} aria-label="Open navigation"><Menu size={20}/></button>
      <div className="dept-mark"><Landmark size={23}/></div>
      <div className="title"><span>जिल्हा शिक्षण कार्यालय, नागपूर</span><strong>District Education Office, Nagpur</strong><small>School Education and Sports Department · Government of Maharashtra</small></div>
      <div className="header-tools"><button className="language" onClick={()=>setLang(lang==='EN'?'मराठी':'EN')}>{lang}<ChevronDown size={12}/></button><button className="bell" aria-label="Notifications"><Bell size={18}/><b>3</b></button><div className="officer"><span>District Administrator</span><small>Authorised access</small></div></div>
    </header>
    <div className="system-bar"><span><ShieldCheck size={14}/> Shikshan Setu · District School Administration System</span><div><b>Data date:</b> 31 August 2026 <i/> <b>Academic year:</b> 2026–27 <i/> <span className="demo">DEMONSTRATION DATA</span></div></div>

    <div className="portal-body">
      <aside className={menu?'side open':'side'}><button className="close" onClick={()=>setMenu(false)}><X size={18}/></button><p>MAIN MODULES</p>{nav.map(item=><button key={item} className={active===item?'active':''} onClick={()=>{setActive(item);setMenu(false)}}>{item==='School register'?<School/>:item==='Officer hierarchy'?<Network/>:item==='Staff position'?<Users/>:<FileText/>}<span>{item}</span>{item==='Inspection register'&&<em>23</em>}</button>)}<div className="side-help"><strong>Need assistance?</strong><span>District MIS Cell</span><small>0712-256 0124 · Ext. 204</small></div></aside>

      <section className="main-content">
        {active==='District overview' && <Overview onSelect={setSelected}/>} 
        {active==='School register' && <SchoolRegister query={query} setQuery={setQuery} rows={visibleSchools}/>} 
        {active==='Officer hierarchy' && <Hierarchy/>}
        {!['District overview','School register','Officer hierarchy'].includes(active) && <RegisterPage title={active}/>} 
      </section>
    </div>

    {selected&&<div className="overlay" onClick={()=>setSelected(null)}><section className="file-sheet" onClick={e=>e.stopPropagation()}><header><div><span>Electronic File</span><strong>{selected.id}</strong></div><button onClick={()=>setSelected(null)}><X size={18}/></button></header><div className="file-body"><h2>{selected.subject}</h2><dl><div><dt>Institution</dt><dd>{selected.school}</dd></div><div><dt>Administrative authority</dt><dd>{selected.authority}</dd></div><div><dt>Current stage</dt><dd>{selected.stage}</dd></div><div><dt>Time pending</dt><dd>{selected.pending}</dd></div></dl><div className="note"><CircleAlert size={17}/><p><strong>Decision note</strong><span>This is a prototype workflow. The production system will display the file noting, applicable Government Resolution, delegation of powers and supporting documents here.</span></p></div><label>Remarks<textarea placeholder="Enter remarks for the file record"/></label></div><footer><button onClick={()=>setSelected(null)}>Return to previous officer</button><button onClick={()=>setSelected(null)}><Check size={15}/> Record approval</button></footer></section></div>}
  </main>
}

function PageHead({kicker,title,children}:{kicker:string,title:string,children?:React.ReactNode}){return <div className="page-head"><div><span>{kicker}</span><h1>{title}</h1></div><div>{children}</div></div>}

function Overview({onSelect}:{onSelect:(x:Issue)=>void}){
  return <><PageHead kicker="DISTRICT CONTROL ROOM" title="School administration — consolidated position"><button className="outline"><Download size={14}/> Download briefing note</button></PageHead>
    <div className="source-note"><b>Scope:</b> Government and local-body schools mapped to Nagpur district <span>•</span> Figures below are illustrative pending connection to authorised systems.</div>
    <section className="stats"><Stat label="Schools in district register" value="1,247" note="218 NMC · 842 ZP · 187 other"/><Stat label="Student enrolment" value="2,84,190" note="Reported by 1,231 schools"/><Stat label="Sanctioned teaching posts" value="12,798" note="312 reported vacant" warning/><Stat label="Files pending beyond SLA" value="47" note="11 require district-level action" warning/></section>
    <div className="two-col">
      <section className="block exception"><div className="block-head"><div><h2>Priority exception register</h2><span>Items requiring supervisory action</span></div><button><Filter size={14}/> Filter</button></div><div className="table-scroll"><table><thead><tr><th>File / subject</th><th>Institution</th><th>Pending at</th><th>Age</th><th>Priority</th></tr></thead><tbody>{issues.map(x=><tr key={x.id} onClick={()=>onSelect(x)}><td><small>{x.id}</small><strong>{x.subject}</strong></td><td>{x.school}<small>{x.authority}</small></td><td>{x.stage}</td><td>{x.pending}</td><td><span className={`priority ${x.priority.replace(' ','-').toLowerCase()}`}>{x.priority}</span></td></tr>)}</tbody></table></div><button className="table-link">Open complete exception register →</button></section>
      <aside className="block reporting"><div className="block-head"><div><h2>Data receipt position</h2><span>Monthly return · August 2026</span></div></div><div className="receipt"><div><span>NMC zones</span><b>10 / 10</b></div><progress value="10" max="10"/><small>Complete</small></div><div className="receipt"><div><span>ZP blocks</span><b>12 / 13</b></div><progress value="12" max="13"/><small>Parseoni return pending</small></div><div className="receipt"><div><span>Municipal councils</span><b>11 / 14</b></div><progress value="11" max="14"/><small>3 returns overdue</small></div><div className="cutoff"><b>Next reporting cut-off</b><strong>05 Sep 2026</strong><span>5 days remaining</span></div></aside>
    </div>
    <section className="block coverage"><div className="block-head"><div><h2>Administrative coverage</h2><span>Schools assigned to each supervising channel</span></div><button className="text-button">View officer assignments →</button></div><div className="coverage-grid"><div><b>Nagpur Municipal Corporation</b><span>Education Officer → 2 AEOs → 10 Zone Inspectors</span><strong>218 schools</strong></div><div><b>Nagpur Zilla Parishad</b><span>Education Officer → 13 BEOs → 96 Cluster Heads</span><strong>842 schools</strong></div><div><b>Municipal Councils</b><span>Chief Officers → designated education supervisors</span><strong>126 schools</strong></div><div><b>State / Central management</b><span>Separate controlling authorities; district reporting view</span><strong>61 schools</strong></div></div></section>
  </>
}

function SchoolRegister({query,setQuery,rows}:{query:string,setQuery:(x:string)=>void;rows:string[][]}){return <><PageHead kicker="MASTER DATA" title="District school register"><button className="outline"><Download size={14}/> Export register</button></PageHead><div className="register-tools"><label><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, UDISE code, authority..."/></label><select><option>All authorities</option><option>NMC</option><option>Zilla Parishad</option></select><select><option>All school levels</option><option>Primary</option><option>Secondary</option></select></div><section className="block school-list"><div className="result-count">Showing {rows.length} demonstration records <span>Production register: 1,247 schools</span></div><div className="table-scroll"><table><thead><tr><th>UDISE code</th><th>School name</th><th>Authority / jurisdiction</th><th>Level</th><th>Students</th><th>Attendance</th><th>Data status</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}><td className="mono">{r[0]}</td><td><strong>{r[1]}</strong></td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td><td><span className={`record ${r[6].replace(' ','-').toLowerCase()}`}>{r[6]}</span></td></tr>)}</tbody></table></div></section></>}

function Hierarchy(){return <><PageHead kicker="ESTABLISHMENT" title="Administrative hierarchy and jurisdiction"><button className="outline"><Download size={14}/> Export organogram</button></PageHead><div className="source-note"><b>Important:</b> The system stores positions separately from officer postings, so transfers do not break historical approvals or reporting lines.</div><section className="hierarchy block"><div className="h-level"><article className="h-card state"><small>STATE LEVEL</small><strong>School Education and Sports Department</strong><span>Policy, budget and statewide administration</span></article></div><i/><div className="h-level"><article className="h-card"><small>DIVISIONAL LEVEL</small><strong>Deputy Director of Education, Nagpur Division</strong><span>Divisional supervision and escalation</span></article></div><i/><div className="h-branches"><article className="h-card"><small>URBAN LOCAL AUTHORITY</small><strong>NMC Education Officer</strong><span>2 Assistant Education Officers</span><span>10 Zone School Inspectors</span><b>218 schools</b></article><article className="h-card"><small>RURAL LOCAL AUTHORITY</small><strong>ZP Education Officer</strong><span>Deputy Education Officers</span><span>13 BEOs · 96 Cluster Heads</span><b>842 schools</b></article><article className="h-card"><small>OTHER LOCAL AUTHORITIES</small><strong>Municipal Council Chief Officers</strong><span>Designated education supervisors</span><span>14 urban local bodies</span><b>126 schools</b></article></div></section></>}

function RegisterPage({title}:{title:string}){return <><PageHead kicker="OPERATIONAL REGISTER" title={title}><button className="outline"><Download size={14}/> Export</button></PageHead><div className="source-note"><b>Prototype module:</b> The production version will apply jurisdiction-based access, departmental retention rules and a complete audit trail.</div><section className="block placeholder-register"><div className="block-head"><div><h2>Current reporting position</h2><span>Consolidated across assigned authorities</span></div></div>{['Returns received and verified','Pending verification by supervisory officer','Returned to school for correction','Overdue beyond prescribed timeline'].map((x,i)=><div className="register-line" key={x}><span>{String(i+1).padStart(2,'0')}</span><strong>{x}</strong><b>{[1134,68,27,18][i]}</b><button>View records</button></div>)}</section></>}
