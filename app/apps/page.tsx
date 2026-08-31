"use client";

import {
  Bell,
  Check,
  ChevronDown,
  ClipboardCheck,
  Database,
  GraduationCap,
  Landmark,
  LogOut,
  Menu,
  Network,
  School,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDemoAuth } from "@/components/demo-auth";
import { WhatsAppShare } from "@/components/whatsapp-share";

type AppDef = {
  id: string;
  name: string;
  short: string;
  audience: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  roles: string[];
  nav: string[];
  metrics: [string, string, string][];
  tasks: [string, string, string, string][];
  actions: string[];
};

const apps: AppDef[] = [
  {
    id: "executive",
    name: "Executive Command",
    short: "For senior administration",
    audience: "Commissioner · CEO ZP · Education Officer",
    description:
      "District decisions, reviews, escalations and consolidated performance.",
    icon: Landmark,
    roles: [
      "Municipal Commissioner",
      "Chief Executive Officer, ZP",
      "Education Officer — Primary",
      "Education Officer — Secondary",
    ],
    nav: [
      "Today",
      "Review meetings",
      "Approvals",
      "District exceptions",
      "Reports",
    ],
    metrics: [
      ["Files requiring decision", "18", "6 due today"],
      ["Schools under intervention", "47", "Across 8 jurisdictions"],
      ["Overdue directions", "7", "Escalated automatically"],
      ["Review readiness", "92%", "5 agenda items"],
    ],
    tasks: [
      [
        "EXE/0418",
        "Approve graduate teacher vacancy",
        "ZP Education Office",
        "Due today",
      ],
      ["EXE/1192", "Review structural repair sanction", "NMC Zone 8", "2 days"],
      [
        "EXE/0261",
        "PM POSHAN reconciliation direction",
        "Kamptee Block",
        "Overdue",
      ],
      ["EXE/0834", "Attendance recovery plan", "Hingna Block", "3 days"],
    ],
    actions: [
      "Start review meeting",
      "Issue district direction",
      "Approve file",
      "Download briefing",
    ],
  },
  {
    id: "field",
    name: "Field Officer",
    short: "For supervisory officers",
    audience: "BEO · AEO · Zone Inspector · Cluster Head",
    description:
      "Mobile-first visits, inspections, school exceptions and compliance follow-up.",
    icon: ClipboardCheck,
    roles: [
      "Block Education Officer — Hingna",
      "Assistant Education Officer — Primary",
      "Zone School Inspector — Zone 8",
      "Cluster Head — Hingna 04",
    ],
    nav: [
      "My field plan",
      "Schools",
      "Inspections",
      "Compliance",
      "Offline drafts",
    ],
    metrics: [
      ["Visits this week", "12", "8 completed"],
      ["Compliance actions", "23", "7 due today"],
      ["Schools assigned", "63", "Hingna Block"],
      ["Offline drafts", "3", "Awaiting upload"],
    ],
    tasks: [
      [
        "FLD/0841",
        "Comprehensive school inspection",
        "ZP School, Wanadongri",
        "04 Sep",
      ],
      [
        "FLD/0712",
        "Verify attendance intervention",
        "ZP School, Hingna",
        "Today",
      ],
      [
        "FLD/0688",
        "Electrical safety compliance",
        "ZP School, Parseoni",
        "Overdue",
      ],
      [
        "FLD/0621",
        "Monthly cluster return verification",
        "9 schools",
        "2 days",
      ],
    ],
    actions: [
      "Start inspection",
      "Record school visit",
      "Capture compliance",
      "Sync offline work",
    ],
  },
  {
    id: "school",
    name: "School Office",
    short: "For school administration",
    audience: "Headmaster · Principal · Clerk",
    description:
      "Daily school operations, staff, students, grants, assets and statutory returns.",
    icon: School,
    roles: [
      "Headmaster",
      "Principal — Secondary",
      "Senior Clerk",
      "School Data Entry Operator",
    ],
    nav: ["School today", "Students", "Staff", "Finance", "Assets", "Returns"],
    metrics: [
      ["Students present", "341 / 361", "94.5% today"],
      ["Staff present", "14 / 15", "1 on leave"],
      ["Pending returns", "2", "Due this week"],
      ["Available grant", "₹2.84 lakh", "3 grant heads"],
    ],
    tasks: [
      [
        "SCH/ATT/0831",
        "Verify today’s student attendance",
        "Classes I–VIII",
        "Before 11:30",
      ],
      ["SCH/RET/0829", "Submit monthly school return", "August 2026", "2 days"],
      ["SCH/AST/0441", "Verify ICT laboratory assets", "18 items", "5 days"],
      [
        "SCH/SMC/0902",
        "Prepare SMC meeting agenda",
        "September meeting",
        "3 days",
      ],
    ],
    actions: [
      "Mark attendance",
      "Submit return",
      "Request staff leave",
      "Record expenditure",
    ],
  },
  {
    id: "teacher",
    name: "Teacher Workspace",
    short: "For classroom work",
    audience: "Teacher · Class teacher · Special educator",
    description:
      "Attendance, assessment, lesson work, student support and personal service requests.",
    icon: GraduationCap,
    roles: [
      "Class Teacher — VIII A",
      "Subject Teacher — Mathematics",
      "Special Educator",
      "Graduate Teacher",
    ],
    nav: [
      "My day",
      "My classes",
      "Attendance",
      "Assessment",
      "Student support",
      "My service",
    ],
    metrics: [
      ["Classes today", "5", "Next: VIII A at 11:10"],
      ["Students assigned", "86", "2 classes"],
      ["Intervention cases", "4", "1 follow-up today"],
      ["Assessment pending", "18", "Mathematics worksheet"],
    ],
    tasks: [
      ["TCH/CLS/1110", "Take Class VIII A attendance", "36 students", "11:10"],
      [
        "TCH/EW/1042",
        "Home-contact follow-up",
        "Masked student A-1042",
        "Today",
      ],
      ["TCH/ASM/0828", "Enter mathematics assessment", "18 pending", "2 days"],
      [
        "TCH/LP/0901",
        "Submit weekly lesson plan",
        "Classes VIII–IX",
        "Tomorrow",
      ],
    ],
    actions: [
      "Take attendance",
      "Enter assessment",
      "Add intervention note",
      "Apply for leave",
    ],
  },
  {
    id: "community",
    name: "Family & SMC",
    short: "For community participation",
    audience: "Parent · Student · SMC member",
    description:
      "Attendance, entitlements, school notices, grievances and SMC participation.",
    icon: Users,
    roles: ["Parent / Guardian", "Student", "SMC Chairperson", "SMC Member"],
    nav: [
      "Home",
      "My child",
      "Entitlements",
      "School notices",
      "SMC",
      "Help & grievance",
    ],
    metrics: [
      ["Attendance this month", "92%", "2 days absent"],
      ["Entitlements", "4 / 5", "Scholarship verification due"],
      ["School notices", "3", "1 new today"],
      ["Open requests", "1", "Within SLA"],
    ],
    tasks: [
      [
        "PAR/ENT/0442",
        "Upload scholarship income document",
        "Pre-matric scholarship",
        "5 days",
      ],
      [
        "PAR/SMC/0904",
        "Review SMC meeting agenda",
        "September meeting",
        "4 days",
      ],
      ["PAR/NOTICE/0831", "Read examination timetable", "Term I", "New"],
      [
        "PAR/GRV/2418",
        "Confirm grievance resolution",
        "Textbook entitlement",
        "2 days",
      ],
    ],
    actions: [
      "Report absence",
      "View entitlements",
      "Raise grievance",
      "Join SMC meeting",
    ],
  },
  {
    id: "mis",
    name: "MIS & Administration",
    short: "For system operations",
    audience: "MIS officer · Data owner · System administrator",
    description:
      "Data integrations, quality exceptions, user access, audit and configuration.",
    icon: Database,
    roles: [
      "District MIS Officer",
      "NMC Data Nodal Officer",
      "ZP Data Nodal Officer",
      "System Administrator",
    ],
    nav: [
      "System health",
      "Data sources",
      "Validation",
      "User access",
      "Audit log",
      "Configuration",
    ],
    metrics: [
      ["Source systems", "9", "7 healthy"],
      ["Validation exceptions", "14", "6 owners assigned"],
      ["Active users", "3,842", "163 logged in today"],
      ["Access reviews due", "28", "Complete by 05 Sep"],
    ],
    tasks: [
      [
        "MIS/ZP/0831",
        "Resolve missing Parseoni return",
        "ZP monthly feed",
        "Overdue",
      ],
      [
        "MIS/ACC/0901",
        "Review temporary officer access",
        "17 delegations",
        "2 days",
      ],
      [
        "MIS/VAL/1421",
        "Reconcile 14 student identities",
        "SARAL / UDISE+",
        "Today",
      ],
      [
        "MIS/AUD/0830",
        "Close privileged-access review",
        "August audit",
        "4 days",
      ],
    ],
    actions: [
      "Run validation",
      "Sync data source",
      "Create user assignment",
      "Export audit log",
    ],
  },
];

export default function AppsPage() {
  const { session, logout } = useDemoAuth();
  const sessionApp = apps.find((app) => app.id === session.app) || apps[0];
  const [selected, setSelected] = useState(sessionApp);
  const [role, setRole] = useState(
    sessionApp.roles.includes(session.role) ? session.role : sessionApp.roles[0],
  );
  const [q, setQ] = useState("");
  const [nav, setNav] = useState(apps[0].nav[0]);
  const [task, setTask] = useState<string[] | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const choose = (app: AppDef) => {
    setSelected(app);
    setRole(app.roles[0]);
    setNav(app.nav[0]);
    setQ("");
    setMobile(false);
  };
  const tasks = useMemo(
    () =>
      selected.tasks.filter((t) =>
        t.join(" ").toLowerCase().includes(q.toLowerCase()),
      ),
    [selected, q],
  );
  const act = (text: string, id?: string) => {
    if (id) setDone((v) => [...v, id]);
    setTask(null);
    setToast(text);
    window.setTimeout(() => setToast(""), 2500);
  };
  const Icon = selected.icon;
  return (
    <main className="suite">
      <div className="suite-tricolour">
        <i />
        <i />
        <i />
      </div>
      <header className="suite-head">
        <button className="suite-menu" onClick={() => setMobile(true)}>
          <Menu size={20} />
        </button>
        <div className="suite-emblem">
          <Network size={22} />
        </div>
        <div>
          <span>शिक्षण सेतु</span>
          <strong>Applications</strong>
        </div>
        <a href="/">Command centre →</a>
        <WhatsAppShare />
        <button className="suite-account" onClick={logout} title="Sign out">
          <span>{session.name}</span>
          <LogOut size={15} />
        </button>
      </header>
      <div className="suite-body">
        <aside className={mobile ? "suite-launcher open" : "suite-launcher"}>
          <button className="suite-close" onClick={() => setMobile(false)}>
            <X size={18} />
          </button>
          <div className="launcher-title">
            <span>APPLICATIONS</span>
          </div>
          {apps.map((app) => {
            const I = app.icon;
            return (
              <button
                key={app.id}
                className={selected.id === app.id ? "active" : ""}
                onClick={() => choose(app)}
              >
                <i>
                  <I size={18} />
                </i>
                <span>
                  <strong>{app.name}</strong>
                </span>
              </button>
            );
          })}
        </aside>
        <section className="role-app">
          <header className="role-top">
            <div className="role-brand">
              <i>
                <Icon size={19} />
              </i>
              <div>
                <strong>{selected.name}</strong>
              </div>
            </div>
            <nav>
              {selected.nav.map((x) => (
                <button
                  className={nav === x ? "active" : ""}
                  onClick={() => setNav(x)}
                  key={x}
                >
                  {x}
                </button>
              ))}
            </nav>
            <button className="role-select">
              <UserRound size={15} />
              <span>{role}</span>
              <ChevronDown size={13} />
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {selected.roles.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </button>
            <button className="suite-bell">
              <Bell size={17} />
              <b>3</b>
            </button>
          </header>
          <div className="role-content">
            <div className="role-page-head">
              <div>
                <span>{nav.toUpperCase()}</span>
                <h1>{selected.name}</h1>
              </div>
              <div className="role-date">
                <small>MONDAY</small>
                <strong>31 AUG 2026</strong>
                <span>Demo data</span>
              </div>
            </div>
            <section className="role-metrics">
              {selected.metrics.map((m) => (
                <div key={m[0]}>
                  <span>{m[0]}</span>
                  <strong>{m[1]}</strong>
                  <small>{m[2]}</small>
                </div>
              ))}
            </section>
            <div className="role-grid">
              <section className="role-panel">
                <header>
                  <div>
                    <strong>Work queue</strong>
                  </div>
                  <label>
                    <Search size={14} />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search"
                    />
                  </label>
                </header>
                <div className="role-table">
                  <div className="role-table-head">
                    <span>Reference / work item</span>
                    <span>Context</span>
                    <span>Timeline</span>
                    <span>Status</span>
                  </div>
                  {tasks.map((t) => (
                    <button key={t[0]} onClick={() => setTask(t)}>
                      <span>
                        <small>{t[0]}</small>
                        <strong>{t[1]}</strong>
                      </span>
                      <span>{t[2]}</span>
                      <span>{t[3]}</span>
                      <span
                        className={done.includes(t[0]) ? "complete" : "open"}
                      >
                        {done.includes(t[0]) ? "Completed" : "Open"}
                      </span>
                    </button>
                  ))}
                  {!tasks.length && (
                    <div className="suite-empty">No results</div>
                  )}
                </div>
              </section>
              <aside className="quick-panel">
                <header>
                  <strong>Quick actions</strong>
                </header>
                {selected.actions.map((a, i) => (
                  <button
                    key={a}
                    onClick={() =>
                      setTask([
                        `NEW/${selected.id.toUpperCase()}/${i + 1}`,
                        a,
                        role,
                        "New action",
                      ])
                    }
                  >
                    <i>{i + 1}</i>
                    <span>{a}</span>
                    <b>→</b>
                  </button>
                ))}
              </aside>
            </div>
          </div>
        </section>
      </div>
      {task && (
        <div className="suite-overlay" onClick={() => setTask(null)}>
          <section
            className="suite-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>{selected.name} · WORK ITEM</span>
                <strong>{task[0]}</strong>
              </div>
              <button onClick={() => setTask(null)}>
                <X size={18} />
              </button>
            </header>
            <div className="suite-drawer-body">
              <div className="drawer-icon">
                <Icon size={22} />
              </div>
              <h2>{task[1]}</h2>
              <dl>
                <div>
                  <dt>Role</dt>
                  <dd>{role}</dd>
                </div>
                <div>
                  <dt>Application</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt>Context</dt>
                  <dd>{task[2]}</dd>
                </div>
                <div>
                  <dt>Timeline</dt>
                  <dd>{task[3]}</dd>
                </div>
                <div>
                  <dt>Jurisdiction</dt>
                  <dd>Nagpur district</dd>
                </div>
              </dl>
              <label>
                Remarks
                <textarea placeholder="Remarks" />
              </label>
            </div>
            <footer>
              <button onClick={() => setTask(null)}>Close</button>
              <button
                onClick={() =>
                  act(`${task[1]} recorded successfully.`, task[0])
                }
              >
                <Check size={15} /> Complete
              </button>
            </footer>
          </section>
        </div>
      )}
      {toast && (
        <div className="suite-toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </main>
  );
}
