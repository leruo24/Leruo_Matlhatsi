/*
 * ─────────────────────────────────────────────────────────────
 *  YOUR CONTENT LIVES HERE.
 *  Everything on the computer screen AND the pop-up cards in the
 *  3D farm comes from this file. Anything marked TODO is a
 *  placeholder — search for "TODO" and replace before sharing.
 * ─────────────────────────────────────────────────────────────
 */
window.PORTFOLIO = {
  name: "Leruo Matlhatsi",
  shortName: "Leruo",
  initials: "LM",
  title: "Software development · IoT · Business analysis",
  tagline:
    "I build software that helps things grow — from sensor-driven irrigation for farmers to AI-powered apps and better business processes.",
  location: "Cape Town · Johannesburg · Remote",

  photos: {
    headshot: "../assets/leruo-headshot.jpg",
    standing: "../assets/leruo-standing.jpg",
    outdoors: "../assets/leruo-outdoors.jpg",
  },

  // Drop your CV into /assets with exactly this name (or change the path).
  resumeUrl: "../assets/Leruo-Matlhatsi-CV.pdf",

  contact: {
    email: "leruom7@gmail.com",
    linkedin: "https://www.linkedin.com/in/leruo-matlhatsi-93135030b/",
    github: "https://github.com/leruo24",
  },

  about: [
    "I'm a final-year Bachelor of Social Science student at the University of Cape Town, majoring in Information Systems, Politics and Industrial Sociology. Born and raised in Johannesburg.",
    "My father worked in agriculture in the North West, and that's where my love for agritech comes from. I care about technology that solves real problems on the ground — like helping a farmer use less water without guessing.",
    "I like owning a system end to end: the hardware on the bench, the database and API in the middle, and the app a real person taps on. I enjoy the business side just as much — mapping how work flows, understanding stakeholders and making the case for a better way.",
    "I'm open to roles in Johannesburg, Cape Town, remote — or wherever the work needs me.",
  ],

  interests: [
    { icon: "🚙", title: "Off-roading & overlanding", text: "4x4s, gravel roads, rooftop tents and getting properly out into nature." },
    { icon: "🏎️", title: "Cars", text: "From 4x4s to supercars — the engineering, the design and the sound." },
    { icon: "🌱", title: "Agritech", text: "Technology that helps farms grow more with less water." },
    { icon: "🐕", title: "Dogs, animals & nature", text: "Happiest outdoors, ideally with a dog nearby." },
    { icon: "📈", title: "Business solutions", text: "Processes, systems and the corporate side of making tech useful." },
    { icon: "🔌", title: "Tinkering", text: "ESP32s, sensors, relays and a soldering iron on the bench." },
  ],

  skills: [
    { group: "Languages", items: ["C#", "TypeScript", "JavaScript", "Python", "SQL", "C++ (Arduino)"] },
    { group: "Frameworks", items: ["ASP.NET Core", "Razor Pages", "EF Core", "React Native / Expo", "React", "FastAPI", "Vite"] },
    { group: "Cloud & data", items: ["Supabase / PostgreSQL (RLS)", "Google Cloud Run", "BigQuery", "Firestore", "Docker", "Railway", "Vercel"] },
    { group: "IoT", items: ["ESP32", "ESP-NOW", "MQTT (HiveMQ)", "Soil & climate sensors", "Relays & pumps", "3D printing"] },
    { group: "AI", items: ["Vertex AI", "Google Gemini", "AI-assisted development (Claude Code, Copilot)"] },
    { group: "Business & IS", items: ["BPMN (ARIS, Signavio)", "SAP S/4HANA (P2P, O2C)", "ERP concepts", "Intro ABAP (Eclipse ADT, SAP GUI)", "UML", "Jira", "Requirements & stakeholder interviews"] },
  ],

  experience: [
    // Discovery — add later
    {
      role: "Business consultant",
      org: "Recce Finance",
      dates: "",
      points: [
        "Gathering client requirements, analysing processes and translating stakeholder needs into system requirements and digital solution recommendations.",
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
      role: "Orientation, mentorship & people-facing roles",
      org: "UCT and beyond",
      dates: "",
      points: [
        "Faculty orientation and residence mentorship at UCT.",
        "Brand activations / promotion and hospitality work — roles that put people and communication at the centre of how I work.",
      ],
    },
  ],

  education: [
    {
      degree: "Bachelor of Social Science — Information Systems, Politics & Industrial Sociology",
      org: "University of Cape Town",
      dates: "Final year",
      points: [
        "Systems development in ASP.NET Core, business process management and enterprise systems (BPMN, SAP S/4HANA), and a final-year team project for a real sponsor (AgroFlow).",
      ],
    },
  ],

  awards: [
    "2nd place — 2026 UCT Business Process Management group project (award sponsored by K5 Business)",
    "UCT Plus Bronze Award — 35+ hours of mentoring (2024)",
    "Best Stage Manager — GRADS (2022)",
  ],

  projects: [
    {
      id: "agroflow",
      name: "AgroFlow",
      subtitle: "Smart irrigation for small-scale farmers",
      year: "2026",
      tags: ["ESP32", "MQTT", ".NET 8", "Supabase", "React Native", "TypeScript"],
      summary:
        "A condition-based irrigation system that waters each zone of a farm from live soil-moisture and weather data instead of a fixed timer — built with a team of four for a real sponsor, the Mafikeng Cisco Edge Centre (MDiHub).",
      role: "Lead developer — database, hardware, backend and admin dashboard.",
      points: [
        "Built per-zone ESP32 kits (soil moisture, temperature/humidity, relay and pump) that report over MQTT via HiveMQ Cloud.",
        "Designed the Supabase/PostgreSQL schema with row-level security, and an ASP.NET Core (.NET 8) API for device ingestion and auto-irrigation, deployed with Docker on Railway.",
        "Built an FAO-56 (Penman–Monteith) engine that turns sensor and weather data into simple, actionable insights for farmers.",
        "Farmers water their fields from an Expo / React Native app (Android APK); staff manage farms from a TypeScript admin site on Vercel.",
        "Estimated water use without a flow meter: pump runtime × a measured flow rate.",
        "Beyond code: sourced the hardware and supplier quotes, built the test and presentation boards, 3D-printed a demo model, and wrote the user guide, installation guide and test cases for the handover to the sponsor.",
      ],
      links: [{ label: "Android app releases", url: "https://github.com/leruo24/AgroFlow-appk/releases" }],
    },
    {
      id: "healthyfood",
      name: "HealthyFood Companion",
      subtitle: "Discovery GradHack 2026 — AI for Smarter Everyday Living",
      year: "2026",
      tags: ["React Native", "FastAPI", "Cloud Run", "BigQuery", "Gemini", "Firestore"],
      summary:
        "A hackathon prototype extending Discovery's HealthyFood programme with pantry management, meal planning, AI recipe suggestions and gamified rewards tied to Vitality — built by team Runtime Terror (5 people).",
      role: "Integration between the team's services, the rewards system, and the pitch.",
      points: [
        "Built a rules-driven rewards engine whose rules live in Firestore config, not in code.",
        "Glued the team's services together behind a FastAPI backend on Cloud Run (~27 routes) and a five-screen Expo app.",
        "Worked with a 15,000-row BigQuery transaction dataset; Gemini on Vertex AI powered OCR and grounded recipe generation.",
        "Kept a hard rule: the AI never decides what's healthy — that comes from the food catalogue.",
        "Delivered the 5-minute demo pitch.",
      ],
      links: [],
    },
    {
      id: "attendance",
      name: "Attendance Register",
      subtitle: "Full-stack ASP.NET Core app, built with AI-assisted development",
      year: "2026",
      tags: ["ASP.NET Core", "Razor Pages", "EF Core", "SQLite", "Identity", "Chart.js"],
      summary:
        "A lecture attendance system for UCT's INF3003W class — built with Claude as the coding assistant while I made the architectural decisions.",
      role: "Sole developer and architect.",
      points: [
        "Role-based login for lecturers and students with ASP.NET Core Identity.",
        "CSV import of the class list with a preview/confirm step and safe, repeatable (idempotent) updates.",
        "QR-code check-ins and Chart.js attendance dashboards.",
        "Built across eight sprints, with structured logging (Serilog) and no hard-coded configuration.",
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
      subtitle: "A farm workshop you can explore",
      year: "2026",
      tags: ["Three.js", "WebGL", "GLSL", "Web Audio", "Vanilla JS"],
      summary:
        "A photoreal workshop brought to life in WebGL: an AI depth map gives the photo real depth, and live 3D objects (the second monitor, the home-lab rack, the 3D printer, walking cows, birds and sprinklers) are rendered with a camera matched to the photo, so they sit behind and in front of things correctly. The river, trees, grass and clouds move, and the sounds are real field recordings mixed live. Inspired by Henry Heffernan's portfolio.",
      role: "Designer and developer.",
      points: [],
      links: [{ label: "Source on GitHub", url: "https://github.com/leruo24/Leruo_Matlhatsi" }],
    },
  ],

  /* Pop-up cards for things you click in the 3D farm */
  scene: {
    xbox: {
      kicker: "Off the clock",
      title: "Game time",
      text: ["A second screen and a console for when the code compiles. It's running Overland Run, the 4x4 game on my computer."],
      buttons: [{ label: "Play Overland Run", open: ["game"] }],
    },
    caps: {
      kicker: "The cap rack",
      title: "Joburg roots, Cape Town now",
      text: ["A Jeppe Boys cap and a UCT cap on the rack by the door. Born and raised in Johannesburg, studying at the University of Cape Town."],
      buttons: [{ label: "About me", open: ["about"] }],
    },
    workbench: {
      kicker: "The workbench",
      title: "Always something on the bench",
      text: [
        "An ESP32, a breadboard, loose jumper wires, a multimeter and a soldering iron. One more idea to test.",
        "This is where code meets the physical world. AgroFlow's zone kits came together the same way: an ESP32 reading a soil probe and switching a pump through a relay.",
      ],
      buttons: [{ label: "Open the AgroFlow project", open: ["projects", "agroflow"] }],
    },
    office: {
      kicker: "The business side",
      title: "Good systems start with people",
      text: [
        "Before building the solution, understand the work, the people doing it and what needs to change.",
        "Our team placed 2nd in the 2026 UCT Business Process Management group project (award sponsored by K5 Business). I also do business consulting at Recce Finance.",
      ],
      facts: ["BPMN in ARIS and SAP Signavio", "SAP S/4HANA, ERP concepts, intro ABAP", "Stakeholder interviews, requirements, AS-IS / TO-BE"],
      buttons: [{ label: "See the process project", open: ["projects", "claims"] }, { label: "My experience", open: ["experience"] }],
    },
    landcruiser: {
      kicker: "Off the tar",
      title: "Off-roading & overlanding",
      text: ["Give me a 4x4, a dirt road and somewhere to camp. I love off-roading and overlanding — the landscapes, the vehicles and getting properly out to explore."],
      buttons: [{ label: "More about me", open: ["about"] }],
    },
    supercar: {
      kicker: "The garage",
      title: "Mud or tar — I love cars",
      text: ["Capable 4x4s and supercars: different machines, different purposes, plenty of engineering to be curious about."],
      buttons: [{ label: "Play Overland Run", open: ["game"] }],
    },
    dog: {
      kicker: "Head of security",
      title: "Every workshop needs a dog",
      text: ["Nature, water and animals belong in my world as much as computers do. He mostly guards the floor."],
      buttons: [{ label: "More about me", open: ["about"] }],
    },
    farm: {
      kicker: "AgroFlow",
      title: "Small farm. Connected thinking.",
      text: [
        "AgroFlow brings my interest in agriculture together with the software and hardware I like building.",
        "A two-zone smart irrigation prototype: ESP32 sensor kits → MQTT → .NET API & Supabase → farmer and staff apps, with an FAO-56 engine deciding when to water.",
      ],
      buttons: [{ label: "Open AgroFlow", open: ["projects", "agroflow"] }, { label: "All projects", open: ["projects"] }],
    },
    rack: {
      kicker: "Under the desk",
      title: "The home lab",
      text: [
        "A small rack with a router, a network switch and a mini server: where I test things like MQTT brokers, APIs and databases before they go anywhere real.",
        "The blinking lights are the network doing its job.",
      ],
      facts: ["Networking, IoT messaging (MQTT)", ".NET APIs, SQL databases, Supabase"],
      buttons: [{ label: "See my projects", open: ["projects"] }],
    },
    printer: {
      kicker: "Making things",
      title: "Printing the next enclosure",
      text: ["A 3D printer for sensor housings, brackets and quick prototypes. Hardware ideas move faster when you can print the part tonight."],
      buttons: [{ label: "Open the AgroFlow project", open: ["projects", "agroflow"] }],
    },
    whiteboard: {
      kicker: "On the board",
      title: "Wins worth pinning up",
      text: ["The whiteboard keeps the wins next to the next idea."],
      facts: ["2nd place, 2026 UCT Business Process Management group project (sponsored by K5 Business)", "UCT Plus Bronze award, 2024", "Best Stage Manager, GRADS 2022"],
      buttons: [{ label: "My experience", open: ["experience"] }],
    },
    water: {
      kicker: "Water",
      title: "Every litre counts",
      text: [
        "Water is the reason AgroFlow exists: irrigate when the soil needs it, not on a timer.",
        "Our kits have no flow meter, so we estimate use from pump runtime × a measured flow rate — the demo pump did 500 mL in 20 s (≈1.5 L/min).",
      ],
      buttons: [{ label: "Open AgroFlow", open: ["projects", "agroflow"] }],
    },
  },
};
