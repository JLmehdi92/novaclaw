// src/skills/automation/home-assistant.ts
import { BaseSkill, SkillContext } from "../base.js";
import { SkillError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

// ---------------------------------------------------------------------------
// Home Assistant REST API helper
// ---------------------------------------------------------------------------

interface HaConfig {
  url: string;
  token: string;
}

interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

interface HaHistoryEntry {
  entity_id: string;
  state: string;
  last_changed: string;
}

async function haRequest<T>(
  config: HaConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const base = config.url.replace(/\/$/, "");
    const parsed = new URL(base + path);
    const isHttps = parsed.protocol === "https:";
    const transport = isHttps ? https : http;

    const payload = body !== undefined ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Home Assistant API error ${res.statusCode}: ${data}`));
          return;
        }
        try {
          resolve(JSON.parse(data) as T);
        } catch {
          resolve(data as unknown as T);
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("Home Assistant request timed out (15s)"));
    });

    if (payload) req.write(payload);
    req.end();
  });
}

function resolveConfig(args: HomeAssistantArgs): HaConfig | null {
  const url =
    args.ha_url ?? process.env.HA_URL ?? process.env.HOME_ASSISTANT_URL ?? "";
  const token =
    args.ha_token ??
    process.env.HA_TOKEN ??
    process.env.HOME_ASSISTANT_TOKEN ??
    "";
  if (!url || !token) return null;
  return { url, token };
}

function setupInstructions(): string {
  return [
    "Home Assistant is not configured.",
    "",
    "To use home-assistant skill, provide your HA credentials via environment variables:",
    "  HA_URL=http://homeassistant.local:8123",
    "  HA_TOKEN=<long-lived-access-token>",
    "",
    "Or pass ha_url and ha_token as arguments in each call.",
    "",
    "To create a Long-Lived Access Token in Home Assistant:",
    "  1. Open your Home Assistant UI",
    "  2. Click your profile icon (bottom-left)",
    "  3. Scroll to 'Long-Lived Access Tokens'",
    "  4. Click 'Create Token', give it a name, and copy the value",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

type HaAction =
  | "list_entities"
  | "get_state"
  | "call_service"
  | "get_history";

interface HomeAssistantArgs {
  action: HaAction;
  ha_url?: string;
  ha_token?: string;
  // list_entities
  domain?: string;
  // get_state / get_history
  entity_id?: string;
  // call_service
  service?: string;
  service_data?: Record<string, unknown>;
  // get_history
  hours?: number;
}

export class HomeAssistantSkill extends BaseSkill {
  name = "home-assistant";
  description =
    "Control smart home devices via Home Assistant REST API. List entities, get states, call services (lights, switches, scripts, etc.), and view state history.";
  category = "automation";

  parameters = {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["list_entities", "get_state", "call_service", "get_history"],
        description:
          "list_entities: list all HA entities (optionally filtered by domain). " +
          "get_state: get current state of a specific entity. " +
          "call_service: invoke a HA service (e.g. light.turn_on). " +
          "get_history: retrieve state history for an entity.",
      },
      ha_url: {
        type: "string",
        description:
          "Home Assistant base URL (e.g. http://homeassistant.local:8123). Falls back to HA_URL env var.",
      },
      ha_token: {
        type: "string",
        description:
          "Long-Lived Access Token. Falls back to HA_TOKEN env var.",
      },
      domain: {
        type: "string",
        description:
          "Filter entities by domain for list_entities (e.g. 'light', 'switch', 'sensor'). Optional.",
      },
      entity_id: {
        type: "string",
        description: "Entity ID for get_state, call_service (target), and get_history (e.g. 'light.living_room').",
      },
      service: {
        type: "string",
        description:
          "Service to call for call_service in 'domain.service' format (e.g. 'light.turn_on', 'switch.toggle', 'homeassistant.reload_config_entry').",
      },
      service_data: {
        type: "object",
        description:
          "Additional data to pass to the service (e.g. {entity_id: 'light.kitchen', brightness: 200}).",
      },
      hours: {
        type: "number",
        description: "Number of hours of history to retrieve for get_history. Default: 24.",
      },
    },
    required: ["action"],
  };

  async execute(
    args: Record<string, unknown>,
    context: SkillContext
  ): Promise<string> {
    const typedArgs = args as unknown as HomeAssistantArgs;
    const { action } = typedArgs;

    logger.info(`[HomeAssistant] action=${action} (user: ${context.userId})`);

    const config = resolveConfig(typedArgs);
    if (!config) return setupInstructions();

    switch (action) {
      case "list_entities":
        return this.listEntities(config, typedArgs.domain);

      case "get_state":
        if (!typedArgs.entity_id)
          throw new SkillError("entity_id is required for get_state");
        return this.getState(config, typedArgs.entity_id);

      case "call_service":
        if (!typedArgs.service)
          throw new SkillError("service is required for call_service (format: domain.service)");
        return this.callService(config, typedArgs.service, typedArgs.service_data);

      case "get_history":
        if (!typedArgs.entity_id)
          throw new SkillError("entity_id is required for get_history");
        return this.getHistory(config, typedArgs.entity_id, typedArgs.hours ?? 24);

      default:
        throw new SkillError(`Unknown action: ${action}`);
    }
  }

  private async listEntities(config: HaConfig, domain?: string): Promise<string> {
    const states = await haRequest<HaState[]>(config, "GET", "/api/states");

    const filtered = domain
      ? states.filter((s) => s.entity_id.startsWith(domain + "."))
      : states;

    if (filtered.length === 0) {
      return domain
        ? `No entities found in domain: ${domain}`
        : "No entities found in Home Assistant.";
    }

    // Group by domain for readability
    const grouped: Record<string, HaState[]> = {};
    for (const s of filtered) {
      const d = s.entity_id.split(".")[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(s);
    }

    const lines: string[] = [
      `Home Assistant Entities (${filtered.length} total${domain ? `, domain: ${domain}` : ""}):`,
      "",
    ];

    for (const [dom, entities] of Object.entries(grouped).sort()) {
      lines.push(`[${dom}] (${entities.length})`);
      for (const e of entities) {
        const attrSummary = Object.keys(e.attributes).slice(0, 3).join(", ");
        lines.push(
          `  ${e.entity_id}: ${e.state}${attrSummary ? ` (attrs: ${attrSummary})` : ""}`
        );
      }
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }

  private async getState(config: HaConfig, entityId: string): Promise<string> {
    const state = await haRequest<HaState>(
      config,
      "GET",
      `/api/states/${entityId}`
    );

    const lines: string[] = [
      `Entity: ${state.entity_id}`,
      `State:  ${state.state}`,
      `Last changed: ${state.last_changed}`,
      `Last updated: ${state.last_updated}`,
      "",
      "Attributes:",
    ];

    for (const [k, v] of Object.entries(state.attributes)) {
      lines.push(`  ${k}: ${JSON.stringify(v)}`);
    }

    return lines.join("\n");
  }

  private async callService(
    config: HaConfig,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<string> {
    const parts = service.split(".");
    if (parts.length < 2)
      throw new SkillError(
        `Invalid service format: '${service}'. Expected 'domain.service' (e.g. 'light.turn_on').`
      );

    const [domain, ...rest] = parts;
    const svc = rest.join(".");
    const body = serviceData ?? {};

    const result = await haRequest<HaState[]>(
      config,
      "POST",
      `/api/services/${domain}/${svc}`,
      body
    );

    const lines = [
      `Service called: ${service}`,
      `Data: ${JSON.stringify(body)}`,
      "",
    ];

    if (Array.isArray(result) && result.length > 0) {
      lines.push(`Affected entities (${result.length}):`);
      for (const s of result) {
        lines.push(`  ${s.entity_id}: ${s.state}`);
      }
    } else {
      lines.push("Service executed (no state changes returned).");
    }

    return lines.join("\n");
  }

  private async getHistory(
    config: HaConfig,
    entityId: string,
    hours: number
  ): Promise<string> {
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const path = `/api/history/period/${since}?filter_entity_id=${entityId}`;

    const result = await haRequest<HaHistoryEntry[][]>(config, "GET", path);

    const flat: HaHistoryEntry[] = (result?.[0] ?? []) as HaHistoryEntry[];

    if (flat.length === 0) {
      return `No history found for ${entityId} in the last ${hours} hour(s).`;
    }

    const lines = [
      `History for ${entityId} (last ${hours}h, ${flat.length} entries):`,
      "",
    ];

    for (const entry of flat.slice(-50)) {
      lines.push(`  ${entry.last_changed}  →  ${entry.state}`);
    }

    if (flat.length > 50) {
      lines.push(`  ... and ${flat.length - 50} older entries`);
    }

    return lines.join("\n");
  }
}
