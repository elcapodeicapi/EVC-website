import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  FileText,
  Settings,
  Mail,
  CalendarCheck,
  MessageSquare,
  IdCard,
  ShieldCheck,
} from "lucide-react";

export const adminNavItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Trajectbeheer", to: "/admin/trajects", icon: FileText },
  { label: "Assignments", to: "/admin/assignments", icon: FileSpreadsheet },
  { label: "User management", to: "/admin/users", icon: Users },
  { label: "Profile", to: "/admin/profile", icon: IdCard },
];

export const coachNavItems = [
  { label: "Dashboard", to: "/coach", icon: LayoutDashboard, end: true },
  { label: "My Customers", to: "/coach/customers", icon: Users },
  { label: "Feedback", to: "/coach/feedback", icon: FileText },
  { label: "Messages", to: "/coach/messages", icon: Mail },
  { label: "Profile", to: "/coach/profile", icon: IdCard },
  { label: "Settings", to: "/coach/settings", icon: Settings },
];

export const customerNavItems = [
  { label: "Wat is de procedure?", to: "/customer/procedure", icon: LayoutDashboard },
  { label: "Planning", to: "/customer/planning", icon: CalendarCheck },
  { label: "Messages", to: "/customer/messages", icon: MessageSquare },
  { label: "Profile", to: "/customer/profile", icon: IdCard },
];

export const adminProfile = {
  name: "Charlotte Willems",
  role: "Program Administrator",
  email: "charlotte.willems@example.com",
  phone: "+31 6 9876 5432",
  location: "Utrecht, NL",
  bio:
    "Charlotte zorgt voor een soepel verloop van alle EVC-trajecten. Ze stemt af met coaches, houdt de planning bij en bewaakt de kwaliteit van de erkenningsdossiers.",
  responsibilities: [
    "Beheer van deelnemers en coaches",
    "Planning EVC-trajecten",
    "Monitoren van kwaliteit",
    "Rapportages voor management",
  ],
  highlights: [
    { id: "hl-1", metric: "32", label: "Actieve trajecten" },
    { id: "hl-2", metric: "98%", label: "Tevredenheid coaches" },
    { id: "hl-3", metric: "12", label: "Nieuwe deelnemers (maand)" },
  ],
  certifications: [
    {
      id: "cert-admin-1",
      title: "Projectmanagement Professional",
      issuer: "IPMA",
      year: 2023,
    },
    {
      id: "cert-admin-2",
      title: "Kwaliteitsmanagement in Onderwijs",
      issuer: "Hogeschool Utrecht",
      year: 2022,
    },
  ],
  securityClearance: {
    level: "Volledig",
    renewedOn: "08 jun 2025",
    badge: ShieldCheck,
  },
};


export const adminUsers = [
  { id: 1, name: "Daniël Vermeer", email: "daniel.vermeer@example.com", role: "Customer", coach: "Isabelle Janssen" },
  { id: 2, name: "Isabelle Janssen", email: "isabelle.janssen@example.com", role: "Coach", coach: "-" },
  { id: 3, name: "Noah Smits", email: "noah.smits@example.com", role: "Customer", coach: "Isabelle Janssen" },
  { id: 4, name: "Fatima El Amrani", email: "fatima.el-amrani@example.com", role: "Customer", coach: "Bas Smit" },
  { id: 5, name: "Bas Smit", email: "bas.smit@example.com", role: "Coach", coach: "-" },
];

export const competencies = [
  { id: 1, title: "B1-K1-W1", description: "Onderzoekt de behoefte aan sociaal werk." },
  { id: 2, title: "B1-K1-W2", description: "Verzamelt en analyseert signalen in de praktijk." },
  { id: 3, title: "B1-K2-W1", description: "Organiseert passende ondersteuning." },
];

export const assignments = [
  { id: 1, customer: "Daniël Vermeer", coach: "Isabelle Janssen", status: "Active" },
  { id: 2, customer: "Noah Smits", coach: "Isabelle Janssen", status: "Active" },
  { id: 3, customer: "Fatima El Amrani", coach: "Bas Smit", status: "On hold" },
];

export const coachProfile = {
  name: "Isabelle Janssen",
  role: "Senior Coach",
  email: "isabelle.janssen@example.com",
  phone: "+31 6 1234 5678",
  location: "Amsterdam, NL",
  bio:
    "Met ruim 10 jaar ervaring in sociaal werk begeleidt Isabelle professionals bij het vertalen van praktijkervaring naar erkende competenties.",
  expertise: [
    "Methodisch werken",
    "Reflectieve vaardigheden",
    "Teamcoaching",
    "Portfolio-ontwikkeling",
  ],
  availability: [
    { day: "Maandag", slots: "09:00 - 13:00" },
    { day: "Woensdag", slots: "12:00 - 17:00" },
    { day: "Vrijdag", slots: "09:00 - 12:00" },
  ],
  upcomingSessions: [
    { id: "sess-1", customer: "Daniël Vermeer", date: "15 sep 2025", focus: "Portfolio review" },
    { id: "sess-2", customer: "Noah Smits", date: "18 sep 2025", focus: "Competentie B1-K1" },
  ],
  performance: [
    { id: "perf-1", label: "Beoordeelde uploads", value: "124" },
    { id: "perf-2", label: "Gem. feedbackscore", value: "4.8/5" },
    { id: "perf-3", label: "Doorlooptijd", value: "5.2 weken" },
  ],
};


export const threads = [
  {
    id: "thread-1",
    name: "Daniël ↔ Isabelle",
    lastMessage: "Zullen we volgende week afstemmen?",
  },
  {
    id: "thread-2",
    name: "Noah ↔ Bas",
    lastMessage: "Feedback ontvangen, bedankt!",
  },
  {
    id: "thread-3",
    name: "Fatima ↔ Support",
    lastMessage: "Ik heb het document geüpload.",
  },
];

export const threadMessages = {
  "thread-1": [
    { id: "m-1", author: "Daniël", body: "Hoi Isabelle, ik heb zojuist mijn rapport geüpload.", timestamp: "09:12", from: "other" },
    { id: "m-2", author: "Isabelle", body: "Top! Ik geef vandaag nog feedback.", timestamp: "09:20", from: "me" },
  ],
  "thread-2": [
    { id: "m-3", author: "Noah", body: "Bedankt voor de snelle reactie!", timestamp: "08:45", from: "other" },
  ],
  "thread-3": [
    { id: "m-4", author: "Fatima", body: "Het projectplan staat nu klaar.", timestamp: "07:30", from: "other" },
  ],
};

export const coaches = [
  { id: "coach-1", name: "Isabelle Janssen", email: "isabelle.janssen@example.com", assignedCustomers: 8 },
  { id: "coach-2", name: "Bas Smit", email: "bas.smit@example.com", assignedCustomers: 5 },
  { id: "coach-3", name: "Sven de Vries", email: "sven.de.vries@example.com", assignedCustomers: 4 },
];

export const customers = [
  { id: "cust-1", name: "Daniël Vermeer", email: "daniel.vermeer@example.com", lastActivity: "2h ago", coachId: "coach-1" },
  { id: "cust-2", name: "Noah Smits", email: "noah.smits@example.com", lastActivity: "10h ago", coachId: "coach-1" },
  { id: "cust-3", name: "Fatima El Amrani", email: "fatima.el-amrani@example.com", lastActivity: "1d ago", coachId: "coach-2" },
  { id: "cust-4", name: "Lotus van Leeuwen", email: "lotus.van.leeuwen@example.com", lastActivity: "3d ago", coachId: "coach-3" },
];

export const customerProfileDetails = {
  id: "cust-1",
  phone: "+31 6 1234 5678",
  location: "Amsterdam, NL",
  headline: "Sociaal werker met focus op jeugd en wijkgericht werken",
  about:
    "Ik ben Daniël en werk sinds 2016 in de jeugdzorg. Met dit EVC-traject wil ik mijn werkervaring officieel laten erkennen zodat ik kan doorgroeien naar een coördinerende rol.",
  certificates: [
    { id: "cert-1", title: "HBO Social Work", issuer: "HU", year: 2016 },
    { id: "cert-2", title: "SKJ-registratie", issuer: "Stichting Kwaliteitsregister Jeugd", year: 2024 },
    { id: "cert-3", title: "Motiverende Gespreksvoering", issuer: "Trimbos Instituut", year: 2023 },
  ],
  documents: [
    {
      id: "doc-1",
      name: "Portfolio-samenvatting.pdf",
      size: "1.2 MB",
      uploadedAt: "12 sep 2025",
    },
    {
      id: "doc-2",
      name: "Reflectieverslag.docx",
      size: "540 kB",
      uploadedAt: "03 sep 2025",
    },
  ],
};

export const coachStats = [
  {
    id: "assigned",
    title: "Assigned Customers",
    value: "8",
    trend: { direction: "up", value: "+2", caption: "new this month" },
    icon: Users,
    variant: "brand",
  },
  {
    id: "feedback",
    title: "Feedback Given",
    value: "56",
    trend: { direction: "up", value: "+7", caption: "since last week" },
    icon: FileText,
    variant: "emerald",
  },
  {
    id: "pending",
    title: "Pending Uploads",
    value: "5",
    trend: { direction: "down", value: "-3", caption: "to review" },
    icon: FileSpreadsheet,
    variant: "amber",
  },
];

export const customerCompetencies = {
  "cust-1": [
    {
      competency: "B1-K1-W1",
      description: "Onderzoekt de behoefte aan sociaal werk.",
      uploads: ["Onderzoeksrapport.pdf", "Interviewnotities.docx"],
      feedback: [
        { id: "f-1", author: "Isabelle", body: "Sterke analyse. Voeg concrete voorbeelden toe." },
      ],
    },
    {
      competency: "B1-K1-W2",
      description: "Verzamelt en analyseert signalen in de praktijk.",
      uploads: ["Reflectieverslag.docx"],
      feedback: [],
    },
  ],
  "cust-2": [
    {
      competency: "B1-K2-W1",
      description: "Organiseert passende ondersteuning.",
      uploads: ["Projectplan.pdf"],
      feedback: [
        { id: "f-2", author: "Isabelle", body: "Mooi plan! Denk aan de planning." },
      ],
    },
  ],
};

export const feedbackItems = [
  {
    id: "fb-1",
    customer: "Daniël Vermeer",
    competency: "B1-K1-W1",
    summary: "Feedback verstuurd",
    updatedAt: "1 day ago",
  },
  {
    id: "fb-2",
    customer: "Noah Smits",
    competency: "B1-K1-W2",
    summary: "Wacht op reactie",
    updatedAt: "3 days ago",
  },
  {
    id: "fb-3",
    customer: "Fatima El Amrani",
    competency: "B1-K2-W1",
    summary: "Nog te reviewen",
    updatedAt: "5 days ago",
  },
];
