import { g as getDefaultExportFromCjs, r as reactExports, R as React } from './index-DXoxJAVw.js';

var jsxRuntime$2 = {exports: {}};

var reactJsxRuntime_production = {};

/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var hasRequiredReactJsxRuntime_production;

function requireReactJsxRuntime_production () {
	if (hasRequiredReactJsxRuntime_production) return reactJsxRuntime_production;
	hasRequiredReactJsxRuntime_production = 1;
	"use strict";
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"),
	  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
	  var key = null;
	  void 0 !== maybeKey && (key = "" + maybeKey);
	  void 0 !== config.key && (key = "" + config.key);
	  if ("key" in config) {
	    maybeKey = {};
	    for (var propName in config)
	      "key" !== propName && (maybeKey[propName] = config[propName]);
	  } else maybeKey = config;
	  config = maybeKey.ref;
	  return {
	    $$typeof: REACT_ELEMENT_TYPE,
	    type: type,
	    key: key,
	    ref: void 0 !== config ? config : null,
	    props: maybeKey
	  };
	}
	reactJsxRuntime_production.Fragment = REACT_FRAGMENT_TYPE;
	reactJsxRuntime_production.jsx = jsxProd;
	reactJsxRuntime_production.jsxs = jsxProd;
	return reactJsxRuntime_production;
}

var jsxRuntime$1 = jsxRuntime$2.exports;

var hasRequiredJsxRuntime;

function requireJsxRuntime () {
	if (hasRequiredJsxRuntime) return jsxRuntime$2.exports;
	hasRequiredJsxRuntime = 1;
	"use strict";
	if (true) {
	  jsxRuntime$2.exports = requireReactJsxRuntime_production();
	} else {
	  module.exports = require("./cjs/react-jsx-runtime.development.js");
	}
	return jsxRuntime$2.exports;
}

var jsxRuntimeExports = requireJsxRuntime();
const jsxRuntime = /*@__PURE__*/getDefaultExportFromCjs(jsxRuntimeExports);

const EVENT_TYPES = [
  "conversation",
  "confession",
  "argument",
  "negotiation",
  "discovery",
  "secret_shared",
  "secret_revealed",
  "emotional",
  "emotionally_intimate",
  "supportive",
  "rejection",
  "comfort",
  "apology",
  "forgiveness",
  "laugh",
  "gift",
  "compliment",
  "tease",
  "flirt",
  "date",
  "i_love_you",
  "sleepover",
  "shared_meal",
  "shared_activity",
  "intimate_touch",
  "intimate_kiss",
  "intimate_embrace",
  "intimate_heated",
  "intimate_foreplay",
  "intimate_oral",
  "intimate_manual",
  "intimate_penetrative",
  "intimate_climax",
  "action",
  "combat",
  "danger",
  "decision",
  "promise",
  "betrayal",
  "lied",
  "exclusivity",
  "marriage",
  "pregnancy",
  "childbirth",
  "social",
  "achievement",
  "helped",
  "common_interest",
  "outing",
  "defended",
  "crisis_together",
  "vulnerability",
  "shared_vulnerability",
  "entrusted"
];
const EVENT_TYPE_GROUPS = {
  conversation: ["conversation", "confession", "argument", "negotiation"],
  discovery: ["discovery", "secret_shared", "secret_revealed"],
  emotional: [
    "emotional",
    "emotionally_intimate",
    "supportive",
    "rejection",
    "comfort",
    "apology",
    "forgiveness"
  ],
  bonding: [
    "laugh",
    "gift",
    "compliment",
    "tease",
    "flirt",
    "date",
    "i_love_you",
    "sleepover",
    "shared_meal",
    "shared_activity"
  ],
  intimacy_romantic: [
    "intimate_touch",
    "intimate_kiss",
    "intimate_embrace",
    "intimate_heated"
  ],
  intimacy_sexual: [
    "intimate_foreplay",
    "intimate_oral",
    "intimate_manual",
    "intimate_penetrative",
    "intimate_climax"
  ],
  action: ["action", "combat", "danger"],
  commitment: ["decision", "promise", "betrayal", "lied"],
  life_events: ["exclusivity", "marriage", "pregnancy", "childbirth"],
  social: ["social", "achievement"],
  support: [
    "helped",
    "common_interest",
    "outing",
    "defended",
    "crisis_together",
    "vulnerability",
    "shared_vulnerability",
    "entrusted"
  ]
};
const OUTFIT_SLOTS = [
  "head",
  "neck",
  "jacket",
  "back",
  "torso",
  "legs",
  "footwear",
  "socks",
  "underwear"
];
function isInitialTimeEvent(event) {
  return event.kind === "time_initial";
}
function isTimeEvent(event) {
  return event.kind === "time";
}
function isLocationEvent(event) {
  return event.kind === "location";
}
function isCharacterEvent(event) {
  return event.kind === "character";
}
function isLocationMovedEvent(event) {
  return event.kind === "location" && event.subkind === "moved";
}
function isLocationPropEvent(event) {
  return event.kind === "location" && (event.subkind === "prop_added" || event.subkind === "prop_removed");
}
function isForecastGeneratedEvent(event) {
  return event.kind === "forecast_generated";
}
function isRelationshipEvent(event) {
  return event.kind === "relationship";
}
const NARRATIVE_STATE_VERSION = 4;
const TENSION_LEVELS = [
  "relaxed",
  "aware",
  "guarded",
  "tense",
  "charged",
  "volatile",
  "explosive"
];
const TENSION_TYPES = [
  "confrontation",
  "intimate",
  "vulnerable",
  "celebratory",
  "negotiation",
  "suspense",
  "conversation"
];
const RELATIONSHIP_STATUSES = [
  "strangers",
  "acquaintances",
  "friendly",
  "close",
  "intimate",
  "strained",
  "hostile",
  "complicated"
];
const MILESTONE_TYPES = [
  // Relationship firsts
  "first_meeting",
  "first_conflict",
  "first_alliance",
  // Emotional
  "confession",
  "emotional_intimacy",
  // Bonding (friendly gate)
  "first_laugh",
  "first_gift",
  "first_date",
  "first_i_love_you",
  "first_sleepover",
  "first_shared_meal",
  "first_shared_activity",
  "first_compliment",
  "first_tease",
  "first_flirt",
  "first_helped",
  "first_common_interest",
  "first_outing",
  // Physical intimacy (granular)
  "first_touch",
  "first_kiss",
  "first_embrace",
  "first_heated",
  // Sexual milestones (atomic)
  "first_foreplay",
  "first_oral",
  "first_manual",
  "first_penetrative",
  "first_climax",
  // Life commitment
  "promised_exclusivity",
  "marriage",
  "pregnancy",
  "had_child",
  // Trust & commitment (close gate)
  "promise_made",
  "promise_broken",
  "betrayal",
  "reconciliation",
  "sacrifice",
  "first_support",
  "first_comfort",
  "defended",
  "crisis_together",
  "first_vulnerability",
  "trusted_with_task",
  // Secrets
  "secret_shared",
  "secret_revealed",
  // Conflicts
  "major_argument",
  "major_reconciliation"
];
function isDerivedChapter(chapter) {
  return "eventIds" in chapter && Array.isArray(chapter.eventIds);
}
function isLegacyChapter(chapter) {
  return "events" in chapter && Array.isArray(chapter.events);
}
function isDerivedRelationship(relationship) {
  return "milestoneEventIds" in relationship;
}
function isLegacyRelationship(relationship) {
  return "milestones" in relationship && Array.isArray(relationship.milestones);
}
function isProjectedRelationship(relationship) {
  return !("milestones" in relationship) && !("milestoneEventIds" in relationship);
}
function isUnifiedEventStore(store) {
  return store !== void 0 && "stateEvents" in store;
}
function isLegacyEventStore(store) {
  return store !== void 0 && "events" in store && !("stateEvents" in store);
}
const EVENT_TYPE_TO_MILESTONE = {
  // Bonding (friendly gate)
  laugh: "first_laugh",
  gift: "first_gift",
  date: "first_date",
  i_love_you: "first_i_love_you",
  sleepover: "first_sleepover",
  shared_meal: "first_shared_meal",
  shared_activity: "first_shared_activity",
  compliment: "first_compliment",
  tease: "first_tease",
  flirt: "first_flirt",
  helped: "first_helped",
  common_interest: "first_common_interest",
  outing: "first_outing",
  // Physical intimacy
  intimate_touch: "first_touch",
  intimate_kiss: "first_kiss",
  intimate_embrace: "first_embrace",
  intimate_heated: "first_heated",
  // Sexual milestones (atomic)
  intimate_foreplay: "first_foreplay",
  intimate_oral: "first_oral",
  intimate_manual: "first_manual",
  intimate_penetrative: "first_penetrative",
  intimate_climax: "first_climax",
  // Emotional (close gate mappings)
  emotionally_intimate: "emotional_intimacy",
  confession: "confession",
  secret_shared: "secret_shared",
  secret_revealed: "secret_revealed",
  supportive: "first_support",
  comfort: "first_comfort",
  forgiveness: "reconciliation",
  defended: "defended",
  crisis_together: "crisis_together",
  shared_vulnerability: "first_vulnerability",
  entrusted: "trusted_with_task",
  // Commitment
  promise: "promise_made",
  betrayal: "betrayal",
  // Life events
  exclusivity: "promised_exclusivity",
  marriage: "marriage",
  pregnancy: "pregnancy",
  childbirth: "had_child",
  // Conflicts
  argument: "first_conflict",
  combat: "first_conflict"
};

const TENSION_TYPE_ICONS = {
  conversation: "fa-comments",
  confrontation: "fa-burst",
  intimate: "fa-heart",
  suspense: "fa-clock",
  vulnerable: "fa-shield-halved",
  celebratory: "fa-champagne-glasses",
  negotiation: "fa-handshake"
};
const TENSION_LEVEL_ICONS = {
  relaxed: "fa-mug-hot",
  aware: "fa-eye",
  guarded: "fa-shield-halved",
  tense: "fa-face-grimace",
  charged: "fa-bolt",
  volatile: "fa-fire",
  explosive: "fa-explosion"
};
const TENSION_DIRECTION_ICONS = {
  escalating: "fa-arrow-trend-up",
  stable: "fa-grip-lines",
  decreasing: "fa-arrow-trend-down"
};
const WEATHER_ICONS = {
  sunny: "fa-sun",
  cloudy: "fa-cloud",
  snowy: "fa-snowflake",
  rainy: "fa-cloud-rain",
  windy: "fa-wind",
  thunderstorm: "fa-cloud-bolt"
};
function getWeatherIcon(weather) {
  return WEATHER_ICONS[weather] ?? "fa-question";
}
const CONDITION_ICONS = {
  clear: "fa-moon",
  sunny: "fa-sun",
  partly_cloudy: "fa-cloud-sun",
  overcast: "fa-cloud",
  foggy: "fa-smog",
  drizzle: "fa-cloud-rain",
  rain: "fa-cloud-showers-heavy",
  heavy_rain: "fa-cloud-showers-water",
  thunderstorm: "fa-cloud-bolt",
  sleet: "fa-cloud-meatball",
  snow: "fa-snowflake",
  heavy_snow: "fa-snowflake",
  blizzard: "fa-icicles",
  windy: "fa-wind",
  hot: "fa-temperature-high",
  cold: "fa-temperature-low",
  humid: "fa-droplet"
};
function getConditionIcon(condition) {
  return CONDITION_ICONS[condition] ?? "fa-question";
}
const TENSION_TYPE_COLORS = {
  conversation: "#6b7280",
  // gray-500
  confrontation: "#ef4444",
  // red-500
  intimate: "#ec4899",
  // pink-500
  suspense: "#8b5cf6",
  // violet-500
  vulnerable: "#06b6d4",
  // cyan-500
  celebratory: "#eab308",
  // yellow-500
  negotiation: "#f97316"
  // orange-500
};
const TENSION_LEVEL_COLORS = {
  relaxed: "#6b7280",
  // gray-500
  aware: "#3b82f6",
  // blue-500
  guarded: "#22c55e",
  // green-500
  tense: "#f59e0b",
  // amber-500
  charged: "#f97316",
  // orange-500
  volatile: "#ef4444",
  // red-500
  explosive: "#dc2626"
  // red-600
};
function getTensionIcon(type) {
  return `fa-solid ${TENSION_TYPE_ICONS[type] || "fa-circle"}`;
}
function getTensionLevelIcon(level) {
  return `fa-solid ${TENSION_LEVEL_ICONS[level] || "fa-circle"}`;
}
function getTensionTypeColor(type) {
  return TENSION_TYPE_COLORS[type] || "#6b7280";
}
function getTensionColor(level) {
  return TENSION_LEVEL_COLORS[level] || "#6b7280";
}
const TENSION_LEVEL_VALUES = {
  relaxed: 1,
  aware: 2,
  guarded: 3,
  tense: 4,
  charged: 5,
  volatile: 6,
  explosive: 7
};
function getTensionValue(level) {
  return TENSION_LEVEL_VALUES[level] || 1;
}
const EVENT_TYPE_ICONS = {
  // Conversation
  conversation: "fa-comments",
  confession: "fa-heart-circle-exclamation",
  argument: "fa-comment-slash",
  negotiation: "fa-handshake",
  // Discovery
  discovery: "fa-lightbulb",
  secret_shared: "fa-user-secret",
  secret_revealed: "fa-mask",
  // Emotional
  emotional: "fa-face-smile-beam",
  emotionally_intimate: "fa-heart-circle-check",
  supportive: "fa-hand-holding-heart",
  rejection: "fa-hand",
  comfort: "fa-hands-holding",
  apology: "fa-hands-praying",
  forgiveness: "fa-dove",
  // Bonding
  laugh: "fa-face-laugh-beam",
  gift: "fa-gift",
  compliment: "fa-face-grin-stars",
  tease: "fa-face-grin-tongue",
  flirt: "fa-face-grin-wink",
  date: "fa-champagne-glasses",
  i_love_you: "fa-heart-circle-check",
  sleepover: "fa-bed",
  shared_meal: "fa-utensils",
  shared_activity: "fa-gamepad",
  // Romantic Intimacy
  intimate_touch: "fa-hand-holding-hand",
  intimate_kiss: "fa-face-kiss-wink-heart",
  intimate_embrace: "fa-people-pulling",
  intimate_heated: "fa-fire",
  // Sexual Activity
  intimate_foreplay: "fa-fire-flame-curved",
  intimate_oral: "fa-face-kiss-beam",
  intimate_manual: "fa-hand-sparkles",
  intimate_penetrative: "fa-heart",
  intimate_climax: "fa-star",
  // Action
  action: "fa-person-running",
  combat: "fa-hand-fist",
  danger: "fa-skull",
  // Commitment
  decision: "fa-scale-balanced",
  promise: "fa-handshake-angle",
  betrayal: "fa-face-angry",
  lied: "fa-face-grimace",
  // Life Events
  exclusivity: "fa-lock",
  marriage: "fa-ring",
  pregnancy: "fa-baby",
  childbirth: "fa-baby-carriage",
  // Social
  social: "fa-users",
  achievement: "fa-trophy",
  // Support & Protection
  helped: "fa-hands-helping",
  common_interest: "fa-puzzle-piece",
  outing: "fa-map-location-dot",
  defended: "fa-shield-halved",
  crisis_together: "fa-person-shelter",
  vulnerability: "fa-heart-crack",
  shared_vulnerability: "fa-hand-holding-heart",
  entrusted: "fa-key"
};
const EVENT_TYPE_COLORS = {
  // Conversation - grays/blues
  conversation: "#6b7280",
  confession: "#ec4899",
  argument: "#ef4444",
  negotiation: "#f59e0b",
  // Discovery - yellows
  discovery: "#eab308",
  secret_shared: "#8b5cf6",
  secret_revealed: "#a855f7",
  // Emotional - cyans
  emotional: "#06b6d4",
  emotionally_intimate: "#ec4899",
  // pink-500 - milestone-worthy
  supportive: "#22d3ee",
  rejection: "#f43f5e",
  comfort: "#14b8a6",
  // teal-500
  apology: "#a78bfa",
  // violet-400
  forgiveness: "#34d399",
  // emerald-400
  // Bonding - warm greens and oranges
  laugh: "#facc15",
  // yellow-400
  gift: "#f472b6",
  // pink-400
  compliment: "#fbbf24",
  // amber-400
  tease: "#fb923c",
  // orange-400
  flirt: "#f87171",
  // red-400
  date: "#a78bfa",
  // violet-400
  i_love_you: "#f43f5e",
  // rose-500
  sleepover: "#818cf8",
  // indigo-400
  shared_meal: "#4ade80",
  // green-400
  shared_activity: "#60a5fa",
  // blue-400
  // Romantic Intimacy - pinks
  intimate_touch: "#fda4af",
  intimate_kiss: "#fb7185",
  intimate_embrace: "#f472b6",
  intimate_heated: "#ec4899",
  // Sexual Activity - deeper pinks/magentas
  intimate_foreplay: "#db2777",
  intimate_oral: "#be185d",
  intimate_manual: "#9d174d",
  intimate_penetrative: "#831843",
  intimate_climax: "#701a75",
  // Action - blues/reds
  action: "#3b82f6",
  combat: "#dc2626",
  danger: "#991b1b",
  // Commitment - purples/oranges
  decision: "#8b5cf6",
  promise: "#22c55e",
  betrayal: "#b91c1c",
  lied: "#f97316",
  // orange-500
  // Life Events - golds/teals
  exclusivity: "#0d9488",
  // teal-600
  marriage: "#d97706",
  // amber-600
  pregnancy: "#ec4899",
  // pink-500
  childbirth: "#8b5cf6",
  // violet-500
  // Social - greens
  social: "#22c55e",
  achievement: "#f59e0b",
  // Support & Protection - teals/blues
  helped: "#14b8a6",
  // teal-500
  common_interest: "#06b6d4",
  // cyan-500
  outing: "#3b82f6",
  // blue-500
  defended: "#6366f1",
  // indigo-500
  crisis_together: "#ef4444",
  // red-500
  vulnerability: "#a855f7",
  // purple-500
  shared_vulnerability: "#d946ef",
  // fuchsia-500 - milestone-worthy
  entrusted: "#f59e0b"
  // amber-500
};
const EVENT_TYPE_PRIORITY = [
  // Life events take highest priority (rare, significant)
  "childbirth",
  "marriage",
  "pregnancy",
  "exclusivity",
  // Sexual activity takes visual priority (highest intensity first)
  "intimate_climax",
  "intimate_penetrative",
  "intimate_oral",
  "intimate_manual",
  "intimate_foreplay",
  // Then romantic intimacy
  "intimate_heated",
  "intimate_kiss",
  "intimate_embrace",
  "intimate_touch",
  // Then high-drama events
  "crisis_together",
  "combat",
  "danger",
  "defended",
  "betrayal",
  "confession",
  "argument",
  // Then emotional/discovery
  "emotionally_intimate",
  "shared_vulnerability",
  "emotional",
  "comfort",
  "apology",
  "forgiveness",
  "secret_revealed",
  "secret_shared",
  "discovery",
  // Then decisions
  "decision",
  "promise",
  "rejection",
  // Then bonding/social
  "i_love_you",
  "date",
  "sleepover",
  "gift",
  "laugh",
  "compliment",
  "flirt",
  "tease",
  "shared_meal",
  "shared_activity",
  // Then social/support
  "supportive",
  "vulnerability",
  // General vulnerability (not milestone)
  "entrusted",
  "helped",
  "common_interest",
  "outing",
  "achievement",
  "social",
  "negotiation",
  // Default
  "conversation",
  "action"
];
function getPrimaryEventType(types) {
  for (const priority of EVENT_TYPE_PRIORITY) {
    if (types.includes(priority)) return priority;
  }
  return types[0] || "conversation";
}
function getEventTypeIcon(type) {
  return `fa-solid ${EVENT_TYPE_ICONS[type] || "fa-circle"}`;
}
function getEventTypeColor(type) {
  return EVENT_TYPE_COLORS[type] || "#6b7280";
}
const CHARACTER_SUBKIND_ICONS = {
  appeared: "fa-user-plus",
  departed: "fa-user-minus",
  mood_added: "fa-face-smile",
  mood_removed: "fa-face-meh",
  outfit_changed: "fa-shirt",
  position_changed: "fa-arrows-up-down-left-right",
  activity_changed: "fa-person-running",
  physical_state_added: "fa-heart-pulse",
  physical_state_removed: "fa-heart"
};
const STATE_EVENT_KIND_ICONS = {
  time: "fa-clock",
  time_initial: "fa-hourglass-start",
  location: "fa-location-dot",
  location_prop: "fa-couch",
  character: "fa-user",
  relationship: "fa-heart-circle-check"
};
const STATE_EVENT_COLORS = {
  add: "#22c55e",
  // green - appeared, mood_added, physical_state_added
  remove: "#ef4444",
  // red - departed, mood_removed, physical_state_removed
  change: "#3b82f6",
  // blue - position, activity, outfit changes
  time: "#8b5cf6",
  // purple
  location: "#f59e0b"
  // amber
};
function getCharacterEventColor(subkind) {
  if (["appeared", "mood_added", "physical_state_added"].includes(subkind)) {
    return STATE_EVENT_COLORS.add;
  }
  if (["departed", "mood_removed", "physical_state_removed"].includes(subkind)) {
    return STATE_EVENT_COLORS.remove;
  }
  return STATE_EVENT_COLORS.change;
}
function getCharacterSubkindIcon(subkind) {
  return `fa-solid ${CHARACTER_SUBKIND_ICONS[subkind] || "fa-circle"}`;
}
function getStateEventKindIcon(kind) {
  return `fa-solid ${STATE_EVENT_KIND_ICONS[kind] || "fa-circle"}`;
}
function formatSubkindLabel(subkind) {
  return subkind.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
const RELATIONSHIP_SUBKIND_ICONS = {
  feeling_added: "fa-heart-circle-plus",
  feeling_removed: "fa-heart-circle-minus",
  secret_added: "fa-user-secret",
  secret_removed: "fa-mask",
  want_added: "fa-star",
  want_removed: "fa-star-half-stroke",
  status_changed: "fa-people-arrows"
};
const RELATIONSHIP_SUBKIND_COLORS = {
  feeling_added: "#ec4899",
  // pink-500
  feeling_removed: "#f472b6",
  // pink-400
  secret_added: "#8b5cf6",
  // violet-500
  secret_removed: "#a78bfa",
  // violet-400
  want_added: "#f59e0b",
  // amber-500
  want_removed: "#fbbf24",
  // amber-400
  status_changed: "#3b82f6"
  // blue-500
};
function getRelationshipSubkindIcon(subkind) {
  return `fa-solid ${RELATIONSHIP_SUBKIND_ICONS[subkind] || "fa-circle"}`;
}
function getRelationshipEventColor(subkind) {
  return RELATIONSHIP_SUBKIND_COLORS[subkind] || "#6b7280";
}

function formatMilestoneDate(dt) {
  if (!dt) return "";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const month = months[dt.month - 1] || "Jan";
  return `${month} ${dt.day}, ${dt.year}`;
}
const STATUS_COLORS = {
  strangers: "#6b7280",
  acquaintances: "#3b82f6",
  friendly: "#22c55e",
  close: "#f59e0b",
  intimate: "#ec4899",
  strained: "#f97316",
  hostile: "#ef4444",
  complicated: "#8b5cf6"
};
const STATUS_ICONS = {
  strangers: "fa-user-secret",
  acquaintances: "fa-handshake",
  friendly: "fa-users",
  close: "fa-user-group",
  intimate: "fa-heart",
  strained: "fa-face-frown",
  hostile: "fa-skull",
  complicated: "fa-question"
};
function ProjectedRelationshipDisplay({
  relationship,
  milestones = []
}) {
  const [char1, char2] = relationship.pair;
  const statusColor = STATUS_COLORS[relationship.status] || "#6b7280";
  const statusIcon = STATUS_ICONS[relationship.status] || "fa-circle";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projected-relationship", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projection-section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { children: "Status" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: "bt-relationship-status-display",
          style: { color: statusColor },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: `fa-solid ${statusIcon}` }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: relationship.status })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projection-section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
        char1,
        " → ",
        char2
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-display", children: [
        relationship.aToB.feelings.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Feels:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.feelings.join(
            ", "
          ) })
        ] }),
        relationship.aToB.wants.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Wants:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.wants.join(", ") })
        ] }),
        relationship.aToB.secrets.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Secrets:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.secrets.join(
            ", "
          ) })
        ] }),
        relationship.aToB.feelings.length === 0 && relationship.aToB.wants.length === 0 && relationship.aToB.secrets.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-empty-attitude", children: "No data" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projection-section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
        char2,
        " → ",
        char1
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-display", children: [
        relationship.bToA.feelings.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Feels:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.feelings.join(
            ", "
          ) })
        ] }),
        relationship.bToA.wants.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Wants:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.wants.join(", ") })
        ] }),
        relationship.bToA.secrets.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Secrets:" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.secrets.join(
            ", "
          ) })
        ] }),
        relationship.bToA.feelings.length === 0 && relationship.bToA.wants.length === 0 && relationship.bToA.secrets.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-empty-attitude", children: "No data" })
      ] })
    ] }),
    milestones.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projection-section", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("h4", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-star" }),
        " Milestones"
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "bt-milestones-list", children: milestones.map((m, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-milestone-type", children: m.type.replace(/_/g, " ") }),
        m.description && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-milestone-desc", children: [
          " ",
          "- ",
          m.description
        ] })
      ] }, m.eventId || i)) })
    ] })
  ] });
}
function RelationshipStateEventCard({
  event,
  index,
  editMode,
  onUpdate,
  onDelete
}) {
  const [isEditing, setIsEditing] = reactExports.useState(false);
  const [editValue, setEditValue] = reactExports.useState(event.value ?? "");
  const [editStatus, setEditStatus] = reactExports.useState(
    event.newStatus ?? "acquaintances"
  );
  const iconClass = getRelationshipSubkindIcon(event.subkind);
  const iconColor = getRelationshipEventColor(event.subkind);
  const isStatusEvent = event.subkind === "status_changed";
  const directionDisplay = event.fromCharacter && event.towardCharacter ? `${event.fromCharacter} → ${event.towardCharacter}` : null;
  const handleSave = () => {
    if (onUpdate) {
      if (isStatusEvent) {
        onUpdate({ newStatus: editStatus });
      } else {
        onUpdate({ value: editValue });
      }
    }
    setIsEditing(false);
  };
  const handleCancel = () => {
    setEditValue(event.value ?? "");
    setEditStatus(event.newStatus ?? "acquaintances");
    setIsEditing(false);
  };
  if (isEditing) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: "bt-event-card bt-event-card-editing",
        "data-kind": "relationship",
        style: { "--event-type-color": iconColor },
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-card-content", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-event-index", children: [
                "#",
                index + 1
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "i",
                {
                  className: iconClass,
                  style: { color: iconColor }
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-event-subkind", children: formatSubkindLabel(event.subkind) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-relationship-edit-inline", children: isStatusEvent ? /* @__PURE__ */ jsxRuntimeExports.jsx(
              "select",
              {
                value: editStatus,
                onChange: (e) => setEditStatus(
                  e.target.value
                ),
                className: "bt-status-select",
                children: RELATIONSHIP_STATUSES.map(
                  (status) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "option",
                    {
                      value: status,
                      children: status.charAt(
                        0
                      ).toUpperCase() + status.slice(
                        1
                      )
                    },
                    status
                  )
                )
              }
            ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                type: "text",
                value: editValue,
                onChange: (e) => setEditValue(e.target.value),
                placeholder: "Value...",
                className: "bt-value-input"
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-actions", style: { opacity: 1 }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "bt-action-btn",
                onClick: handleSave,
                title: "Save",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-check" })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "button",
              {
                className: "bt-action-btn",
                onClick: handleCancel,
                title: "Cancel",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-times" })
              }
            )
          ] })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "bt-event-card",
      "data-kind": "relationship",
      style: { "--event-type-color": iconColor },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-card-content", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-header", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-event-index", children: [
              "#",
              index + 1
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: iconClass, style: { color: iconColor } }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-event-subkind", children: formatSubkindLabel(event.subkind) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-details", children: [
            directionDisplay && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-event-direction", children: [
              "(",
              directionDisplay,
              ")"
            ] }),
            event.value && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-event-value", children: [
              '"',
              event.value,
              '"'
            ] }),
            event.newStatus && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-event-status", children: [
              "→ ",
              event.newStatus
            ] })
          ] })
        ] }),
        editMode && (onUpdate || onDelete) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-event-actions", children: [
          onUpdate && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              className: "bt-action-btn",
              onClick: () => setIsEditing(true),
              title: "Edit",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-pen" })
            }
          ),
          onDelete && /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              className: "bt-action-btn delete",
              onClick: onDelete,
              title: "Delete",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-trash" })
            }
          )
        ] })
      ]
    }
  );
}
function RelationshipStateEventsList({
  events,
  editMode,
  onEventUpdate,
  onEventDelete
}) {
  if (events.length === 0) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-events-list-empty", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-ghost" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "No relationship events for this pair" })
    ] });
  }
  const sortedEvents = [...events].sort((a, b) => a.messageId - b.messageId);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-relationship-events-list", children: sortedEvents.map((event, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
    RelationshipStateEventCard,
    {
      event,
      index: idx,
      editMode,
      onUpdate: onEventUpdate ? (updates) => onEventUpdate(
        event.id,
        updates
      ) : void 0,
      onDelete: onEventDelete ? () => onEventDelete(event.id) : void 0
    },
    event.id
  )) });
}
const RELATIONSHIP_EVENT_SUBKINDS = [
  "feeling_added",
  "feeling_removed",
  "secret_added",
  "secret_removed",
  "want_added",
  "want_removed",
  "status_changed"
];
function AddEventForm({ pair, relationship, onAdd, onCancel, chatLength, chat }) {
  const [char1, char2] = pair;
  const [subkind, setSubkind] = reactExports.useState("feeling_added");
  const [direction, setDirection] = reactExports.useState("aToB");
  const [value, setValue] = reactExports.useState("");
  const [newStatus, setNewStatus] = reactExports.useState(relationship.status);
  const maxMessageId = chatLength ? chatLength - 1 : 0;
  const defaultMessageId = Math.max(0, maxMessageId - 1);
  const [messageId, setMessageId] = reactExports.useState(defaultMessageId);
  const messageIdOptions = Array.from({ length: maxMessageId + 1 }, (_, i) => i);
  const fromCharacter = direction === "aToB" ? char1 : char2;
  const towardCharacter = direction === "aToB" ? char2 : char1;
  const currentAttitude = direction === "aToB" ? relationship.aToB : relationship.bToA;
  const isRemovalType = subkind.endsWith("_removed");
  const isStatusChange = subkind === "status_changed";
  const getRemovalItems = () => {
    if (subkind === "feeling_removed") return currentAttitude.feelings;
    if (subkind === "secret_removed") return currentAttitude.secrets;
    if (subkind === "want_removed") return currentAttitude.wants;
    return [];
  };
  const removalItems = getRemovalItems();
  const handleSubmit = () => {
    const swipeId = chat?.[messageId]?.swipe_id ?? 0;
    const event = {
      kind: "relationship",
      subkind,
      pair,
      messageId,
      swipeId,
      timestamp: Date.now()
    };
    if (isStatusChange) {
      event.newStatus = newStatus;
      event.previousStatus = relationship.status;
    } else {
      event.fromCharacter = fromCharacter;
      event.towardCharacter = towardCharacter;
      event.value = value;
    }
    onAdd(event);
  };
  const isValid = isStatusChange || (isRemovalType ? value !== "" : value.trim() !== "");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-add-event-form", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Message" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "select",
        {
          value: messageId,
          onChange: (e) => setMessageId(Number(e.target.value)),
          className: "bt-select",
          children: messageIdOptions.map((id) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: id, children: [
            "Message #",
            id + 1,
            id === maxMessageId && " (Latest)"
          ] }, id))
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Event Type" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "select",
        {
          value: subkind,
          onChange: (e) => {
            setSubkind(
              e.target.value
            );
            setValue("");
          },
          className: "bt-select",
          children: RELATIONSHIP_EVENT_SUBKINDS.map((sk) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: sk, children: formatSubkindLabel(sk) }, sk))
        }
      )
    ] }),
    !isStatusChange && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Direction" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value: direction,
          onChange: (e) => setDirection(
            e.target.value
          ),
          className: "bt-select",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: "aToB", children: [
              char1,
              " → ",
              char2
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: "bToA", children: [
              char2,
              " → ",
              char1
            ] })
          ]
        }
      )
    ] }),
    isStatusChange ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "New Status" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "select",
        {
          value: newStatus,
          onChange: (e) => setNewStatus(
            e.target.value
          ),
          className: "bt-select",
          children: RELATIONSHIP_STATUSES.map((status) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: status, children: status.charAt(0).toUpperCase() + status.slice(1) }, status))
        }
      )
    ] }) : isRemovalType ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Value to Remove" }),
      removalItems.length > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          value,
          onChange: (e) => setValue(e.target.value),
          className: "bt-select",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Select..." }),
            removalItems.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: item, children: item }, item))
          ]
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-no-items", children: "No items to remove" })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-row", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { children: "Value" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "text",
          value,
          onChange: (e) => setValue(e.target.value),
          placeholder: subkind === "feeling_added" ? "e.g., trust, affection" : subkind === "secret_added" ? "e.g., knows their true identity" : "e.g., protection, approval",
          className: "bt-input"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-form-actions", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "bt-btn bt-btn-secondary",
          onClick: onCancel,
          children: "Cancel"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "bt-btn bt-btn-primary",
          onClick: handleSubmit,
          disabled: !isValid,
          children: "Add Event"
        }
      )
    ] })
  ] });
}
function RelationshipCard({
  relationship,
  isExpanded,
  onToggle,
  editMode,
  isEditing,
  onStartEdit,
  onDeleteRelationship,
  stateEvents,
  computedMilestones,
  onStateEventUpdate,
  onStateEventDelete,
  onStateEventAdd,
  chatLength,
  chat
}) {
  const [char1, char2] = relationship.pair;
  const statusColor = STATUS_COLORS[relationship.status] || "#6b7280";
  const statusIcon = STATUS_ICONS[relationship.status] || "fa-circle";
  const [showAddForm, setShowAddForm] = reactExports.useState(false);
  const hasLegacyMilestones = "milestones" in relationship && isLegacyRelationship(relationship) && (relationship.milestones?.length ?? 0) > 0;
  const hasComputedMilestones = computedMilestones && computedMilestones.length > 0;
  const showMilestones = hasComputedMilestones || hasLegacyMilestones || isEditing;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: `bt-relationship-card ${isExpanded ? "bt-expanded" : ""} ${isEditing ? "bt-editing" : ""}`,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: "bt-relationship-header",
            onClick: isEditing ? void 0 : onToggle,
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-relationship-pair", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-char-name", children: char1 }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "i",
                  {
                    className: `fa-solid ${statusIcon}`,
                    style: { color: statusColor }
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-char-name", children: char2 })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "bt-relationship-status",
                  style: { color: statusColor },
                  children: relationship.status
                }
              ),
              editMode && !isEditing && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-relationship-actions", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "bt-edit-btn-small",
                    onClick: (e) => {
                      e.stopPropagation();
                      onStartEdit?.();
                    },
                    title: "Edit relationship",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-pen" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    type: "button",
                    className: "bt-delete-btn-small",
                    onClick: (e) => {
                      e.stopPropagation();
                      onDeleteRelationship?.();
                    },
                    title: "Delete relationship",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-trash" })
                  }
                )
              ] }),
              isEditing && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: "bt-delete-btn-small",
                  onClick: (e) => {
                    e.stopPropagation();
                    onDeleteRelationship?.();
                  },
                  title: "Delete relationship",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-trash" })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "i",
                {
                  className: `fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"} bt-expand-icon`,
                  onClick: isEditing ? onToggle : void 0
                }
              )
            ]
          }
        ),
        isExpanded && isEditing && stateEvents && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-split-editor", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-events-pane", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-events-pane-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-list" }),
                " ",
                "Relationship Events"
              ] }),
              onStateEventAdd && !showAddForm && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "button",
                {
                  type: "button",
                  className: "bt-add-event-btn",
                  onClick: () => setShowAddForm(true),
                  title: "Add new event",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-plus" })
                }
              )
            ] }),
            showAddForm && onStateEventAdd && /* @__PURE__ */ jsxRuntimeExports.jsx(
              AddEventForm,
              {
                pair: relationship.pair,
                relationship,
                onAdd: (event) => {
                  onStateEventAdd(event);
                  setShowAddForm(false);
                },
                onCancel: () => setShowAddForm(false),
                chatLength,
                chat
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              RelationshipStateEventsList,
              {
                events: stateEvents,
                editMode: true,
                onEventUpdate: onStateEventUpdate,
                onEventDelete: onStateEventDelete
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-projection-pane", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("h3", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-eye" }),
              " Current State"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              ProjectedRelationshipDisplay,
              {
                relationship,
                milestones: computedMilestones
              }
            )
          ] })
        ] }),
        isExpanded && !isEditing && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-relationship-details", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-header", children: [
              char1,
              " → ",
              char2
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-content", children: [
              relationship.aToB.feelings.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Feels:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.feelings.join(
                  ", "
                ) })
              ] }),
              relationship.aToB.wants.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Wants:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.wants.join(
                  ", "
                ) })
              ] }),
              relationship.aToB.secrets.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Secrets:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.aToB.secrets.join(
                  ", "
                ) })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-header", children: [
              char2,
              " → ",
              char1
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-content", children: [
              relationship.bToA.feelings.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Feels:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.feelings.join(
                  ", "
                ) })
              ] }),
              relationship.bToA.wants.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Wants:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.wants.join(
                  ", "
                ) })
              ] }),
              relationship.bToA.secrets.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-attitude-row", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-label", children: "Secrets:" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-value", children: relationship.bToA.secrets.join(
                  ", "
                ) })
              ] })
            ] })
          ] }),
          showMilestones && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-milestones-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-milestones-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-star" }),
              " ",
              "Milestones"
            ] }),
            hasComputedMilestones ? /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "bt-milestones-list", children: computedMilestones.map(
              (milestone, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "li",
                {
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-milestone-type", children: milestone.type.replace(
                      /_/g,
                      " "
                    ) }),
                    milestone.description && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-milestone-desc", children: [
                      " ",
                      "-",
                      " ",
                      milestone.description
                    ] })
                  ]
                },
                milestone.eventId || i
              )
            ) }) : "milestones" in relationship && isLegacyRelationship(
              relationship
            ) && hasLegacyMilestones ? /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "bt-milestones-list", children: relationship.milestones.map(
              (milestone, i) => {
                const dateStr = formatMilestoneDate(
                  milestone.timestamp
                );
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "li",
                  {
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-milestone-type", children: milestone.type.replace(
                        /_/g,
                        " "
                      ) }),
                      dateStr && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-milestone-date", children: [
                        " ",
                        "(",
                        dateStr,
                        ")"
                      ] }),
                      milestone.description && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-milestone-desc", children: [
                        " ",
                        "-",
                        " ",
                        milestone.description
                      ] })
                    ]
                  },
                  i
                );
              }
            ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "bt-empty-message", children: "No milestones yet." })
          ] }),
          "history" in relationship && relationship.history.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-history-section", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-history-header", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("i", { className: "fa-solid fa-clock-rotate-left" }),
              " ",
              "History"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "bt-history-list", children: relationship.history.map(
              (snapshot, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-history-chapter", children: [
                  "Ch.",
                  " ",
                  snapshot.chapterIndex + 1,
                  ":"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "bt-history-status", children: snapshot.status }),
                snapshot.summary && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "bt-history-summary", children: [
                  " ",
                  "-",
                  " ",
                  snapshot.summary
                ] })
              ] }, i)
            ) })
          ] })
        ] })
      ]
    }
  );
}
function RelationshipsTab({
  relationships,
  presentCharacters,
  editMode,
  onUpdate,
  hasEventStore,
  getStateEventsForPair,
  computeMilestonesForPair,
  onStateEventUpdate,
  onStateEventDelete,
  onStateEventAdd,
  chatLength,
  chat
}) {
  const [expandedIds, setExpandedIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [filterCharacter, setFilterCharacter] = reactExports.useState("");
  const [editingPairKey, setEditingPairKey] = reactExports.useState(null);
  const allCharacters = reactExports.useMemo(() => {
    const chars = /* @__PURE__ */ new Set();
    for (const rel of relationships) {
      chars.add(rel.pair[0]);
      chars.add(rel.pair[1]);
    }
    return Array.from(chars).sort();
  }, [relationships]);
  const filteredRelationships = reactExports.useMemo(() => {
    if (!filterCharacter) return relationships;
    return relationships.filter(
      (rel) => rel.pair[0].toLowerCase() === filterCharacter.toLowerCase() || rel.pair[1].toLowerCase() === filterCharacter.toLowerCase()
    );
  }, [relationships, filterCharacter]);
  const sortedRelationships = reactExports.useMemo(() => {
    const presentSet = presentCharacters ? new Set(presentCharacters.map((c) => c.toLowerCase())) : null;
    const statusOrder = [
      "intimate",
      "close",
      "friendly",
      "acquaintances",
      "strangers",
      "strained",
      "hostile",
      "complicated"
    ];
    return [...filteredRelationships].sort((a, b) => {
      if (presentSet) {
        const aPresent = a.pair.some((p) => presentSet.has(p.toLowerCase()));
        const bPresent = b.pair.some((p) => presentSet.has(p.toLowerCase()));
        if (aPresent && !bPresent) return -1;
        if (!aPresent && bPresent) return 1;
      }
      const aStatus = statusOrder.indexOf(a.status);
      const bStatus = statusOrder.indexOf(b.status);
      return aStatus - bStatus;
    });
  }, [filteredRelationships, presentCharacters]);
  const toggleExpanded = (pairKey) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pairKey)) {
        next.delete(pairKey);
      } else {
        next.add(pairKey);
      }
      return next;
    });
  };
  const getPairKey = (rel) => rel.pair.join("|");
  const handleStartEdit = (pairKey) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.add(pairKey);
      return next;
    });
    setEditingPairKey(pairKey);
  };
  const handleDeleteRelationship = (pairKey) => {
    if (onUpdate) {
      const newRelationships = relationships.filter(
        (rel) => getPairKey(rel) !== pairKey
      );
      onUpdate(newRelationships);
      if (editingPairKey === pairKey) {
        setEditingPairKey(null);
      }
    }
  };
  React.useEffect(() => {
    if (!editMode) {
      setEditingPairKey(null);
    }
  }, [editMode]);
  if (relationships.length === 0) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-relationships-tab bt-empty", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "No relationships established yet." }) });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-relationships-tab", children: [
    allCharacters.length > 2 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "bt-filter-bar", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { htmlFor: "bt-char-filter", children: "Filter by character:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "select",
        {
          id: "bt-char-filter",
          value: filterCharacter,
          onChange: (e) => setFilterCharacter(e.target.value),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "All" }),
            allCharacters.map((char) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: char, children: char }, char))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "bt-relationship-list", children: sortedRelationships.map((rel) => {
      const pk = getPairKey(rel);
      const isEditing = editingPairKey === pk;
      const pairStateEvents = isEditing && hasEventStore && getStateEventsForPair ? getStateEventsForPair(rel.pair) : void 0;
      const milestones = hasEventStore && computeMilestonesForPair ? computeMilestonesForPair(rel.pair) : void 0;
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        RelationshipCard,
        {
          relationship: rel,
          isExpanded: expandedIds.has(pk),
          onToggle: () => toggleExpanded(pk),
          editMode,
          isEditing,
          onStartEdit: () => handleStartEdit(pk),
          onDeleteRelationship: () => handleDeleteRelationship(pk),
          stateEvents: pairStateEvents,
          computedMilestones: milestones,
          onStateEventUpdate,
          onStateEventDelete,
          onStateEventAdd,
          chatLength,
          chat
        },
        pk
      );
    }) }),
    filteredRelationships.length === 0 && filterCharacter && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "bt-no-results", children: [
      "No relationships found for ",
      filterCharacter,
      "."
    ] })
  ] });
}

const RelationshipsTab$1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  RelationshipsTab
}, Symbol.toStringTag, { value: 'Module' }));

export { EVENT_TYPE_TO_MILESTONE as E, RelationshipsTab as R, isUnifiedEventStore as a, isRelationshipEvent as b, isLocationPropEvent as c, isCharacterEvent as d, isInitialTimeEvent as e, isTimeEvent as f, isLocationMovedEvent as g, isForecastGeneratedEvent as h, isLegacyRelationship as i, jsxRuntimeExports as j, RelationshipsTab$1 as k };
//# sourceMappingURL=RelationshipsTab-DA2hJIvm.js.map
