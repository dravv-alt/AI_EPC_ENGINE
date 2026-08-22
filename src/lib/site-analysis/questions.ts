export type SiteAnswerMap = Record<string, string>;
export type SiteSection = {
  id: string;
  title: string;
  description: string;
  questions: Array<{
    key: string;
    label: string;
    hint: string;
    options?: string[];
  }>;
};
export const coolingStatePointFields = [
  [
    "rack_air_inlet_design_c",
    "Rack-air inlet design (°C)",
    "Normal operating design point.",
  ],
  [
    "rack_air_oem_max_c",
    "Rack-air OEM maximum (°C)",
    "Evidence-backed equipment limit.",
  ],
  [
    "tech_coolant_supply_c",
    "Technology-coolant supply (°C)",
    "Planning supply temperature.",
  ],
  [
    "tech_coolant_return_c",
    "Technology-coolant return (°C)",
    "Planning return temperature.",
  ],
  [
    "facility_water_supply_c",
    "Facility-water supply (°C)",
    "Facility boundary supply.",
  ],
  [
    "facility_water_return_c",
    "Facility-water return (°C)",
    "Facility boundary return.",
  ],
  ["chws_c", "Chilled-water supply (°C)", "Only if chilled water applies."],
  ["chwr_c", "Chilled-water return (°C)", "Only if chilled water applies."],
  [
    "chilled_water_flow_ls",
    "Chilled-water design flow (L/s)",
    "Preliminary flow estimate.",
  ],
  [
    "outdoor_dry_bulb_c",
    "Outdoor entering dry-bulb (°C)",
    "Design weather point.",
  ],
  [
    "outdoor_wet_bulb_c",
    "Outdoor entering wet-bulb (°C)",
    "For wet heat rejection.",
  ],
  [
    "equipment_leaving_fluid_c",
    "Equipment leaving fluid (°C)",
    "Equipment interface point.",
  ],
  ["hx_approach_k", "Minimum HX approach (K)", "Heat-exchanger assumption."],
  [
    "fluid_specific_heat",
    "Technology-fluid specific heat (kJ/kg·K)",
    "OEM or engineering value.",
  ],
  [
    "fluid_density",
    "Technology-fluid density (kg/m³)",
    "OEM or engineering value.",
  ],
  [
    "tech_fluid_flow_ls",
    "Technology-fluid design flow (L/s)",
    "Technology loop flow.",
  ],
  [
    "tech_loop_pressure_kpa",
    "Technology-loop operating pressure (kPa)",
    "Operating basis.",
  ],
  [
    "tech_loop_pressure_drop_kpa",
    "Technology-loop pressure drop (kPa)",
    "Design pressure loss.",
  ],
  [
    "room_dew_point_c",
    "Controlled room dew point (°C)",
    "Room condition basis.",
  ],
  [
    "dew_point_margin_k",
    "Dew-point control margin (K)",
    "Condensation safety margin.",
  ],
  [
    "oem_tech_supply_max_c",
    "OEM maximum technology supply (°C)",
    "Manufacturer limit.",
  ],
  [
    "technology_fluid",
    "Exact technology fluid",
    "Fluid or treatment designation.",
  ],
  [
    "water_boundary",
    "Heat-rejection water boundary",
    "Plant topology / isolation point.",
  ],
  [
    "fluid_evidence",
    "Fluid chemistry / water-treatment evidence",
    "Document ID, revision, and page.",
  ],
  [
    "dry_cooler_sound_dba",
    "Dry-cooler sound target (dBA)",
    "Property-line or equipment target.",
  ],
  [
    "dry_cooler_coil_option",
    "Exact dry-cooler coil option",
    "OEM coil / material option.",
  ],
  [
    "dry_cooler_fan_option",
    "Exact dry-cooler fan option",
    "OEM fan / control option.",
  ],
  ["dry_cooler_redundancy", "Dry-cooler fan redundancy", "For example, 2+1."],
  [
    "chiller_sound_option",
    "Exact chiller sound option",
    "OEM acoustic package.",
  ],
  [
    "chiller_efficiency_option",
    "Exact chiller efficiency option",
    "OEM compressor / efficiency package.",
  ],
  [
    "pump_wetted_materials",
    "Exact pump-skid wetted materials",
    "OEM material schedule.",
  ],
  [
    "pump_vfd_arrangement",
    "Exact pump-skid VFD arrangement",
    "OEM VFD arrangement.",
  ],
  [
    "pump_control_arrangement",
    "Exact pump-skid control arrangement",
    "OEM lead/lag and alternation controls.",
  ],
] as const;
export const coolingEquipmentGroups = [
  { id: "technology", title: "Primary technology equipment" },
  { id: "heat_rejection", title: "Facility heat-rejection equipment" },
  { id: "residual_air", title: "Residual-air equipment" },
] as const;

export const siteSections: SiteSection[] = [
  {
    id: "project",
    title: "Project",
    description: "Name, location, and load",
    questions: [
      {
        key: "project_name",
        label: "Analysis name",
        hint: "Planning name only.",
      },
      {
        key: "location",
        label: "Site location",
        hint: "City, state, country.",
      },
      {
        key: "target_it_mw",
        label: "Target IT load (MW)",
        hint: "Day-1 planning load.",
      },
      {
        key: "objective",
        label: "Primary objective",
        hint: "What the site should optimize.",
        options: [
          "Speed to power",
          "Lowest operating cost",
          "Highest availability",
          "Balanced feasibility",
        ],
      },
    ],
  },
  {
    id: "sources",
    title: "Sources",
    description: "Documents and evidence",
    questions: [
      {
        key: "rfp_status",
        label: "RFP / basis status",
        hint: "Upload CSV below or use Documents for controlled source files.",
        options: [
          "No document yet",
          "RFP available",
          "Site plan available",
          "Utility correspondence available",
        ],
      },
      {
        key: "source_confidence",
        label: "Input confidence",
        hint: "Planning quality only.",
        options: [
          "Early estimate",
          "Broker / vendor supplied",
          "Owner confirmed",
          "Controlled evidence",
        ],
      },
    ],
  },
  {
    id: "workload",
    title: "Workload and platform",
    description: "Technology and scaling basis",
    questions: [
      {
        key: "platform",
        label: "Technology platform",
        hint: "Profile stays provisional until vendor evidence is linked.",
        options: [
          "NVIDIA GB300 NVL72",
          "NVIDIA GB200 NVL72",
          "AMD Instinct",
          "Capacity-only / not fixed",
        ],
      },
      {
        key: "workload",
        label: "Primary workload",
        hint: "Drives density, cooling, and fabric planning.",
        options: [
          "Training",
          "Inference",
          "Mixed / high-performance computing",
        ],
      },
      {
        key: "growth_basis",
        label: "Growth basis",
        hint: "How capacity should phase.",
        options: ["Single phase", "Two phases", "Expandable campus"],
      },
    ],
  },
  {
    id: "racks",
    title: "Rack plan",
    description: "Only the counts you know",
    questions: [
      {
        key: "rack_count",
        label: "Initial rack count",
        hint: "Use a rounded planning count.",
      },
      {
        key: "rack_kw",
        label: "Typical rack load (kW)",
        hint: "Planning average, not an OEM approval.",
      },
      {
        key: "rack_density",
        label: "High-density rack share",
        hint: "Share requiring liquid cooling.",
      },
    ],
  },
  {
    id: "campus",
    title: "Campus and buildings",
    description: "Building alternatives and storeys",
    questions: [
      {
        key: "building_count",
        label: "Data-hall buildings",
        hint: "Initial campus arrangement.",
      },
      {
        key: "storeys",
        label: "Data-hall storeys",
        hint: "Per building, if known.",
      },
      {
        key: "building_layout",
        label: "Layout family",
        hint: "Planning configuration.",
        options: [
          "Single-storey halls",
          "Multi-storey campus",
          "Modular / phased",
          "Existing shell retrofit",
        ],
      },
    ],
  },
  {
    id: "site_fit",
    title: "Site fit",
    description: "Parcel, envelope, and constraints",
    questions: [
      {
        key: "parcel_acres",
        label: "Parcel area (acres)",
        hint: "Approximate site control area.",
      },
      {
        key: "site_condition",
        label: "Site condition",
        hint: "Development context.",
        options: [
          "Greenfield",
          "Brownfield",
          "Live site expansion",
          "Powered shell",
        ],
      },
      {
        key: "constraint",
        label: "Primary constraint",
        hint: "The constraint that matters most today.",
      },
    ],
  },
  {
    id: "power",
    title: "Power",
    description: "Grid, hybrid, BTM, and PUE",
    questions: [
      {
        key: "utility_mw",
        label: "Utility capacity available (MW)",
        hint: "Planning value; confirm with utility evidence.",
      },
      {
        key: "power_architecture",
        label: "Power architecture",
        hint: "Source configuration.",
        options: [
          "Grid primary",
          "Grid + BTM generation",
          "Grid + battery",
          "Hybrid / microgrid",
        ],
      },
      {
        key: "pue_target",
        label: "PUE target",
        hint: "Planning target, not a guarantee.",
      },
    ],
  },
  {
    id: "availability",
    title: "Availability",
    description: "Maintenance and failure outcomes",
    questions: [
      {
        key: "availability_target",
        label: "Availability target",
        hint: "Required resilience outcome.",
        options: ["N+1", "2N", "Tier III-aligned", "Not fixed"],
      },
      {
        key: "maintenance_basis",
        label: "Maintenance basis",
        hint: "How concurrent maintenance should be handled.",
        options: [
          "Concurrent maintenance",
          "Planned outage window",
          "To be defined",
        ],
      },
    ],
  },
  {
    id: "cooling",
    title: "Cooling",
    description: "Architecture, temperatures, and water",
    questions: [
      {
        key: "cooling_architecture",
        label: "Cooling architecture",
        hint: "Normal heat path planning basis.",
        options: [
          "Auto / climate-led",
          "DLC + dry cooler",
          "Hybrid DLC + air",
          "Air-cooled chiller",
          "Immersion",
        ],
      },
      {
        key: "water_source",
        label: "Water source",
        hint: "Availability and treatment remain to be evidenced.",
        options: [
          "Municipal",
          "Reclaimed water",
          "Limited / dry cooling",
          "Unknown",
        ],
      },
      {
        key: "coolant_supply_c",
        label: "Technology coolant supply (°C)",
        hint: "Use a planning temperature only.",
      },
    ],
  },
  {
    id: "building_systems",
    title: "Building systems",
    description: "Layout, placement, yard, and roof",
    questions: [
      {
        key: "building_layout_family",
        label: "Which building layout family should be used?",
        hint: "Controls compartmentation, shell geometry, flow paths, and equipment distribution.",
        options: [
          "Single Volume Open",
          "Skid Max",
          "Single Volume Closed",
          "Stacked Open",
          "Stacked and partitioned",
          "Linear",
          "Wide-Footprint",
        ],
      },
      {
        key: "module_compartmentation",
        label: "How should modules be compartmented?",
        hint: "Compartmentation changes fault domains, fire strategy, operations, cost, and expandability.",
        options: [
          "Open modules",
          "Compartmented modules",
          "Fault-domain compartmentation",
        ],
      },
      {
        key: "module_electrical_placement",
        label: "Where should module electrical equipment be placed?",
        hint: "Placement changes shell length, service access, cable routes, and operating clearances.",
        options: [
          "Operations-aware automatic placement",
          "North and south equipment rows",
          "East and west hall banks",
        ],
      },
      {
        key: "yard_strategy",
        label: "Equipment yard strategy",
        hint: "Outdoor placement basis.",
        options: [
          "Dedicated north yard",
          "Side yard",
          "Roof-mounted",
          "To be studied",
        ],
      },
      {
        key: "heat_rejection",
        label: "Heat rejection location",
        hint: "Preliminary placement only.",
      },
      {
        key: "structural_basis",
        label: "Structural basis",
        hint: "Primary structural constraint.",
      },
    ],
  },
  {
    id: "network",
    title: "Network and storage",
    description: "Fabrics, carriers, and storage",
    questions: [
      {
        key: "fabric",
        label: "Compute fabric",
        hint: "Planning fabric basis.",
        options: ["InfiniBand", "Ethernet fabric", "Mixed", "Not fixed"],
      },
      {
        key: "carrier_count",
        label: "Carrier diversity",
        hint: "Number of physically diverse entries.",
      },
      {
        key: "storage",
        label: "Storage basis",
        hint: "Initial workload storage approach.",
      },
    ],
  },
  {
    id: "logistics",
    title: "Logistics",
    description: "Delivery, staging, and structure",
    questions: [
      {
        key: "staging",
        label: "Staging area",
        hint: "Indoor or outdoor receiving basis.",
      },
      {
        key: "access_constraint",
        label: "Oversize delivery constraint",
        hint: "Bridge, turn, route, or site access concern.",
      },
      {
        key: "procurement_strategy",
        label: "Procurement strategy",
        hint: "Planning approach.",
        options: [
          "Long-lead first",
          "Phased procurement",
          "Owner-furnished IT",
          "EPC-led",
        ],
      },
    ],
  },
  {
    id: "controls",
    title: "Controls and security",
    description: "Telemetry, cyber, and physical security",
    questions: [
      {
        key: "telemetry",
        label: "Telemetry integration",
        hint: "Initial monitoring interface.",
        options: ["BMS + DCIM", "DCIM only", "Owner platform", "Not fixed"],
      },
      {
        key: "security_level",
        label: "Physical security level",
        hint: "Planning posture.",
        options: [
          "Standard enterprise",
          "High security",
          "Critical infrastructure",
          "To be defined",
        ],
      },
      {
        key: "data_retention",
        label: "Operational data retention",
        hint: "Target retention period.",
      },
    ],
  },
  {
    id: "schedule",
    title: "Schedule and commissioning",
    description: "RFS, procurement, and acceptance",
    questions: [
      {
        key: "rfs_date",
        label: "Ready-for-service target",
        hint: "Target month or date.",
      },
      {
        key: "commissioning_basis",
        label: "Acceptance basis",
        hint: "Commissioning intent.",
        options: [
          "IST / integrated systems test",
          "Factory + site acceptance",
          "Owner-defined",
          "To be defined",
        ],
      },
      {
        key: "long_lead",
        label: "Primary long-lead concern",
        hint: "Known equipment risk.",
      },
    ],
  },
  {
    id: "commercial",
    title: "Commercial responsibilities",
    description: "Ownership, alternates, and handover",
    questions: [
      {
        key: "delivery_model",
        label: "Delivery model",
        hint: "Planning commercial responsibility.",
        options: ["EPC", "Multi-prime", "Owner-managed", "Developer + EPC"],
      },
      {
        key: "budget_usd_mw",
        label: "Planning budget (USD/MW)",
        hint: "Canonical planning currency.",
      },
      {
        key: "handover_owner",
        label: "Handover authority",
        hint: "Responsible role or organization.",
      },
    ],
  },
  {
    id: "review",
    title: "Review",
    description: "Confirm once and generate",
    questions: [
      {
        key: "review_owner",
        label: "Analysis owner",
        hint: "Who confirms the planning contract.",
      },
      {
        key: "review_status",
        label: "Review decision",
        hint: "Only confirmed values may be used as approved inputs.",
        options: [
          "Draft — assumptions remain open",
          "Ready for stakeholder review",
          "Confirmed planning basis",
        ],
      },
    ],
  },
];

export const demoSiteAnswers: SiteAnswerMap = {
  project_name: "Anthropic Virginia AI Campus — Demo",
  location: "Loudoun County, Virginia, USA",
  target_it_mw: "24",
  objective: "Balanced feasibility",
  rfp_status: "No document yet",
  source_confidence: "Early estimate",
  platform: "NVIDIA GB300 NVL72",
  workload: "Mixed / high-performance computing",
  growth_basis: "Two phases",
  rack_count: "240",
  rack_kw: "85",
  rack_density: "80%",
  building_count: "2",
  storeys: "1",
  building_layout: "Modular / phased",
  parcel_acres: "38",
  site_condition: "Greenfield",
  constraint: "Utility interconnection timing",
  utility_mw: "36",
  power_architecture: "Grid + battery",
  pue_target: "1.28",
  availability_target: "N+1",
  maintenance_basis: "Concurrent maintenance",
  cooling_architecture: "Hybrid DLC + air",
  water_source: "Limited / dry cooling",
  coolant_supply_c: "32",
  yard_strategy: "Dedicated north yard",
  heat_rejection: "North equipment yard",
  structural_basis: "High-density equipment pads",
  fabric: "InfiniBand",
  carrier_count: "2",
  storage: "High-throughput parallel storage",
  staging: "Outdoor laydown + enclosed receiving",
  access_constraint: "Oversize transformer route confirmation",
  procurement_strategy: "Long-lead first",
  telemetry: "BMS + DCIM",
  security_level: "Critical infrastructure",
  data_retention: "12 months",
  rfs_date: "Q4 2028",
  commissioning_basis: "IST / integrated systems test",
  long_lead: "Transformers and switchgear",
  delivery_model: "Developer + EPC",
  budget_usd_mw: "7000000",
  handover_owner: "Owner commissioning authority",
  review_owner: "Project development lead",
  review_status: "Draft — assumptions remain open",
};
