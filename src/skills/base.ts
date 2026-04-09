// src/skills/base.ts
export interface SkillContext {
  workspace: string;
  userId: number;
  chatId: number;
}

export interface SkillMetadata {
  id: string;
  name: string;
  category: string;
  description: string;
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
  abstract category: string;
  abstract parameters: SkillDefinition["parameters"];

  getDefinition(): SkillDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  getMetadata(): SkillMetadata {
    return {
      id: this.name,
      name: this.name,
      category: this.category,
      description: this.description,
    };
  }

  abstract execute(args: Record<string, unknown>, context: SkillContext): Promise<string>;
}
