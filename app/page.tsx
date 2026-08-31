"use client";

import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  Database,
  Download,
  FileText,
  Filter,
  GraduationCap,
  HeartPulse,
  IndianRupee,
  Landmark,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareWarning,
  Network,
  Plus,
  RefreshCw,
  Search,
  School,
  Send,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDemoAuth } from "@/components/demo-auth";

type Issue = {
  id: string;
  subject: string;
  school: string;
  authority: string;
  pending: string;
  priority: "Immediate" | "This week" | "Routine";
  stage: string;
};
type Detail = {
  kind: string;
  ref: string;
  title: string;
  fields: [string, string][];
  note: string;
  action?: string;
};
type SchoolRow = {
  udise: string;
  name: string;
  authority: string;
  level: string;
  students: string;
  attendance: string;
  status: string;
  head: string;
  phone: string;
};

const issues: Issue[] = [
  {
    id: "EO/EST/2026/0418",
    subject: "Approval against vacant graduate teacher post",
    school: "Z.P. Upper Primary School, Parseoni",
    authority: "Zilla Parishad",
    pending: "6 days",
    priority: "Immediate",
    stage: "Education Officer",
  },
  {
    id: "NMC/EDU/2026/1192",
    subject: "Structural repair estimate — Block B",
    school: "NMC Hindi High School, Zone 8",
    authority: "NMC",
    pending: "4 days",
    priority: "Immediate",
    stage: "Municipal Commissioner",
  },
  {
    id: "BEO/HIN/2026/0834",
    subject: "Attendance below 75% for three consecutive weeks",
    school: "Z.P. Primary School, Wanadongri",
    authority: "Hingna Block",
    pending: "2 days",
    priority: "This week",
    stage: "Block Education Officer",
  },
  {
    id: "EO/POS/2026/0261",
    subject: "PM POSHAN grain reconciliation variance",
    school: "12 schools, Kamptee Block",
    authority: "Zilla Parishad",
    pending: "8 days",
    priority: "This week",
    stage: "Deputy Education Officer",
  },
  {
    id: "NMC/INS/2026/0620",
    subject: "Annual fire-safety inspection report",
    school: "NMC Marathi School, Mahal",
    authority: "NMC",
    pending: "1 day",
    priority: "Routine",
    stage: "Zone Inspector",
  },
];
const schools: SchoolRow[] = [
  {
    udise: "27091500101",
    name: "NMC Marathi Primary School, Mahal",
    authority: "NMC / Zone 6",
    level: "Primary",
    students: "486",
    attendance: "97.4%",
    status: "Verified",
    head: "Smt. N. Wankhede",
    phone: "0712-276 1048",
  },
  {
    udise: "27090407201",
    name: "Z.P. Primary School, Hingna",
    authority: "Zilla Parishad / Hingna",
    level: "Primary",
    students: "218",
    attendance: "89.1%",
    status: "Review",
    head: "Shri R. Uikey",
    phone: "07104-236 118",
  },
  {
    udise: "27091304302",
    name: "NMC Hindi High School, Mominpura",
    authority: "NMC / Zone 8",
    level: "Secondary",
    students: "742",
    attendance: "94.8%",
    status: "Verified",
    head: "Smt. S. Khan",
    phone: "0712-272 0942",
  },
  {
    udise: "27090601801",
    name: "Z.P. Upper Primary School, Parseoni",
    authority: "Zilla Parishad / Parseoni",
    level: "Upper Primary",
    students: "361",
    attendance: "78.6%",
    status: "Action due",
    head: "Shri V. Meshram",
    phone: "07102-225 106",
  },
  {
    udise: "27090802901",
    name: "Municipal School, Kamptee",
    authority: "Municipal Council",
    level: "Composite",
    students: "529",
    attendance: "92.3%",
    status: "Verified",
    head: "Smt. P. Borkar",
    phone: "07109-288 207",
  },
  {
    udise: "27091001504",
    name: "Government High School, Umred",
    authority: "State Government",
    level: "Secondary",
    students: "604",
    attendance: "95.7%",
    status: "Verified",
    head: "Shri S. Gajbhiye",
    phone: "07116-242 089",
  },
];
const staff = [
  [
    "EST/ZP/2026/118",
    "Graduate Teacher — Mathematics",
    "Z.P. High School, Ramtek",
    "1",
    "Vacant 94 days",
    "Proposal due",
  ],
  [
    "EST/NMC/2026/207",
    "Assistant Teacher — Marathi",
    "NMC Primary School, Zone 3",
    "2",
    "Vacant 38 days",
    "Under review",
  ],
  [
    "EST/ZP/2026/144",
    "Headmaster",
    "Z.P. Upper Primary School, Kuhi",
    "1",
    "Acting charge",
    "Priority",
  ],
  [
    "EST/MC/2026/039",
    "Science Teacher",
    "Municipal High School, Katol",
    "1",
    "Vacant 21 days",
    "Advertised",
  ],
  [
    "EST/ZP/2026/166",
    "Special Educator",
    "Schools in Saoner Block",
    "3",
    "New sanction",
    "Roster check",
  ],
];
const inspections = [
  [
    "INS/2026/0841",
    "Z.P. Primary School, Wanadongri",
    "Hingna",
    "Comprehensive",
    "04 Sep 2026",
    "Scheduled",
    "BEO Hingna",
  ],
  [
    "INS/2026/0818",
    "NMC Hindi High School, Zone 8",
    "NMC Zone 8",
    "Safety",
    "31 Aug 2026",
    "Overdue",
    "Zone Inspector 8",
  ],
  [
    "INS/2026/0796",
    "Z.P. School, Mouda",
    "Mouda",
    "Academic",
    "29 Aug 2026",
    "Submitted",
    "Cluster Head 14",
  ],
  [
    "INS/2026/0764",
    "Municipal School, Kamptee",
    "Municipal Council",
    "Infrastructure",
    "25 Aug 2026",
    "Correction due",
    "Chief Officer",
  ],
  [
    "INS/2026/0852",
    "Government High School, Umred",
    "State Govt.",
    "Safety",
    "08 Sep 2026",
    "Scheduled",
    "District Inspector",
  ],
];
const works = [
  [
    "CW/2026/119",
    "Additional classroom construction",
    "Z.P. School, Parseoni",
    "₹24.80 lakh",
    "Technical sanction",
    "EE, Zilla Parishad",
  ],
  [
    "NMC/EDU/88",
    "Roof and electrical repairs",
    "NMC High School, Zone 7",
    "₹18.40 lakh",
    "Administrative approval",
    "Municipal Commissioner",
  ],
  [
    "GR/2026/204",
    "Girls toilet rehabilitation",
    "14 schools, Ramtek Block",
    "₹31.20 lakh",
    "Fund released",
    "BEO Ramtek",
  ],
  [
    "ASSET/2026/61",
    "ICT laboratory equipment",
    "Municipal School, Kamptee",
    "₹9.75 lakh",
    "Procurement",
    "Chief Officer",
  ],
  [
    "CW/2026/137",
    "Drinking water system",
    "8 schools, Kuhi Block",
    "₹12.60 lakh",
    "Estimate returned",
    "Deputy Engineer",
  ],
];
const nav = [
  "District overview",
  "Executive review",
  "District risk map",
  "Student early warning",
  "Grievance escalation",
  "Schemes & entitlements",
  "Infrastructure & safety",
  "School register",
  "Officer hierarchy",
  "Staff position",
  "Inspection register",
  "Grants & works",
  "Data governance & audit",
];

function exportCsv(name: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
function Stat({
  label,
  value,
  note,
  warning,
}: {
  label: string;
  value: string;
  note: string;
  warning?: boolean;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small className={warning ? "warn" : ""}>{note}</small>
    </div>
  );
}
function PageHead({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span>{kicker}</span>
        <h1>{title}</h1>
      </div>
      <div>{children}</div>
    </div>
  );
}
function detailOfIssue(x: Issue): Detail {
  return {
    kind: "Electronic file",
    ref: x.id,
    title: x.subject,
    fields: [
      ["Institution", x.school],
      ["Administrative authority", x.authority],
      ["Current stage", x.stage],
      ["Time pending", x.pending],
      ["Priority", x.priority],
    ],
    note: "The production system will display file noting, applicable Government Resolution, delegation of powers and supporting documents.",
    action: "Record decision",
  };
}

export default function Home() {
  const { session, logout } = useDemoAuth();
  const [active, setActive] = useState("District overview");
  const [lang, setLang] = useState<"EN" | "मराठी">("EN");
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [toast, setToast] = useState("");
  const act = (message: string) => {
    setDetail(null);
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };
  return (
    <main className="portal">
      <div className="tricolour">
        <i />
        <i />
        <i />
      </div>
      <header className="masthead">
        <button
          className="mobile-menu"
          onClick={() => setMenu(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="dept-mark">
          <Landmark size={23} />
        </div>
        <div className="title">
          <span>जिल्हा शिक्षण कार्यालय, नागपूर</span>
          <strong>
            {lang === "EN"
              ? "District Education Office, Nagpur"
              : "जिल्हा शिक्षण कार्यालय, नागपूर"}
          </strong>
          <small>
            School Education and Sports Department · Government of Maharashtra
          </small>
        </div>
        <div className="header-tools">
          <button
            className="language"
            onClick={() => setLang(lang === "EN" ? "मराठी" : "EN")}
          >
            {lang}
            <ChevronDown size={12} />
          </button>
          <button
            className="bell"
            onClick={() =>
              setToast("3 alerts")
            }
            aria-label="Notifications"
          >
            <Bell size={18} />
            <b>3</b>
          </button>
          <div className="officer">
            <span>{session.name}</span>
            <small>{session.office}</small>
          </div>
          <button className="logout-button" onClick={logout} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <div className="system-bar">
        <span>
          <ShieldCheck size={14} /> Shikshan Setu · District School
          Administration System
        </span>
        <div>
          <b>Data date:</b> 31 August 2026 <i /> <b>Academic year:</b> 2026–27{" "}
          <i /> <span className="demo">DEMONSTRATION DATA</span>
        </div>
      </div>
      <div className="portal-body">
        <aside className={menu ? "side open" : "side"}>
          <a className="suite-link" href="/apps">
            <span>▦</span>
            <b>Applications</b>
          </a>
          <button className="close" onClick={() => setMenu(false)}>
            <X size={18} />
          </button>
          <p>MODULES</p>
          {nav.map((item) => (
            <button
              key={item}
              className={active === item ? "active" : ""}
              onClick={() => {
                setActive(item);
                setMenu(false);
              }}
            >
              {item === "Executive review" ? (
                <CalendarDays />
              ) : item === "District risk map" ? (
                <MapPinned />
              ) : item === "Student early warning" ? (
                <GraduationCap />
              ) : item === "Grievance escalation" ? (
                <MessageSquareWarning />
              ) : item === "Schemes & entitlements" ? (
                <IndianRupee />
              ) : item === "Infrastructure & safety" ? (
                <HeartPulse />
              ) : item === "School register" ? (
                <School />
              ) : item === "Officer hierarchy" ? (
                <Network />
              ) : item === "Staff position" ? (
                <Users />
              ) : item === "Inspection register" ? (
                <ClipboardCheck />
              ) : item === "Grants & works" ? (
                <IndianRupee />
              ) : item === "Data governance & audit" ? (
                <Database />
              ) : (
                <FileText />
              )}
              <span>{item}</span>
              {item === "Inspection register" && <em>23</em>}
              {item === "Grievance escalation" && <em>11</em>}
            </button>
          ))}
          <div className="side-help">
            <span>District MIS Cell</span>
            <small>0712-256 0124 · Ext. 204</small>
          </div>
        </aside>
        <section className="main-content">
          {active === "District overview" && (
            <Overview
              open={(x) => setDetail(detailOfIssue(x))}
              navigate={setActive}
            />
          )}{" "}
          {active === "Executive review" && (
            <ExecutiveReview open={setDetail} notify={setToast} />
          )}{" "}
          {active === "District risk map" && <RiskMap open={setDetail} />}{" "}
          {active === "Student early warning" && (
            <EarlyWarning open={setDetail} />
          )}{" "}
          {active === "Grievance escalation" && <Grievances open={setDetail} />}{" "}
          {active === "Schemes & entitlements" && <Schemes open={setDetail} />}{" "}
          {active === "Infrastructure & safety" && (
            <Infrastructure open={setDetail} />
          )}{" "}
          {active === "School register" && <SchoolRegister open={setDetail} />}{" "}
          {active === "Officer hierarchy" && <Hierarchy open={setDetail} />}{" "}
          {active === "Staff position" && <StaffModule open={setDetail} />}{" "}
          {active === "Inspection register" && (
            <InspectionModule open={setDetail} />
          )}{" "}
          {active === "Grants & works" && <WorksModule open={setDetail} />}{" "}
          {active === "Data governance & audit" && (
            <DataGovernance open={setDetail} notify={setToast} />
          )}
        </section>
      </div>
      {detail && (
        <DetailDrawer
          detail={detail}
          close={() => setDetail(null)}
          action={() =>
            act(`${detail.action || "Action"} recorded.`)
          }
        />
      )}{" "}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </main>
  );
}

function Overview({
  open,
  navigate,
}: {
  open: (x: Issue) => void;
  navigate: (x: string) => void;
}) {
  return (
    <>
      <PageHead
        kicker="DISTRICT CONTROL ROOM"
        title="School administration — consolidated position"
      >
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "nagpur-district-briefing.csv",
              ["Indicator", "Value"],
              [
                ["Schools", "1,247"],
                ["Students", "2,84,190"],
                ["Vacant posts", "312"],
                ["Files beyond SLA", "47"],
              ],
            )
          }
        >
          <Download size={14} /> Download briefing note
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Schools in district register"
          value="1,247"
          note="218 NMC · 842 ZP · 187 other"
        />
        <Stat
          label="Student enrolment"
          value="2,84,190"
          note="Reported by 1,231 schools"
        />
        <Stat
          label="Sanctioned teaching posts"
          value="12,798"
          note="312 reported vacant"
          warning
        />
        <Stat
          label="Files pending beyond SLA"
          value="47"
          note="11 require district-level action"
          warning
        />
      </section>
      <div className="two-col">
        <section className="block exception">
          <div className="block-head">
            <div>
              <h2>Priority exception register</h2>
            </div>
            <button onClick={() => navigate("Inspection register")}>
              <Filter size={14} /> Open register
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>File / subject</th>
                  <th>Institution</th>
                  <th>Pending at</th>
                  <th>Age</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((x) => (
                  <tr key={x.id} onClick={() => open(x)}>
                    <td>
                      <small>{x.id}</small>
                      <strong>{x.subject}</strong>
                    </td>
                    <td>
                      {x.school}
                      <small>{x.authority}</small>
                    </td>
                    <td>{x.stage}</td>
                    <td>{x.pending}</td>
                    <td>
                      <span
                        className={`priority ${x.priority.replace(" ", "-").toLowerCase()}`}
                      >
                        {x.priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="table-link"
            onClick={() => navigate("Inspection register")}
          >
            Complete register →
          </button>
        </section>
        <aside className="block reporting">
          <div className="block-head">
            <div>
              <h2>Data receipt position</h2>
              <span>August 2026</span>
            </div>
          </div>
          {[
            ["NMC zones", "10 / 10", "10", "10", "Complete"],
            ["ZP blocks", "12 / 13", "12", "13", "Parseoni return pending"],
            ["Municipal councils", "11 / 14", "11", "14", "3 returns overdue"],
          ].map((r) => (
            <div className="receipt" key={r[0]}>
              <div>
                <span>{r[0]}</span>
                <b>{r[1]}</b>
              </div>
              <progress value={r[2]} max={r[3]} />
              <small>{r[4]}</small>
            </div>
          ))}
          <div className="cutoff">
            <b>Reporting cut-off</b>
            <strong>05 Sep 2026</strong>
            <span>5 days</span>
          </div>
        </aside>
      </div>
      <section className="block coverage">
        <div className="block-head">
          <div>
            <h2>Administrative coverage</h2>
          </div>
          <button
            className="text-button"
            onClick={() => navigate("Officer hierarchy")}
          >
            Officer assignments →
          </button>
        </div>
        <div className="coverage-grid">
          {[
            [
              "Nagpur Municipal Corporation",
              "Education Officer → 2 AEOs → 10 Zone Inspectors",
              "218 schools",
            ],
            [
              "Nagpur Zilla Parishad",
              "Education Officer → 13 BEOs → 96 Cluster Heads",
              "842 schools",
            ],
            [
              "Municipal Councils",
              "Chief Officers → designated education supervisors",
              "126 schools",
            ],
            [
              "State / Central management",
              "Separate authorities; district reporting view",
              "61 schools",
            ],
          ].map((r) => (
            <div key={r[0]}>
              <b>{r[0]}</b>
              <span>{r[1]}</span>
              <strong>{r[2]}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SchoolRegister({ open }: { open: (d: Detail) => void }) {
  const [q, setQ] = useState("");
  const [auth, setAuth] = useState("All");
  const [level, setLevel] = useState("All");
  const rows = useMemo(
    () =>
      schools.filter(
        (s) =>
          (auth === "All" || s.authority.includes(auth)) &&
          (level === "All" || s.level === level) &&
          Object.values(s).join(" ").toLowerCase().includes(q.toLowerCase()),
      ),
    [q, auth, level],
  );
  return (
    <>
      <PageHead kicker="MASTER DATA" title="District school register">
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "school-register.csv",
              [
                "UDISE",
                "School",
                "Authority",
                "Level",
                "Students",
                "Attendance",
                "Status",
              ],
              rows.map((s) => [
                s.udise,
                s.name,
                s.authority,
                s.level,
                s.students,
                s.attendance,
                s.status,
              ]),
            )
          }
        >
          <Download size={14} /> Export register
        </button>
      </PageHead>
      <div className="register-tools">
        <label>
          <Search size={16} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, UDISE code, authority..."
          />
        </label>
        <select value={auth} onChange={(e) => setAuth(e.target.value)}>
          <option>All</option>
          <option>NMC</option>
          <option>Zilla Parishad</option>
          <option>Municipal Council</option>
          <option>State Government</option>
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option>All</option>
          <option>Primary</option>
          <option>Upper Primary</option>
          <option>Secondary</option>
          <option>Composite</option>
        </select>
      </div>
      <section className="block school-list">
        <div className="result-count">{rows.length} records</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>UDISE code</th>
                <th>School name</th>
                <th>Authority / jurisdiction</th>
                <th>Level</th>
                <th>Students</th>
                <th>Attendance</th>
                <th>Data status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.udise}
                  onClick={() =>
                    open({
                      kind: "School record",
                      ref: `UDISE ${s.udise}`,
                      title: s.name,
                      fields: [
                        ["Authority / jurisdiction", s.authority],
                        ["School level", s.level],
                        ["Head of school", s.head],
                        ["Enrolment", s.students],
                        ["Average attendance", s.attendance],
                        ["Office contact", s.phone],
                        ["Data verification", s.status],
                      ],
                      note: "This record combines identity, supervisory assignment, staffing and compliance information.",
                      action: "Save verification",
                    })
                  }
                >
                  <td className="mono">{s.udise}</td>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.authority}</td>
                  <td>{s.level}</td>
                  <td>{s.students}</td>
                  <td>{s.attendance}</td>
                  <td>
                    <span
                      className={`record ${s.status.replace(" ", "-").toLowerCase()}`}
                    >
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <div className="empty">No records</div>
        )}
      </section>
    </>
  );
}

function Hierarchy({ open }: { open: (d: Detail) => void }) {
  const [tab, setTab] = useState("Structure");
  const [q, setQ] = useState("");
  const [route, setRoute] = useState("Teacher vacancy proposal");
  const card = (
    ref: string,
    title: string,
    level: string,
    reports: string,
    jurisdiction: string,
    assignment: string,
    delegation: string,
  ) =>
    open({
      kind: "Position & jurisdiction",
      ref,
      title,
      fields: [
        ["Administrative level", level],
        ["Reports to", reports],
        ["Jurisdiction", jurisdiction],
        ["Current assignment", assignment],
        ["Delegated authority", delegation],
        ["Assignment validity", "01 Jun 2026 — 31 May 2027"],
      ],
      note: "The position is permanent; the officer assignment, delegation and jurisdiction are effective-dated so historical approvals remain intact.",
      action: "Update assignment",
    });
  const positions = [
    [
      "POS-MH-COMM",
      "Commissioner of Education",
      "State",
      "Principal Secretary, School Education",
      "Maharashtra",
      "Assigned",
    ],
    [
      "POS-MH-DIR-P",
      "Director of Primary Education",
      "State",
      "Commissioner of Education",
      "Maharashtra — Primary",
      "Assigned",
    ],
    [
      "POS-NGP-DDE",
      "Deputy Director of Education, Nagpur Division",
      "Division",
      "Directorate of Education",
      "Nagpur Division — 6 districts",
      "Assigned",
    ],
    [
      "POS-NMC-EO",
      "Education Officer, NMC",
      "Urban local authority",
      "Municipal Commissioner",
      "NMC — 10 zones, 218 schools",
      "Assigned",
    ],
    [
      "POS-NMC-AEO-P",
      "Assistant Education Officer — Primary",
      "Urban local authority",
      "Education Officer, NMC",
      "NMC primary schools",
      "Assigned",
    ],
    [
      "POS-NMC-ZI-08",
      "Zone School Inspector — Zone 8",
      "Zone",
      "Assistant Education Officer",
      "NMC Zone 8 — 24 schools",
      "Additional charge",
    ],
    [
      "POS-ZP-EO-P",
      "Education Officer — Primary, ZP",
      "District rural",
      "Chief Executive Officer, ZP",
      "13 blocks, 842 schools",
      "Assigned",
    ],
    [
      "POS-ZP-DEO-1",
      "Deputy Education Officer — Primary",
      "District rural",
      "Education Officer — Primary",
      "Blocks 1–7",
      "Assigned",
    ],
    [
      "POS-BEO-HIN",
      "Block Education Officer — Hingna",
      "Block",
      "Education Officer — Primary",
      "Hingna Block — 63 schools",
      "Assigned",
    ],
    [
      "POS-KP-HIN-04",
      "Cluster Head — Hingna Cluster 04",
      "Cluster",
      "Block Education Officer — Hingna",
      "9 schools",
      "Vacant",
    ],
    [
      "POS-HM-270904",
      "Headmaster — ZP Primary School Hingna",
      "School",
      "Cluster Head — Hingna 04",
      "UDISE 27090407201",
      "Assigned",
    ],
  ];
  const visible = positions.filter((r) =>
    r.join(" ").toLowerCase().includes(q.toLowerCase()),
  );
  const routes: Record<string, string[]> = {
    "Teacher vacancy proposal": [
      "Headmaster verifies vacancy",
      "Cluster Head / Zone Inspector checks school record",
      "Block Education Officer / AEO verifies cadre and roster",
      "Education Officer recommends",
      "CEO ZP / Municipal Commissioner approves within delegated powers",
    ],
    "School infrastructure work": [
      "School Management Committee records need",
      "Headmaster submits estimate request",
      "Cluster Head / Zone Inspector verifies site",
      "BEO / AEO recommends",
      "Education Officer scrutinises",
      "Engineering authority gives technical sanction",
      "CEO ZP / Municipal Commissioner gives administrative approval",
    ],
    "Inspection non-compliance": [
      "Inspecting officer records finding",
      "Headmaster submits compliance",
      "Cluster Head / Zone Inspector verifies",
      "BEO / AEO disposes or escalates",
      "Education Officer issues district direction",
      "Divisional office receives critical escalation",
    ],
    "Teacher leave — long duration": [
      "Teacher submits request",
      "Headmaster verifies service details",
      "BEO / AEO checks substitute arrangement",
      "Education Officer applies delegated leave authority",
      "Higher authority receives cases beyond delegation",
    ],
  };
  return (
    <>
      <PageHead
        kicker="ESTABLISHMENT & CONTROL"
        title="Officer hierarchy, jurisdiction and delegation"
      >
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "detailed-officer-hierarchy.csv",
              [
                "Position ID",
                "Position",
                "Level",
                "Reports to",
                "Jurisdiction",
                "Status",
              ],
              positions,
            )
          }
        >
          <Download size={14} /> Export position register
        </button>
      </PageHead>
      <section className="hierarchy-summary">
        <div>
          <strong>1,412</strong>
          <span>Positions mapped</span>
        </div>
        <div>
          <strong>1,394</strong>
          <span>Active assignments</span>
        </div>
        <div>
          <strong>18</strong>
          <span>Vacant officer posts</span>
        </div>
        <div>
          <strong>17</strong>
          <span>Temporary delegations</span>
        </div>
        <div>
          <strong>100%</strong>
          <span>Schools assigned to a supervisor</span>
        </div>
      </section>
      <div className="hierarchy-tabs">
        {[
          "Structure",
          "Position register",
          "Approval routes",
          "Delegations",
        ].map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "Delegations" && <em>17</em>}
          </button>
        ))}
      </div>
      {tab === "Structure" && (
        <section className="detailed-hierarchy">
          <div className="upper-chain">
            <HierarchyNode
              label="STATE SECRETARIAT"
              title="Principal Secretary — School Education"
              meta="Policy, rules, finance and state oversight"
              onClick={() =>
                card(
                  "POS-MH-PS",
                  "Principal Secretary — School Education",
                  "State Secretariat",
                  "Government of Maharashtra",
                  "Maharashtra",
                  "Assigned",
                  "State administrative authority",
                )
              }
            />
            <HierarchyArrow />
            <HierarchyNode
              label="COMMISSIONERATE"
              title="Commissioner of Education, Maharashtra"
              meta="Statewide executive administration"
              onClick={() =>
                card(
                  "POS-MH-COMM",
                  "Commissioner of Education, Maharashtra",
                  "State",
                  "Principal Secretary",
                  "Maharashtra",
                  "Assigned",
                  "Commissionerate powers",
                )
              }
            />
            <HierarchyArrow />
            <div className="parallel-directors">
              <HierarchyNode
                label="DIRECTORATE"
                title="Director — Primary Education"
                meta="Standards and administration · Primary"
                onClick={() =>
                  card(
                    "POS-MH-DIR-P",
                    "Director — Primary Education",
                    "State Directorate",
                    "Commissioner of Education",
                    "Maharashtra — Primary",
                    "Assigned",
                    "Directorate powers",
                  )
                }
              />
              <HierarchyNode
                label="DIRECTORATE"
                title="Director — Secondary & Higher Secondary"
                meta="Standards and administration · Secondary"
                onClick={() =>
                  card(
                    "POS-MH-DIR-S",
                    "Director — Secondary & Higher Secondary",
                    "State Directorate",
                    "Commissioner of Education",
                    "Maharashtra — Secondary",
                    "Assigned",
                    "Directorate powers",
                  )
                }
              />
            </div>
            <HierarchyArrow />
            <HierarchyNode
              label="DIVISIONAL OFFICE"
              title="Deputy Director of Education — Nagpur Division"
              meta="Nagpur, Wardha, Bhandara, Gondia, Chandrapur, Gadchiroli"
              onClick={() =>
                card(
                  "POS-NGP-DDE",
                  "Deputy Director of Education — Nagpur Division",
                  "Division",
                  "Directorate of Education",
                  "Nagpur Division — 6 districts",
                  "Assigned",
                  "Divisional review and escalation",
                )
              }
            />
          </div>
          <div className="branch-divider">
            <span>LOCAL-AREA OPERATING CHAINS</span>
          </div>
          <div className="authority-chains">
            <AuthorityChain
              title="Nagpur Municipal Corporation"
              subtitle="Urban schools · 10 zones · 218 schools"
              nodes={[
                [
                  "POS-NMC-MC",
                  "Municipal Commissioner",
                  "Civic administrative head",
                  "State Urban Development / Corporation",
                ],
                [
                  "POS-NMC-EO",
                  "Education Officer, NMC",
                  "Head of Education Department",
                  "Municipal Commissioner",
                ],
                [
                  "POS-NMC-AEO",
                  "Assistant Education Officers",
                  "Primary and Secondary branches",
                  "Education Officer",
                ],
                [
                  "POS-NMC-ZI",
                  "Zone School Inspectors",
                  "Zones 1–10 · school supervision",
                  "Assistant Education Officer",
                ],
                [
                  "POS-NMC-HM",
                  "Headmaster / Principal",
                  "School administration",
                  "Zone School Inspector",
                ],
                [
                  "POS-NMC-T",
                  "Teachers & staff",
                  "Classroom and school operations",
                  "Headmaster",
                ],
              ]}
              onOpen={card}
            />
            <AuthorityChain
              title="Nagpur Zilla Parishad"
              subtitle="Rural schools · 13 blocks · 842 schools"
              nodes={[
                [
                  "POS-ZP-CEO",
                  "Chief Executive Officer, ZP",
                  "Rural local-authority head",
                  "Divisional Commissioner / ZP",
                ],
                [
                  "POS-ZP-EO",
                  "Education Officers",
                  "Primary and Secondary branches",
                  "CEO, Zilla Parishad",
                ],
                [
                  "POS-ZP-DEO",
                  "Deputy Education Officers",
                  "District establishment and schemes",
                  "Education Officer",
                ],
                [
                  "POS-ZP-BEO",
                  "Block Education Officers",
                  "13 Panchayat Samiti blocks",
                  "Education Officer",
                ],
                [
                  "POS-ZP-EXT",
                  "Extension Officers — Education",
                  "Block inspections and implementation",
                  "Block Education Officer",
                ],
                [
                  "POS-ZP-KP",
                  "Cluster Heads / Kendra Pramukh",
                  "96 school clusters",
                  "Block Education Officer",
                ],
                [
                  "POS-ZP-HM",
                  "Headmaster",
                  "Individual school administration",
                  "Cluster Head",
                ],
                [
                  "POS-ZP-T",
                  "Teachers & staff",
                  "Classroom and school operations",
                  "Headmaster",
                ],
              ]}
              onOpen={card}
            />
            <AuthorityChain
              title="Municipal Councils / Nagar Panchayats"
              subtitle="Other urban local bodies · 126 schools"
              nodes={[
                [
                  "POS-MC-CO",
                  "Chief Officer",
                  "Local-authority administrative head",
                  "Directorate of Municipal Administration",
                ],
                [
                  "POS-MC-ES",
                  "Education Supervisor / designated officer",
                  "Education establishment and supervision",
                  "Chief Officer",
                ],
                [
                  "POS-MC-HM",
                  "Headmaster / Principal",
                  "School administration",
                  "Education Supervisor",
                ],
                [
                  "POS-MC-T",
                  "Teachers & staff",
                  "Classroom and school operations",
                  "Headmaster",
                ],
              ]}
              onOpen={card}
            />
          </div>
          <div className="legend-line">
            <span>
              <i />
              Administrative reporting
            </span>
            <span>
              <i className="dotted" />
              Coordination / statutory reporting
            </span>
          </div>
        </section>
      )}
      {tab === "Position register" && (
        <>
          <div className="register-tools">
            <label>
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search position, level, jurisdiction or status..."
              />
            </label>
            <select>
              <option>All administrative levels</option>
              <option>State</option>
              <option>Division</option>
              <option>District</option>
              <option>Block</option>
            </select>
          </div>
          <section className="block school-list">
            <div className="result-count">{visible.length} positions</div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Position ID</th>
                    <th>Sanctioned position</th>
                    <th>Level</th>
                    <th>Reports to</th>
                    <th>Jurisdiction</th>
                    <th>Assignment</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r[0]}
                      onClick={() =>
                        card(
                          r[0],
                          r[1],
                          r[2],
                          r[3],
                          r[4],
                          r[5],
                          "Role-based delegation register",
                        )
                      }
                    >
                      <td className="mono">{r[0]}</td>
                      <td>
                        <strong>{r[1]}</strong>
                      </td>
                      <td>{r[2]}</td>
                      <td>{r[3]}</td>
                      <td>{r[4]}</td>
                      <td>
                        <span
                          className={`record ${r[5].toLowerCase().replaceAll(" ", "-")}`}
                        >
                          {r[5]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === "Approval routes" && (
        <section className="routing-module">
          <div className="route-selector">
            <label>Show administrative route for</label>
            <select value={route} onChange={(e) => setRoute(e.target.value)}>
              {Object.keys(routes).map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <p>
              The actual route is resolved from management type, jurisdiction,
              transaction value and delegated powers.
            </p>
          </div>
          <div className="route-steps">
            {routes[route].map((x, i) => (
              <div className="route-step" key={x}>
                <span>{i + 1}</span>
                <div>
                  <small>
                    {i === 0
                      ? "ORIGIN"
                      : i === routes[route].length - 1
                        ? "FINAL AUTHORITY"
                        : "SCRUTINY / RECOMMENDATION"}
                  </small>
                  <strong>{x}</strong>
                </div>
                {i < routes[route].length - 1 && <i>↓</i>}
              </div>
            ))}
          </div>
          <aside className="route-rules">
            <h3>Routing rules applied</h3>
            <ul>
              <li>School management authority</li>
              <li>Officer’s active jurisdiction</li>
              <li>Financial or administrative delegation limit</li>
              <li>Absence delegation and additional charge</li>
              <li>Escalation after prescribed service timeline</li>
            </ul>
          </aside>
        </section>
      )}
      {tab === "Delegations" && (
        <section className="block school-list">
          <div className="result-count">17 delegations</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order reference</th>
                  <th>Delegating position</th>
                  <th>Officer receiving charge</th>
                  <th>Jurisdiction</th>
                  <th>Valid period</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "DEL/NMC/2026/088",
                    "Zone Inspector — Zone 8",
                    "Zone Inspector — Zone 9",
                    "NMC Zone 8",
                    "28 Aug–05 Sep 2026",
                    "Active",
                  ],
                  [
                    "DEL/ZP/2026/143",
                    "BEO — Parseoni",
                    "BEO — Ramtek",
                    "Parseoni Block",
                    "30 Aug–03 Sep 2026",
                    "Active",
                  ],
                  [
                    "DEL/ZP/2026/148",
                    "Cluster Head — Hingna 04",
                    "Senior Headmaster — Cluster 04",
                    "9 schools",
                    "01–07 Sep 2026",
                    "Upcoming",
                  ],
                  [
                    "DEL/EO/2026/052",
                    "Deputy Education Officer — Primary",
                    "Deputy Education Officer — Planning",
                    "Blocks 1–7",
                    "26–31 Aug 2026",
                    "Expiring",
                  ],
                ].map((r) => (
                  <tr
                    key={r[0]}
                    onClick={() =>
                      open({
                        kind: "Delegation order",
                        ref: r[0],
                        title: `Additional charge: ${r[3]}`,
                        fields: [
                          ["Delegating position", r[1]],
                          ["Officer receiving charge", r[2]],
                          ["Jurisdiction", r[3]],
                          ["Validity", r[4]],
                          ["Current status", r[5]],
                          [
                            "Powers included",
                            "Approval and supervision within recorded delegation",
                          ],
                        ],
                        note: "The receiving officer gains only the permissions stated in the order and only for its effective period.",
                        action: "Review delegation",
                      })
                    }
                  >
                    {r.map((v, i) => (
                      <td key={v}>
                        {i === 0 ? (
                          <span className="mono">{v}</span>
                        ) : i === 5 ? (
                          <span className={`record ${v.toLowerCase()}`}>
                            {v}
                          </span>
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function HierarchyNode({
  label,
  title,
  meta,
  onClick,
}: {
  label: string;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button className="hierarchy-node" onClick={onClick}>
      <small>{label}</small>
      <strong>{title}</strong>
      <span>{meta}</span>
    </button>
  );
}
function HierarchyArrow() {
  return (
    <div className="hierarchy-arrow">
      <i />
      <span>↓</span>
    </div>
  );
}
function AuthorityChain({
  title,
  subtitle,
  nodes,
  onOpen,
}: {
  title: string;
  subtitle: string;
  nodes: string[][];
  onOpen: (
    ref: string,
    title: string,
    level: string,
    reports: string,
    jurisdiction: string,
    assignment: string,
    delegation: string,
  ) => void;
}) {
  return (
    <section className="authority-chain">
      <header>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </header>
      <div>
        {nodes.map((n, i) => (
          <div className="chain-entry" key={n[0]}>
            <button
              onClick={() =>
                onOpen(
                  n[0],
                  n[1],
                  title,
                  n[3],
                  n[2],
                  "Assigned",
                  i < 2
                    ? "Administrative and approval powers"
                    : "Supervision within jurisdiction",
                )
              }
            >
              <small>LEVEL {i + 1}</small>
              <strong>{n[1]}</strong>
              <span>{n[2]}</span>
              <em>{n[3]}</em>
            </button>
            {i < nodes.length - 1 && <i>↓</i>}
          </div>
        ))}
      </div>
    </section>
  );
}

function StaffModule({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const rows = filter === "All" ? staff : staff.filter((r) => r[5] === filter);
  return (
    <>
      <PageHead
        kicker="ESTABLISHMENT REGISTER"
        title="Staff position and vacancies"
      >
        <button
          className="outline"
          onClick={() =>
            open({
              kind: "New establishment file",
              ref: "DRAFT",
              title: "Create vacancy-filling proposal",
              fields: [
                ["Cadre", "Not selected"],
                ["Jurisdiction", "Nagpur district"],
                ["Workflow", "Head → BEO / Inspector → Education Officer"],
                ["Status", "Draft"],
              ],
              note: "This demonstration action starts a vacancy proposal and sends it through the configured approval chain.",
              action: "Create draft",
            })
          }
        >
          <Plus size={14} /> New proposal
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Sanctioned teaching posts"
          value="12,798"
          note="Across mapped schools"
        />
        <Stat
          label="Working strength"
          value="12,486"
          note="97.6% of sanctioned"
        />
        <Stat
          label="Vacant positions"
          value="312"
          note="42 vacant beyond 90 days"
          warning
        />
        <Stat
          label="Headmaster vacancies"
          value="18"
          note="11 under acting charge"
          warning
        />
      </section>
      <div className="register-tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          <option>Proposal due</option>
          <option>Under review</option>
          <option>Priority</option>
          <option>Advertised</option>
          <option>Roster check</option>
        </select>
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "staff-vacancies.csv",
              ["Reference", "Post", "School", "Vacancies", "Age", "Status"],
              rows,
            )
          }
        >
          <Download size={14} /> Export visible
        </button>
      </div>
      <RegisterTable
        headers={[
          "Reference",
          "Post / cadre",
          "School / jurisdiction",
          "Vacancies",
          "Position",
          "Status",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Establishment record",
            ref: r[0],
            title: r[1],
            fields: [
              ["School / jurisdiction", r[2]],
              ["Vacancies", r[3]],
              ["Position", r[4]],
              ["Workflow status", r[5]],
              ["Roster verification", "Pending production integration"],
            ],
            note: "The proposal maintains sanctioned strength, roster position, vacancy age and every approval in one auditable file.",
            action: "Forward proposal",
          })
        }
      />
    </>
  );
}

function InspectionModule({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const rows =
    filter === "All" ? inspections : inspections.filter((r) => r[5] === filter);
  return (
    <>
      <PageHead kicker="FIELD MONITORING" title="Inspection register">
        <button
          className="outline"
          onClick={() =>
            open({
              kind: "Inspection plan",
              ref: "DRAFT",
              title: "Schedule a school inspection",
              fields: [
                ["Inspection type", "Comprehensive"],
                ["Jurisdiction", "Assigned officer jurisdiction"],
                ["Proposed date", "Not selected"],
                ["Checklist", "State inspection checklist"],
              ],
              note: "The scheduler checks officer jurisdiction, previous inspections and outstanding compliance items.",
              action: "Save schedule",
            })
          }
        >
          <Plus size={14} /> Schedule inspection
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Planned this month"
          value="486"
          note="Across all authorities"
        />
        <Stat label="Reports submitted" value="344" note="70.8% completion" />
        <Stat
          label="Overdue visits"
          value="23"
          note="Automatic escalation active"
          warning
        />
        <Stat
          label="Compliance actions open"
          value="67"
          note="14 safety-related"
          warning
        />
      </section>
      <div className="filter-tabs">
        {["All", "Scheduled", "Submitted", "Overdue", "Correction due"].map(
          (x) => (
            <button
              className={filter === x ? "active" : ""}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ),
        )}
        <button
          className="tab-export"
          onClick={() =>
            exportCsv(
              "inspection-register.csv",
              [
                "Reference",
                "School",
                "Jurisdiction",
                "Type",
                "Due date",
                "Status",
                "Officer",
              ],
              rows,
            )
          }
        >
          <Download size={13} /> Export
        </button>
      </div>
      <RegisterTable
        headers={[
          "Inspection no.",
          "School",
          "Jurisdiction",
          "Type",
          "Due date",
          "Status",
          "Assigned officer",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Inspection file",
            ref: r[0],
            title: r[1],
            fields: [
              ["Jurisdiction", r[2]],
              ["Inspection type", r[3]],
              ["Due / visit date", r[4]],
              ["Current status", r[5]],
              ["Assigned officer", r[6]],
              [
                "Checklist progress",
                r[5] === "Submitted" ? "34 / 34 items" : "Not yet complete",
              ],
            ],
            note: "Inspection findings, geo-time evidence, photographs and compliance directions will form part of this record.",
            action:
              r[5] === "Submitted" ? "Verify report" : "Record inspection",
          })
        }
      />
    </>
  );
}

function WorksModule({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const rows = filter === "All" ? works : works.filter((r) => r[4] === filter);
  return (
    <>
      <PageHead
        kicker="FINANCE & INFRASTRUCTURE"
        title="Grants, civil works and assets"
      >
        <button
          className="outline"
          onClick={() =>
            open({
              kind: "Works proposal",
              ref: "DRAFT",
              title: "Register a new school work",
              fields: [
                ["Work category", "Not selected"],
                ["Funding source", "District / State scheme"],
                ["Estimate", "To be entered"],
                ["Technical authority", "Assigned by amount and work type"],
              ],
              note: "The workflow separates administrative approval, technical sanction, fund release, measurement and completion.",
              action: "Create work file",
            })
          }
        >
          <Plus size={14} /> New work
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Works in progress"
          value="184"
          note="₹96.4 crore sanctioned"
        />
        <Stat
          label="Awaiting sanction"
          value="43"
          note="₹18.7 crore proposed"
          warning
        />
        <Stat
          label="Funds utilised"
          value="69.4%"
          note="Current financial year"
        />
        <Stat
          label="Assets physically verified"
          value="98.2%"
          note="46,218 tagged assets"
        />
      </section>
      <div className="register-tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          {[...new Set(works.map((r) => r[4]))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "grants-and-works.csv",
              ["Reference", "Work", "School", "Amount", "Stage", "Pending at"],
              rows,
            )
          }
        >
          <Download size={14} /> Export visible
        </button>
      </div>
      <RegisterTable
        headers={[
          "Reference",
          "Work / grant",
          "School / coverage",
          "Amount",
          "Current stage",
          "Pending at",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Works & grant file",
            ref: r[0],
            title: r[1],
            fields: [
              ["School / coverage", r[2]],
              ["Approved / proposed amount", r[3]],
              ["Current stage", r[4]],
              ["Pending at", r[5]],
              ["Expenditure booked", "View bill register in production"],
            ],
            note: "The complete file links estimate, sanction, fund release, work order, measurements, bills, photographs and asset creation.",
            action:
              r[4] === "Estimate returned"
                ? "Resubmit estimate"
                : "Forward file",
          })
        }
      />
    </>
  );
}

function ExecutiveReview({
  open,
  notify,
}: {
  open: (d: Detail) => void;
  notify: (x: string) => void;
}) {
  const [filter, setFilter] = useState("All");
  const agenda = [
    [
      "REV/2026/09/01",
      "Critical teacher vacancies",
      "Education Officer — ZP",
      "12 decisions",
      "Decision due",
    ],
    [
      "REV/2026/09/02",
      "Schools below 80% attendance",
      "BEOs: Parseoni, Kuhi, Hingna",
      "23 schools",
      "Action plan due",
    ],
    [
      "REV/2026/09/03",
      "Overdue safety compliance",
      "NMC EO / ZP EO",
      "14 schools",
      "Escalated",
    ],
    [
      "REV/2026/09/04",
      "PM POSHAN reconciliation",
      "Deputy EO — Schemes",
      "3 blocks",
      "Review",
    ],
    [
      "REV/2026/09/05",
      "Civil works beyond timeline",
      "Executive Engineer / Education Officer",
      "9 works",
      "Decision due",
    ],
  ];
  const rows =
    filter === "All" ? agenda : agenda.filter((r) => r[4] === filter);
  return (
    <>
      <PageHead
        kicker="COMMISSIONER'S REVIEW"
        title="Weekly education review and decision register"
      >
        <button
          className="outline"
          onClick={() =>
            notify(
              "Meeting mode started. Decisions will be grouped in the demonstration minutes.",
            )
          }
        >
          <CalendarDays size={14} /> Start meeting mode
        </button>
      </PageHead>
      <section className="review-strip">
        <div>
          <small>NEXT REVIEW</small>
          <strong>Wednesday, 02 Sep 2026 · 11:00 AM</strong>
          <span>Commissioner’s Conference Hall</span>
        </div>
        <div>
          <b>5</b>
          <span>agenda subjects</span>
        </div>
        <div>
          <b>28</b>
          <span>open decisions</span>
        </div>
        <div>
          <b>7</b>
          <span>overdue actions</span>
        </div>
        <button
          onClick={() =>
            exportCsv(
              "commissioner-review-agenda.csv",
              [
                "Reference",
                "Subject",
                "Responsible officer",
                "Coverage",
                "Status",
              ],
              agenda,
            )
          }
        >
          <Download size={14} /> Briefing pack
        </button>
      </section>
      <div className="register-tools">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option>All</option>
          <option>Decision due</option>
          <option>Action plan due</option>
          <option>Escalated</option>
          <option>Review</option>
        </select>
      </div>
      <RegisterTable
        headers={[
          "Agenda ref.",
          "Subject",
          "Responsible officer",
          "Coverage",
          "Status",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Review agenda",
            ref: r[0],
            title: r[1],
            fields: [
              ["Responsible officer", r[2]],
              ["Coverage", r[3]],
              ["Agenda status", r[4]],
              ["Previous direction", "Submitted in demonstration record"],
              ["Supporting reports", "3 linked documents"],
            ],
            note: "During meeting mode, the commissioner can dictate the decision, assign an officer and set a compliance date.",
            action: "Record decision",
          })
        }
      />
      <section className="block decision-followup">
        <div className="block-head">
          <div>
            <h2>Previous meeting follow-up</h2>
            <span>Decisions from 26 August 2026</span>
          </div>
        </div>
        {[
          ["Attendance recovery plan — Kuhi", "BEO Kuhi", "Complied", "29 Aug"],
          ["Fire audit — NMC Zone 8", "Zone Inspector 8", "Overdue", "28 Aug"],
          [
            "Headmaster charge arrangement",
            "Education Officer — ZP",
            "Complied",
            "30 Aug",
          ],
        ].map((r) => (
          <div className="followup" key={r[0]}>
            <strong>{r[0]}</strong>
            <span>{r[1]}</span>
            <b className={r[2] === "Overdue" ? "bad" : ""}>{r[2]}</b>
            <small>{r[3]}</small>
          </div>
        ))}
      </section>
    </>
  );
}

function RiskMap({ open }: { open: (d: Detail) => void }) {
  const [layer, setLayer] = useState("Composite risk");
  const [selected, setSelected] = useState("Parseoni");
  const regions = [
    ["Parseoni", "High", "23", "78.6%", "18"],
    ["Kuhi", "High", "17", "81.2%", "11"],
    ["Hingna", "Medium", "12", "89.1%", "7"],
    ["NMC Zone 8", "Medium", "24", "94.8%", "9"],
    ["Ramtek", "Low", "15", "92.7%", "4"],
  ];
  const current = regions.find((r) => r[0] === selected)!;
  return (
    <>
      <PageHead
        kicker="SPATIAL DECISION SUPPORT"
        title="District school risk map"
      >
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "district-risk-map.csv",
              ["Area", "Risk", "Schools flagged", "Attendance", "Open actions"],
              regions,
            )
          }
        >
          <Download size={14} /> Export risk list
        </button>
      </PageHead>
      <div className="map-layers">
        {[
          "Composite risk",
          "Attendance",
          "Teacher vacancies",
          "Safety",
          "Infrastructure",
          "Inspection overdue",
        ].map((x) => (
          <button
            className={layer === x ? "active" : ""}
            key={x}
            onClick={() => setLayer(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <section className="map-layout">
        <div className="map-frame">
          <iframe
            title="OpenStreetMap of Nagpur district"
            src="https://www.openstreetmap.org/export/embed.html?bbox=78.6%2C20.5%2C79.7%2C21.6&layer=mapnik"
          />
          <div className="map-caption">
            <b>Base map: OpenStreetMap</b>
            <span>Selected risk layer: {layer}</span>
          </div>
        </div>
        <aside className="risk-list">
          <header>
            <strong>Area risk ranking</strong>
          </header>
          {regions.map((r) => (
            <button
              key={r[0]}
              className={selected === r[0] ? "active" : ""}
              onClick={() => setSelected(r[0])}
            >
              <i className={r[1].toLowerCase()} />
              <span>
                <strong>{r[0]}</strong>
                <small>{r[2]} schools flagged</small>
              </span>
              <b>{r[1]}</b>
            </button>
          ))}
        </aside>
        <aside className="area-sheet">
          <span>SELECTED AREA</span>
          <h2>{current[0]}</h2>
          <dl>
            <div>
              <dt>Composite risk</dt>
              <dd className="red-text">{current[1]}</dd>
            </div>
            <div>
              <dt>Schools flagged</dt>
              <dd>{current[2]}</dd>
            </div>
            <div>
              <dt>Average attendance</dt>
              <dd>{current[3]}</dd>
            </div>
            <div>
              <dt>Open actions</dt>
              <dd>{current[4]}</dd>
            </div>
          </dl>
          <button
            onClick={() =>
              open({
                kind: "Area risk file",
                ref: `AREA-${current[0].toUpperCase()}`,
                title: `${current[0]} — ${layer}`,
                fields: [
                  ["Composite risk", current[1]],
                  ["Schools flagged", current[2]],
                  ["Average attendance", current[3]],
                  ["Open actions", current[4]],
                  [
                    "Supervising authority",
                    current[0].startsWith("NMC")
                      ? "NMC Education Officer"
                      : "ZP Education Officer",
                  ],
                ],
                note: "Production risk scores will retain the contributing indicators, source dates and thresholds.",
                action: "Issue area direction",
              })
            }
          >
            Open area action sheet
          </button>
        </aside>
      </section>
    </>
  );
}

function EarlyWarning({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const cases = [
    [
      "EW/2026/1442",
      "Student A-1042",
      "Class VIII · ZP School, Parseoni",
      "Attendance",
      "62% · 21 days absent",
      "High",
    ],
    [
      "EW/2026/1398",
      "Student A-0881",
      "Class X · NMC School, Zone 8",
      "Learning decline",
      "−18% across two assessments",
      "High",
    ],
    [
      "EW/2026/1371",
      "Student A-0734",
      "Class IX · ZP School, Hingna",
      "Transition risk",
      "Not enrolled after transfer",
      "Immediate",
    ],
    [
      "EW/2026/1355",
      "Student A-0642",
      "Class VI · Municipal School, Kamptee",
      "Entitlement gap",
      "Scholarship document pending",
      "Medium",
    ],
    [
      "EW/2026/1312",
      "Student A-0521",
      "Class VII · ZP School, Kuhi",
      "Attendance",
      "73% · seasonal migration",
      "Medium",
    ],
  ];
  const rows = filter === "All" ? cases : cases.filter((r) => r[3] === filter);
  return (
    <>
      <PageHead
        kicker="STUDENT RETENTION"
        title="Student early-warning and intervention cases"
      >
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "early-warning-cases.csv",
              [
                "Case",
                "Masked student",
                "School",
                "Trigger",
                "Evidence",
                "Risk",
              ],
              cases,
            )
          }
        >
          <Download size={14} /> Export authorised list
        </button>
      </PageHead>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        <div>
          <strong>Protected student information</strong>
          <span>Names masked · Jurisdiction-restricted</span>
        </div>
      </div>
      <section className="stats">
        <Stat
          label="Active intervention cases"
          value="1,864"
          note="Across 327 schools"
        />
        <Stat
          label="Persistent absence"
          value="1,102"
          note="59.1% of active cases"
          warning
        />
        <Stat
          label="Transition risk"
          value="286"
          note="Class VIII–IX and X–XI"
          warning
        />
        <Stat
          label="Cases closed this month"
          value="642"
          note="Closure verified by supervisor"
        />
      </section>
      <div className="filter-tabs">
        {[
          "All",
          "Attendance",
          "Learning decline",
          "Transition risk",
          "Entitlement gap",
        ].map((x) => (
          <button
            className={filter === x ? "active" : ""}
            key={x}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <RegisterTable
        headers={[
          "Case ID",
          "Student reference",
          "Class / school",
          "Trigger",
          "Evidence",
          "Risk",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Student intervention case",
            ref: r[0],
            title: r[1],
            fields: [
              ["School and class", r[2]],
              ["Early-warning trigger", r[3]],
              ["Evidence", r[4]],
              ["Risk level", r[5]],
              [
                "Assigned intervention officer",
                "Cluster Head / Zone Inspector",
              ],
              ["Consent and access log", "Recorded"],
            ],
            note: "The intervention plan records home contact, counselling, entitlement support, responsible officer and verified outcome.",
            action: "Assign intervention",
          })
        }
      />
    </>
  );
}

function Grievances({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const cases = [
    [
      "GRV/2026/2418",
      "Parent",
      "Denial of textbook entitlement",
      "NMC Zone 4",
      "2 days left",
      "Under inquiry",
    ],
    [
      "GRV/2026/2399",
      "Teacher",
      "Service-book correction pending",
      "ZP / Saoner",
      "Overdue 3 days",
      "Escalated",
    ],
    [
      "GRV/2026/2384",
      "SMC",
      "Unsafe electrical wiring",
      "ZP / Parseoni",
      "Due today",
      "Immediate",
    ],
    [
      "GRV/2026/2361",
      "Citizen",
      "School boundary encroachment",
      "Municipal Council, Katol",
      "6 days left",
      "Assigned",
    ],
    [
      "GRV/2026/2318",
      "Headmaster",
      "Grant credit not reflected",
      "ZP / Ramtek",
      "4 days left",
      "Awaiting finance",
    ],
  ];
  const rows = filter === "All" ? cases : cases.filter((r) => r[5] === filter);
  return (
    <>
      <PageHead
        kicker="PUBLIC ACCOUNTABILITY"
        title="Grievance, SLA and escalation register"
      >
        <button
          className="outline"
          onClick={() =>
            open({
              kind: "New grievance",
              ref: "DRAFT",
              title: "Register grievance",
              fields: [
                ["Complainant type", "Parent / Teacher / Citizen / SMC"],
                ["Channel", "Office / helpline / portal"],
                ["Jurisdiction", "Resolved automatically from school"],
                ["SLA", "Applied from grievance category"],
              ],
              note: "Sensitive complainant information is protected and visible only to authorised grievance officers.",
              action: "Register grievance",
            })
          }
        >
          <Plus size={14} /> Register grievance
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Open grievances"
          value="184"
          note="All channels consolidated"
        />
        <Stat label="Within SLA" value="151" note="82.1% of open cases" />
        <Stat
          label="Overdue"
          value="22"
          note="11 escalated to district"
          warning
        />
        <Stat
          label="Closure satisfaction"
          value="87.4%"
          note="Verified complainant feedback"
        />
      </section>
      <div className="filter-tabs">
        {[
          "All",
          "Under inquiry",
          "Escalated",
          "Immediate",
          "Assigned",
          "Awaiting finance",
        ].map((x) => (
          <button
            className={filter === x ? "active" : ""}
            key={x}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <RegisterTable
        headers={[
          "Grievance no.",
          "Complainant",
          "Subject",
          "Jurisdiction",
          "SLA position",
          "Status",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Grievance file",
            ref: r[0],
            title: r[2],
            fields: [
              ["Complainant category", r[1]],
              ["Jurisdiction", r[3]],
              ["SLA position", r[4]],
              ["Current status", r[5]],
              ["Assigned officer", "Jurisdiction grievance officer"],
              ["Evidence received", "2 attachments"],
            ],
            note: "Closure requires an action-taken report and, for selected categories, confirmation from the complainant or supervisory officer.",
            action: "Record action taken",
          })
        }
      />
    </>
  );
}

function Schemes({ open }: { open: (d: Detail) => void }) {
  const [scheme, setScheme] = useState("All");
  const data = [
    [
      "SCH/PM-POSHAN",
      "PM POSHAN",
      "1,102 schools",
      "98.6% reporting",
      "3 blocks pending",
      "Review",
    ],
    [
      "SCH/UNIFORM",
      "Free uniform distribution",
      "1,86,420 students",
      "94.2% delivered",
      "10,802 pending",
      "Action due",
    ],
    [
      "SCH/TEXTBOOK",
      "Free textbooks",
      "2,41,180 students",
      "98.9% delivered",
      "2,642 pending",
      "On track",
    ],
    [
      "SCH/SCHOLAR",
      "Pre-matric scholarships",
      "62,480 eligible",
      "88.4% verified",
      "7,248 pending",
      "Review",
    ],
    [
      "SCH/INCLUSIVE",
      "Inclusive education support",
      "4,218 students",
      "91.7% plan coverage",
      "350 pending",
      "Action due",
    ],
  ];
  const rows = scheme === "All" ? data : data.filter((r) => r[1] === scheme);
  return (
    <>
      <PageHead
        kicker="SCHEME DELIVERY"
        title="Schemes, entitlements and beneficiary coverage"
      >
        <button
          className="outline"
          onClick={() =>
            exportCsv(
              "scheme-monitoring.csv",
              [
                "Scheme ID",
                "Scheme",
                "Coverage",
                "Progress",
                "Pending",
                "Status",
              ],
              data,
            )
          }
        >
          <Download size={14} /> Export scheme position
        </button>
      </PageHead>
      <section className="scheme-strip">
        {data.slice(0, 4).map((r, i) => (
          <button key={r[0]} onClick={() => setScheme(r[1])}>
            <small>{r[1]}</small>
            <strong>{r[3]}</strong>
            <progress value={[98.6, 94.2, 98.9, 88.4][i]} max="100" />
            <span>{r[4]}</span>
          </button>
        ))}
      </section>
      <div className="register-tools">
        <select value={scheme} onChange={(e) => setScheme(e.target.value)}>
          <option>All</option>
          {data.map((r) => (
            <option key={r[0]}>{r[1]}</option>
          ))}
        </select>
      </div>
      <RegisterTable
        headers={[
          "Scheme ID",
          "Scheme / entitlement",
          "Coverage",
          "Progress",
          "Pending",
          "Status",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Scheme monitoring file",
            ref: r[0],
            title: r[1],
            fields: [
              ["Coverage", r[2]],
              ["Current progress", r[3]],
              ["Pending beneficiaries / returns", r[4]],
              ["Current status", r[5]],
              ["Nodal officer", "Deputy Education Officer — Schemes"],
              ["Last data receipt", "31 Aug 2026 · 09:30"],
            ],
            note: "Production monitoring will reconcile sanction, receipt, school distribution and beneficiary acknowledgement.",
            action: "Issue scheme direction",
          })
        }
      />
    </>
  );
}

function Infrastructure({ open }: { open: (d: Detail) => void }) {
  const [filter, setFilter] = useState("All");
  const data = [
    [
      "SAFE/2026/318",
      "Z.P. School, Parseoni",
      "Electrical safety",
      "Critical",
      "Temporary isolation completed",
      "48 hours",
    ],
    [
      "SAFE/2026/302",
      "NMC High School, Zone 8",
      "Structural condition",
      "High",
      "Engineer inspection due",
      "3 days",
    ],
    [
      "SAFE/2026/289",
      "Z.P. School, Kuhi",
      "Drinking water",
      "High",
      "Alternate supply active",
      "Due today",
    ],
    [
      "SAFE/2026/271",
      "Municipal School, Kamptee",
      "Fire compliance",
      "Medium",
      "Equipment procurement",
      "7 days",
    ],
    [
      "SAFE/2026/255",
      "Z.P. School, Ramtek",
      "Girls toilet",
      "Medium",
      "Estimate submitted",
      "10 days",
    ],
  ];
  const rows = filter === "All" ? data : data.filter((r) => r[3] === filter);
  return (
    <>
      <PageHead
        kicker="SCHOOL SAFETY"
        title="Infrastructure condition and safety compliance"
      >
        <button
          className="outline"
          onClick={() =>
            open({
              kind: "Safety inspection",
              ref: "DRAFT",
              title: "Report critical infrastructure condition",
              fields: [
                ["School", "Resolve from UDISE"],
                ["Risk category", "Electrical / Structural / Water / Fire"],
                ["Immediate safeguard", "Required for critical risk"],
                ["Escalation", "Engineering and education authorities"],
              ],
              note: "Critical risks trigger an immediate safeguarding checklist before the repair workflow begins.",
              action: "Register safety alert",
            })
          }
        >
          <Plus size={14} /> Report critical risk
        </button>
      </PageHead>
      <section className="stats">
        <Stat
          label="Schools fully compliant"
          value="1,071"
          note="85.9% of district register"
        />
        <Stat
          label="Critical safety alerts"
          value="14"
          note="Immediate safeguards tracked"
          warning
        />
        <Stat
          label="Repairs in progress"
          value="184"
          note="Linked to works register"
        />
        <Stat
          label="Certificates expiring"
          value="37"
          note="Within next 30 days"
          warning
        />
      </section>
      <div className="safety-matrix">
        <div>
          <span>Drinking water</span>
          <strong>97.8%</strong>
          <progress value="97.8" max="100" />
        </div>
        <div>
          <span>Functional toilets</span>
          <strong>94.1%</strong>
          <progress value="94.1" max="100" />
        </div>
        <div>
          <span>Fire compliance</span>
          <strong>88.6%</strong>
          <progress value="88.6" max="100" />
        </div>
        <div>
          <span>Electrical safety</span>
          <strong>91.2%</strong>
          <progress value="91.2" max="100" />
        </div>
      </div>
      <div className="filter-tabs">
        {["All", "Critical", "High", "Medium"].map((x) => (
          <button
            className={filter === x ? "active" : ""}
            key={x}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <RegisterTable
        headers={[
          "Alert ID",
          "School",
          "Risk category",
          "Severity",
          "Current safeguard / action",
          "Compliance due",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Infrastructure safety file",
            ref: r[0],
            title: r[1],
            fields: [
              ["Risk category", r[2]],
              ["Severity", r[3]],
              ["Current safeguard / action", r[4]],
              ["Compliance timeline", r[5]],
              ["Inspecting authority", "Assigned by jurisdiction"],
              ["Linked works file", "Created after technical assessment"],
            ],
            note: "The safety file keeps the immediate safeguard separate from the permanent engineering solution.",
            action: "Update compliance",
          })
        }
      />
    </>
  );
}

function DataGovernance({
  open,
  notify,
}: {
  open: (d: Detail) => void;
  notify: (x: string) => void;
}) {
  const [source, setSource] = useState("All");
  const sources = [
    [
      "SRC/UDISE",
      "UDISE+ school master",
      "School identity & enrolment",
      "30 Aug · 23:10",
      "Healthy",
      "1,247 / 1,247",
    ],
    [
      "SRC/NMC",
      "NMC Education MIS",
      "Urban schools & staff",
      "31 Aug · 08:45",
      "Healthy",
      "218 / 218",
    ],
    [
      "SRC/ZP",
      "ZP monthly returns",
      "Rural operations",
      "31 Aug · 09:30",
      "Partial",
      "12 / 13 blocks",
    ],
    [
      "SRC/SARAL",
      "State student system",
      "Student records",
      "31 Aug · 02:15",
      "Healthy",
      "2,84,190 records",
    ],
    [
      "SRC/TREASURY",
      "Treasury / grant feed",
      "Sanctions & expenditure",
      "30 Aug · 18:00",
      "Delayed",
      "Last feed 15h ago",
    ],
  ];
  const rows =
    source === "All" ? sources : sources.filter((r) => r[4] === source);
  return (
    <>
      <PageHead
        kicker="TRUST & CONTROL"
        title="Data governance, integrations and audit"
      >
        <button
          className="outline"
          onClick={() =>
            notify(
              "Cross-system validation completed for demonstration data. 14 exceptions require review.",
            )
          }
        >
          <RefreshCw size={14} /> Run validation
        </button>
      </PageHead>
      <section className="governance-banner">
        <ShieldCheck size={24} />
        <div>
          <strong>Data lineage</strong>
        </div>
        <b>14 validation exceptions</b>
      </section>
      <section className="stats">
        <Stat
          label="Connected data sources"
          value="9"
          note="5 active feeds"
        />
        <Stat
          label="Records validated today"
          value="3,42,881"
          note="99.3% passed automated checks"
        />
        <Stat
          label="Open data exceptions"
          value="14"
          note="Assigned to 6 data owners"
          warning
        />
        <Stat
          label="Unauthorised changes"
          value="0"
          note="Audit controls operational"
        />
      </section>
      <div className="filter-tabs">
        {["All", "Healthy", "Partial", "Delayed"].map((x) => (
          <button
            className={source === x ? "active" : ""}
            key={x}
            onClick={() => setSource(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <RegisterTable
        headers={[
          "Source ID",
          "System / register",
          "Data domain",
          "Last receipt",
          "Status",
          "Coverage",
        ]}
        rows={rows}
        open={(r) =>
          open({
            kind: "Data-source control record",
            ref: r[0],
            title: r[1],
            fields: [
              ["Data domain", r[2]],
              ["Last successful receipt", r[3]],
              ["Source status", r[4]],
              ["Coverage", r[5]],
              ["Data owner", "Designated department nodal officer"],
              [
                "Validation rules",
                "Schema, identity, range and reconciliation checks",
              ],
            ],
            note: "Source values are retained unchanged; corrections are recorded as governed transformations with full lineage.",
            action: "Open exception log",
          })
        }
      />
      <section className="block audit-log">
        <div className="block-head">
          <div>
            <h2>Recent privileged activity</h2>
          </div>
        </div>
        {[
          [
            "12:06:14",
            "District Administrator",
            "Approved establishment file",
            "EO/EST/2026/0418",
          ],
          [
            "11:42:03",
            "Education Officer — ZP",
            "Updated officer assignment",
            "POS-BEO-HIN",
          ],
          [
            "10:18:51",
            "System validation service",
            "Raised reconciliation exception",
            "SRC/ZP-2026-0831",
          ],
          [
            "09:54:22",
            "Zone Inspector 8",
            "Submitted inspection evidence",
            "INS/2026/0818",
          ],
        ].map((r) => (
          <div className="audit-row" key={r.join("")}>
            <span>{r[0]}</span>
            <strong>{r[1]}</strong>
            <b>{r[2]}</b>
            <code>{r[3]}</code>
          </div>
        ))}
      </section>
    </>
  );
}

function RegisterTable({
  headers,
  rows,
  open,
}: {
  headers: string[];
  rows: string[][];
  open: (r: string[]) => void;
}) {
  return (
    <section className="block school-list">
      <div className="result-count">{rows.length} records</div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} onClick={() => open(r)}>
                {r.map((v, i) => (
                  <td key={i}>
                    {i === 0 ? (
                      <span className="mono">{v}</span>
                    ) : i === 1 ? (
                      <strong>{v}</strong>
                    ) : i === headers.length - 2 ? (
                      <span
                        className={`record ${v.toLowerCase().replaceAll(" ", "-")}`}
                      >
                        {v}
                      </span>
                    ) : (
                      v
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty">No records</div>}
    </section>
  );
}

function DetailDrawer({
  detail,
  close,
  action,
}: {
  detail: Detail;
  close: () => void;
  action: () => void;
}) {
  return (
    <div className="overlay" onClick={close}>
      <section className="file-sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <span>{detail.kind}</span>
            <strong>{detail.ref}</strong>
          </div>
          <button onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="file-body">
          <h2>{detail.title}</h2>
          <dl>
            {detail.fields.map(([a, b]) => (
              <div key={a}>
                <dt>{a}</dt>
                <dd>{b}</dd>
              </div>
            ))}
          </dl>
          <label>
            Remarks
            <textarea placeholder="Remarks" />
          </label>
        </div>
        <footer>
          <button onClick={close}>Close</button>
          <button onClick={action}>
            <Send size={14} />
            {detail.action || "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}
