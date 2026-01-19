// ============================================
// Runtime State Types
// ============================================

export interface TrackedState {
  time: {
    hour: number;
    minute: number;
    day: string;
  };
  location: {
    area: string;
    place: string;
    position: string;
    props: string[];
  };
  climate: Climate;
  scene: Scene;
  characters: Character[];
}

export interface Climate {
  weather: string;
  temperature: number;
}

export interface Scene {
  topic: string;
  tone: string;
  tension: {
    level: "relaxed" | "aware" | "guarded" | "tense" | "charged" | "volatile" | "explosive";
    direction: "escalating" | "stable" | "decreasing";
    type: "confrontation" | "intimate" | "vulnerable" | "celebratory" | "negotiation" | "suspense" | "conversation";
  };
  recentEvents: string[];
}

export interface Character {
  name: string;
  position: string;
  activity?: string;
  goals: string[];
  mood: string[];
  physicalState?: string[];
  outfit: CharacterOutfit;
  dispositions?: Record<string, string[]>;
}

export interface CharacterOutfit {
  head: string | null;
  jacket: string | null;
  torso: string | null;
  legs: string | null;
  footwear: string | null;
  socks: string | null;
  underwear: string | null;
}

export interface StoredStateData {
  state: TrackedState;
  extractedAt: string;
}

// ============================================
// JSON Schema for LLM Extraction
// ============================================

export const EXTRACTION_SCHEMA = {
  type: "object",
  description: "Schema representing current state of the roleplay scenario",
  additionalProperties: false,
  properties: {
    time: {
      type: "object",
      properties: {
        hour: {
          type: "number",
          description: "Hour in 24h format (0-23)"
        },
        minute: {
          type: "number",
          description: "Minute (0-59)"
        },
        day: {
          type: "string",
          enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          description: "Day of the week i.e. 'Sunday'"
        }
      },
      required: ["hour", "minute", "day"]
    },
    location: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description: "General area: city, district, or region (e.g. 'The Glossy Mountains', 'Sherwood Forest', 'London')"
        },
        place: {
          type: "string",
          description: "Specific place: building, establishment, room (e.g. 'The Rusty Nail bar', 'Elena's bedroom', 'Industrial Estate Parking Lot')"
        },
        position: {
          type: "string",
          description: "Position within place, i.e. a room or local landmark, do not mention characters/objects or the scene's actions, this is purely a location (e.g. 'By the dumpster', 'The corner booth', 'In the jacuzzi', 'Near the door to the bathroom')"
        },
        props: {
          type: "array",
          description: "Array of nearby items which affect the scene, add details where relevant i.e. instead of 'TV', write 'TV - showing a western'",
          items: {
            type: "string",
            description: "a nearby item which is part of the scene, detailed"
          },
          maxItems: 10
        }
      },
      required: ["area", "place", "position", "props"]
    },
    climate: {
      type: "object",
      description: "The current climate",
      additionalProperties: false,
      properties: {
        weather: {
          type: "string",
          enum: ["sunny", "cloudy", "snowy", "rainy", "windy", "thunderstorm"],
          description: "The current weather in the locale (if the characters are indoors, give the weather outdoors)"
        },
        temperature: {
          type: "number",
          description: "The current temperature, in Fahrenheit (note: if characters are indoors, give the indoor temperature)"
        }
      },
      required: ["weather", "temperature"]
    },
    scene: {
      type: "object",
      description: "A summary of the current scene and its purpose",
      additionalProperties: false,
      properties: {
        topic: {
          type: "string",
          description: "3-5 words describing the main topic(s) of the current interaction"
        },
        tone: {
          type: "string",
          description: "Dominant emotional tone of the scene (2-3 words)"
        },
        tension: {
          type: "object",
          description: "The current level of tension in the scene",
          additionalProperties: false,
          properties: {
            level: {
              type: "string",
              enum: ["relaxed", "aware", "guarded", "tense", "charged", "volatile", "explosive"]
            },
            direction: {
              type: "string",
              enum: ["escalating", "stable", "decreasing"]
            },
            type: {
              type: "string",
              enum: ["confrontation", "intimate", "vulnerable", "celebratory", "negotiation", "suspense", "conversation"]
            }
          },
          required: ["level", "direction", "type"]
        },
        recentEvents: {
          type: "array",
          description: "List of significant events, max 5, prune resolved/superceded, keep most salient",
          items: {
            type: "string",
            description: "A description of the event, only include significant events"
          },
          minItems: 1,
          maxItems: 5
        }
      },
      required: ["topic", "tone", "tension", "recentEvents"]
    },
    characters: {
      type: "array",
      description: "All characters present in the current scene",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Character's name as used in the scene"
          },
          goals: {
            type: "array",
            description: "A list of the character's short-term goals",
            items: {
              type: "string",
              description: "An individual short-term goal"
            }
          },
          position: {
            type: "string",
            description: "Physical position: sitting, standing, lying down, and where (e.g. 'sitting at the bar', 'leaning against the wall'). This should be detailed, who is the character facing, are they interacting with another character?"
          },
          activity: {
            type: "string",
            description: "Current activity if any (e.g. 'nursing a whiskey', 'texting on phone')"
          },
          mood: {
            type: "array",
            description: "Current emotional states",
            minItems: 1,
            maxItems: 5,
            items: {
              type: "string",
              description: "An emotional state (e.g. 'nervous', 'excited', 'guarded')"
            }
          },
          physicalState: {
            type: "array",
            description: "Physical conditions affecting the character",
            maxItems: 5,
            items: {
              type: "string",
              description: "A physical state (e.g. 'drunk', 'tired', 'injured', 'hyped')"
            }
          },
          outfit: {
            type: "object",
            description: "Notable clothing items currently worn (include all items, including undergarments, make reasonable assumptions but be detailed), if any items are not worn, return null. If an item of clothing has been removed as part of the scene, return null for that item, if a species would not wear clothes (i.e. pony, animal, Pokémon, return null for all items unless explicitly specified).",
            properties: {
              head: {
                type: ["string", "null"],
                description: "Any headwear that the character is wearing (null if no headwear worn, or removed)"
              },
              jacket: {
                type: ["string", "null"],
                description: "If the character is wearing a second layer (null if not applicable, or removed)"
              },
              torso: {
                type: ["string", "null"],
                description: "What the character is wearing on their torso (shirt/t-shirt/vest/etc) (null if not worn, or removed)"
              },
              legs: {
                type: ["string", "null"],
                description: "What the character is wearing on their legs (cargo pants/jeans/etc) (null if not worn, or removed)"
              },
              underwear: {
                type: ["string", "null"],
                description: "What underwear the character is wearing (null if not worn, or removed). If partially removed, be descriptive: 'white panties (pulled aside)'"
              },
              socks: {
                type: ["string", "null"],
                description: "What socks the character is wearing (sports socks, thigh highs, leggings) (null if not worn, or removed). Be specific, if the character only has one sock left on, write i.e. 'black sock (left foot)'"
              },
              footwear: {
                type: ["string", "null"],
                description: "What footwear the character is wearing (shoes, boots, etc) (null if not worn, or removed). Be specific, if the character only has one shoe left on, write i.e. 'brown leather shoe (left foot)'"
              },
            },
            required: ["head", "jacket", "torso", "legs", "underwear", "socks", "footwear"]
          },
          dispositions: {
            type: "object",
            description: "Current feelings toward other characters in the scene (if a character does not know another character exists, do not include an array for that character). Remember to remove as well as add dispositions where appropriate.",
            additionalProperties: {
              type: "array",
              maxItems: 5,
              items: {
                type: "string",
                description: "A feeling toward that character (e.g. 'suspicious', 'attracted')"
              }
            }
          }
        },
        required: ["name", "position", "activity", "mood", "physicalState", "outfit", "dispositions"]
      }
    }
  },
  required: ["time", "location", "characters"]
} as const;

// ============================================
// Schema to Example (for prompt engineering)
// ============================================

export function schemaToExample(schema: any): any {
  if (schema.example) {
    return schema.example;
  }

  switch (schema.type) {
    case 'object':
      const obj: Record<string, any> = {};
      if (schema.properties) {
        for (const key in schema.properties) {
          obj[key] = schemaToExample(schema.properties[key]);
        }
      }
      if (schema.additionalProperties) {
        obj['<character_name>'] = schemaToExample(schema.additionalProperties);
      }
      return obj;
    case 'array':
      if (schema.items) {
        return [schemaToExample(schema.items)];
      }
      return [];
    case 'string':
      return schema.description || 'string';
    case 'number':
      return schema.description || 0;
    case 'boolean':
      return false;
    default:
      return null;
  }
}

export function getSchemaExample(): string {
  return JSON.stringify({
    time: { hour: 21, minute: 30, day: "Friday" },
    location: {
      area: "Downtown Seattle",
      place: "The Rusty Nail bar",
      position: "Corner booth near the jukebox",
      props: ["Jukebox", "Sauces", "Elena's Fish", "Marcus's Steak", "Wine"]
    },
    climate: {
      weather: "rainy",
      temperature: 52
    },
    scene: {
      topic: "Marcus's heist plans",
      tone: "Hushed, secretive",
      tension: {
        level: "tense",
        direction: "escalating",
        type: "negotiation"
      },
      recentEvents: [
        "Marcus invited Elena and Sarah to discuss a jewellery heist in his Speakeasy",
        "Marcus discovered that Sarah has stolen a rare painting"
      ]
    },
    characters: [
      {
        name: "Elena",
        position: "Sitting in the booth, facing the entrance, hands wrapped around a coffee mug",
        activity: "Watching the door nervously",
        mood: ["anxious", "hopeful"],
        goals: ["work out what Marcus is planning", "protect Sarah"],
        physicalState: ["tired"],
        outfit: {
          head: null,
          jacket: null,
          torso: "Dark red blouse",
          legs: "Black jeans",
          underwear: "Black lace bra and matching panties",
          socks: "Black tights",
          footwear: "Black ankle boots"
        },
        dispositions: {
          "Marcus": ["suspicious", "curious"],
          "Sarah": ["trusting", "protective"]
        }
      },
      {
        name: "Marcus",
        position: "Sitting in the booth, facing Sarah, drinking a glass of wine",
        activity: "Trying to read Sarah's expression",
        mood: ["scheming", "bargaining"],
        goals: ["convince Sarah to help with his heist", "get Elena on-side"],
        physicalState: ["alert", "confident"],
        outfit: {
          head: "Bowler hat",
          jacket: "Pinstripe jacket",
          torso: "White silk shirt",
          legs: "Dress pants",
          underwear: "White boxer briefs",
          socks: "Black dress socks",
          footwear: "Black shoes"
        },
        dispositions: {
          "Elena": ["dubious", "manipulative"],
          "Sarah": ["hopeful", "analytical"]
        }
      },
      {
        name: "Sarah",
        position: "Sitting in the booth, facing Marcus, drinking a glass of wine",
        activity: "Listening to Marcus's proposal",
        mood: ["thoughtful", "concerned"],
        goals: ["determine whether she should join Marcus's plans", "get Elena's opinions"],
        physicalState: ["relaxed", "shy"],
        outfit: {
          head: null,
          jacket: null,
          torso: "Blue velvet dress",
          legs: null,
          underwear: "Yellow bra and panties",
          socks: "White thigh-high socks with red ribbons",
          footwear: "Blue knee-high fashionable boots"
        },
        dispositions: {
          "Elena": ["trusting", "submissive"],
          "Marcus": ["concerned", "dubious"]
        }
      }
    ]
  }, null, 2);
}
