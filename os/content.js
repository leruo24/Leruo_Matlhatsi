/*
 * ─────────────────────────────────────────────────────────────
 *  YOUR CONTENT LIVES HERE.
 *  Everything on the computer screen comes from this file. Anything marked TODO is a
 *  placeholder: search for "TODO" and replace before sharing.
 * ─────────────────────────────────────────────────────────────
 */
window.PORTFOLIO = {
  name: "Leruo Matlhatsi",
  shortName: "Leruo",
  initials: "LM",
  title: "Business Analyst · Software Developer",
  tagline:
    "I build software, connect it to hardware and improve the way businesses work: practical tech for real problems.",
  location: "Cape Town · Johannesburg · Remote",

  photos: {
    headshot: "../assets/leruo-headshot.jpg",
    standing: "../assets/leruo-standing.jpg",
    outdoors: "../assets/leruo-outdoors.jpg",
  },

  // Upload the PDF, then set resumeUrl to "../assets/Leruo-Matlhatsi-CV.pdf".
  resumeUrl: null,

  /* The intro (the black-and-white office before the headset goes on) */
  intro: { headline: "Step into my ideal world" },

  /* How the website works: shown by the "?" on the desk and by Help on the computer */
  help: {
    title: "Welcome to my workshop",
    steps: [
      ["Put on the headset.", "You start in an ordinary office. Put on the headset (or skip the intro) to step into my world."],
      ["Look around.", "Move your mouse (or drag on a phone) and the room shifts in 3D. Everything here is part of my world: the Land Cruiser, the cars in the garage, my three dogs, the pond, the farm, the drone and the bench."],
      ["Take a seat.", "Click the computer on the desk (or the Take a seat button) and you'll sit down at the desk."],
      ["Jump into the PC.", "Click the screen to log in to LeruOS."],
      ["Explore the computer.", "Double-click icons on the desktop. Portfolio has my projects, experience and contact details, Resume is my CV, and Overland Run is a little 4x4 game. The start button has everything too."],
      ["Head back.", "Press Esc or use Back to the workshop to stand up, and Esc again to step away from the desk."],
    ],
    tips: ["Turn the sound on for the pond, birds and cows.", "Open CV (top right) takes you straight to my CV."],
  },

  contact: {
    email: "leruom7@gmail.com",
    linkedin: "https://www.linkedin.com/in/leruo-matlhatsi-93135030b/",
    github: "https://github.com/leruo24",
  },

  about: [
    "I'm a final-year Bachelor of Social Science student at the University of Cape Town, majoring in Information Systems, Politics and Industrial Sociology. Born and raised in Johannesburg.",
    "My father worked in agriculture in the North West, which is where my interest in agritech started. I care about technology that solves real problems on the ground.",
    "I like owning a system end to end: the hardware on the bench, the database and API in the middle, and the app a real person taps on. I enjoy the business side just as much: mapping how work flows, understanding stakeholders and making the case for a better way.",
    "I'm open to roles in Johannesburg, Cape Town, remote, or wherever the work needs me.",
  ],

  interests: [
    { icon: "offroad", title: "Off-roading & overlanding", text: "4x4s, gravel roads, rooftop tents and getting properly out into nature." },
    { icon: "car", title: "Cars", text: "From 4x4s to supercars: the engineering, the design and the sound." },
    { icon: "sprout", title: "Agritech", text: "Where technology meets the land, and the people who work it." },
    { icon: "paw", title: "Dogs, animals & nature", text: "Happiest outdoors, ideally with a dog nearby." },
    { icon: "chart", title: "Business solutions", text: "Processes, systems and the corporate side of making tech useful." },
    { icon: "chip", title: "Tinkering", text: "ESP32s, sensors, relays and a soldering iron on the bench." },
  ],

  skills: [
    { group: "Programming", items: ["C#", "TypeScript", "JavaScript", "Python", "SQL", "C++ (Arduino)"] },
    { group: "Frameworks", items: ["ASP.NET Core", "Razor Pages", "EF Core", "Node.js", "REST APIs", "React Native / Expo", "React", "FastAPI", "Vite"] },
    { group: "Cloud & data", items: ["Supabase / PostgreSQL (RLS)", "Google Cloud Run", "BigQuery", "Firestore", "Docker", "Railway", "Vercel"] },
    { group: "IoT", items: ["ESP32", "ESP-NOW", "MQTT (HiveMQ)", "Sensors & actuators", "Hardware-software integration", "Soil & climate sensors", "Relays & pumps", "3D printing"] },
    { group: "AI", items: ["Vertex AI", "Google Gemini", "AI-assisted development (Claude Code, Copilot)"] },
    { group: "Business & IS", items: ["BPMN (ARIS, Signavio, bpmn.io)", "SAP S/4HANA (P2P, O2C)", "ERP concepts", "Intro ABAP (Eclipse ADT, SAP GUI)", "UML", "Draw.io", "Database design & EER modelling", "Jira", "Git / GitHub", "Requirements & stakeholder interviews"] },
    { group: "Spoken languages", items: ["English (fluent)", "Setswana (fluent)", "Sesotho (proficient)", "Afrikaans (pre-intermediate)", "isiZulu (pre-intermediate)", "isiXhosa (beginner)"] },
  ],

  experience: [
    // Discovery: add later
    {
      role: "Business Analyst Consultant",
      org: "Remote",
      dates: "Nov 2025 to present",
      points: [
        "Gathering client requirements, analysing processes and translating stakeholder needs into system requirements and digital solution recommendations.",
        "Clients include Venture54 and Fa8th.",
      ],
    },
    {
      role: "Treasurer & signatory",
      org: "UCT Wine and Cultural Society",
      dates: "",
      points: [
        "Manage the society's finances through UCT Student Treasury: purchase orders, journal transfers and inter-society payments.",
        "Budget for events, including campus security for after-hours functions, and co-ordinate joint events with residences.",
      ],
    },
    {
      role: "Faculty Orientation Leader",
      org: "University of Cape Town",
      dates: "Nov 2025 to Feb 2026",
      points: [
        "Helped first-year students into university life: academic guidance, peer mentorship and support, and help with university systems, online platforms and essential tech tools.",
      ],
    },
    {
      role: "Brand Promoter",
      org: "Cape Town",
      dates: "Feb 2025 to present",
      points: [
        "Represent national brands at events such as UCT Varsity Cup rugby, engaging students to drive visibility and energy on campus.",
      ],
    },
    {
      role: "Bartender",
      org: "Cape Town",
      dates: "Sept 2025 to present",
      points: [
        "Hospitality work including DHL VIP hospitality and business lounge suites.",
      ],
    },
    {
      role: "Residence Mentor",
      org: "Upper Campus Residence, University of Cape Town",
      dates: "Feb 2024 to Nov 2024",
      points: [
        "Supported first-year students as they adjusted to university life, with monthly meetings to help their transition.",
      ],
    },
  ],

  education: [
    {
      degree: "Bachelor of Social Science: Information Systems, Politics & Industrial Sociology",
      org: "University of Cape Town",
      dates: "Feb 2023 to present (final year)",
      points: [
        "Systems development in ASP.NET Core, business process management and enterprise systems (BPMN, SAP S/4HANA), and a final-year team project for a real sponsor.",
      ],
    },
    {
      degree: "Matric",
      org: "Jeppe High School for Boys, Johannesburg",
      dates: "2018 to 2022",
      points: [],
    },
  ],

  awards: [
    "2nd place, 2026 UCT Business Process Management group project (award sponsored by K5 Business)",
    "Top 13 finalist, Discovery GradHack 2026",
    "UCT Plus Bronze Award: 35+ hours of mentoring (2024)",
    "Best Stage Manager, Gauteng Regional Amateur Dramatic Series (GRADS), 2022",
  ],

  projects: [
    {
      id: "agroflow",
      name: "AgroFlow",
      subtitle: "Smart irrigation for small-scale farmers",
      year: "2026",
      tags: ["ESP32", "MQTT", ".NET 8", "Supabase", "React Native", "TypeScript"],
      summary:
        "A condition-based irrigation system that waters each zone of a farm from live soil-moisture and weather data instead of a fixed timer. Built with a team of four for a real sponsor, the Mafikeng Cisco Edge Centre (MDiHub).",
      role: "Lead developer: database, hardware, backend and admin dashboard.",
      points: [
        "Built per-zone ESP32 kits (soil moisture, temperature/humidity, relay and pump) that report over MQTT via HiveMQ Cloud.",
        "Designed the Supabase/PostgreSQL schema with row-level security, and an ASP.NET Core (.NET 8) API for device ingestion and auto-irrigation, deployed with Docker on Railway.",
        "Built an FAO-56 (Penman-Monteith) engine that turns sensor and weather data into simple, actionable insights for farmers.",
        "Farmers water their fields from an Expo / React Native app (Android APK); staff manage farms from a TypeScript admin site on Vercel.",
        "Estimated water use without a flow meter: pump runtime × a measured flow rate.",
        "Beyond code: sourced the hardware and supplier quotes, built the test and presentation boards, 3D-printed a demo model, and wrote the user guide, installation guide and test cases for the handover to the sponsor.",
      ],
      links: [{ label: "Android app releases", url: "https://github.com/leruo24/AgroFlow-appk/releases" }],
    },
    {
      id: "healthyfood",
      name: "HealthyFood Companion",
      subtitle: "Discovery GradHack 2026: AI for Smarter Everyday Living",
      year: "2026",
      tags: ["React Native", "FastAPI", "Cloud Run", "BigQuery", "Gemini", "Firestore"],
      summary:
        "A hackathon prototype extending Discovery's HealthyFood programme with pantry management, meal planning, AI recipe suggestions and gamified rewards tied to Vitality. Built by team Runtime Terror (5 people).",
      role: "Integration between the team's services, the rewards system, and the pitch.",
      points: [
        "Built a rules-driven rewards engine whose rules live in Firestore config, not in code.",
        "Glued the team's services together behind a FastAPI backend on Cloud Run (~27 routes) and a five-screen Expo app.",
        "Worked with a 15,000-row BigQuery transaction dataset; Gemini on Vertex AI powered OCR and grounded recipe generation.",
        "Kept a hard rule: the AI never decides what's healthy; that comes from the food catalogue.",
        "Delivered the 5-minute demo pitch.",
      ],
      links: [],
    },
    {
      id: "claims",
      name: "Claims Process Redesign",
      subtitle: "Business process analysis for a real client · 2nd place",
      year: "2026",
      tags: ["BPMN", "ARIS", "Process redesign", "Stakeholder interviews"],
      summary:
        "A team consulting project for a real client in insurance: we analysed an existing business process and proposed a redesign. Our team placed 2nd in the 2026 UCT BPM group project (award sponsored by K5 Business). Client details are confidential.",
      role: "Process modelling (BPMN sub-processes and the to-be model) and analysis.",
      points: [],
      links: [],
    },
    {
      id: "portfolio",
      name: "This portfolio",
      subtitle: "A workshop you can explore",
      year: "2026",
      tags: ["Three.js", "WebGL", "GLSL", "Web Audio", "Vanilla JS"],
      summary:
        "A photograph-based workshop with depth parallax, a grayscale office-to-VR introduction, an interactive computer, grazing cows, rotating sprinkler spray and occasional birds. The pond, foliage and dogs have subtle local motion. Inspired by Henry Heffernan’s portfolio.",
      role: "Designer and developer.",
      points: [],
      links: [{ label: "Source on GitHub", url: "https://github.com/leruo24/Leruo_Matlhatsi" }],
    },
  ],
};
