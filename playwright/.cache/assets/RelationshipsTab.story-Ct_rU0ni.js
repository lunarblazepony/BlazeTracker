import { i as isLegacyRelationship, a as isUnifiedEventStore, E as EVENT_TYPE_TO_MILESTONE, b as isRelationshipEvent, c as isLocationPropEvent, d as isCharacterEvent, e as isInitialTimeEvent, f as isTimeEvent, g as isLocationMovedEvent, h as isForecastGeneratedEvent, j as jsxRuntimeExports, R as RelationshipsTab } from './RelationshipsTab-DA2hJIvm.js';
import { R as React, r as reactExports } from './index-DXoxJAVw.js';

function sortPair(char1, char2) {
  return char1.localeCompare(char2) <= 0 ? [char1, char2] : [char2, char1];
}
function pairKey$1(char1, char2) {
  const [a, b] = sortPair(char1, char2);
  return `${a}|${b}`;
}
function hasMilestone(relationship, type) {
  return (relationship.milestones ?? []).some((m) => m.type === type);
}
function findUnestablishedPairs(characters, relationships) {
  if (characters.length < 2) {
    return [];
  }
  const existingKeys = new Set(relationships.map((r) => pairKey$1(r.pair[0], r.pair[1])));
  const unestablished = [];
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      const key = pairKey$1(characters[i], characters[j]);
      if (!existingKeys.has(key)) {
        unestablished.push(sortPair(characters[i], characters[j]));
      }
    }
  }
  return unestablished;
}
function formatRelationshipsForPrompt(relationships, presentCharacters, includeSecrets = true) {
  if (relationships.length === 0) {
    return "No established relationships.";
  }
  let relevantRelationships = relationships;
  if (presentCharacters && presentCharacters.length > 0) {
    const presentSet = new Set(presentCharacters.map((c) => c.toLowerCase()));
    relevantRelationships = relationships.filter(
      (r) => presentSet.has(r.pair[0].toLowerCase()) || presentSet.has(r.pair[1].toLowerCase())
    );
  }
  if (relevantRelationships.length === 0) {
    return "No established relationships between present characters.";
  }
  return relevantRelationships.map((r) => formatRelationship(r, includeSecrets)).join("\n\n");
}
function formatRelationship(relationship, includeSecrets = true) {
  const [charA, charB] = relationship.pair;
  const lines = [];
  lines.push(`## ${charA} & ${charB} (${relationship.status})`);
  lines.push(`${charA} → ${charB}:`);
  lines.push(`  Feelings: ${relationship.aToB.feelings.join(", ") || "neutral"}`);
  if (relationship.aToB.wants.length > 0) {
    lines.push(`  Wants: ${relationship.aToB.wants.join(", ")}`);
  }
  if (includeSecrets && relationship.aToB.secrets.length > 0) {
    lines.push(
      `  Secrets (${charB} doesn't know): ${relationship.aToB.secrets.join(", ")}`
    );
  }
  lines.push(`${charB} → ${charA}:`);
  lines.push(`  Feelings: ${relationship.bToA.feelings.join(", ") || "neutral"}`);
  if (relationship.bToA.wants.length > 0) {
    lines.push(`  Wants: ${relationship.bToA.wants.join(", ")}`);
  }
  if (includeSecrets && relationship.bToA.secrets.length > 0) {
    lines.push(
      `  Secrets (${charA} doesn't know): ${relationship.bToA.secrets.join(", ")}`
    );
  }
  if (isLegacyRelationship(relationship) && relationship.milestones && relationship.milestones.length > 0) {
    lines.push(
      `Milestones: ${relationship.milestones.map((m) => m.type.replace(/_/g, " ")).join(", ")}`
    );
  }
  return lines.join("\n");
}
function createEmptyAttitude$1() {
  return {
    feelings: [],
    secrets: [],
    wants: []
  };
}
function createRelationship(char1, char2, status = "strangers", messageId) {
  const pair = sortPair(char1, char2);
  const aToB = createEmptyAttitude$1();
  const bToA = createEmptyAttitude$1();
  const relationship = {
    pair,
    status,
    aToB,
    bToA,
    milestones: [],
    history: [],
    versions: []
  };
  if (messageId !== void 0) {
    addRelationshipVersion(relationship, messageId);
  }
  return relationship;
}
function addMilestone(relationship, milestone) {
  if (!relationship.milestones) {
    relationship.milestones = [];
  }
  if (!hasMilestone(relationship, milestone.type)) {
    relationship.milestones.push(milestone);
  }
}
function getAttitudeDirection(relationship, fromCharacter) {
  return relationship.pair[0].toLowerCase() === fromCharacter.toLowerCase() ? "aToB" : "bToA";
}
function updateAttitude(relationship, fromCharacter, updates) {
  const direction = getAttitudeDirection(relationship, fromCharacter);
  const attitude = relationship[direction];
  if (updates.feelings !== void 0) {
    attitude.feelings = updates.feelings;
  }
  if (updates.secrets !== void 0) {
    attitude.secrets = updates.secrets;
  }
  if (updates.wants !== void 0) {
    attitude.wants = updates.wants;
  }
}
function narrativeDateTimeToNumber(dt) {
  return dt.year * 1e10 + dt.month * 1e8 + dt.day * 1e6 + dt.hour * 1e4 + dt.minute * 100 + dt.second;
}
function compareNarrativeDateTime(a, b) {
  return narrativeDateTimeToNumber(a) - narrativeDateTimeToNumber(b);
}
function isDateTimeOnOrAfter(dt, reference) {
  return compareNarrativeDateTime(dt, reference) >= 0;
}
function clearMilestonesSince(relationship, sinceTime) {
  if (!relationship.milestones) {
    return 0;
  }
  const originalCount = relationship.milestones.length;
  relationship.milestones = relationship.milestones.filter(
    (m) => !isDateTimeOnOrAfter(m.timestamp, sinceTime)
  );
  return originalCount - relationship.milestones.length;
}
function clearAllMilestonesSince(relationships, sinceTime) {
  let totalRemoved = 0;
  for (const rel of relationships) {
    totalRemoved += clearMilestonesSince(rel, sinceTime);
  }
  return totalRemoved;
}
function clearMilestonesForMessage(relationship, messageId) {
  if (!relationship.milestones) {
    return 0;
  }
  const originalCount = relationship.milestones.length;
  relationship.milestones = relationship.milestones.filter((m) => m.messageId !== messageId);
  return originalCount - relationship.milestones.length;
}
function clearAllMilestonesForMessage(relationships, messageId) {
  let totalRemoved = 0;
  for (const rel of relationships) {
    if (isLegacyRelationship(rel)) {
      totalRemoved += clearMilestonesForMessage(rel, messageId);
    }
  }
  return totalRemoved;
}
function addRelationshipVersion(relationship, messageId) {
  if (!relationship.versions) {
    relationship.versions = [];
  }
  const version = {
    messageId,
    status: relationship.status,
    aToB: {
      feelings: [...relationship.aToB.feelings],
      secrets: [...relationship.aToB.secrets],
      wants: [...relationship.aToB.wants]
    },
    bToA: {
      feelings: [...relationship.bToA.feelings],
      secrets: [...relationship.bToA.secrets],
      wants: [...relationship.bToA.wants]
    },
    milestones: [...relationship.milestones ?? []]
  };
  relationship.versions.push(version);
}
function popVersionForMessage(relationship, messageId) {
  if (!relationship.versions || relationship.versions.length === 0) {
    return false;
  }
  const lastVersion = relationship.versions[relationship.versions.length - 1];
  if (lastVersion.messageId === messageId) {
    relationship.versions.pop();
    if (relationship.versions.length > 0) {
      const previousVersion = relationship.versions[relationship.versions.length - 1];
      relationship.status = previousVersion.status;
      relationship.aToB = {
        feelings: [...previousVersion.aToB.feelings],
        secrets: [...previousVersion.aToB.secrets],
        wants: [...previousVersion.aToB.wants]
      };
      relationship.bToA = {
        feelings: [...previousVersion.bToA.feelings],
        secrets: [...previousVersion.bToA.secrets],
        wants: [...previousVersion.bToA.wants]
      };
      relationship.milestones = [...previousVersion.milestones ?? []];
    }
    return true;
  }
  return false;
}
function getLatestVersionMessageId(relationship) {
  if (!relationship.versions || relationship.versions.length === 0) {
    return void 0;
  }
  return relationship.versions[relationship.versions.length - 1].messageId;
}
function getRelationshipAtMessage(relationship, messageId) {
  if (!relationship.versions || relationship.versions.length === 0) {
    return void 0;
  }
  for (let i = relationship.versions.length - 1; i >= 0; i--) {
    if (relationship.versions[i].messageId <= messageId) {
      return relationship.versions[i];
    }
  }
  return void 0;
}
function getRelationshipsAtMessage(relationships, messageId) {
  const result = [];
  for (const rel of relationships) {
    if (isLegacyRelationship(rel)) {
      const version = getRelationshipAtMessage(rel, messageId);
      if (version) {
        result.push({
          ...rel,
          status: version.status,
          aToB: version.aToB,
          bToA: version.bToA,
          milestones: version.milestones
        });
      }
    } else {
      result.push(rel);
    }
  }
  return result;
}

function deepCloneEventStore(store) {
  return JSON.parse(JSON.stringify(store));
}
function getNarrativeEventsArray(store) {
  if (isUnifiedEventStore(store)) {
    return store.narrativeEvents;
  }
  return store.events;
}
function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
function createEventStore() {
  return {
    events: [],
    version: 1
  };
}
function getEvent(store, id) {
  const events = getNarrativeEventsArray(store);
  const event = events.find((e) => e.id === id);
  if (!event || event.deleted) {
    return null;
  }
  return event;
}
function getActiveEvents(store) {
  return getNarrativeEventsArray(store).filter((e) => !e.deleted);
}
function getEventsForMessage(store, messageId, swipeId) {
  return getNarrativeEventsArray(store).filter(
    (e) => !e.deleted && e.messageId === messageId && e.swipeId === swipeId
  );
}
function getEventsForPair(store, pair) {
  const sortedPair = sortPair(pair[0], pair[1]);
  const pairKey2 = sortedPair.join("|").toLowerCase();
  return getNarrativeEventsArray(store).filter((e) => {
    if (e.deleted) return false;
    return e.affectedPairs.some((ap) => {
      const apKey = sortPair(ap.pair[0], ap.pair[1]).join("|").toLowerCase();
      return apKey === pairKey2;
    });
  });
}
function getEventsForChapter(store, chapterIndex) {
  return getNarrativeEventsArray(store).filter(
    (e) => !e.deleted && e.chapterIndex === chapterIndex
  );
}
function getCurrentChapterEvents(store) {
  return getNarrativeEventsArray(store).filter(
    (e) => !e.deleted && e.chapterIndex === void 0
  );
}
function getEventsUpToMessage(store, messageId) {
  return getNarrativeEventsArray(store).filter((e) => !e.deleted && e.messageId <= messageId);
}
function addEvent(store, event) {
  const id = generateUUID();
  const newEvent = {
    ...event,
    id
  };
  const events = getNarrativeEventsArray(store);
  events.push(newEvent);
  events.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);
  return id;
}
function updateEvent(store, id, updates) {
  const events = getNarrativeEventsArray(store);
  const event = events.find((e) => e.id === id);
  if (!event) {
    return false;
  }
  Object.assign(event, updates);
  return true;
}
function deleteEvent(store, id) {
  const events = getNarrativeEventsArray(store);
  const event = events.find((e) => e.id === id);
  if (!event) {
    return false;
  }
  event.deleted = true;
  return true;
}
function replaceEventsForMessage(store, messageId, swipeId, newEvents) {
  const events = getNarrativeEventsArray(store);
  for (const event of events) {
    if (event.messageId === messageId && event.swipeId === swipeId && !event.deleted) {
      event.deleted = true;
    }
  }
  const newIds = [];
  for (const event of newEvents) {
    const id = addEvent(store, event);
    newIds.push(id);
  }
  return newIds;
}
function assignEventsToChapter(store, eventIds, chapterIndex) {
  const events = getNarrativeEventsArray(store);
  for (const id of eventIds) {
    const event = events.find((e) => e.id === id);
    if (event && !event.deleted) {
      event.chapterIndex = chapterIndex;
    }
  }
}
function pairKey(pair) {
  return sortPair(pair[0], pair[1]).join("|").toLowerCase();
}
function recomputeFirstFor(store, fromMessageId = 0, affectedPairs) {
  const events = getActiveEvents(store).sort(
    (a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp
  );
  const seenMilestones = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event.messageId < fromMessageId) {
      for (const ap of event.affectedPairs) {
        const key = pairKey(ap.pair);
        if (affectedPairs && !affectedPairs.has(key)) continue;
        if (!seenMilestones.has(key)) {
          seenMilestones.set(key, /* @__PURE__ */ new Set());
        }
        const seen = seenMilestones.get(key);
        if (ap.firstFor) {
          for (const mt of ap.firstFor) {
            seen.add(mt);
          }
        }
      }
    } else {
      for (const ap of event.affectedPairs) {
        const key = pairKey(ap.pair);
        if (affectedPairs && !affectedPairs.has(key)) continue;
        if (!seenMilestones.has(key)) {
          seenMilestones.set(key, /* @__PURE__ */ new Set());
        }
        const seen = seenMilestones.get(key);
        ap.firstFor = [];
        const newDescriptions = {};
        for (const eventType of event.eventTypes) {
          const milestoneType = EVENT_TYPE_TO_MILESTONE[eventType];
          if (milestoneType && !seen.has(milestoneType)) {
            ap.firstFor.push(milestoneType);
            seen.add(milestoneType);
            if (ap.milestoneDescriptions?.[milestoneType]) {
              newDescriptions[milestoneType] = ap.milestoneDescriptions[milestoneType];
            }
          }
        }
        if (Object.keys(newDescriptions).length > 0) {
          ap.milestoneDescriptions = newDescriptions;
        } else {
          delete ap.milestoneDescriptions;
        }
        if (ap.firstFor.length === 0) {
          delete ap.firstFor;
        }
      }
    }
  }
}
function promoteNextEventForMilestone(store, pair, milestoneType) {
  const key = pairKey(pair);
  let triggeringEventType = null;
  for (const [et, mt] of Object.entries(EVENT_TYPE_TO_MILESTONE)) {
    if (mt === milestoneType) {
      triggeringEventType = et;
      break;
    }
  }
  if (!triggeringEventType) {
    return false;
  }
  const events = getActiveEvents(store).sort(
    (a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp
  );
  for (const event of events) {
    if (!event.eventTypes.includes(triggeringEventType)) continue;
    const ap = event.affectedPairs.find((p) => pairKey(p.pair) === key);
    if (!ap) continue;
    if (ap.firstFor?.includes(milestoneType)) continue;
    if (!ap.firstFor) {
      ap.firstFor = [];
    }
    ap.firstFor.push(milestoneType);
    return true;
  }
  return false;
}
function projectRelationship(store, pair) {
  const sortedPair = sortPair(pair[0], pair[1]);
  const key = pairKey(sortedPair);
  const events = getEventsForPair(store, sortedPair);
  const relationship = {
    pair: sortedPair,
    status: "strangers",
    aToB: { feelings: [], secrets: [], wants: [] },
    bToA: { feelings: [], secrets: [], wants: [] },
    milestoneEventIds: [],
    history: []
  };
  if (events.length === 0) {
    return relationship;
  }
  relationship.status = "acquaintances";
  const allAToB = [];
  const allBToA = [];
  for (const event of events) {
    const ap = event.affectedPairs.find((p) => pairKey(p.pair) === key);
    if (!ap) continue;
    if (ap.firstFor && ap.firstFor.length > 0) {
      relationship.milestoneEventIds.push(event.id);
    }
    if (ap.changes) {
      for (const change of ap.changes) {
        const fromLower = change.from.toLowerCase();
        const aLower = sortedPair[0].toLowerCase();
        if (fromLower === aLower) {
          if (!allAToB.includes(change.feeling)) {
            allAToB.push(change.feeling);
          }
        } else {
          if (!allBToA.includes(change.feeling)) {
            allBToA.push(change.feeling);
          }
        }
      }
    }
  }
  relationship.aToB.feelings = allAToB;
  relationship.bToA.feelings = allBToA;
  relationship.status = computeStatusFromMilestones(store, sortedPair);
  return relationship;
}
function computeStatusFromMilestones(store, pair) {
  const events = getEventsForPair(store, pair);
  const key = pairKey(pair);
  const milestones = /* @__PURE__ */ new Set();
  for (const event of events) {
    const ap = event.affectedPairs.find((p) => pairKey(p.pair) === key);
    if (ap?.firstFor) {
      for (const mt of ap.firstFor) {
        milestones.add(mt);
      }
    }
  }
  const intimateMilestones = [
    "first_penetrative",
    "first_oral",
    "first_climax",
    "marriage",
    "promised_exclusivity"
  ];
  if (intimateMilestones.some((m) => milestones.has(m))) {
    return "intimate";
  }
  const closeMilestones = [
    "first_heated",
    "first_kiss",
    "emotional_intimacy",
    "first_vulnerability",
    "confession",
    "first_i_love_you"
  ];
  if (closeMilestones.some((m) => milestones.has(m))) {
    return "close";
  }
  const friendlyMilestones = [
    "first_laugh",
    "first_gift",
    "first_shared_meal",
    "first_shared_activity",
    "first_helped",
    "first_outing",
    "first_embrace",
    "first_touch"
  ];
  if (friendlyMilestones.some((m) => milestones.has(m))) {
    return "friendly";
  }
  if (milestones.has("betrayal") || milestones.has("promise_broken")) {
    return milestones.has("reconciliation") ? "strained" : "hostile";
  }
  if (milestones.has("first_conflict") || milestones.has("major_argument")) {
    return milestones.has("reconciliation") ? "strained" : "strained";
  }
  if (milestones.has("first_meeting")) {
    return "acquaintances";
  }
  return "strangers";
}
function computeMilestonesForPair(store, pair) {
  const events = getEventsForPair(store, pair);
  const key = pairKey(pair);
  const milestones = [];
  for (const event of events) {
    const ap = event.affectedPairs.find((p) => pairKey(p.pair) === key);
    if (!ap?.firstFor) continue;
    for (const mt of ap.firstFor) {
      milestones.push({
        type: mt,
        eventId: event.id,
        description: ap.milestoneDescriptions?.[mt]
      });
    }
  }
  return milestones;
}
function computeMilestonesForEvent(store, messageId) {
  const events = getNarrativeEventsArray(store);
  const event = events.find((e) => e.messageId === messageId && !e.deleted);
  if (!event) {
    return [];
  }
  const milestones = [];
  for (const ap of event.affectedPairs) {
    if (!ap.firstFor) continue;
    for (const mt of ap.firstFor) {
      milestones.push({
        type: mt,
        pair: ap.pair,
        description: ap.milestoneDescriptions?.[mt]
      });
    }
  }
  return milestones;
}
function getAllPairsFromEvents(store) {
  const pairs = /* @__PURE__ */ new Map();
  for (const event of getActiveEvents(store)) {
    for (const ap of event.affectedPairs) {
      const sorted = sortPair(ap.pair[0], ap.pair[1]);
      const key = pairKey(sorted);
      if (!pairs.has(key)) {
        pairs.set(key, sorted);
      }
    }
  }
  return Array.from(pairs.values());
}
function getCurrentChapterEventIds(store) {
  return getCurrentChapterEvents(store).map((e) => e.id);
}
function hasEvents(store) {
  return getActiveEvents(store).length > 0;
}
function getEventCount(store) {
  return getActiveEvents(store).length;
}
function getLastMessageWithEvents(store) {
  let lastMessageId = -1;
  const narrativeEvents = getActiveEvents(store);
  for (const event of narrativeEvents) {
    if (event.messageId > lastMessageId) {
      lastMessageId = event.messageId;
    }
  }
  if (isUnifiedEventStore(store)) {
    const stateEvents = getActiveStateEvents(store);
    for (const event of stateEvents) {
      if (event.messageId > lastMessageId) {
        lastMessageId = event.messageId;
      }
    }
  }
  return lastMessageId;
}
function createUnifiedEventStore() {
  return {
    narrativeEvents: [],
    stateEvents: [],
    version: 2
  };
}
function convertToUnifiedStore(legacy) {
  return {
    narrativeEvents: [...legacy.events],
    stateEvents: [],
    version: 2
  };
}
function addStateEvent(store, event) {
  const id = generateUUID();
  const newEvent = { ...event, id };
  store.stateEvents.push(newEvent);
  store.stateEvents.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);
  return id;
}
function getActiveStateEvents(store) {
  return store.stateEvents.filter((e) => !e.deleted);
}
function getStateEventsForMessage(store, messageId, swipeId) {
  return store.stateEvents.filter(
    (e) => !e.deleted && e.messageId === messageId && e.swipeId === swipeId
  );
}
function getStateEventsUpToMessage(store, messageId, swipeId) {
  return store.stateEvents.filter(
    (e) => !e.deleted && (e.messageId < messageId || e.messageId === messageId && e.swipeId === swipeId)
  );
}
function deleteStateEvent(store, id) {
  const event = store.stateEvents.find((e) => e.id === id);
  if (!event) return false;
  event.deleted = true;
  return true;
}
function getRelationshipEventsForPair(store, pair) {
  const key = pairKey(pair);
  return store.stateEvents.filter(
    (e) => !e.deleted && isRelationshipEvent(e) && pairKey(e.pair) === key
  );
}
function updateRelationshipEvent(store, eventId, updates) {
  const event = store.stateEvents.find((e) => e.id === eventId);
  if (!event || !isRelationshipEvent(event)) return false;
  Object.assign(event, updates);
  return true;
}
function projectStateBeforeMessage(store, messageId, swipeId) {
  if (messageId <= 0) {
    return getInitialProjection(store) ?? createEmptyProjectedState();
  }
  return projectStateAtMessage(store, messageId - 1, 0);
}
function deduplicateEvent(event, projection) {
  if (isLocationPropEvent(event)) {
    const propEvent = event;
    const currentProps = projection.location?.props ?? [];
    if (propEvent.subkind === "prop_added") {
      if (currentProps.includes(propEvent.prop)) {
        return null;
      }
    } else if (propEvent.subkind === "prop_removed") {
      if (!currentProps.includes(propEvent.prop)) {
        return null;
      }
    }
    return event;
  }
  if (isCharacterEvent(event)) {
    const charEvent = event;
    const character = projection.characters.get(charEvent.character);
    switch (charEvent.subkind) {
      case "mood_added": {
        if (character?.mood.includes(charEvent.mood ?? "")) {
          return null;
        }
        break;
      }
      case "mood_removed": {
        if (!character?.mood.includes(charEvent.mood ?? "")) {
          return null;
        }
        break;
      }
      case "physical_state_added": {
        if (character?.physicalState.includes(
          charEvent.physicalState ?? ""
        )) {
          return null;
        }
        break;
      }
      case "physical_state_removed": {
        if (!character?.physicalState.includes(
          charEvent.physicalState ?? ""
        )) {
          return null;
        }
        break;
      }
      case "outfit_changed": {
        if (charEvent.slot) {
          const slot = charEvent.slot;
          const currentValue = character?.outfit[slot] ?? null;
          if (charEvent.newValue === currentValue) {
            return null;
          }
          return {
            ...charEvent,
            previousValue: currentValue
          };
        }
        break;
      }
      case "position_changed": {
        if (charEvent.newValue === character?.position) {
          return null;
        }
        break;
      }
      case "activity_changed": {
        if (charEvent.newValue === character?.activity) {
          return null;
        }
        break;
      }
    }
    return event;
  }
  if (isRelationshipEvent(event)) {
    const relEvent = event;
    const sortedPair = sortPair(relEvent.pair[0], relEvent.pair[1]);
    const key = `${sortedPair[0]}|${sortedPair[1]}`;
    const relationship = projection.relationships.get(key);
    const getAttitude = () => {
      if (!relEvent.fromCharacter || !relEvent.towardCharacter || !relationship)
        return null;
      const fromLower = relEvent.fromCharacter.toLowerCase();
      const aLower = relationship.pair[0].toLowerCase();
      return fromLower === aLower ? relationship.aToB : relationship.bToA;
    };
    const attitude = getAttitude();
    switch (relEvent.subkind) {
      case "feeling_added": {
        if (attitude?.feelings.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "feeling_removed": {
        if (!attitude?.feelings.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "secret_added": {
        if (attitude?.secrets.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "secret_removed": {
        if (!attitude?.secrets.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "want_added": {
        if (attitude?.wants.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "want_removed": {
        if (!attitude?.wants.includes(relEvent.value ?? "")) {
          return null;
        }
        break;
      }
      case "status_changed": {
        if (relEvent.newStatus === relationship?.status) {
          return null;
        }
        break;
      }
    }
    return event;
  }
  return event;
}
function deduplicateEvents(store, messageId, swipeId, events) {
  const projection = projectStateBeforeMessage(store, messageId, swipeId);
  const dedupedEvents = [];
  for (const event of events) {
    const result = deduplicateEvent(event, projection);
    if (result !== null) {
      dedupedEvents.push(result);
    }
  }
  return dedupedEvents;
}
function replaceStateEventsForMessage(store, messageId, swipeId, newEvents) {
  for (const event of store.stateEvents) {
    if (event.messageId === messageId && event.swipeId === swipeId && !event.deleted) {
      event.deleted = true;
    }
  }
  const dedupedEvents = deduplicateEvents(store, messageId, swipeId, newEvents);
  return dedupedEvents.map((e) => addStateEvent(store, e));
}
function createEmptyProjectedState() {
  return {
    time: null,
    location: null,
    characters: /* @__PURE__ */ new Map(),
    relationships: /* @__PURE__ */ new Map()
  };
}
function createEmptyOutfit() {
  return {
    head: null,
    neck: null,
    jacket: null,
    back: null,
    torso: null,
    legs: null,
    footwear: null,
    socks: null,
    underwear: null
  };
}
function getOrCreateCharacter(state, name) {
  if (!state.characters.has(name)) {
    state.characters.set(name, {
      name,
      position: "unknown",
      mood: [],
      physicalState: [],
      outfit: createEmptyOutfit()
    });
  }
  return state.characters.get(name);
}
function createEmptyAttitude() {
  return {
    feelings: [],
    secrets: [],
    wants: []
  };
}
function getOrCreateRelationship(state, pair) {
  const sortedPair = sortPair(pair[0], pair[1]);
  const key = `${sortedPair[0]}|${sortedPair[1]}`;
  if (!state.relationships.has(key)) {
    state.relationships.set(key, {
      pair: sortedPair,
      status: "strangers",
      aToB: createEmptyAttitude(),
      bToA: createEmptyAttitude()
    });
  }
  return state.relationships.get(key);
}
function applyTimeDelta(baseTime, delta) {
  const date = new Date(
    baseTime.year,
    baseTime.month - 1,
    baseTime.day,
    baseTime.hour,
    baseTime.minute,
    baseTime.second
  );
  date.setMinutes(date.getMinutes() + delta.minutes);
  date.setHours(date.getHours() + delta.hours);
  date.setDate(date.getDate() + delta.days);
  const DAYS_OF_WEEK = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    dayOfWeek: DAYS_OF_WEEK[date.getDay()]
  };
}
function applyStateEvent(state, event) {
  if (isInitialTimeEvent(event)) {
    return {
      ...state,
      time: event.initialTime
    };
  }
  if (isTimeEvent(event)) {
    const baseTime = state.time ?? {
      year: 2024,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      dayOfWeek: "Monday"
    };
    const newTime = applyTimeDelta(baseTime, event.delta);
    return {
      ...state,
      time: newTime
    };
  }
  if (isLocationMovedEvent(event)) {
    const currentProps = state.location?.props ?? [];
    return {
      ...state,
      location: {
        area: event.newArea,
        place: event.newPlace,
        position: event.newPosition,
        props: currentProps
      }
    };
  }
  if (isCharacterEvent(event)) {
    const existingChar = getOrCreateCharacter(state, event.character);
    const char = {
      name: existingChar.name,
      position: existingChar.position,
      activity: existingChar.activity,
      mood: [...existingChar.mood],
      physicalState: [...existingChar.physicalState],
      outfit: { ...existingChar.outfit }
    };
    state.characters.set(event.character, char);
    switch (event.subkind) {
      case "appeared":
        break;
      case "departed":
        state.characters.delete(event.character);
        break;
      case "position_changed":
        if (event.newValue !== null && event.newValue !== void 0) {
          char.position = event.newValue;
        }
        break;
      case "activity_changed":
        char.activity = event.newValue ?? void 0;
        break;
      case "mood_added":
        if (event.mood && !char.mood.includes(event.mood)) {
          char.mood.push(event.mood);
        }
        break;
      case "mood_removed":
        if (event.mood) {
          char.mood = char.mood.filter((m) => m !== event.mood);
        }
        break;
      case "physical_state_added":
        if (event.physicalState && !char.physicalState.includes(event.physicalState)) {
          char.physicalState.push(event.physicalState);
        }
        break;
      case "physical_state_removed":
        if (event.physicalState) {
          char.physicalState = char.physicalState.filter(
            (p) => p !== event.physicalState
          );
        }
        break;
      case "outfit_changed":
        if (event.slot) {
          if (event.newValue === null || event.newValue === void 0) {
            delete char.outfit[event.slot];
          } else {
            char.outfit[event.slot] = event.newValue;
          }
        }
        break;
    }
  }
  if (isLocationPropEvent(event)) {
    if (!state.location) {
      state.location = {
        area: "Unknown",
        place: "Unknown",
        position: "Unknown",
        props: []
      };
    } else {
      state.location = {
        ...state.location,
        props: [...state.location.props]
      };
    }
    switch (event.subkind) {
      case "prop_added":
        if (!state.location.props.includes(event.prop)) {
          state.location.props.push(event.prop);
        }
        break;
      case "prop_removed":
        state.location.props = state.location.props.filter(
          (p) => p !== event.prop
        );
        break;
    }
  }
  if (isRelationshipEvent(event)) {
    const existingRel = getOrCreateRelationship(state, event.pair);
    const rel = {
      pair: existingRel.pair,
      status: existingRel.status,
      aToB: {
        feelings: [...existingRel.aToB.feelings],
        secrets: [...existingRel.aToB.secrets],
        wants: [...existingRel.aToB.wants]
      },
      bToA: {
        feelings: [...existingRel.bToA.feelings],
        secrets: [...existingRel.bToA.secrets],
        wants: [...existingRel.bToA.wants]
      }
    };
    const key = `${rel.pair[0]}|${rel.pair[1]}`;
    state.relationships.set(key, rel);
    const getAttitude = () => {
      if (!event.fromCharacter || !event.towardCharacter) return null;
      const fromLower = event.fromCharacter.toLowerCase();
      const aLower = rel.pair[0].toLowerCase();
      return fromLower === aLower ? rel.aToB : rel.bToA;
    };
    switch (event.subkind) {
      case "feeling_added": {
        const attitude = getAttitude();
        if (attitude && event.value && !attitude.feelings.includes(event.value)) {
          attitude.feelings.push(event.value);
        }
        break;
      }
      case "feeling_removed": {
        const attitude = getAttitude();
        if (attitude && event.value) {
          attitude.feelings = attitude.feelings.filter(
            (f) => f !== event.value
          );
        }
        break;
      }
      case "secret_added": {
        const attitude = getAttitude();
        if (attitude && event.value && !attitude.secrets.includes(event.value)) {
          attitude.secrets.push(event.value);
        }
        break;
      }
      case "secret_removed": {
        const attitude = getAttitude();
        if (attitude && event.value) {
          attitude.secrets = attitude.secrets.filter(
            (s) => s !== event.value
          );
        }
        break;
      }
      case "want_added": {
        const attitude = getAttitude();
        if (attitude && event.value && !attitude.wants.includes(event.value)) {
          attitude.wants.push(event.value);
        }
        break;
      }
      case "want_removed": {
        const attitude = getAttitude();
        if (attitude && event.value) {
          attitude.wants = attitude.wants.filter(
            (w) => w !== event.value
          );
        }
        break;
      }
      case "status_changed":
        if (event.newStatus) {
          rel.status = event.newStatus;
        }
        break;
    }
  }
  return state;
}
function projectStateAtMessage(store, messageId, swipeId) {
  const events = getStateEventsUpToMessage(store, messageId, swipeId);
  const initial = getInitialProjection(store);
  let state = initial ?? createEmptyProjectedState();
  for (const event of events) {
    state = applyStateEvent(state, event);
  }
  return state;
}
function projectCurrentState(store) {
  const events = getActiveStateEvents(store);
  let maxMessageId = -1;
  let maxSwipeId = 0;
  for (const e of events) {
    if (e.messageId > maxMessageId || e.messageId === maxMessageId && e.swipeId > maxSwipeId) {
      maxMessageId = e.messageId;
      maxSwipeId = e.swipeId;
    }
  }
  if (maxMessageId < 0) {
    return createEmptyProjectedState();
  }
  return projectStateAtMessage(store, maxMessageId, maxSwipeId);
}
function convertProjectionToTrackedState(projection) {
  const result = {};
  if (projection.time) {
    result.time = projection.time;
  }
  if (projection.location) {
    result.location = projection.location;
  }
  if (projection.characters.size > 0) {
    result.characters = Array.from(projection.characters.values()).map(
      (pc) => ({
        name: pc.name,
        position: pc.position,
        activity: pc.activity,
        mood: pc.mood,
        physicalState: pc.physicalState.length > 0 ? pc.physicalState : void 0,
        outfit: pc.outfit
      })
    );
  }
  return result;
}
function convertTrackedStateToProjection(tracked) {
  const characters = /* @__PURE__ */ new Map();
  for (const char of tracked.characters ?? []) {
    characters.set(char.name, {
      name: char.name,
      position: char.position,
      activity: char.activity,
      mood: char.mood ?? [],
      physicalState: char.physicalState ?? [],
      outfit: char.outfit ?? createEmptyOutfit()
    });
  }
  return {
    time: tracked.time ?? null,
    location: tracked.location ?? null,
    characters,
    relationships: /* @__PURE__ */ new Map()
  };
}
function generateStateEventsFromDiff(messageId, swipeId, prev, curr) {
  const events = [];
  const timestamp = Date.now();
  if (curr.time && !timeEquals(prev?.time ?? null, curr.time)) {
    if (!prev?.time) {
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "time_initial",
        initialTime: curr.time
      });
    } else {
      const delta = computeTimeDelta(prev.time, curr.time);
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "time",
        delta
      });
    }
  }
  if (curr.location && (prev?.location?.area !== curr.location.area || prev?.location?.place !== curr.location.place || prev?.location?.position !== curr.location.position)) {
    events.push({
      id: generateUUID(),
      messageId,
      swipeId,
      timestamp,
      kind: "location",
      subkind: "moved",
      newArea: curr.location.area,
      newPlace: curr.location.place,
      newPosition: curr.location.position,
      previousArea: prev?.location?.area,
      previousPlace: prev?.location?.place,
      previousPosition: prev?.location?.position
    });
  }
  const prevChars = prev?.characters ?? /* @__PURE__ */ new Map();
  const currChars = /* @__PURE__ */ new Map();
  for (const char of curr.characters ?? []) {
    currChars.set(char.name, char);
  }
  for (const [name, char] of currChars) {
    const prevChar = prevChars.get(name);
    if (!prevChar) {
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "character",
        subkind: "appeared",
        character: name
      });
    }
    if (char.position && char.position !== prevChar?.position) {
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "character",
        subkind: "position_changed",
        character: name,
        newValue: char.position,
        previousValue: prevChar?.position
      });
    }
    if (char.activity !== prevChar?.activity) {
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "character",
        subkind: "activity_changed",
        character: name,
        newValue: char.activity ?? null,
        previousValue: prevChar?.activity ?? null
      });
    }
    const prevMoods = new Set(prevChar?.mood ?? []);
    const currMoods = new Set(char.mood ?? []);
    for (const mood of currMoods) {
      if (!prevMoods.has(mood)) {
        events.push({
          id: generateUUID(),
          messageId,
          swipeId,
          timestamp,
          kind: "character",
          subkind: "mood_added",
          character: name,
          mood
        });
      }
    }
    for (const mood of prevMoods) {
      if (!currMoods.has(mood)) {
        events.push({
          id: generateUUID(),
          messageId,
          swipeId,
          timestamp,
          kind: "character",
          subkind: "mood_removed",
          character: name,
          mood
        });
      }
    }
    const prevPhysical = new Set(prevChar?.physicalState ?? []);
    const currPhysical = new Set(char.physicalState ?? []);
    for (const ps of currPhysical) {
      if (!prevPhysical.has(ps)) {
        events.push({
          id: generateUUID(),
          messageId,
          swipeId,
          timestamp,
          kind: "character",
          subkind: "physical_state_added",
          character: name,
          physicalState: ps
        });
      }
    }
    for (const ps of prevPhysical) {
      if (!currPhysical.has(ps)) {
        events.push({
          id: generateUUID(),
          messageId,
          swipeId,
          timestamp,
          kind: "character",
          subkind: "physical_state_removed",
          character: name,
          physicalState: ps
        });
      }
    }
    const outfitSlots = [
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
    for (const slot of outfitSlots) {
      const prevItem = prevChar?.outfit?.[slot];
      const currItem = char.outfit?.[slot];
      if (prevItem !== currItem) {
        events.push({
          id: generateUUID(),
          messageId,
          swipeId,
          timestamp,
          kind: "character",
          subkind: "outfit_changed",
          character: name,
          slot,
          newValue: currItem ?? null,
          previousValue: prevItem ?? null
        });
      }
    }
  }
  for (const [name] of prevChars) {
    if (!currChars.has(name)) {
      events.push({
        id: generateUUID(),
        messageId,
        swipeId,
        timestamp,
        kind: "character",
        subkind: "departed",
        character: name
      });
    }
  }
  return events;
}
function timeEquals(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}
function locationEquals(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.area === b.area && a.place === b.place && a.position === b.position && JSON.stringify(a.props.sort()) === JSON.stringify(b.props.sort());
}
function computeTimeDelta(from, to) {
  const fromMinutes = from.year * 365 * 24 * 60 + from.month * 30 * 24 * 60 + from.day * 24 * 60 + from.hour * 60 + from.minute;
  const toMinutes = to.year * 365 * 24 * 60 + to.month * 30 * 24 * 60 + to.day * 24 * 60 + to.hour * 60 + to.minute;
  const diffMinutes = toMinutes - fromMinutes;
  const days = Math.floor(diffMinutes / (24 * 60));
  const hours = Math.floor(diffMinutes % (24 * 60) / 60);
  const minutes = diffMinutes % 60;
  return { days, hours, minutes };
}
function updateNarrativeEvent(store, eventId, updates) {
  const events = getNarrativeEventsArray(store);
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) {
    return false;
  }
  events[idx] = { ...events[idx], ...updates };
  return true;
}
function reProjectRelationshipsFromEvents(store) {
  const pairs = getAllPairsFromEvents(store);
  return pairs.map((pair) => projectRelationship(store, pair));
}
function projectRelationshipsFromCurrentState(store) {
  const projectedState = projectCurrentState(store);
  return Array.from(projectedState.relationships.values());
}
function getNarrativeEventsForChapter(store, chapterIndex) {
  return getEventsForChapter(store, chapterIndex);
}
function getNarrativeEventsForPair(store, pair) {
  return getEventsForPair(store, pair);
}
function hasEarlierEventsOrProjections(store, messageId) {
  if (store.initialProjection) {
    return true;
  }
  const hasEarlierStateEvents = store.stateEvents.some(
    (e) => !e.deleted && e.messageId < messageId
  );
  if (hasEarlierStateEvents) {
    return true;
  }
  const hasEarlierNarrativeEvents = store.narrativeEvents.some(
    (e) => !e.deleted && e.messageId < messageId
  );
  return hasEarlierNarrativeEvents;
}
function invalidateProjectionsFrom(store, messageId) {
  if (store.projectionInvalidFrom === void 0 || messageId < store.projectionInvalidFrom) {
    store.projectionInvalidFrom = messageId;
  }
}
function isProjectionInvalidated(store, messageId) {
  if (store.projectionInvalidFrom === void 0) {
    return false;
  }
  return messageId >= store.projectionInvalidFrom;
}
function clearProjectionInvalidation(store) {
  delete store.projectionInvalidFrom;
}
function clearEventsForMessage(store, messageId) {
  for (const event of store.stateEvents) {
    if (event.messageId === messageId && !event.deleted) {
      event.deleted = true;
    }
  }
  for (const event of store.narrativeEvents) {
    if (event.messageId === messageId && !event.deleted) {
      event.deleted = true;
    }
  }
}
function invalidateSnapshotsFrom(store, messageId) {
  if (!store.chapterSnapshots || store.chapterSnapshots.length === 0) {
    return;
  }
  store.chapterSnapshots = store.chapterSnapshots.filter((s) => s.messageId < messageId);
}
function setInitialProjection(store, projection) {
  store.initialProjection = {
    time: projection.time,
    location: projection.location,
    characters: Object.fromEntries(projection.characters),
    relationships: Object.fromEntries(projection.relationships)
  };
}
function getInitialProjection(store) {
  if (!store.initialProjection) {
    return null;
  }
  return {
    time: store.initialProjection.time,
    location: store.initialProjection.location,
    characters: new Map(Object.entries(store.initialProjection.characters)),
    relationships: new Map(Object.entries(store.initialProjection.relationships ?? {}))
  };
}
function saveChapterSnapshot(store, chapterIndex, messageId, swipeId, projection) {
  if (!store.chapterSnapshots) {
    store.chapterSnapshots = [];
  }
  store.chapterSnapshots = store.chapterSnapshots.filter(
    (s) => s.chapterIndex !== chapterIndex
  );
  store.chapterSnapshots.push({
    chapterIndex,
    messageId,
    swipeId,
    projection: {
      time: projection.time,
      location: projection.location,
      characters: Object.fromEntries(projection.characters),
      relationships: Object.fromEntries(projection.relationships)
    }
  });
  store.chapterSnapshots.sort((a, b) => a.chapterIndex - b.chapterIndex);
}
function findChapterSnapshotBefore(store, messageId) {
  if (!store.chapterSnapshots || store.chapterSnapshots.length === 0) {
    return null;
  }
  let bestSnapshot = null;
  for (const snapshot of store.chapterSnapshots) {
    if (snapshot.messageId < messageId) {
      bestSnapshot = snapshot;
    }
  }
  if (!bestSnapshot) {
    return null;
  }
  return {
    snapshot: {
      time: bestSnapshot.projection.time,
      location: bestSnapshot.projection.location,
      characters: new Map(Object.entries(bestSnapshot.projection.characters)),
      relationships: new Map(
        Object.entries(bestSnapshot.projection.relationships ?? {})
      )
    },
    messageId: bestSnapshot.messageId,
    swipeId: bestSnapshot.swipeId
  };
}
function projectStateOptimized(store, messageId, swipeId) {
  const initial = getInitialProjection(store);
  if (initial && messageId === 0) {
    return initial;
  }
  const snapshotInfo = findChapterSnapshotBefore(store, messageId);
  let startState;
  let startMessageId;
  if (snapshotInfo) {
    startState = snapshotInfo.snapshot;
    startMessageId = snapshotInfo.messageId + 1;
  } else if (initial) {
    startState = initial;
    startMessageId = 1;
  } else {
    startState = createEmptyProjectedState();
    startMessageId = 0;
  }
  const events = store.stateEvents.filter(
    (e) => !e.deleted && e.messageId >= startMessageId && (e.messageId < messageId || e.messageId === messageId && e.swipeId === swipeId)
  );
  events.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);
  let state = startState;
  for (const event of events) {
    state = applyStateEvent(state, event);
  }
  return state;
}
function addForecastEvent(store, areaName, forecast, messageId, swipeId) {
  const event = {
    id: generateUUID(),
    messageId,
    swipeId,
    timestamp: Date.now(),
    kind: "forecast_generated",
    areaName,
    forecast
  };
  store.stateEvents.push(event);
  store.stateEvents.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);
  return event.id;
}
function getLatestForecastForArea(store, areaName) {
  const areaLower = areaName.toLowerCase();
  const forecastEvents = store.stateEvents.filter(
    (e) => !e.deleted && isForecastGeneratedEvent(e) && e.areaName.toLowerCase() === areaLower
  );
  if (forecastEvents.length === 0) {
    return null;
  }
  forecastEvents.sort((a, b) => b.messageId - a.messageId || b.timestamp - a.timestamp);
  return forecastEvents[0].forecast;
}
function getAllForecastsFromEvents(store) {
  const forecastMap = /* @__PURE__ */ new Map();
  for (const event of store.stateEvents) {
    if (event.deleted || !isForecastGeneratedEvent(event)) continue;
    const areaLower = event.areaName.toLowerCase();
    const existing = forecastMap.get(areaLower);
    if (!existing || event.messageId > existing.messageId) {
      forecastMap.set(areaLower, {
        areaName: event.areaName,
        forecast: event.forecast,
        messageId: event.messageId
      });
    }
  }
  return Array.from(forecastMap.values());
}

function generateTestEvents(count) {
  const events = [];
  const subkinds = [
    "feeling_added",
    "feeling_removed",
    "secret_added",
    "secret_removed",
    "want_added",
    "want_removed",
    "status_changed"
  ];
  for (let i = 0; i < count; i++) {
    const subkind = subkinds[i % subkinds.length];
    const event = {
      id: `event-${i}`,
      kind: "relationship",
      subkind,
      pair: ["Alice", "Bob"],
      messageId: i,
      swipeId: 0,
      timestamp: Date.now() + i * 1e3
    };
    if (subkind === "status_changed") {
      event.newStatus = "friendly";
      event.previousStatus = "acquaintances";
    } else {
      event.fromCharacter = "Alice";
      event.towardCharacter = "Bob";
      event.value = `Test value ${i}`;
    }
    events.push(event);
  }
  return events;
}
const testRelationship = {
  pair: ["Alice", "Bob"],
  status: "friendly",
  aToB: {
    feelings: ["trust", "affection"],
    wants: ["protection"],
    secrets: []
  },
  bToA: {
    feelings: ["respect"],
    wants: ["approval"],
    secrets: ["knows true identity"]
  }
};
function generateMockChat(count) {
  return Array.from({ length: count }, (_, i) => ({
    // Even messages have swipe_id 0, odd messages have swipe_id 1
    swipe_id: i % 2
  }));
}
function RelationshipsTabWith400Events() {
  const events = React.useMemo(() => generateTestEvents(400), []);
  const chat = React.useMemo(() => generateMockChat(400), []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "600px", width: "800px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    RelationshipsTab,
    {
      relationships: [testRelationship],
      editMode: true,
      hasEventStore: true,
      getStateEventsForPair: () => events,
      computeMilestonesForPair: () => [],
      onStateEventUpdate: () => {
      },
      onStateEventDelete: () => {
      },
      onStateEventAdd: () => {
      },
      chatLength: 400,
      chat
    }
  ) });
}
function RelationshipsTabWith50Events() {
  const events = React.useMemo(() => generateTestEvents(50), []);
  const chat = React.useMemo(() => generateMockChat(50), []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "600px", width: "800px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    RelationshipsTab,
    {
      relationships: [testRelationship],
      editMode: true,
      hasEventStore: true,
      getStateEventsForPair: () => events,
      computeMilestonesForPair: () => [],
      onStateEventUpdate: () => {
      },
      onStateEventDelete: () => {
      },
      onStateEventAdd: () => {
      },
      chatLength: 50,
      chat
    }
  ) });
}
function RelationshipsTabWithEventStore() {
  const chat = reactExports.useMemo(() => generateMockChat(100), []);
  const [eventStore] = reactExports.useState(() => {
    const store = createUnifiedEventStore();
    const initialEvent = {
      kind: "relationship",
      subkind: "status_changed",
      pair: ["Alice", "Bob"],
      messageId: 0,
      swipeId: 0,
      timestamp: Date.now(),
      newStatus: "strangers",
      previousStatus: "strangers"
    };
    addStateEvent(store, initialEvent);
    return store;
  });
  const [version, setVersion] = reactExports.useState(0);
  const relationships = reactExports.useMemo(() => {
    void version;
    return projectRelationshipsFromCurrentState(eventStore);
  }, [eventStore, version]);
  const getStateEventsForPair = reactExports.useCallback(
    (pair) => {
      void version;
      return getRelationshipEventsForPair(eventStore, pair);
    },
    [eventStore, version]
  );
  const handleStateEventAdd = reactExports.useCallback(
    (event) => {
      addStateEvent(eventStore, event);
      invalidateProjectionsFrom(eventStore, event.messageId);
      invalidateSnapshotsFrom(eventStore, event.messageId);
      setVersion((v) => v + 1);
    },
    [eventStore]
  );
  const handleStateEventUpdate = reactExports.useCallback(
    (eventId, updates) => {
      const event = eventStore.stateEvents.find((e) => e.id === eventId);
      if (event) {
        Object.assign(event, updates);
        invalidateProjectionsFrom(eventStore, event.messageId);
        invalidateSnapshotsFrom(eventStore, event.messageId);
        setVersion((v) => v + 1);
      }
    },
    [eventStore]
  );
  const handleStateEventDelete = reactExports.useCallback(
    (eventId) => {
      const event = eventStore.stateEvents.find((e) => e.id === eventId);
      if (event) {
        event.deleted = true;
        invalidateProjectionsFrom(eventStore, event.messageId);
        invalidateSnapshotsFrom(eventStore, event.messageId);
        setVersion((v) => v + 1);
      }
    },
    [eventStore]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: "600px", width: "800px" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    RelationshipsTab,
    {
      relationships,
      editMode: true,
      hasEventStore: true,
      getStateEventsForPair,
      computeMilestonesForPair: () => [],
      onStateEventUpdate: handleStateEventUpdate,
      onStateEventDelete: handleStateEventDelete,
      onStateEventAdd: handleStateEventAdd,
      chatLength: 100,
      chat
    }
  ) });
}

export { RelationshipsTabWith400Events, RelationshipsTabWith50Events, RelationshipsTabWithEventStore };
//# sourceMappingURL=RelationshipsTab.story-Ct_rU0ni.js.map
