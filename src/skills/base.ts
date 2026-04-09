// src/skills/base.ts
export interface SkillContext {
  workspace: string;
  userId: number;
  chatId: number;
}

export interface SkillDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export abstract class BaseSkill {
  abstract name: string;
  abstract description: string;
  abstract parameters: SkillDefinition["parameters"];

  getDefinition(): SkillDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  abstract execute(args: Record<string, unknown>, context: SkillContext): Promise<string>;
}
